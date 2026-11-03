import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTestDatabase } from './test-database.mjs';

// Local migration catalogue only: no .env, remote credentials, settings writes,
// approval seeding or execution plan. Every reason/deadline requires review.
export async function privacyPolicyDraft(db) {
  const {rows:[{core,fingerprint}]}=await db.query(`SELECT public.privacy_core_fields() AS core,public.privacy_application_schema() AS fingerprint`);
  const {rows:fields}=await db.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
  return {
    purpose:'Unapproved field review draft; not a retention policy or an executable erasure plan',
    version:null,retention_version:null,schema_fingerprint:fingerprint,operation_version:'core-contact-v1',
    approval_reference:null,approved_by:null,approved_at:null,expires_at:null,
    field_decisions:Object.fromEntries(fields.map(({table_name:table,column_name:field})=>[
      `${table}.${field}`,{action:core[table]?.includes(field)?'core':null,reason_reference:null,retain_until:null},
    ])),
  };
}
export async function writePrivacyPolicyDraft(db,output) {
  const draft=await privacyPolicyDraft(db),target=resolve(output);
  await mkdir(dirname(target),{recursive:true,mode:0o700});
  await writeFile(target,`${JSON.stringify(draft,null,2)}\n`,{flag:'wx',mode:0o600});
  return target;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  let db;
  try{
    const args=process.argv.slice(2);
    if(args.length>1||(args[0]&&!args[0].startsWith('--output=')))throw Error('Usage: npm run privacy:policy:draft -- [--output=PATH]');
    db=await createTestDatabase();
    const target=await writePrivacyPolicyDraft(db,args[0]?.slice('--output='.length)||'.local/privacy/policy-draft.json');
    console.log(`Prepared unapproved local field review: ${target}`);
    console.log('Reasons, retention/manual decisions, deadlines, approvals and live-inventory reconciliation remain required. No configuration was applied.');
  }catch(error){console.error(error.code==='EEXIST'?'Draft already exists; choose a new output path to preserve the review.':error.message);process.exitCode=1;}
  finally{await db?.close();}
}
