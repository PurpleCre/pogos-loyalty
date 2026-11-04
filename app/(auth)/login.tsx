import { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react-native';
import { safeAuthDestination } from '@/lib/identity';
import { AuthScreen } from '@/components/ui/screen';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const { signIn, signUp, resendConfirmation, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { redirect } = useLocalSearchParams<{ redirect: string }>();

  const handleSubmit = async () => {
    setFormMessage('');
    if (!email || !password) {
      setFormMessage('Enter your email and password to continue.');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignUp && !fullName) {
      setFormMessage('Enter your full name to create your account.');
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const { error, session } = await signUp(email, password, fullName);
        if (error) throw error;
        if (session) { router.replace('/(app)/dashboard'); return; }
        setFormMessage('Your account was created. Check your email to verify it before signing in.');
        Alert.alert('Account created!', 'Please check your email to verify your account.');
        setIsSignUp(false);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        router.replace(safeAuthDestination(redirect) as '/(app)/dashboard');
      }
    } catch (error: any) {
      setFormMessage(isSignUp ? 'Use a valid email and a password of 12–128 characters. Check your connection and try again.' : 'Unable to sign in. Check your email, password, confirmation email and connection.');
      Alert.alert(
        isSignUp ? 'Error signing up' : 'Error signing in', 
        isSignUp ? 'Use a valid email and a password of 12–128 characters. Check your connection and try again.' : 'Unable to sign in. Check your email, password, confirmation email and connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setFormMessage('');
    setIsSignUp(!isSignUp);
    setFullName('');
    setEmail('');
    setPassword('');
  };

  return <AuthScreen title={isSignUp ? 'Your next chapter starts here.' : 'Welcome back.'}
    subtitle={isSignUp ? 'Create your Pogo’s account to keep your orders and loyalty in one place.' : 'Sign in for your orders, points and branch rewards.'}>
    <Stack.Screen options={{ headerShown: false }} />
    {isSignUp ? <View><Text className="text-ink text-sm font-semibold mb-2">Full name</Text><Input accessibilityLabel="Full name" placeholder="Your name" autoCapitalize="words" value={fullName} onChangeText={setFullName} editable={!isSubmitting} /></View> : null}
    <View><Text className="text-ink text-sm font-semibold mb-2">Email address</Text><Input accessibilityLabel="Email address" placeholder="you@example.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!isSubmitting} /></View>
    <View><Text className="text-ink text-sm font-semibold mb-2">Password</Text><View className="relative justify-center">
      <Input accessibilityLabel="Password" placeholder="Your password" secureTextEntry={!showPassword} autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChangeText={setPassword} className="pr-14" editable={!isSubmitting} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} className="absolute right-1 h-12 w-12 items-center justify-center">
        {showPassword ? <EyeOff size={20} color="#596c63" /> : <Eye size={20} color="#596c63" />}
      </TouchableOpacity>
    </View>{isSignUp ? <Text className="text-subtle text-xs mt-2 leading-5">Use a password between 12 and 128 characters.</Text> : null}</View>
    {formMessage ? <Text accessibilityRole="alert" className="text-brand-900 bg-brand-50 rounded-2xl p-4 text-sm leading-6">{formMessage}</Text> : null}
    <Button onPress={handleSubmit} isLoading={isSubmitting || loading}>{isSignUp ? 'Create account' : 'Sign in'}</Button>
    {!isSignUp ? <>
      <Button variant="ghost" disabled={isSubmitting} onPress={() => router.push('/auth/forgot-password')}>Forgot your password?</Button>
      <Button variant="ghost" disabled={isSubmitting || !email.trim()} onPress={() => {
        setIsSubmitting(true);
        void resendConfirmation(email).then(() => { setFormMessage('If confirmation is needed, an email is on its way. Open it on this device.'); Alert.alert('Check your inbox', 'If confirmation is needed, an email is on its way. Open it on this device.'); })
          .catch(() => { setFormMessage('Check the email and connection, or wait before trying again.'); Alert.alert('Unable to resend', 'Check the email and connection, or wait before trying again.'); }).finally(() => setIsSubmitting(false));
      }}>Resend confirmation email</Button>
    </> : null}
    <View className="border-t border-line pt-4"><Text className="text-subtle text-center leading-6">{isSignUp ? 'Already part of Pogo’s?' : 'New around here?'}</Text>
      <Button variant="ghost" onPress={toggleMode} disabled={isSubmitting}>{isSignUp ? 'Sign in instead' : 'Create your account'}</Button>
    </View>
    <Button variant="outline" onPress={() => router.push('/store-picker')}>Browse the menu first</Button>
  </AuthScreen>;
}
