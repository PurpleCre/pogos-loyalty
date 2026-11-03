import {assessPack,moneyDecimal} from './validate.mjs';
import {packSchema} from './schema.mjs';
// Proposals only: no SQL, database client, credentials, environment mutation,
// role assignment or activation path exists in this module.
export function buildConfigurationPlan(input,options){
 const report=assessPack(input,options);
 if(!report.configurationReviewReady)throw Object.assign(Error('Client configuration is not ready for review.'),{report});
 const pack=packSchema.parse(input),rows=[],seen=new Set();
 const add=(table,mapping,data)=>{const key=table+':'+mapping.id;if(seen.has(key))return;seen.add(key);rows.push({table,operation:mapping.mode==='new'?'propose_insert':'review_existing',key:mapping.id,data:{id:mapping.id,...data}});};
 for(const b of pack.branches.filter(b=>report.targetBranches.includes(b.code))){
  const store=b.mapping.id;
  add('stores',b.mapping,{name:b.name,address:b.address,latitude:b.latitude,longitude:b.longitude,is_open:false});
  rows.push({table:'cash_order_settings',operation:'review_settings',key:store,data:{store_id:store,currency:b.currency,enabled:false,pricing_approved:false,fulfilment_enabled:false,
   collection_enabled:false,delivery_enabled:false,minimum_subtotal_minor:b.minimumSubtotalMinor,max_total_minor:b.maxTotalMinor,acceptance_minutes:b.acceptanceMinutes}});
  for(const category of b.categories)add('menu_categories',category.mapping,{name:category.name,sort_order:category.sortOrder,is_active:false});
  for(const item of b.menu){
   const category=b.categories.find(c=>c.code===item.categoryCode);
   add('menu_items',item.mapping,{store_id:store,category_id:category.mapping.id,name:item.name,description:item.description,price:moneyDecimal(item.priceMinor),image_url:item.imageUrl??'',is_available:false});
   for(const [i,option]of item.options.entries()){
    add('menu_item_options',option.mapping,{menu_item_id:item.mapping.id,name:option.name,is_required:option.minChoices===1,max_choices:option.maxChoices,sort_order:i});
    for(const [j,choice]of option.choices.entries())add('menu_item_option_choices',choice.mapping,{option_id:option.mapping.id,name:choice.name,price_adjustment:moneyDecimal(choice.priceAdjustmentMinor),is_default:choice.isDefault,sort_order:j});
   }
  }
  for(const zone of b.deliveryZones)add('cash_delivery_zones',zone.mapping,{store_id:store,name:zone.name,boundary:'('+zone.polygon.map(p=>'('+p.join(',')+')').join(',')+')',fee_minor:zone.feeMinor,priority:zone.priority,active:false});
  add('cash_loyalty_rules',b.earnRule.mapping,{store_id:store,currency:b.currency,basis:b.earnRule.basis,spend_unit_minor:b.earnRule.spendUnitMinor,points_per_unit:b.earnRule.pointsPerUnit,max_points:b.earnRule.maxPoints,effective_from:b.earnRule.effectiveFrom,active:false});
  rows.push({table:'reward_branch_settings',operation:'review_settings',key:store,data:{store_id:store,enabled:false,terms_approved:false,max_active_per_customer:b.maxActiveRewardsPerCustomer}});
  for(const offer of b.rewardOffers){
   add('rewards',offer.rewardMapping,{name:offer.name,description:offer.description,points_cost:offer.pointsCost,category:offer.category,available:false});
   add('reward_branch_offers',offer.mapping,{store_id:store,reward_id:offer.rewardMapping.id,name:offer.name,description:offer.description,terms:offer.terms,gaap_product_reference:offer.gaapProductReference,points_cost:offer.pointsCost,reservation_minutes:offer.reservationMinutes,available_units:offer.availableUnits,enabled:false});
  }
 }
 return {format:'pogos-disabled-configuration-review-v1',contentSha256:report.contentSha256,scope:report.scope,targetBranches:report.targetBranches,
  productionReady:false,executable:false,activationAllowed:false,bindingsCandidate:pack.environments,rows,
  externalEvidence:{sources:pack.sources,approvals:pack.approvals},
  manualReviewRequired:[
   'Authenticate written approvals and reconcile this digest with the exact client source versions.',
   'Inventory current schema, migration history, identities, grants, demo data and relationships on a representative clone; compare every existing mapping. Never overwrite or delete by name.',
   'Hours, phone, allergens, GAAP branch/SKU mappings and supported platforms require operational/product configuration; they are retained in the approved input and are not invented database columns.',
   'Assign verified users, administrators, branch memberships, independent finance reviewers and cashiers through the governed procedures; this plan grants no access.',
   'Reconcile individual historical accounts and opening totals with signed finance evidence; this plan imports no balances or accounts.',
   'Review settings against existing rows and rehearse explicit changes on an isolated copy. No row in this plan is an upsert, deletion or instruction to reconfigure a live account.',
   'Only a later approved release may set availability, pricing/terms approval, service modes, worker dispatch or branch activation flags after hosted/till/device/privacy gates pass.',
  ]};
}
