import { Linking, ScrollView, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import contact from '@/config/privacy-contact.json';
export default function Support() {
  return <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
    <Text className="text-2xl font-bold">Help with your Pogo’s order</Text>
    <Text className="mt-4">If confirmation was interrupted, reopen your cart and choose “Check order”. For rewards, use “Check previous action”. Keep the same reference until the result is confirmed.</Text>
    <Text className="mt-4">For a delayed order, cash discrepancy or reward collection, contact the branch handling your order with its reference. Verified branch phone numbers and opening hours are not yet available in this app.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/order-tracking')} className="py-4"><Text className="text-red-700 font-bold">View order references</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/cart')} className="py-4"><Text className="text-red-700 font-bold">Check interrupted order</Text></TouchableOpacity>
    <Text className="mt-4">For account privacy, export or deletion requests, the temporary contact is:</Text><Text selectable className="my-3">{contact.supportEmail}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => { void Linking.openURL(`mailto:${encodeURIComponent(contact.supportEmail)}`).catch(() => undefined); }} className="py-4"><Text className="text-red-700 font-bold">Email privacy contact</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/privacy')} className="py-4"><Text className="text-red-700 font-bold">Privacy and account requests</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/(app)/menu')} className="py-4"><Text className="text-red-700 font-bold">Browse menu</Text></TouchableOpacity>
  </ScrollView>;
}
