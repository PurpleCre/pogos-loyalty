import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/lib/supabase';
import { accessTokenFor } from '@/lib/cash-orders';
import { notificationDestination } from '@/lib/push-installation';
import { PushOperations } from '@/components/admin/PushOperations';
const rowsSchema = z.array(z.object({ id: z.uuid(), kind: z.enum(['order','reward','branch']), created_at: z.string(), read_at: z.string().nullable() }));
type Row = z.infer<typeof rowsSchema>[number];
export default function NotificationsScreen() {
  const { user, userRole, requiresMfa, recoveryRequired, loading } = useAuth();
  const push = usePushNotifications();
  const owner = user?.id; const current = useRef(owner); current.current = owner;
  const [state,setState] = useState<{owner?:string;rows:Row[];error:string;busy:boolean;more:boolean}>({rows:[],error:'',busy:false,more:false});
  const revision=useRef(0); const visible=state.owner===owner?state:{rows:[],error:'',busy:false,more:false};
  const permitted=!!owner&&!requiresMfa&&!recoveryRequired&&!loading;
  const active=useRef(permitted);active.current=permitted;
  const load=useCallback(async(older=false)=>{
    if(!owner||!permitted)return;const request=++revision.current;
    setState(previous=>({...previous,rows:previous.owner===owner?previous.rows:[],more:previous.owner===owner?previous.more:false,owner,busy:true,error:''}));
    try {
      const token=await accessTokenFor(owner);
      const last=older&&state.owner===owner?state.rows.at(-1):undefined;
      const {data,error}=await supabase.rpc('my_notification_inbox',{p_before:last?.created_at,p_before_id:last?.id}).setHeader('Authorization',`Bearer ${token}`);
      if(error)throw error;const rows=rowsSchema.parse(data);
      if(current.current===owner&&request===revision.current)setState(previous=>({owner,rows:older?[...previous.rows.filter(row=>!rows.some(item=>item.id===row.id)),...rows]:rows,error:'',busy:false,more:rows.length===50}));
    }catch{if(current.current===owner&&request===revision.current)setState({owner,rows:[],error:'Updates could not be verified. Refresh to retry.',busy:false,more:false});}
  },[owner,permitted,state.owner,state.rows]);
  const refresh=useRef(load);refresh.current=load;
  useFocusEffect(useCallback(()=>{void refresh.current();return()=>{revision.current++;};},[owner,permitted]));
  useEffect(()=>()=>{revision.current++;},[]);
  const open=async(id:string)=>{
    if(!owner||!permitted)return;
    try{const token=await accessTokenFor(owner);const{data,error}=await supabase.rpc('resolve_transaction_notification',{p_id:id}).setHeader('Authorization',`Bearer ${token}`);
      if(error)throw error;if(current.current===owner&&active.current)router.push(notificationDestination(data));
    }catch{if(current.current===owner)setState(previous=>({...previous,error:'This update is unavailable. Check your current orders or rewards.'}));}
  };
  if(!permitted)return <View className="flex-1 justify-center p-6"><Text>Sign in and complete account verification to view updates.</Text><TouchableOpacity onPress={()=>router.push('/auth/security')} className="py-4"><Text>Account security</Text></TouchableOpacity></View>;
  return <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{padding:24,paddingTop:60}}>
    <TouchableOpacity accessibilityRole="button" onPress={()=>router.replace('/(app)/profile')} className="py-3"><Text>Back to profile</Text></TouchableOpacity>
    <Text className="font-bold text-2xl mb-4">Order and loyalty updates</Text>
    <Text>Updates are also available here when push is unavailable. Check the live order or reward for its current state.</Text>
    {push.supported?<View className="bg-white p-4 rounded-xl my-4"><Text>{push.enabled?'Device registration confirmed':'Device push is off or unconfirmed'}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={push.busy} onPress={()=>{void push.enable();}} className="py-3"><Text>Enable / check device push</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={push.busy} onPress={()=>{void push.disable();}} className="py-3"><Text>Disable device push</Text></TouchableOpacity>
      <Text>Notifications can be delayed. Check this inbox and the live order screen for updates.</Text>
    </View>:<Text className="my-4">Push requires a supported Android or iOS app build on a physical device. Use this inbox here.</Text>}
    {push.message||visible.error?<Text accessibilityRole="alert" className="text-amber-900 my-3">{push.message||visible.error}</Text>:null}
    {userRole==='admin'&&owner?<PushOperations key={owner} owner={owner}/>:null}
    <TouchableOpacity accessibilityRole="button" disabled={visible.busy} onPress={()=>{void load();}} className="py-4"><Text>Refresh updates</Text></TouchableOpacity>
    {visible.rows.map(row=><TouchableOpacity key={row.id} accessibilityRole="button" onPress={()=>{void open(row.id);}} className="bg-white p-4 rounded-xl mb-3">
      <Text className="font-bold">{row.kind==='branch'?'Branch order received':row.kind==='order'?'Order update':'Loyalty update'}{row.read_at?'':' · unread'}</Text>
      <Text>{new Date(row.created_at).toLocaleString()}</Text><Text>Open current details</Text>
    </TouchableOpacity>)}
    {!visible.rows.length&&!visible.busy&&!visible.error?<Text>No updates yet.</Text>:null}
    {visible.more?<TouchableOpacity disabled={visible.busy} onPress={()=>{void load(true);}} className="py-4"><Text>Older updates</Text></TouchableOpacity>:null}
  </ScrollView>;
}
