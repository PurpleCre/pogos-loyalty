import { Screen, PageHeading, EmptyState } from '@/components/ui/screen';
import { View, Text, ScrollView, ActivityIndicator, Modal, Alert, StyleSheet, Platform } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import MapView, { Marker } from '@/components/LocationMap';
import { useAdmin } from '@/hooks/useAdmin';
import type { AppRole } from '@/hooks/useAuth';
import { StaffInvitations } from '@/components/admin/StaffInvitations';
import { PrivacyRequests } from '@/components/admin/PrivacyRequests';
import {
  Shield, Users, Gift, Receipt, LayoutDashboard, Store,
  ClipboardList, UserPlus, X, TrendingUp,
  DollarSign, UserCheck, MapPin, Trophy, Plus, Pencil, Trash2, Image, Zap
} from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { AdminRewards } from '@/components/admin/AdminRewards';
import { AdminOrders } from '@/components/admin/AdminOrders';
import { AdminLoyalty } from '@/components/admin/AdminLoyalty';
import { AdminMenu } from '@/components/admin/AdminMenu';
import { AdminAchievements } from '@/components/admin/AdminAchievements';
import { AdminGaap } from '@/components/admin/AdminGaap';
import { useIsFocused } from 'expo-router/react-navigation';
import { router } from 'expo-router';
import { branchScopedRole } from '@/lib/identity';

export default function AdminScreen() {
  const isFocused = useIsFocused();
  const {
    isAdmin, loading, users, rewards, achievements, transactions, stores, dashboardStats,
    fetchUsers, fetchRewards, fetchAchievements, fetchTransactions, fetchStores, fetchDashboardStats,
    createReward, updateReward, deleteReward,
    createAchievement, updateAchievement, deleteAchievement,
    setUserRole, createStore, updateStore, deleteStore
  } = useAdmin();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'stores' | 'menu' | 'rewards' | 'achievements' | 'orders' | 'transactions' | 'gaap' | 'loyalty' | 'privacy'>('dashboard');

  // Role Change Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('user');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [accessReason, setAccessReason] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);

  // Create Store Modal
  const [showCreateStore, setShowCreateStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreImageUrl, setNewStoreImageUrl] = useState('');
  const [newStoreLocation, setNewStoreLocation] = useState({ latitude: -17.824858, longitude: 31.053028 });
  const [isCreatingStore, setIsCreatingStore] = useState(false);

  // Edit Store Modal
  const [showEditStore, setShowEditStore] = useState(false);
  const [editStoreId, setEditStoreId] = useState('');
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreAddress, setEditStoreAddress] = useState('');
  const [editStoreImageUrl, setEditStoreImageUrl] = useState('');
  const [editStoreLocation, setEditStoreLocation] = useState({ latitude: -17.824858, longitude: 31.053028 });
  const [isSavingStore, setIsSavingStore] = useState(false);

  useEffect(() => {
    if (isAdmin && !loading) {
      fetchUsers();
      fetchRewards();
      fetchAchievements();
      fetchTransactions();
      fetchStores();
      fetchDashboardStats();
    }
  }, [isAdmin, loading]);

  if (!isFocused) return <View />;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#174d45" />
      </View>
    );
  }

  if (!isAdmin) return <Screen title="Administration" centered><EmptyState icon={Shield} title="Administrator access required" description="Verify your assigned administrator account to open this workspace." action="Account security" onAction={() => router.push('/auth/security')} /></Screen>;

  const handleRoleChange = async () => {
    if ((branchScopedRole(selectedRole) && !selectedStoreIds.length) || accessReason.trim().length < 3) {
      Alert.alert('Check access details', 'Select staff branches and provide a reason for this change.'); return;
    }
    setSavingAccess(true);
    try {
      const { error } = await setUserRole(selectedUserId, selectedRole, selectedStoreIds, accessReason.trim());
      if (error) throw error;
      Alert.alert('Access updated', 'Subsequent server requests use the new permissions.'); setShowRoleModal(false);
    } catch { Alert.alert('Unable to update access', 'Check your session, verified account, branch selection and connection. The last administrator cannot be removed.'); }
    finally { setSavingAccess(false); }
  };

  const handleCreateStore = async () => {
    if (!newStoreName || !newStoreAddress) {
      Alert.alert('Missing Fields', 'Please fill in store name and address.');
      return;
    }

    setIsCreatingStore(true);
    const storeData: any = {
      name: newStoreName,
      address: newStoreAddress,
      latitude: newStoreLocation.latitude,
      longitude: newStoreLocation.longitude
    };
    if (newStoreImageUrl.trim()) {
      storeData.image_url = newStoreImageUrl.trim();
    }
    const { error } = await createStore(storeData);
    setIsCreatingStore(false);

    if (error) {
      Alert.alert('Error', 'Failed to create store.');
    } else {
      Alert.alert('Success', 'Store created successfully!');
      setShowCreateStore(false);
      setNewStoreName('');
      setNewStoreAddress('');
      setNewStoreImageUrl('');
    }
  };

  const handleEditStore = (store: any) => {
    setEditStoreId(store.id);
    setEditStoreName(store.name);
    setEditStoreAddress(store.address);
    setEditStoreImageUrl(store.image_url || '');
    setEditStoreLocation({
      latitude: Number(store.latitude) || -17.824858,
      longitude: Number(store.longitude) || 31.053028
    });
    setShowEditStore(true);
  };

  const handleSaveStore = async () => {
    if (!editStoreName || !editStoreAddress) {
      Alert.alert('Missing Fields', 'Please fill in store name and address.');
      return;
    }

    setIsSavingStore(true);
    const updates: any = {
      name: editStoreName,
      address: editStoreAddress,
      image_url: editStoreImageUrl.trim() || null,
      latitude: editStoreLocation.latitude,
      longitude: editStoreLocation.longitude
    };
    const { error } = await updateStore(editStoreId, updates);
    setIsSavingStore(false);

    if (error) {
      Alert.alert('Error', 'Failed to update store.');
    } else {
      Alert.alert('Success', 'Store updated successfully!');
      setShowEditStore(false);
    }
  };

  const handleDeleteStore = (storeId: string, storeName: string) => {
    Alert.alert(
      'Delete Store',
      `Are you sure you want to delete "${storeName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteStore(storeId);
            if (error) {
              Alert.alert('Error', 'Failed to delete store. It may have staff or orders assigned to it.');
            } else {
              Alert.alert('Deleted', 'Store removed successfully.');
            }
          }
        }
      ]
    );
  };

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'stores', label: 'Stores', icon: Store },
    { key: 'orders', label: 'Orders', icon: ClipboardList },
    { key: 'loyalty', label: 'Loyalty review', icon: UserCheck },
    { key: 'privacy', label: 'Privacy requests', icon: Shield },
    { key: 'menu', label: 'Menu', icon: Gift }, // Icon changes inside component if needed
    { key: 'rewards', label: 'Rewards', icon: Gift },
    { key: 'achievements', label: 'Achievements', icon: Trophy },
    { key: 'transactions', label: 'Transact', icon: Receipt },
    { key: 'gaap', label: 'GAAP POS', icon: Zap },
  ] as const;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return { bg: 'bg-brand-100', text: 'text-brand-800' };
      case 'manager': return { bg: 'bg-amber-100', text: 'text-amber-800' };
      case 'finance': return { bg: 'bg-purple-100', text: 'text-purple-700' };
      case 'staff': return { bg: 'bg-blue-100', text: 'text-blue-700' };
      default: return { bg: 'bg-gray-100', text: 'text-subtle' };
    }
  };

  return (
    <Screen title="Administration" wide>
      <PageHeading eyebrow="POGO’S WORKSPACE" title="The bigger picture." subtitle="Manage your catalogue, branches and team. Operational and financial approvals still apply to every change." />
      {/* Tab Bar */}
      <View className="px-4 pt-3 pb-1">
        <ScrollView testID="admin-sections" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                accessibilityState={{ selected: activeTab === tab.key }} className={`px-4 py-3 rounded-2xl border items-center flex-row gap-2 ${activeTab === tab.key ? 'bg-brand-800 border-brand-800' : 'bg-white border-line'}`}
              >
                <TabIcon size={14} color={activeTab === tab.key ? '#ffffff' : '#596c63'} />
                <Text className={`font-semibold text-xs ${activeTab === tab.key ? 'text-white' : 'text-subtle'}`}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View className="mt-5">
        {activeTab === 'loyalty' && <AdminLoyalty users={users} />}
        {activeTab === 'privacy' && <PrivacyRequests />}
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <View className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <Users size={16} color="#174d45" />
                  <Text className="text-subtle text-xs font-medium uppercase">Total Users</Text>
                </View>
                <Text className="text-2xl font-bold text-ink">{dashboardStats.totalUsers}</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <ClipboardList size={16} color="#174d45" />
                  <Text className="text-subtle text-xs font-medium uppercase">Orders Today</Text>
                </View>
                <Text className="text-2xl font-bold text-ink">{dashboardStats.totalOrdersToday}</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <DollarSign size={16} color="#16a34a" />
                  <Text className="text-subtle text-xs font-medium uppercase">Cash and till reports</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" onPress={()=>router.push('/finance')} className="py-2"><Text className="font-bold text-green-700">By branch and currency →</Text></TouchableOpacity>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <UserCheck size={16} color="#2563eb" />
                  <Text className="text-subtle text-xs font-medium uppercase">Active Staff</Text>
                </View>
                <Text className="text-2xl font-bold text-ink">{dashboardStats.activeStaff}</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <MapPin size={16} color="#ea580c" />
                  <Text className="text-subtle text-xs font-medium uppercase">Stores</Text>
                </View>
                <Text className="text-2xl font-bold text-ink">{dashboardStats.totalStores}</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <TrendingUp size={16} color="#f59e0b" />
                  <Text className="text-subtle text-xs font-medium uppercase">Pending</Text>
                </View>
                <Text className="text-2xl font-bold text-amber-500">{dashboardStats.pendingOrders}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <View className="gap-3">
            <StaffInvitations stores={stores} />

            {users.map(u => {
              const badge = getRoleBadgeColor(u.role);
              return (
                <View key={u.id} className="bg-white p-4 rounded-xl border border-line">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="font-bold text-ink">{u.full_name || 'No Name'}</Text>
                      <Text className="text-xs text-subtle mt-0.5">{u.email}</Text>
                    </View>
                    <View className={`px-2 py-1 rounded-full ${badge.bg}`}>
                      <Text className={`text-xs font-bold capitalize ${badge.text}`}>{u.role}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="bg-brand-50 px-2 py-1 rounded">
                      <Text className="text-xs font-semibold text-brand-800">{u.current_points} pts</Text>
                    </View>
                    {branchScopedRole(u.role) && u.staff_store_ids.length > 0 && (
                      <Text className="text-xs text-subtle">
                        Branches: {u.staff_store_ids.map(id => stores.find(s => s.id === id)?.name ?? 'Unknown').join(', ')}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedUserId(u.id);
                      setSelectedRole(u.role as AppRole);
                      setSelectedStoreIds(u.staff_store_ids); setAccessReason('');
                      setShowRoleModal(true);
                    }}
                    className="bg-gray-100 rounded-lg py-2 items-center"
                  >
                    <Text className="text-gray-700 font-medium text-sm">Change Role</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            {users.length === 0 && <Text className="text-center text-subtle py-8">No users found</Text>}
          </View>
        )}

        {/* Stores Tab */}
        {activeTab === 'stores' && (
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => setShowCreateStore(true)}
              className="bg-brand-800 rounded-xl py-3 px-4 flex-row items-center justify-center gap-2 mb-2"
            >
              <Plus size={18} color="white" />
              <Text className="text-white font-bold">Add New Store</Text>
            </TouchableOpacity>

            {stores.map(store => (
              <View key={store.id} className="bg-white p-4 rounded-xl border border-line">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="font-bold text-ink">{store.name}</Text>
                    <Text className="text-sm text-subtle mt-1">{store.address}</Text>
                    {store.image_url ? (
                      <Text className="text-xs text-green-600 mt-1">📷 Image set</Text>
                    ) : (
                      <Text className="text-xs text-subtle mt-1">No image</Text>
                    )}
                  </View>
                  <View className={`px-2 py-1 rounded-full ${store.is_open ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Text className={`text-xs font-bold ${store.is_open ? 'text-green-700' : 'text-red-700'}`}>
                      {store.is_open ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity
                    onPress={() => updateStore(store.id, { is_open: !store.is_open })}
                    className={`flex-1 py-2 rounded-lg items-center ${store.is_open ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}
                  >
                    <Text className={`font-medium text-sm ${store.is_open ? 'text-red-600' : 'text-green-600'}`}>
                      {store.is_open ? 'Close Store' : 'Open Store'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleEditStore(store)}
                    className="py-2 px-3 rounded-lg items-center bg-blue-50 border border-blue-200"
                  >
                    <Pencil size={16} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteStore(store.id, store.name)}
                    className="py-2 px-3 rounded-lg items-center bg-red-50 border border-red-200"
                  >
                    <Trash2 size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
                <Text className="text-xs text-subtle mt-2">
                  Staff: {users.filter(u => u.role === 'staff' && u.staff_store_ids.includes(store.id)).length} assigned
                </Text>
              </View>
            ))}
            {stores.length === 0 && <Text className="text-center text-subtle py-8">No stores found</Text>}
          </View>
        )}

        {activeTab === 'rewards' && (
          <AdminRewards
            rewards={rewards}
            createReward={createReward}
            updateReward={updateReward}
            deleteReward={deleteReward}
          />
        )}

        {activeTab === 'achievements' && (
          <AdminAchievements
            achievements={achievements}
            createAchievement={createAchievement}
            updateAchievement={updateAchievement}
            deleteAchievement={deleteAchievement}
          />
        )}

        {activeTab === 'transactions' && (
          <View className="gap-3">
            {transactions.map(t => (
              <View key={t.id} className="bg-white p-4 rounded-xl border border-line">
                <View className="flex-row justify-between mb-1">
                  <Text className="font-bold text-ink capitalize">{t.transaction_type.replace('_', ' ')}</Text>
                  <Text className={`font-bold ${t.points_earned > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {t.points_earned > 0 ? `+${t.points_earned}` : `-${t.points_redeemed}`}
                  </Text>
                </View>
                <Text className="text-xs text-subtle">{t.user_email}</Text>
                <Text className="text-xs text-subtle mt-2">{new Date(t.created_at).toLocaleString()}</Text>
              </View>
            ))}
            {transactions.length === 0 && <Text className="text-center text-subtle py-8">No transactions found</Text>}
          </View>
        )}

        {activeTab === 'orders' && <AdminOrders stores={stores} />}

        {activeTab === 'menu' && <AdminMenu stores={stores} />}

        {activeTab === 'gaap' && <AdminGaap stores={stores} />}
      </View>

      {/* Role Change Modal */}
      <Modal visible={showRoleModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 w-full max-w-2xl self-center">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-ink">Change User Role</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Select Role</Text>
              <View className="flex-row flex-wrap gap-2">
                {(['user', 'staff', 'manager', 'finance', 'admin'] as const).map(role => (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setSelectedRole(role)}
                    className={`px-3 py-2.5 rounded-xl items-center border ${
                      selectedRole === role
                        ? 'bg-brand-800 border-brand-800'
                        : 'bg-white border-line'
                    }`}
                  >
                    <Text className={`font-medium capitalize ${selectedRole === role ? 'text-white' : 'text-subtle'}`}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {branchScopedRole(selectedRole) && (
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Assign Store</Text>
                {stores.map(store => (
                  <TouchableOpacity
                    key={store.id}
                    onPress={() => setSelectedStoreIds(ids => ids.includes(store.id) ? ids.filter(id => id !== store.id) : [...ids, store.id])}
                    className={`px-4 py-3 rounded-xl mb-2 border ${
                      selectedStoreIds.includes(store.id)
                        ? 'bg-brand-50 border-brand-300'
                        : 'bg-canvas border-line'
                    }`}
                  >
                    <Text className={`font-medium ${selectedStoreIds.includes(store.id) ? 'text-red-700' : 'text-gray-700'}`}>{store.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput accessibilityLabel="Access change reason" placeholder="Reason for this access change" value={accessReason} onChangeText={setAccessReason} maxLength={500} editable={!savingAccess} className="border border-slate-300 rounded-xl p-3 mb-3" />
            <TouchableOpacity
              disabled={savingAccess}
              onPress={handleRoleChange}
              className="bg-brand-800 rounded-xl py-3.5 items-center mt-2 mb-4"
            >
              <Text className="text-white font-bold text-base">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Store Modal */}
      <Modal visible={showCreateStore} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 w-full max-w-2xl self-center">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-ink">Add New Store</Text>
              <TouchableOpacity onPress={() => setShowCreateStore(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView className="gap-4">
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Store Name *</Text>
                <TextInput
                  value={newStoreName}
                  onChangeText={setNewStoreName}
                  placeholder="e.g. Pogo's Downtown"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-ink"
                  placeholderTextColor="#71847a"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Address *</Text>
                <TextInput
                  value={newStoreAddress}
                  onChangeText={setNewStoreAddress}
                  placeholder="123 Main St"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-ink"
                  placeholderTextColor="#71847a"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Store Location *</Text>
                <View className="h-48 rounded-xl overflow-hidden border border-line">
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                      latitude: newStoreLocation.latitude,
                      longitude: newStoreLocation.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                    onPress={(e) => setNewStoreLocation(e.nativeEvent.coordinate)}
                  >
                    <Marker coordinate={newStoreLocation} pinColor="#dc2626" />
                  </MapView>
                </View>
                <Text className="text-xs text-subtle mt-1">{Platform.OS === 'web' ? 'Set the branch coordinates above.' : 'Tap on the map to set the store pin'}</Text>
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Image URL (optional)</Text>
                <TextInput
                  value={newStoreImageUrl}
                  onChangeText={setNewStoreImageUrl}
                  placeholder="https://example.com/store-photo.jpg"
                  autoCapitalize="none"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-ink"
                  placeholderTextColor="#71847a"
                />
              </View>
              <TouchableOpacity
                onPress={handleCreateStore}
                disabled={isCreatingStore}
                className="bg-brand-800 rounded-xl py-3.5 items-center mt-2 mb-8"
              >
                <Text className="text-white font-bold text-base">
                  {isCreatingStore ? 'Creating...' : 'Create Store'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Store Modal */}
      <Modal visible={showEditStore} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 w-full max-w-2xl self-center">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-ink">Edit Store</Text>
              <TouchableOpacity onPress={() => setShowEditStore(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView className="gap-4">
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Store Name *</Text>
                <TextInput
                  value={editStoreName}
                  onChangeText={setEditStoreName}
                  placeholder="Store Name"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-ink"
                  placeholderTextColor="#71847a"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Address *</Text>
                <TextInput
                  value={editStoreAddress}
                  onChangeText={setEditStoreAddress}
                  placeholder="Store Address"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-ink"
                  placeholderTextColor="#71847a"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Store Location *</Text>
                <View className="h-48 rounded-xl overflow-hidden border border-line">
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                      latitude: editStoreLocation.latitude,
                      longitude: editStoreLocation.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                    onPress={(e) => setEditStoreLocation(e.nativeEvent.coordinate)}
                  >
                    <Marker coordinate={editStoreLocation} pinColor="#dc2626" />
                  </MapView>
                </View>
                <Text className="text-xs text-subtle mt-1">{Platform.OS === 'web' ? 'Set the branch coordinates above.' : 'Tap on the map to move the store pin'}</Text>
              </View>
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-1">
                  <Image size={14} color="#6b7280" />
                  <Text className="text-sm font-medium text-gray-700">Store Image URL</Text>
                </View>
                <TextInput
                  value={editStoreImageUrl}
                  onChangeText={setEditStoreImageUrl}
                  placeholder="https://example.com/store-photo.jpg"
                  autoCapitalize="none"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-ink"
                  placeholderTextColor="#71847a"
                />
                {editStoreImageUrl ? (
                  <Text className="text-xs text-green-600 mt-1">✓ Image URL set</Text>
                ) : (
                  <Text className="text-xs text-subtle mt-1">Leave blank to remove image</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleSaveStore}
                disabled={isSavingStore}
                className="bg-brand-800 rounded-xl py-3.5 items-center mt-2 mb-8"
              >
                <Text className="text-white font-bold text-base">
                  {isSavingStore ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
