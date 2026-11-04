import {createHash} from 'node:crypto';
export const menuVersion='2026-11-04';
export const menuBucket='pogos-menu';
export const replacementTables=Object.freeze(['orders','order_items','cash_order_quotes','menu_categories','menu_items','menu_item_options','menu_item_option_choices','branch_menu_availability','stores']);
const namespace=Buffer.from('6ba7b8119dad11d180b400c04fd430c8','hex');
export function menuId(name){
  const bytes=createHash('sha1').update(namespace).update(`pogos:${menuVersion}:${name}`).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=bytes.toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const integer=(n,min=0,max=100000000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const text=(s,max=4000)=>typeof s==='string'&&s.length<=max;
export function validateCatalogue(value){
  if(!value||value.version!==menuVersion||value.currency!=='USD'||value.source_url!=='https://delivery.sadiexpress.com/en/harare/vendor/1067'||
    JSON.stringify(value.confirmed_branches)!==JSON.stringify(['Msasa','Kamfinsa','Westgate'])||value.categories?.length!==9||value.items?.length!==51)throw Error('The confirmed 51-item Pogo’s catalogue is required.');
  const categories=new Set();for(const c of value.categories){if(!integer(c.source_id,1)||categories.has(c.source_id)||!text(c.name,120)||!c.name.trim()||!integer(c.sort_order))throw Error('Invalid menu category.');categories.add(c.source_id);}
  const ids=new Set();for(const item of value.items){
    if(!integer(item.source_id,1)||ids.has(item.source_id)||!categories.has(item.category_source_id)||!text(item.name,200)||!item.name.trim()||!text(item.description)||!integer(item.price_minor)||typeof item.available!=='boolean'||!integer(item.sort_order)||!Array.isArray(item.options))throw Error('Invalid menu product.');ids.add(item.source_id);
    if(item.image_file===null){if(item.image_sha256!==null)throw Error('Invalid image mapping.');}
    else if(!/^client-materials\/pogos-sadiexpress-2026-11-04\/images\/menu\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/.test(item.image_file)||!/^[a-f0-9]{64}$/.test(item.image_sha256))throw Error('Invalid captured image mapping.');
    const groups=new Set();for(const group of item.options){
      if(!integer(group.source_id,1)||groups.has(group.source_id)||!text(group.name,200)||typeof group.required!=='boolean'||!integer(group.max_choices,1,10)||!integer(group.sort_order)||!Array.isArray(group.choices)||group.choices.length<1||group.choices.length>20)throw Error('Invalid menu options.');groups.add(group.source_id);
      const choices=new Set();for(const choice of group.choices){if(!integer(choice.source_id,1)||choices.has(choice.source_id)||!text(choice.name,200)||!choice.name.trim()||!integer(choice.price_minor)||typeof choice.is_default!=='boolean'||!integer(choice.sort_order))throw Error('Invalid menu choice.');choices.add(choice.source_id);}
      if(group.choices.filter(c=>c.is_default).length>group.max_choices)throw Error('Too many default choices.');
    }
  }
  return value;
}
export function catalogueRows(value,projectRef){
  validateCatalogue(value);if(!/^[a-z]{20}$/.test(projectRef))throw Error('Explicit Supabase project reference required.');
  const origin=`https://${projectRef}.supabase.co/storage/v1/object/public/${menuBucket}`;
  const categories=value.categories.map(c=>({id:menuId(`category:${c.source_id}`),name:c.name,sort_order:c.sort_order,is_active:true}));
  const items=[],options=[],choices=[],assets=[];
  for(const item of value.items){
    const id=menuId(`item:${item.source_id}`),key=item.image_file?`${menuVersion}/menu/${item.source_id}-${item.image_sha256.slice(0,16)}.webp`:null;
    items.push({id,category_id:menuId(`category:${item.category_source_id}`),name:item.name,description:item.description,price:(item.price_minor/100).toFixed(2),image_url:key?`${origin}/${key}`:'',is_available:item.available,store_id:null,sort_order:item.sort_order});
    if(key)assets.push({key,file:item.image_file,sha256:item.image_sha256,kind:'menu'});
    for(const group of item.options){const optionId=menuId(`item:${item.source_id}:option:${group.source_id}`);options.push({id:optionId,menu_item_id:id,name:group.name,is_required:group.required,max_choices:group.max_choices,sort_order:group.sort_order});
      for(const choice of group.choices)choices.push({id:menuId(`item:${item.source_id}:option:${group.source_id}:choice:${choice.source_id}`),option_id:optionId,name:choice.name,price_adjustment:(choice.price_minor/100).toFixed(2),is_default:choice.is_default,sort_order:choice.sort_order});
    }
  }
  return {categories,items,options,choices,assets,origin};
}
export function tableFingerprintQuery(table){
  if(!/^[a-z_]+$/.test(table))throw Error('Invalid table identifier.');
  return `SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text) FROM public.${table} t`;
}
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
function recordInsert(table,rows,spec){
  const data=JSON.stringify(rows);if(data.includes('$pogos_menu$'))throw Error('Invalid catalogue delimiter.');
  const fields=spec.map(([name])=>name).join(',');
  return `INSERT INTO public.${table}(${fields}) SELECT ${fields} FROM jsonb_to_recordset($pogos_menu$${data}$pogos_menu$::jsonb) AS r(${spec.map(([n,t])=>`${n} ${t}`).join(',')});`;
}
export function buildReplacementSql(catalogue,projectRef,fingerprints,headerUrl){
  const rows=catalogueRows(catalogue,projectRef),names=Object.keys(fingerprints).sort();
  if(names.length>100||!replacementTables.every(t=>names.includes(t))||names.some(n=>!/^[a-z_]+$/.test(n)||!/^[a-f0-9]{32}$/.test(fingerprints[n])))throw Error('A complete current database fingerprint is required.');
  if(typeof headerUrl!=='string'||!headerUrl.startsWith(rows.origin+'/')||headerUrl.includes("'"))throw Error('Owned branch image URL required.');
  const expected=JSON.stringify(fingerprints);const protectedNames=names.filter(t=>!replacementTables.includes(t));
  const zeroFinancial=['cash_receipts','cash_movements','cash_order_commands','order_status_events'];
  if(!zeroFinancial.every(t=>names.includes(t))||!['loyalty_ledger','transactions','notification_events','branch_fiscal_references','branch_operation_commands'].every(t=>names.includes(t)))throw Error('Financial containment schema required.');
  return `BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
LOCK TABLE ${names.map(n=>`public.${n}`).join(',')} IN ACCESS EXCLUSIVE MODE;
DO $reset_guard$
DECLARE expected jsonb:='${expected}'::jsonb; v_table text; actual text;
BEGIN
  FOR v_table IN SELECT jsonb_object_keys(expected) LOOP
    EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb)::text) FROM public.%I t',v_table) INTO actual;
    IF actual<>expected->>v_table THEN RAISE EXCEPTION 'Database changed since backup; take a fresh backup before retrying' USING ERRCODE='40001'; END IF;
  END LOOP;
  IF ${zeroFinancial.map(t=>`EXISTS(SELECT 1 FROM public.${t})`).join(' OR ')}
    OR EXISTS(SELECT 1 FROM public.loyalty_ledger WHERE order_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.transactions WHERE order_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.notification_events WHERE order_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.branch_fiscal_references WHERE cash_order_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.branch_operation_commands WHERE menu_item_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.orders WHERE quote_id IS NOT NULL OR payment_status IS NOT NULL)
    THEN RAISE EXCEPTION 'Financial or governed order/menu history prevents a legacy-data reset' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.stores WHERE name='Pogo''s Msasa')<>1 OR (SELECT count(*) FROM public.stores WHERE name='Pogo''s Kamfinsa')<>1
    OR (SELECT count(*) FROM public.stores WHERE name='Pogo''s Westgate')>1 THEN RAISE EXCEPTION 'Resolve the confirmed branch identities first'; END IF;
END; $reset_guard$;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.cash_order_quotes;
DELETE FROM public.branch_menu_availability;
DELETE FROM public.menu_item_option_choices;
DELETE FROM public.menu_item_options;
DELETE FROM public.menu_items;
DELETE FROM public.menu_categories;
${recordInsert('menu_categories',rows.categories,[['id','uuid'],['name','text'],['sort_order','integer'],['is_active','boolean']])}
${recordInsert('menu_items',rows.items,[['id','uuid'],['category_id','uuid'],['name','text'],['description','text'],['price','numeric'],['image_url','text'],['is_available','boolean'],['store_id','uuid'],['sort_order','integer']])}
${recordInsert('menu_item_options',rows.options,[['id','uuid'],['menu_item_id','uuid'],['name','text'],['is_required','boolean'],['max_choices','integer'],['sort_order','integer']])}
${recordInsert('menu_item_option_choices',rows.choices,[['id','uuid'],['option_id','uuid'],['name','text'],['price_adjustment','numeric'],['is_default','boolean'],['sort_order','integer']])}
INSERT INTO public.stores(id,name,address,distance_miles,is_open,latitude,longitude,image_url)
 SELECT ${literal(menuId('branch:westgate'))},'Pogo''s Westgate','',0,false,NULL,NULL,${literal(headerUrl)}
 WHERE NOT EXISTS(SELECT 1 FROM public.stores WHERE name='Pogo''s Westgate');
UPDATE public.stores SET image_url=${literal(headerUrl)} WHERE name IN ('Pogo''s Msasa','Pogo''s Kamfinsa','Pogo''s Westgate');
DO $verify_reset$
DECLARE expected jsonb:='${expected}'::jsonb; v_table text; actual text;
BEGIN
  IF (SELECT count(*) FROM public.orders)<>0 OR (SELECT count(*) FROM public.order_items)<>0
    OR (SELECT count(*) FROM public.menu_items)<>51 OR (SELECT count(*) FROM public.menu_categories)<>9
    OR (SELECT count(*) FROM public.menu_item_options)<>${rows.options.length} OR (SELECT count(*) FROM public.menu_item_option_choices)<>${rows.choices.length}
    OR EXISTS(SELECT 1 FROM public.menu_items WHERE store_id IS NOT NULL)
    THEN RAISE EXCEPTION 'Replacement verification failed'; END IF;
  FOREACH v_table IN ARRAY ARRAY[${protectedNames.map(literal).join(',')}]::text[] LOOP
    EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb)::text) FROM public.%I t',v_table) INTO actual;
    IF actual<>expected->>v_table THEN RAISE EXCEPTION 'Unrelated account/loyalty/history data changed'; END IF;
  END LOOP;
END; $verify_reset$;
COMMIT;`;
}
