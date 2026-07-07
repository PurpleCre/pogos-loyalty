import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAdmin } from '@/hooks/useAdmin';
import { Shield, Users, Gift, Receipt } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { AdminRewards } from '@/components/admin/AdminRewards';
import { useIsFocused } from '@react-navigation/native';

export default function AdminScreen() {
  const isFocused = useIsFocused();
  const { 
    isAdmin, loading, users, rewards, transactions, 
    fetchUsers, fetchRewards, fetchTransactions,
    createReward, updateReward, deleteReward
  } = useAdmin();
  const [activeTab, setActiveTab] = useState<'users' | 'rewards' | 'transactions'>('users');

  useEffect(() => {
    if (isAdmin && !loading) {
      fetchUsers();
      fetchRewards();
      fetchTransactions();
    }
  }, [isAdmin, loading]);

  if (!isFocused) {
    return <View />;
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-6 pb-2">
        <View className="flex-row items-center gap-3 mb-4">
          <View className="w-12 h-12 bg-indigo-100 rounded-full items-center justify-center">
            <Shield size={24} color="#4f46e5" />
          </View>
          <View>
            <Text className="text-2xl font-bold text-gray-900">Admin Panel</Text>
            <Text className="text-sm text-gray-500">Manage your loyalty program</Text>
          </View>
        </View>

        <View className="flex-row bg-gray-200 p-1 rounded-xl">
          <TouchableOpacity 
            onPress={() => setActiveTab('users')}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'users' ? 'bg-white' : ''}`}
          >
            <Text className={`font-semibold ${activeTab === 'users' ? 'text-gray-900' : 'text-gray-500'}`}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('rewards')}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'rewards' ? 'bg-white' : ''}`}
          >
            <Text className={`font-semibold ${activeTab === 'rewards' ? 'text-gray-900' : 'text-gray-500'}`}>Rewards</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('transactions')}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'transactions' ? 'bg-white' : ''}`}
          >
            <Text className={`font-semibold ${activeTab === 'transactions' ? 'text-gray-900' : 'text-gray-500'}`}>Transact</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {activeTab === 'users' && (
          <View className="gap-3">
            {users.map(user => (
              <View key={user.id} className="bg-white p-4 rounded-xl border border-gray-100 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-bold text-gray-900 mb-1">{user.full_name || 'No Name'}</Text>
                  <Text className="text-xs text-gray-500 mb-2">{user.email}</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="bg-indigo-50 px-2 py-1 rounded">
                      <Text className="text-xs font-semibold text-indigo-700">{user.current_points} pts</Text>
                    </View>
                    <Text className="text-xs text-gray-400">Role: {user.role}</Text>
                  </View>
                </View>
              </View>
            ))}
            {users.length === 0 && <Text className="text-center text-gray-500 py-8">No users found</Text>}
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

        {activeTab === 'transactions' && (
          <View className="gap-3">
            {transactions.map(t => (
              <View key={t.id} className="bg-white p-4 rounded-xl border border-gray-100">
                <View className="flex-row justify-between mb-1">
                  <Text className="font-bold text-gray-900 capitalize">{t.transaction_type.replace('_', ' ')}</Text>
                  <Text className={`font-bold ${t.transaction_type === 'earn' ? 'text-green-600' : 'text-orange-600'}`}>
                    {t.transaction_type === 'earn' ? `+${t.points_earned}` : `-${t.points_redeemed}`}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">{t.user_email}</Text>
                <Text className="text-xs text-gray-400 mt-2">{new Date(t.created_at).toLocaleString()}</Text>
              </View>
            ))}
            {transactions.length === 0 && <Text className="text-center text-gray-500 py-8">No transactions found</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
