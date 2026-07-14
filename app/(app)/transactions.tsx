import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useRewards } from '@/hooks/useRewards';
import { useState, useCallback } from 'react';
import { 
  Star, ShoppingBag, Gift, History, 
  ArrowUpRight, ArrowDownRight 
} from 'lucide-react-native';

type FilterType = 'all' | 'purchase' | 'redemption';

export default function Transactions() {
  const { transactions, userPoints, loading, refetch } = useRewards();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredTransactions = transactions.filter(t => 
    filter === 'all' || t.transaction_type === filter
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refetch]);

  if (loading && transactions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'purchase', label: 'Purchases' },
    { key: 'redemption', label: 'Redemptions' },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
        ListHeaderComponent={
          <View>
            {/* Summary Stats */}
            <View className="flex-row gap-3 mb-5">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm items-center">
                <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mb-2">
                  <Star size={20} color="#dc2626" />
                </View>
                <Text className="text-2xl font-bold text-slate-800">
                  {userPoints?.current_points || 0}
                </Text>
                <Text className="text-xs text-slate-400 font-medium">Current Points</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm items-center">
                <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mb-2">
                  <ShoppingBag size={20} color="#10b981" />
                </View>
                <Text className="text-2xl font-bold text-slate-800">
                  {userPoints?.total_earned || 0}
                </Text>
                <Text className="text-xs text-slate-400 font-medium">Total Earned</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm items-center">
                <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mb-2">
                  <Gift size={20} color="#a855f7" />
                </View>
                <Text className="text-2xl font-bold text-slate-800">
                  {userPoints?.total_redeemed || 0}
                </Text>
                <Text className="text-xs text-slate-400 font-medium">Total Redeemed</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <View className="flex-row bg-white p-1 rounded-xl border border-slate-100 mb-5">
              {filters.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: filter === tab.key ? '#dc2626' : 'transparent',
                    shadowColor: filter === tab.key ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 1,
                  }}
                >
                  <Text className={`text-sm font-semibold ${
                    filter === tab.key ? 'text-white' : 'text-slate-400'
                  }`}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Section Title */}
            <Text className="text-2xl font-bold text-slate-800 mb-4">Transaction History</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm mb-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-start gap-3 flex-1">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.transaction_type === 'purchase' ? 'bg-emerald-100' : 'bg-purple-100'
                }`}>
                  {item.transaction_type === 'purchase' ? (
                    <ArrowUpRight size={20} color="#10b981" />
                  ) : (
                    <ArrowDownRight size={20} color="#a855f7" />
                  )}
                </View>
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="font-semibold text-slate-800" numberOfLines={1}>
                      {item.items?.join(', ') || 'Transaction'}
                    </Text>
                    <View className={`px-2 py-0.5 rounded-full ${
                      item.transaction_type === 'purchase' ? 'bg-emerald-100' : 'bg-purple-100'
                    }`}>
                      <Text className={`text-xs font-medium capitalize ${
                        item.transaction_type === 'purchase' ? 'text-emerald-700' : 'text-purple-700'
                      }`}>
                        {item.transaction_type}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-slate-400">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                {item.transaction_type === 'purchase' ? (
                  <>
                    <Text className="text-lg font-bold text-emerald-600">
                      +{item.points_earned} pts
                    </Text>
                    <Text className="text-sm text-slate-400">
                      ${item.amount?.toFixed(2) || '0.00'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-lg font-bold text-purple-600">
                      -{item.points_redeemed} pts
                    </Text>
                    <Text className="text-sm text-slate-400">Redeemed</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="bg-white rounded-2xl border border-slate-100 py-16 items-center">
            <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
              <History size={32} color="#94a3b8" />
            </View>
            <Text className="text-slate-500 font-medium text-base">
              {filter === 'all' 
                ? 'No transactions yet'
                : `No ${filter} transactions found`
              }
            </Text>
            <Text className="text-slate-400 text-sm mt-1">
              {filter === 'all' 
                ? 'Start earning points by making purchases!'
                : 'Try a different filter'
              }
            </Text>
          </View>
        }
      />
    </View>
  );
}
