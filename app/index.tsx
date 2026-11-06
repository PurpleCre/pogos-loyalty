import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { TouchTarget as TouchableOpacity } from '@/components/ui/touch-target';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowUpRight, ChevronRight, Gift, MapPin, ShoppingBag, LifeBuoy, UserRound, Check } from 'lucide-react-native';
import { Screen, ActionRow, Card } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { CatalogueImage } from '@/components/CatalogueImage';
import { useOrder } from '@/contexts/OrderContext';
import { useCart } from '@/contexts/CartContext';
import { useStores } from '@/hooks/useStores';
import { useMenu } from '@/hooks/useMenu';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { formatMoney } from '@/lib/cash-orders';
import { colors } from '@/lib/theme';
import headerImage from '@/assets/brand/pogos-header.webp';

function LoyaltyShortcut() {
  const { userPoints, fresh } = useRewards();
  return <Text style={styles.shortcutDetail}>{userPoints ? `${userPoints.current_points.toLocaleString()} ${fresh ? 'available points' : 'last known points'}` : 'Your points & rewards'}</Text>;
}

export default function Home() {
  const { width } = useWindowDimensions();
  const desktop = width > 760;
  const { user } = useAuth();
  const { selectedStore, setSelectedStore } = useOrder();
  const { itemCount, storeId, hydrated } = useCart();
  const { stores, loading, error: branchError, refetch: refreshBranches } = useStores();
  const branch = stores.find(store => store.id === selectedStore?.id) ?? selectedStore ?? stores.find(store => store.id === storeId);
  const { categories, items, isLoading, error: menuError, fresh, refetch: refreshMenu } = useMenu(false, branch?.id);
  const seen = new Set<string>();
  const highlights = items.filter(item => {
    if (!item.is_available || !item.image_url || (!branch && item.store_id) || seen.has(item.category_id)) return false;
    seen.add(item.category_id); return true;
  }).slice(0, 3);
  const openMenu = () => {
    if (!branch) { router.push('/store-picker'); return; }
    setSelectedStore(branch); router.push('/(app)/menu');
  };

  return <Screen title="Pogo’s" back={false} wide contentStyle={{ paddingTop: 16 }}
    action={<TouchableOpacity accessibilityLabel={user ? 'Your account' : 'Sign in'} onPress={() => router.push(user ? '/(app)/profile' : '/(auth)/login')} style={styles.account}><UserRound size={19} color={colors.primary} /><Text style={styles.accountText}>{user ? 'Account' : 'Sign in'}</Text></TouchableOpacity>}>
    <TouchableOpacity accessibilityLabel="Choose your ordering branch" onPress={() => router.push('/store-picker')} style={styles.branchSummary}>
      <View style={styles.iconTile}><MapPin size={21} color={colors.primary} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.caption}>ORDERING FROM</Text><Text style={styles.branchName}>{branch ? branch.name.replace(/^Pogo['’]s /, '') : 'Choose your Pogo’s'}</Text></View>
      <Text style={styles.change}>Change</Text><ChevronRight size={17} color={colors.primary} />
    </TouchableOpacity>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchChoices} accessibilityLabel="Pogo’s branches">
      {stores.map(store => <TouchableOpacity key={store.id} accessibilityLabel={`Choose ${store.name.replace(/^Pogo['’]s /, '')}`} accessibilityState={{ selected: branch?.id === store.id }} onPress={() => setSelectedStore(store)} style={[styles.branchChip, branch?.id === store.id && styles.selectedChip]}>
        {branch?.id === store.id ? <Check size={15} color={colors.primary} /> : <MapPin size={14} color={colors.muted} />}<Text style={[styles.chipText, branch?.id === store.id && { color: colors.primary }]}>{store.name.replace(/^Pogo['’]s /, '')}</Text>
      </TouchableOpacity>)}
      {loading && !stores.length ? <Text style={styles.muted}>Loading branches…</Text> : null}
    </ScrollView>
    {branchError ? <Button variant="ghost" onPress={() => { void refreshBranches(); }}>Refresh branch choices</Button> : null}

    <View style={[styles.hero, desktop && styles.heroDesktop]}>
      <Image source={headerImage} style={[styles.heroImage, desktop && styles.heroImageDesktop]} contentFit="cover" contentPosition="left center" accessibilityLabel="Pogo’s flame-grilled chicken" />
      <View style={[styles.heroCopy, desktop && { padding: 32 }]}>
        <Text style={styles.eyebrow}>PIZZA. CHICKEN. POGO’S.</Text>
        <Text accessibilityRole="header" style={[styles.headline, desktop && { fontSize: 40, lineHeight: 45 }]}>Your next craving,{"\n"}sorted.</Text>
        <Text style={styles.heroDescription}>Choose your meals. Pay cash on collection or delivery.</Text>
        <Button onPress={openMenu} className="bg-white mt-4" textClassName="text-brand-900">{branch ? 'Browse the menu' : 'Choose a branch & order'}</Button>
      </View>
    </View>

    <View style={styles.shortcuts}>
      <TouchableOpacity accessibilityLabel="Open your loyalty account" onPress={() => router.push('/(app)/dashboard')} style={styles.shortcut}>
        <Gift size={21} color={colors.primary} /><Text style={styles.shortcutTitle}>A little more Pogo’s</Text>{user ? <LoyaltyShortcut /> : <Text style={styles.shortcutDetail}>Sign in for your rewards</Text>}<ArrowUpRight size={16} color={colors.primary} style={styles.shortcutArrow} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityLabel="Open your cart" onPress={() => router.push('/(app)/cart')} style={styles.shortcut}>
        <ShoppingBag size={21} color={colors.primary} /><Text style={styles.shortcutTitle}>{hydrated && itemCount ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} in your cart` : 'Your next order'}</Text><Text style={styles.shortcutDetail}>{hydrated && itemCount ? 'Continue your order' : 'View your selections'}</Text><ArrowUpRight size={16} color={colors.primary} style={styles.shortcutArrow} />
      </TouchableOpacity>
    </View>

    <View style={styles.sectionHeader}><View style={{ flex: 1 }}><Text style={styles.caption}>FIND YOUR FAVOURITES</Text><Text accessibilityRole="header" style={styles.sectionTitle}>What are you craving?</Text></View><TouchableOpacity accessibilityLabel="Browse the full menu" onPress={openMenu} style={styles.menuLink}><Text style={styles.change}>Full menu</Text><ArrowUpRight size={17} color={colors.primary} /></TouchableOpacity></View>
    {highlights.length ? <View style={[styles.highlights, desktop && { flexDirection: 'row' }]}>{highlights.map(item => <View key={item.id} style={[styles.foodCard, desktop && { flex: 1, flexDirection: 'column' }]}>
      <CatalogueImage uri={item.image_url} label={item.name} className={desktop ? 'w-full h-44' : 'w-28 h-28'} />
      <View style={styles.foodCopy}><Text style={styles.foodCategory}>{categories.find(category => category.id === item.category_id)?.name ?? 'On the menu'}</Text><Text style={styles.foodName}>{item.name}</Text><Text style={styles.foodPrice}>{formatMoney(Math.round(item.price * 100), 'USD')} <Text style={styles.priceNote}>· menu estimate</Text></Text></View>
    </View>)}</View> : <Card><Text style={styles.muted}>{isLoading ? 'Loading the menu…' : menuError ? 'Menu previews couldn’t be refreshed.' : 'Explore the menu at your branch.'}</Text><Button variant="outline" className="mt-3" onPress={() => { if (menuError) void refreshMenu(); else openMenu(); }}>{menuError ? 'Refresh menu previews' : 'Browse meals'}</Button></Card>}
    <Text style={styles.availabilityNote}>{!fresh && highlights.length ? 'Saved menu preview. ' : ''}Your branch’s online total confirms availability, delivery coverage and the final cash amount.</Text>
    <Card style={{ paddingVertical: 4, marginTop: 24 }}><ActionRow icon={LifeBuoy} title="Need a hand?" detail="Order help, account support & privacy requests" onPress={() => router.push('/support')} /></Card>
  </Screen>;
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 24, backgroundColor: colors.brand['50'] },
  accountText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  branchSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  iconTile: { width: 42, height: 42, backgroundColor: colors.brand['100'], borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  caption: { color: colors.muted, fontSize: 10, letterSpacing: 1.3, fontWeight: '800', marginBottom: 4 },
  branchName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  change: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  branchChoices: { gap: 8, paddingTop: 10, paddingBottom: 16, alignItems: 'center' },
  branchChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, backgroundColor: colors.surface },
  selectedChip: { borderColor: colors.primary, backgroundColor: colors.brand['100'] },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  hero: { backgroundColor: colors.brand['950'], borderRadius: 24, overflow: 'hidden' },
  heroDesktop: { flexDirection: 'row-reverse', minHeight: 340 },
  heroImage: { width: '100%', height: 142 },
  heroImageDesktop: { width: '48%', height: '100%', minHeight: 340 },
  heroCopy: { flex: 1, padding: 20 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 9 },
  headline: { color: 'white', fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.9 },
  heroDescription: { color: '#d7e7df', fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 340 },
  shortcuts: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 28 },
  shortcut: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, backgroundColor: 'white', padding: 14, borderRadius: 18, gap: 6 },
  shortcutTitle: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 4 },
  shortcutDetail: { fontSize: 12, lineHeight: 18, color: colors.muted },
  shortcutArrow: { position: 'absolute', top: 15, right: 12 },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted },
  sectionHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 21, lineHeight: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  menuLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  highlights: { gap: 10 },
  foodCard: { flexDirection: 'row', alignItems: 'stretch', borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: 'white' },
  foodCopy: { flex: 1, padding: 14, justifyContent: 'center', gap: 5 },
  foodCategory: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  foodName: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  foodPrice: { fontSize: 12, color: colors.primary, fontWeight: '700', lineHeight: 18 },
  priceNote: { fontWeight: '400', color: colors.muted, fontSize: 10 },
  availabilityNote: { fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 12 },
});
