import { logPrivateError } from '@/lib/privacy-logging';
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, Platform } from 'react-native';
import { Input as TextInput } from '@/components/ui/input';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import MapView, { Marker } from '@/components/LocationMap';
import { X, MapPin, Search, Star, Home, Briefcase, Plus } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useOrder, LocationData } from '@/contexts/OrderContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Button } from '@/components/ui/button';
interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  initialAddress?: string;
}

export function LocationPickerModal({ visible, onClose, initialAddress }: LocationPickerModalProps) {
  const { savedLocations, saveLocation, deliveryLocation, setDeliveryLocation } = useOrder();
  const [locationError, setLocationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const generation = React.useRef(0);
  const { user } = useAuth();
  const owner = React.useRef(user?.id); owner.current = user?.id;
  const currentLocation = React.useRef({ location: deliveryLocation, initialAddress }); currentLocation.current = { location: deliveryLocation, initialAddress };
  
  // Harare is a map viewport, not a delivery address or coverage promise.
  const [region, setRegion] = useState({
    latitude: -17.8252,
    longitude: 31.0335,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const [selectedCoordinate, setSelectedCoordinate] = useState<{latitude: number, longitude: number} | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    ++generation.current;
    if (visible) {
      const { location: existing, initialAddress: draftAddress } = currentLocation.current;
      setSelectedCoordinate(existing ? { latitude: existing.latitude, longitude: existing.longitude } : null);
      setAddressInput(draftAddress ?? existing?.address ?? ''); setTagInput(''); setLocationError(''); setSaving(false); setLocating(false); setLocationAllowed(false);
      if (existing) setRegion(previous => ({ ...previous, latitude: existing.latitude, longitude: existing.longitude }));
    }
    return () => { ++generation.current; };
  }, [visible, user?.id]);

  const handleCurrentLocation = async () => {
    if (locating) return;
    const version = generation.current;
    setLocating(true); setLocationError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (generation.current === version) setLocationError('Location permission is off. You can choose a map pin and enter your address manually.');
        return;
      }
      if (generation.current !== version) return;
      setLocationAllowed(true);
      const location = await Location.getLastKnownPositionAsync({}) ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (location && generation.current === version) {
        setSelectedCoordinate({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        setRegion({ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
      }
    } catch (error) {
      logPrivateError('Error fetching location:', error);
      if (generation.current === version) setLocationError('We couldn’t find your location. Choose a pin manually and enter your address.');
    } finally {
      if (generation.current === version) setLocating(false);
    }
  };

  const handleMapPress = (e: any) => {
    setSelectedCoordinate(e.nativeEvent.coordinate);
    setLocationError('');
  };

  const handleSelectSavedLocation = (location: LocationData) => {
    setDeliveryLocation(location);
    onClose();
  };

  const handleConfirmNewLocation = async () => {
    if (!selectedCoordinate || saving) return;
    if (addressInput.trim().length < 5 || ['selected from map', 'unknown address'].includes(addressInput.trim().toLowerCase())) { setLocationError('Enter a written delivery address and landmarks for this map pin.'); return; }
    const version = generation.current; const account = user?.id;
    setSaving(true); setLocationError('');
    try {
      const next: LocationData = { id: Math.random().toString(36).slice(2), address: addressInput.trim(), ...selectedCoordinate, tag: tagInput.trim() || undefined };
      const saved = tagInput.trim() ? await saveLocation(next) : next;
      if (version !== generation.current || owner.current !== account) return;
      if (!saved) { setLocationError('The location could not be saved. Retry, or use it without saving a label.'); return; }
      setDeliveryLocation(saved); onClose();
    } finally { if (version === generation.current) setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-line">
          <Text className="text-xl font-bold text-ink">Set Delivery Location</Text>
          <TouchableOpacity accessibilityLabel="Close delivery location" onPress={onClose} className="p-2 -mr-2 bg-gray-100 rounded-full">
            <X size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {locationError ? <Text accessibilityRole="alert" className="p-4 text-amber-800">{locationError}</Text> : null}
          <Text className="p-4 text-subtle">Choose a pin and a written address. The branch confirms delivery coverage in your online quote.</Text>
          {/* Saved Locations */}
          {savedLocations.length > 0 && (
            <View className="px-5 py-4">
              <Text className="text-sm font-bold text-subtle uppercase tracking-wider mb-3">Saved Locations</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
                {savedLocations.map((loc) => {
                  let Icon = Star;
                  if (loc.tag?.toLowerCase() === 'home') Icon = Home;
                  if (loc.tag?.toLowerCase() === 'work') Icon = Briefcase;
                  
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      onPress={() => handleSelectSavedLocation(loc)}
                      className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mr-3 items-center flex-row shadow-sm"
                    >
                      <View className="bg-brand-100 p-2 rounded-full mr-3">
                        <Icon size={18} color="#174d45" />
                      </View>
                      <View>
                        <Text className="font-bold text-ink">{loc.tag || 'Saved'}</Text>
                        <Text className="text-xs text-subtle mt-0.5" numberOfLines={1}>{loc.address}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Map Section */}
          <View className="px-5 py-2">
            <Text className="text-sm font-bold text-subtle uppercase tracking-wider mb-3">{Platform.OS === 'web' ? 'Set your location pin' : 'Pick on map'}</Text>
            {Platform.OS !== 'web' ? <Button variant="outline" isLoading={locating} onPress={() => { void handleCurrentLocation(); }} className="mb-3">Use my current location</Button> : null}
            <View className="h-[250px] rounded-2xl overflow-hidden border border-line shadow-sm relative">
              <MapView 
                style={StyleSheet.absoluteFill}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={handleMapPress}
                showsUserLocation={locationAllowed}
                showsMyLocationButton={locationAllowed}
              >
                {selectedCoordinate && (
                  <Marker coordinate={selectedCoordinate} pinColor="#dc2626" />
                )}
              </MapView>
              {!selectedCoordinate && Platform.OS !== 'web' && (
                <View className="absolute inset-0 items-center justify-center pointer-events-none">
                  <View className="bg-black/60 px-3 py-1.5 rounded-full">
                    <Text className="text-white text-xs font-medium">Tap map to set pin</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* New Location Details */}
          {selectedCoordinate && (
            <View className="px-5 py-4">
              <Text className="text-sm font-bold text-subtle uppercase tracking-wider mb-3">Location Details</Text>
              
              <View className="bg-canvas border border-line rounded-xl p-4 space-y-4">
                <View>
                  <Text className="text-xs text-subtle font-medium mb-1.5">Delivery Address</Text>
                  <View className="flex-row items-center bg-white border border-line rounded-lg px-3 py-2.5">
                    <MapPin size={16} color="#174d45" className="mr-2" />
                    <TextInput 
                      value={addressInput}
                      onChangeText={setAddressInput}
                      accessibilityLabel="Written delivery address" maxLength={500} placeholder="Street, suburb and useful landmarks"
                      className="flex-1 text-ink font-medium"
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-xs text-subtle font-medium mb-1.5">Save as (Optional)</Text>
                  <View className="flex-row items-center bg-white border border-line rounded-lg px-3 py-2.5">
                    <Star size={16} color="#eab308" className="mr-2" />
                    <TextInput 
                      value={tagInput}
                      accessibilityLabel="Optional saved location label" maxLength={50}
                      onChangeText={setTagInput}
                      placeholder="e.g. Home, Work, Gym"
                      className="flex-1 text-ink font-medium"
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  accessibilityRole="button" disabled={saving}
                  onPress={handleConfirmNewLocation}
                  className="bg-brand-800 rounded-lg py-3.5 items-center shadow-sm mt-2"
                >
                  <Text className="text-white font-bold text-lg">{saving ? 'Saving…' : 'Confirm Location'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
