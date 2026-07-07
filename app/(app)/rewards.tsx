import { View, Text, FlatList, ActivityIndicator, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { useRewards } from '@/hooks/useRewards';
import { RewardCard } from '@/components/rewards/RewardCard';
import { useState } from 'react';
import { Gift, Star } from 'lucide-react-native';

export default function Rewards() {
  const { rewards, userPoints, redeemReward, loading, refetch } = useRewards();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={rewards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        ListHeaderComponent={
          <View className="mb-5">
            {/* Points Card */}
            <View className="bg-indigo-600 rounded-2xl p-5 mb-4">
              <Text className="text-indigo-200 text-sm mb-1">Available to redeem</Text>
              <View className="flex-row items-baseline">
                <Star size={20} color="#fbbf24" fill="#fbbf24" />
                <Text className="text-white text-4xl font-bold ml-2">{currentPoints.toLocaleString()}</Text>
                <Text className="text-indigo-200 text-base ml-2">points</Text>
              </View>
            </View>

            {/* Section Title */}
            <Text className="text-2xl font-bold text-slate-800">Available Rewards</Text>
          </View>
        }
        renderItem={({ item }) => (
          <RewardCard 
            reward={item} 
            userPoints={currentPoints}
            onRedeem={handleRedeem}
            isRedeeming={redeemingId === item.id}
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16 bg-white rounded-2xl border border-slate-100">
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
