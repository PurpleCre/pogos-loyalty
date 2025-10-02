import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useAchievements = () => {
  const { user } = useAuth();

  const { data: achievements, isLoading: achievementsLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("criteria_value", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: userAchievements, isLoading: userAchievementsLoading, refetch } = useQuery({
    queryKey: ["user-achievements", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("user_achievements")
        .select(`
          *,
          achievements (*)
        `)
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getAchievementStatus = (achievementId: string) => {
    return userAchievements?.some(ua => ua.achievement_id === achievementId) || false;
  };

  return {
    achievements,
    userAchievements,
    achievementsLoading,
    userAchievementsLoading,
    isLoading: achievementsLoading || userAchievementsLoading,
    getAchievementStatus,
    refetch,
  };
};
