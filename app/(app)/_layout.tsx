import { Drawer } from 'expo-router/drawer';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';
import { Home, Gift, User, History, ShoppingBag, Truck, ShoppingCart, Shield, Store } from 'lucide-react-native';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Redirect } from 'expo-router';

export default function AppLayout() {
  const { session, loading, userRole } = useAuth();
  usePushNotifications();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  const isStaff = userRole === 'staff';
  const isAdmin = userRole === 'admin';
  const isLoggedIn = !!session;

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
          drawerItemStyle: { display: isLoggedIn ? 'flex' : 'none' },
        }}
      />

      <Drawer.Screen
        name="transactions"
        options={{
          title: 'History',
          drawerIcon: ({ color, size }) => <History size={size} color={color} />,
          drawerItemStyle: { display: isLoggedIn ? 'flex' : 'none' },
        }}
      />

      <Drawer.Screen
        name="order-tracking"
        options={{
          title: 'Track Orders',
          drawerIcon: ({ color, size }) => <Truck size={size} color={color} />,
          drawerItemStyle: { display: isLoggedIn ? 'flex' : 'none' },
        }}
      />

      {/* Staff Dashboard - visible to staff and admins */}
      <Drawer.Screen
        name="staff-dashboard"
        options={{
          title: 'Staff Dashboard',
          drawerIcon: ({ color, size }) => <Store size={size} color={color} />,
          drawerItemStyle: { display: (isStaff || isAdmin) ? 'flex' : 'none' },
        }}
      />

      {/* Admin Panel - visible to admins only */}
      <Drawer.Screen
        name="admin"
        options={{
          title: 'Admin Panel',
          drawerIcon: ({ color, size }) => <Shield size={size} color={color} />,
          drawerItemStyle: { display: isAdmin ? 'flex' : 'none' },
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
        name="order-success"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Order Success',
        }}
      />
    </Drawer>
  );
}
