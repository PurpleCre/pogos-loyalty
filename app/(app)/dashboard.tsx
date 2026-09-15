import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Animated, Easing } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { 
  Scan, Gift, Trophy, Users, Star, 
  ChevronRight, Sparkles, ArrowUpRight, ArrowDownRight,
  Menu, Hexagon, ShoppingCart, ChevronDown, Send
} from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import { useOrder } from '@/contexts/OrderContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { userPoints, transactions, loading, refetch: refetchRewards } = useRewards();
  const { itemCount } = useCart();
  const { selectedStore } = useOrder();
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // If not authenticated, redirect to login
  if (!user && !loading) {
    router.replace('/(auth)/login');
    return null;
  }

  const currentPoints = userPoints?.current_points ?? 0;
  const totalEarned = userPoints?.total_earned ?? 0;

  // Calculate progress
  const nextRewardThreshold = currentPoints < 100 ? 100 : currentPoints < 250 ? 250 : currentPoints < 500 ? 500 : 1000;
  const progress = Math.min((currentPoints / nextRewardThreshold) * 100, 100);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refetchRewards();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refetchRewards]);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Sleek Header */}
      <View className="pt-14 pb-4 px-6 flex-row items-center justify-between z-10 bg-slate-50/90 border-b border-slate-200/50">
        <TouchableOpacity 
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 shadow-sm"
        >
          <Menu size={20} color="#1e293b" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-red-600 text-xl font-black tracking-widest uppercase mb-1">Pogo's</Text>
          <TouchableOpacity 
            onPress={() => router.push('/store-picker')}
            className="flex-row items-center bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm"
          >
            <Text className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mr-1">
              {selectedStore?.name.replace("Pogo's ", "") || 'Select Store'}
            </Text>
            <ChevronDown size={12} color="#64748b" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.push('/(app)/cart')} className="w-10 h-10 items-center justify-center">
          <ShoppingCart size={24} color="#1e293b" />
          {itemCount > 0 && (
            <View className="absolute top-1 right-0 bg-red-600 w-4 h-4 rounded-full items-center justify-center border border-white">
              <Text className="text-white text-[10px] font-bold">{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* Membership Card (Points) */}
          <View className="px-5 mt-4">
            <View className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
              
              <View className="flex-row justify-between items-start mb-8 z-10">
                <View>
                  <Text className="text-slate-500 text-sm uppercase tracking-wider font-semibold mb-1">Available Points</Text>
                  <View className="flex-row items-baseline">
                    <Text className="text-slate-900 text-5xl font-black">{currentPoints.toLocaleString()}</Text>
                    <Text className="text-red-600 text-lg font-bold ml-1"> pts</Text>
                  </View>
                </View>
                <View className="w-12 h-12 rounded-2xl bg-red-50 items-center justify-center border border-red-100">
                  <Hexagon size={24} color="#dc2626" strokeWidth={1.5} />
                </View>
              </View>

              <View className="z-10">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-slate-700 font-medium text-sm">Burger Fanatic Tier</Text>
                  <Text className="text-slate-500 text-xs font-semibold">{Math.round(progress)}% to next reward</Text>
                </View>
                <View className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <View 
                    className="h-full bg-red-600 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Quick Actions Grid */}
          <View className="px-5 mt-8">
            <View className="flex-row flex-wrap justify-between">
              <TouchableOpacity 
                onPress={() => router.push('/scan')}
                className="w-[48%] bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm items-center"
                activeOpacity={0.7}
              >
                <View className="w-12 h-12 rounded-full bg-red-50 items-center justify-center mb-3">
                  <Scan size={24} color="#dc2626" strokeWidth={1.5} />
                </View>
                <Text className="font-semibold text-slate-800 text-sm">Scan Receipt</Text>
                <Text className="text-slate-400 text-[10px] mt-1 tracking-wider uppercase">Earn Points</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.navigate('/(app)/rewards')}
                className="w-[48%] bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm items-center"
                activeOpacity={0.7}
              >
                <View className="w-12 h-12 rounded-full bg-orange-50 items-center justify-center mb-3">
                  <Gift size={24} color="#f97316" strokeWidth={1.5} />
                </View>
                <Text className="font-semibold text-slate-800 text-sm">Rewards</Text>
                <Text className="text-slate-400 text-[10px] mt-1 tracking-wider uppercase">Redeem Points</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.navigate('/(app)/achievements')}
                className="w-[48%] bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm items-center"
                activeOpacity={0.7}
              >
                <View className="w-12 h-12 rounded-full bg-emerald-50 items-center justify-center mb-3">
                  <Trophy size={24} color="#10b981" strokeWidth={1.5} />
                </View>
                <Text className="font-semibold text-slate-800 text-sm">Achievements</Text>
                <Text className="text-slate-400 text-[10px] mt-1 tracking-wider uppercase">View Badges</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.navigate('/(app)/referrals')}
                className="w-[48%] bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm items-center"
                activeOpacity={0.7}
              >
                <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mb-3">
                  <Users size={24} color="#3b82f6" strokeWidth={1.5} />
                </View>
                <Text className="font-semibold text-slate-800 text-sm">Refer Friends</Text>
                <Text className="text-slate-400 text-[10px] mt-1 tracking-wider uppercase">Earn Bonus Pts</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Promo Banner */}
          <View className="px-5 mt-2">
            <View className="bg-red-600 rounded-2xl p-5 border border-red-500 flex-row items-center justify-between shadow-sm">
              <View className="flex-1 mr-4">
                <View className="flex-row items-center mb-1">
                  <Sparkles size={14} color="#fca5a5" />
                  <Text className="text-red-200 text-xs font-bold uppercase tracking-widest ml-1.5">Weekend Exclusive</Text>
                </View>
                <Text className="text-white text-lg font-black mt-1">Double Points!</Text>
                <Text className="text-red-100 text-sm mt-1">Earn 2x points on all orders this weekend.</Text>
              </View>
              <View className="w-12 h-12 bg-red-700 rounded-full items-center justify-center">
                <ChevronRight size={24} color="#fff" />
              </View>
            </View>
          </View>

          {/* Share Points Action */}
          <View className="px-5 mt-4">
            <TouchableOpacity 
              onPress={() => router.push('/(app)/share-points')}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-row items-center justify-between"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-purple-50 items-center justify-center mr-3">
                  <Send size={24} color="#a855f7" strokeWidth={1.5} />
                </View>
                <View>
                  <Text className="font-semibold text-slate-800 text-base">Share Points</Text>
                  <Text className="text-slate-400 text-xs mt-0.5">Send points to friends</Text>
                </View>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {/* Recent Activity */}
          <View className="px-5 mt-8">
            <View className="flex-row items-end justify-between mb-5">
              <Text className="text-xl font-bold text-slate-900">Recent Activity</Text>
              <TouchableOpacity onPress={() => router.navigate('/(app)/transactions')}>
                <Text className="text-red-600 text-sm font-semibold">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-3xl border border-slate-100 shadow-sm p-2">
              {transactions.length > 0 ? (
                transactions.slice(0, 5).map((transaction, index) => {
                  const isPurchase = transaction.transaction_type === 'purchase';
                  const date = new Date(transaction.created_at);
                  const isLast = index === Math.min(transactions.length, 5) - 1;

                  return (
                    <View key={transaction.id} className={`flex-row items-center p-3 ${!isLast ? 'border-b border-slate-50' : ''}`}>
                      <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${isPurchase ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        {isPurchase ? (
                          <ArrowUpRight size={18} color="#10b981" />
                        ) : (
                          <ArrowDownRight size={18} color="#ef4444" />
                        )}
                      </View>
                      
                      <View className="flex-1">
                        <Text className="text-slate-800 font-semibold text-base" numberOfLines={1}>
                          {transaction.items?.join(', ') || (isPurchase ? 'Order Completed' : 'Reward Claimed')}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>

                      <View className="items-end ml-3">
                        <Text className={`font-bold text-base ${isPurchase ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPurchase ? '+' : '-'}{isPurchase ? transaction.points_earned : transaction.points_redeemed} pts
                        </Text>
                        {isPurchase && (
                          <Text className="text-slate-400 text-xs mt-0.5">${transaction.amount}</Text>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View className="items-center justify-center py-10 px-6">
                  <View className="w-16 h-16 bg-slate-50 rounded-full items-center justify-center mb-4">
                    <Star size={28} color="#94a3b8" />
                  </View>
                  <Text className="text-slate-600 text-center font-medium mb-1">No points activity yet</Text>
                  <Text className="text-slate-400 text-center text-sm">
                    Start making orders to earn rewards!
                  </Text>
                </View>
              )}
            </View>
          </View>
          
        </Animated.View>
      </ScrollView>
    </View>
  );
}
