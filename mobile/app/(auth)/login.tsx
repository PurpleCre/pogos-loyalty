import { useState } from 'react';
import { View, Text, Alert, Image } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;
        Alert.alert('Success', 'Check your email for the confirmation link!');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        router.replace('/(app)/dashboard');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-8 justify-center">
      <Stack.Screen options={{ headerShown: false }} />
      
      <View className="mb-8 items-center">
        <Text className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</Text>
        <Text className="text-slate-500 text-center">
          {isSignUp ? "Create an account to start earning" : "Sign in to access your rewards"}
        </Text>
      </View>

      <View className="space-y-4">
        <Input
          placeholder="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        
        <Button 
          onPress={handleSubmit} 
          isLoading={isSubmitting || loading}
          className="mt-4"
        >
          {isSignUp ? "Create Account" : "Sign In"}
        </Button>

        <Button 
          variant="ghost" 
          onPress={() => setIsSignUp(!isSignUp)}
          className="mt-2"
        >
          {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
        </Button>
      </View>
    </View>
  );
}
