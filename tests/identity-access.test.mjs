import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asRole } from '../scripts/test-database.mjs';
const admin = randomUUID(), secondAdmin = randomUUID(), staff = randomUUID(), customer = randomUUID(), unverified = randomUUID();
const a = randomUUID(), b = randomUUID(), c = randomUUID();
let db;
before(async () => {
  db = await createTestDatabase();
  for (const [id, email] of [[admin,'admin@identity.test'],[secondAdmin,'backup@identity.test'],[staff,'staff@identity.test'],[customer,'customer@identity.test'],[unverified,'unverified@identity.test']]) await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)',[id,email]);
  await db.query('UPDATE auth.users SET email_confirmed_at = NULL WHERE id = $1',[unverified]);
  for (const [id,name] of [[a,'Msasa fixture'],[b,'Kamfinsa fixture'],[c,'Westgate fixture']]) await db.query('INSERT INTO public.stores(id,name,address,distance_miles) VALUES ($1,$2,$2,0)',[id,name]);
  await db.query(`INSERT INTO public.user_roles(user_id,role,staff_store_id) VALUES ($1,'admin',NULL),($2,'staff',$3)`,[admin,staff,a]);
  await db.query('INSERT INTO public.staff_memberships(user_id,store_id) VALUES ($1,$2)',[staff,a]);
  await db.query('INSERT INTO public.orders(user_id,store_id,total_amount) VALUES ($1,$2,10),($1,$3,20),($1,$4,30)',[customer,a,b,c]);
});
after(async()=>{await db?.close();});
async function rpc(actor,name,args=[],claims={aal:'aal2'}) {
  return asRole(db,'authenticated',actor,async()=> (await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS result`,args)).rows[0].result,claims);
}
async function invite(email='staff@identity.test',branch=b,id=randomUUID()) {await rpc(admin,'invite_branch_staff',[id,email,branch,'Approved fixture assignment']); return id;}
const setAccess=(id,role,stores,reason='Reviewed fixture change')=>rpc(admin,'set_identity_access',[id,role,stores,reason]);
test('staff AAL1 cannot read branch orders or invoke branch APIs; AAL2 can',async()=>{
  assert.equal(await rpc(staff,'cash_staff_access',[a,staff],{aal:'aal1'}),false);
  const rows=await asRole(db,'authenticated',staff,()=>db.query('SELECT id FROM public.orders'),{aal:'aal1'});assert.equal(rows.rows.length,0);
  await assert.rejects(rpc(staff,'list_cash_branch_staff',[a],{aal:'aal1'}),{code:'42501'});
  assert.equal(await rpc(staff,'cash_staff_access',[a,staff]),true);
});
test('an administrator password alone cannot grant roles or read other accounts',async()=>{
  assert.equal(await rpc(admin,'has_role',[admin,'admin'],{aal:'aal1'}),false);
  await assert.rejects(rpc(admin,'invite_branch_staff',[randomUUID(),'x@identity.test',a,'Fixture reason'],{aal:'aal1'}),{code:'42501'});
  const profiles=await asRole(db,'authenticated',admin,()=>db.query('SELECT id FROM public.profiles'),{aal:'aal1'});
  assert.deepEqual(profiles.rows,[{id:admin}]);
});
test('missing assurance claims fail closed while ordinary customer reads still work',async()=>{
  assert.equal(await rpc(admin,'has_role',[admin,'admin'],{}),false);
  const orders=await asRole(db,'authenticated',customer,()=>db.query('SELECT id FROM public.orders'),{aal:'aal1'});assert.equal(orders.rows.length,3);
});
test('no customer, staff or administrator may write role rows or assignment columns directly',async()=>{
  for(const actor of [customer,staff,admin])await asRole(db,'authenticated',actor,async()=>{
    await assert.rejects(db.query(`INSERT INTO public.user_roles(user_id,role) VALUES ($1,'admin')`,[customer]),{code:'42501'});
    await assert.rejects(db.query('UPDATE public.user_roles SET staff_store_id=$1 WHERE user_id=$2',[b,staff]),{code:'42501'});
    await assert.rejects(db.query('DELETE FROM public.user_roles WHERE user_id=$1',[staff]),{code:'42501'});
    await assert.rejects(db.query('UPDATE public.staff_memberships SET active=false'),{code:'42501'});
  });
});
test('invitation creation is idempotent, audited and rejects changed requests',async()=>{
  const id=await invite(); assert.equal(await rpc(admin,'invite_branch_staff',[id,'STAFF@IDENTITY.TEST',b,'Approved fixture assignment']),id);
  assert.equal((await db.query('SELECT * FROM public.identity_access_events WHERE invitation_id=$1',[id])).rows.length,1);
  await assert.rejects(rpc(admin,'invite_branch_staff',[id,'customer@identity.test',b,'Approved fixture assignment']),{code:'22023'});
  assert.equal((await asRole(db,'authenticated',customer,()=>db.query('SELECT id FROM public.staff_invitations'))).rows.length,0);
});
test('only the verified recipient with MFA can accept; customer metadata cannot impersonate email',async()=>{
  const id=await invite();
  await db.query(`UPDATE auth.users SET raw_user_meta_data='{"email":"staff@identity.test","role":"admin"}' WHERE id=$1`,[customer]);
  await assert.rejects(rpc(customer,'accept_staff_invitation',[id]),{code:'42501'});
  await assert.rejects(rpc(staff,'accept_staff_invitation',[id],{aal:'aal1'}),{code:'42501'});
  const bad=await invite('unverified@identity.test',a);await assert.rejects(rpc(unverified,'accept_staff_invitation',[bad]),{code:'42501'});
  assert.equal(await rpc(staff,'accept_staff_invitation',[id]),b);
  assert.equal(await rpc(staff,'accept_staff_invitation',[id]),b);
  assert.equal((await db.query(`SELECT * FROM public.identity_access_events WHERE invitation_id=$1 AND action='accept'`,[id])).rows.length,1);
});
test('multi-branch members can read assigned queues without gaining another branch',async()=>{
  assert.equal(await rpc(staff,'cash_staff_access',[a,staff]),true);assert.equal(await rpc(staff,'cash_staff_access',[b,staff]),true);assert.equal(await rpc(staff,'cash_staff_access',[c,staff]),false);
  const rows=await asRole(db,'authenticated',staff,()=>db.query('SELECT store_id FROM public.orders ORDER BY total_amount'));
  assert.deepEqual(rows.rows,[{store_id:a},{store_id:b}]);
});
test('revoked and expired invitations cannot grant access; the directory is recipient-specific',async()=>{
  const expired=await invite('customer@identity.test',c);await db.query(`UPDATE public.staff_invitations SET expires_at=now()-interval '1 second' WHERE id=$1`,[expired]);
  await assert.rejects(rpc(customer,'accept_staff_invitation',[expired]),{code:'42501'});
  const revoked=await invite('customer@identity.test',c);await rpc(admin,'revoke_staff_invitation',[revoked,'Fixture cancellation']);
  await assert.rejects(rpc(customer,'accept_staff_invitation',[revoked]),{code:'42501'});
  await assert.rejects(rpc(customer,'revoke_staff_invitation',[expired,'Not authorised']),{code:'42501'});
  assert.deepEqual(await rpc(customer,'my_staff_invitations'),[]);
});
test('role revocation removes branch access immediately and blocks old invitation replay',async()=>{
  const old=await invite('staff@identity.test',c);await rpc(staff,'accept_staff_invitation',[old]);
  const unused=await invite('staff@identity.test',b);
  await db.query('INSERT INTO public.cash_branch_cashiers(store_id,user_id,active) VALUES ($1,$2,true)',[a,staff]);
  await setAccess(staff,'user',[]);
  assert.equal(await rpc(staff,'cash_staff_access',[a,staff]),false);
  await assert.rejects(rpc(staff,'accept_staff_invitation',[old]),{code:'42501'});
  await assert.rejects(rpc(staff,'accept_staff_invitation',[unused]),{code:'42501'});
  assert.equal((await db.query('SELECT active FROM public.cash_branch_cashiers WHERE user_id=$1',[staff])).rows[0].active,false);
});
test('audited access updates support explicit branch sets and preserve a final administrator',async()=>{
  await setAccess(staff,'staff',[a,c]);
  assert.equal(await rpc(staff,'cash_staff_access',[b,staff]),false);assert.equal(await rpc(staff,'cash_staff_access',[c,staff]),true);
  await assert.rejects(setAccess(admin,'user',[]),{code:'42501'});
  await assert.rejects(setAccess(unverified,'admin',[]),{code:'22023'});
  await assert.rejects(setAccess(staff,'staff',[randomUUID()]),{code:'22023'});
  await assert.rejects(setAccess(staff,'staff',[a],''),{code:'22023'});
  await setAccess(secondAdmin,'admin',[]);
  assert.equal(await rpc(secondAdmin,'has_role',[secondAdmin,'admin']),true);
  const events=await db.query(`SELECT details FROM public.identity_access_events WHERE subject_id=$1 AND action='set_access' ORDER BY created_at DESC`,[staff]);
  assert.equal(events.rows[0].details.role,'staff');assert.ok(events.rows[0].details.before);
});
test('an authenticated caller cannot use a different actor argument to borrow an administrator session',async()=>{
  assert.equal(await rpc(customer,'has_role',[admin,'admin']),false);assert.equal(await rpc(customer,'cash_staff_access',[a,admin]),false);
});
test('access audit and internal assignment helpers are protected',async()=>{
  for(const actor of [customer,staff,admin]) await asRole(db,'authenticated',actor,async()=>{
    await assert.rejects(db.query(`DELETE FROM public.identity_access_events`),{code:'42501'});
    await assert.rejects(db.query(`SELECT public.staff_assignment($1,$2)`,[a,staff]),{code:'42501'});
  });
  await asRole(db,'anon',null,()=>assert.rejects(db.query(`SELECT public.my_staff_invitations()`),{code:'42501'}));
  await asRole(db,'service_role',null,()=>assert.rejects(db.query('DELETE FROM public.identity_access_events'),{code:'42501'}));
  await assert.rejects(db.query(`UPDATE public.identity_access_events SET action='forged'`),{code:'42501'});
});
test('legacy inline store and GAAP policies cannot bypass administrator MFA',async()=>{
  await asRole(db,'authenticated',admin,async()=>{
    assert.equal((await db.query('UPDATE public.stores SET name=name WHERE id=$1 RETURNING id',[a])).rows.length,0);
    assert.equal((await db.query('DELETE FROM public.stores WHERE id=$1 RETURNING id',[c])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM public.gaap_config')).rows.length,0);
  },{aal:'aal1'});
});
