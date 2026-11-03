import {createHash} from 'node:crypto';
import {packSchema,branchCodes,createDraftPack} from './schema.mjs';
export function canonical(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Nonfinite value');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(typeof value==='object'&&value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 throw Error('Unsupported value');
}
export function contentDigest(pack){const {approvals,...content}=packSchema.parse(pack);return createHash('sha256').update(canonical(content)).digest('hex');}
export function moneyDecimal(minor){const n=BigInt(minor),abs=n<0n?-n:n;return `${n<0n?'-':''}${abs/100n}.${String(abs%100n).padStart(2,'0')}`;}
const referenceMap={ownership:'T01–T11/B01–B06',brand:'M05–M07/B08',finance:'F01–F07',programme:'L01–L08',access:'A01–A07/F04',gaap:'G01–G06',openings:'L06–L07/T09–T10',launch:'B04/B06/R01–R09'};
const approvers={ownership:['sponsor','it'],brand:['brand','sponsor'],finance:['finance'],programme:['finance'],access:['sponsor','operations'],gaap:['finance','operations'],openings:['finance'],launch:['sponsor']};
function intersects(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const on=(p,q,r)=>Math.abs(cross(p,q,r))<1e-12&&r[0]>=Math.min(p[0],q[0])&&r[0]<=Math.max(p[0],q[0])&&r[1]>=Math.min(p[1],q[1])&&r[1]<=Math.max(p[1],q[1]);
 return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
export function validPolygon(points){
 if(points.length<3||points.length>200||new Set(points.map(v=>v.join(','))).size!==points.length)return false;
 const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
 if(Math.abs(area)<1e-12||Math.max(...points.map(v=>v[0]))-Math.min(...points.map(v=>v[0]))>5||Math.max(...points.map(v=>v[1]))-Math.min(...points.map(v=>v[1]))>5)return false;
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(j!==i+1&&!(i===0&&j===points.length-1)&&intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return false;
 return true;
}
export function assessPack(input,{scope='chain',asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Harare',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),bindings={}}={}){
 const parsed=packSchema.safeParse(input);const issues=[];
 const add=(code,path,reference)=>issues.push({code,path,reference});
 if(!parsed.success){for(const issue of parsed.error.issues)add('invalid_shape',issue.path.map(p=>typeof p==='number'?p:String(p).replace(/[^A-Za-z0-9_.-]/g,'_')).join('.'),'client-pack-schema');return {schemaValid:false,configurationReviewReady:false,productionReady:false,issues};}
 const pack=parsed.data,digest=contentDigest(pack),sources=new Map();
 for(const [i,s]of pack.sources.entries()){if(sources.has(s.id))add('duplicate_source',`sources.${i}`,'B03');sources.set(s.id,s);}
 const required=(value,path,reference)=>{if(value===null||value==='')add('missing',path,reference);};
 const source=(value,path,reference)=>{required(value,path,reference);if(value!==null&&!sources.has(value))add('unknown_source',path,reference);};
 const exact=(value,expected,path,reference)=>{required(value,path,reference);if(value!==null&&value!==expected)add('capability_gap',path,reference);};
 const uuids=new Map();const mapping=(m,path,{mustBeNew=false}={})=>{
  required(m.id,path+'.id','T09–T10');required(m.mode,path+'.mode','T09–T10');
  if(mustBeNew&&m.mode==='existing')add('immutable_version_requires_new_id',path+'.mode','L01/L03');
 };
 const register=(m,path,kind,identity,shared=false)=>{
  if(!m.id)return;const id=m.id.toLowerCase(),signature=kind+':'+canonical(identity),old=uuids.get(id);
  if(old&&(!shared||old!==signature))add('duplicate_mapping',path+'.id','T09–T10');uuids.set(id,signature);
 };
 for(const [i,b]of pack.branches.entries()){
  const p=`branches.${i}`;register(b.mapping,p+'.mapping','stores',b.code);
  for(const [j,c]of b.categories.entries())register(c.mapping,p+`.categories.${j}.mapping`,'menu_categories',{name:c.name,sortOrder:c.sortOrder,mode:c.mapping.mode},true);
  for(const [j,m]of b.menu.entries()){
   const q=p+`.menu.${j}`;register(m.mapping,q+'.mapping','menu_items',[b.code,m.sku]);
   for(const [k,o]of m.options.entries()){const r=q+`.options.${k}`;register(o.mapping,r+'.mapping','menu_item_options',[b.code,m.sku,o.code]);for(const [l,c]of o.choices.entries())register(c.mapping,r+`.choices.${l}.mapping`,'menu_item_option_choices',[b.code,m.sku,o.code,c.code]);}
  }
  for(const [j,z]of b.deliveryZones.entries())register(z.mapping,p+`.deliveryZones.${j}.mapping`,'cash_delivery_zones',[b.code,z.code]);
  if(b.earnRule)register(b.earnRule.mapping,p+'.earnRule.mapping','cash_loyalty_rules',b.code);
  for(const [j,o]of b.rewardOffers.entries()){register(o.mapping,p+`.rewardOffers.${j}.mapping`,'reward_branch_offers',[b.code,o.code]);register(o.rewardMapping,p+`.rewardOffers.${j}.rewardMapping`,'rewards',{name:o.name,description:o.description,pointsCost:o.pointsCost,category:o.category,mode:o.rewardMapping.mode},true);}
 }
 if(!['chain','pilot'].includes(scope))throw Error('Unsupported assessment scope');
 required(pack.pilotBranch,'pilotBranch','B04');
 if(!pack.platforms.length||new Set(pack.platforms).size!==pack.platforms.length)add('missing_or_duplicate_platforms','platforms','B06');
 const targets=scope==='pilot'?(pack.pilotBranch?[pack.pilotBranch]:[]):branchCodes;
 required(pack.customer.legalEntity,'customer.legalEntity','B01');
 for(const [role,owner]of Object.entries(pack.owners))required(owner,'owners.'+role,'B03');
 for(const [field,reference]of [['ownershipSource','T01–T11'],['inventorySource','T09–T10'],['brandSource','M05–M07'],['supportSource','A06/B08']])source(pack[field],field,reference);
 for(const [name,binding]of Object.entries(pack.environments)){
  for(const [field,value]of Object.entries(binding)){
   required(value,`environments.${name}.${field}`,'T02–T04');
   if(value!==null&&field!=='expoOwner')for(const [other,existing]of Object.entries({...bindings,...pack.environments}))if(other!==name&&existing?.[field]===value)add('environment_collision',`environments.${name}.${field}`,'T02–T04');
  }
 }
 source(pack.finance.source,'finance.source','F01–F07');source(pack.finance.workedExamplesSource,'finance.workedExamplesSource','F02/F06');
 exact(pack.finance.inclusivePrices,true,'finance.inclusivePrices','F02');exact(pack.finance.exchangeConversionRequired,false,'finance.exchangeConversionRequired','F01');exact(pack.finance.refundMode,'full-till-same-currency','finance.refundMode','F03');
 exact(pack.finance.businessTimezone,'Africa/Harare','finance.businessTimezone','F05');exact(pack.finance.businessDayCutoff,'00:00','finance.businessDayCutoff','F05');
 source(pack.programme.source,'programme.source','L01–L08');source(pack.programme.termsSource,'programme.termsSource','L08');exact(pack.programme.pointsExpiry,'none','programme.pointsExpiry','L05');exact(pack.programme.refundDebtAccepted,true,'programme.refundDebtAccepted','L02');
 for(const field of ['matrixSource','restrictedRosterSource','administratorRecoverySource'])source(pack.access[field],'access.'+field,'A01–A04/F04');
 if(new Set(pack.access.administratorRefs).size<2||new Set(pack.access.administratorRefs).size!==pack.access.administratorRefs.length)add('administrator_recovery_people','access.administratorRefs','A03');
 exact(pack.access.cashierSeparationAccepted,true,'access.cashierSeparationAccepted','F04');exact(pack.access.independentFinanceReviewAccepted,true,'access.independentFinanceReviewAccepted','F04');
 for(const field of ['source','saleRewardRefundSource','bridgeProcedureSource'])source(pack.gaap[field],'gaap.'+field,'G01–G06');exact(pack.gaap.launchMode,'manual-bridge','gaap.launchMode','G05');
 for(const field of ['source','classificationSource','freezeProcedureSource'])source(pack.openings[field],'openings.'+field,'L06–L07/T09–T10');
 for(const field of ['cutoff','accountCount','sourceSpendablePoints','preservedSpendablePoints','sourceHeldPoints','preservedHeldPoints','unresolvedExceptions'])required(pack.openings[field],'openings.'+field,'L06–L07');
 for(const [a,b]of [['sourceSpendablePoints','preservedSpendablePoints'],['sourceHeldPoints','preservedHeldPoints']])if(pack.openings[a]!==null&&pack.openings[b]!==null&&BigInt(pack.openings[a])!==BigInt(pack.openings[b]))add('opening_totals_mismatch','openings.'+b,'L07');
 if(pack.openings.unresolvedExceptions!==null&&BigInt(pack.openings.unresolvedExceptions)!==0n)add('unresolved_opening_exceptions','openings.unresolvedExceptions','L07');
 const seenBranches=new Set();for(const [index,b]of pack.branches.entries()){
  const path=`branches.${index}`;
  if(seenBranches.has(b.code))add('duplicate_branch',path+'.code','BR01');seenBranches.add(b.code);
  if(b.name.toLowerCase()!==b.code)add('branch_name_mismatch',path+'.name','BR01');
  if(!targets.includes(b.code))continue;
  mapping(b.mapping,path+'.mapping');
  if(!b.cashierRefs.length||new Set(b.cashierRefs).size!==b.cashierRefs.length)add('cashier_people_missing_or_duplicate',path+'.cashierRefs','F04/A01');
  required(b.financeSubmitterRef,path+'.financeSubmitterRef','F04');required(b.financeReviewerRef,path+'.financeReviewerRef','F04');
  if(b.financeSubmitterRef!==null&&b.financeSubmitterRef===b.financeReviewerRef)add('finance_self_review',path+'.financeReviewerRef','F04');
  for(const field of ['address','latitude','longitude','publicPhone','currency','collection','delivery','minimumSubtotalMinor','maxTotalMinor','acceptanceMinutes','gaapBranchCode','maxActiveRewardsPerCustomer'])required(b[field],path+'.'+field,'BR01–BR12/F01/L03');
  source(b.operationsSource,path+'.operationsSource','BR01–BR12/O01–O08');source(b.menuSource,path+'.menuSource','M01–M07');
  if(b.collection===false&&b.delivery===false)add('no_service_mode',path,'B07');
  if(b.hours.length!==7||new Set(b.hours.map(h=>h.weekday)).size!==7)add('incomplete_hours',path+'.hours','BR04');
  for(const [i,h]of b.hours.entries())if(!h.closed&&(!h.opens||!h.closes||h.opens===h.closes))add('invalid_hours',path+`.hours.${i}`,'BR04');
  if(b.minimumSubtotalMinor!==null&&b.maxTotalMinor!==null&&(BigInt(b.maxTotalMinor)<1n||BigInt(b.minimumSubtotalMinor)>BigInt(b.maxTotalMinor)))add('invalid_order_limits',path,'F01/O03');
  if(!b.categories.length||!b.menu.length)add('missing_catalogue',path+'.menu','M01–M04');
  const categories=new Set(),skus=new Set(),zoneCodes=new Set(),priorities=new Set();
  for(const [i,c]of b.categories.entries()){if(categories.has(c.code))add('duplicate_category',path+`.categories.${i}`,'M01');categories.add(c.code);mapping(c.mapping,path+`.categories.${i}.mapping`);}
  for(const [i,item]of b.menu.entries()){
   const p=path+`.menu.${i}`;mapping(item.mapping,p+'.mapping');if(skus.has(item.sku))add('duplicate_sku',p+'.sku','M01');skus.add(item.sku);
   if(!categories.has(item.categoryCode))add('unknown_category',p+'.categoryCode','M01');
   source(item.allergenSource,p+'.allergenSource','M05');if(item.imageUrl)source(item.imageRightsSource,p+'.imageRightsSource','M06');
   if(item.options.reduce((sum,o)=>sum+o.maxChoices,0)>50)add('invalid_choice_limits',p+'.options','M03');
   let min=BigInt(item.priceMinor),max=min;const optionCodes=new Set();
   for(const [j,o]of item.options.entries()){
    const op=p+`.options.${j}`;mapping(o.mapping,op+'.mapping');
    if(optionCodes.has(o.code))add('duplicate_option',op+'.code','M03');optionCodes.add(o.code);
    if(o.minChoices>1)add('capability_gap',op+'.minChoices','M03');
    if(o.minChoices>o.maxChoices||o.maxChoices>o.choices.length||!o.choices.length)add('invalid_choice_limits',op,'M03');
    if(o.choices.filter(c=>c.isDefault).length>o.maxChoices)add('invalid_default_choices',op,'M03');
    const codes=new Set();for(const [k,c]of o.choices.entries()){mapping(c.mapping,op+`.choices.${k}.mapping`);if(codes.has(c.code))add('duplicate_choice',op+`.choices.${k}.code`,'M03');codes.add(c.code);}
    const costs=o.choices.map(c=>BigInt(c.priceAdjustmentMinor)).sort((a,b)=>a<b?-1:a>b?1:0);
    const negatives=costs.filter(v=>v<0n).slice(0,o.maxChoices),positives=costs.filter(v=>v>0n).reverse().slice(0,o.maxChoices);
    min+=negatives.length?negatives.reduce((a,b)=>a+b,0n):(o.minChoices&&costs.length?costs[0]:0n);
    max+=positives.length?positives.reduce((a,b)=>a+b,0n):(o.minChoices&&costs.length?costs.at(-1):0n);
   }
   if(min<1n||max>100000000n||(b.maxTotalMinor!==null&&max>BigInt(b.maxTotalMinor)))add('invalid_configured_price',p+'.priceMinor','M02–M03/F02');
  }
  if(b.delivery&&!b.deliveryZones.length)add('missing_delivery_zones',path+'.deliveryZones','O02–O03');
  for(const [i,zone]of b.deliveryZones.entries()){
   const p=path+`.deliveryZones.${i}`;mapping(zone.mapping,p+'.mapping');if(zoneCodes.has(zone.code))add('duplicate_zone',p+'.code','O02');zoneCodes.add(zone.code);
   if(priorities.has(zone.priority))add('ambiguous_zone_priority',p+'.priority','O02');priorities.add(zone.priority);
   if(!validPolygon(zone.polygon))add('invalid_delivery_polygon',p+'.polygon','O02');
   if(b.maxTotalMinor!==null&&BigInt(zone.feeMinor)>=BigInt(b.maxTotalMinor))add('invalid_delivery_fee',p+'.feeMinor','O03/F01');
  }
  if(!b.earnRule)add('missing_earn_rule',path+'.earnRule','L01');else{
   mapping(b.earnRule.mapping,path+'.earnRule.mapping',{mustBeNew:true});if(BigInt(b.earnRule.spendUnitMinor)<1n)add('invalid_spend_unit',path+'.earnRule.spendUnitMinor','L01');
  }
  if(!b.rewardOffers.length)add('missing_reward_offers',path+'.rewardOffers','L03');
  const offers=new Set();for(const [i,o]of b.rewardOffers.entries()){
   const p=path+`.rewardOffers.${i}`;mapping(o.mapping,p+'.mapping',{mustBeNew:true});mapping(o.rewardMapping,p+'.rewardMapping');
   if(offers.has(o.code))add('duplicate_offer',p+'.code','L03');offers.add(o.code);if(BigInt(o.availableUnits)<1n)add('missing_reward_stock',p+'.availableUnits','L03');
  }
 }
 for(const code of branchCodes)if(!seenBranches.has(code))add('missing_branch','branches','BR01');
 const areas=['ownership','brand','finance','programme','access','gaap','openings','launch',...targets.map(c=>'branch.'+c)];
 for(const area of areas){
  const rows=pack.approvals.filter(a=>a.area===area),path='approvals.'+area,reference=referenceMap[area]??'BR01–BR12';
  if(rows.length!==1){add(rows.length?'duplicate_approval':'missing_approval',path,reference);continue;}
  const a=rows[0],roles=area.startsWith('branch.')?['operations']:(approvers[area]??[]);
  if(a.contentSha256!==digest)add('stale_approval',path,reference);
  if(a.date>asOf)add('future_approval',path,reference);
  if(!roles.some(role=>pack.owners[role]!==null&&pack.owners[role]===a.approverRef))add('wrong_approver_role',path,reference);

 }
 return {schemaValid:true,configurationReviewReady:issues.length===0,productionReady:false,scope,targetBranches:targets,contentSha256:digest,issues,
  counts:{branches:targets.length,items:pack.branches.filter(b=>targets.includes(b.code)).reduce((n,b)=>n+b.menu.length,0),approvals:pack.approvals.length},
  limitations:['Approval records are claims requiring independent verification; digests do not authenticate people.','No database writes, live activation, account transfers, historical balance imports or release acceptance are performed.']};
}

export function isUnconfirmedDraft(input){
 const parsed=packSchema.safeParse(input);return parsed.success&&canonical(parsed.data)===canonical(createDraftPack());
}
