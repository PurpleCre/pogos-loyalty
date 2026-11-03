import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,writeFile,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assessPack,contentDigest,canonical,moneyDecimal,validPolygon,isUnconfirmedDraft} from '../scripts/client-onboarding/validate.mjs';
import {buildConfigurationPlan} from '../scripts/client-onboarding/plan.mjs';
import {packSchema,jsonSchema} from '../scripts/client-onboarding/schema.mjs';
import {clientFixture,signFixture} from './helpers/client-pack-fixture.mjs';
const opts={scope:'chain',asOf:'2021-01-01',bindings:{development:{expoProjectId:'00000000-0000-4000-8000-000000000001',supabaseProjectRef:'d'.repeat(20),androidApplicationId:'test.fixture.dev',iosBundleIdentifier:'test.fixture.dev',scheme:'fixture-dev'}}};
const assess=pack=>assessPack(pack,opts);
const codes=pack=>assess(pack).issues.map(v=>v.code);
const cli=(...args)=>spawnSync(process.execPath,['scripts/client-data.mjs',...args],{encoding:'utf8'});

test('committed client draft has the three confirmed branches and blocks review without inventing business facts',async()=>{
 const input=JSON.parse(await readFile('config/client-intake/pack.template.json','utf8'));const report=assess(input);
 assert.equal(report.schemaValid,true);assert.equal(report.configurationReviewReady,false);assert.equal(report.productionReady,false);assert.equal(input.approvals.length,0);assert.deepEqual(input.branches.map(b=>b.code),['msasa','kamfinsa','westgate']);assert.ok(report.issues.some(i=>i.path==='customer.legalEntity'));
});
test('complete synthetic evidence permits a disabled configuration review, never production readiness',()=>{
 const report=assess(clientFixture());assert.equal(report.configurationReviewReady,true,JSON.stringify(report.issues));assert.equal(report.productionReady,false);
});
test('money stays canonical and exact; floats, exponent notation and negative prices are rejected',()=>{
 for(const value of [10.1,'1.00','1e3','01','-1']){const p=clientFixture();p.branches[0].menu[0].priceMinor=value;assert.equal(assess(p).schemaValid,false);}
 assert.equal(moneyDecimal('1010'),'10.10');assert.equal(moneyDecimal('-1'),'-0.01');assert.equal(moneyDecimal('100000000'),'1000000.00');
});
test('business changes invalidate approval digests, while approval evidence has no circular digest dependency',()=>{
 const p=clientFixture(),digest=contentDigest(p);p.approvals[0].evidence.sha256='f'.repeat(64);assert.equal(contentDigest(p),digest);assert.equal(assess(p).configurationReviewReady,true);
 p.branches[0].menu[0].priceMinor='1011';assert.ok(codes(p).includes('stale_approval'));
});
test('canonical digests ignore object-key ordering and include source versions, modes and approved scope',()=>{
 const p=clientFixture();const reordered=Object.fromEntries(Object.entries(p).reverse());assert.equal(contentDigest(reordered),contentDigest(p));
 const d=contentDigest(p);p.sources[0].version='different';assert.notEqual(contentDigest(p),d);
 assert.throws(()=>canonical({x:Infinity}));
});
test('missing, duplicated, future and wrongly attributed approvals block review',()=>{
 for(const modify of [p=>p.approvals.pop(),p=>p.approvals.push(p.approvals[0]),p=>p.approvals[0].date='2099-01-01',p=>p.approvals[0].approverRef='fixture_wrong']){const p=clientFixture();modify(p);assert.equal(assess(p).configurationReviewReady,false);}
});
test('unknown evidence, missing operational facts and invalid weekly hours are reported by questionnaire references',()=>{
 const p=clientFixture();p.branches[0].operationsSource='not-registered';p.branches[0].hours.pop();p.branches[0].publicPhone=null;
 const report=assess(p);assert.ok(report.issues.some(i=>i.code==='unknown_source'&&i.reference==='BR01–BR12/O01–O08'));assert.ok(report.issues.some(i=>i.code==='incomplete_hours'));assert.ok(report.issues.some(i=>i.path==='branches.0.publicPhone'));
});
test('existing development projects, application identities and schemes cannot be reused for production or staging',()=>{
 for(const field of ['expoProjectId','supabaseProjectRef','androidApplicationId','iosBundleIdentifier','scheme']){const p=clientFixture();p.environments.production[field]=opts.bindings.development[field];assert.ok(codes(p).includes('environment_collision'));}
 const p=clientFixture();p.environments.production.expoOwner=p.environments.staging.expoOwner;assert.equal(assess(p).configurationReviewReady,true);
});
test('branch names/mappings are unique, including collisions in branches outside a pilot scope',()=>{
 const p=clientFixture();p.branches[1].mapping.id=p.branches[0].mapping.id;assert.ok(assessPack(p,{...opts,scope:'pilot'}).issues.some(i=>i.code==='duplicate_mapping'));
 const q=clientFixture();q.branches[1].name='Msasa';assert.ok(codes(q).includes('branch_name_mismatch'));
});
test('unsupported launch policies surface capability gaps rather than silently changing business decisions',()=>{
 for(const modify of [p=>p.finance.refundMode='partial-or-other',p=>p.finance.exchangeConversionRequired=true,p=>p.finance.businessDayCutoff='04:00',p=>p.finance.inclusivePrices=false,p=>p.programme.pointsExpiry='required',p=>p.gaap.launchMode='automation',p=>p.branches[0].menu[0].options[0].minChoices=2]){const p=clientFixture();modify(p);assert.ok(codes(p).includes('capability_gap'));}
});
test('SKU/category/choice integrity and feasible modifier prices are checked',()=>{
 const p=clientFixture();p.branches[0].menu[0].categoryCode='missing';assert.ok(codes(p).includes('unknown_category'));
 const q=clientFixture();q.branches[0].menu[0].options[0].choices[0].priceAdjustmentMinor='-2000';assert.ok(codes(q).includes('invalid_configured_price'));
 const r=clientFixture();r.branches[0].menu[0].options[0].maxChoices=2;assert.ok(codes(r).includes('invalid_choice_limits'));
});
test('delivery polygons reject degeneracy, duplicate points, self intersections and oversized spans',()=>{
 assert.equal(validPolygon([[30,-18],[31,-18],[31,-17],[30,-17]]),true);
 for(const points of [[[0,0],[1,1],[2,2]],[[0,0],[1,1],[0,1],[1,0]],[[0,0],[1,0],[0,0]],[[0,0],[10,0],[10,1]]])assert.equal(validPolygon(points),false);
 const p=clientFixture();p.branches[0].deliveryZones=[];assert.ok(codes(p).includes('missing_delivery_zones'));
});
test('delivery-zone ordering is explicit and conflicting priorities are rejected',()=>{
 const p=clientFixture();const zone=structuredClone(p.branches[0].deliveryZones[0]);zone.code='fixture-other';zone.mapping.id='00000000-0000-4000-8000-000000000777';p.branches[0].deliveryZones.push(zone);assert.ok(codes(p).includes('ambiguous_zone_priority'));
});
test('new immutable earning/offer versions require fresh IDs and stock, not an overwrite',()=>{
 const p=clientFixture();p.branches[0].earnRule.mapping.mode='existing';p.branches[0].rewardOffers[0].mapping.mode='existing';p.branches[0].rewardOffers[0].availableUnits='0';
 assert.ok(codes(p).includes('immutable_version_requires_new_id'));assert.ok(codes(p).includes('missing_reward_stock'));
});
test('opening totals preserve values beyond the JavaScript safe integer range and unresolved exceptions block review',()=>{
 const p=clientFixture();assert.equal(assess(p).configurationReviewReady,true);p.openings.preservedSpendablePoints='9007199254740992';assert.ok(codes(p).includes('opening_totals_mismatch'));
 const q=clientFixture();q.openings.unresolvedExceptions='1';assert.ok(codes(q).includes('unresolved_opening_exceptions'));
});
test('cashier/admin recovery and independent finance people must be explicit and distinct',()=>{
 const p=clientFixture();p.access.administratorRefs=['same','same'];p.branches[0].cashierRefs=[];p.branches[0].financeReviewerRef=p.branches[0].financeSubmitterRef;
 assert.ok(codes(p).includes('administrator_recovery_people'));assert.ok(codes(p).includes('cashier_people_missing_or_duplicate'));assert.ok(codes(p).includes('finance_self_review'));
});
test('pilot scope requires an actual pilot decision and can leave other branch data unconfirmed',async()=>{
 const draft=JSON.parse(await readFile('config/client-intake/pack.template.json','utf8'));const p=clientFixture();p.branches[1]=draft.branches[1];p.branches[2]=draft.branches[2];signFixture(p);
 assert.equal(assessPack(p,{...opts,scope:'pilot'}).configurationReviewReady,true);assert.equal(assess(p).configurationReviewReady,false);
 const plan=buildConfigurationPlan(p,{...opts,scope:'pilot'});assert.deepEqual(plan.targetBranches,['msasa']);assert.equal(plan.rows.filter(r=>r.table==='stores').length,1);
});
test('shared global categories/rewards deduplicate only when their definitions and modes agree',()=>{
 const p=clientFixture();p.branches[1].categories=structuredClone(p.branches[0].categories);p.branches[1].rewardOffers[0].rewardMapping=structuredClone(p.branches[0].rewardOffers[0].rewardMapping);signFixture(p);
 const plan=buildConfigurationPlan(p,opts);assert.equal(plan.rows.filter(r=>r.table==='menu_categories').length,2);assert.equal(plan.rows.filter(r=>r.table==='rewards').length,2);
 p.branches[1].categories[0].name='Conflict';assert.ok(codes(p).includes('duplicate_mapping'));
});
test('generated proposals contain only disabled trading configuration, never users, ledger writes, deletion or activation',()=>{
 const p=clientFixture();const plan=buildConfigurationPlan(p,opts);assert.equal(plan.executable,false);assert.equal(plan.activationAllowed,false);assert.equal(plan.productionReady,false);
 const flags=['is_open','enabled','active','available','is_available','is_active','pricing_approved','terms_approved','fulfilment_enabled','collection_enabled','delivery_enabled'];
 for(const row of plan.rows){assert.ok(!/orders|ledger|user_roles|profiles|cashiers|commands|receipts/.test(row.table));for(const flag of flags)if(flag in row.data)assert.equal(row.data[flag],false);}
 assert.equal(plan.rows.find(r=>r.table==='menu_items').data.price,'10.10');assert.equal(plan.rows.find(r=>r.table==='cash_loyalty_rules').data.spend_unit_minor,'100');
});
test('existing mappings yield review proposals and never become executable updates',()=>{
 const p=clientFixture();p.branches[0].mapping.mode='existing';signFixture(p);const plan=buildConfigurationPlan(p,opts);assert.equal(plan.rows.find(r=>r.table==='stores').operation,'review_existing');assert.equal(plan.executable,false);
});
test('invalid packets cannot generate a plan and unsupported/secret fields are rejected without echoing input',()=>{
 const p=clientFixture();p.secretKey='do-not-print-private-value';const report=assess(p);assert.equal(report.schemaValid,false);assert.ok(!JSON.stringify(report).includes('do-not-print'));assert.throws(()=>buildConfigurationPlan(p,opts));
});
test('schema output stays in sync with the pure validator',async()=>{
 const committed=JSON.parse(await readFile('config/client-intake/pack.schema.json','utf8'));assert.equal(canonical(committed),canonical(jsonSchema));assert.ok(packSchema.safeParse(clientFixture()).success);
});
test('CLI template check passes, status reports blocked facts and strict check fails safely',async()=>{
 assert.equal(cli('template-check').status,0);const status=cli('status');assert.equal(status.status,0);assert.equal(JSON.parse(status.stdout).configurationReviewReady,false);
 const check=cli('check','config/client-intake/pack.template.json');assert.equal(check.status,1);assert.equal(JSON.parse(check.stdout).productionReady,false);
});
test('CLI creates restricted drafts exclusively, refuses overwrites and never mutates environment bindings',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pogos-client-')),file=join(directory,'pack.json');const before=await readFile('config/environments.json','utf8');
 assert.equal(cli('init',file).status,0);assert.equal((await stat(file)).mode&0o777,0o600);const contents=await readFile(file,'utf8');assert.equal(cli('init',file).status,2);assert.equal(await readFile(file,'utf8'),contents);assert.equal(await readFile('config/environments.json','utf8'),before);
 const broken=join(directory,'broken.json');await writeFile(broken,'{"secret":"never-print-me", invalid');const result=cli('check',broken);assert.equal(result.status,2);assert.ok(!result.stderr.includes('never-print-me'));
});
test('CLI review artifact is digest-bound, restricted, non-overwriting and contains no activation',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pogos-client-plan-')),input=join(directory,'pack.json'),output=join(directory,'review.json');const p=clientFixture();await writeFile(input,JSON.stringify(p));
 const result=cli('plan',input,'--out',output);assert.equal(result.status,0,result.stderr+result.stdout);const plan=JSON.parse(await readFile(output,'utf8'));assert.equal(plan.contentSha256,contentDigest(p));assert.equal(plan.activationAllowed,false);assert.equal((await stat(output)).mode&0o777,0o600);assert.equal(cli('plan',input,'--out',output).status,2);
});

test('the proposed bindings meet the current native build identity requirements even for an Android-first launch',()=>{
 const p=clientFixture();p.platforms=['android'];signFixture(p);assert.equal(assess(p).configurationReviewReady,true);
 p.environments.production.iosBundleIdentifier=null;assert.equal(assess(p).configurationReviewReady,false);
});

test('vendor codes remain opaque strings; spaces and punctuation are not replaced with an invented GAAP contract',()=>{
 const p=clientFixture();p.branches[0].gaapBranchCode='GAAP branch # 1';p.branches[0].rewardOffers[0].gaapProductReference="GAAP reward / staff's code";signFixture(p);
 assert.equal(assess(p).configurationReviewReady,true);assert.equal(buildConfigurationPlan(p,opts).rows.find(r=>r.table==='reward_branch_offers').data.gaap_product_reference,"GAAP reward / staff's code");
});

test('the committed-template guard rejects unapproved defaults even if a partially filled draft remains blocked',async()=>{
 const draft=JSON.parse(await readFile('config/client-intake/pack.template.json','utf8'));assert.equal(isUnconfirmedDraft(draft),true);
 for(const mutate of [p=>p.branches[0].currency='USD',p=>p.branches[0].address='An assumed address',p=>p.finance.businessDayCutoff='00:00',p=>p.environments.production.expoOwner='unconfirmed-owner']){
  const changed=structuredClone(draft);mutate(changed);assert.equal(assess(changed).configurationReviewReady,false);assert.equal(isUnconfirmedDraft(changed),false);
 }
});

test('intake constraints also respect persisted-cart and actual database limits before proposing configuration',()=>{
 for(const mutate of [p=>p.branches[0].menu[0].name='x'.repeat(501),p=>p.branches[0].rewardOffers[0].name='x'.repeat(161),p=>p.branches[0].rewardOffers[0].terms='a',p=>p.branches[0].deliveryZones[0].priority=2147483648]){const p=clientFixture();mutate(p);assert.equal(assess(p).schemaValid,false);}
 const p=clientFixture();const option=p.branches[0].menu[0].options[0];option.maxChoices=50;option.choices=Array.from({length:50},(_,i)=>({...option.choices[0],code:'choice'+i,mapping:{id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,mode:'new'},isDefault:i===0}));
 p.branches[0].menu[0].options.push({...option,code:'second',mapping:{id:'00000000-0000-4000-8000-000000000099',mode:'new'},maxChoices:1,choices:[{...option.choices[0],mapping:{id:'00000000-0000-4000-8000-000000000098',mode:'new'}}]});
 assert.ok(codes(p).includes('invalid_choice_limits'));
});
