import { View, Text } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import type { PendingRewardCommand } from '@/lib/reward-redemption';
export function RewardRecovery({ pending, error, busy, onRecover }: { pending: PendingRewardCommand | null; error: string; busy: boolean; onRecover(): void }) {
  if (!pending && !error) return null;
  return <View className="bg-amber-50 border border-amber-300 p-4 rounded-xl mb-4">
    <Text className="font-bold">Previous reward action needs checking</Text>
    <Text className="mt-2">{error || `An interrupted ${pending?.request.kind === 'reserve' ? 'reservation' : pending?.request.action} may already have succeeded. Check it before starting another action.`}</Text>
    <TouchableOpacity disabled={busy} onPress={onRecover} className="bg-amber-200 p-3 rounded-lg mt-3"><Text>{busy ? 'Checking…' : 'Check previous reward action'}</Text></TouchableOpacity>
  </View>;
}
