import { Slot } from 'expo-router';
import { AuthProvider } from '@/hooks/useAuth';

export default function AuthLayout() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}
