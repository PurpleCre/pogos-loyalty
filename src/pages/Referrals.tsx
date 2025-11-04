import { ReferralProgram } from "@/components/referral/referral-program";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

export default function Referrals() {
  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-background">
        <div className="container py-6 px-4 max-w-7xl mx-auto">
          <div className="mb-6 animate-in fade-in slide-in-from-bottom duration-500">
            <h1 className="text-3xl font-bold mb-2">Refer Friends</h1>
            <p className="text-muted-foreground">
              Share your code and earn points together
            </p>
          </div>
          
          <ReferralProgram />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
