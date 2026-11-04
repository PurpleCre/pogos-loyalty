import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {menuVersion,menuBucket,replacementTables,catalogueRows,tableFingerprintQuery,buildReplacementSql} from './menu-catalogue.mjs';

// Explicit operator action, never called from app startup, migrations, CI or OTA.
// This command is confined to the currently authorised development project.
const root=resolve('.'),project='hsyibcyvujwwqygigepe',args=process.argv.slice(2);
let directory,stage='initialise';
try{
  if(args.length>1||(args.length===1&&!['--plan','--apply'].includes(args[0])))throw Error('Use --plan or --apply only.');
  const apply=args[0]==='--apply',bindings=JSON.parse(await readFile('config/environments.json','utf8'));
  const linked=(await readFile('supabase/.temp/project-ref','utf8')).trim(),env=dotenv.parse(await readFile('.env'));
  if(linked!==project||bindings.development.supabaseProjectRef!==project||new URL(env.EXPO_PUBLIC_SUPABASE_URL).origin!==`https://${project}.supabase.co`||['staging','production'].some(k=>bindings[k].supabaseProjectRef===project))throw Error('Development target mismatch.');
  const token=process.env.SUPABASE_ACCESS_TOKEN||(await readFile(join(homedir(),'.supabase/access-token'),'utf8')).trim();
  if(!token.startsWith('sbp_'))throw Error('Management credential unavailable.');
  const source=await readFile('config/pogos-menu-2026-11-04.json','utf8'),catalogue=JSON.parse(source),rows=catalogueRows(catalogue,project);
  const capture=JSON.parse(await readFile('client-materials/pogos-sadiexpress-2026-11-04/menu.json','utf8'));
  const assets=[...rows.assets];
  for(const [name,file,captured]of [['logo','assets/brand/pogos-logo.webp',capture.branding.logo],['header','assets/brand/pogos-header.webp',capture.branding.header_wide]])assets.push({key:`${menuVersion}/branding/${name}-${captured.sha256.slice(0,16)}.webp`,file,sha256:captured.sha256,kind:name});
  for(const asset of assets){const path=resolve(root,asset.file),info=await lstat(path);if(!path.startsWith(root+'/')||!info.isFile()||info.isSymbolicLink()||info.size>5000000||createHash('sha256').update(await readFile(path)).digest('hex')!==asset.sha256)throw Error('Captured image integrity failed.');}
  const headerUrl=rows.origin+'/'+assets.find(a=>a.kind==='header').key;
  const runId=new Date().toISOString().replaceAll(':','-')+'-'+randomUUID();directory=resolve('.local/menu-replacement',runId);await mkdir(directory,{recursive:true,mode:0o700});
  const save=(name,value)=>writeFile(join(directory,name),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
  async function query(sql,readOnly=true){
    const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(60000)});
    if(!response.ok){await writeFile(join(directory,'database-error.json'),(await response.text()).slice(0,12000),{mode:0o600});throw Error(`Database request failed (${response.status}).`);}return response.json();
  }
  stage='backup';
  const meta=(await query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`));
  if(!Array.isArray(meta)||meta.length<replacementTables.length||meta.some(r=>!/^[a-z_]+$/.test(r.table_name)))throw Error('Unexpected schema inventory.');
  const tables=meta.map(r=>r.table_name);if(!replacementTables.every(t=>tables.includes(t)))throw Error('Replacement schema is incomplete.');
  const fingerprintSQL=t=>`(${tableFingerprintQuery(t)})`;
  const backupSQL=`SELECT jsonb_build_object(
    'fingerprints',(SELECT jsonb_object_agg(name,digest) FROM (VALUES ${tables.map(t=>`('${t}',${fingerprintSQL(t)})`).join(',')}) r(name,digest)),
    'counts',(SELECT jsonb_object_agg(name,n) FROM (VALUES ${tables.map(t=>`('${t}',(SELECT count(*) FROM public.${t}))`).join(',')}) r(name,n)),
    'rows',jsonb_build_object(${replacementTables.map(t=>`'${t}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.${t} t)`).join(',')}),
    'sort_order_ready',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_items' AND column_name='sort_order')
  ) AS backup`;
  const backup=(await query(backupSQL))[0]?.backup;if(!backup?.fingerprints)throw Error('Incomplete backup.');
  await save('backup.json',{project_ref:project,captured_at:new Date().toISOString(),...backup});
  const sql=buildReplacementSql(catalogue,project,backup.fingerprints,headerUrl);
  await writeFile(join(directory,'replacement.sql'),sql+'\n',{mode:0o600,flag:'wx'});
  const plan={project_ref:project,environment:'development',mode:apply?'apply':'plan',source_sha256:createHash('sha256').update(source).digest('hex'),before:{orders:backup.counts.orders,menu_items:backup.counts.menu_items,categories:backup.counts.menu_categories},after:{orders:0,menu_items:rows.items.length,categories:rows.categories.length,options:rows.options.length,choices:rows.choices.length,available:rows.items.filter(i=>i.is_available).length,product_images:rows.assets.length},asset_files:assets.length,shared_branches:catalogue.confirmed_branches,sort_order_ready:backup.sort_order_ready,backup_directory:directory};
  await save('plan.json',plan);console.log(JSON.stringify(plan,null,2));
  if(apply){
    if(!backup.sort_order_ready)throw Error('Apply the reviewed catalogue sort migration before replacing data.');
    const jwt=JSON.parse(Buffer.from((env.secret_key??'').split('.')[1]??'','base64url').toString());
    if(jwt.role!=='service_role'||jwt.ref!==project)throw Error('Matching server storage credential required.');
    stage='upload-assets';
    const client=createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.secret_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,redirect:'error',signal:options?.signal??AbortSignal.timeout(20000)})}});
    const bucket=await client.storage.getBucket(menuBucket);
    if(bucket.error){if(String(bucket.error.statusCode)!=='404')throw Error('Cannot verify asset bucket.');const created=await client.storage.createBucket(menuBucket,{public:true,allowedMimeTypes:['image/webp'],fileSizeLimit:5000000});if(created.error)throw Error('Cannot create asset bucket.');}
    else if(!bucket.data.public)throw Error('The expected public menu bucket is private; review its ownership before changing it.');
    const uploaded=[];let cursor=0;
    await Promise.all(Array.from({length:3},async()=>{while(cursor<assets.length){const asset=assets[cursor++],bytes=await readFile(asset.file);const result=await client.storage.from(menuBucket).upload(asset.key,bytes,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
      if(result.error){const existing=await client.storage.from(menuBucket).download(asset.key);if(existing.error||createHash('sha256').update(Buffer.from(await existing.data.arrayBuffer())).digest('hex')!==asset.sha256)throw Error('Asset upload could not be verified.');}
      uploaded.push({key:asset.key,sha256:asset.sha256,bytes:bytes.length});
    }}));
    await save('uploaded-assets.json',{bucket:menuBucket,files:uploaded});
    stage='replace-database';
    // No mutation retry. If the response is lost, inspect the actual database
    // before another operator action. The old backup hashes fence a replay.
    await query(sql,false);
    stage='verify';
    const actual=(await query(`SELECT jsonb_build_object('categories',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM (SELECT id,name,sort_order,is_active FROM public.menu_categories) t),
      'items',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM (SELECT id,category_id,name,description,price::text AS price,image_url,is_available,store_id,sort_order FROM public.menu_items) t),
      'orders',(SELECT count(*) FROM public.orders),'order_items',(SELECT count(*) FROM public.order_items),
      'options',(SELECT count(*) FROM public.menu_item_options),'choices',(SELECT count(*) FROM public.menu_item_option_choices),
      'protected_fingerprints',(SELECT jsonb_object_agg(name,digest) FROM (VALUES ${tables.filter(t=>!replacementTables.includes(t)).map(t=>`('${t}',${fingerprintSQL(t)})`).join(',')}) r(name,digest)),
      'branches',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'is_open',is_open,'image_url',image_url,'latitude',latitude,'longitude',longitude) ORDER BY name) FROM public.stores WHERE name IN ('Pogo''s Msasa','Pogo''s Kamfinsa','Pogo''s Westgate'))
    ) AS actual`))[0]?.actual;
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    const sorted=xs=>xs.toSorted((a,b)=>a.id.localeCompare(b.id));
    if(!actual||actual.orders!==0||actual.order_items!==0||actual.options!==rows.options.length||actual.choices!==rows.choices.length||actual.branches.length!==3||JSON.stringify(canonical(sorted(actual.items)))!==JSON.stringify(canonical(sorted(rows.items)))||JSON.stringify(canonical(sorted(actual.categories)))!==JSON.stringify(canonical(sorted(rows.categories)))||Object.entries(actual.protected_fingerprints).some(([t,hash])=>hash!==backup.fingerprints[t]))throw Error('Post-replacement verification requires review.');
    await save('verification.json',{verified_at:new Date().toISOString(),status:'passed',project_ref:project,orders:actual.orders,order_items:actual.order_items,menu_items:actual.items.length,categories:actual.categories.length,options:actual.options,choices:actual.choices,protected_tables_unchanged:Object.keys(actual.protected_fingerprints).length,branches:actual.branches,asset_files:uploaded.length});
    console.log('Development menu replacement verified. Private backup and evidence:',directory);
  }else console.log('Read-only plan complete. No database or storage changes made.');
}catch(error){
  if(directory)await writeFile(join(directory,'failure.json'),JSON.stringify({stage,status:'needs_review',message:error.message},null,2)+'\n',{mode:0o600});
  console.error('Menu replacement stopped at',stage+'.',error.message);process.exitCode=1;
}
