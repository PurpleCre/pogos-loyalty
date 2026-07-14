import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, Switch, ScrollView } from 'react-native';
import { Edit2, Trash2, Plus, X } from 'lucide-react-native';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AdminReward {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  category: string;
  available: boolean | null;
  image_url?: string | null;
  created_at: string | null;
}

interface AdminRewardsProps {
  rewards: AdminReward[];
  createReward: (reward: Omit<AdminReward, 'id' | 'created_at'>) => Promise<{ error: any }>;
  updateReward: (id: string, updates: Partial<AdminReward>) => Promise<{ error: any }>;
  deleteReward: (id: string) => Promise<{ error: any }>;
}

export function AdminRewards({ rewards, createReward, updateReward, deleteReward }: AdminRewardsProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<AdminReward | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pointsCost, setPointsCost] = useState('');
  const [category, setCategory] = useState('special');
  const [imageUrl, setImageUrl] = useState('');
  const [available, setAvailable] = useState(true);

  const openCreateModal = () => {
    setEditingReward(null);
    setName('');
    setDescription('');
    setPointsCost('');
    setCategory('special');
    setImageUrl('');
    setAvailable(true);
    setIsModalVisible(true);
  };

  const openEditModal = (reward: AdminReward) => {
    setEditingReward(reward);
    setName(reward.name);
    setDescription(reward.description || '');
    setPointsCost(reward.points_cost.toString());
    setCategory(reward.category);
    setImageUrl(reward.image_url || '');
    setAvailable(reward.available ?? true);
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !pointsCost || !category) {
      Alert.alert('Error', 'Please fill out all required fields (Name, Points Cost, Category).');
      return;
    }

    const points = parseInt(pointsCost, 10);
    if (isNaN(points)) {
      Alert.alert('Error', 'Points Cost must be a valid number.');
      return;
    }

    setLoading(true);

    const rewardData = {
      name,
      description: description || null,
      points_cost: points,
      category,
      image_url: imageUrl || null,
      available,
    };

    let response;
    if (editingReward) {
      response = await updateReward(editingReward.id, rewardData);
    } else {
      response = await createReward(rewardData);
    }

    setLoading(false);

    if (response.error) {
      Alert.alert('Error', response.error.message || 'Failed to save reward');
    } else {
      setIsModalVisible(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this reward?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteReward(id);
          if (error) {
            Alert.alert('Error', error.message || 'Failed to delete reward');
          }
        },
      },
    ]);
  };

  return (
    <View className="gap-3 pb-8">
      <TouchableOpacity 
        onPress={openCreateModal}
        className="flex-row items-center justify-center bg-red-600 rounded-xl py-3.5 mb-2"
        activeOpacity={0.8}
      >
        <Plus size={20} color="white" className="mr-2" />
        <Text className="text-white font-bold text-base">Create Reward</Text>
      </TouchableOpacity>

      {rewards.map(reward => (
        <View key={reward.id} className="bg-white p-4 rounded-xl border border-gray-100">
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1 mr-4">
              <Text className="font-bold text-gray-900 text-lg">{reward.name}</Text>
              {reward.description ? (
                <Text className="text-sm text-gray-500 mt-1">{reward.description}</Text>
              ) : null}
            </View>
            <Text className="font-bold text-red-600 text-lg">{reward.points_cost} pts</Text>
          </View>
          
          <View className="flex-row items-center justify-between mt-2 pt-3 border-t border-gray-50">
            <View className="flex-row items-center gap-2">
              <View className="bg-gray-100 px-2 py-1 rounded">
                <Text className="text-xs text-gray-600 capitalize">{reward.category}</Text>
              </View>
              <Text className={`text-xs font-bold ${reward.available ? 'text-green-600' : 'text-red-600'}`}>
                {reward.available ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity 
                onPress={() => openEditModal(reward)}
                className="bg-gray-100 p-2 rounded-lg"
              >
                <Edit2 size={16} color="#4b5563" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDelete(reward.id)}
                className="bg-red-50 p-2 rounded-lg"
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {rewards.length === 0 && (
        <View className="items-center justify-center py-12">
          <Text className="text-gray-400 font-medium">No rewards created yet</Text>
        </View>
      )}

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-100">
            <Text className="text-xl font-bold text-gray-900">
              {editingReward ? 'Edit Reward' : 'Create Reward'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalVisible(false)} className="p-2">
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
            <View className="bg-white p-4 rounded-xl border border-gray-100 mb-6">
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Name *</Text>
                <Input value={name} onChangeText={setName} placeholder="Reward name" />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Description</Text>
                <Input 
                  value={description} 
                  onChangeText={setDescription} 
                  placeholder="Optional description" 
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Points Cost *</Text>
                <Input 
                  value={pointsCost} 
                  onChangeText={setPointsCost} 
                  placeholder="e.g. 500" 
                  keyboardType="numeric"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Category *</Text>
                <Input 
                  value={category} 
                  onChangeText={setCategory} 
                  placeholder="food, drink, special, etc." 
                  autoCapitalize="none"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Image URL</Text>
                <Input 
                  value={imageUrl} 
                  onChangeText={setImageUrl} 
                  placeholder="https://example.com/image.jpg" 
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View className="flex-row items-center justify-between py-2 border-t border-gray-50 mt-2 pt-4">
                <View>
                  <Text className="text-base font-medium text-gray-900">Available</Text>
                  <Text className="text-xs text-gray-500">Can users redeem this reward?</Text>
                </View>
                <Switch 
                  value={available} 
                  onValueChange={setAvailable} 
                  trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                  thumbColor={available ? '#e11d48' : '#f3f4f6'}
                />
              </View>
            </View>

            <Button 
              onPress={handleSave} 
              isLoading={loading}
              className="bg-red-600 mb-8"
              textClassName="text-white font-bold"
            >
              {editingReward ? 'Save Changes' : 'Create Reward'}
            </Button>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
