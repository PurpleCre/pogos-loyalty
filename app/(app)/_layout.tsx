import { Tabs, Redirect } from 'expo-router';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';
import { Home, Gift, User, History } from 'lucide-react-native';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function ProtectedLayout() {
  const { session, loading } = useAuth();
  usePushNotifications();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#6366f1',
      tabBarInactiveTintColor: '#94a3b8',
      headerShown: false,
      tabBarStyle: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        height: 60,
        paddingBottom: 10,
        paddingTop: 10,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
    }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color }) => <Gift size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <History size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
        }}
      />
      {/* Hidden tabs - accessible via navigation but not shown in tab bar */}
      <Tabs.Screen
        name="achievements"
        options={{
          href: null,
          title: 'Achievements',
        }}
      />
      <Tabs.Screen
        name="referrals"
        options={{
          href: null,
          title: 'Referrals',
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null,
          title: 'Admin',
        }}
      />
    </Tabs>
  );
}

export default function AppLayout() {
  return (
    <AuthProvider>
      <ProtectedLayout />
    </AuthProvider>
  );
}
