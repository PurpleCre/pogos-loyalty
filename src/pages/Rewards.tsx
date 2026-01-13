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
import { toast } from '@/hooks/use-toast';
import { Gift } from 'lucide-react';
import { Reward } from '@/hooks/useRewards';
import { RewardCard } from '@/components/rewards/reward-card';

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
                {rewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    currentPoints={currentPoints}
                    isRedeeming={redeeming === reward.id}
                    onRedeem={handleRedeem}
                    onPreview={(reward) => {
                      setPreviewReward(reward);
                      setPreviewOpen(true);
                    }}
                  />
                ))}
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