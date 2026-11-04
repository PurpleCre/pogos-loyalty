import { Text, View } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { useCart } from '@/contexts/CartContext';
export function CartStorageStatus() {
  const { hydrated, saving, storageError, retrySave, discardSavedCart } = useCart();
  if (!storageError && hydrated && !saving) return null;
  return <View className="p-4 bg-amber-50 rounded-xl my-3">
    <Text accessibilityRole="alert">{storageError || (saving ? 'Saving selections on this device…' : 'Restoring your saved selections…')}</Text>
    {storageError ? <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={retrySave} className="py-3">
      <Text className="text-red-700 font-bold">{hydrated ? 'Retry saving selections' : 'Retry restoring selections'}</Text>
    </TouchableOpacity> : null}
    {storageError && !hydrated ? <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={discardSavedCart} className="py-3"><Text className="text-red-700">Discard saved selections and start again</Text></TouchableOpacity> : null}
  </View>;
}
