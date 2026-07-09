import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { X, MapPin, Search, Star, Home, Briefcase, Plus } from 'lucide-react-native';
import { useOrder, LocationData } from '@/contexts/OrderContext';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LocationPickerModal({ visible, onClose }: LocationPickerModalProps) {
  const { savedLocations, saveLocation, setDeliveryLocation } = useOrder();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Default to City Center if no location
  const [region, setRegion] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const [selectedCoordinate, setSelectedCoordinate] = useState<{latitude: number, longitude: number} | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const handleMapPress = (e: any) => {
    setSelectedCoordinate(e.nativeEvent.coordinate);
    // In a real app, you would reverse-geocode this coordinate to an address string here.
    // For this prototype, we'll just set a placeholder address.
    setAddressInput('Selected from Map');
  };

  const handleSelectSavedLocation = (location: LocationData) => {
    setDeliveryLocation(location);
    onClose();
  };

  const handleConfirmNewLocation = async () => {
    if (!selectedCoordinate) return;

    const newLocation: LocationData = {
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      address: addressInput || 'Unknown Address',
      latitude: selectedCoordinate.latitude,
      longitude: selectedCoordinate.longitude,
      tag: tagInput || undefined,
    };

    if (tagInput) {
      await saveLocation(newLocation);
    }
    setDeliveryLocation(newLocation);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-xl font-bold text-gray-900">Set Delivery Location</Text>
          <TouchableOpacity onPress={onClose} className="p-2 -mr-2 bg-gray-100 rounded-full">
            <X size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" bounces={false}>
          {/* Saved Locations */}
          {savedLocations.length > 0 && (
            <View className="px-5 py-4">
              <Text className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Saved Locations</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
                {savedLocations.map((loc) => {
                  let Icon = Star;
                  if (loc.tag?.toLowerCase() === 'home') Icon = Home;
                  if (loc.tag?.toLowerCase() === 'work') Icon = Briefcase;
                  
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      onPress={() => handleSelectSavedLocation(loc)}
                      className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mr-3 items-center flex-row shadow-sm"
                    >
                      <View className="bg-red-100 p-2 rounded-full mr-3">
                        <Icon size={18} color="#dc2626" />
                      </View>
                      <View>
                        <Text className="font-bold text-gray-900">{loc.tag || 'Saved'}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>{loc.address}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Map Section */}
          <View className="px-5 py-2">
            <Text className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Pick on Map</Text>
            <View className="h-[250px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative">
              <MapView 
                style={StyleSheet.absoluteFillObject}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={handleMapPress}
              >
                {selectedCoordinate && (
                  <Marker coordinate={selectedCoordinate} pinColor="#dc2626" />
                )}
              </MapView>
              {!selectedCoordinate && (
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
              <Text className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Location Details</Text>
              
              <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                <View>
                  <Text className="text-xs text-gray-500 font-medium mb-1.5">Delivery Address</Text>
                  <View className="flex-row items-center bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                    <MapPin size={16} color="#dc2626" className="mr-2" />
                    <TextInput 
                      value={addressInput}
                      onChangeText={setAddressInput}
                      placeholder="e.g. 123 Main St"
                      className="flex-1 text-gray-900 font-medium"
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-xs text-gray-500 font-medium mb-1.5">Save as (Optional)</Text>
                  <View className="flex-row items-center bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                    <Star size={16} color="#eab308" className="mr-2" />
                    <TextInput 
                      value={tagInput}
                      onChangeText={setTagInput}
                      placeholder="e.g. Home, Work, Gym"
                      className="flex-1 text-gray-900 font-medium"
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handleConfirmNewLocation}
                  className="bg-red-600 rounded-lg py-3.5 items-center shadow-sm mt-2"
                >
                  <Text className="text-white font-bold text-lg">Confirm Location</Text>
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
