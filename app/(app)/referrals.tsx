import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useReferrals } from '@/hooks/useReferrals';
import { Share2, Copy, Users, Gift } from 'lucide-react-native';

export default function ReferralsScreen() {
  const { referralCode, referrals, isLoading, generateCode, isGenerating, copyCode } = useReferrals();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
      <View className="mb-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Refer Friends</Text>
        <Text className="text-gray-500">Share your code and earn points together</Text>
      </View>

      <View className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-indigo-50 rounded-full items-center justify-center mb-4">
            <Share2 size={32} color="#4f46e5" />
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-2">Your Referral Code</Text>
          <Text className="text-gray-500 text-center mb-4">
            Give a friend 50 points when they sign up, and get 50 points when they make their first purchase.
          </Text>
        </View>

        {referralCode ? (
          <View className="bg-gray-50 border border-gray-200 rounded-xl flex-row items-center overflow-hidden">
            <Text className="flex-1 text-center font-bold text-2xl tracking-widest text-gray-800 py-4">
              {referralCode.code}
            </Text>
            <TouchableOpacity 
              onPress={() => copyCode(referralCode.code)}
              className="bg-indigo-600 px-6 py-4 items-center justify-center flex-row gap-2"
            >
              <Copy size={18} color="white" />
              <Text className="text-white font-bold">Copy</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={() => generateCode()}
            disabled={isGenerating}
            className={`py-4 rounded-xl items-center ${isGenerating ? 'bg-indigo-400' : 'bg-indigo-600'}`}
          >
            {isGenerating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Generate My Code</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-row gap-4 mb-6">
        <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center">
          <Users size={24} color="#4f46e5" className="mb-2" />
          <Text className="text-2xl font-bold text-gray-900">{referrals?.length || 0}</Text>
          <Text className="text-xs text-gray-500 font-medium">Friends Referred</Text>
        </View>
        <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center">
          <Gift size={24} color="#10b981" className="mb-2" />
          <Text className="text-2xl font-bold text-gray-900">
            {referrals?.filter((r: any) => r.status === 'completed').length * 50 || 0}
          </Text>
          <Text className="text-xs text-gray-500 font-medium">Points Earned</Text>
        </View>
      </View>

      <Text className="text-lg font-bold text-gray-900 mb-4">Referral History</Text>
      
      <View className="gap-3">
        {referrals?.map((referral: any) => (
          <View key={referral.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-row items-center justify-between">
            <View>
              <Text className="font-bold text-gray-900">Friend signed up</Text>
              <Text className="text-xs text-gray-400">{new Date(referral.created_at).toLocaleDateString()}</Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${referral.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <Text className={`text-xs font-bold ${referral.status === 'completed' ? 'text-green-700' : 'text-yellow-700'}`}>
                {referral.status === 'completed' ? '+50 Points' : 'Pending'}
              </Text>
            </View>
          </View>
        ))}
        {(!referrals || referrals.length === 0) && (
          <View className="py-8 items-center">
            <Text className="text-gray-500">No referrals yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
