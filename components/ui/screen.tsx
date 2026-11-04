import type { ReactNode, Ref, ComponentRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, ShoppingBag, Menu, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { BrandLogo } from '@/components/BrandLogo';
import { colors, layout } from '@/lib/theme';
import { Button } from './button';
import { DeveloperAccessNotice } from '@/components/DeveloperAccessNotice';

export function ScreenHeader({ title, back = true, onBack, action, menu = false }: {
  title: string; back?: boolean; onBack?(): void; action?: ReactNode; menu?: boolean;
}) {
  return <View style={styles.header}>
    <View style={styles.headerInner}>
      {back ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={menu ? 'Open navigation' : 'Go back'} style={styles.iconButton}
        onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'))}>
        {menu ? <Menu size={21} color={colors.ink} /> : <ArrowLeft size={21} color={colors.ink} />}
      </TouchableOpacity> : <BrandLogo size={42} />}
      <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
      {action ?? (back ? <BrandLogo size={38} /> : null)}
    </View>
  </View>;
}

export function Screen({ title, children, wide = false, scroll = true, centered = false, back = true, onBack, action, refreshControl, contentStyle, menu, footer, scrollRef }: {
  title: string; children: ReactNode; wide?: boolean; scroll?: boolean; centered?: boolean; back?: boolean;
  onBack?(): void; action?: ReactNode; refreshControl?: ScrollViewProps['refreshControl']; contentStyle?: StyleProp<ViewStyle>;
  menu?: boolean; footer?: ReactNode;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
}) {
  const content = [styles.content, { maxWidth: wide ? layout.wideWidth : layout.maxWidth }, centered && styles.centered, contentStyle];
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <ScreenHeader title={title} back={back} onBack={onBack} action={action} menu={menu} />
    <DeveloperAccessNotice />
    {scroll ? <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={content} keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets refreshControl={refreshControl}>{children}</ScrollView>
      : <View style={[...content, styles.scroll]}>{children}</View>}
    {footer ? <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}><View style={{ width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', padding: 16 }}>{footer}</View></View> : null}
  </SafeAreaView>;
}

export function PageHeading({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return <View style={styles.heading}>
    {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
    {detail ? <Text style={styles.caption}>{detail}</Text> : null}</View>;
}

export function Card({ children, style, className = '' }: { children: ReactNode; style?: StyleProp<ViewStyle>; className?: string }) {
  return <View style={[styles.card, style]} className={className}>{children}</View>;
}

export function ActionRow({ title, detail, icon: Icon = ChevronRight, onPress, destructive = false }: {
  title: string; detail?: string; icon?: LucideIcon; onPress(): void; destructive?: boolean;
}) {
  const color = destructive ? colors.danger : colors.primary;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.actionRow} activeOpacity={0.7}>
    <View style={[styles.actionIcon, { backgroundColor: destructive ? '#fff1ef' : colors.brand['50'] }]}><Icon size={21} color={color} /></View>
    <View style={styles.actionCopy}><Text style={[styles.actionTitle, { color: destructive ? color : colors.ink }]}>{title}</Text>
      {detail ? <Text style={styles.caption}>{detail}</Text> : null}</View>
    <ChevronRight size={18} color={colors.muted} />
  </TouchableOpacity>;
}

export function EmptyState({ title, description, icon: Icon = ShoppingBag, action, onAction }: {
  title: string; description: string; icon?: LucideIcon; action?: string; onAction?(): void;
}) {
  return <View style={styles.empty}>
    <View style={styles.emptyIcon}><Icon size={30} color={colors.primary} /></View>
    <Text accessibilityRole="header" style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyCopy}>{description}</Text>
    {action && onAction ? <Button onPress={onAction} className="mt-5 self-stretch">{action}</Button> : null}
  </View>;
}

export function LoadingState({ label = 'Loading your information…' }: { label?: string }) {
  return <View style={styles.empty}><ActivityIndicator size="large" color={colors.primary} accessibilityLabel={label} /><Text style={[styles.emptyCopy, { marginTop: 16 }]}>{label}</Text></View>;
}

export function AuthScreen({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <Screen title="Your Pogo’s account" centered contentStyle={{ maxWidth: 480 }}>
    <Card style={{ padding: 24 }}><View style={{ alignItems: 'center', marginBottom: 16 }}><BrandLogo size={88} /></View>
      <PageHeading title={title} subtitle={subtitle} />
      <View style={{ gap: 16 }}>{children}</View>
    </Card>
  </Screen>;
}

export const ui = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  section: { gap: 14, marginBottom: 24 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerInner: { width: '100%', maxWidth: layout.wideWidth, alignSelf: 'center', minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.canvas },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.ink, letterSpacing: -0.4 },
  content: { width: '100%', alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: 24, paddingBottom: 40 },
  centered: { flexGrow: 1, justifyContent: 'center' },
  heading: { marginBottom: 24, gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: colors.primary, textTransform: 'uppercase' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9, color: colors.ink },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
  sectionHeading: { marginTop: 12, marginBottom: 16, gap: 4 },
  sectionTitle: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  caption: { fontSize: 13, lineHeight: 20, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: layout.radius, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingVertical: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionCopy: { flex: 1, minWidth: 0, gap: 3 },
  actionTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  empty: { paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', backgroundColor: colors.surface, borderRadius: layout.radius, borderWidth: 1, borderColor: colors.border, marginVertical: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brand['50'], justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptyCopy: { maxWidth: 420, fontSize: 15, lineHeight: 23, color: colors.muted, marginTop: 10, textAlign: 'center' },
});
