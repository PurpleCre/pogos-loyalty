import { Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { QrCode } from 'lucide-react-native';

export default function Scan() {
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <QrCode size={48} color="#dc2626" />
      <Text className="mt-5 text-xl font-bold text-slate-900">Receipt scanning is not available yet</Text>
      <Text className="mt-3 text-center text-slate-600">
        Please check with your Pogo’s branch about earning points on your purchase.
      </Text>
      <TouchableOpacity onPress={() => router.back()} className="mt-6 rounded-xl bg-red-600 px-6 py-3">
        <Text className="font-bold text-white">Go back</Text>
      </TouchableOpacity>
    </View>
  );
}
