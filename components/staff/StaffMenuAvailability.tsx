import { View, Text, Switch, TextInput, ActivityIndicator, ScrollView, TouchableOpacity, Image } from 'react-native';
import { StaffMenuItem } from '@/hooks/useStaff';
import { Search, UtensilsCrossed, AlertTriangle } from 'lucide-react-native';
import { useState, useMemo } from 'react';

interface StaffMenuAvailabilityProps {
  items: StaffMenuItem[];
  isLoading: boolean;
  onToggleAvailability: (itemId: string, isAvailable: boolean) => Promise<void>;
}

export function StaffMenuAvailability({ items, isLoading, onToggleAvailability }: StaffMenuAvailabilityProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    items.forEach(item => {
      if (item.category) {
        cats.set(item.category_id, (item.category as any)?.name || 'Uncategorized');
      }
    });
    return Array.from(cats.entries());
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    
    if (activeCategory !== 'all') {
      result = result.filter(item => item.category_id === activeCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [items, activeCategory, searchQuery]);

  const unavailableCount = items.filter(i => !i.is_available).length;

  if (isLoading) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View className="gap-4">
      {/* Search Bar */}
      <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center gap-3">
        <Search size={18} color="#9ca3af" />
        <TextInput
          placeholder="Search menu items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="flex-1 text-base text-gray-900"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Unavailable Warning */}
      {unavailableCount > 0 && (
        <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex-row items-center gap-3">
          <AlertTriangle size={18} color="#d97706" />
          <Text className="text-amber-700 font-medium text-sm flex-1">
            {unavailableCount} item{unavailableCount > 1 ? 's' : ''} currently marked as unavailable
          </Text>
        </View>
      )}

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-full mr-2 border ${
            activeCategory === 'all' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
          }`}
        >
          <Text className={`font-medium ${activeCategory === 'all' ? 'text-white' : 'text-gray-600'}`}>All</Text>
        </TouchableOpacity>
        {categories.map(([catId, catName]) => (
          <TouchableOpacity
            key={catId}
            onPress={() => setActiveCategory(catId)}
            className={`px-4 py-2 rounded-full mr-2 border ${
              activeCategory === catId ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
            }`}
          >
            <Text className={`font-medium ${activeCategory === catId ? 'text-white' : 'text-gray-600'}`}>{catName}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Menu Items List */}
      {filteredItems.map(item => (
        <View 
          key={item.id} 
          className={`bg-white rounded-xl border overflow-hidden flex-row items-center ${
            item.is_available ? 'border-gray-100' : 'border-amber-200 bg-amber-50/30'
          }`}
        >
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} className="w-16 h-16 bg-gray-100" resizeMode="cover" />
          ) : (
            <View className="w-16 h-16 bg-gray-100 items-center justify-center">
              <UtensilsCrossed size={20} color="#d1d5db" />
            </View>
          )}
          
          <View className="flex-1 px-3 py-2">
            <Text className={`font-bold text-sm ${item.is_available ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
              {item.name}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-xs text-gray-500">${item.price.toFixed(2)}</Text>
              <Text className="text-xs text-gray-400">•</Text>
              <Text className="text-xs text-gray-400">{(item.category as any)?.name}</Text>
            </View>
          </View>

          <View className="pr-4 items-center">
            <Switch
              value={item.is_available}
              onValueChange={(value) => onToggleAvailability(item.id, value)}
              trackColor={{ false: '#d1d5db', true: '#bbf7d0' }}
              thumbColor={item.is_available ? '#22c55e' : '#9ca3af'}
            />
            <Text className={`text-[10px] mt-0.5 font-medium ${item.is_available ? 'text-green-600' : 'text-gray-400'}`}>
              {item.is_available ? 'Available' : '86\'d'}
            </Text>
          </View>
        </View>
      ))}

      {filteredItems.length === 0 && (
        <View className="py-8 items-center">
          <Text className="text-gray-500 text-sm">No menu items found.</Text>
        </View>
      )}
    </View>
  );
}
