import { View, Text, Alert, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useGaapIntegration } from '@/hooks/useGaapIntegration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { User, Save, Trophy, Share2, Shield, Bell, ChevronRight, Menu, LogIn, Edit2, X, Zap, Link2, Unlink, CheckCircle } from 'lucide-react-native';

const EMOJI_AVATARS = ['🍔', '🍕', '🍟', '🍦', '☕️', '🦊', '🐼', '🦁', '🚀', '👑', '💎', '👻', '👽'];

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { customerLink, isLinked, linkLoading, linkAccount, unlinkAccount } = useGaapIntegration();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [avatar, setAvatar] = useState(user?.user_metadata?.avatar || '');
  const [loading, setLoading] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showGaapLink, setShowGaapLink] = useState(false);
  const [gaapPhone, setGaapPhone] = useState('');
  const [gaapLinking, setGaapLinking] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, avatar: avatar }
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
      {/* Sleek Header */}
      <View className="bg-red-600 pt-14 pb-6 px-4 rounded-b-3xl flex-row items-center">
        <TouchableOpacity 
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          className="w-10 h-10 items-center justify-center -ml-2"
        >
          <Menu size={28} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold flex-1 ml-2">My Profile</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}>
      {/* Profile Avatar */}
      <View className="items-center -mt-12 mb-6 z-20">
        <TouchableOpacity 
          onPress={() => setShowAvatarPicker(true)}
          activeOpacity={0.8}
        >
          <View className="w-24 h-24 bg-white rounded-full items-center justify-center shadow-md border-4 border-slate-50 relative">
            <View className="w-full h-full bg-red-50 rounded-full items-center justify-center">
              {avatar ? (
                <Text style={{ fontSize: 40 }}>{avatar}</Text>
              ) : (
                <User size={36} color="#dc2626" />
              )}
            </View>
            <View className="absolute bottom-0 right-0 bg-red-600 rounded-full p-1.5 border-2 border-white shadow-sm">
              <Edit2 size={12} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-800 mt-3">{fullName || 'Loyal Customer'}</Text>
        <Text className="text-slate-500 font-medium">{user?.email}</Text>
      </View>

      {/* Profile Information Card */}
      <View className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-5 overflow-hidden">
        <View className="px-5 pt-5 pb-3">
          <Text className="text-lg font-bold text-slate-800">Profile Information</Text>
        </View>
        <View className="px-5 pb-5">
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-700 mb-1.5">Full Name</Text>
            <Input 
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              className="bg-slate-50 border border-slate-200"
            />
          </View>

          <Button onPress={handleUpdate} isLoading={loading} className="bg-red-600 rounded-xl h-12 flex-row justify-center items-center">
            {!loading && <Save size={18} color="white" className="mr-2" />}
            <Text className="text-white font-bold text-base">{loading ? 'Saving...' : 'Save Changes'}</Text>
          </Button>
        </View>
      </View>

      {/* Account Details Card */}
      <View className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-5 overflow-hidden">
        <View className="px-5 pt-5 pb-2">
          <Text className="text-lg font-bold text-slate-800 mb-2">Account Details</Text>
        </View>
        <View className="px-5 pb-5">
          <View className="flex-row justify-between items-center py-3 border-b border-slate-50">
            <Text className="text-sm font-semibold text-slate-600">User ID</Text>
            <Text className="text-sm text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded-md" numberOfLines={1} style={{ maxWidth: 140 }}>
              {user?.id?.slice(0, 8)}...
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-3 border-b border-slate-50">
            <Text className="text-sm font-semibold text-slate-600">Account Created</Text>
            <Text className="text-sm text-slate-500 font-medium">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-3">
            <Text className="text-sm font-semibold text-slate-600">Last Sign In</Text>
            <Text className="text-sm text-slate-500 font-medium">
              {user?.last_sign_in_at 
                ? new Date(user.last_sign_in_at).toLocaleDateString() 
                : 'Never'}
            </Text>
          </View>
        </View>
      </View>

      {/* GAAP POS Link Card */}
      <View className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-5 overflow-hidden">
        <View className="px-5 pt-5 pb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Zap size={18} color="#2563eb" />
            <Text className="text-lg font-bold text-slate-800">In-Store Points</Text>
          </View>
          {isLinked && (
            <View className="flex-row items-center gap-1 bg-emerald-100 px-2 py-1 rounded-full">
              <CheckCircle size={12} color="#10b981" />
              <Text className="text-xs font-bold text-emerald-700">Linked</Text>
            </View>
          )}
        </View>
        <View className="px-5 pb-5">
          {linkLoading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : isLinked ? (
            <View>
              <Text className="text-slate-500 text-sm mb-3">
                Your account is linked to GAAP POS. You earn points automatically when you make in-store purchases!
              </Text>
              {customerLink?.gaap_customer_phone && (
                <Text className="text-xs text-slate-400 mb-3">Phone: {customerLink.gaap_customer_phone}</Text>
              )}
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Unlink Account',
                    'You will stop earning automatic points from in-store purchases. You can still scan QR codes.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Unlink',
                        style: 'destructive',
                        onPress: async () => {
                          const result = await unlinkAccount();
                          if (result.error) Alert.alert('Error', result.error);
                          else Alert.alert('Unlinked', 'Your GAAP account has been unlinked.');
                        },
                      },
                    ]
                  );
                }}
                className="flex-row items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200"
              >
                <Unlink size={16} color="#64748b" />
                <Text className="text-slate-600 font-medium text-sm ml-2">Unlink Account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-slate-500 text-sm mb-3">
                Link your account to earn points automatically every time you buy at Pogo's — no scanning needed!
              </Text>
              <TouchableOpacity
                onPress={() => setShowGaapLink(true)}
                className="flex-row items-center justify-center p-3 bg-blue-600 rounded-xl"
                activeOpacity={0.7}
              >
                <Link2 size={16} color="#fff" />
                <Text className="text-white font-bold text-sm ml-2">Link to POS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Features Card */}
      <View className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-5 overflow-hidden">
        <View className="px-5 pt-5 pb-3">
          <Text className="text-lg font-bold text-slate-800">Features</Text>
        </View>
        <View className="px-5 pb-5 space-y-3">
          <TouchableOpacity 
            onPress={() => router.push('/(app)/achievements')}
            className="flex-row items-center p-4 bg-slate-50 rounded-2xl border border-slate-100"
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center mr-3">
              <Trophy size={20} color="#10b981" />
            </View>
            <Text className="flex-1 font-bold text-slate-800">My Achievements</Text>
            <ChevronRight size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(app)/referrals')}
            className="flex-row items-center p-4 bg-slate-50 rounded-2xl border border-slate-100"
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3">
              <Share2 size={20} color="#3b82f6" />
            </View>
            <Text className="flex-1 font-bold text-slate-800">Refer a Friend</Text>
            <ChevronRight size={20} color="#cbd5e1" />
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity 
              onPress={() => router.push('/(app)/admin')}
              className="flex-row items-center p-4 bg-red-50 rounded-2xl border border-red-100"
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-3">
                <Shield size={20} color="#dc2626" />
              </View>
              <Text className="flex-1 font-bold text-red-700">Admin Panel</Text>
              <ChevronRight size={20} color="#fca5a5" />
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

    {/* Avatar Picker Modal */}
    <Modal visible={showAvatarPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAvatarPicker(false)}>
      <View className="flex-1 bg-slate-50 pt-6 px-5">
        <View className="flex-row items-center justify-between mb-8">
          <Text className="text-2xl font-bold text-slate-800">Choose Avatar</Text>
          <TouchableOpacity onPress={() => setShowAvatarPicker(false)} className="p-2 bg-slate-200 rounded-full">
            <X size={20} color="#475569" />
          </TouchableOpacity>
        </View>
        
        <View className="flex-row flex-wrap justify-center gap-4">
          {EMOJI_AVATARS.map((emoji) => (
            <TouchableOpacity 
              key={emoji}
              onPress={() => {
                setAvatar(emoji);
                setShowAvatarPicker(false);
              }}
              className={`w-20 h-20 items-center justify-center rounded-2xl border-2 ${avatar === emoji ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white'}`}
            >
              <Text style={{ fontSize: 36 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          
          {/* Option to clear avatar */}
          <TouchableOpacity 
            onPress={() => {
              setAvatar('');
              setShowAvatarPicker(false);
            }}
            className={`w-20 h-20 items-center justify-center rounded-2xl border-2 ${!avatar ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white'}`}
          >
            <User size={36} color={!avatar ? "#dc2626" : "#94a3b8"} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    {/* GAAP Link Modal */}
    <Modal visible={showGaapLink} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-xl font-bold text-slate-900">Link to POS</Text>
              <Text className="text-slate-500 text-sm mt-1">Earn points automatically on every purchase</Text>
            </View>
            <TouchableOpacity onPress={() => setShowGaapLink(false)}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-slate-700 mb-1">Phone Number *</Text>
            <TextInput
              value={gaapPhone}
              onChangeText={setGaapPhone}
              placeholder="+27 12 345 6789"
              keyboardType="phone-pad"
              className="bg-slate-100 rounded-xl px-4 py-3 text-slate-900"
              placeholderTextColor="#9ca3af"
            />
            <Text className="text-xs text-slate-400 mt-1">
              Enter the phone number you use at Pogo's counter. This links your purchases to your app account.
            </Text>
          </View>

          <View className="bg-blue-50 rounded-xl p-4 mb-5 border border-blue-100">
            <Text className="text-blue-800 text-xs leading-5">
              ⚡ Once linked, every time you pay at any Pogo's store, your points will appear in the app automatically — no scanning required!
            </Text>
          </View>

          <TouchableOpacity
            onPress={async () => {
              if (!gaapPhone.trim()) {
                Alert.alert('Error', 'Please enter your phone number.');
                return;
              }
              setGaapLinking(true);
              // Use phone as the GAAP customer ID for now
              const result = await linkAccount(gaapPhone.trim(), gaapPhone.trim());
              setGaapLinking(false);
              if (result.error) {
                Alert.alert('Error', result.error);
              } else {
                Alert.alert('Linked!', 'Your account is now linked. Points will be earned automatically on your next purchase!');
                setShowGaapLink(false);
                setGaapPhone('');
              }
            }}
            disabled={gaapLinking}
            className="bg-blue-600 rounded-xl py-3.5 items-center mb-4"
          >
            <Text className="text-white font-bold text-base">
              {gaapLinking ? 'Linking...' : 'Link My Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </View>
  );
}
