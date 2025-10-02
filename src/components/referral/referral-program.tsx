import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useReferrals } from "@/hooks/useReferrals";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Gift, Users, TrendingUp } from "lucide-react";

export function ReferralProgram() {
  const { referralCode, referrals, isLoading, generateCode, isGenerating, copyCode } = useReferrals();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const totalReferrals = referrals?.length || 0;
  const totalPointsEarned = referrals?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Referral Rewards
          </CardTitle>
          <CardDescription>
            Invite friends and you both earn 100 points! You get 100 points, they get 50 points.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!referralCode ? (
            <Button
              onClick={() => generateCode()}
              disabled={isGenerating}
              className="w-full"
            >
              Generate My Referral Code
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-background rounded-lg border">
                <code className="flex-1 text-lg font-mono font-bold text-primary">
                  {referralCode.code}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyCode(referralCode.code)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-background rounded-lg border text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">{totalReferrals}</div>
                  <div className="text-sm text-muted-foreground">Referrals</div>
                </div>
                <div className="p-4 bg-background rounded-lg border text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">{totalPointsEarned}</div>
                  <div className="text-sm text-muted-foreground">Points Earned</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {referrals && referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">New Referral</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    +{referral.points_awarded} points
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
