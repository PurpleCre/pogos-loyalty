import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {contentDigest} from '../../scripts/client-onboarding/validate.mjs';
export const source=()=>({id:'fixture-document',version:'fixture-v1',sha256:createHash('sha256').update('SYNTHETIC TEST EVIDENCE ONLY').digest('hex')});
export function signFixture(pack){pack.approvals=[];const digest=contentDigest(pack);
 const areas=['ownership','brand','finance','programme','access','gaap','openings','launch',...pack.branches.map(b=>'branch.'+b.code)];
 const role={ownership:'it',brand:'brand',finance:'finance',programme:'finance',access:'operations',gaap:'finance',openings:'finance',launch:'sponsor'};
 pack.approvals=areas.map(area=>({area,contentSha256:digest,approverRef:pack.owners[area.startsWith('branch.')?'operations':role[area]],date:'2020-01-02',evidence:{id:'fixture-approval',version:'fixture-v1',sha256:source().sha256}}));return pack;
}
export function clientFixture(){
 const pack=JSON.parse(readFileSync(new URL('../../config/client-intake/pack.template.json',import.meta.url),'utf8'));
 const mapping=()=>({id:randomUUID(),mode:'new'}),ref=source().id;
 pack.customer.legalEntity='Synthetic test entity';pack.pilotBranch='msasa';pack.platforms=['android','ios'];
 for(const role of Object.keys(pack.owners))pack.owners[role]='fixture_'+role;
 for(const [i,binding]of Object.values(pack.environments).entries())Object.assign(binding,{expoOwner:'fixture-owner',expoProjectId:randomUUID(),supabaseProjectRef:(i?'b':'a').repeat(20),androidApplicationId:`test.fixture.app${i}`,iosBundleIdentifier:`test.fixture.app${i}`,scheme:`fixture-${i}`});
 for(const key of ['ownershipSource','inventorySource','brandSource','supportSource'])pack[key]=ref;pack.sources=[source()];
 Object.assign(pack.finance,{source:ref,inclusivePrices:true,exchangeConversionRequired:false,refundMode:'full-till-same-currency',businessTimezone:'Africa/Harare',businessDayCutoff:'00:00',workedExamplesSource:ref});
 Object.assign(pack.programme,{source:ref,termsSource:ref,pointsExpiry:'none',refundDebtAccepted:true});
 Object.assign(pack.access,{matrixSource:ref,restrictedRosterSource:ref,administratorRecoverySource:ref,administratorRefs:['fixture_admin_one','fixture_admin_two'],cashierSeparationAccepted:true,independentFinanceReviewAccepted:true});
 Object.assign(pack.gaap,{source:ref,launchMode:'manual-bridge',saleRewardRefundSource:ref,bridgeProcedureSource:ref});
 Object.assign(pack.openings,{source:ref,classificationSource:ref,cutoff:'2020-01-01T00:00:00Z',freezeProcedureSource:ref,accountCount:'5',sourceSpendablePoints:'9007199254740993',preservedSpendablePoints:'9007199254740993',sourceHeldPoints:'20',preservedHeldPoints:'20',unresolvedExceptions:'0'});
 for(const branch of pack.branches){
  Object.assign(branch,{mapping:mapping(),address:'SYNTHETIC test address',latitude:-17.8,longitude:31.0,publicPhone:'+263771234567',hours:Array.from({length:7},(_,weekday)=>({weekday,closed:false,opens:'08:00',closes:'20:00'})),operationsSource:ref,menuSource:ref,gaapBranchCode:'FIXTURE-'+branch.code,cashierRefs:['fixture_cashier'],financeSubmitterRef:'fixture_submitter',financeReviewerRef:'fixture_reviewer',currency:'USD',collection:true,delivery:true,minimumSubtotalMinor:'0',maxTotalMinor:'100000000',acceptanceMinutes:10,
   categories:[{code:'fixture-meals',mapping:mapping(),name:'Fixture meals',sortOrder:1}],menu:[{sku:'FIXTURE-MEAL',mapping:mapping(),categoryCode:'fixture-meals',name:'Fixture meal',description:'Synthetic data only',priceMinor:'1010',imageUrl:null,imageRightsSource:null,allergenSource:ref,gaapProductReference:'FIXTURE-GAAP-MEAL',options:[{code:'fixture-option',mapping:mapping(),name:'Fixture option',minChoices:1,maxChoices:1,choices:[{code:'fixture-choice',mapping:mapping(),name:'Fixture choice',priceAdjustmentMinor:'25',isDefault:true}]}]}],
   deliveryZones:[{code:'fixture-zone',mapping:mapping(),name:'Fixture zone',feeMinor:'100',priority:1,polygon:[[30.9,-17.9],[31.1,-17.9],[31.1,-17.7],[30.9,-17.7]]}],
   earnRule:{mapping:mapping(),basis:'subtotal',spendUnitMinor:'100',pointsPerUnit:1,maxPoints:10000,effectiveFrom:'2020-01-01T00:00:00Z'},maxActiveRewardsPerCustomer:2,
   rewardOffers:[{code:'fixture-reward',mapping:mapping(),rewardMapping:mapping(),name:'Fixture reward',description:'Synthetic only',category:'food',terms:'Synthetic fixture terms',gaapProductReference:'FIXTURE-REWARD',pointsCost:50,reservationMinutes:15,availableUnits:'10'}]});
 }
 return signFixture(pack);
}
