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
 const status=await rpc(admin,'begin_development_mfa_session');assert.equal(status.active,true);assert.equal(status.non_expiring,true);assert.equal(status.expires_at,null);
 assert.equal((await db.query('SELECT expires_at FROM public.development_mfa_sessions WHERE session_id=$1',[sid])).rows[0].expires_at,null);
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
test('explicit non-expiring server status remains active beyond the old date and eight-hour client cap',()=>{
 const state=developerAccessStatus({available:true,active:true,expires_at:null,non_expiring:true,server_time:'2026-11-04T12:00:00Z'},admin,1000,500);
 assert.equal(state.remainingMs,null);
 assert.equal(developerAccessActive(state,admin,1000+30*86400000,500+30*86400000),true);
 assert.equal(developerAccessActive(state,other,1001,501),false);
 assert.equal(developerAccessStatus({available:true,active:true,expires_at:null,server_time:'2026-11-04T12:00:00Z'},admin,1000,500).available,false);
 assert.equal(developerAccessStatus({available:true,active:true,expires_at:null,non_expiring:true,server_time:'invalid'},admin),null);
});
test('legacy finite server status still expires at its declared deadline without an invented eight-hour cap',()=>{
 const state=developerAccessStatus({available:true,active:true,expires_at:'2026-11-06T12:00:00Z',server_time:'2026-11-04T12:00:00Z'},admin,1000,500);
 assert.equal(developerAccessActive(state,admin,1000+86400000,500+86400000),true);
 assert.equal(developerAccessActive(state,admin,1000+2*86400000,500+2*86400000),false);
});
test('non-expiring grants and sessions still lose access when disabled, without changing existing roles',async()=>{
 await configure('pgonese6@gmail.com',true);const status=await rpc(admin,'begin_development_mfa_session');
 assert.equal(status.expires_at,null);assert.equal(status.non_expiring,true);assert.equal(await rpc(admin,'has_role',[admin,'admin']),true);
 await configure('pgonese6@gmail.com',false);assert.equal(await rpc(admin,'has_role',[admin,'admin']),false);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM public.user_roles WHERE user_id=$1 AND role='admin'",[admin])).rows[0].n,1);
});
test('installed clients receive a usable refresh window without reinstating a server session deadline',async()=>{
 await configure('pgonese6@gmail.com',true);await rpc(admin,'begin_development_mfa_session');
 const current=await rpc(admin,'development_mfa_status_v2'),legacy=await rpc(admin,'development_mfa_status');
 assert.equal(current.expires_at,null);assert.equal(current.non_expiring,true);
 assert.equal(legacy.active,true);assert.ok(Date.parse(legacy.expires_at)>Date.parse(legacy.server_time));
 assert.equal((await db.query('SELECT expires_at FROM public.development_mfa_sessions WHERE session_id=$1',[sid])).rows[0].expires_at,null);
});
test('migration removes timers without restoring ended/expired sessions or enabling disabled grants',async()=>{
 const actor=randomUUID(),live=randomUUID(),expired=randomUUID(),ended=randomUUID();
 const upgraded=await createTestDatabase({beforeMigration:async(database,filename)=>{
  if(filename!=='20261104020000_development_mfa_manual_expiry.sql')return;
  await database.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,'pgonese6@gmail.com']);
  await database.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')",[actor]);
  await database.query("INSERT INTO public.development_mfa_grants(email,enabled,expires_at,reason) VALUES('pgonese6@gmail.com',true,'2026-11-10T22:00:00Z','Historical enabled entry'),('rathvelem@gmail.com',false,'2026-11-10T22:00:00Z','Historical disabled entry')");
  await database.query("INSERT INTO public.development_mfa_events(kind,email,details) SELECT 'configure',email,jsonb_build_object('enabled',enabled,'reason',reason) FROM public.development_mfa_grants");
  for(const [id,offset,isEnded]of[[live,3600,false],[expired,-3600,false],[ended,3600,true]]){
   await database.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[id,actor]);
   await database.query("INSERT INTO public.development_mfa_sessions(session_id,user_id,email,expires_at,ended_at) VALUES($1,$2,'pgonese6@gmail.com',now()+$3*interval '1 second',CASE WHEN $4 THEN now() END)",[id,actor,offset,isEnded]);
  }
 }});
 try{
  const grants=(await upgraded.query('SELECT email,enabled,expires_at FROM public.development_mfa_grants ORDER BY email')).rows;
  assert.deepEqual(grants.map(g=>[g.enabled,g.expires_at]),[[true,null],[false,null]]);
  for(const [id,expected]of[[live,true],[expired,false],[ended,false]]){
   const status=await asRole(upgraded,'authenticated',actor,async()=> (await upgraded.query('SELECT public.development_mfa_status_v2() AS value')).rows[0].value,claims(id));
   assert.equal(status.active,expected);
  }
  assert.equal((await upgraded.query("SELECT count(*)::int AS n FROM public.development_mfa_events WHERE details->>'non_expiring'='true'")).rows[0].n,2);
  assert.equal((await upgraded.query("SELECT count(*)::int AS n FROM public.development_mfa_events WHERE NOT details ? 'non_expiring'")).rows[0].n,2);
 }finally{await upgraded.close();}
});
