import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { CheckCircle2, RefreshCw, CloudOff } from 'lucide-react-native';
import { colors } from '@/lib/theme';
export function ReadStatus({ fresh, at, error, loading, label, onRefresh }: {
  fresh: boolean; at: number | null; error?: boolean | string; loading?: boolean; label: string; onRefresh(): void;
}) {
  const Icon = fresh ? CheckCircle2 : CloudOff;
  return <View style={[styles.container, !fresh && styles.stale]}>
    <Icon size={18} color={fresh ? colors.primary : colors.warning} style={{ marginTop: 2 }} />
    <View style={{ flex: 1 }}>
      <Text accessibilityRole={fresh ? undefined : 'alert'} style={[styles.title, !fresh && { color: colors.warning }]}>{fresh ? `${label} up to date` : error ? `Unable to refresh ${label.toLowerCase()}` : `${label} needs verification`}</Text>
      <Text style={styles.detail}>{at !== null ? `Last checked ${new Date(at).toLocaleString()}.` : 'No verified data yet.'}{!fresh && at !== null ? ' Saved information may have changed.' : ''}</Text>
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Refresh ${label.toLowerCase()}`} accessibilityState={{ disabled: !!loading }} disabled={loading} onPress={onRefresh} style={styles.refresh}>
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <RefreshCw size={18} color={colors.primary} />}<Text style={styles.refreshText}>{loading ? 'Checking' : 'Refresh'}</Text>
    </TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.brand['50'], padding: 14, borderRadius: 16, marginVertical: 16, borderWidth: 1, borderColor: colors.brand['100'] },
  stale: { backgroundColor: '#fffbeb', borderColor: '#f3d99b' },
  title: { color: colors.primary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  refresh: { alignItems: 'center', justifyContent: 'center', minWidth: 50, minHeight: 44, gap: 3 },
  refreshText: { fontSize: 10, fontWeight: '700', color: colors.primary },
});
