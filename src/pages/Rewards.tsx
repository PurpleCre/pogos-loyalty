import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PointsDisplay } from '@/components/ui/points-display';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AchievementShare } from '@/components/social/achievement-share';
import { RewardPreviewDialog } from '@/components/rewards/reward-preview-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { useLongPress } from '@/hooks/useLongPress';
import { toast } from '@/hooks/use-toast';
import { Gift, Star } from 'lucide-react';
import { Reward } from '@/hooks/useRewards';

export default function Rewards() {
  const { user } = useAuth();
  const { rewards, userPoints, redeemReward, loading: rewardsLoading } = useRewards();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [previewReward, setPreviewReward] = useState<Reward | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (rewardsLoading) {
    return null; // Layout handles loading
  }

  if (!user) {
    return null;
  }

  const currentPoints = userPoints?.current_points || 0;

  const handleRedeem = async (rewardId: string, pointsCost: number, rewardName: string) => {
    if (currentPoints < pointsCost) {
      toast({
        title: "Insufficient Points",
        description: `You need ${pointsCost - currentPoints} more points to redeem this reward.`,
        variant: "destructive",
      });
      return;
    }

    setRedeeming(rewardId);
    const { error } = await redeemReward(rewardId, pointsCost);
    
    if (error) {
      toast({
        title: "Redemption Failed",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reward Redeemed!",
        description: `You've successfully redeemed ${rewardName}! Share your achievement!`,
      });
    }
    
    setRedeeming(null);
  };

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
    <AuthenticatedLayout>
      <div className="min-h-screen bg-background">
        <div className="container py-6 px-4 max-w-7xl mx-auto">
          {/* Points Display */}
          <Card className="mb-6 animate-in fade-in slide-in-from-top duration-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <PointsDisplay points={currentPoints} size="lg" />
                <p className="text-sm text-muted-foreground mt-2">
                  Available to redeem
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rewards Grid */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-700">
            <h2 className="text-2xl font-bold">Available Rewards</h2>
            {rewards.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {rewards.map((reward) => {
                  const longPressHandlers = useLongPress({
                    onLongPress: () => {
                      setPreviewReward(reward);
                      setPreviewOpen(true);
                    },
                  });

                  return (
                  <Card 
                    key={reward.id} 
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
                            onClick={() => handleRedeem(reward.id, reward.points_cost, reward.name)}
                            disabled={currentPoints < reward.points_cost || redeeming === reward.id}
                            variant={currentPoints >= reward.points_cost ? "default" : "outline"}
                            size="sm"
                          >
                            {redeeming === reward.id ? 'Redeeming...' : 
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
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No rewards available at the moment.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <RewardPreviewDialog
        reward={previewReward}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        currentPoints={currentPoints}
        onRedeem={handleRedeem}
        isRedeeming={redeeming === previewReward?.id}
      />
    </AuthenticatedLayout>
  );
}