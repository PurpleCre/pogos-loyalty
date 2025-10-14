import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoyaltyOverview } from "@/components/home/loyalty-overview";
import { PromotionalBanner } from "@/components/home/promotional-banner";
import { AchievementShare } from "@/components/social/achievement-share";
import { AnnouncementsBanner } from "@/components/home/announcements-banner";
import { GiftPointsDialog } from "@/components/social/gift-points-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { QRScanner } from "@/components/qr/qr-scanner";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRewards } from "@/hooks/useRewards";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";
import { User, Trophy, Users, QrCode, Gift, Bell } from "lucide-react";
import pogosLogo from "@/assets/pogos-logo.jpg";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { userPoints, rewards, transactions, addPoints, loading: rewardsLoading } = useRewards();
  const { isAdmin } = useAdmin();
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (data?.full_name) {
          setFullName(data.full_name);
        }
      }
    };
    
    fetchProfile();
  }, [user]);

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
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <SidebarInset className="flex-1">
          <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <img 
                  src={pogosLogo} 
                  alt="Pogo's Restaurant" 
                  className="h-10 w-10 rounded-lg shadow-sm"
                />
                <div>
                  <h1 className="text-lg font-bold">Welcome back!</h1>
                  <p className="text-sm text-muted-foreground">
                    Hello {fullName || user.email?.split('@')[0]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleNotificationClick}
                  className="relative"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-secondary rounded-full" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-8 max-w-7xl mx-auto">
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
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card 
              className="group p-6 cursor-pointer hover:shadow-primary hover:border-primary/50 transition-all duration-300"
              onClick={handleScanQR}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform shadow-primary">
                  <QrCode className="h-7 w-7 text-primary-foreground" />
                </div>
                <span className="font-semibold">Scan QR</span>
              </div>
            </Card>
            <Card 
              className="group p-6 cursor-pointer hover:shadow-secondary hover:border-secondary/50 transition-all duration-300"
              onClick={handleViewRewards}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-14 w-14 rounded-2xl bg-gradient-secondary flex items-center justify-center group-hover:scale-110 transition-transform shadow-secondary">
                  <Gift className="h-7 w-7 text-secondary-foreground" />
                </div>
                <span className="font-semibold">View Rewards</span>
              </div>
            </Card>
            <Card 
              className="group p-6 cursor-pointer hover:shadow-soft hover:border-success/50 transition-all duration-300"
              onClick={() => navigate('/achievements')}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-14 w-14 rounded-2xl bg-success flex items-center justify-center group-hover:scale-110 transition-transform shadow-soft">
                  <Trophy className="h-7 w-7 text-success-foreground" />
                </div>
                <span className="font-semibold">Achievements</span>
              </div>
            </Card>
            <Card 
              className="group p-6 cursor-pointer hover:shadow-primary hover:border-primary/50 transition-all duration-300"
              onClick={() => navigate('/referrals')}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center group-hover:scale-110 transition-transform shadow-primary">
                  <Users className="h-7 w-7 text-primary-foreground" />
                </div>
                <span className="font-semibold">Refer Friends</span>
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

        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Recent Activity</h2>
            <Button 
              variant="outline"
              size="sm" 
              onClick={() => navigate('/transactions')}
            >
              View All
            </Button>
          </div>
          <Card className="p-6">
            <div className="space-y-4">
              {transactions.length > 0 ? (
                transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center py-3 border-b border-border last:border-0">
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
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent activity. Start earning points by making purchases!
                </p>
              )}
            </div>
          </Card>
        </section>
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
