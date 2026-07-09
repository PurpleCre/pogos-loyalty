import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { useStores, Store } from '@/hooks/useStores';
import { useOrder } from '@/contexts/OrderContext';

export default function StorePickerScreen() {
  const { stores, loading, error } = useStores();
  const { deliveryLocation, setSelectedStore } = useOrder();
  const { address } = useLocalSearchParams<{ address: string }>();

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    router.push('/(app)/menu');
  };

  // Helper to calculate distance in km using Haversine formula
  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
  };

  // Dynamically calculate distance, delivery time, and sort stores
  const sortedStores = useMemo(() => {
    if (!deliveryLocation) return stores;
    
    const storesWithDistance = stores.map(store => {
      const computedDistanceKm = getDistanceInKm(
        deliveryLocation.latitude, 
        deliveryLocation.longitude, 
        store.latitude, 
        store.longitude
      );
      // Base 15 mins + ~3 mins per km
      const deliveryTimeMins = Math.round(15 + (computedDistanceKm * 3));
      return { ...store, computedDistanceKm, deliveryTimeMins };
    });
    
    return storesWithDistance.sort((a, b) => a.computedDistanceKm - b.computedDistanceKm);
  }, [stores, deliveryLocation]);


  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="bg-red-600 px-4 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold flex-1">Store Picker</Text>
      </View>

      {/* Address Header */}
      <View className="bg-white px-5 py-4 border-b border-gray-100 shadow-sm">
        <Text className="text-gray-500 text-sm font-medium mb-1">Delivery Address</Text>
        <View className="flex-row items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
          <MapPin size={18} color="#dc2626" className="mr-2" />
          <Text className="text-gray-800 flex-1 font-medium" numberOfLines={1}>
            {deliveryLocation ? (deliveryLocation.tag ? `${deliveryLocation.tag} - ${deliveryLocation.address}` : deliveryLocation.address) : "Location not set"}
          </Text>
        </View>
      </View>

      {/* Store List */}
      <ScrollView className="flex-1 px-5 pt-4">
        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#dc2626" />
          </View>
        ) : error ? (
          <View className="py-10 items-center">
            <Text className="text-red-500 font-medium text-center">Failed to load stores.</Text>
          </View>
        ) : (
          sortedStores.map((store: any, index) => (
            <View key={store.id} className="bg-white rounded-2xl mb-4 border border-gray-100 shadow-sm overflow-hidden">
              {store.image_url && (
                <Image 
                  source={{ uri: store.image_url }} 
                  className="w-full h-32 object-cover bg-gray-200"
                />
              )}
              <View className="p-5">
                <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-lg font-bold text-gray-900 mb-1">
                    {index + 1}. {store.name.replace("Pogo's ", "")} {store.computedDistanceKm !== undefined ? `(${store.computedDistanceKm.toFixed(1)} km)` : `(${store.distance_miles} mi)`}
                  </Text>
                  {store.deliveryTimeMins && (
                    <Text className="text-gray-500 text-sm font-medium">
                      Est. Delivery: ~{store.deliveryTimeMins} mins
                    </Text>
                  )}
                </View>
                <Text className={`font-bold mt-1 ${store.is_open ? 'text-green-600' : 'text-red-500'}`}>
                  {store.is_open ? 'Open' : 'Closed'}
                </Text>
              </View>
              
              <TouchableOpacity
                disabled={!store.is_open}
                onPress={() => handleSelectStore(store)}
                className={`py-3.5 rounded-xl items-center ${
                  store.is_open ? 'bg-red-600' : 'bg-gray-300'
                }`}
                activeOpacity={0.8}
              >
                <Text className={`font-bold text-lg ${store.is_open ? 'text-white' : 'text-gray-500'}`}>
                  Select for Delivery
                </Text>
              </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
