import { AchievementsList } from "@/components/achievements/achievements-list";
import { MobileHeader } from "@/components/layout/mobile-header";

export default function Achievements() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader title="Achievements" showBackButton />
      
      <div className="container py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Your Achievements</h1>
          <p className="text-muted-foreground">
            Unlock badges and earn bonus points by reaching milestones
          </p>
        </div>
        
        <AchievementsList />
      </div>
    </div>
  );
}
