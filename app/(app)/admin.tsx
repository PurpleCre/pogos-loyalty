import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useAdmin } from '@/hooks/useAdmin';
import { 
  Shield, Users, Gift, Receipt, LayoutDashboard, Store, 
  ClipboardList, UserPlus, X, TrendingUp, 
  DollarSign, UserCheck, MapPin, Trophy, Plus, Pencil, Trash2, Image 
} from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { AdminRewards } from '@/components/admin/AdminRewards';
import { AdminOrders } from '@/components/admin/AdminOrders';
import { AdminMenu } from '@/components/admin/AdminMenu';
import { AdminAchievements } from '@/components/admin/AdminAchievements';
import { useIsFocused } from '@react-navigation/native';

export default function AdminScreen() {
  const isFocused = useIsFocused();
  const { 
    isAdmin, loading, users, rewards, achievements, transactions, stores, dashboardStats,
    fetchUsers, fetchRewards, fetchAchievements, fetchTransactions, fetchStores, fetchDashboardStats,
    createReward, updateReward, deleteReward,
    createAchievement, updateAchievement, deleteAchievement,
    setUserRole, createUser, createStore, updateStore, deleteStore
  } = useAdmin();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'stores' | 'menu' | 'rewards' | 'achievements' | 'orders' | 'transactions'>('dashboard');

  // Create User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserStoreId, setNewUserStoreId] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Role Change Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('user');
  const [selectedStoreId, setSelectedStoreId] = useState('');

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
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (!isAdmin) return null;

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    if (newUserRole === 'staff' && !newUserStoreId) {
      Alert.alert('Missing Store', 'Please select a store for the staff member.');
      return;
    }

    setIsCreatingUser(true);
    const result = await createUser(newUserEmail, newUserPassword, newUserName, newUserRole, newUserStoreId);
    setIsCreatingUser(false);

    if (result.error) {
      Alert.alert('Error', result.error.message || 'Failed to create user.');
    } else {
      Alert.alert('Success', (result as any).note || 'User created successfully!');
      setShowCreateUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('user');
      setNewUserStoreId('');
    }
  };

  const handleRoleChange = async () => {
    if (selectedRole === 'staff' && !selectedStoreId) {
      Alert.alert('Missing Store', 'Please select a store for the staff member.');
      return;
    }

    const { error } = await setUserRole(selectedUserId, selectedRole, selectedStoreId);
    if (error) {
      Alert.alert('Error', 'Failed to update role.');
    } else {
      Alert.alert('Success', 'User role updated!');
      setShowRoleModal(false);
    }
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
    { key: 'menu', label: 'Menu', icon: Gift }, // Icon changes inside component if needed
    { key: 'rewards', label: 'Rewards', icon: Gift },
    { key: 'achievements', label: 'Achievements', icon: Trophy },
    { key: 'transactions', label: 'Transact', icon: Receipt },
  ] as const;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return { bg: 'bg-red-100', text: 'text-red-700' };
      case 'staff': return { bg: 'bg-blue-100', text: 'text-blue-700' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-[#18181b] pt-14 pb-4 px-5">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-red-600 rounded-xl items-center justify-center">
            <Shield size={20} color="white" />
          </View>
          <View>
            <Text className="text-white text-lg font-bold">Pogo's Global Admin</Text>
            <Text className="text-gray-400 text-sm">Manage stores, orders & loyalty</Text>
          </View>
        </View>
      </View>

      {/* Tab Bar */}
      <View className="px-4 pt-3 pb-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row bg-gray-200 p-1 rounded-xl">
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                className={`px-3 py-2 rounded-lg items-center flex-row gap-1 ${activeTab === tab.key ? 'bg-white shadow-sm' : ''}`}
              >
                <TabIcon size={14} color={activeTab === tab.key ? '#e11d48' : '#6b7280'} />
                <Text className={`font-semibold text-xs ${activeTab === tab.key ? 'text-gray-900' : 'text-gray-500'}`}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <View className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <Users size={16} color="#e11d48" />
                  <Text className="text-gray-500 text-xs font-medium uppercase">Total Users</Text>
                </View>
                <Text className="text-2xl font-bold text-gray-900">{dashboardStats.totalUsers}</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <ClipboardList size={16} color="#e11d48" />
                  <Text className="text-gray-500 text-xs font-medium uppercase">Orders Today</Text>
                </View>
                <Text className="text-2xl font-bold text-gray-900">{dashboardStats.totalOrdersToday}</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <DollarSign size={16} color="#16a34a" />
                  <Text className="text-gray-500 text-xs font-medium uppercase">Revenue Today</Text>
                </View>
                <Text className="text-2xl font-bold text-green-600">${dashboardStats.revenueToday.toFixed(2)}</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <UserCheck size={16} color="#2563eb" />
                  <Text className="text-gray-500 text-xs font-medium uppercase">Active Staff</Text>
                </View>
                <Text className="text-2xl font-bold text-gray-900">{dashboardStats.activeStaff}</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <MapPin size={16} color="#ea580c" />
                  <Text className="text-gray-500 text-xs font-medium uppercase">Stores</Text>
                </View>
                <Text className="text-2xl font-bold text-gray-900">{dashboardStats.totalStores}</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <View className="flex-row items-center gap-2 mb-2">
                  <TrendingUp size={16} color="#f59e0b" />
                  <Text className="text-gray-500 text-xs font-medium uppercase">Pending</Text>
                </View>
                <Text className="text-2xl font-bold text-amber-500">{dashboardStats.pendingOrders}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => setShowCreateUser(true)}
              className="bg-red-600 rounded-xl py-3 px-4 flex-row items-center justify-center gap-2 mb-2"
            >
              <UserPlus size={18} color="white" />
              <Text className="text-white font-bold">Add New User</Text>
            </TouchableOpacity>

            {users.map(u => {
              const badge = getRoleBadgeColor(u.role);
              return (
                <View key={u.id} className="bg-white p-4 rounded-xl border border-gray-100">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900">{u.full_name || 'No Name'}</Text>
                      <Text className="text-xs text-gray-500 mt-0.5">{u.email}</Text>
                    </View>
                    <View className={`px-2 py-1 rounded-full ${badge.bg}`}>
                      <Text className={`text-xs font-bold capitalize ${badge.text}`}>{u.role}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="bg-red-50 px-2 py-1 rounded">
                      <Text className="text-xs font-semibold text-red-700">{u.current_points} pts</Text>
                    </View>
                    {u.role === 'staff' && u.staff_store_id && (
                      <Text className="text-xs text-gray-400">
                        Store: {stores.find(s => s.id === u.staff_store_id)?.name || 'Unknown'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedUserId(u.id);
                      setSelectedRole(u.role);
                      setSelectedStoreId(u.staff_store_id || '');
                      setShowRoleModal(true);
                    }}
                    className="bg-gray-100 rounded-lg py-2 items-center"
                  >
                    <Text className="text-gray-700 font-medium text-sm">Change Role</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            {users.length === 0 && <Text className="text-center text-gray-500 py-8">No users found</Text>}
          </View>
        )}

        {/* Stores Tab */}
        {activeTab === 'stores' && (
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => setShowCreateStore(true)}
              className="bg-red-600 rounded-xl py-3 px-4 flex-row items-center justify-center gap-2 mb-2"
            >
              <Plus size={18} color="white" />
              <Text className="text-white font-bold">Add New Store</Text>
            </TouchableOpacity>

            {stores.map(store => (
              <View key={store.id} className="bg-white p-4 rounded-xl border border-gray-100">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="font-bold text-gray-900">{store.name}</Text>
                    <Text className="text-sm text-gray-500 mt-1">{store.address}</Text>
                    {store.image_url ? (
                      <Text className="text-xs text-green-600 mt-1">📷 Image set</Text>
                    ) : (
                      <Text className="text-xs text-gray-400 mt-1">No image</Text>
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
                <Text className="text-xs text-gray-400 mt-2">
                  Staff: {users.filter(u => u.role === 'staff' && u.staff_store_id === store.id).length} assigned
                </Text>
              </View>
            ))}
            {stores.length === 0 && <Text className="text-center text-gray-500 py-8">No stores found</Text>}
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
              <View key={t.id} className="bg-white p-4 rounded-xl border border-gray-100">
                <View className="flex-row justify-between mb-1">
                  <Text className="font-bold text-gray-900 capitalize">{t.transaction_type.replace('_', ' ')}</Text>
                  <Text className={`font-bold ${t.points_earned > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {t.points_earned > 0 ? `+${t.points_earned}` : `-${t.points_redeemed}`}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">{t.user_email}</Text>
                <Text className="text-xs text-gray-400 mt-2">{new Date(t.created_at).toLocaleString()}</Text>
              </View>
            ))}
            {transactions.length === 0 && <Text className="text-center text-gray-500 py-8">No transactions found</Text>}
          </View>
        )}

        {activeTab === 'orders' && <AdminOrders stores={stores} />}
        
        {activeTab === 'menu' && <AdminMenu stores={stores} />}
      </ScrollView>

      {/* Create User Modal */}
      <Modal visible={showCreateUser} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Add New User</Text>
              <TouchableOpacity onPress={() => setShowCreateUser(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView className="gap-4">
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Full Name *</Text>
                <TextInput
                  value={newUserName}
                  onChangeText={setNewUserName}
                  placeholder="John Doe"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Email *</Text>
                <TextInput
                  value={newUserEmail}
                  onChangeText={setNewUserEmail}
                  placeholder="user@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Password *</Text>
                <TextInput
                  value={newUserPassword}
                  onChangeText={setNewUserPassword}
                  placeholder="Min 6 characters"
                  secureTextEntry
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Role</Text>
                <View className="flex-row gap-2">
                  {['user', 'staff', 'admin'].map(role => (
                    <TouchableOpacity
                      key={role}
                      onPress={() => setNewUserRole(role)}
                      className={`flex-1 py-2.5 rounded-xl items-center border ${
                        newUserRole === role 
                          ? 'bg-red-600 border-red-600' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text className={`font-medium capitalize ${newUserRole === role ? 'text-white' : 'text-gray-600'}`}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {newUserRole === 'staff' && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-2">Assign Store *</Text>
                  {stores.map(store => (
                    <TouchableOpacity
                      key={store.id}
                      onPress={() => setNewUserStoreId(store.id)}
                      className={`px-4 py-3 rounded-xl mb-2 border ${
                        newUserStoreId === store.id 
                          ? 'bg-red-50 border-red-300' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <Text className={`font-medium ${newUserStoreId === store.id ? 'text-red-700' : 'text-gray-700'}`}>{store.name}</Text>
                      <Text className="text-xs text-gray-500">{store.address}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={handleCreateUser}
                disabled={isCreatingUser}
                className="bg-red-600 rounded-xl py-3.5 items-center mt-2 mb-8"
              >
                <Text className="text-white font-bold text-base">
                  {isCreatingUser ? 'Creating...' : 'Create User'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Role Change Modal */}
      <Modal visible={showRoleModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Change User Role</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Select Role</Text>
              <View className="flex-row gap-2">
                {['user', 'staff', 'admin'].map(role => (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setSelectedRole(role)}
                    className={`flex-1 py-2.5 rounded-xl items-center border ${
                      selectedRole === role 
                        ? 'bg-red-600 border-red-600' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`font-medium capitalize ${selectedRole === role ? 'text-white' : 'text-gray-600'}`}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {selectedRole === 'staff' && (
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Assign Store</Text>
                {stores.map(store => (
                  <TouchableOpacity
                    key={store.id}
                    onPress={() => setSelectedStoreId(store.id)}
                    className={`px-4 py-3 rounded-xl mb-2 border ${
                      selectedStoreId === store.id 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`font-medium ${selectedStoreId === store.id ? 'text-red-700' : 'text-gray-700'}`}>{store.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              onPress={handleRoleChange}
              className="bg-red-600 rounded-xl py-3.5 items-center mt-2 mb-4"
            >
              <Text className="text-white font-bold text-base">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Store Modal */}
      <Modal visible={showCreateStore} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Add New Store</Text>
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
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Address *</Text>
                <TextInput
                  value={newStoreAddress}
                  onChangeText={setNewStoreAddress}
                  placeholder="123 Main St"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Store Location *</Text>
                <View className="h-48 rounded-xl overflow-hidden border border-gray-200">
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
                <Text className="text-xs text-gray-500 mt-1">Tap on the map to set the store pin</Text>
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Image URL (optional)</Text>
                <TextInput
                  value={newStoreImageUrl}
                  onChangeText={setNewStoreImageUrl}
                  placeholder="https://example.com/store-photo.jpg"
                  autoCapitalize="none"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <TouchableOpacity
                onPress={handleCreateStore}
                disabled={isCreatingStore}
                className="bg-red-600 rounded-xl py-3.5 items-center mt-2 mb-8"
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
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Edit Store</Text>
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
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Address *</Text>
                <TextInput
                  value={editStoreAddress}
                  onChangeText={setEditStoreAddress}
                  placeholder="Store Address"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Store Location *</Text>
                <View className="h-48 rounded-xl overflow-hidden border border-gray-200">
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
                <Text className="text-xs text-gray-500 mt-1">Tap on the map to move the store pin</Text>
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
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
                {editStoreImageUrl ? (
                  <Text className="text-xs text-green-600 mt-1">✓ Image URL set</Text>
                ) : (
                  <Text className="text-xs text-gray-400 mt-1">Leave blank to remove image</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleSaveStore}
                disabled={isSavingStore}
                className="bg-red-600 rounded-xl py-3.5 items-center mt-2 mb-8"
              >
                <Text className="text-white font-bold text-base">
                  {isSavingStore ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
