import { View, Text, Image, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ShoppingCart, MapPin, User, Search, Menu } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useOrder } from '@/contexts/OrderContext';
import { LocationPickerModal } from '@/components/LocationPickerModal';

export default function LandingPage() {
  const { session } = useAuth();
  const { deliveryLocation } = useOrder();
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);

  const handleOrderNow = () => {
    if (deliveryLocation) {
      router.push('/store-picker');
    } else {
      setLocationModalVisible(true);
    }
  };
  
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1" bounces={false}>
        {/* Red Header */}
        <View className="bg-red-600 px-5 py-4 pt-14 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.push('/(app)/menu')} className="mr-4">
              <Menu color="white" size={28} />
            </TouchableOpacity>
            <Text className="text-white text-2xl font-black tracking-wider">POGO'S</Text>
          </View>
          <View className="flex-row items-center gap-5">
            <TouchableOpacity onPress={() => router.push(session ? '/(app)/profile' : '/(auth)/login?redirect=/')}>
              <User color="white" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(app)/cart')} className="relative">
              <ShoppingCart color="white" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Image */}
        <View className="w-full h-[400px] relative">
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80' }} 
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          {/* Gradient overlay */}
          <View className="absolute inset-0 bg-black/40" />
          
          <View className="absolute bottom-0 w-full p-8 items-center">
            <Text className="text-white text-4xl font-black text-center shadow-lg uppercase tracking-tight">
              Welcome to{'\n'}Pogo's!
            </Text>
            <Text className="text-white text-lg font-bold mt-3 shadow-sm">
              Satisfy Your Craving.
            </Text>
          </View>
        </View>

        {/* Main Content Area */}
        <View className="px-5 py-8 items-center bg-white">
          <TouchableOpacity 
            onPress={handleOrderNow}
            className="bg-red-600 w-full py-4 rounded-xl shadow-md items-center mb-8"
            activeOpacity={0.8}
          >
            <Text className="text-white text-xl font-black tracking-widest">ORDER NOW</Text>
          </TouchableOpacity>

          {/* Store Selection Card */}
          <View className="w-full bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-sm">
            <View className="flex-row items-center gap-3 mb-5">
              <View className="bg-red-100 p-2.5 rounded-full">
                <MapPin size={24} color="#dc2626" />
              </View>
              <Text className="text-xl font-bold text-slate-800">Find a Store Near You</Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => setLocationModalVisible(true)}
              className="bg-white border border-slate-200 rounded-xl flex-row items-center px-4 py-3 shadow-sm"
              activeOpacity={0.7}
            >
              <Text className={`flex-1 text-base ${deliveryLocation ? 'text-slate-800 font-bold' : 'text-slate-400'}`} numberOfLines={1}>
                {deliveryLocation ? (deliveryLocation.tag ? `${deliveryLocation.tag} - ${deliveryLocation.address}` : deliveryLocation.address) : "Set Delivery Location..."}
              </Text>
              <View className="p-1">
                <Search size={20} color="#dc2626" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Location Picker Modal */}
      <LocationPickerModal 
        visible={isLocationModalVisible} 
        onClose={() => setLocationModalVisible(false)} 
      />
    </SafeAreaView>
  );
}
