import { useEffect,useState } from 'react';
import { ScrollView,Text,View,Linking } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { privacyNoticeSchema } from '@/lib/privacy';
import contact from '@/config/privacy-contact.json';
import { Button } from '@/components/ui/button';
export default function PrivacyPolicy() {
  const [notice,setNotice]=useState<ReturnType<typeof privacyNoticeSchema.parse>|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{let active=true;void supabase.from('privacy_notices').select('version,controller_name,body,support_email,approved_at').then(({data,error})=>{
    if(!active)return;if(error){setError(true);return;}const parsed=privacyNoticeSchema.safeParse(data?.[0]);if(parsed.success)setNotice(parsed.data);
  });return()=>{active=false;};},[]);
  const email=notice?.support_email??contact.supportEmail;
  return <ScrollView className="flex-1 bg-white" contentContainerStyle={{padding:24,paddingTop:64,gap:16}}>
    <Text className="text-2xl font-bold">Pogo’s privacy information</Text>
    {notice?<><Text className="font-bold">{notice.controller_name} · Notice {notice.version}</Text><Text selectable>{notice.body}</Text></>:<Text>{error?'The privacy notice could not be loaded. Please contact us for a copy.':'Pogo’s full privacy notice is being prepared. Contact us for privacy questions before sharing information you are unsure about.'}</Text>}
    <Text selectable>Privacy contact: {email}</Text>
    <Button onPress={()=>{void Linking.openURL(`mailto:${encodeURIComponent(email)}?subject=Pogo%27s%20privacy%20request`).catch(()=>setError(true));}}>Email the privacy contact</Button>
    <Button variant="outline" onPress={()=>router.push('/account-deletion')}>Account deletion information</Button>
    <Button variant="ghost" onPress={()=>router.push('/privacy')}>Manage my account data</Button>
  </ScrollView>;
}
