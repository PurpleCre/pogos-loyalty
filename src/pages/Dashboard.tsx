import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/layout/mobile-header";
import { LoyaltyOverview } from "@/components/home/loyalty-overview";
import { QuickActions } from "@/components/home/quick-actions";
import { PromotionalBanner } from "@/components/home/promotional-banner";
import { QRScanner } from "@/components/qr/qr-scanner";
import { useAuth } from "@/hooks/useAuth";
import { useRewards } from "@/hooks/useRewards";
import { toast } from "@/hooks/use-toast";
import pogosLogo from "@/assets/pogos-logo.jpg";

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { userPoints, rewards, transactions, addPoints, loading: rewardsLoading } = useRewards();
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
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
          <img 
            src={pogosLogo} 
            alt="Pogo's Restaurant" 
            className="h-16 mx-auto mb-4 rounded-lg"
          />
          <p className="text-muted-foreground">Loading your rewards...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated
  if (!user) {
    return null;
  }

  // Get next reward info
  const currentPoints = userPoints?.current_points || 0;
  const nextReward = rewards.find(r => r.points_cost > currentPoints);
  const nextRewardPoints = nextReward?.points_cost || 300;
  const nextRewardName = nextReward?.name || "Free Burger";

  const handleScanQR = () => {
    setIsQRScannerOpen(true);
  };

  const handleQRScanSuccess = async (data: string) => {
    // Simulate adding points based on QR code data
    const pointsToAdd = Math.floor(Math.random() * 20) + 10; // 10-30 points
    const purchaseAmount = Math.floor(Math.random() * 20) + 10; // $10-30
    
    const { error } = await addPoints(pointsToAdd, purchaseAmount, ["QR Purchase"]);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to add points. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Points Added!",
        description: `You earned ${pointsToAdd} points from your purchase!`,
      });
    }
  };

  const handleViewRewards = () => {
    navigate('/rewards');
  };

  const handleOrderNow = () => {
    toast({
      title: "Order",
      description: "Redirecting to order menu...",
    });
  };

  const handlePromotionClick = () => {
    toast({
      title: "Promotion",
      description: "Double points weekend is live!",
    });
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <MobileHeader 
        showBackButton={false}
        showMenu={true}
        showNotifications={true}
      />
      
      <div className="p-4 space-y-6">
        {/* Welcome Header */}
        <div className="text-center py-4">
          <img 
            src={pogosLogo} 
            alt="Pogo's Restaurant" 
            className="h-12 mx-auto mb-3 rounded-lg"
          />
          <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
          <p className="text-muted-foreground">Ready to earn more points?</p>
        </div>

        {/* User Info & Sign Out */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Hello {user.email?.split('@')[0]}!</h2>
            <p className="text-muted-foreground">Ready to earn more points?</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        {/* Loyalty Overview */}
        <LoyaltyOverview 
          currentPoints={currentPoints}
          nextRewardPoints={nextRewardPoints}
          nextRewardName={nextRewardName}
        />

        {/* Quick Actions */}
        <QuickActions 
          onScanQR={handleScanQR}
          onViewRewards={handleViewRewards}
          onOrderNow={handleOrderNow}
        />

        {/* Promotional Banner */}
        <PromotionalBanner 
          title="Double Points Weekend!"
          description="Earn 2x points on all orders this weekend only"
          badgeText="This Weekend"
          onClick={handlePromotionClick}
        />

        {/* Recent Activity Preview */}
        <div className="bg-card rounded-lg p-4 shadow-soft">
          <h3 className="font-semibold mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {transactions.length > 0 ? (
              transactions.slice(0, 3).map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{transaction.items.join(', ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {transaction.transaction_type === 'purchase' ? (
                      <>
                        <p className="text-sm font-medium text-success">+{transaction.points_earned} points</p>
                        <p className="text-xs text-muted-foreground">${transaction.amount}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-secondary">-{transaction.points_redeemed} points</p>
                        <p className="text-xs text-muted-foreground">Redeemed</p>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity. Start earning points by making purchases!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanSuccess={handleQRScanSuccess}
      />
    </div>
  );
}