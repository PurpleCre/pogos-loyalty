import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowUpRight, Gift, MapPin, ShoppingBag, LifeBuoy, UserRound } from 'lucide-react-native';
import { Screen, ActionRow, Card } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { colors } from '@/lib/theme';
import headerImage from '@/assets/brand/pogos-header.webp';

export default function Home() {
  const { width } = useWindowDimensions();
  return <Screen title="Pogo’s Pizza & Chicken" back={false} wide>
    <View style={[styles.hero, width > 760 && { flexDirection: 'row' }]}>
      <View style={styles.heroCopy}>
        <View style={styles.location}><MapPin size={14} color={colors.accent} /><Text style={styles.eyebrow}>MADE FOR YOUR POGO’S RUN</Text></View>
        <Text accessibilityRole="header" style={styles.headline}>Good food.{"\n"}Great reasons{"\n"}to come back.</Text>
        <Text style={styles.description}>Your favourites, your nearest branch and your loyalty account. All in one place.</Text>
        <Button onPress={() => router.push('/store-picker')} className="bg-white mt-7" textClassName="text-brand-900">Explore the menu</Button>
        <Text style={styles.heroNote}>Msasa · Kamfinsa · Westgate</Text>
      </View>
      <Image source={headerImage} style={[styles.heroImage, width > 760 && { width: '46%', height: '100%', minHeight: 370 }]} contentFit="cover" contentPosition="left center" accessibilityLabel="Pogo’s flame-grilled chicken" />
    </View>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Your next visit starts here.</Text>
      <Text style={styles.muted}>Choose a branch to browse. Your online quote confirms availability, collection or delivery, and your cash total.</Text>
    </View>
    <View style={[styles.quickLinks, width > 700 && { flexDirection: 'row' }]}>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/dashboard')} style={styles.quickCard}>
        <View style={styles.quickTop}><Gift size={25} color={colors.primary} /><ArrowUpRight size={20} color={colors.muted} /></View>
        <Text style={styles.quickTitle}>A little more from every visit</Text><Text style={styles.muted}>Check your points and explore your branch’s available rewards.</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(app)/cart')} style={styles.quickCard}>
        <View style={styles.quickTop}><ShoppingBag size={25} color={colors.primary} /><ArrowUpRight size={20} color={colors.muted} /></View>
        <Text style={styles.quickTitle}>Pick up where you left off</Text><Text style={styles.muted}>Open your cart or check an interrupted order before trying again.</Text>
      </TouchableOpacity>
    </View>
    <Card>
      <ActionRow icon={UserRound} title="Your account" detail="Sign in, manage your profile and keep your account secure." onPress={() => router.push('/(app)/profile')} />
      <View style={styles.divider} />
      <ActionRow icon={LifeBuoy} title="A hand when you need it" detail="Order help, account support and privacy requests." onPress={() => router.push('/support')} />
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({
  hero: { backgroundColor: colors.brand['950'], borderRadius: 28, overflow: 'hidden' },
  heroCopy: { flex: 1, padding: 28 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, flexShrink: 1 },
  headline: { color: 'white', fontSize: 40, lineHeight: 45, fontWeight: '800', letterSpacing: -1.4 },
  description: { color: '#d7e7df', fontSize: 16, lineHeight: 25, marginTop: 18, maxWidth: 380 },
  heroNote: { color: '#d7e7df', fontSize: 12, marginTop: 18, textAlign: 'center' },
  heroImage: { width: '100%', height: 195 },
  intro: { marginTop: 32, marginBottom: 20, gap: 10 },
  sectionTitle: { fontSize: 24, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted },
  quickLinks: { gap: 16, marginBottom: 20 },
  quickCard: { flex: 1, padding: 22, backgroundColor: 'white', borderRadius: 22, borderWidth: 1, borderColor: colors.border, gap: 10 },
  quickTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  quickTitle: { color: colors.ink, fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4 },
  divider: { height: 1, backgroundColor: colors.border },
});
