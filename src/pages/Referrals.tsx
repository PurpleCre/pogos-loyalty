import { ReferralProgram } from "@/components/referral/referral-program";
import { MobileHeader } from "@/components/layout/mobile-header";

export default function Referrals() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader title="Referrals" showBackButton />
      
      <div className="container py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Refer Friends</h1>
          <p className="text-muted-foreground">
            Share your code and earn points together
          </p>
        </div>
        
        <ReferralProgram />
      </div>
    </div>
  );
}
