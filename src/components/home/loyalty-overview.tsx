import { LoyaltyCard } from "@/components/ui/loyalty-card";
import { PointsDisplay } from "@/components/ui/points-display";
import { Progress } from "@/components/ui/progress";
import { Gift } from "lucide-react";

interface LoyaltyOverviewProps {
  currentPoints: number;
  nextRewardPoints: number;
  nextRewardName: string;
}

export function LoyaltyOverview({ 
  currentPoints, 
  nextRewardPoints, 
  nextRewardName 
}: LoyaltyOverviewProps) {
  const progress = (currentPoints / nextRewardPoints) * 100;

  return (
    <LoyaltyCard variant="primary" className="p-6 text-primary-foreground">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold mb-1">Your Points</h2>
          <PointsDisplay 
            points={currentPoints} 
            size="lg" 
            className="text-primary-foreground"
          />
        </div>
        <div className="h-16 w-16 bg-primary-foreground/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Gift className="h-8 w-8" />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{currentPoints} points</span>
          <span>{nextRewardPoints} points</span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-sm opacity-90">
          {nextRewardPoints - currentPoints} more points until {nextRewardName}
        </p>
      </div>
    </LoyaltyCard>
  );
}