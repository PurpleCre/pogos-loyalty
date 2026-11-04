import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
export function DeveloperAccessNotice() {
  const { developerAccess, stopDeveloperAccess } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!developerAccess) return null;
  return <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff1d6', borderBottomWidth: 1, borderBottomColor: '#e4c38a', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Text style={{ flex: 1, color: '#71420d', fontSize: 12, fontWeight: '700' }}>DEVELOPMENT · MFA BYPASS ACTIVE</Text>
    <Button size="sm" variant="outline" isLoading={busy} onPress={() => {
      setBusy(true); void stopDeveloperAccess().catch(() => undefined).finally(() => { setBusy(false); router.replace('/auth/security'); });
    }}>End bypass</Button>
  </View>;
}
