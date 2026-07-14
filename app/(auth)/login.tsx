import { useState } from 'react';
import { View, Text, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, loading } = useAuth();
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
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        Alert.alert('Account created!', 'Please check your email to verify your account.');
        setIsSignUp(false);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        if (redirect) {
          router.replace(redirect as any);
        } else {
          router.replace('/(app)/dashboard');
        }
      }
    } catch (error: any) {
      Alert.alert(
        isSignUp ? 'Error signing up' : 'Error signing in', 
        error.message
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
            <View className="w-16 h-16 bg-red-100 rounded-2xl items-center justify-center mb-4 shadow-sm">
              <Text className="text-3xl">🍔</Text>
            </View>
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
              <Input
                placeholder="Enter your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {isSignUp && (
                <Text className="text-xs text-slate-400 mt-1.5">
                  Password must be at least 6 characters long
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
