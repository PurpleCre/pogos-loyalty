import { Text, TouchableOpacity, View } from 'react-native';
export function ReadStatus({ fresh, at, error, loading, label, onRefresh }: {
  fresh: boolean; at: number | null; error?: boolean | string; loading?: boolean; label: string; onRefresh(): void;
}) {
  return <View className={`p-3 rounded-xl my-3 ${fresh ? 'bg-slate-100' : 'bg-amber-50 border border-amber-300'}`}>
    <Text accessibilityRole={fresh ? undefined : 'alert'}>{fresh ? `${label} refreshed` : error ? `Unable to refresh ${label.toLowerCase()}.` : `${label} needs verification.`}
      {at !== null ? ` Last refreshed ${new Date(at).toLocaleString()}.` : ' No verified data yet.'}
      {!fresh && at !== null ? ' Saved information may have changed.' : ''}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Refresh ${label.toLowerCase()}`} disabled={loading} onPress={onRefresh} className="py-3">
      <Text className="text-red-700 font-bold">{loading ? 'Checking…' : 'Refresh'}</Text>
    </TouchableOpacity>
  </View>;
}
