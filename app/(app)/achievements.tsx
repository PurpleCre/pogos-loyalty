import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useAchievements } from '@/hooks/useAchievements';
import { Trophy, Lock, CheckCircle2 } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';

export default function AchievementsScreen() {
  const isFocused = useIsFocused();
  const { achievements, userAchievements, isLoading, getAchievementStatus } = useAchievements();

  if (!isFocused) {
    return <View />;
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const earnedCount = userAchievements?.length || 0;
  const totalCount = achievements?.length || 0;
  const progressPercentage = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
      <View className="mb-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Your Achievements</Text>
        <Text className="text-gray-500">Unlock badges and earn bonus points by reaching milestones</Text>
      </View>

      <View className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-6">
        <View className="flex-row items-center gap-2 mb-4">
          <Trophy size={20} color="#4f46e5" />
          <Text className="text-lg font-bold text-indigo-900">Achievement Progress</Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text className="text-indigo-600 font-medium">Completed</Text>
          <Text className="text-indigo-900 font-bold">{earnedCount} / {totalCount}</Text>
        </View>
        <View className="h-2 bg-indigo-200 rounded-full overflow-hidden">
          <View className="h-full bg-indigo-600 rounded-full" style={{ width: `${progressPercentage}%` }} />
        </View>
      </View>

      <View className="gap-4">
        {achievements?.map((achievement: any) => {
          const isEarned = getAchievementStatus(achievement.id);
          const earnedData = userAchievements?.find((ua: any) => ua.achievement_id === achievement.id);

          return (
            <View 
              key={achievement.id} 
              className={`bg-white rounded-2xl p-4 border ${isEarned ? 'border-indigo-200 shadow-sm' : 'border-gray-100 opacity-75'}`}
            >
              <View className="flex-row gap-4">
                <View className="items-center justify-center w-12 h-12 bg-gray-50 rounded-xl">
                  <Text className={`text-2xl ${isEarned ? '' : 'opacity-50'}`}>{achievement.icon}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-start mb-1">
                    <Text className="font-bold text-gray-900 text-lg flex-1">{achievement.name}</Text>
                    {isEarned ? (
                      <CheckCircle2 size={20} color="#4f46e5" />
                    ) : (
                      <Lock size={20} color="#9ca3af" />
                    )}
                  </View>
                  <Text className="text-gray-500 text-sm mb-3">{achievement.description}</Text>
                  
                  <View className="flex-row items-center gap-2">
                    <View className="bg-gray-100 px-2 py-1 rounded-md">
                      <Text className="text-xs font-semibold text-gray-700">+{achievement.points_reward} points</Text>
                    </View>
                    {isEarned && earnedData && (
                      <Text className="text-xs text-gray-400">
                        Earned {new Date(earnedData.earned_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        {(!achievements || achievements.length === 0) && (
          <View className="py-10 items-center">
            <Text className="text-gray-500">No achievements available yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
