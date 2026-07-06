import { View, Text, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Trophy, Share2, Shield } from 'lucide-react-native';

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
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
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingTop: 40, flexGrow: 1 }}>
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

      <View className="mb-8 space-y-3">
        <Text className="text-sm font-medium text-slate-700 mb-2">Features</Text>
        
        <TouchableOpacity 
          onPress={() => router.push('/(app)/achievements')}
          className="flex-row items-center p-4 bg-slate-50 rounded-xl border border-slate-100"
        >
          <Trophy size={20} color="#4f46e5" />
          <Text className="ml-3 font-medium text-slate-700">My Achievements</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/(app)/referrals')}
          className="flex-row items-center p-4 bg-slate-50 rounded-xl border border-slate-100"
        >
          <Share2 size={20} color="#4f46e5" />
          <Text className="ml-3 font-medium text-slate-700">Refer a Friend</Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity 
            onPress={() => router.push('/(app)/admin')}
            className="flex-row items-center p-4 bg-indigo-50 rounded-xl border border-indigo-100 mt-2"
          >
            <Shield size={20} color="#4f46e5" />
            <Text className="ml-3 font-bold text-indigo-900">Admin Panel</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="mt-auto">
        <Button variant="outline" onPress={handleSignOut} className="border-red-200">
          <Text className="text-red-500 font-medium">Sign Out</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
