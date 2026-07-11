import { Drawer } from 'expo-router/drawer';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';
import { Home, Gift, User, History, ShoppingBag, Truck, ShoppingCart } from 'lucide-react-native';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Redirect } from 'expo-router';

export default function AppLayout() {
  const { session, loading } = useAuth();
  usePushNotifications();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  // Allow public access, but we'll conditionally hide drawer items

  return (
    <Drawer 
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: '#e11d48',
        drawerInactiveTintColor: '#64748b',
        headerStyle: {
          backgroundColor: '#e11d48',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Drawer.Screen
        name="menu"
        options={{
          title: 'Store Menu',
          drawerIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
        }}
      />
      
      <Drawer.Screen
        name="cart"
        options={{
          title: 'My Cart',
          drawerIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
        }}
      />
      
      <Drawer.Screen
        name="profile"
        options={{
          title: 'Profile',
          drawerIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

      <Drawer.Screen
        name="dashboard"
        options={{
          title: 'Loyalty Hub',
          drawerIcon: ({ color, size }) => <Gift size={size} color={color} />,
          drawerItemStyle: { display: session ? 'flex' : 'none' },
        }}
      />

      <Drawer.Screen
        name="transactions"
        options={{
          title: 'History',
          drawerIcon: ({ color, size }) => <History size={size} color={color} />,
          drawerItemStyle: { display: session ? 'flex' : 'none' },
        }}
      />

      <Drawer.Screen
        name="order-tracking"
        options={{
          title: 'Track Orders',
          drawerIcon: ({ color, size }) => <Truck size={size} color={color} />,
          drawerItemStyle: { display: session ? 'flex' : 'none' },
        }}
      />

      {/* Hidden Screens (not shown in drawer) */}
      <Drawer.Screen
        name="rewards"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Rewards',
        }}
      />
      <Drawer.Screen
        name="achievements"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Achievements',
        }}
      />
      <Drawer.Screen
        name="referrals"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Referrals',
        }}
      />
      <Drawer.Screen
        name="admin"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Admin',
        }}
      />
      <Drawer.Screen
        name="order-success"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Order Success',
        }}
      />
    </Drawer>
  );
}


