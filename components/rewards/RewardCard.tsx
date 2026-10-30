import { View, Text, TouchableOpacity, Image } from 'react-native';
import type { RewardOffer } from '@/lib/reward-redemption';
export function RewardCard({ reward, userPoints, onReserve, disabled }: {
  reward: RewardOffer; userPoints: number; onReserve(offer: RewardOffer): void; disabled: boolean;
}) {
  const canReserve = reward.can_reserve && userPoints >= reward.points_cost && !disabled;
  return <View className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
    {reward.image_url ? <Image source={{ uri: reward.image_url }} className="h-36 w-full rounded-lg mb-3" resizeMode="cover" /> : null}
    <Text className="font-bold text-lg">{reward.name}</Text>
    <Text className="font-bold text-red-600 mt-2">{reward.points_cost} points</Text>
    {reward.description ? <Text className="text-slate-600 mt-2">{reward.description}</Text> : null}
    <Text className="mt-3">{reward.terms}</Text>
    <Text className="text-slate-500 mt-2">Collect within {reward.reservation_minutes} minutes of reservation at this branch.</Text>
    <TouchableOpacity disabled={!canReserve} onPress={() => onReserve(reward)}
      className={`p-3 rounded-lg mt-4 ${canReserve ? 'bg-red-600' : 'bg-slate-200'}`}>
      <Text className={`font-bold text-center ${canReserve ? 'text-white' : 'text-slate-500'}`}>
        {!reward.can_reserve ? 'Unavailable at this branch' : userPoints < reward.points_cost ? 'More available points needed' : 'Review reservation'}
      </Text>
    </TouchableOpacity>
  </View>;
}
