import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { z } from 'zod';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { accessTokenFor } from '@/lib/cash-orders';
const summarySchema=z.object({enabled:z.boolean(),counts:z.record(z.string(),z.number()),oldest_pending:z.string().nullable(),
  exceptions:z.array(z.object({id:z.uuid(),version:z.number().int(),last_code:z.string().nullable(),created_at:z.string()}))});
export function PushOperations({owner}:{owner:string}){
  const [summary,setSummary]=useState<z.infer<typeof summarySchema>|null>(null);const [reason,setReason]=useState('');
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [target,setTarget]=useState<{id:string;version:number;retry:boolean}|null>(null);
  const current=useRef(true);useEffect(()=>{current.current=true;return()=>{current.current=false;};},[]);
  const refresh=async()=>{setBusy(true);try{const token=await accessTokenFor(owner);const{data,error}=await supabase.rpc('push_operations_summary').setHeader('Authorization',`Bearer ${token}`);
    if(error)throw error;if(current.current)setSummary(summarySchema.parse(data));
  }catch{if(current.current){setSummary(null);setMessage('Administrator MFA is required to verify delivery operations.');}}finally{if(current.current)setBusy(false);}};
  const review=async()=>{if(!target)return;setBusy(true);try{const token=await accessTokenFor(owner);const{error}=await supabase.rpc('review_unknown_push',{
    p_id:target.id,p_expected_version:target.version,p_retry:target.retry,p_reason:reason,p_allow_duplicate:target.retry,
  }).setHeader('Authorization',`Bearer ${token}`);if(error)throw error;
    if(current.current){setTarget(null);setReason('');setMessage('Review recorded. Refresh to verify the current state.');}
  }catch{if(current.current)setMessage('Review could not be confirmed. Reauthenticate with your password and MFA, then refresh the case before retrying.');}
    finally{if(current.current)setBusy(false);}};
  return <View className="bg-slate-100 rounded-xl p-4 my-4"><Text className="font-bold">Administrator: delivery operations</Text>
    <TouchableOpacity accessibilityRole="button" onPress={()=>router.push({pathname:'/auth/reauthenticate',params:{returnTo:'/notifications'}})} className="py-3"><Text>Verify password and MFA for exception review</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>{void refresh();}} className="py-3"><Text>Refresh delivery health</Text></TouchableOpacity>
    {summary?<><Text>Push worker gate: {summary.enabled?'enabled':'disabled'}</Text>
      {Object.entries(summary.counts).map(([state,count])=><Text key={state}>{state.replaceAll('_',' ')}: {count}</Text>)}
      <Text>Provider acceptance does not prove device delivery. The live queue remains the operational source.</Text>
      {summary.exceptions.map(row=><View key={row.id} className="my-3"><Text selectable>{row.id} · {row.last_code}</Text>
        <TouchableOpacity disabled={busy} onPress={()=>{setTarget({...row,retry:true});setReason('');}} className="py-3"><Text>Review an explicit resend…</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={()=>{setTarget({...row,retry:false});setReason('');}} className="py-3"><Text>Close without resending…</Text></TouchableOpacity>
      </View>)}</>:null}
    {target?<View><Text>{target.retry?'A resend may produce a duplicate notification. Confirm this risk and record your reason.':'Close this ambiguous attempt without claiming delivery.'}</Text>
      <TextInput accessibilityLabel="Delivery review reason" value={reason} onChangeText={setReason} maxLength={300} className="border p-3 my-2"/>
      <TouchableOpacity disabled={busy||reason.trim().length<3} onPress={()=>{void review();}} className="py-3"><Text>{target.retry?'Accept duplicate risk and request retry':'Confirm close without resend'}</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={()=>setTarget(null)} className="py-3"><Text>Cancel</Text></TouchableOpacity>
    </View>:null}{message?<Text accessibilityRole="alert">{message}</Text>:null}
  </View>;
}
