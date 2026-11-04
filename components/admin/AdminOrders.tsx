import { View, Text } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { router } from 'expo-router';
import { useOrders } from '@/hooks/useOrders';

export function AdminOrders({ stores }: { stores: { id: string; name: string }[] }) {
  const { activeOrders, error } = useOrders(true);
  return <View>
    <Text className="text-subtle mb-4">Open a branch to manage fulfilment, acknowledge cash or find an order for a refund.</Text>
    {error ? <Text className="text-red-700 mb-3">{error}</Text> : null}
    {stores.map(store => <TouchableOpacity key={store.id}
      onPress={() => router.push({ pathname: '/(app)/staff-dashboard', params: { storeId: store.id } })}
      className="p-5 bg-white rounded-xl border border-line mb-3">
      <Text className="font-bold text-lg">{store.name}</Text>
      <Text className="text-subtle mt-1">{activeOrders.filter(order => order.store_id === store.id).length} active orders</Text>
      <Text className="text-brand-800 mt-3 font-bold">Manage branch orders →</Text>
    </TouchableOpacity>)}
  </View>;
}
