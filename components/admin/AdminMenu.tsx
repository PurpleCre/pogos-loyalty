import { View, Text, TouchableOpacity, Image, Modal, TextInput, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useMenu, MenuItem } from '@/hooks/useMenu';
import { Plus, Edit2, Trash2, X } from 'lucide-react-native';

export function AdminMenu() {
  const { categories, items, addMenuItem, updateMenuItem, deleteMenuItem } = useMenu(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setImageUrl('');
    setIsAvailable(true);
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || '');
    setPrice(item.price.toString());
    setCategoryId(item.category_id);
    setImageUrl(item.image_url || '');
    setIsAvailable(item.is_available);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !price || !categoryId) {
      Alert.alert('Error', 'Please fill in name, price, and category');
      return;
    }

    setIsSubmitting(true);
    const parsedPrice = parseFloat(price);

    const itemData = {
      name,
      description,
      price: isNaN(parsedPrice) ? 0 : parsedPrice,
      category_id: categoryId,
      image_url: imageUrl,
      is_available: isAvailable,
    };

    let result;
    if (editingItem) {
      result = await updateMenuItem(editingItem.id, itemData);
    } else {
      result = await addMenuItem(itemData);
    }

    setIsSubmitting(false);

    if (result.success) {
      setModalVisible(false);
      resetForm();
    } else {
      Alert.alert('Error', result.error || 'Failed to save menu item');
    }
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            const result = await deleteMenuItem(item.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  return (
    <View className="gap-4 pb-8">
      <TouchableOpacity 
        onPress={openAddModal}
        className="flex-row items-center justify-center bg-indigo-600 rounded-xl py-3.5 mb-2"
      >
        <Plus size={20} color="white" className="mr-2" />
        <Text className="text-white font-bold">Add Menu Item</Text>
      </TouchableOpacity>

      {categories.map(category => (
        <View key={category.id} className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{category.name}</Text>
          
          <View className="gap-2">
            {items.filter(i => i.category_id === category.id).map(item => (
              <View key={item.id} className={`bg-white p-3 rounded-xl border border-gray-100 flex-row items-center ${!item.is_available ? 'opacity-60' : ''}`}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} className="w-12 h-12 rounded-lg bg-gray-100 mr-3" />
                ) : (
                  <View className="w-12 h-12 rounded-lg bg-gray-100 mr-3 items-center justify-center">
                    <Text className="text-gray-400 text-xs">No img</Text>
                  </View>
                )}
                
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="font-bold text-gray-900">{item.name}</Text>
                    {!item.is_available && (
                      <View className="bg-gray-200 px-2 py-0.5 rounded ml-2">
                        <Text className="text-[10px] font-bold text-gray-600 uppercase">Hidden</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-indigo-600 font-semibold">${item.price.toFixed(2)}</Text>
                </View>
                
                <View className="flex-row gap-2">
                  <TouchableOpacity 
                    onPress={() => openEditModal(item)}
                    className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center"
                  >
                    <Edit2 size={14} color="#4f46e5" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleDelete(item)}
                    className="w-8 h-8 bg-red-50 rounded-full items-center justify-center"
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {items.filter(i => i.category_id === category.id).length === 0 && (
              <Text className="text-gray-500 italic py-2">No items in this category</Text>
            )}
          </View>
        </View>
      ))}

      {/* Item Form Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl h-[85%]">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-900">
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2">
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4">
              <View className="gap-4 pb-12">
                <View>
                  <Text className="text-sm font-bold text-gray-700 mb-1">Name *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="E.g., Double Cheeseburger"
                  />
                </View>

                <View>
                  <Text className="text-sm font-bold text-gray-700 mb-1">Description</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[80px]"
                    placeholder="Short description of the item"
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View>
                  <Text className="text-sm font-bold text-gray-700 mb-1">Price ($) *</Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View>
                  <Text className="text-sm font-bold text-gray-700 mb-1">Category *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setCategoryId(cat.id)}
                        className={`mr-2 px-4 py-2 rounded-full border ${
                          categoryId === cat.id 
                            ? 'bg-indigo-600 border-indigo-600' 
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        <Text className={`font-bold ${categoryId === cat.id ? 'text-white' : 'text-gray-700'}`}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View>
                  <Text className="text-sm font-bold text-gray-700 mb-1">Image URL</Text>
                  <TextInput
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="https://example.com/image.jpg"
                    autoCapitalize="none"
                  />
                </View>

                <View className="flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <View>
                    <Text className="font-bold text-gray-900">Available</Text>
                    <Text className="text-xs text-gray-500">Show to customers</Text>
                  </View>
                  <Switch
                    value={isAvailable}
                    onValueChange={setIsAvailable}
                    trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                    thumbColor={isAvailable ? '#4f46e5' : '#f3f4f6'}
                  />
                </View>

                <TouchableOpacity 
                  onPress={handleSave}
                  disabled={isSubmitting}
                  className={`bg-indigo-600 py-4 rounded-xl items-center mt-4 mb-20 ${isSubmitting ? 'opacity-70' : ''}`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-lg">
                      {editingItem ? 'Save Changes' : 'Create Item'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
