import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Send, Users, Sparkles } from 'lucide-react-native';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRewards } from '@/hooks/useRewards';

export default function SharePointsScreen() {
  const { userPoints, sharePoints } = useRewards();
  const [email, setEmail] = useState('');
  const [pointsStr, setPointsStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPoints = userPoints?.current_points || 0;

  const handleShare = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter a recipient email address.');
      return;
    }

    const points = parseInt(pointsStr, 10);
    if (isNaN(points) || points <= 0) {
      Alert.alert('Error', 'Please enter a valid number of points.');
      return;
    }

    if (points > currentPoints) {
      Alert.alert('Error', "You don't have enough points to share that amount.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await sharePoints(email.trim().toLowerCase(), points);
      
      if (result.error) {
        Alert.alert('Transfer Failed', result.error);
      } else {
        Alert.alert(
          'Success!', 
          `You successfully sent ${points} points to ${email}.`,
          [{ text: 'Great', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="bg-red-600 px-4 py-4 flex-row items-center rounded-b-3xl shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold flex-1">Share Points</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-5 pt-6 pb-10" keyboardShouldPersistTaps="handled">
          
          {/* Current Points Info */}
          <View className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden mb-8">
            <View className="flex-row justify-between items-start z-10">
              <View>
                <Text className="text-slate-500 text-sm uppercase tracking-wider font-semibold mb-1">Your Balance</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-slate-900 text-4xl font-black">{currentPoints.toLocaleString()}</Text>
                  <Text className="text-red-600 text-lg font-bold ml-1"> pts</Text>
                </View>
              </View>
              <View className="w-12 h-12 rounded-2xl bg-purple-50 items-center justify-center border border-purple-100">
                <Sparkles size={24} color="#a855f7" />
              </View>
            </View>
          </View>

          {/* Form */}
          <Text className="text-xl font-bold text-slate-900 mb-4">Send to a Friend</Text>
          
          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm mb-6">
            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-700 mb-1.5">Friend's Email</Text>
              <View className="flex-row items-center">
                <View className="absolute left-3 z-10">
                  <Users size={18} color="#94a3b8" />
                </View>
                <Input
                  placeholder="friend@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  className="pl-10 h-12 text-base"
                />
              </View>
            </View>

            <View className="mb-2">
              <Text className="text-sm font-semibold text-slate-700 mb-1.5">Points to Send</Text>
              <View className="flex-row items-center mb-1">
                <Input
                  placeholder="e.g., 500"
                  keyboardType="number-pad"
                  value={pointsStr}
                  onChangeText={setPointsStr}
                  className="flex-1 h-12 text-base font-bold text-slate-900"
                />
              </View>
              <Text className="text-xs text-slate-500">
                Enter the exact amount of points you wish to share.
              </Text>
            </View>
          </View>

          <Button 
            onPress={handleShare} 
            isLoading={isSubmitting}
            disabled={!email || !pointsStr || isSubmitting}
            className={`rounded-2xl h-14 shadow-sm flex-row items-center justify-center ${
              !email || !pointsStr ? 'bg-slate-300' : 'bg-purple-600'
            }`}
            textClassName="text-white text-lg font-bold ml-2"
          >
            {!isSubmitting && <Send size={20} color="#fff" className="mr-2" />}
            Confirm Transfer
          </Button>
          
          <View className="items-center mt-6">
            <Text className="text-xs text-slate-400 text-center px-4">
              Points transfers are final. Please ensure you have the correct email address for your friend.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
