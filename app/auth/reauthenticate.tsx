import { AuthScreen } from '@/components/ui/screen';
import { useEffect,useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Redirect,router,useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function Reauthenticate() {
  const {returnTo}=useLocalSearchParams<{returnTo?:string}>();const destination=returnTo==='/notifications'?'/notifications':'/privacy';
  const {user,loading,reauthenticate,signOut}=useAuth();const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active')setPassword('');});return()=>listener.remove();},[]);
  const verify=async()=>{
    if(!user?.email)return;setBusy(true);setMessage('');
    try{await reauthenticate(password);if(destination==='/notifications')router.replace({pathname:'/auth/security',params:{returnTo:destination}});else router.replace(destination);}
    catch{setMessage('Unable to verify your password. Check it and try again.');}
    finally{setPassword('');setBusy(false);}
  };
  if(loading&&!busy)return <View/>;
  if(!user)return <Redirect href={{pathname:'/(auth)/login',params:{redirect:destination}}}/>;
  return <AuthScreen title="Verify your identity" subtitle="Enter your password again to continue. If you use an authenticator, verify that too.">
    <Input accessibilityLabel="Current password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} editable={!busy}/>
    {message?<Text accessibilityRole="alert">{message}</Text>:null}
    <Button isLoading={busy} onPress={()=>{void verify();}}>Verify password</Button>
    <Button variant="ghost" disabled={busy} onPress={()=>router.replace(destination)}>Cancel</Button>
    <Button variant="ghost" disabled={busy} onPress={()=>{void signOut().then(()=>router.replace('/auth/forgot-password'));}}>Forgot password?</Button>
  </AuthScreen>;
}
