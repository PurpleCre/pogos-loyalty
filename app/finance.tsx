import {useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,ScrollView,TouchableOpacity,TextInput,ActivityIndicator,AppState} from 'react-native';
import {router} from 'expo-router';
import {useAuth,type AppRole} from '@/hooks/useAuth';
import {useStores} from '@/hooks/useStores';
import {supabase} from '@/lib/supabase';
import {accessTokenFor} from '@/lib/cash-orders';
import {financeRecovery,readFinanceReport,submitFinanceCommand} from '@/lib/finance-api';
import {collectFinanceReport,financeCasesSchema,harareDay,moneyText,parseObservedMoney,validReportDay,type FinanceCase,type FinanceCommand,type FinanceReport,type PendingFinanceCommand} from '@/lib/finance';
import {savePrivacyExport} from '@/lib/privacy-file';
import {newSubmissionKey} from '@/lib/cash-checkout';
import {z} from 'zod';
function Button({label,disabled=false,onPress}:{label:string;disabled?:boolean;onPress():void}){return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} className={`p-3 rounded-xl my-1 ${disabled?'bg-slate-200':'bg-red-600'}`}><Text className="text-white font-bold">{label}</Text></TouchableOpacity>;}
function Field({label,value,onChange}:{label:string;value:string;onChange(value:string):void}){return <View className="my-2"><Text>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={500} autoCapitalize="none" className="bg-white border border-slate-300 rounded-lg p-3"/></View>;}
function CaseCard({row,reviewer,blocked,onCommand,branch}:{row:FinanceCase;reviewer:boolean;blocked:boolean;onCommand(command:FinanceCommand):Promise<void>;branch:string}){
  const[reason,setReason]=useState('');const[error,setError]=useState('');
  const review=async(accept:boolean)=>{setError('');try{await onCommand({kind:'review',storeId:branch,caseId:row.id,expectedVersion:row.version,accept,reason});setReason('');}catch{setError('Review could not be confirmed. Check the saved action and refresh the case.');}};
  const open=['matched','variance'].includes(row.status);
  return <View className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
    <Text className="font-bold">{row.business_day} · {row.currency} · observation {row.revision} · {row.status}</Text><Text selectable>{row.id}</Text>
    {!row.signature_current?<Text className="text-amber-800">Source records changed after this snapshot. Prior acceptance is not current.</Text>:null}
    <Text>Evidence: {row.evidence}</Text>
    {(['received_minor','refunded_minor','settled_minor'] as const).map(key=><Text key={key}>{key==='received_minor'?'App-linked sales':key==='refunded_minor'?'App-linked refunds':'Collector deposits'}: observed {moneyText(row.observed[key],row.currency)} / app {moneyText(row.snapshot[key],row.currency)}</Text>)}
    {row.previous_id?<Text className="text-slate-500 mt-2">Revision of {row.previous_id}</Text>:null}
    {row.history.map((item,index)=><Text key={index} className="text-slate-600 mt-2">{item.action} · {item.reason??'Original observation'} · {new Date(item.created_at).toLocaleString()}</Text>)}
    {open&&reviewer&&!row.submitted_by_me?<>
      <Field label="Review evidence and reason" value={reason} onChange={setReason}/>
      <Button label="Accept matching evidence" disabled={blocked||reason.trim().length<3||row.status!=='matched'||!row.signature_current} onPress={()=>{void review(true);}}/>
      <Button label={row.signature_current?'Reject for investigation':'Record stale snapshot for replacement'} disabled={blocked||reason.trim().length<3} onPress={()=>{void review(false);}}/>
    </>:open?<Text className="text-amber-800 mt-2">A different assigned finance reviewer or administrator must review this observation.</Text>:null}
    {error?<Text accessibilityRole="alert">{error}</Text>:null}
  </View>;
}
function FinanceContent({owner,role,branch,day,currency}:{owner:string;role:AppRole;branch:string;day:string;currency:string}){
  const scope=`${owner}:${role}:${branch}:${day}:${currency}`;const current=useRef(scope);current.current=scope;
  const mounted=useRef(true);const revision=useRef(0);
  const[report,setReport]=useState<FinanceReport|null>(null);const[cases,setCases]=useState<FinanceCase[]>([]);const[more,setMore]=useState(false);
  const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[message,setMessage]=useState('');
  const[pending,setPending]=useState<PendingFinanceCommand|null>(null);const[ready,setReady]=useState(false);
  const[sales,setSales]=useState('');const[refunds,setRefunds]=useState('');const[deposits,setDeposits]=useState('');const[evidence,setEvidence]=useState('');const[confirmed,setConfirmed]=useState(false);
  const[chain,setChain]=useState<{spendable_points:string;held_points:string;unreviewed_openings:string;projection_differences:string}|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;revision.current++;};},[]);
  const isCurrent=()=>mounted.current&&current.current===scope;
  const loadPending=useCallback(async()=>{try{const value=await financeRecovery.load(owner);if(mounted.current){setPending(value);setReady(true);}}
    catch{if(mounted.current){setReady(false);setError('Saved finance action is unreadable. Contact support before making another change.');}}},[owner]);
  const refresh=useCallback(async(older=false,after?:FinanceCase)=>{const request=++revision.current;setBusy(true);setError('');
    try{const token=await accessTokenFor(owner);
      const[summary,list]=await Promise.all([readFinanceReport(owner,branch,day,currency),supabase.rpc('list_finance_reconciliations',{
        p_store:branch,p_before:older?after?.created_at:undefined,p_before_id:older?after?.id:undefined,
      }).setHeader('Authorization',`Bearer ${token}`)]);
      if(list.error)throw list.error;const parsed=financeCasesSchema.parse(list.data);
      if(summary.period.store_id!==branch||summary.period.business_day!==day||summary.period.currency!==currency)throw Error('Scope changed');
      if(!mounted.current||request!==revision.current)return;
      setReport(summary);setCases(previous=>older?[...previous.filter(row=>!parsed.some(item=>item.id===row.id)),...parsed]:parsed);setMore(parsed.length===20);
    }catch{if(mounted.current&&request===revision.current){setReport(null);setCases([]);setChain(null);setError('Financial data could not be verified. Check your access and connection, then refresh.');}}
    finally{if(mounted.current&&request===revision.current)setBusy(false);}
  },[owner,branch,day,currency]);
  useEffect(()=>{void refresh();void loadPending();const subscription=AppState.addEventListener('change',next=>{if(next==='active'){void refresh();void loadPending();}});
    return()=>{subscription.remove();revision.current++;};},[refresh,loadPending]);
  const act=async(command:FinanceCommand)=>{if(!isCurrent()||!ready||busy)throw Error('Refresh before continuing.');setBusy(true);setMessage('');
    try{const result=await financeRecovery.execute(owner,command,value=>submitFinanceCommand(owner,value));if(isCurrent())setMessage(result.status==='stale'?'Source changed; the case is stale. Refresh and submit a new observation.':result.status==='variance'?'Variance recorded. Investigate before acceptance.':'Action confirmed. Refreshed cases show the current status.');}
    finally{await loadPending();if(isCurrent()){setBusy(false);await refresh();}}
  };
  const recover=async()=>{setBusy(true);try{await financeRecovery.recover(owner,value=>submitFinanceCommand(owner,value));if(isCurrent())setMessage('Saved action checked. Refreshed cases show current status.');}
    catch{if(isCurrent())setMessage('Saved action remains unconfirmed. Check access and connection; do not replace its identity.');}finally{await loadPending();if(isCurrent()){setBusy(false);await refresh();}}};
  const submit=async()=>{try{if(!confirmed)throw Error('Confirm the app-linked scope.');await act({kind:'submit',storeId:branch,day,currency:currency==='USD'?'USD':'ZWG',
    observed:{received_minor:parseObservedMoney(sales),refunded_minor:parseObservedMoney(refunds),settled_minor:parseObservedMoney(deposits)},evidence});
    if(isCurrent()){setSales('');setRefunds('');setDeposits('');setEvidence('');setConfirmed(false);}
  }catch{if(isCurrent())setMessage('Observation could not be confirmed. Check all amounts, the evidence reference and any saved action.');}};
  const exportReport=async()=>{if(!report)return;setBusy(true);try{
    const value=await collectFinanceReport(report,async after=>{const token=await accessTokenFor(owner);const{data,error}=await supabase.rpc('finance_entries',{
      p_store:branch,p_day:day,p_currency:currency,p_signature:report.period.signature,p_after:after??undefined,p_limit:100,
    }).setHeader('Authorization',`Bearer ${token}`);if(error)throw error;return data;},()=>readFinanceReport(owner,branch,day,currency),isCurrent);
    await savePrivacyExport(value,newSubmissionKey(),isCurrent,'finance');if(isCurrent())setMessage('Report prepared. Saving or sharing is controlled by your device.');
  }catch{if(isCurrent())setMessage('A complete report could not be prepared. Refresh and retry; large reports may need support.');}finally{if(isCurrent())setBusy(false);}};
  const loadChain=async()=>{setBusy(true);try{const token=await accessTokenFor(owner);const{data,error}=await supabase.rpc('finance_chain_points').setHeader('Authorization',`Bearer ${token}`);if(error)throw error;
    const parsed=z.object({spendable_points:z.string(),held_points:z.string(),unreviewed_openings:z.string(),projection_differences:z.string()}).parse(data);if(isCurrent())setChain(parsed);
  }catch{if(isCurrent()){setChain(null);setMessage('Chain totals require current administrator MFA.');}}finally{if(isCurrent())setBusy(false);}};
  const blocked=busy||!ready||!!pending||!report;
  return <View>
    <Button label="Refresh verified data" disabled={busy} onPress={()=>{void refresh();void loadPending();}}/>
    {busy?<ActivityIndicator/>:null}{error||message?<Text accessibilityRole="alert" className="my-3 text-amber-900">{error||message}</Text>:null}
    {pending?<View className="bg-amber-50 p-4 rounded-xl my-3"><Text>A saved finance action needs checking ({pending.command.storeId===branch?'this branch':'another assigned branch'}). It may already have succeeded.</Text>
      <Button label="Check saved finance action" disabled={busy} onPress={()=>{void recover();}}/></View>:null}
    {report?<View className="bg-white p-4 rounded-xl my-3"><Text className="font-bold text-lg">App records · {report.period.business_day} · {currency}</Text>
      <Text>Verified as of {new Date(report.as_of).toLocaleString()}</Text>
      <Text>Cash sales recorded: {moneyText(report.period.received_minor,currency)} ({report.period.sale_count})</Text>
      <Text>Cash refunds: {moneyText(report.period.refunded_minor,currency)} ({report.period.refund_count})</Text>
      <Text>Net recorded collections: {moneyText(report.period.net_received_minor,currency)}</Text>
      <Text>Collector deposits acknowledged: {moneyText(report.period.settled_minor,currency)}</Text>
      <Text>Net till movement (deposits less refunds): {moneyText(report.period.net_till_movement_minor,currency)}</Text>
      <Text>Outstanding cash, all dates: {moneyText(report.outstanding_all_dates_minor,currency)}</Text>
      <Text>Pending handovers, all dates: {report.pending_handovers_all_dates}</Text><Text>Missing receipts, all dates: {report.missing_receipts_all_dates}</Text>
      <Text className="mt-3">Reward handovers / voids this day (all currencies): {report.reward_handovers_day} / {report.reward_voids_day}</Text>
      <Text>Active reward holds, all dates: {report.held_reward_points_all_dates} points</Text>
      <Text className="mt-3">Latest case: {report.latest_reconciliation?.status??'Not submitted'}{report.latest_reconciliation&&!report.latest_reconciliation.signature_current?' · source changed':''}</Text>
      <Text className="text-slate-600 mt-3">These are app records. Reconcile the corresponding app-linked GAAP entries and collector deposits. This is not the whole till balance or a fiscal receipt. An accepted period does not settle outstanding cash.</Text>
      <Button label="Prepare complete JSON report" disabled={busy} onPress={()=>{void exportReport();}}/>
    </View>:null}
    {role==='admin'?<View className="bg-white p-4 rounded-xl my-3"><Button label="Check chain-wide points and projection" disabled={busy} onPress={()=>{void loadChain();}}/>
      {chain?<Text>Spendable: {chain.spendable_points} points · held: {chain.held_points} · unreviewed openings: {chain.unreviewed_openings} · projection differences: {chain.projection_differences}</Text>:null}
      <Text>No monetary value is assigned to points. Chain-wide account totals require administrator access.</Text></View>:null}
    <View className="bg-white p-4 rounded-xl my-3"><Text className="font-bold text-lg">Submit external observations</Text>
      <Text>Enter amounts in {currency}, with at most two decimal places. Use only the matching app-linked GAAP records and collector deposits for this Harare day.</Text>
      <Field label={`GAAP app-linked gross cash sales (${currency})`} value={sales} onChange={setSales}/>
      <Field label={`GAAP app-linked cash refunds (${currency})`} value={refunds} onChange={setRefunds}/>
      <Field label={`Collector deposits confirmed in till (${currency})`} value={deposits} onChange={setDeposits}/>
      <Field label="Evidence reference (report / till / operator record)" value={evidence} onChange={setEvidence}/>
      <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} onPress={()=>setConfirmed(!confirmed)} className="py-3"><Text>{confirmed?'☑':'☐'} These figures cover the matching app-linked scope, not the entire till.</Text></TouchableOpacity>
      <Button label="Record observation for independent review" disabled={blocked||!confirmed||evidence.trim().length<3} onPress={()=>{void submit();}}/>
      <Text>A variance requires investigation. This action never adjusts an order, cash receipt, refund or points balance.</Text>
    </View>
    <Text className="font-bold text-lg my-3">Reconciliation cases · this branch</Text>
    {cases.map(row=><CaseCard key={`${row.id}:${row.version}`} row={row} reviewer={role==='finance'||role==='admin'} blocked={blocked} onCommand={act} branch={branch}/>)}
    {more?<Button label="Older cases" disabled={busy} onPress={()=>{void refresh(true,cases.at(-1));}}/>:null}
  </View>;
}
export default function FinanceScreen(){const{user,userRole,staffStoreIds,loading,requiresMfa,recoveryRequired}=useAuth();const{stores}=useStores();
  const[selected,setSelected]=useState('');const[day,setDay]=useState(harareDay());const[currency,setCurrency]=useState('USD');
  const branches=userRole==='admin'?stores:stores.filter(row=>staffStoreIds.includes(row.id));const branch=branches.some(row=>row.id===selected)?selected:branches[0]?.id;
  if(loading)return <ActivityIndicator/>;
  if(!user||requiresMfa||recoveryRequired||!['admin','manager','finance'].includes(userRole))return <View className="flex-1 justify-center p-6"><Text>Assigned manager or finance access with MFA is required.</Text><Button label="Account security" onPress={()=>router.push('/auth/security')}/><Button label="Back to profile" onPress={()=>router.replace('/(app)/profile')}/></View>;
  const scope=`${user.id}:${userRole}:${staffStoreIds.join(',')}:${branch}:${day}:${currency}`;
  return <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{padding:20,paddingTop:60,paddingBottom:60}}>
    <Button label="Back to profile" onPress={()=>router.replace('/(app)/profile')}/><Text className="font-bold text-2xl my-3">Cash and till reconciliation</Text>
    <ScrollView horizontal>{branches.map(row=><TouchableOpacity key={row.id} onPress={()=>setSelected(row.id)} className={`p-3 rounded-lg mr-2 ${branch===row.id?'bg-red-100':'bg-white'}`}><Text>{row.name}</Text></TouchableOpacity>)}</ScrollView>
    <Field label="Harare business day (YYYY-MM-DD)" value={day} onChange={setDay}/>
    <View className="flex-row">{['USD','ZWG'].map(value=><TouchableOpacity key={value} onPress={()=>setCurrency(value)} className={`p-3 rounded-lg mr-2 ${currency===value?'bg-red-100':'bg-white'}`}><Text>{value}</Text></TouchableOpacity>)}</View>
    {!branch?<Text className="my-4">No assigned branches are available. Ask an administrator to verify your assignment and branch data.</Text>:!validReportDay(day)?<Text>Enter a valid calendar date.</Text>:
      <FinanceContent key={scope} owner={user.id} role={userRole} branch={branch} day={day} currency={currency}/>}
  </ScrollView>;
}
