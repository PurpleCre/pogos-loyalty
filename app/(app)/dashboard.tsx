import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { ReadStatus } from '@/components/ReadStatus';
import { Screen, PageHeading, Card, ActionRow, EmptyState, SectionHeading } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { colors } from '@/lib/theme';
import { Gift, ShoppingBag, Truck, History, ShieldCheck, LifeBuoy } from 'lucide-react-native';
export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { userPoints, transactions, loading, fresh, refreshedAt, error, refetch } = useRewards();
  if (!user && !authLoading) return <Redirect href="/(auth)/login" />;
  return <Screen title="Your loyalty account" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />}>
    <PageHeading eyebrow="A LITTLE MORE POGO’S" title="Good to have you back." subtitle="Your points, rewards and recent visits, together." />
    <View className="bg-brand-950 rounded-3xl p-6">
      <View className="flex-row items-center justify-between"><Text className="text-brand-100 text-sm font-semibold flex-1">{fresh ? 'Available points' : 'Last known available points'}</Text><Gift size={24} color={colors.accent} /></View>
      <Text className="text-white text-5xl font-extrabold tracking-tight my-4">{userPoints?.current_points?.toLocaleString() ?? 'Unconfirmed'}</Text>
      <Text className="text-brand-100 text-sm">Held for rewards: {userPoints?.reserved_points?.toLocaleString() ?? 'Unconfirmed'}</Text>
      <Button onPress={() => router.push('/(app)/rewards')} className="bg-white mt-6" textClassName="text-brand-900">Explore branch rewards</Button>
    </View>
    <ReadStatus label="Points and recent activity" fresh={fresh} at={refreshedAt} error={error} loading={loading} onRefresh={() => { void refetch(); }} />
    <Text className="text-subtle text-sm leading-6 mb-5">Points settle after eligible payment and handover under your branch’s configured earning rules. Check reservations and collection status online.</Text>
    <Card><ActionRow icon={ShoppingBag} title="Find your next favourite" detail="Browse a branch menu." onPress={() => router.push('/store-picker')} /><ActionRow icon={Truck} title="Your orders" detail="Check current status and order references." onPress={() => router.push('/(app)/order-tracking')} /></Card>
    <SectionHeading title="Recent points activity" detail="Your latest 10 entries" />
    {transactions.map(row => <Card key={row.id}>
      <Text className="font-bold text-ink capitalize">{row.transaction_type.replaceAll('_', ' ')}</Text>
      <Text className="text-brand-800 font-semibold mt-2">+{row.points_earned} credited · −{row.points_redeemed} debited</Text>
      <Text className="text-subtle text-xs mt-2">{new Date(row.created_at).toLocaleString()}</Text>
    </Card>)}
    {!transactions.length && fresh ? <EmptyState icon={History} title="Your story starts here" description="There’s no recent points activity for this account yet. Eligible visits will appear here once confirmed." /> : null}
    <Button variant="outline" onPress={() => router.push('/(app)/transactions')}>View recent history</Button>
    <Card style={{ marginTop: 24 }}><ActionRow icon={ShieldCheck} title="Account and security" onPress={() => router.push('/(app)/profile')} /><ActionRow icon={LifeBuoy} title="Help with an order or account" onPress={() => router.push('/support')} /></Card>
  </Screen>;
}
