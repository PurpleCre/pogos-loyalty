import { Linking, Text } from 'react-native';
import { router } from 'expo-router';
import { LifeBuoy, ReceiptText, ShoppingBag, ShieldCheck, Mail } from 'lucide-react-native';
import { Screen, PageHeading, Card, ActionRow, SectionHeading } from '@/components/ui/screen';
import contact from '@/config/privacy-contact.json';
export default function Support() {
  return <Screen title="Help and support"><PageHeading eyebrow="WE’RE HERE TO HELP" title="Let’s get it sorted." subtitle="Find your order, check an interrupted action or get help with your account." />
    <Card><ActionRow icon={ReceiptText} title="Find an order reference" detail="View your current orders and recent history." onPress={() => router.push('/(app)/order-tracking')} /><ActionRow icon={ShoppingBag} title="Check an interrupted order" detail="Open your cart and check the saved order reference." onPress={() => router.push('/(app)/cart')} /></Card>
    <SectionHeading title="If an action was interrupted" /><Card><Text className="text-ink leading-6">For orders, reopen your cart and choose “Check order”. For rewards, use “Check previous action”. Keep the same reference until the result is confirmed.</Text></Card>
    <SectionHeading title="Contact your branch" /><Card><Text className="text-ink leading-6">For a delayed order, cash discrepancy or reward collection, contact the branch handling your order with its reference. Verified branch phone numbers and opening hours are not yet available in this app.</Text></Card>
    <SectionHeading title="Privacy and account requests" /><Card><Text className="text-subtle leading-6">The temporary privacy contact is:</Text><Text selectable className="font-bold text-brand-800 my-3">{contact.supportEmail}</Text><ActionRow icon={Mail} title="Email the privacy contact" onPress={() => { void Linking.openURL(`mailto:${encodeURIComponent(contact.supportEmail)}`).catch(() => undefined); }} /><ActionRow icon={ShieldCheck} title="Manage my account data" detail="Preferences, export and deletion requests." onPress={() => router.push('/privacy')} /></Card>
    <Card><ActionRow icon={LifeBuoy} title="Back to the menu" onPress={() => router.replace('/(app)/menu')} /></Card>
  </Screen>;
}
