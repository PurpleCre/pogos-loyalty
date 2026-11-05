// Operator-only development configuration. Never import this into the app.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
const project='hsyibcyvujwwqygigepe',emails=['pgonese6@gmail.com','rathvelem@gmail.com'];
const mode=process.argv[2];
if(process.argv.length!==3||!['--status','--enable','--disable'].includes(mode))throw Error('Use --status, --enable or --disable.');
const bindings=JSON.parse(readFileSync('config/environments.json','utf8'));
if(bindings.development.supabaseProjectRef!==project||['staging','production'].some(name=>bindings[name].supabaseProjectRef===project))throw Error('Development project binding is not isolated.');
const local=dotenv.parse(readFileSync('.env'));
if(local.EXPO_PUBLIC_SUPABASE_URL!==`https://${project}.supabase.co`)throw Error('Unexpected development URL.');
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==project)throw Error('Linked project mismatch.');
const token=readFileSync(join(homedir(),'.supabase/access-token'),'utf8').trim();
const query=async sql=>{
 const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:true}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`Read-only configuration check failed (${response.status}).`);
 return response.json();
};
try{
 const rows=await query(`SELECT t.email,u.id IS NOT NULL AS account_exists,u.email_confirmed_at IS NOT NULL AS email_verified,
 coalesce((SELECT jsonb_agg(r.role ORDER BY r.role) FROM public.user_roles r WHERE r.user_id=u.id),'[]') AS existing_roles,
 has_table_privilege(current_user,'auth.sessions','SELECT') AS can_check_auth_sessions,
 to_regclass('public.development_mfa_grants') IS NOT NULL AS schema_ready
 FROM unnest(ARRAY['pgonese6@gmail.com','rathvelem@gmail.com']) t(email) LEFT JOIN auth.users u ON lower(u.email)=t.email ORDER BY t.email`);
 if(mode!=='--status'){
  if(!rows.every(r=>r.schema_ready))throw Error('Apply the reviewed development migration before activation.');
  const key=local.SUPABASE_SERVICE_ROLE_KEY??local.secret_key;
  const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());
  if(claims.role!=='service_role'||claims.ref!==project)throw Error('A development-only service credential is required.');
  const client=createClient(local.EXPO_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)})}});
  for(const email of emails){const {error}=await client.rpc('configure_development_mfa_bypass',{p_email:email,p_enabled:mode==='--enable',p_reason:'User authorised named developer access until manually disabled on 4 November 2026; preserve existing roles'});if(error)throw Error('Named configuration was not confirmed.');}
 }
 const grants=rows.every(r=>r.schema_ready)?await query("SELECT email,enabled,expires_at FROM public.development_mfa_grants ORDER BY email"):[];
 const report={checked_at:new Date().toISOString(),project,operation:mode,accounts:rows,grants};
 mkdirSync('.local/developer-access',{recursive:true,mode:0o700});
 writeFileSync(`.local/developer-access/${mode.slice(2)}.json`,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify(report,null,2));
}catch(error){console.error(JSON.stringify({failed:true,networkCode:error?.cause?.code??null,message:error instanceof Error?error.message:'Development configuration failed.'}));process.exitCode=1;}
