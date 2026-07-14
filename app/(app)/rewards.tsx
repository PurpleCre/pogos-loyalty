import { View, Text, FlatList, ActivityIndicator, Alert, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useRewards, Reward } from '@/hooks/useRewards';
import { RewardCard } from '@/components/rewards/RewardCard';
import { useState } from 'react';
import { Gift, Star } from 'lucide-react-native';
import { clsx } from 'clsx';

export default function Rewards() {
  const { rewards, userPoints, redeemReward, loading, refetch } = useRewards();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const currentPoints = userPoints?.current_points || 0;

  const handleRedeem = async (rewardId: string, cost: number) => {
    if (currentPoints < cost) {
      Alert.alert(
        "Insufficient Points",
        `You need ${cost - currentPoints} more points to redeem this reward.`
      );
      return;
    }

    Alert.alert(
      "Confirm Redemption",
      "Are you sure you want to redeem this reward?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redeem",
          onPress: async () => {
            setRedeemingId(rewardId);
            const { error } = await redeemReward(rewardId, cost);
            if (error) {
              Alert.alert("Redemption Failed", error);
            } else {
              Alert.alert("Reward Redeemed!", "You've successfully redeemed this reward! 🎉");
            }
            setRedeemingId(null);
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (loading && !refreshing && rewards.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  const categories = ['all', 'food', 'drink', 'special'];

  const filteredRewards = activeCategory === 'all' 
    ? rewards 
    : rewards.filter(r => r.category === activeCategory);

  return (
    <View className="flex-1 bg-slate-50">
      
      {/* Brand & Layout Transformation: QuickBite Red Header */}
      <View className="bg-[#dc2626] pt-14 pb-4 px-4 rounded-b-xl">
        <Text className="text-white text-2xl font-bold mb-1">Pogo's</Text>
        <Text className="text-white text-lg">
          Rewards | points: <Text className="font-bold">{currentPoints}</Text>.
        </Text>
      </View>

      {/* Categories Filter */}
      <View className="bg-slate-50 py-3 border-b border-gray-100 z-10">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              onPress={() => setActiveCategory(category)}
              className={clsx(
                "px-4 py-2 rounded-full mr-2 border",
                activeCategory === category 
                  ? "bg-slate-200 border-slate-300" 
                  : "bg-white border-slate-200"
              )}
            >
              <Text className={clsx(
                "capitalize font-medium text-base",
                activeCategory === category ? "text-slate-900" : "text-slate-600"
              )}>
                {category === 'drink' ? 'Drinks' : category === 'special' ? 'Specials' : category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredRewards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingVertical: 16, gap: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <RewardCard 
              reward={item} 
              userPoints={currentPoints}
              onRedeem={handleRedeem}
              isRedeeming={redeemingId === item.id}
            />
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16 bg-white rounded-2xl border border-slate-100 mx-4">
            <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
              <Gift size={32} color="#94a3b8" />
            </View>
            <Text className="text-slate-500 font-medium text-base">No rewards available</Text>
            <Text className="text-slate-400 text-sm mt-1">Check back soon for new rewards!</Text>
          </View>
        }
      />
    </View>
  );
}
