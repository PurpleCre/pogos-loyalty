import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { legacyQueueNeedsReview } from '@/lib/legacy-offline';
export function LegacyOfflineNotice() {
  const [review, setReview] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => { void legacyQueueNeedsReview(AsyncStorage).then(value => { if (active) setReview(value); }).catch(() => { if (active) setReview(true); }); };
    load(); const subscription = AppState.addEventListener('change', next => { if (next === 'active') load(); });
    return () => { active = false; subscription.remove(); };
  }, []);
  if (!review) return null;
  return <View className="p-4 bg-amber-100"><Text accessibilityRole="alert">This device has older activity that needs investigation. Check any interrupted order or reward before repeating it. The saved activity has been preserved.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/support')} className="py-3"><Text className="font-bold">Get help with unconfirmed activity</Text></TouchableOpacity>
  </View>;
}
