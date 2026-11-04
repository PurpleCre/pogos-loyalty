import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { BrandLogo } from '@/components/BrandLogo';
import headerImage from '@/assets/brand/pogos-header.webp';
export default function Home() {
  return <SafeAreaView className="flex-1 bg-red-600"><ScrollView contentContainerStyle={{ padding: 28, paddingTop: 64 }}>
    <BrandLogo size={110} />
    <Image source={headerImage} style={{ width: '100%', height: 160, borderRadius: 18, marginTop: 24 }} contentFit="cover" contentPosition="left center" accessibilityLabel="Pogo’s flame-grilled chicken" />
    <Text className="text-white text-2xl font-bold mt-8">Your branch. Your order. Your rewards.</Text>
    <Text className="text-red-100 text-lg mt-5">Msasa · Kamfinsa · Westgate</Text>
    <Text className="text-white text-base mt-5">Browse meals, choose collection or delivery, and review your branch’s cash total before placing an order. Availability and delivery coverage are confirmed at checkout.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/store-picker')} className="p-5 bg-white rounded-xl mt-8"><Text className="font-bold text-red-700 text-center">Browse branch menus</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/cart')} className="p-5 border border-red-200 rounded-xl mt-4"><Text className="font-bold text-white text-center">Open cart or check interrupted order</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/dashboard')} className="py-5"><Text className="font-bold text-white">Loyalty account →</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/profile')} className="py-5"><Text className="font-bold text-white">Sign in and account settings →</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/support')} className="py-5"><Text className="font-bold text-white">Order help and privacy →</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;
}
