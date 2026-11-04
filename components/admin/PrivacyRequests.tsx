import { useEffect,useRef,useState } from 'react';
import { View, Text } from 'react-native';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { accessTokenFor } from '@/lib/cash-orders';
import { privacyBlockerMessage } from '@/lib/privacy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const queueSchema=z.array(z.object({id:z.uuid(),user_id:z.uuid(),kind:z.string(),status:z.string(),version:z.number().int(),blocker:z.string().nullable(),created_at:z.string(),tasks:z.array(z.object({system:z.string(),status:z.string(),evidence_reference:z.string().nullable(),recorded_at:z.string().nullable()}))}));
export function PrivacyRequests() {
  const {user,userRole}=useAuth();const owner=user?.id;
  const [queue,setQueue]=useState<z.infer<typeof queueSchema>>([]);const [permitted,setPermitted]=useState(false);
  const [reason,setReason]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const active=useRef(true);
  const [hasMore,setHasMore]=useState(false);
  const load=async(more=false)=>{
    if(!owner||userRole!=='admin')return;const token=await accessTokenFor(owner);const authorization=`Bearer ${token}`;
    const allowed=await supabase.rpc('privacy_is_reviewer').setHeader('Authorization',authorization);if(allowed.error)throw allowed.error;
    if(!active.current)return;setPermitted(allowed.data===true);if(!allowed.data){setQueue([]);return;}
    const last=more?queue.at(-1):null;
    const{data,error}=await supabase.rpc('privacy_review_queue',{p_limit:50,...(last?{p_before:last.created_at,p_before_id:last.id}:{})}).setHeader('Authorization',authorization);if(error)throw error;const parsed=queueSchema.parse(data);if(active.current){setQueue(previous=>more?[...previous,...parsed.filter(row=>!previous.some(old=>old.id===row.id))]:parsed);setHasMore(parsed.length===50);}
  };
  useEffect(()=>{active.current=true;void load().catch(()=>{if(active.current)setMessage('Unable to load privacy requests.');});return()=>{active.current=false;};},[owner,userRole]);
  const review=async(id:string,version:number,action:'review'|'start'|'pause'|'resume')=>{
    if(!owner||reason.trim().length<3){setMessage('Enter a review reason.');return;}
    setBusy(true);setMessage('');
    try{const token=await accessTokenFor(owner);const{error}=await supabase.rpc('review_privacy_deletion',{p_id:id,p_expected_version:version,p_action:action,p_reason:reason.trim()}).setHeader('Authorization',`Bearer ${token}`);if(error)throw error;await load();}
    catch{if(active.current)setMessage('Unable to update this request. Refresh its status and verify your reviewer access.');}
    finally{if(active.current)setBusy(false);}
  };
  return <View className="gap-4">
    <Text className="text-xl font-bold">Privacy requests</Text>
    {!permitted?<Text>An approved privacy reviewer with administrator MFA is required to view customer requests. Contact the release owner for access.</Text>:<>
      <Text>Review requests and operational blockers here. Erasure and vendor tasks follow the approved retention runbook. This screen cannot declare an account erased.</Text>
      <Input accessibilityLabel="Privacy review reason" value={reason} onChangeText={setReason} maxLength={500} placeholder="Internal review reason"/>
      {queue.map(request=><View key={request.id} className="p-4 bg-white border border-line rounded-xl gap-3">
        <Text className="font-bold">Deletion · {request.status}</Text><Text selectable>Reference: {request.id}</Text><Text selectable>Account: {request.user_id}</Text>
        {request.blocker?<Text>{privacyBlockerMessage(request.blocker)}</Text>:null}
        {request.status==='processing'?<Button variant="outline" disabled={busy} onPress={()=>{void review(request.id,request.version,request.blocker?'resume':'pause');}}>{request.blocker?'Recheck and resume processing':'Flag for operator review'}</Button>:<>
          <Button variant="outline" disabled={busy} onPress={()=>{void review(request.id,request.version,'review');}}>Mark under review</Button>
          <Button disabled={busy} onPress={()=>{void review(request.id,request.version,'start');}}>Check blockers and start approved processing</Button>
        </>}
        {request.tasks.map(task=><Text key={task.system}>{task.system}: {task.status}{task.evidence_reference?` · ${task.evidence_reference}`:''}</Text>)}
      </View>)}
      {hasMore?<Button variant="outline" disabled={busy} onPress={()=>{setBusy(true);void load(true).catch(()=>setMessage('Unable to load older requests.')).finally(()=>setBusy(false));}}>Load older requests</Button>:null}
    </>}
    {message?<Text accessibilityRole="alert">{message}</Text>:null}
    <Button variant="ghost" disabled={busy} onPress={()=>{void load().catch(()=>setMessage('Unable to refresh requests.'));}}>Refresh privacy requests</Button>
  </View>;
}
