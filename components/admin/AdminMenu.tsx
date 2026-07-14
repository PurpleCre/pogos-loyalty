import { View, Text, TouchableOpacity, Image, Modal, TextInput, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useMenu, MenuItem, MenuCategory } from '@/hooks/useMenu';
import { Plus, Edit2, Trash2, X, Store, Globe } from 'lucide-react-native';

interface AdminMenuProps {
  stores: { id: string; name: string }[];
}

export function AdminMenu({ stores }: AdminMenuProps) {
  const { 
    categories, 
    items, 
    addMenuItem, 
    updateMenuItem, 
    deleteMenuItem,
    addCategory,
    updateCategory,
    deleteCategory
  } = useMenu(true);
  
  // Context Switcher State
  const [menuContext, setMenuContext] = useState<string | null>(null); // null = global

  // Item Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category Modal State
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [isCatSubmitting, setIsCatSubmitting] = useState(false);

  // Item Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Category Form state
  const [catName, setCatName] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('0');
  const [catIsActive, setCatIsActive] = useState(true);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setImageUrl('');
    setIsAvailable(true);
    setEditingItem(null);
  };

  const resetCatForm = () => {
    setCatName('');
    setCatSortOrder('0');
    setCatIsActive(true);
    setEditingCategory(null);
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

  const openAddCatModal = () => {
    resetCatForm();
    setCatModalVisible(true);
  };

  const openEditCatModal = (category: MenuCategory) => {
    setEditingCategory(category);
    setCatName(category.name);
    setCatSortOrder(category.sort_order?.toString() || '0');
    setCatIsActive(category.is_active ?? true);
    setCatModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !price || !categoryId) {
      Alert.alert('Error', 'Please fill in name, price, and select a category');
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
      store_id: menuContext, // Apply the current context!
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

  const handleSaveCategory = async () => {
    if (!catName) {
      Alert.alert('Error', 'Please provide a category name');
      return;
    }

    setIsCatSubmitting(true);
    const order = parseInt(catSortOrder, 10);

    const catData = {
      name: catName,
      sort_order: isNaN(order) ? 0 : order,
      is_active: catIsActive,
    };

    let result;
    if (editingCategory) {
      result = await updateCategory(editingCategory.id, catData);
    } else {
      result = await addCategory(catData);
    }

    setIsCatSubmitting(false);

    if (result.success) {
      setCatModalVisible(false);
      resetCatForm();
    } else {
      Alert.alert('Error', result.error || 'Failed to save category');
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

  const handleDeleteCategory = (category: MenuCategory) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?\n\nWARNING: This will also permanently delete ALL items within this category!`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete All', 
          style: 'destructive',
          onPress: async () => {
            const result = await deleteCategory(category.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete category');
            }
          }
        }
      ]
    );
  };

  // Filter items based on selected context
  const filteredItems = items.filter(i => {
    if (menuContext === null) {
      return i.store_id === null; // Global items only
    } else {
      return i.store_id === menuContext; // Store specific items only
    }
  });

  return (
    <View className="gap-4 pb-8">
      {/* Context Switcher */}
      <View className="mb-4">
        <Text className="text-sm font-bold text-gray-700 mb-2">Menu Context</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          <TouchableOpacity
            onPress={() => setMenuContext(null)}
            className={`mr-2 px-4 py-2.5 rounded-xl border flex-row items-center gap-2 ${
              menuContext === null 
                ? 'bg-red-600 border-red-600' 
                : 'bg-white border-gray-300'
            }`}
          >
            <Globe size={16} color={menuContext === null ? 'white' : '#4b5563'} />
            <Text className={`font-bold ${menuContext === null ? 'text-white' : 'text-gray-700'}`}>
              Global Menu
            </Text>
          </TouchableOpacity>
          {stores.map(store => (
            <TouchableOpacity
              key={store.id}
              onPress={() => setMenuContext(store.id)}
              className={`mr-2 px-4 py-2.5 rounded-xl border flex-row items-center gap-2 ${
                menuContext === store.id 
                  ? 'bg-red-600 border-red-600' 
                  : 'bg-white border-gray-300'
              }`}
            >
              <Store size={16} color={menuContext === store.id ? 'white' : '#4b5563'} />
              <Text className={`font-bold ${menuContext === store.id ? 'text-white' : 'text-gray-700'}`}>
                {store.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View className="flex-row gap-2 mb-2">
        <TouchableOpacity 
          onPress={openAddModal}
          className="flex-1 flex-row items-center justify-center bg-red-600 rounded-xl py-3.5"
        >
          <Plus size={18} color="white" className="mr-2" />
          <Text className="text-white font-bold">Add Item</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={openAddCatModal}
          className="flex-1 flex-row items-center justify-center bg-red-50 rounded-xl py-3.5 border border-red-200"
        >
          <Plus size={18} color="#e11d48" className="mr-2" />
          <Text className="text-red-600 font-bold">Add Category</Text>
        </TouchableOpacity>
      </View>

      {categories.length === 0 && (
        <View className="bg-red-50 p-6 rounded-2xl items-center border border-red-100 mt-4">
          <Text className="text-lg font-bold text-red-900 mb-2">No Categories Yet</Text>
          <Text className="text-red-600 text-center mb-4">
            You need to create at least one category before you can add menu items.
          </Text>
          <TouchableOpacity 
            onPress={openAddCatModal}
            className="bg-red-600 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Create Category</Text>
          </TouchableOpacity>
        </View>
      )}

      {categories.map(category => (
        <View key={category.id} className="mb-4">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center">
              <Text className="text-lg font-bold text-gray-900">{category.name}</Text>
              {category.is_active === false && (
                <View className="bg-gray-200 px-2 py-0.5 rounded ml-2">
                  <Text className="text-[10px] font-bold text-gray-600 uppercase">Hidden</Text>
                </View>
              )}
            </View>
            
            <View className="flex-row gap-2">
              <TouchableOpacity 
                onPress={() => openEditCatModal(category)}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Edit2 size={14} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDeleteCategory(category)}
                className="w-8 h-8 bg-red-50 rounded-full items-center justify-center"
              >
                <Trash2 size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View className="gap-2">
            {filteredItems.filter(i => i.category_id === category.id).map(item => (
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
                  <Text className="text-red-600 font-semibold">${item.price.toFixed(2)}</Text>
                </View>
                
                <View className="flex-row gap-2">
                  <TouchableOpacity 
                    onPress={() => openEditModal(item)}
                    className="w-8 h-8 bg-red-50 rounded-full items-center justify-center"
                  >
                    <Edit2 size={14} color="#e11d48" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleDelete(item)}
                    className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {filteredItems.filter(i => i.category_id === category.id).length === 0 && (
              <Text className="text-gray-500 italic py-2">
                No items in this category for {menuContext === null ? 'the Global Menu' : stores.find(s => s.id === menuContext)?.name}
              </Text>
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
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                </Text>
                <Text className="text-xs font-semibold text-red-600">
                  {menuContext === null ? 'Global Menu' : stores.find(s => s.id === menuContext)?.name}
                </Text>
              </View>
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
                  {categories.length === 0 ? (
                    <Text className="text-red-500 italic">Please create a category first.</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                      {categories.map(cat => (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setCategoryId(cat.id)}
                          className={`mr-2 px-4 py-2 rounded-full border ${
                            categoryId === cat.id 
                              ? 'bg-red-600 border-red-600' 
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          <Text className={`font-bold ${categoryId === cat.id ? 'text-white' : 'text-gray-700'}`}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
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
                    trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                    thumbColor={isAvailable ? '#e11d48' : '#f3f4f6'}
                  />
                </View>

                <TouchableOpacity 
                  onPress={handleSave}
                  disabled={isSubmitting || categories.length === 0}
                  className={`bg-red-600 py-4 rounded-xl items-center mt-4 mb-20 ${(isSubmitting || categories.length === 0) ? 'opacity-70' : ''}`}
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

      {/* Category Form Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={catModalVisible}
        onRequestClose={() => setCatModalVisible(false)}
      >
        <View className="flex-1 justify-center bg-black/50 p-4">
          <View className="bg-white rounded-3xl overflow-hidden">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </Text>
              <TouchableOpacity onPress={() => setCatModalVisible(false)} className="p-2">
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="p-4 gap-4">
              <View>
                <Text className="text-sm font-bold text-gray-700 mb-1">Category Name *</Text>
                <TextInput
                  value={catName}
                  onChangeText={setCatName}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                  placeholder="E.g., Burgers, Drinks, Sides"
                />
              </View>

              <View>
                <Text className="text-sm font-bold text-gray-700 mb-1">Sort Order</Text>
                <TextInput
                  value={catSortOrder}
                  onChangeText={setCatSortOrder}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                  placeholder="0"
                  keyboardType="number-pad"
                />
                <Text className="text-xs text-gray-500 mt-1">Lower numbers appear first (0, 1, 2...)</Text>
              </View>

              <View className="flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <View>
                  <Text className="font-bold text-gray-900">Active</Text>
                  <Text className="text-xs text-gray-500">Show category to customers</Text>
                </View>
                <Switch
                  value={catIsActive}
                  onValueChange={setCatIsActive}
                  trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                  thumbColor={catIsActive ? '#e11d48' : '#f3f4f6'}
                />
              </View>

              <TouchableOpacity 
                onPress={handleSaveCategory}
                disabled={isCatSubmitting}
                className={`bg-red-600 py-4 rounded-xl items-center mt-2 ${isCatSubmitting ? 'opacity-70' : ''}`}
              >
                {isCatSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-lg">
                    {editingCategory ? 'Save Category' : 'Create Category'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
