import { View, Text, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { User, Save, Trophy, Share2, Shield, Bell, ChevronRight, Menu, LogIn } from 'lucide-react-native';

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

  const navigation = useNavigation();

  if (!user) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center p-6">
        <View className="absolute top-12 left-4">
          <TouchableOpacity 
            onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
            className="p-2 bg-white rounded-full shadow-sm"
          >
            <Menu size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>
        <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-6">
          <User size={32} color="#dc2626" />
        </View>
        <Text className="text-2xl font-bold text-slate-800 mb-2">Welcome to Pogo's</Text>
        <Text className="text-slate-500 text-center mb-8">Sign in or create an account to manage your profile and view your rewards.</Text>
        <TouchableOpacity 
          onPress={() => router.push('/(auth)/login')}
          className="bg-red-600 w-full py-4 rounded-xl flex-row items-center justify-center shadow-md"
        >
          <LogIn size={20} color="white" className="mr-2" />
          <Text className="text-white font-bold text-lg">Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="absolute top-12 left-4 z-10">
        <TouchableOpacity 
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          className="p-2 bg-white rounded-full shadow-sm border border-slate-100"
        >
          <Menu size={20} color="#1f2937" />
        </TouchableOpacity>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingTop: 40, flexGrow: 1 }}>
      {/* Profile Header */}
      <View className="items-center py-6">
        <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
          <User size={32} color="#dc2626" />
        </View>
        <Text className="text-2xl font-bold text-slate-800">My Profile</Text>
        <Text className="text-slate-400">Manage your account information</Text>
      </View>

      {/* Profile Information Card */}
      <View className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
        <View className="px-5 pt-5 pb-2">
          <Text className="text-lg font-bold text-slate-800 mb-4">Profile Information</Text>
        </View>
        <View className="px-5 pb-5">
          <View className="mb-4">
            <Text className="text-sm font-medium text-slate-500 mb-1.5">Email</Text>
            <View className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
              <Text className="text-slate-400">{user?.email}</Text>
            </View>
            <Text className="text-xs text-slate-400 mt-1.5">
              Email cannot be changed. Contact support if needed.
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-slate-500 mb-1.5">Full Name</Text>
            <Input 
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
            />
          </View>

          <Button onPress={handleUpdate} isLoading={loading} className="flex-row gap-2">
            <Save size={16} color="white" />
            <Text className="text-white font-semibold">{loading ? 'Saving...' : 'Save Changes'}</Text>
          </Button>
        </View>
      </View>

      {/* Account Details Card */}
      <View className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
        <View className="px-5 pt-5 pb-2">
          <Text className="text-lg font-bold text-slate-800 mb-2">Account Details</Text>
        </View>
        <View className="px-5 pb-5">
          <View className="flex-row justify-between items-center py-3 border-b border-slate-100">
            <Text className="text-sm font-medium text-slate-600">User ID</Text>
            <Text className="text-sm text-slate-400 font-mono" numberOfLines={1} style={{ maxWidth: 140 }}>
              {user?.id?.slice(0, 8)}...
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-3 border-b border-slate-100">
            <Text className="text-sm font-medium text-slate-600">Account Created</Text>
            <Text className="text-sm text-slate-400">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-3">
            <Text className="text-sm font-medium text-slate-600">Last Sign In</Text>
            <Text className="text-sm text-slate-400">
              {user?.last_sign_in_at 
                ? new Date(user.last_sign_in_at).toLocaleDateString() 
                : 'Never'}
            </Text>
          </View>
        </View>
      </View>

      {/* Features Card */}
      <View className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
        <View className="px-5 pt-5 pb-2">
          <Text className="text-lg font-bold text-slate-800 mb-2">Features</Text>
        </View>
        <View className="px-5 pb-5 gap-2">
          <TouchableOpacity 
            onPress={() => router.push('/(app)/achievements')}
            className="flex-row items-center p-4 bg-slate-50 rounded-xl border border-slate-100"
            activeOpacity={0.7}
          >
            <View className="w-9 h-9 bg-red-100 rounded-lg items-center justify-center mr-3">
              <Trophy size={18} color="#dc2626" />
            </View>
            <Text className="flex-1 font-medium text-slate-700">My Achievements</Text>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(app)/referrals')}
            className="flex-row items-center p-4 bg-slate-50 rounded-xl border border-slate-100"
            activeOpacity={0.7}
          >
            <View className="w-9 h-9 bg-red-100 rounded-lg items-center justify-center mr-3">
              <Share2 size={18} color="#dc2626" />
            </View>
            <Text className="flex-1 font-medium text-slate-700">Refer a Friend</Text>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity 
              onPress={() => router.push('/(app)/admin')}
              className="flex-row items-center p-4 bg-red-50 rounded-xl border border-red-100"
              activeOpacity={0.7}
            >
              <View className="w-9 h-9 bg-red-100 rounded-lg items-center justify-center mr-3">
                <Shield size={18} color="#dc2626" />
              </View>
              <Text className="flex-1 font-bold text-red-900">Admin Panel</Text>
              <ChevronRight size={18} color="#dc2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sign Out */}
      <View className="mt-2 mb-8">
        <TouchableOpacity 
          onPress={handleSignOut} 
          className="border border-red-200 bg-white rounded-xl py-3.5 items-center"
          activeOpacity={0.7}
        >
          <Text className="text-red-500 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  );
}
