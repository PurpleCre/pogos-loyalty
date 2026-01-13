import { View, Text, TouchableOpacity } from 'react-native';
import { Reward } from '@/hooks/useRewards';
import { Button } from '@/components/ui/button';
import { Gift, Star } from 'lucide-react-native';
import { clsx } from 'clsx';

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  onRedeem: (rewardId: string, cost: number) => void;
  isRedeeming?: boolean;
}

export function RewardCard({ reward, userPoints, onRedeem, isRedeeming }: RewardCardProps) {
  const isAffordable = userPoints >= reward.points_cost;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'food': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'drink': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'special': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCategoryLabelColor = (category: string) => {
     switch (category) {
      case 'food': return 'text-orange-800';
      case 'drink': return 'text-blue-800';
      case 'special': return 'text-purple-800';
      default: return 'text-slate-800';
    }
  };

  return (
    <View className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4 shadow-sm">
      <View className="p-4">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row gap-3 flex-1">
            <View className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center">
              <Gift size={20} color="#64748b" />
            </View>
            <View className="flex-1 mr-2">
              <Text className="text-lg font-bold text-slate-900">{reward.name}</Text>
              <Text className="text-slate-500 text-sm mt-1">{reward.description}</Text>
            </View>
          </View>
          <View className={clsx("px-2 py-1 rounded-full border", getCategoryColor(reward.category))}>
             <Text className={clsx("text-xs font-medium capitalize", getCategoryLabelColor(reward.category))}>
                {reward.category}
             </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-4">
          <View className="flex-row items-center gap-1">
            <Star size={16} color="#eab308" fill="#eab308" />
            <Text className="font-bold text-slate-900">{reward.points_cost} points</Text>
          </View>
          
          <Button 
            size="sm"
            onPress={() => onRedeem(reward.id, reward.points_cost)}
            disabled={!isAffordable || isRedeeming}
            variant={isAffordable ? 'default' : 'outline'}
            className={isAffordable ? 'bg-slate-900' : 'opacity-50'}
          >
            {isAffordable ? 'Redeem' : 'Not enough points'}
          </Button>
        </View>
      </View>
    </View>
  );
}
