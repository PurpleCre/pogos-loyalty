import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PointsDisplay } from '@/components/ui/points-display';
import { MobileHeader } from '@/components/layout/mobile-header';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { toast } from '@/hooks/use-toast';
import { Gift, Star } from 'lucide-react';

export default function Rewards() {
  const { user, loading: authLoading } = useAuth();
  const { rewards, userPoints, redeemReward, loading: rewardsLoading } = useRewards();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const navigate = useNavigate();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Show loading screen while checking auth
  if (authLoading || rewardsLoading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="text-center">
          <Gift className="h-16 w-16 mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading rewards...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated
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
        description: `You've successfully redeemed ${rewardName}!`,
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
    <div className="min-h-screen bg-gradient-warm">
      <MobileHeader 
        showBackButton={true}
        showMenu={false}
        showNotifications={false}
        title="Rewards"
      />
      
      <div className="p-4 space-y-6">
        {/* Points Display */}
        <Card>
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
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Available Rewards</h2>
          {rewards.length > 0 ? (
            <div className="grid gap-4">
              {rewards.map((reward) => (
                <Card key={reward.id} className="relative overflow-hidden">
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
                      <Button
                        onClick={() => handleRedeem(reward.id, reward.points_cost, reward.name)}
                        disabled={currentPoints < reward.points_cost || redeeming === reward.id}
                        variant={currentPoints >= reward.points_cost ? "default" : "outline"}
                        size="sm"
                      >
                        {redeeming === reward.id ? 'Redeeming...' : 
                         currentPoints >= reward.points_cost ? 'Redeem' : 'Not enough points'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
  );
}