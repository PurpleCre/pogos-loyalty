import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOffline } from "./useOffline";
import { toast } from "sonner";

export const useAchievements = () => {
  const { user } = useAuth();
  const { isOnline, saveOfflineData, getOfflineData } = useOffline();

  const { data: achievements, isLoading: achievementsLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      if (!isOnline) {
        const cached = getOfflineData('achievements');
        if (cached) {
          toast.info('Showing cached achievements (offline)');
          return cached;
        }
      }

      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("criteria_value", { ascending: true });
      
      if (error) {
        const cached = getOfflineData('achievements');
        if (cached) {
          toast.info('Showing cached achievements (offline)');
          return cached;
        }
        throw error;
      }
      
      saveOfflineData('achievements', data);
      return data;
    },
  });

  const { data: userAchievements, isLoading: userAchievementsLoading, refetch } = useQuery({
    queryKey: ["user-achievements", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      if (!isOnline) {
        const cached = getOfflineData(`userAchievements_${user.id}`);
        if (cached) {
          return cached;
        }
      }
      
      const { data, error } = await supabase
        .from("user_achievements")
        .select(`
          *,
          achievements (*)
        `)
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });
      
      if (error) {
        const cached = getOfflineData(`userAchievements_${user.id}`);
        if (cached) {
          return cached;
        }
        throw error;
      }
      
      saveOfflineData(`userAchievements_${user.id}`, data);
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
