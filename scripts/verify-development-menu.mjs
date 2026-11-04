import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {catalogueRows,menuVersion} from './menu-catalogue.mjs';

// Read-only acceptance through the same anonymous PostgREST/storage routes used
// by public app browsing. No management or service-role credential is used.
const project='hsyibcyvujwwqygigepe';
try {
  assert.equal(process.argv.length,2,'This verifier accepts no target arguments.');
  const env=dotenv.parse(await readFile('.env'));
  const bindings=JSON.parse(await readFile('config/environments.json','utf8'));
  assert.equal(bindings.development.supabaseProjectRef,project);
  assert.ok(['staging','production'].every(k=>bindings[k].supabaseProjectRef!==project));
  assert.equal((await readFile('supabase/.temp/project-ref','utf8')).trim(),project);
  assert.equal(new URL(env.EXPO_PUBLIC_SUPABASE_URL).origin,`https://${project}.supabase.co`);
  const key=env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(key,'A public browsing key is required.');
  if(!key.startsWith('sb_publishable_')) {
    const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());
    assert.equal(claims.role,'anon');assert.equal(claims.ref,project);
  }
  const catalogue=JSON.parse(await readFile('config/pogos-menu-2026-11-04.json','utf8'));
  const rows=catalogueRows(catalogue,project);
  const client=createClient(env.EXPO_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(url,options)=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)})}});
  const unwrap=({data,error})=>{assert.ok(!error,'A public browsing request failed.');return data;};
  const ordered=xs=>xs.toSorted((a,b)=>a.id.localeCompare(b.id));
  const stores=unwrap(await client.from('stores').select('id,name,is_open,address,latitude,longitude,image_url').neq('name',"Pogo's Closed Branch").order('name'));
  assert.deepEqual(stores.map(s=>s.name).toSorted(),catalogue.confirmed_branches.map(n=>"Pogo's "+n).toSorted());
  const categories=unwrap(await client.from('menu_categories').select('id,name,sort_order,is_active').eq('is_active',true).order('sort_order'));
  assert.deepEqual(ordered(categories),ordered(rows.categories));
  const expected=rows.items.filter(i=>i.is_available).map(i=>({...i,price:Number(i.price),menu_item_options:ordered(rows.options.filter(o=>o.menu_item_id===i.id).map(o=>({...o,
    menu_item_option_choices:ordered(rows.choices.filter(c=>c.option_id===o.id).map(c=>({...c,price_adjustment:Number(c.price_adjustment)})))
  })))}));
  const branches=[];
  for(const store of stores) {
    const items=unwrap(await client.from('menu_items').select('id,category_id,name,description,price,image_url,is_available,store_id,sort_order,menu_item_options(id,menu_item_id,name,is_required,max_choices,sort_order,menu_item_option_choices(id,option_id,name,price_adjustment,is_default,sort_order))')
      .eq('is_available',true).or(`store_id.eq.${store.id},store_id.is.null`).order('sort_order').order('name'));
    const availability=unwrap(await client.from('branch_menu_availability').select('menu_item_id,available').eq('store_id',store.id));
    assert.deepEqual(availability,[],'Unexpected branch stock overrides.');
    const normalised=items.map(i=>({...i,menu_item_options:ordered(i.menu_item_options.map(o=>({...o,menu_item_option_choices:ordered(o.menu_item_option_choices)})))}));
    assert.deepEqual(ordered(normalised),ordered(expected),'Public menu differs from the confirmed prices, options or images.');
    assert.deepEqual(items.map(i=>i.id),expected.toSorted((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name)).map(i=>i.id),'Public catalogue order differs.');
    branches.push({name:store.name,available_items:items.length,branch_overrides:availability.length});
  }
  const capture=JSON.parse(await readFile('client-materials/pogos-sadiexpress-2026-11-04/menu.json','utf8'));
  const assets=[...rows.assets.map(a=>({url:rows.origin+'/'+a.key,sha256:a.sha256}))];
  for(const [name,source] of [['logo',capture.branding.logo],['header',capture.branding.header_wide]])assets.push({url:`${rows.origin}/${menuVersion}/branding/${name}-${source.sha256.slice(0,16)}.webp`,sha256:source.sha256});
  let cursor=0;
  const results=await Promise.allSettled(Array.from({length:4},async()=>{
    while(cursor<assets.length) {
      const asset=assets[cursor++];
      const response=await fetch(asset.url,{redirect:'error',signal:AbortSignal.timeout(20000)});
      assert.ok(response.ok,'A public image is unavailable.');
      assert.match(response.headers.get('content-type')??'',/^image\/webp/);
      assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),asset.sha256,'A hosted image differs from the captured image.');
    }
  }));
  assert.ok(results.every(r=>r.status==='fulfilled'),'Public image verification failed.');
  const report={status:'passed',verified_at:new Date().toISOString(),project_ref:project,credential:'anonymous public key',categories:categories.length,branches,public_images:assets.length};
  await mkdir('.local/menu-replacement',{recursive:true,mode:0o700});
  await writeFile('.local/menu-replacement/public-verification.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(report,null,2));
} catch {
  console.error('Public development menu verification failed. Check the development binding, menu, public read policies and image availability. No data was changed.');
  process.exitCode=1;
}
