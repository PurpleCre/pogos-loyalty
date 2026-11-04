import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './button';

export function Confirmation({ visible, title, children, confirmLabel, cancelLabel = 'Go back', busy = false, disabled = false, destructive = false, onConfirm, onClose }: {
  visible: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string;
  busy?: boolean; disabled?: boolean; destructive?: boolean; onConfirm(): void; onClose(): void;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => { if (!busy) onClose(); }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <View accessibilityViewIsModal className="w-full max-w-xl self-center bg-white rounded-3xl border border-line p-5" style={{ maxHeight: '90%' }}>
        <Text accessibilityRole="header" className="text-xl font-bold text-ink mb-4">{title}</Text>
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        <View className="gap-2 mt-5">
          <Button isLoading={busy} disabled={disabled} className={destructive ? 'bg-red-700' : undefined} onPress={onConfirm}>{confirmLabel}</Button>
          <Button variant="outline" disabled={busy} onPress={onClose}>{cancelLabel}</Button>
        </View>
      </View>
      </View>
    </SafeAreaView>
  </Modal>;
}
