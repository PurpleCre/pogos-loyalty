import { View, Text, Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
      
      if (error) throw error;
      Alert.alert("Success", "Profile updated successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-white p-6 pt-10">
      <View className="items-center mb-8">
        <View className="w-20 h-20 bg-slate-100 rounded-full items-center justify-center mb-4">
          <Text className="text-2xl font-bold text-slate-500">
            {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="text-xl font-bold">{fullName || 'User'}</Text>
        <Text className="text-slate-500">{user?.email}</Text>
      </View>

      <View className="space-y-4 mb-8">
        <Text className="text-sm font-medium text-slate-700">Full Name</Text>
        <Input 
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
        />
        <Button onPress={handleUpdate} isLoading={loading}>
          Update Profile
        </Button>
      </View>

      <View className="mt-auto">
        <Button variant="outline" onPress={handleSignOut} className="border-red-200">
          <Text className="text-red-500 font-medium">Sign Out</Text>
        </Button>
      </View>
    </View>
  );
}
