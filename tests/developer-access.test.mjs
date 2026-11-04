import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';
import { developerAccessEnvironment, developerAccessStatus, developerAccessActive } from '../lib/developer-access.ts';
import { roleSnapshot } from '../lib/identity.ts';
const admin=randomUUID(),other=randomUUID(),future=randomUUID(),sid=randomUUID(),otherSid=randomUUID(),branch=randomUUID(),outside=randomUUID();
const issuer='https://hsyibcyvujwwqygigepe.supabase.co/auth/v1';let db;
const claims=(session_id=sid,extra={})=>({aal:'aal1',iss:issuer,session_id,amr:[{method:'password'}],...extra});
const rpc=(id,name,args=[],jwt=claims())=>asRole(db,'authenticated',id,async()=> (await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,args)).rows[0].value,jwt);
const configure=(email,enabled)=>asRole(db,'service_role',null,()=>db.query('SELECT public.configure_development_mfa_bypass($1,$2,$3)',[email,enabled,'Authorised isolated test configuration']));
before(async()=>{db=await createTestDatabase();for(const [id,email]of[[admin,'pgonese6@gmail.com'],[other,'other@developer.test']]){await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,email]);await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')",[id]);}await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2),($3,$4)',[sid,admin,otherSid,other]);for(const id of [branch,outside])await db.query('INSERT INTO public.stores(id,name,address,distance_miles) VALUES($1,$2,$2,0)',[id,id]);});
after(async()=>{await db?.close();});
test('developer exceptions are absent by default and normal administrators cannot configure them',async()=>{
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.development_mfa_grants')).rows[0].n,0);
 assert.equal((await rpc(admin,'development_mfa_status')).available,false);
 await assert.rejects(rpc(admin,'configure_development_mfa_bypass',['pgonese6@gmail.com',true,'Not a service operation']),{code:'42501'});
 await configure('pgonese6@gmail.com',true);await configure('rathvelem@gmail.com',true);
});
test('a named developer explicitly starts a session, retains existing roles and never obtains a fake AAL2 claim',async()=>{
 assert.equal((await rpc(admin,'development_mfa_status')).available,true);assert.equal(await rpc(admin,'has_role',[admin,'admin']),false);
 const status=await rpc(admin,'begin_development_mfa_session');assert.equal(status.active,true);
 assert.equal(await rpc(admin,'has_role',[admin,'admin']),true);assert.equal(await rpc(admin,'identity_aal2'),false);
 await rpc(admin,'begin_development_mfa_session');assert.equal((await db.query("SELECT count(*)::int AS n FROM public.development_mfa_events WHERE kind='begin'")).rows[0].n,1);
});
test('other accounts, spoofed email metadata and anonymous callers cannot use the named exception',async()=>{
 await db.query('UPDATE auth.users SET raw_user_meta_data=$1 WHERE id=$2',[JSON.stringify({email:'pgonese6@gmail.com'}),other]);
 await assert.rejects(rpc(other,'begin_development_mfa_session',[],claims(otherSid)),{code:'42501'});
 assert.equal(await rpc(other,'has_role',[other,'admin'],claims(otherSid)),false);
 await assert.rejects(asRole(db,'anon',null,()=>db.query('SELECT public.begin_development_mfa_session()')),{code:'42501'});
});
test('production/staging issuers, recovery sessions, missing sessions and missing password proof are denied',async()=>{
 for(const jwt of [claims(sid,{iss:'https://production.supabase.co/auth/v1'}),claims(sid,{iss:'https://staging.supabase.co/auth/v1'}),claims(sid,{iss:undefined}),claims(sid,{amr:[{method:'recovery'},{method:'password'}]}),claims(sid,{amr:[{method:'otp'}]}),claims(randomUUID()),claims('invalid')]){
  assert.equal((await rpc(admin,'development_mfa_status',[],jwt)).available,false);assert.equal(await rpc(admin,'has_role',[admin,'admin'],jwt),false);await assert.rejects(rpc(admin,'begin_development_mfa_session',[],jwt),{code:'42501'});
 }
});
test('the future developer needs a verified account, an existing staff/admin role and branch membership',async()=>{
 const session=randomUUID();await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,NULL)',[future,'rathvelem@gmail.com']);await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[session,future]);
 await assert.rejects(rpc(future,'begin_development_mfa_session',[],claims(session)),{code:'42501'});
 await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[future]);await assert.rejects(rpc(future,'begin_development_mfa_session',[],claims(session)),{code:'42501'});
 await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'staff')",[future]);await db.query('INSERT INTO public.staff_memberships(user_id,store_id) VALUES($1,$2)',[future,branch]);
 await rpc(future,'begin_development_mfa_session',[],claims(session));assert.equal(await rpc(future,'cash_staff_access',[branch,future],claims(session)),true);assert.equal(await rpc(future,'cash_staff_access',[outside,future],claims(session)),false);
});
test('a bypass is bound to the real Auth session and disappears when the Auth session ends',async()=>{
 const fresh=randomUUID();await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[fresh,admin]);assert.equal((await rpc(admin,'development_mfa_status',[],claims(fresh))).active,false);
 await rpc(admin,'begin_development_mfa_session',[],claims(fresh));await db.query('DELETE FROM auth.sessions WHERE id=$1',[fresh]);assert.equal(await rpc(admin,'has_role',[admin,'admin'],claims(fresh)),false);
});
test('ending, revoking and expiring development access deny the same previously authorised token',async()=>{
 await rpc(admin,'end_development_mfa_session');assert.equal(await rpc(admin,'has_role',[admin,'admin']),false);
 await rpc(admin,'begin_development_mfa_session');await configure('pgonese6@gmail.com',false);assert.equal(await rpc(admin,'has_role',[admin,'admin']),false);
 await configure('pgonese6@gmail.com',true);assert.equal((await rpc(admin,'development_mfa_status')).active,false);await rpc(admin,'begin_development_mfa_session');
 await db.query("UPDATE public.development_mfa_sessions SET expires_at=now()-interval '1 second' WHERE session_id=$1",[sid]);assert.equal(await rpc(admin,'has_role',[admin,'admin']),false);
 await db.query("UPDATE public.development_mfa_grants SET expires_at=now()-interval '1 second' WHERE email='pgonese6@gmail.com'");assert.equal((await rpc(admin,'development_mfa_status')).available,false);
});
test('allowlist, session and audit tables reject client writes; audit evidence is immutable',async()=>{
 for(const table of ['development_mfa_grants','development_mfa_sessions','development_mfa_events'])await assert.rejects(asRole(db,'authenticated',admin,()=>db.query(`DELETE FROM public.${table}`)),{code:'42501'});
 await assert.rejects(db.query('DELETE FROM public.development_mfa_events'),{code:'42501'});
 await assert.rejects(configure('unapproved@developer.test',true),{code:'22023'});
 await assert.rejects(db.query("UPDATE public.development_mfa_grants SET expires_at='2027-01-01'"),{code:'23514'});
});
test('a real AAL2 session retains ordinary access independently of the development exception',async()=>{
 assert.equal(await rpc(other,'has_role',[other,'admin'],claims(otherSid,{aal:'aal2',iss:'https://production.supabase.co/auth/v1'})),true);
});
test('client developer access is restricted to the development project and explicit local verification',()=>{
 for(const name of ['staging','production'])assert.equal(developerAccessEnvironment({name,supabaseProjectRef:'hsyibcyvujwwqygigepe',supabaseUrl:issuer.replace('/auth/v1','')}),false);
 assert.equal(developerAccessEnvironment({name:'development',supabaseProjectRef:'wrong',supabaseUrl:issuer.replace('/auth/v1','')}),false);
 assert.equal(developerAccessEnvironment({name:'development',supabaseProjectRef:'hsyibcyvujwwqygigepe',supabaseUrl:issuer.replace('/auth/v1','')}),true);
});
test('client assurance rejects malformed state, account switching, expiry and backward clocks',()=>{
 const state=developerAccessStatus({available:true,active:true,expires_at:'2026-11-04T12:01:00Z',server_time:'2026-11-04T12:00:00Z'},admin,1000,500);
 assert.equal(developerAccessActive(state,admin,1001,501),true);
 for(const [id,wall,mono]of[[other,1001,501],[admin,61000,60500],[admin,999,501],[admin,1001,499]])assert.equal(developerAccessActive(state,id,wall,mono),false);
 assert.equal(developerAccessStatus({available:true,active:true,expires_at:'bad',server_time:'bad'},admin),null);
 assert.equal(developerAccessStatus({},admin),null);
});
test('client development assurance preserves role and branch scope without granting an unassigned role',()=>{
 assert.equal(roleSnapshot([{role:'admin'}],[],'aal1',true).role,'admin');assert.equal(roleSnapshot([{role:'staff'}],[],'aal1',true).role,'user');assert.equal(roleSnapshot([{role:'user'}],[],'aal1',true).role,'user');assert.equal(roleSnapshot([{role:'admin'}],[],'aal1').role,'user');
});
