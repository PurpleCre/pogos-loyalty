import { useState } from "react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { LoyaltyOverview } from "@/components/home/loyalty-overview";
import { QuickActions } from "@/components/home/quick-actions";
import { PromotionalBanner } from "@/components/home/promotional-banner";
import { QRScanner } from "@/components/qr/qr-scanner";
import { currentUserPoints, nextReward } from "@/data/loyalty-data";
import { toast } from "@/hooks/use-toast";
import pogosLogo from "@/assets/pogos-logo.jpg";

export default function Dashboard() {
  const [points, setPoints] = useState(currentUserPoints);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  const handleScanQR = () => {
    setIsQRScannerOpen(true);
  };

  const handleQRScanSuccess = (data: string) => {
    // Simulate adding points based on QR code data
    const pointsToAdd = Math.floor(Math.random() * 20) + 10; // 10-30 points
    setPoints(prev => prev + pointsToAdd);
    
    toast({
      title: "Points Added!",
      description: `You earned ${pointsToAdd} points from your purchase!`,
    });
  };

  const handleViewRewards = () => {
    toast({
      title: "Rewards",
      description: "Viewing available rewards...",
    });
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

        {/* Loyalty Overview */}
        <LoyaltyOverview 
          currentPoints={points}
          nextRewardPoints={nextReward.pointsCost}
          nextRewardName={nextReward.name}
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
            <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">Classic Burger + Fries</p>
                <p className="text-xs text-muted-foreground">Jan 15, 2024</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-success">+13 points</p>
                <p className="text-xs text-muted-foreground">$12.99</p>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="text-sm font-medium">Free Soft Drink</p>
                <p className="text-xs text-muted-foreground">Jan 12, 2024</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-secondary">-150 points</p>
                <p className="text-xs text-muted-foreground">Redeemed</p>
              </div>
            </div>
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