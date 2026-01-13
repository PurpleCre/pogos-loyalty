import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AchievementShare } from '@/components/social/achievement-share';
import { useLongPress } from '@/hooks/useLongPress';
import { Star } from 'lucide-react';
import { Reward } from '@/hooks/useRewards';

interface RewardCardProps {
  reward: Reward;
  currentPoints: number;
  isRedeeming: boolean;
  onRedeem: (rewardId: string, pointsCost: number, rewardName: string) => void;
  onPreview: (reward: Reward) => void;
}

export function RewardCard({ reward, currentPoints, isRedeeming, onRedeem, onPreview }: RewardCardProps) {
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      onPreview(reward);
    },
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'food':
        return '🍔';
      case 'drink':
        return '🥤';
      case 'special':
        return '🎉';
      default:
        return '🎁';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'food':
        return 'bg-orange-100 text-orange-800';
      case 'drink':
        return 'bg-blue-100 text-blue-800';
      case 'special':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card 
      className="relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      {...longPressHandlers}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">
              {getCategoryIcon(reward.category)}
            </div>
            <div>
              <CardTitle className="text-lg">{reward.name}</CardTitle>
              <CardDescription>{reward.description}</CardDescription>
            </div>
          </div>
          <Badge className={getCategoryColor(reward.category)}>
            {reward.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            <span className="font-semibold">{reward.points_cost} points</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => onRedeem(reward.id, reward.points_cost, reward.name)}
              disabled={currentPoints < reward.points_cost || isRedeeming}
              variant={currentPoints >= reward.points_cost ? "default" : "outline"}
              size="sm"
            >
              {isRedeeming ? 'Redeeming...' : 
               currentPoints >= reward.points_cost ? 'Redeem' : 'Not enough points'}
            </Button>
            <AchievementShare 
              type="reward" 
              value={reward.name}
              trigger={
                <Button variant="outline" size="sm">
                  Share
                </Button>
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
