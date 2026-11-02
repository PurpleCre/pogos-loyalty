import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
export function UnavailableFeature({ name }: { name: string }) {
  return <View className="flex-1 justify-center p-6 bg-white"><Text className="text-xl font-bold">{name} is not available in this release</Text>
    <Text className="mt-4">Use your account’s approved branch rewards and order history to check your points.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/(app)/dashboard')} className="py-4"><Text className="text-red-700 font-bold">Open loyalty account</Text></TouchableOpacity>
  </View>;
}
