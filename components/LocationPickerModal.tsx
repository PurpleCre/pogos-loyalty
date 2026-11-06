import { logPrivateError } from '@/lib/privacy-logging';
import { useState, useEffect, useRef, type ComponentRef } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, Platform, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { Input } from '@/components/ui/input';
import { TouchTarget } from '@/components/ui/touch-target';
import MapView, { Marker } from '@/components/LocationMap';
import { X, MapPin, Star, Home, Briefcase, Check, LocateFixed } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useOrder, type LocationData } from '@/contexts/OrderContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Button } from '@/components/ui/button';
import { colors } from '@/lib/theme';
import { validLocationPin, deliveryAddressError, gpsLocationFeedback, recentGpsOptions, type LocationPin } from '@/lib/location-picker';

interface Props { visible: boolean; onClose(): void; initialAddress?: string }
type Region = LocationPin & { latitudeDelta: number; longitudeDelta: number };

export function LocationPickerModal({ visible, onClose, initialAddress }: Props) {
  const { savedLocations, saveLocation, deliveryLocation, setDeliveryLocation } = useOrder();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const addressRef = useRef<ComponentRef<typeof Input>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const generation = useRef(0), gpsRequest = useRef(0), detailsY = useRef(0);
  const confirming = useRef(false), locatingRef = useRef(false), movingRef = useRef(false);
  const owner = useRef(user?.id); owner.current = user?.id;
  const currentLocation = useRef({ location: deliveryLocation, initialAddress }); currentLocation.current = { location: deliveryLocation, initialAddress };
  const [region, setRegion] = useState<Region>({ latitude: -17.8252, longitude: 31.0335, latitudeDelta: 0.025, longitudeDelta: 0.015 });
  const [selectedCoordinate, setSelectedCoordinate] = useState<LocationPin | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<LocationData | null>(null);
  const [addressInput, setAddressInput] = useState(''), [tagInput, setTagInput] = useState('');
  const [locationError, setLocationError] = useState(''), [addressError, setAddressError] = useState(''), [confirmationError, setConfirmationError] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [saving, setSaving] = useState(false), [locating, setLocating] = useState(false), [moving, setMoving] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(false);

  useEffect(() => {
    ++generation.current; ++gpsRequest.current;
    if (visible) {
      const { location: existing, initialAddress: draftAddress } = currentLocation.current;
      setSelectedCoordinate(validLocationPin(existing) ? { latitude: existing.latitude, longitude: existing.longitude } : null);
      setSelectedSaved(null); setAddressInput(draftAddress ?? existing?.address ?? ''); setTagInput('');
      setLocationError(''); setAddressError(''); setConfirmationError(''); setPinMessage(existing ? 'Your current pin. Check the address before confirming.' : '');
      confirming.current = false; locatingRef.current = false; movingRef.current = false;
      setSaving(false); setLocating(false); setMoving(false); setLocationAllowed(false);
      if (validLocationPin(existing)) setRegion(previous => ({ ...previous, latitude: existing.latitude, longitude: existing.longitude }));
    }
    return () => { ++generation.current; ++gpsRequest.current; };
  }, [visible, user?.id]);

  const cancelGps = () => { ++gpsRequest.current; locatingRef.current = false; setLocating(false); };
  const choosePin = (pin: LocationPin, message = 'Pin moved. Check that the written address matches this entrance.') => {
    if (confirming.current || !validLocationPin(pin)) return;
    const coordinate = { latitude: pin.latitude, longitude: pin.longitude };
    cancelGps(); setSelectedCoordinate(coordinate); setSelectedSaved(null); setLocationError(''); setConfirmationError(''); setPinMessage(message);
    setRegion(previous => ({ ...previous, ...coordinate }));
  };
  const handleCurrentLocation = async () => {
    if (locatingRef.current || confirming.current) return;
    const version = generation.current, request = ++gpsRequest.current;
    const current = () => generation.current === version && gpsRequest.current === request;
    locatingRef.current = true; setLocating(true); setLocationError('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!current()) return;
      if (permission.status !== 'granted') { setLocationError('Location permission is off. Move the map to your entrance and enter your address.'); return; }
      setLocationAllowed(true);
      const position = await Promise.race([
        (async () => await Location.getLastKnownPositionAsync(recentGpsOptions) ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }))(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Location timed out')), 12000); }),
      ]);
      if (!current()) return;
      const feedback = gpsLocationFeedback(position);
      if (!feedback.usable) { setLocationError(feedback.message); return; }
      choosePin({ latitude: position.coords.latitude, longitude: position.coords.longitude }, feedback.message);
    } catch (error) {
      logPrivateError('Location lookup failed', error);
      if (current()) setLocationError('We couldn’t find your location. Try again or move the map to choose your pin.');
    } finally {
      if (timeout) clearTimeout(timeout);
      if (current()) { locatingRef.current = false; setLocating(false); }
    }
  };
  const beginMapMove = () => {
    if (confirming.current) return;
    if (!movingRef.current) cancelGps();
    movingRef.current = true; setMoving(true);
  };
  const finishMapMove = (next: Region, details?: { isGesture?: boolean }) => {
    if (confirming.current) return;
    if (movingRef.current || details?.isGesture) choosePin({ latitude: next.latitude, longitude: next.longitude });
    setRegion(next); movingRef.current = false; setMoving(false);
  };
  const previewSavedLocation = (location: LocationData) => {
    if (confirming.current) return;
    if (!validLocationPin(location)) { setLocationError('This saved location has no valid map pin. Choose a new pin.'); return; }
    choosePin(location, 'Saved address selected. Review the pin and address, then confirm.');
    setSelectedSaved(location); setAddressInput(location.address); setTagInput(''); setAddressError('');
  };
  const confirmLocation = async (withoutSaving = false) => {
    if (confirming.current || locatingRef.current || movingRef.current) return;
    setConfirmationError('');
    if (!validLocationPin(selectedCoordinate)) { setLocationError('Choose a map pin before confirming your delivery location.'); return; }
    const validation = deliveryAddressError(addressInput);
    if (validation) { setAddressError(validation); addressRef.current?.focus(); scrollRef.current?.scrollTo({ y: detailsY.current, animated: true }); return; }
    const version = generation.current, account = user?.id;
    confirming.current = true; setSaving(true); setLocationError(''); setAddressError('');
    try {
      const next: LocationData = selectedSaved ?? { id: Math.random().toString(36).slice(2), address: addressInput.trim(), ...selectedCoordinate, tag: tagInput.trim() || undefined };
      const saved = tagInput.trim() && !withoutSaving ? await saveLocation(next) : next;
      if (version !== generation.current || owner.current !== account) return;
      if (!saved) { setConfirmationError('This address couldn’t be saved. Retry, or use it for this order without saving.'); return; }
      setDeliveryLocation(saved); onClose();
    } catch (error) {
      logPrivateError('Location confirmation failed', error);
      if (version === generation.current && owner.current === account) setConfirmationError('The location could not be confirmed. Retry, or use it for this order without saving.');
    } finally { if (version === generation.current) { confirming.current = false; setSaving(false); } }
  };
  const validPin = validLocationPin(selectedCoordinate);

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>DELIVER TO YOUR DOOR</Text><Text accessibilityRole="header" style={styles.title}>Set delivery location</Text></View>
        <TouchTarget accessibilityLabel="Close delivery location" onPress={onClose} style={styles.close}><X size={21} color={colors.ink} /></TouchTarget></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets bounces={false} contentContainerStyle={styles.content}>
          {savedLocations.length ? <View style={styles.savedSection}><Text style={styles.label}>Use a saved address</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            {savedLocations.map(location => {
              const Icon = location.tag?.toLowerCase() === 'home' ? Home : location.tag?.toLowerCase() === 'work' ? Briefcase : Star;
              const selected = selectedSaved?.id === location.id;
              return <TouchTarget key={location.id} accessibilityLabel={`Review saved location ${location.tag || location.address}`} accessibilityState={{ selected }} disabled={saving} onPress={() => previewSavedLocation(location)} style={[styles.savedCard, selected && styles.savedSelected]}>
                <Icon size={18} color={colors.primary} /><View style={{ flex: 1 }}><Text style={styles.savedName}>{location.tag || 'Saved address'}</Text><Text numberOfLines={2} style={styles.savedAddress}>{location.address}</Text></View>{selected ? <Check size={17} color={colors.primary} /> : null}
              </TouchTarget>;
            })}</ScrollView></View> : null}
          <View style={styles.step}><Text style={styles.stepNumber}>1</Text><Text style={styles.stepTitle}>{Platform.OS === 'web' ? 'Choose your pin' : 'Move the map to your entrance'}</Text></View>
          <View style={[styles.map, { height: Platform.OS === 'web' ? 300 : Math.max(250, Math.min(380, height * 0.4)) }]}>
            <MapView style={StyleSheet.absoluteFill} region={region}
              onPress={(event: { nativeEvent: { coordinate: LocationPin } }) => choosePin(event.nativeEvent.coordinate)}
              onPanDrag={beginMapMove} onRegionChange={(_next: Region, details?: { isGesture?: boolean }) => { if (details?.isGesture) beginMapMove(); }}
              onRegionChangeComplete={finishMapMove} scrollEnabled={!saving} zoomEnabled={!saving} pitchEnabled={false} rotateEnabled={false}
              showsUserLocation={locationAllowed} showsMyLocationButton={false} disabled={saving}>
              {Platform.OS === 'web' && selectedCoordinate ? <Marker coordinate={selectedCoordinate} pinColor={colors.primary} /> : null}
            </MapView>
            {Platform.OS !== 'web' ? <View pointerEvents="none" style={styles.pinOverlay}><View style={styles.pinShadow} /><MapPin size={44} color={validPin || moving ? colors.primary : colors.muted} fill="white" strokeWidth={2.5} style={{ position: 'absolute', bottom: '50%' }} /></View> : null}
            {Platform.OS !== 'web' ? <View style={styles.gpsControl}><Button variant="outline" size="sm" disabled={saving} isLoading={locating} accessibilityLabel="Use my current location" onPress={() => { void handleCurrentLocation(); }}><LocateFixed size={18} color={colors.primary} /><Text style={styles.gpsText}>Use my location</Text></Button></View> : null}
          </View>
          <View style={styles.mapFeedback}><Text accessibilityLiveRegion="polite" style={styles.helper}>{moving ? 'Release the map to place your pin.' : pinMessage || (Platform.OS === 'web' ? 'Set a pin, then add the address below.' : 'Drag or tap the map, or use your current location.')}</Text></View>
          <View style={styles.details} onLayout={event => { detailsY.current = event.nativeEvent.layout.y; }}>
            <View style={styles.step}><Text style={styles.stepNumber}>2</Text><Text style={styles.stepTitle}>Add the delivery address</Text></View>
            <Text style={styles.label}>Street, suburb & landmarks</Text>
            <Input ref={addressRef} value={addressInput} editable={!saving} multiline maxLength={500} accessibilityLabel="Written delivery address" accessibilityHint={addressError || 'Required: street, suburb and useful landmarks'} aria-invalid={!!addressError}
              onChangeText={value => { setAddressInput(value); setSelectedSaved(null); setAddressError(''); setConfirmationError(''); }} placeholder="House number, street, suburb and a nearby landmark" className={`min-h-[80px] ${addressError ? 'border-red-700' : ''}`} style={{ textAlignVertical: 'top' }} />
            {addressError ? <Text onLayout={() => scrollRef.current?.scrollTo({ y: detailsY.current, animated: true })} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{addressError}</Text> : <Text style={styles.helper}>Required, even when you use GPS. Your driver needs the written address too.</Text>}
            <Text style={[styles.label, { marginTop: 18 }]}>Save as <Text style={styles.optional}>(optional)</Text></Text>
            <Input value={tagInput} editable={!saving} maxLength={50} accessibilityLabel="Optional saved location label" onChangeText={value => { setTagInput(value); setSelectedSaved(null); setConfirmationError(''); }} placeholder="Home, Work or another label" />
            <Text style={styles.coverage}>Your branch confirms delivery coverage and fees in your online total.</Text>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {locationError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{locationError}</Text> : null}
          {confirmationError ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{confirmationError}</Text><Button variant="outline" disabled={saving} onPress={() => { void confirmLocation(true); }}>Use without saving</Button></View> : null}
          <View style={styles.pinSummary}><MapPin size={17} color={colors.primary} /><Text numberOfLines={2} style={styles.summaryText}>{validPin ? addressInput.trim() || 'Pin selected · add your written address' : 'Choose a pin to continue'}</Text>{validPin ? <Check size={17} color={colors.primary} /> : null}</View>
          <Button disabled={!validPin || saving || locating || moving} accessibilityState={{ busy: saving, disabled: !validPin || saving || locating || moving }} onPress={() => { void confirmLocation(); }}>{saving ? 'Saving…' : locating ? 'Finding your location…' : moving ? 'Placing pin…' : 'Confirm Location'}</Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  close: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas, borderRadius: 24 },
  content: { paddingBottom: 16 },
  savedSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  savedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 220, padding: 12, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  savedSelected: { backgroundColor: colors.brand['50'], borderColor: colors.primary },
  savedName: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  savedAddress: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginVertical: 14 },
  stepNumber: { width: 24, height: 24, lineHeight: 24, textAlign: 'center', borderRadius: 12, backgroundColor: colors.brand['100'], color: colors.primary, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  stepTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  map: { marginHorizontal: 16, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  pinOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pinShadow: { width: 16, height: 7, backgroundColor: '#174d4540', borderRadius: 10, position: 'absolute', top: '50%', marginTop: -3 },
  gpsControl: { position: 'absolute', bottom: 14, right: 12 },
  gpsText: { marginLeft: 7, fontWeight: '700', color: colors.primary, fontSize: 12 },
  mapFeedback: { paddingHorizontal: 22, paddingTop: 8 },
  details: { paddingHorizontal: 20 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  optional: { color: colors.muted, fontWeight: '400' },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 6 },
  coverage: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'white', gap: 8 },
  pinSummary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18 },
});
