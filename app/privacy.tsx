import { useEffect,useRef,useState } from 'react';
import { ScrollView,Text,View,Switch,ActivityIndicator,Linking } from 'react-native';
import { Redirect,router } from 'expo-router';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { accessTokenFor } from '@/lib/cash-orders';
import { newSubmissionKey } from '@/lib/cash-checkout';
import { privacyBlockerMessage,privacyRequestSchema,privacySettingsSchema } from '@/lib/privacy';
import { submitPrivacyRequest,getPrivacyExport } from '@/lib/privacy-api';
import { savePrivacyExport } from '@/lib/privacy-file';
import contact from '@/config/privacy-contact.json';
const requestList=z.array(privacyRequestSchema.extend({created_at:z.string(),completed_at:z.string().nullable()}));
const updates=z.array(z.object({event_type:z.string(),message:z.string(),created_at:z.string()}));
function PrivacyControls({owner}:{owner:string}) {
  const [preferences,setPreferences]=useState(false);const [notice,setNotice]=useState<string|null>(null);const [readNotice,setReadNotice]=useState(false);
  const [email,setEmail]=useState(contact.supportEmail);const [requests,setRequests]=useState<z.infer<typeof requestList>>([]);
  const [messages,setMessages]=useState<z.infer<typeof updates>>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const [confirmDeletion,setConfirmDeletion]=useState(false);
  const active=useRef(true);const loadRevision=useRef(0);
  const noticeVersion=useRef<string|null>(null);
  const load=async()=>{
    const version=++loadRevision.current;const token=await accessTokenFor(owner);const authorization=`Bearer ${token}`;
    const [settings,pref,list]=await Promise.all([
      supabase.from('privacy_settings').select('support_email,active_notice_version').single(),
      supabase.from('privacy_preferences').select('marketing_email').eq('user_id',owner).maybeSingle().setHeader('Authorization',authorization),
      supabase.from('privacy_requests').select('id,kind,status,version,blocker,created_at,completed_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(30).setHeader('Authorization',authorization),
    ]);
    if(settings.error||pref.error||list.error)throw new Error('Unable to load privacy controls.');
    const approved=privacySettingsSchema.parse(settings.data);const rows=requestList.parse(list.data);
    if(active.current&&version===loadRevision.current){if(noticeVersion.current!==approved.active_notice_version)setReadNotice(false);noticeVersion.current=approved.active_notice_version;setPreferences(pref.data?.marketing_email??false);setEmail(approved.support_email);setNotice(approved.active_notice_version);setRequests(rows);}
  };
  useEffect(()=>{active.current=true;void load().catch(()=>{if(active.current)setMessage('Unable to load privacy controls. Refresh or contact us by email.');});return()=>{active.current=false;++loadRevision.current;};},[owner]);
  const run=async(action:()=>Promise<void>)=>{
    setBusy(true);setMessage('');
    try{await action();}
    catch(error){if(active.current){const code=(error as {code?:string})?.code;
      setMessage(code==='42501'?'Verify your password again, and your authenticator if enabled, then retry.':error instanceof Error&&/too large|large export/.test(error.message)?error.message:'This action could not be confirmed. Refresh before retrying, or contact the privacy team.');}}
    finally{if(active.current)setBusy(false);}
  };
  const consent=async(enabled:boolean)=>{
    const token=await accessTokenFor(owner);const {error}=await supabase.rpc('set_privacy_marketing',{p_id:newSubmissionKey(),p_enabled:enabled,...(enabled&&notice?{p_notice_version:notice}:{})}).setHeader('Authorization',`Bearer ${token}`);
    if(error)throw error;await load();if(active.current)setMessage(enabled?'Your marketing email preference was saved.':'Marketing email is now switched off for new sends.');
  };
  const deletion=async()=>{
    const request=await submitPrivacyRequest(owner,newSubmissionKey(),'deletion');await load();
    if(active.current)setMessage(`Your deletion request is recorded. Your account has not been erased. ${privacyBlockerMessage(request.blocker)}`);
  };
  const exportData=async()=>{
    const request=await submitPrivacyRequest(owner,newSubmissionKey(),'export');
    const value=await getPrivacyExport(owner,request.id,()=>active.current);
    if(!active.current)return;await savePrivacyExport(value,request.id,()=>active.current);await load();
    if(active.current)setMessage('Your export was prepared. The save/share dialog has closed. Keep any saved copy private.');
  };
  const cancel=async(id:string,version:number)=>{
    const token=await accessTokenFor(owner);const{error}=await supabase.rpc('cancel_privacy_request',{p_id:id,p_expected_version:version}).setHeader('Authorization',`Bearer ${token}`);if(error)throw error;await load();
  };
  const showUpdates=async(id:string)=>{
    const token=await accessTokenFor(owner);const{data,error}=await supabase.rpc('my_privacy_request_events',{p_id:id}).setHeader('Authorization',`Bearer ${token}`);if(error)throw error;const parsed=updates.parse(data);if(active.current)setMessages(parsed);
  };
  return <ScrollView className="flex-1 bg-white" contentContainerStyle={{padding:24,paddingTop:64,gap:16}}>
    <Text className="text-2xl font-bold">Privacy and account data</Text>
    <Button variant="outline" onPress={()=>router.push('/privacy-policy')}>Read privacy information</Button>
    <View className="gap-3 p-4 border border-slate-200 rounded-xl">
      <Text className="text-lg font-bold">Marketing email</Text><Text>Offers are optional and separate from order service and loyalty. New accounts are opted out.</Text>
      {notice?<><View className="flex-row items-center gap-3"><Switch accessibilityLabel="I have read the current privacy notice" value={readNotice} onValueChange={setReadNotice} disabled={busy}/><Text className="flex-1">I have read the current privacy notice.</Text></View>
      <Button disabled={busy||!readNotice} onPress={()=>{void run(()=>consent(true));}}>Opt in to email offers</Button></>:<Text>Marketing opt-in is unavailable until the privacy notice is ready.</Text>}
      <Text>Saved preference: {preferences?'On':'Off'}</Text><Button disabled={busy} variant="outline" onPress={()=>{void run(()=>consent(false));}}>Switch marketing email off</Button>
    </View>
    <Text className="text-lg font-bold">Export or delete your account</Text><Text>Verify your password again before these actions. Your authenticator is also required if enabled. Keep the app open while preparing an export.</Text>
    <Button variant="outline" disabled={busy} onPress={()=>router.push('/auth/reauthenticate')}>Verify my identity</Button>
    <Button isLoading={busy} onPress={()=>{void run(exportData);}}>Prepare and save account export</Button>
    <Text>Exports cover customer account data. Authentication secrets, other people’s details and internal security notes are excluded. Contact the privacy team for other records or vendor-held data.</Text>
    <Button variant="outline" disabled={busy} onPress={()=>setConfirmDeletion(true)}>Request account deletion</Button>
    {confirmDeletion?<View className="p-4 border border-red-300 rounded-xl gap-3"><Text>Confirm that you want to request deletion of your account. This records your request; erasure follows review, settlement of active orders/rewards and the applicable retention rules.</Text><Button disabled={busy} onPress={()=>{setConfirmDeletion(false);void run(deletion);}}>Confirm deletion request</Button><Button variant="ghost" disabled={busy} onPress={()=>setConfirmDeletion(false)}>Keep my account</Button></View>:null}
    <Button variant="ghost" onPress={()=>router.push('/account-deletion')}>How account deletion works</Button>
    {message?<Text accessibilityRole="alert">{message}</Text>:null}
    <Text className="text-lg font-bold">Recent requests</Text>
    {requests.map(request=><View key={request.id} className="p-4 border border-slate-200 rounded-xl gap-2">
      <Text className="font-bold">{request.kind==='export'?'Account export':'Account deletion'} · {request.kind==='export'&&request.status==='completed'?'prepared':request.status}</Text>
      <Text selectable>Reference: {request.id}</Text>{request.blocker?<Text>{privacyBlockerMessage(request.blocker)}</Text>:null}
      <Button variant="ghost" disabled={busy} onPress={()=>{void run(()=>showUpdates(request.id));}}>View updates</Button>
      {['submitted','blocked','reviewing'].includes(request.status)?<Button variant="outline" disabled={busy} onPress={()=>{void run(()=>cancel(request.id,request.version));}}>Cancel this request</Button>:null}
    </View>)}
    {messages.map((item,index)=><Text key={`${item.created_at}:${index}`}>{new Date(item.created_at).toLocaleString()} · {item.message}</Text>)}
    <Button variant="ghost" disabled={busy} onPress={()=>{void run(load);}}>Refresh account controls</Button>
    <Text selectable>Privacy contact: {email}</Text><Button variant="ghost" onPress={()=>{void Linking.openURL(`mailto:${encodeURIComponent(email)}?subject=Pogo%27s%20privacy%20request`).catch(()=>setMessage('Open your email app and use the privacy address above.'));}}>Email the privacy team</Button>
    <Button variant="ghost" disabled={busy} onPress={()=>router.replace('/(app)/profile')}>Back to profile</Button>
  </ScrollView>;
}
export default function Privacy() {
  const {user,loading,requiresMfa,recoveryRequired}=useAuth();
  if(loading)return <View className="flex-1 justify-center"><ActivityIndicator/></View>;
  if(user&&recoveryRequired)return <Redirect href="/auth/reset-password"/>;
  if(user&&requiresMfa)return <Redirect href="/auth/security?returnTo=/privacy"/>;
  if(!user)return <View className="flex-1 justify-center p-6 bg-white gap-4"><Text className="text-2xl font-bold">Manage your Pogo’s data</Text><Text>Sign in to export account data, manage marketing or request deletion. If you cannot sign in, use the email contact on our deletion information page.</Text><Button onPress={()=>router.push('/(auth)/login?redirect=/privacy')}>Sign in to manage my data</Button><Button variant="outline" onPress={()=>router.push('/account-deletion')}>Request deletion without signing in</Button><Button variant="ghost" onPress={()=>router.push('/privacy-policy')}>Privacy information</Button></View>;
  return <PrivacyControls key={user.id} owner={user.id}/>;
}
