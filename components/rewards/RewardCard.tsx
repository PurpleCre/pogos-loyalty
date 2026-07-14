import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Reward } from '@/hooks/useRewards';
import { Button } from '@/components/ui/button';
import { Star, Ticket } from 'lucide-react-native';

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  onRedeem: (rewardId: string, cost: number) => void;
  isRedeeming?: boolean;
}

export function RewardCard({ reward, userPoints, onRedeem, isRedeeming }: RewardCardProps) {
  const isAffordable = userPoints >= reward.points_cost;

  // Temporary hardcoded fallback URLs to match the aesthetic if image_url is missing
  const defaultImages: Record<string, string> = {
    food: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
    drink: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80',
    special: 'https://images.unsplash.com/photo-1628126235206-5260b9ea6441?w=500&q=80'
  };

  const imageUrl = reward.image_url || defaultImages[reward.category] || defaultImages['food'];

  return (
    <View className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1">
      {/* High-Fidelity Imagery */}
      {reward.category === 'special' && !reward.image_url ? (
         <View className="w-full h-32 bg-slate-100 items-center justify-center">
            <Ticket size={48} color="#ef4444" />
         </View>
      ) : (
         <Image 
           source={{ uri: imageUrl }} 
           className="w-full h-32 bg-slate-100" 
           resizeMode="cover"
         />
      )}

      <View className="p-3 flex-1 justify-between">
        <View>
          <Text className="text-base font-bold text-slate-900 leading-tight mb-1" numberOfLines={2}>
            {reward.name}
          </Text>
          <View className="flex-row items-center gap-1 mb-3">
            <Star size={14} color="#eab308" fill="#eab308" />
            <Text className="font-medium text-slate-700 text-sm">{reward.points_cost} points</Text>
          </View>
        </View>

        <Button 
          size="sm"
          onPress={() => onRedeem(reward.id, reward.points_cost)}
          disabled={!isAffordable || isRedeeming}
          className={isAffordable ? 'bg-red-600' : 'bg-slate-200 opacity-100'}
        >
          <Text className={isAffordable ? 'text-white font-bold' : 'text-slate-400 font-bold'}>
            {isAffordable ? 'Redeem' : 'Needs points'}
          </Text>
        </Button>
      </View>
    </View>
  );
}
