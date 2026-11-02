import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { ReadStatus } from '@/components/ReadStatus';
export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { userPoints, transactions, loading, fresh, refreshedAt, error, refetch } = useRewards();
  if (!user && !authLoading) return <Redirect href="/(auth)/login" />;
  return <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 20, paddingTop: 64 }}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void refetch(); }} />}>
    <Text className="text-red-600 font-bold text-2xl">Pogo’s loyalty</Text>
    <ReadStatus label="Points and recent activity" fresh={fresh} at={refreshedAt} error={error} loading={loading} onRefresh={() => { void refetch(); }} />
    <View className="bg-white border border-slate-200 rounded-xl p-5 my-3">
      <Text className="font-bold">{fresh ? 'Available points' : 'Last known available points'}</Text>
      <Text className="text-4xl font-bold my-3">{userPoints?.current_points?.toLocaleString() ?? 'Unconfirmed'}</Text>
      <Text>Held for rewards: {userPoints?.reserved_points?.toLocaleString() ?? 'Unconfirmed'}</Text>
      <Text className="mt-3 text-slate-600">Points settle after eligible payment and handover under your branch’s configured earning rules. Reservation and collection status must be checked online.</Text>
    </View>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/rewards')} className="p-4 bg-red-600 rounded-xl my-2"><Text className="text-white font-bold">View branch rewards and reservations</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/store-picker')} className="p-4 bg-white rounded-xl my-2"><Text className="text-red-700 font-bold">Browse a branch menu</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/order-tracking')} className="p-4 bg-white rounded-xl my-2"><Text className="text-red-700 font-bold">Track orders</Text></TouchableOpacity>
    <Text className="font-bold text-xl mt-5 mb-3">Recent points activity (latest 10)</Text>
    {transactions.map(row => <View key={row.id} className="p-4 bg-white rounded-xl mb-3">
      <Text className="font-bold">{row.transaction_type.replaceAll('_', ' ')}</Text>
      <Text>{row.points_earned} points credited · {row.points_redeemed} points debited</Text>
      <Text>{new Date(row.created_at).toLocaleString()}</Text>
    </View>)}
    {!transactions.length && fresh ? <Text className="my-4">No recent points activity was returned for this account.</Text> : null}
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/transactions')} className="py-4"><Text className="text-red-700 font-bold">View recent history</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/support')} className="py-4"><Text className="text-red-700 font-bold">Help with an order or account</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/profile')} className="py-4"><Text className="text-red-700 font-bold">Account and security</Text></TouchableOpacity>
  </ScrollView>;
}
