import { AuthScreen } from '@/components/ui/screen';
import { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [sent, setSent] = useState(false);
  const send = async () => {
    setBusy(true); setMessage('');
    try { await requestPasswordReset(email); setSent(true); setMessage('If an account exists, a recovery email is on its way. Open it on this device.'); }
    catch { setMessage('Check your email address and connection, then try again. You may need to wait before requesting another email.'); }
    finally { setBusy(false); }
  };
  return <AuthScreen title="Reset your password" subtitle="Enter your account email. Open the recovery email on this device to choose a new password.">

    <Input accessibilityLabel="Account email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    <Button onPress={() => { void send(); }} isLoading={busy} disabled={sent || !email.trim()}>Send recovery email</Button>
    <Button variant="ghost" onPress={() => router.replace('/(auth)/login')}>Back to sign in</Button>
  </AuthScreen>;
}
