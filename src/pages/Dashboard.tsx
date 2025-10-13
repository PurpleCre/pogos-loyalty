import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/layout/mobile-header";
import { LoyaltyOverview } from "@/components/home/loyalty-overview";
import { PromotionalBanner } from "@/components/home/promotional-banner";
import { AchievementShare } from "@/components/social/achievement-share";
import { AnnouncementsBanner } from "@/components/home/announcements-banner";
import { GiftPointsDialog } from "@/components/social/gift-points-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { QRScanner } from "@/components/qr/qr-scanner";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRewards } from "@/hooks/useRewards";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";
import { User, Trophy, Users, QrCode, Gift } from "lucide-react";
import pogosLogo from "@/assets/pogos-logo.jpg";

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { userPoints, rewards, transactions, addPoints, loading: rewardsLoading } = useRewards();
  const { isAdmin } = useAdmin();
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const handleOpenQRScanner = () => {
      setIsQRScannerOpen(true);
    };
    
    window.addEventListener("open-qr-scanner", handleOpenQRScanner);
    return () => window.removeEventListener("open-qr-scanner", handleOpenQRScanner);
  }, []);

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

  if (!user) {
    return null;
  }

  const currentPoints = userPoints?.current_points || 0;
  const nextReward = rewards.find(r => r.points_cost > currentPoints);
  const nextRewardPoints = nextReward?.points_cost || 300;
  const nextRewardName = nextReward?.name || "Free Burger";

  const handleScanQR = () => {
    setIsQRScannerOpen(true);
  };

  const handleQRScanSuccess = async (data: string) => {
    const pointsToAdd = Math.floor(Math.random() * 20) + 10;
    const purchaseAmount = Math.floor(Math.random() * 20) + 10;
    
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

  const handleMenuClick = () => {
    toast({
      title: "Menu",
      description: "Navigate using the buttons in the user section below",
    });
  };

  const handleNotificationClick = () => {
    navigate('/profile');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-warm">
        <DashboardSidebar />
        <SidebarInset className="flex-1">
          <MobileHeader
        showBackButton={false}
        showMenu={true}
        showNotifications={true}
        onMenuClick={handleMenuClick}
        onNotificationClick={handleNotificationClick}
      />
      
      <div className="p-4 space-y-6">
        <div className="text-center py-4">
          <img 
            src={pogosLogo} 
            alt="Pogo's Restaurant" 
            className="h-12 mx-auto mb-3 rounded-lg"
          />
          <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
          <p className="text-muted-foreground">Ready to earn more points?</p>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Hello {user.email?.split('@')[0]}!</h2>
            <p className="text-muted-foreground">Ready to earn more points?</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
              <User className="w-4 h-4 mr-1" />
              Profile
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                Admin Panel
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>

        <AnnouncementsBanner />

        <LoyaltyOverview 
          currentPoints={currentPoints}
          nextRewardPoints={nextRewardPoints}
          nextRewardName={nextRewardName}
        />

        <div className="flex justify-end">
          <GiftPointsDialog />
        </div>

        <section>
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card 
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={handleScanQR}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium">Scan QR</span>
              </div>
            </Card>
            <Card 
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={handleViewRewards}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-secondary" />
                </div>
                <span className="font-medium">View Rewards</span>
              </div>
            </Card>
            <Card 
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/achievements')}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium">Achievements</span>
              </div>
            </Card>
            <Card 
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/referrals')}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <span className="font-medium">Refer Friends</span>
              </div>
            </Card>
          </div>
        </section>

        <PromotionalBanner 
          title="Double Points Weekend!"
          description="Earn 2x points on all orders this weekend only"
          badgeText="This Weekend"
          onClick={handlePromotionClick}
        />

        <section>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-2">Share Your Progress</h3>
                  <p className="text-sm text-muted-foreground">
                    Show off your {currentPoints} points to friends!
                  </p>
                </div>
                <AchievementShare 
                  type="points" 
                  value={currentPoints}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="bg-card rounded-lg p-4 shadow-soft">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Recent Activity</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/transactions')}
              className="text-primary"
            >
              View All
            </Button>
          </div>
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
                        <p className="text-sm font-medium text-green-600">+{transaction.points_earned} points</p>
                        <p className="text-xs text-muted-foreground">${transaction.amount}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-purple-600">-{transaction.points_redeemed} points</p>
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

          <QRScanner
            isOpen={isQRScannerOpen}
            onClose={() => setIsQRScannerOpen(false)}
            onScanSuccess={handleQRScanSuccess}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
