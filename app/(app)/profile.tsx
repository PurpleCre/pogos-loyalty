import { Screen, PageHeading, Card, ActionRow, EmptyState, SectionHeading } from '@/components/ui/screen';
import { colors } from '@/lib/theme';
import { FileLock2, LifeBuoy, ReceiptText, Store } from 'lucide-react-native';
import { View, Text, Alert, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { User, Save, Trophy, Share2, Shield, Bell, ChevronRight, Menu, LogIn, Edit2, X, Zap, Link2, Unlink, CheckCircle } from 'lucide-react-native';

const EMOJI_AVATARS = ['🍔', '🍕', '🍟', '🍦', '☕️', '🦊', '🐼', '🦁', '🚀', '👑', '💎', '👻', '👽'];

export default function Profile() {
  const { user, userRole, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [avatar, setAvatar] = useState(user?.user_metadata?.avatar || '');
  const [loading, setLoading] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const handleUpdate = async () => {
    setLoading(true); setProfileMessage('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, avatar: avatar }
      });
      
      if (error) throw error;
      setProfileMessage('Your profile changes are saved.');
      Alert.alert("Success", "Profile updated successfully");
    } catch (error: any) {
      setProfileMessage('We couldn’t save your profile. Check your connection and try again.');
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) Alert.alert('Sign-out needs checking', 'We could not confirm all session cleanup. Check your connection and sign out again before sharing this device.');
    router.replace('/(auth)/login');
  };

  const navigation = useNavigation();

  if (!user) return <Screen title="Your account" centered><EmptyState icon={User} title="Make yourself at home." description="Sign in to keep your orders, points and rewards together." action="Sign in or create an account" onAction={() => router.push('/(auth)/login')} /><Button variant="ghost" onPress={() => router.push('/store-picker')}>Browse the menu</Button></Screen>;
  return <Screen title="Your account">
    <PageHeading eyebrow="YOUR POGO’S" title="A place for your favourites." subtitle="Manage your profile, account and preferences." />
    <Card><View className="flex-row items-center gap-4 mb-6"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose profile avatar" onPress={() => setShowAvatarPicker(true)} className="w-20 h-20 bg-brand-50 border border-brand-100 rounded-3xl items-center justify-center">
      {avatar ? <Text style={{ fontSize: 36 }}>{avatar}</Text> : <User size={32} color={colors.primary} />}
    </TouchableOpacity><View className="flex-1"><Text className="text-xl text-ink font-bold">{fullName || 'Your Pogo’s account'}</Text><Text className="text-subtle text-sm mt-2" selectable>{user.email}</Text><Text className="text-brand-800 text-xs mt-2">Tap your avatar to change it</Text></View></View>
      <Text className="text-sm font-semibold text-ink mb-2">Full name</Text><Input accessibilityLabel="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" autoCapitalize="words" />
      <Button onPress={handleUpdate} isLoading={loading} className="mt-4">Save profile changes</Button>
      {profileMessage ? <Text accessibilityRole="alert" className="text-subtle text-sm leading-6 mt-3">{profileMessage}</Text> : null}
    </Card>
    <SectionHeading title="Your account, your way" />
    <Card>
      <ActionRow icon={Shield} title="Account security" detail="Password, authenticator and branch invitations." onPress={() => router.push('/auth/security')} />
      <ActionRow icon={Bell} title="Order and loyalty updates" detail="Your inbox and device notification preferences." onPress={() => router.push('/notifications')} />
      <ActionRow icon={FileLock2} title="Privacy and account data" detail="Preferences, exports and deletion requests." onPress={() => router.push('/privacy')} />
      <ActionRow icon={LifeBuoy} title="Help and support" detail="Get help with an order or your account." onPress={() => router.push('/support')} />
    </Card>
    {['admin', 'manager', 'finance', 'staff'].includes(userRole) || isAdmin ? <><SectionHeading title="Your workspace" /><Card>
      {['admin', 'manager', 'finance'].includes(userRole) ? <ActionRow icon={ReceiptText} title="Cash and till reports" detail="Branch reports and reconciliation." onPress={() => router.push('/finance')} /> : null}
      {['admin', 'manager', 'staff'].includes(userRole) ? <ActionRow icon={Store} title="Branch workspace" onPress={() => router.push('/(app)/staff-dashboard')} /> : null}
      {isAdmin ? <ActionRow icon={Shield} title="Administration" detail="Catalogue, branch and access management." onPress={() => router.push('/(app)/admin')} /> : null}
    </Card></> : null}
    <SectionHeading title="Account details" />
    <Card><Text className="text-subtle text-xs mb-1">ACCOUNT REFERENCE</Text><Text selectable className="text-ink text-sm leading-6">{user.id}</Text>
      <View className="flex-row justify-between flex-wrap gap-3 mt-4 border-t border-line pt-4"><View><Text className="text-subtle text-xs">Member since</Text><Text className="text-ink font-semibold mt-1">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unconfirmed'}</Text></View><View><Text className="text-subtle text-xs">Last sign-in</Text><Text className="text-ink font-semibold mt-1">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Unconfirmed'}</Text></View></View>
    </Card>
    <Text className="text-subtle text-sm leading-6 mb-5">In-store account linking is not available yet. Check with your Pogo’s branch about your loyalty account.</Text>
    <Button variant="outline" textClassName="text-red-700" onPress={handleSignOut}>Sign out</Button>
    <Modal visible={showAvatarPicker} animationType="slide" onRequestClose={() => setShowAvatarPicker(false)}>
      <Screen title="Choose your avatar" onBack={() => setShowAvatarPicker(false)}><PageHeading title="A little personality." subtitle="Pick an avatar, then save your profile to keep it." />
        <View className="flex-row flex-wrap justify-center gap-3">{EMOJI_AVATARS.map(emoji => <TouchableOpacity key={emoji} accessibilityRole="button" accessibilityLabel={`Choose ${emoji} avatar`} accessibilityState={{ selected: avatar === emoji }} onPress={() => { setAvatar(emoji); setShowAvatarPicker(false); }} className={`w-20 h-20 items-center justify-center rounded-3xl border ${avatar === emoji ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}><Text style={{ fontSize: 34 }}>{emoji}</Text></TouchableOpacity>)}</View>
        <Button variant="outline" className="mt-6" onPress={() => { setAvatar(''); setShowAvatarPicker(false); }}>Use the default avatar</Button>
      </Screen>
    </Modal>
  </Screen>;
}
