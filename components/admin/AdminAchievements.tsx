import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, Switch, ScrollView } from 'react-native';
import { Edit2, Trash2, Plus, X, Trophy } from 'lucide-react-native';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Achievement {
  id: string;
  name: string;
  description: string;
  points_reward: number;
  icon_name: string;
  is_active: boolean;
}

interface AdminAchievementsProps {
  achievements: Achievement[];
  createAchievement: (achievement: Omit<Achievement, 'id'>) => Promise<{ error: any }>;
  updateAchievement: (id: string, updates: Partial<Achievement>) => Promise<{ error: any }>;
  deleteAchievement: (id: string) => Promise<{ error: any }>;
}

export function AdminAchievements({ 
  achievements, 
  createAchievement, 
  updateAchievement, 
  deleteAchievement 
}: AdminAchievementsProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pointsReward, setPointsReward] = useState('');
  const [iconName, setIconName] = useState('Trophy');
  const [isActive, setIsActive] = useState(true);

  const openCreateModal = () => {
    setEditingAchievement(null);
    setName('');
    setDescription('');
    setPointsReward('');
    setIconName('Trophy');
    setIsActive(true);
    setIsModalVisible(true);
  };

  const openEditModal = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    setName(achievement.name);
    setDescription(achievement.description || '');
    setPointsReward(achievement.points_reward.toString());
    setIconName(achievement.icon_name || 'Trophy');
    setIsActive(achievement.is_active ?? true);
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !pointsReward) {
      Alert.alert('Error', 'Please fill out Name and Points Reward.');
      return;
    }

    const points = parseInt(pointsReward, 10);
    if (isNaN(points)) {
      Alert.alert('Error', 'Points Reward must be a valid number.');
      return;
    }

    setLoading(true);

    const achievementData = {
      name,
      description,
      points_reward: points,
      icon_name: iconName,
      is_active: isActive,
    };

    let response;
    if (editingAchievement) {
      response = await updateAchievement(editingAchievement.id, achievementData);
    } else {
      response = await createAchievement(achievementData);
    }

    setLoading(false);

    if (response.error) {
      Alert.alert('Error', response.error.message || 'Failed to save achievement');
    } else {
      setIsModalVisible(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this achievement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteAchievement(id);
          if (error) {
            Alert.alert('Error', error.message || 'Failed to delete achievement');
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
        <Text className="text-white font-bold text-base">Create Achievement</Text>
      </TouchableOpacity>

      {achievements.map(achievement => (
        <View key={achievement.id} className="bg-white p-4 rounded-xl border border-gray-100">
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1 mr-4">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 bg-amber-100 rounded-full items-center justify-center">
                  <Trophy size={16} color="#f59e0b" />
                </View>
                <Text className="font-bold text-gray-900 text-lg flex-1">{achievement.name}</Text>
              </View>
              {achievement.description ? (
                <Text className="text-sm text-gray-500 mt-2">{achievement.description}</Text>
              ) : null}
            </View>
            <View className="items-end">
              <Text className="font-bold text-green-600 text-lg">+{achievement.points_reward} pts</Text>
            </View>
          </View>
          
          <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
            <View className="flex-row items-center gap-2">
              <Text className={`text-xs font-bold ${achievement.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {achievement.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity 
                onPress={() => openEditModal(achievement)}
                className="bg-gray-100 p-2 rounded-lg"
              >
                <Edit2 size={16} color="#4b5563" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDelete(achievement.id)}
                className="bg-red-50 p-2 rounded-lg"
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {achievements.length === 0 && (
        <View className="items-center justify-center py-12">
          <Trophy size={48} color="#9ca3af" className="mb-4 opacity-50" />
          <Text className="text-gray-400 font-medium">No achievements created yet</Text>
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
              {editingAchievement ? 'Edit Achievement' : 'Create Achievement'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalVisible(false)} className="p-2">
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
            <View className="bg-white p-4 rounded-xl border border-gray-100 mb-6">
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Name *</Text>
                <Input value={name} onChangeText={setName} placeholder="Achievement name" />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Description</Text>
                <Input 
                  value={description} 
                  onChangeText={setDescription} 
                  placeholder="What does the user need to do?" 
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Points Reward *</Text>
                <Input 
                  value={pointsReward} 
                  onChangeText={setPointsReward} 
                  placeholder="e.g. 100" 
                  keyboardType="numeric"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Icon Name (Lucide)</Text>
                <Input 
                  value={iconName} 
                  onChangeText={setIconName} 
                  placeholder="e.g. Trophy, Star, Crown" 
                  autoCapitalize="none"
                />
              </View>

              <View className="flex-row items-center justify-between py-2 border-t border-gray-50 mt-2 pt-4">
                <View>
                  <Text className="text-base font-medium text-gray-900">Active</Text>
                  <Text className="text-xs text-gray-500">Can users earn this achievement?</Text>
                </View>
                <Switch 
                  value={isActive} 
                  onValueChange={setIsActive}
                  trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                  thumbColor={isActive ? '#e11d48' : '#f3f4f6'}
                />
              </View>
            </View>

            <Button 
              onPress={handleSave} 
              isLoading={loading}
              className="bg-red-600 mb-8"
              textClassName="text-white font-bold"
            >
              {editingAchievement ? 'Save Changes' : 'Create Achievement'}
            </Button>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
