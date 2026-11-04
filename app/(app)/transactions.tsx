import { Screen, PageHeading } from '@/components/ui/screen';
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'expo-router';
import { useRewards } from '@/hooks/useRewards';
import { ReadStatus } from '@/components/ReadStatus';
import { formatMoney } from '@/lib/cash-orders';
import { useState, useCallback } from 'react';
import { 
  Star, ShoppingBag, Gift, History, 
  ArrowUpRight, ArrowDownRight, Zap 
} from 'lucide-react-native';

type FilterType = 'all' | 'purchase' | 'redemption' | 'refund' | 'reward_restore';

export default function Transactions() {
  const { transactions, userPoints, loading, fresh, refreshedAt, error, refetch } = useRewards();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredTransactions = transactions.filter(t => 
    filter === 'all' || t.transaction_type === filter
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  const { user, loading: authLoading } = useAuth();
  if (!user && !authLoading) return <Redirect href="/(auth)/login?redirect=/(app)/transactions" />;
  if (loading && transactions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#174d45" />
      </View>
    );
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'purchase', label: 'Purchases' },
    { key: 'redemption', label: 'Redemptions' },
    { key: 'refund', label: 'Refunds' },
    { key: 'reward_restore', label: 'Restored' },
  ];

  return (
    <Screen title="Points history" scroll={false} contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }}>
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
        ListHeaderComponent={
          <View>
            <PageHeading eyebrow="YOUR VISITS, REMEMBERED" title="Every point has a story." subtitle="Review recent credits, redemptions and corrections." />
            <ReadStatus label="Points and recent history" fresh={fresh} at={refreshedAt} error={error} loading={loading} onRefresh={() => { void refetch(); }} />
            {/* Summary Stats */}
            <View className="flex-row gap-3 mb-5">
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm items-center">
                <View className="w-10 h-10 bg-brand-100 rounded-full items-center justify-center mb-2">
                  <Star size={20} color="#174d45" />
                </View>
                <Text className="text-2xl font-bold text-ink">
                  {userPoints?.current_points ?? 'Unconfirmed'}
                </Text>
                <Text className="text-xs text-subtle font-medium">{fresh ? 'Available points' : 'Last known points'}</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm items-center">
                <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mb-2">
                  <ShoppingBag size={20} color="#10b981" />
                </View>
                <Text className="text-2xl font-bold text-ink">
                  {userPoints?.total_earned ?? 'Unconfirmed'}
                </Text>
                <Text className="text-xs text-subtle font-medium">Total Earned</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 border border-line shadow-sm items-center">
                <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mb-2">
                  <Gift size={20} color="#a855f7" />
                </View>
                <Text className="text-2xl font-bold text-ink">
                  {userPoints?.total_redeemed ?? 'Unconfirmed'}
                </Text>
                <Text className="text-xs text-subtle font-medium">Total Redeemed</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {filters.map((tab) => (
                <Pressable
                  key={tab.key}
                  accessibilityRole="button" accessibilityState={{ selected: filter === tab.key }}
                  onPress={() => setFilter(tab.key)}
                  style={{
                    minWidth: 92,
                    minHeight: 44,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: filter === tab.key ? '#174d45' : 'transparent',
                    shadowColor: filter === tab.key ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 1,
                  }}
                >
                  <Text className={`text-sm font-semibold ${
                    filter === tab.key ? 'text-white' : 'text-subtle'
                  }`}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Section Title */}
            <Text className="text-2xl font-bold text-ink mb-4">Recent history (latest 10)</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 border border-line shadow-sm mb-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-start gap-3 flex-1">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  ['purchase', 'reward_restore'].includes(item.transaction_type) ? 'bg-emerald-100' : 'bg-purple-100'
                }`}>
                  {['purchase', 'reward_restore'].includes(item.transaction_type) ? (
                    <ArrowUpRight size={20} color="#10b981" />
                  ) : (
                    <ArrowDownRight size={20} color="#a855f7" />
                  )}
                </View>
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="font-semibold text-ink" numberOfLines={1}>
                      {item.items?.join(', ') || 'Transaction'}
                    </Text>
                    <View className={`px-2 py-0.5 rounded-full ${
                      ['purchase', 'reward_restore'].includes(item.transaction_type) ? 'bg-emerald-100' : 'bg-purple-100'
                    }`}>
                      <Text className={`text-xs font-medium capitalize ${
                        ['purchase', 'reward_restore'].includes(item.transaction_type) ? 'text-emerald-700' : 'text-purple-700'
                      }`}>
                        {item.transaction_type === 'reward_restore' ? 'Points restored' : item.transaction_type}
                      </Text>
                    </View>
                    {(item as any).source === 'gaap_pos' && (
                      <View className="flex-row items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-100">
                        <Zap size={10} color="#2563eb" />
                        <Text className="text-xs font-medium text-blue-700">POS</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-subtle">
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
                {['purchase', 'reward_restore'].includes(item.transaction_type) ? (
                  <>
                    <Text className="text-lg font-bold text-emerald-600">
                      +{item.points_earned} pts
                    </Text>
                    <Text className="text-sm text-subtle">
                      {item.transaction_type === 'reward_restore' ? 'Reward correction' : item.amount_minor != null && item.currency ? formatMoney(item.amount_minor, item.currency) : Number.isFinite(item.amount) ? `${item.amount.toFixed(2)} · currency unconfirmed` : 'Amount and currency unconfirmed'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-lg font-bold text-purple-600">
                      -{item.points_redeemed} pts
                    </Text>
                    <Text className="text-sm text-subtle">{item.transaction_type === 'refund' ? 'Points reversed' : 'Redeemed'}</Text>
                    {item.transaction_type === 'refund' && item.amount_minor != null && item.currency ? <Text className="text-sm text-subtle">{formatMoney(item.amount_minor, item.currency)}</Text> : null}
                  </>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="bg-white rounded-2xl border border-line py-16 items-center">
            <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
              <History size={32} color="#94a3b8" />
            </View>
            <Text className="text-subtle font-medium text-base">
              {filter === 'all' 
                ? 'No transactions yet'
                : `No ${filter} transactions found`
              }
            </Text>
            <Text className="text-subtle text-sm mt-1">
              {filter === 'all' 
                ? 'Eligible, confirmed points activity will appear here.'
                : 'Try a different filter'
              }
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
