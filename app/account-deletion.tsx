import { Screen, PageHeading } from '@/components/ui/screen';
import { ScrollView, Text, Linking } from 'react-native';
import { router } from 'expo-router';
import contact from '@/config/privacy-contact.json';
import { Button } from '@/components/ui/button';
export default function AccountDeletion() {
  return <Screen title="Account deletion" contentStyle={{ gap: 16 }}><PageHeading eyebrow="YOU’RE IN CONTROL" title="Account deletion" subtitle="Request deletion online or contact the privacy team." />
    <Text>You can submit an account deletion request from the account controls below, or email our privacy contact if you cannot sign in.</Text>
    <Button onPress={()=>router.push('/privacy')}>Open account deletion controls</Button>
    <Text selectable>{contact.supportEmail}</Text>
    <Button variant="outline" onPress={()=>{void Linking.openURL(`mailto:${encodeURIComponent(contact.supportEmail)}?subject=Pogo%27s%20account%20deletion%20request`).catch(()=>undefined);}}>Request deletion by email</Button>
    <Text>Include the email used for your Pogo’s account. Do not send your password, authenticator code or payment details. We will verify that the request belongs to you before acting.</Text>
    <Text>Submitting a request does not erase your account immediately. Active orders, reward collections, staff responsibilities and cash handovers may need to be settled first. The privacy team will review the applicable retention rules before processing.</Text>
    <Text>Some financial, fiscal and security records may need to be retained. The approved privacy notice and response to your request must explain what is retained and why. Retention periods are still being confirmed.</Text>
    <Button variant="ghost" onPress={()=>router.push('/privacy-policy')}>Privacy information</Button>
  </Screen>;
}
