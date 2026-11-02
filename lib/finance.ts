import { z } from 'zod';
import { newSubmissionKey } from './cash-checkout.ts';
export const exactInteger = z.string().regex(/^(0|-?[1-9][0-9]*)$/);
export const currencySchema=z.enum(['USD','ZWG']);
export const periodSchema=z.object({store_id:z.uuid(),business_day:z.string(),currency:currencySchema,period_start:z.string(),period_end:z.string(),
  received_minor:exactInteger,refunded_minor:exactInteger,settled_minor:exactInteger,net_received_minor:exactInteger,net_till_movement_minor:exactInteger,
  sale_count:exactInteger,refund_count:exactInteger,entry_count:exactInteger,signature:z.string().regex(/^[a-f0-9]{64}$/)});
export const financeReportSchema=z.object({as_of:z.string(),period:periodSchema,outstanding_all_dates_minor:exactInteger,
  pending_handovers_all_dates:exactInteger,missing_receipts_all_dates:exactInteger,reward_handovers_day:exactInteger,reward_voids_day:exactInteger,
  held_reward_points_all_dates:exactInteger,latest_reconciliation:z.object({id:z.uuid(),status:z.string(),signature_current:z.boolean(),version:z.number().int(),created_at:z.string()}).nullable()});
export type FinanceReport=z.infer<typeof financeReportSchema>;
export const financeEntryPageSchema=z.object({signature:z.string(),store_id:z.uuid(),business_day:z.string(),currency:currencySchema,
  entries:z.array(z.object({id:z.uuid(),order_id:z.uuid(),event_type:z.enum(['received','refunded','settled']),amount_minor:exactInteger,reference:z.string(),created_at:z.string()})),next_after:z.uuid().nullable()});
export const financeCasesSchema=z.array(z.object({id:z.uuid(),business_day:z.string(),currency:currencySchema,observed:z.object({received_minor:exactInteger,refunded_minor:exactInteger,settled_minor:exactInteger}),
  snapshot:periodSchema,evidence:z.string(),status:z.enum(['matched','variance','accepted','rejected','stale']),version:z.number().int().nonnegative(),revision:z.number().int().positive(),
  previous_id:z.uuid().nullable(),submitted_by_me:z.boolean(),signature_current:z.boolean(),created_at:z.string(),history:z.array(z.object({action:z.string(),reason:z.string().nullable(),created_at:z.string()}))}));
export type FinanceCase=z.infer<typeof financeCasesSchema>[number];
export function moneyText(value:string,currency:string){const minor=BigInt(exactInteger.parse(value));const abs=minor<0n?-minor:minor;
  return `${currency} ${minor<0n?'-':''}${abs/100n}.${(abs%100n).toString().padStart(2,'0')}`;}
export function parseObservedMoney(value:string){const text=value.trim();if(!/^\d{1,22}(\.\d{1,2})?$/.test(text))throw Error('Enter a non-negative amount with at most two decimal places.');
  const[whole,fraction='']=text.split('.');return(BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))).toString();}
export function harareDay(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Harare',calendar:'gregory',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(name:string)=>parts.find(row=>row.type===name)?.value;return`${part('year')}-${part('month')}-${part('day')}`;}
export function validReportDay(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(`${day}T00:00:00Z`))&&new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)===day;}
const observed=z.object({received_minor:z.string().regex(/^(0|[1-9][0-9]{0,23})$/),refunded_minor:z.string().regex(/^(0|[1-9][0-9]{0,23})$/),settled_minor:z.string().regex(/^(0|[1-9][0-9]{0,23})$/)});
const commandSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('submit'),storeId:z.uuid(),day:z.string().refine(validReportDay),currency:currencySchema,observed,evidence:z.string().trim().min(3).max(500)}),
  z.object({kind:z.literal('review'),storeId:z.uuid(),caseId:z.uuid(),expectedVersion:z.number().int().nonnegative(),accept:z.boolean(),reason:z.string().trim().min(3).max(500)}),
]);
export type FinanceCommand=z.infer<typeof commandSchema>;
const pendingSchema=z.object({commandId:z.uuid(),command:commandSchema});
export type PendingFinanceCommand=z.infer<typeof pendingSchema>;
export const financeResultSchema=z.object({id:z.uuid(),store_id:z.uuid(),status:z.enum(['matched','variance','accepted','rejected','stale']),version:z.number().int().nonnegative()});
export type FinanceResult=z.infer<typeof financeResultSchema>;
interface Storage{getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>;removeItem(key:string):Promise<void>}
export function createFinanceRecovery(storage:Storage){const busy=new Set<string>();const key=(owner:string)=>`@pogos_pending_finance_command:${owner}`;
  const load=async(owner:string)=>{const raw=await storage.getItem(key(owner));return raw?pendingSchema.parse(JSON.parse(raw)):null;};
  const lock=async<T>(owner:string,fn:()=>Promise<T>)=>{if(busy.has(owner))throw Error('A finance action is already being checked.');busy.add(owner);try{return await fn();}finally{busy.delete(owner);}};
  const send=async(owner:string,pending:PendingFinanceCommand,submit:(value:PendingFinanceCommand)=>Promise<FinanceResult>)=>{
    try{const result=financeResultSchema.parse(await submit(pending));const c=pending.command;
      const allowed=c.kind==='submit'?['matched','variance']:c.accept?['accepted','stale']:['rejected','stale'];
      if(result.id!==(c.kind==='submit'?pending.commandId:c.caseId)||result.store_id!==c.storeId||result.version!==(c.kind==='submit'?0:c.expectedVersion+1)||!allowed.includes(result.status))throw Error('Finance response could not be confirmed. Check the saved action.');
      try{await storage.removeItem(key(owner));}catch{/* Saved identity replays a confirmed result. */}return result;
    }catch(error){const code=typeof error==='object'&&error!==null&&'code'in error?String(error.code):'';
      if(code.startsWith('22')||code.startsWith('23')||code==='40001')await storage.removeItem(key(owner));throw error;}
  };
  return{load,execute:(owner:string,request:FinanceCommand,submit:(value:PendingFinanceCommand)=>Promise<FinanceResult>)=>lock(owner,async()=>{
    const command=commandSchema.parse(request);const prior=await load(owner);if(prior&&JSON.stringify(prior.command)!==JSON.stringify(command))throw Error('Check the saved finance action before starting another.');
    const pending=prior??{commandId:newSubmissionKey(),command};if(!prior)await storage.setItem(key(owner),JSON.stringify(pending));return send(owner,pending,submit);
  }),recover:(owner:string,submit:(value:PendingFinanceCommand)=>Promise<FinanceResult>)=>lock(owner,async()=>{const prior=await load(owner);return prior?send(owner,prior,submit):null;})};
}
export async function collectFinanceReport(report:FinanceReport,read:(after:string|null)=>Promise<unknown>,verify:()=>Promise<unknown>,isCurrent:()=>boolean){
  const initial=financeReportSchema.parse(report);const entries:z.infer<typeof financeEntryPageSchema>['entries']=[];let cursor:string|null=null;let last='';let size=0;
  do{if(!isCurrent())throw Error('Account or branch changed.');const page=financeEntryPageSchema.parse(await read(cursor));
    if(!isCurrent()||page.store_id!==initial.period.store_id||page.business_day!==initial.period.business_day||page.currency!==initial.period.currency||page.signature!==initial.period.signature)throw Error('Report scope or source changed; restart collection.');
    for(const row of page.entries){if(row.id<=last)throw Error('Report pagination could not be confirmed.');last=row.id;entries.push(row);size+=JSON.stringify(row).length;}
    if(entries.length>5000||size>5000000)throw Error('This report needs a support-assisted export.');
    if(page.next_after&&(page.next_after===cursor||page.next_after!==last))throw Error('Report cursor could not be confirmed.');cursor=page.next_after;
  }while(cursor);
  const final=financeReportSchema.parse(await verify());if(!isCurrent()||final.period.signature!==initial.period.signature||final.period.store_id!==initial.period.store_id||final.period.currency!==initial.period.currency||final.period.business_day!==initial.period.business_day)throw Error('Report changed before export.');
  if(BigInt(initial.period.entry_count)!==BigInt(entries.length))throw Error('Report entries are incomplete.');
  return{format:'pogos-finance-report-v1',report:initial,entries,notes:'App records and externally entered reconciliation evidence; not a fiscal receipt or proof of physical cash.'};
}
