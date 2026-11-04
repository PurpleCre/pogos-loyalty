import { router } from 'expo-router';
import { Gift } from 'lucide-react-native';
import { Screen, EmptyState } from '@/components/ui/screen';
export function UnavailableFeature({ name, description }: { name: string; description?: string }) {
  return <Screen title={name} centered><EmptyState icon={Gift} title={`${name} is not available yet`} description={description ?? 'Use your account’s approved branch rewards and order history to check your points.'} action="Open loyalty account" onAction={() => router.replace('/(app)/dashboard')} /></Screen>;
}
