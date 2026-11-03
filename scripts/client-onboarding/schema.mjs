import {z} from 'zod';
const ref=z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const text=z.string().trim().min(1).max(2000);
const gaapCode=z.string().trim().min(1).max(160);
const label=z.string().trim().min(1).max(160);
const nullable=s=>s.nullable();
const uuid=z.uuid().toLowerCase();
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
const minor=z.string().regex(/^(0|[1-9][0-9]{0,8})$/).refine(v=>/^(0|[1-9][0-9]{0,8})$/.test(v)&&BigInt(v)<=100000000n);
const signedMinor=z.string().regex(/^(0|-?[1-9][0-9]{0,8})$/).refine(v=>/^(0|-?[1-9][0-9]{0,8})$/.test(v)&&BigInt(v)>=-100000000n&&BigInt(v)<=100000000n);
const sha=z.string().regex(/^[a-f0-9]{64}$/);
const object=shape=>z.strictObject(shape);
export const branchCodes=['msasa','kamfinsa','westgate'];
export const ownerRoles=['sponsor','operations','finance','brand','it','privacy','support'];
export const approvalAreas=['ownership','brand','finance','programme','access','gaap','openings','launch',...branchCodes.map(v=>'branch.'+v)];
const mapping=object({id:nullable(uuid),mode:nullable(z.enum(['existing','new']))});
const binding=object({expoOwner:nullable(ref),expoProjectId:nullable(uuid),supabaseProjectRef:nullable(z.string().regex(/^[a-z]{20}$/)),androidApplicationId:nullable(z.string().regex(/^[a-zA-Z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/)),iosBundleIdentifier:nullable(z.string().regex(/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/)),scheme:nullable(z.string().regex(/^[a-z][a-z0-9-]*$/))});
const source=object({id:ref,version:z.string().trim().min(1).max(100),sha256:sha});
const choice=object({code:ref,mapping,name:label,priceAdjustmentMinor:signedMinor,isDefault:z.boolean()});
const option=object({code:ref,mapping,name:label,minChoices:z.number().int().min(0).max(50),maxChoices:z.number().int().min(1).max(50),choices:z.array(choice).max(50)});
const category=object({code:ref,mapping,name:label,sortOrder:z.number().int().min(0).max(10000)});
const menuItem=object({sku:ref,mapping,categoryCode:ref,name:label,description:z.string().max(4000),priceMinor:minor,
 imageUrl:nullable(z.url().refine(v=>new URL(v).protocol==='https:')),imageRightsSource:nullable(ref),allergenSource:nullable(ref),gaapProductReference:gaapCode,options:z.array(option).max(30)});
const zone=object({code:ref,mapping,name:label,feeMinor:minor,priority:z.number().int().min(-2147483648).max(2147483647),polygon:z.array(z.tuple([z.number().finite().min(-180).max(180),z.number().finite().min(-90).max(90)])).min(3).max(200)});
const earn=object({mapping,basis:z.enum(['subtotal','total']),spendUnitMinor:minor,pointsPerUnit:z.number().int().min(1).max(1000000),maxPoints:z.number().int().min(1).max(1000000),effectiveFrom:z.iso.datetime({offset:true})});
const offer=object({code:ref,mapping,rewardMapping:mapping,name:label,description:z.string().max(4000),category:z.enum(['food','drink','special']),terms:z.string().trim().min(3).max(2000),gaapProductReference:gaapCode,pointsCost:z.number().int().min(1).max(1000000),reservationMinutes:z.number().int().min(1).max(1440),availableUnits:z.string().regex(/^(0|[1-9][0-9]{0,17})$/)});
const hours=object({weekday:z.number().int().min(0).max(6),closed:z.boolean(),opens:nullable(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)),closes:nullable(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))});
const branch=object({code:z.enum(branchCodes),name:z.enum(['Msasa','Kamfinsa','Westgate']),mapping,address:nullable(text),latitude:nullable(z.number().finite().min(-90).max(90)),longitude:nullable(z.number().finite().min(-180).max(180)),
 publicPhone:nullable(z.string().regex(/^\+[1-9][0-9]{7,14}$/)),hours:z.array(hours).max(7),
 operationsSource:nullable(ref),menuSource:nullable(ref),gaapBranchCode:nullable(gaapCode),cashierRefs:z.array(ref).max(100),financeSubmitterRef:nullable(ref),financeReviewerRef:nullable(ref),
 currency:nullable(z.enum(['USD','ZWG'])),collection:nullable(z.boolean()),delivery:nullable(z.boolean()),
 minimumSubtotalMinor:nullable(minor),maxTotalMinor:nullable(minor),acceptanceMinutes:nullable(z.number().int().min(1).max(120)),
 deliveryZones:z.array(zone).max(100),categories:z.array(category).max(300),menu:z.array(menuItem).max(1500),earnRule:nullable(earn),
 maxActiveRewardsPerCustomer:nullable(z.number().int().min(1).max(20)),rewardOffers:z.array(offer).max(1000)});
export const packSchema=object({schemaVersion:z.literal(1),customer:object({country:z.literal('ZW'),tradingName:z.literal('Pogo’s'),legalEntity:nullable(text)}),
 release:z.literal('cash-ordering-and-loyalty'),pilotBranch:nullable(z.enum(branchCodes)),platforms:z.array(z.enum(['android','ios'])).max(2),
 owners:object(Object.fromEntries(ownerRoles.map(role=>[role,nullable(ref)]))),
 environments:object({staging:binding,production:binding}),ownershipSource:nullable(ref),inventorySource:nullable(ref),brandSource:nullable(ref),supportSource:nullable(ref),
 sources:z.array(source).max(500),
 finance:object({source:nullable(ref),inclusivePrices:nullable(z.boolean()),exchangeConversionRequired:nullable(z.boolean()),refundMode:nullable(z.enum(['full-till-same-currency','partial-or-other'])),businessTimezone:nullable(z.string().max(100)),businessDayCutoff:nullable(z.string().max(20)),workedExamplesSource:nullable(ref)}),
 programme:object({source:nullable(ref),termsSource:nullable(ref),pointsExpiry:nullable(z.enum(['none','required'])),refundDebtAccepted:nullable(z.boolean())}),
 access:object({matrixSource:nullable(ref),restrictedRosterSource:nullable(ref),administratorRecoverySource:nullable(ref),administratorRefs:z.array(ref).max(20),cashierSeparationAccepted:nullable(z.boolean()),independentFinanceReviewAccepted:nullable(z.boolean())}),
 gaap:object({vendor:z.literal('GAAP'),source:nullable(ref),launchMode:nullable(z.enum(['manual-bridge','automation'])),saleRewardRefundSource:nullable(ref),bridgeProcedureSource:nullable(ref)}),
 openings:object({source:nullable(ref),classificationSource:nullable(ref),cutoff:nullable(z.iso.datetime({offset:true})),freezeProcedureSource:nullable(ref),
 accountCount:nullable(z.string().max(30).regex(/^(0|[1-9][0-9]*)$/)),sourceSpendablePoints:nullable(z.string().max(30).regex(/^(0|-?[1-9][0-9]*)$/)),
 preservedSpendablePoints:nullable(z.string().max(30).regex(/^(0|-?[1-9][0-9]*)$/)),sourceHeldPoints:nullable(z.string().max(30).regex(/^(0|[1-9][0-9]*)$/)),preservedHeldPoints:nullable(z.string().max(30).regex(/^(0|[1-9][0-9]*)$/)),unresolvedExceptions:nullable(z.string().max(30).regex(/^(0|[1-9][0-9]*)$/))}),
 branches:z.array(branch).length(3),
 approvals:z.array(object({area:z.enum(approvalAreas),contentSha256:sha,approverRef:ref,date:day,evidence:source})).max(100),
});
export const jsonSchema=z.toJSONSchema(packSchema,{target:'draft-2020-12',io:'input',unrepresentable:'any'});

export function createDraftPack(){
 const binding=()=>({expoOwner:null,expoProjectId:null,supabaseProjectRef:null,androidApplicationId:null,iosBundleIdentifier:null,scheme:null});
 return packSchema.parse({schemaVersion:1,customer:{country:'ZW',tradingName:'Pogo’s',legalEntity:null},release:'cash-ordering-and-loyalty',pilotBranch:null,platforms:[],
  owners:Object.fromEntries(ownerRoles.map(role=>[role,null])),environments:{staging:binding(),production:binding()},ownershipSource:null,inventorySource:null,brandSource:null,supportSource:null,sources:[],
  finance:{source:null,inclusivePrices:null,exchangeConversionRequired:null,refundMode:null,businessTimezone:null,businessDayCutoff:null,workedExamplesSource:null},
  programme:{source:null,termsSource:null,pointsExpiry:null,refundDebtAccepted:null},
  access:{matrixSource:null,restrictedRosterSource:null,administratorRecoverySource:null,administratorRefs:[],cashierSeparationAccepted:null,independentFinanceReviewAccepted:null},
  gaap:{vendor:'GAAP',source:null,launchMode:null,saleRewardRefundSource:null,bridgeProcedureSource:null},
  openings:{source:null,classificationSource:null,cutoff:null,freezeProcedureSource:null,accountCount:null,sourceSpendablePoints:null,preservedSpendablePoints:null,sourceHeldPoints:null,preservedHeldPoints:null,unresolvedExceptions:null},
  branches:branchCodes.map(code=>({code,name:code[0].toUpperCase()+code.slice(1),mapping:{id:null,mode:null},address:null,latitude:null,longitude:null,publicPhone:null,hours:[],operationsSource:null,menuSource:null,gaapBranchCode:null,cashierRefs:[],financeSubmitterRef:null,financeReviewerRef:null,currency:null,collection:null,delivery:null,minimumSubtotalMinor:null,maxTotalMinor:null,acceptanceMinutes:null,deliveryZones:[],categories:[],menu:[],earnRule:null,maxActiveRewardsPerCustomer:null,rewardOffers:[]})),approvals:[]});
}
