import { Drawer, DrawerContentScrollView, DrawerItemList } from 'expo-router/drawer';
import { BrandLogo } from '@/components/BrandLogo';
import { colors } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { View, Text, ActivityIndicator } from 'react-native';
import { Home, Gift, User, History, ShoppingBag, Truck, ShoppingCart, Shield, Store } from 'lucide-react-native';
import { Redirect } from 'expo-router';

export default function AppLayout() {
  const { session, loading, userRole, requiresMfa, recoveryRequired } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (session && recoveryRequired) return <Redirect href="/auth/reset-password" />;
  if (session && requiresMfa) return <Redirect href="/auth/security" />;
  const isStaff = userRole === 'staff' || userRole === 'manager';
  const isAdmin = userRole === 'admin';
  const isLoggedIn = !!session;

  return (
    <Drawer
      drawerContent={props => <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 24, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}><BrandLogo size={78} /><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 12 }}>A little more Pogo’s.</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Your food. Your branch. Your rewards.</Text></View>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>}
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.brand['50'],
        drawerStyle: { backgroundColor: colors.surface, width: 300 },
        drawerItemStyle: { borderRadius: 16, marginHorizontal: 12, minHeight: 48 },
        drawerLabelStyle: { fontSize: 14, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.canvas },
        drawerInactiveTintColor: colors.muted,
        headerStyle: {
          backgroundColor: colors.primary,
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
      <Drawer.Screen name="share-points" options={{ drawerItemStyle: { display: 'none' }, title: 'Share Points' }} />
    </Drawer>
  );
}
