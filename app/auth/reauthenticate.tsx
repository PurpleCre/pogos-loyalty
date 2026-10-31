import { useEffect,useState } from 'react';
import { AppState,Text,View } from 'react-native';
import { Redirect,router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function Reauthenticate() {
  const {user,loading,reauthenticate,signOut}=useAuth();const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active')setPassword('');});return()=>listener.remove();},[]);
  const verify=async()=>{
    if(!user?.email)return;setBusy(true);setMessage('');
    try{await reauthenticate(password);router.replace('/privacy');}
    catch{setMessage('Unable to verify your password. Check it and try again.');}
    finally{setPassword('');setBusy(false);}
  };
  if(loading&&!busy)return <View/>;
  if(!user)return <Redirect href="/(auth)/login?redirect=/privacy"/>;
  return <View className="flex-1 justify-center p-6 bg-white gap-4">
    <Text className="text-2xl font-bold">Verify your identity</Text><Text>Enter your password again before exporting account data or requesting deletion. If you use an authenticator, verify that too.</Text>
    <Input accessibilityLabel="Current password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} editable={!busy}/>
    {message?<Text accessibilityRole="alert">{message}</Text>:null}
    <Button isLoading={busy} onPress={()=>{void verify();}}>Verify password</Button>
    <Button variant="ghost" disabled={busy} onPress={()=>router.replace('/privacy')}>Cancel</Button>
    <Button variant="ghost" disabled={busy} onPress={()=>{void signOut().then(()=>router.replace('/auth/forgot-password'));}}>Forgot password?</Button>
  </View>;
}
