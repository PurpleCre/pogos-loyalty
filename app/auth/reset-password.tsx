import { useState } from 'react';
import { View, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function ResetPassword() {
  const { user, loading, recoveryRequired, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [finished, setFinished] = useState(false);
  const [otherSessionsRevoked, setOtherSessionsRevoked] = useState(true);
  const save = async () => {
    if (password !== confirmation) { setMessage('Passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try { const result = await updatePassword(password); setOtherSessionsRevoked(result.otherSessionsRevoked); setPassword(''); setConfirmation(''); setFinished(true); }
    catch { setMessage('Use 12–128 characters. If saving still fails, request a new recovery email.'); }
    finally { setBusy(false); }
  };
  if (loading && !finished) return <View />;
  if (!finished && (!user || !recoveryRequired)) return <Redirect href="/auth/forgot-password" />;
  return <View className="flex-1 justify-center p-6 bg-white gap-4">
    <Text className="text-2xl font-bold">{finished ? 'Password updated' : 'Choose a new password'}</Text>
    {finished ? <><Text>Sign in again with your new password.</Text>{!otherSessionsRevoked ? <Text accessibilityRole="alert">We could not confirm sign-out on other devices. Contact support if you suspect someone else has access.</Text> : null}<Button onPress={() => router.replace('/(auth)/login')}>Sign in</Button></> : <>
      <Input accessibilityLabel="New password" placeholder="12–128 characters" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Input accessibilityLabel="Confirm new password" placeholder="Confirm password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" />
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
      <Button isLoading={busy} onPress={() => { void save(); }}>Update password</Button>
      <Button variant="ghost" disabled={busy} onPress={() => { void signOut().then(result => { if (result.error) setMessage('Unable to confirm session cleanup. Please retry.'); else router.replace('/(auth)/login'); }); }}>Cancel and sign out</Button>
    </>}
  </View>;
}
