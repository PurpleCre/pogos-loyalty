import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAchievements } from "@/hooks/useAchievements";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Lock, CheckCircle2 } from "lucide-react";

export function AchievementsList() {
  const { achievements, userAchievements, isLoading, getAchievementStatus } = useAchievements();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!achievements?.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No achievements available yet.
        </CardContent>
      </Card>
    );
  }

  const earnedCount = userAchievements?.length || 0;
  const totalCount = achievements?.length || 0;
  const progressPercentage = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Achievement Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-semibold">
                {earnedCount} / {totalCount}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {achievements.map((achievement) => {
          const isEarned = getAchievementStatus(achievement.id);
          const earnedData = userAchievements?.find(
            (ua) => ua.achievement_id === achievement.id
          );

          return (
            <Card
              key={achievement.id}
              className={isEarned ? "border-primary shadow-md" : "opacity-75"}
            >
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div
                    className={`text-4xl flex-shrink-0 ${
                      isEarned ? "grayscale-0" : "grayscale opacity-50"
                    }`}
                  >
                    {achievement.icon}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{achievement.name}</h3>
                      {isEarned ? (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      ) : (
                        <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        +{achievement.points_reward} points
                      </Badge>
                      {isEarned && earnedData && (
                        <span className="text-xs text-muted-foreground">
                          Earned {new Date(earnedData.earned_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
