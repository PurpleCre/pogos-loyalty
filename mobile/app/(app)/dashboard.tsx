import { View, Text } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { router } from 'expo-router';
import { Scan } from 'lucide-react-native';

export default function Dashboard() {
  const { signOut, user } = useAuth();
  
  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-white items-center justify-center p-4">
      <Text className="text-2xl font-bold mb-4">Dashboard</Text>
      <Text className="mb-8 text-center text-slate-600">Welcome, {user?.email}</Text>
      
      <Button onPress={() => router.push('/scan')} className="mb-4 flex-row gap-2">
        <Scan color="white" size={20} />
        <Text className="text-white font-semibold">Scan QR Code</Text>
      </Button>

      <Button onPress={handleSignOut} variant="outline">
        Sign Out
      </Button>
    </View>
  );
}
