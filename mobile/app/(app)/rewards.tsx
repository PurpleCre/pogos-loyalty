import { View, Text, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRewards } from '@/hooks/useRewards';
import { RewardCard } from '@/components/rewards/RewardCard';
import { useState } from 'react';
import { Gift } from 'lucide-react-native';

export default function Rewards() {
  const { rewards, userPoints, redeemReward, loading, refetch } = useRewards();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRedeem = async (rewardId: string, cost: number) => {
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
              Alert.alert("Error", error);
            } else {
              Alert.alert("Success", "Reward redeemed successfully!");
            }
            setRedeemingId(null);
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loading && !refreshing && rewards.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 px-4 pt-4">
      <View className="mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
         <Text className="text-slate-500 text-sm mb-1">Available Points</Text>
         <Text className="text-3xl font-bold">{userPoints?.current_points || 0}</Text>
      </View>

      <FlatList
        data={rewards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RewardCard 
            reward={item} 
            userPoints={userPoints?.current_points || 0}
            onRedeem={handleRedeem}
            isRedeeming={redeemingId === item.id}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
             <Gift size={48} color="#cbd5e1" />
             <Text className="text-slate-400 mt-4">No rewards available yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}
