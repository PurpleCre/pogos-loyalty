import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useReferrals } from '@/hooks/useReferrals';
import { Share2, Copy, Users, TrendingUp, Gift } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';

export default function ReferralsScreen() {
  const isFocused = useIsFocused();
  const { referralCode, referrals, isLoading, generateCode, isGenerating, copyCode } = useReferrals();
  const [refreshing, setRefreshing] = useState(false);

  if (!isFocused) {
    return <View />;
  }

  const totalReferrals = referrals?.length || 0;
  const totalPointsEarned = referrals?.reduce((sum: number, r: any) => sum + (r.points_awarded || 0), 0) || 0;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-slate-50" 
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
      }
    >
      {/* Header */}
      <View className="mb-6">
        <Text className="text-3xl font-bold text-slate-800 mb-2">Refer Friends</Text>
        <Text className="text-slate-400">Share your code and earn points together</Text>
      </View>

      {/* Referral Code Card */}
      <View className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 mb-5">
        <View className="flex-row items-center gap-2 mb-2">
          <Gift size={20} color="#6366f1" />
          <Text className="text-lg font-bold text-indigo-900">Referral Rewards</Text>
        </View>
        <Text className="text-indigo-600 text-sm mb-5">
          Invite friends and you both earn points! You get 100 points, they get 50 points.
        </Text>

        {referralCode ? (
          <View>
            <View className="bg-white border border-indigo-200 rounded-xl flex-row items-center overflow-hidden">
              <Text className="flex-1 text-center font-bold text-2xl tracking-widest text-indigo-800 py-4 font-mono">
                {referralCode.code}
              </Text>
              <TouchableOpacity 
                onPress={() => copyCode(referralCode.code)}
                className="bg-indigo-600 px-5 py-4 flex-row items-center gap-2"
                activeOpacity={0.7}
              >
                <Copy size={18} color="white" />
                <Text className="text-white font-bold">Copy</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Grid */}
            <View className="flex-row gap-3 mt-4">
              <View className="flex-1 bg-white p-4 rounded-xl border border-indigo-100 items-center">
                <Users size={22} color="#6366f1" />
                <Text className="text-2xl font-bold text-slate-800 mt-2">{totalReferrals}</Text>
                <Text className="text-xs text-slate-400 font-medium">Referrals</Text>
              </View>
              <View className="flex-1 bg-white p-4 rounded-xl border border-indigo-100 items-center">
                <TrendingUp size={22} color="#6366f1" />
                <Text className="text-2xl font-bold text-slate-800 mt-2">{totalPointsEarned}</Text>
                <Text className="text-xs text-slate-400 font-medium">Points Earned</Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={() => generateCode()}
            disabled={isGenerating}
            className={`py-4 rounded-xl items-center ${isGenerating ? 'bg-indigo-400' : 'bg-indigo-600'}`}
            activeOpacity={0.7}
          >
            {isGenerating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Generate My Referral Code</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Referral History */}
      {referrals && referrals.length > 0 && (
        <View className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <View className="px-5 pt-5 pb-2">
            <Text className="text-lg font-bold text-slate-800">Your Referrals</Text>
          </View>
          <View className="px-5 pb-5">
            {referrals.map((referral: any, index: number) => (
              <View 
                key={referral.id} 
                className={`flex-row items-center justify-between py-3.5 ${
                  index < referrals.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <View className="flex-1">
                  <Text className="font-medium text-slate-800">New Referral</Text>
                  <Text className="text-xs text-slate-400 mt-0.5">
                    {new Date(referral.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View className="bg-emerald-100 px-3 py-1 rounded-full">
                  <Text className="text-xs font-bold text-emerald-700">
                    +{referral.points_awarded || 0} points
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {(!referrals || referrals.length === 0) && referralCode && (
        <View className="bg-white rounded-2xl border border-slate-100 py-12 items-center">
          <View className="w-14 h-14 bg-slate-100 rounded-full items-center justify-center mb-3">
            <Users size={24} color="#94a3b8" />
          </View>
          <Text className="text-slate-500 font-medium">No referrals yet</Text>
          <Text className="text-slate-400 text-sm mt-1">Share your code to start earning!</Text>
        </View>
      )}
    </ScrollView>
  );
}
