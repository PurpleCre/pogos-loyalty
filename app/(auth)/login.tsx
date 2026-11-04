import { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react-native';
import { safeAuthDestination } from '@/lib/identity';
import { BrandLogo } from '@/components/BrandLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, resendConfirmation, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { redirect } = useLocalSearchParams<{ redirect: string }>();

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignUp && !fullName) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const { error, session } = await signUp(email, password, fullName);
        if (error) throw error;
        if (session) { router.replace('/(app)/dashboard'); return; }
        Alert.alert('Account created!', 'Please check your email to verify your account.');
        setIsSignUp(false);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        router.replace(safeAuthDestination(redirect) as '/(app)/dashboard');
      }
    } catch (error: any) {
      Alert.alert(
        isSignUp ? 'Error signing up' : 'Error signing in', 
        isSignUp ? 'Use a valid email and a password of 12–128 characters. Check your connection and try again.' : 'Unable to sign in. Check your email, password, confirmation email and connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setFullName('');
    setEmail('');
    setPassword('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView 
        className="flex-1 bg-red-50"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ headerShown: false }} />

        {/* Card Container */}
        <View className="bg-white rounded-3xl shadow-lg overflow-hidden">
          {/* Header */}
          <View className="items-center pt-8 pb-4 px-6">
            {/* Logo */}
            <View className="items-center justify-center mb-4"><BrandLogo size={100} /></View>
            <Text className="text-2xl font-bold text-slate-900 mb-1">
              {isSignUp ? 'Create account' : 'Welcome back'}
            </Text>
            <Text className="text-slate-500 text-center text-sm">
              {isSignUp 
                ? 'Sign up for a new account to start earning rewards' 
                : 'Sign in to your account to continue earning points'
              }
            </Text>
          </View>

          {/* Form */}
          <View className="px-6 pb-6 pt-2">
            {isSignUp && (
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 mb-1.5">Full Name</Text>
                <Input
                  placeholder="Enter your full name"
                  autoCapitalize="words"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            )}

            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-700 mb-1.5">Email</Text>
              <Input
                placeholder="Enter your email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View className="mb-2">
              <Text className="text-sm font-medium text-slate-700 mb-1.5">Password</Text>
              <View className="relative justify-center">
                <Input
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  className="pr-12"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-3 items-center justify-center h-full"
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#94a3b8" />
                  ) : (
                    <Eye size={20} color="#94a3b8" />
                  )}
                </TouchableOpacity>
              </View>
              {isSignUp && (
                <Text className="text-xs text-slate-400 mt-1.5">
                  Use a password between 12 and 128 characters
                </Text>
              )}
            </View>

            <Button 
              onPress={handleSubmit} 
              isLoading={isSubmitting || loading}
              className="mt-4 bg-red-600 rounded-xl h-12"
              textClassName="text-white"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>

            {!isSignUp ? <>
              <Button variant="ghost" disabled={isSubmitting} onPress={() => router.push('/auth/forgot-password')}>Forgot password?</Button>
              <Button variant="ghost" disabled={isSubmitting || !email.trim()} onPress={() => {
                setIsSubmitting(true);
                void resendConfirmation(email).then(() => Alert.alert('Check your inbox', 'If confirmation is needed, an email is on its way. Open it on this device.'))
                  .catch(() => Alert.alert('Unable to resend', 'Check the email and connection, or wait before trying again.')).finally(() => setIsSubmitting(false));
              }}>Resend confirmation email</Button>
            </> : null}

            <TouchableOpacity 
              onPress={toggleMode}
              className="mt-4 items-center py-2"
            >
              <Text className="text-sm text-slate-500">
                {isSignUp 
                  ? 'Already have an account? ' 
                  : "Don't have an account? "
                }
                <Text className="text-red-600 font-semibold">
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
