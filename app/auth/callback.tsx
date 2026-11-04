import { AuthScreen } from '@/components/ui/screen';
import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { completeCallback, signOut } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return; started.current = true;
    void (async () => {
      try { const result = await completeCallback(params); router.replace(result === 'recovery' ? '/auth/reset-password' : '/(app)/dashboard'); }
      catch { setError('This link is invalid, expired or belongs to another device. Request a new email on this device.'); }
    })();
  }, [completeCallback, params]);
  return <AuthScreen title="Confirming your email" subtitle="A moment while we check your account link.">
    {error ? <><Text accessibilityRole="alert">{error}</Text><Button onPress={() => { void signOut().then(result => { if (result.error) setError('Unable to confirm session cleanup. Please retry before using another account.'); else router.replace('/(auth)/login'); }); }}>Return to sign in</Button></> : <ActivityIndicator accessibilityLabel="Confirming email" />}
  </AuthScreen>;
}
