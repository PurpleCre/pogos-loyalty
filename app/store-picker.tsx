import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, ChevronDown } from 'lucide-react-native';
import { useStores, Store } from '@/hooks/useStores';
import { useOrder } from '@/contexts/OrderContext';
import { ReadStatus } from '@/components/ReadStatus';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { CatalogueImage } from '@/components/CatalogueImage';
import { Screen, PageHeading, Card, EmptyState, LoadingState } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { colors } from '@/lib/theme';

export default function StorePickerScreen() {
  const { width } = useWindowDimensions();
  const { stores, loading, error, fresh, refreshedAt, refetch } = useStores();
  const { deliveryLocation, setSelectedStore } = useOrder();
  const { address } = useLocalSearchParams<{ address: string }>();
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);

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
      if (store.latitude === null || store.longitude === null) {
        return { ...store, computedDistanceKm: undefined };
      }
      const computedDistanceKm = getDistanceInKm(
        deliveryLocation.latitude, 
        deliveryLocation.longitude, 
        store.latitude, 
        store.longitude
      );
      return { ...store, computedDistanceKm };
    });
    
    return storesWithDistance.sort((a, b) => (a.computedDistanceKm ?? Infinity) - (b.computedDistanceKm ?? Infinity));
  }, [stores, deliveryLocation]);


  return <Screen title="Choose a branch" wide>
    <PageHeading eyebrow="MSASA · KAMFINSA · WESTGATE" title="Your Pogo’s, nearby." subtitle="One menu. Three familiar places. Choose where you’d like to order." />
    <Card><TouchableOpacity accessibilityRole="button" onPress={() => setLocationModalVisible(true)} className="flex-row items-center gap-3 min-h-[52px]">
      <View className="p-3 rounded-2xl bg-brand-50"><MapPin size={22} color={colors.primary} /></View>
      <View className="flex-1"><Text className="text-subtle text-xs mb-1">Your delivery location</Text><Text className="text-ink font-semibold">{deliveryLocation ? (deliveryLocation.tag ? `${deliveryLocation.tag} · ${deliveryLocation.address}` : deliveryLocation.address) : 'Add an address or browse first'}</Text></View><ChevronDown size={20} color={colors.primary} />
    </TouchableOpacity></Card>
    <ReadStatus label="Branches" fresh={fresh} at={refreshedAt} loading={loading} error={!!error} onRefresh={() => { void refetch(); }} />
    {loading && !stores.length ? <LoadingState label="Finding Pogo’s branches…" /> : null}
    {!loading && !stores.length ? <EmptyState icon={MapPin} title={error ? 'We couldn’t load the branches' : 'No branches to show yet'} description="Check your connection and refresh. Branch details need to be confirmed online." action="Refresh branches" onAction={() => { void refetch(); }} /> : null}
    <View style={{ flexDirection: width > 960 ? 'row' : 'column', gap: 20 }}>
      {sortedStores.map((store: Store & { computedDistanceKm?: number }) => <View key={store.id} style={{ flex: 1 }} className="bg-white rounded-3xl overflow-hidden border border-line">
        {store.image_url ? <CatalogueImage uri={store.image_url} label={store.name} className="w-full h-40" contentFit="cover" /> : null}
        <View className="p-5"><View className="flex-row items-center justify-between gap-3 mb-3"><Text className="text-2xl font-extrabold text-ink tracking-tight flex-1">{store.name.replace("Pogo's ", '')}</Text>
          <View className={`rounded-full px-3 py-2 ${fresh && store.is_open ? 'bg-brand-50' : 'bg-amber-50'}`}><Text className={`text-xs font-semibold ${fresh && store.is_open ? 'text-brand-800' : 'text-amber-900'}`}>{fresh ? store.is_open ? 'Reported open' : 'Reported closed' : 'Hours unverified'}</Text></View>
        </View>
        <Text className="text-subtle text-sm leading-6 mb-2">{store.address || 'Address awaiting confirmation.'}</Text>
        {store.computedDistanceKm !== undefined ? <Text className="text-subtle text-xs mb-3">{store.computedDistanceKm.toFixed(1)} km from your selected pin</Text> : null}
        <Button onPress={() => handleSelectStore(store)} variant={store.is_open ? 'default' : 'outline'} className="mt-3">Browse branch menu</Button>
        </View>
      </View>)}
    </View>
    <Text className="text-subtle text-xs leading-5 mt-5">You can browse a closed branch’s menu. Checkout confirms opening status, delivery coverage and whether the branch is accepting orders.</Text>
    <LocationPickerModal visible={isLocationModalVisible} onClose={() => setLocationModalVisible(false)} />
  </Screen>;
}
