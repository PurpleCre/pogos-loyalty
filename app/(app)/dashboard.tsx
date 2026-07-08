import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { router } from 'expo-router';
import { 
  Scan, Gift, Trophy, Users, Star, TrendingUp, 
  ChevronRight, Sparkles, ArrowUpRight, ArrowDownRight,
  ShoppingBag, Clock, CheckCircle2
} from 'lucide-react-native';
import { useState, useCallback } from 'react';

export default function Dashboard() {
  const { user } = useAuth();
  const { userPoints, transactions, loading, refetch: refetchRewards } = useRewards();
  const [refreshing, setRefreshing] = useState(false);

  const currentPoints = userPoints?.current_points ?? 0;
  const totalEarned = userPoints?.total_earned ?? 0;

  // Calculate progress to next reward tier
  const nextRewardThreshold = currentPoints < 100 ? 100 : currentPoints < 250 ? 250 : currentPoints < 500 ? 500 : 1000;
  const progress = Math.min((currentPoints / nextRewardThreshold) * 100, 100);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refetchRewards();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refetchRewards]);

  return (
    <ScrollView 
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
      }
    >
      {/* Header */}
      <View className="bg-indigo-600 pt-14 pb-8 px-6 rounded-b-3xl">
        <View className="flex-row items-center justify-between mb-6 mt-4">
          <View>
            <Text className="text-white text-3xl font-bold">Loyalty Hub</Text>
            <Text className="text-indigo-200 mt-1">Earn points, unlock rewards.</Text>
          </View>
        </View>

        {/* Points Card */}
        <View className="bg-white/15 rounded-2xl p-5 border border-white/20">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-indigo-200 text-sm mb-1">Your Points</Text>
              <View className="flex-row items-baseline">
                <Text className="text-white text-4xl font-bold">{currentPoints.toLocaleString()}</Text>
                <Text className="text-indigo-200 text-base ml-2">pts</Text>
              </View>
            </View>
            <View className="items-end">
              <View className="flex-row items-center bg-emerald-500/20 px-3 py-1.5 rounded-full">
                <TrendingUp size={14} color="#a7f3d0" />
                <Text className="text-emerald-300 text-sm font-medium ml-1">{totalEarned} earned</Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View className="mb-2">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-indigo-200 text-xs">Next reward at {nextRewardThreshold} pts</Text>
              <Text className="text-indigo-200 text-xs">{Math.round(progress)}%</Text>
            </View>
            <View className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <View 
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </View>
          </View>
        </View>
      </View>



      {/* Quick Actions */}
      <View className="px-5 -mt-1">
        <Text className="text-lg font-bold text-slate-800 mb-4 mt-2">Quick Actions</Text>
        <View className="flex-row flex-wrap justify-between">
          <TouchableOpacity 
            onPress={() => router.push('/scan')}
            className="w-[48%] bg-white rounded-2xl p-5 mb-3 border border-slate-100 shadow-sm"
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 rounded-xl bg-indigo-100 items-center justify-center mb-3">
              <Scan size={24} color="#6366f1" />
            </View>
            <Text className="font-semibold text-slate-800 text-base">Scan QR</Text>
            <Text className="text-slate-400 text-xs mt-1">Earn points</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(app)/rewards')}
            className="w-[48%] bg-white rounded-2xl p-5 mb-3 border border-slate-100 shadow-sm"
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 rounded-xl bg-amber-100 items-center justify-center mb-3">
              <Gift size={24} color="#f59e0b" />
            </View>
            <Text className="font-semibold text-slate-800 text-base">Rewards</Text>
            <Text className="text-slate-400 text-xs mt-1">Redeem points</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(app)/achievements')}
            className="w-[48%] bg-white rounded-2xl p-5 mb-3 border border-slate-100 shadow-sm"
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 rounded-xl bg-emerald-100 items-center justify-center mb-3">
              <Trophy size={24} color="#10b981" />
            </View>
            <Text className="font-semibold text-slate-800 text-base">Achievements</Text>
            <Text className="text-slate-400 text-xs mt-1">View badges</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(app)/referrals')}
            className="w-[48%] bg-white rounded-2xl p-5 mb-3 border border-slate-100 shadow-sm"
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 rounded-xl bg-purple-100 items-center justify-center mb-3">
              <Users size={24} color="#a855f7" />
            </View>
            <Text className="font-semibold text-slate-800 text-base">Refer Friends</Text>
            <Text className="text-slate-400 text-xs mt-1">Earn bonus pts</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Promo Banner */}
      <View className="px-5 mt-2">
        <View className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 overflow-hidden"
              style={{ backgroundColor: '#f59e0b' }}>
          <View className="flex-row items-center mb-2">
            <Sparkles size={18} color="#ffffff" />
            <Text className="text-white/80 text-xs font-semibold uppercase tracking-wider ml-2">This Weekend</Text>
          </View>
          <Text className="text-white text-xl font-bold mb-1">Double Points Weekend!</Text>
          <Text className="text-white/80 text-sm">Earn 2x points on all orders this weekend only</Text>
        </View>
      </View>

      {/* Share Progress */}
      <View className="px-5 mt-5">
        <View className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex-row items-center justify-between">
          <View className="flex-1 mr-4">
            <Text className="font-semibold text-slate-800 text-base mb-1">Share Your Progress</Text>
            <Text className="text-slate-400 text-sm">Show off your {currentPoints} points to friends!</Text>
          </View>
          <TouchableOpacity className="bg-indigo-100 rounded-xl px-4 py-2.5">
            <Text className="text-indigo-600 font-semibold text-sm">Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View className="px-5 mt-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-slate-800">Recent Activity</Text>
          <TouchableOpacity 
            onPress={() => router.push('/(app)/transactions')}
            className="flex-row items-center"
          >
            <Text className="text-indigo-600 text-sm font-medium mr-1">View All</Text>
            <ChevronRight size={16} color="#6366f1" />
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((transaction, index) => (
              <View 
                key={transaction.id} 
                className={`flex-row items-center justify-between p-4 ${
                  index < Math.min(transactions.length, 5) - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <View className="flex-row items-center flex-1">
                  <View className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                    transaction.transaction_type === 'purchase' ? 'bg-emerald-100' : 'bg-amber-100'
                  }`}>
                    {transaction.transaction_type === 'purchase' ? (
                      <ArrowUpRight size={18} color="#10b981" />
                    ) : (
                      <ArrowDownRight size={18} color="#f59e0b" />
                    )}
                  </View>
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-medium text-slate-800" numberOfLines={1}>
                      {transaction.items?.join(', ') || 'Transaction'}
                    </Text>
                    <Text className="text-xs text-slate-400 mt-0.5">
                      {new Date(transaction.created_at).toLocaleDateString('en-US', { 
                        month: 'short', day: 'numeric' 
                      })}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  {transaction.transaction_type === 'purchase' ? (
                    <>
                      <Text className="text-sm font-bold text-emerald-600">
                        +{transaction.points_earned} pts
                      </Text>
                      <Text className="text-xs text-slate-400">${transaction.amount}</Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-sm font-bold text-amber-600">
                        -{transaction.points_redeemed} pts
                      </Text>
                      <Text className="text-xs text-slate-400">Redeemed</Text>
                    </>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View className="items-center justify-center py-10 px-6">
              <View className="w-14 h-14 bg-slate-100 rounded-full items-center justify-center mb-3">
                <Star size={24} color="#94a3b8" />
              </View>
              <Text className="text-slate-500 text-center font-medium mb-1">No activity yet</Text>
              <Text className="text-slate-400 text-center text-sm">
                Start earning points by making purchases!
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
