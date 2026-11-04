import { CatalogueImage } from '@/components/CatalogueImage';
import { View, Text, Image } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import type { RewardOffer } from '@/lib/reward-redemption';
export function RewardCard({ reward, userPoints, onReserve, disabled }: {
  reward: RewardOffer; userPoints: number; onReserve(offer: RewardOffer): void; disabled: boolean;
}) {
  const canReserve = reward.can_reserve && userPoints >= reward.points_cost && !disabled;
  return <View className="bg-white rounded-3xl border border-line p-5 mb-4">
    {reward.image_url ? <CatalogueImage uri={reward.image_url} label={reward.name} className="h-40 w-full rounded-2xl mb-4" /> : null}
    <Text className="font-bold text-lg">{reward.name}</Text>
    <Text className="font-bold text-brand-800 mt-2">{reward.points_cost} points</Text>
    {reward.description ? <Text className="text-subtle mt-2">{reward.description}</Text> : null}
    <Text className="mt-3">{reward.terms}</Text>
    <Text className="text-subtle mt-2">Collect within {reward.reservation_minutes} minutes of reservation at this branch.</Text>
    <TouchableOpacity disabled={!canReserve} onPress={() => onReserve(reward)}
      className={`p-3 rounded-lg mt-4 ${canReserve ? 'bg-brand-800' : 'bg-slate-200'}`}>
      <Text className={`font-bold text-center ${canReserve ? 'text-white' : 'text-subtle'}`}>
        {!reward.can_reserve ? 'Unavailable at this branch' : userPoints < reward.points_cost ? 'More available points needed' : 'Review reservation'}
      </Text>
    </TouchableOpacity>
  </View>;
}
