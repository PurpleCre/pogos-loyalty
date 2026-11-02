import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { accessTokenFor } from './cash-orders';
import {createFinanceRecovery,financeResultSchema,financeReportSchema,type PendingFinanceCommand} from './finance';
export const financeRecovery=createFinanceRecovery(AsyncStorage);
export async function submitFinanceCommand(owner:string,pending:PendingFinanceCommand){const token=await accessTokenFor(owner);const c=pending.command;
  const result=c.kind==='submit'?await supabase.rpc('submit_finance_reconciliation',{p_id:pending.commandId,p_store:c.storeId,p_day:c.day,p_currency:c.currency,p_observed:c.observed,p_evidence:c.evidence}).setHeader('Authorization',`Bearer ${token}`):
    await supabase.rpc('review_finance_reconciliation',{p_id:c.caseId,p_command:pending.commandId,p_expected_version:c.expectedVersion,p_accept:c.accept,p_reason:c.reason}).setHeader('Authorization',`Bearer ${token}`);
  if(result.error)throw result.error;return financeResultSchema.parse(result.data);
}
export async function readFinanceReport(owner:string,branch:string,day:string,currency:string){const token=await accessTokenFor(owner);
  const{data,error}=await supabase.rpc('finance_branch_report',{p_store:branch,p_day:day,p_currency:currency}).setHeader('Authorization',`Bearer ${token}`);if(error)throw error;return financeReportSchema.parse(data);}
