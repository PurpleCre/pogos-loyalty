import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function SharePoints() {
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="text-xl font-bold text-slate-900">Points sharing is not available yet</Text>
      <Text className="mt-3 text-center text-slate-600">Your points balance has not changed.</Text>
      <TouchableOpacity onPress={() => router.back()} className="mt-6 rounded-xl bg-red-600 px-6 py-3">
        <Text className="font-bold text-white">Go back</Text>
      </TouchableOpacity>
    </View>
  );
}
