import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LocateFixed } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/lib/theme';

type Coordinate = { latitude: number; longitude: number };
type Region = Coordinate & { latitudeDelta: number; longitudeDelta: number };
interface Props {
  style?: StyleProp<ViewStyle>; children?: ReactNode; region?: Region; initialRegion?: Region;
  onPress?(event: { nativeEvent: { coordinate: Coordinate } }): void;
  onRegionChangeComplete?(region: Region): void;
  showsUserLocation?: boolean; showsMyLocationButton?: boolean;
}

// Deliberate browser fallback: no map-provider requests or fabricated geocoding.
export default function LocationMap({ style, children, region, initialRegion, onPress, onRegionChangeComplete }: Props) {
  const marker = Children.toArray(children).find(child => isValidElement<{ coordinate?: Coordinate }>(child) && !!child.props.coordinate);
  const selected = isValidElement<{ coordinate?: Coordinate }>(marker) ? marker.props.coordinate : undefined;
  const [latitude, setLatitude] = useState(selected ? String(selected.latitude) : '');
  const [longitude, setLongitude] = useState(selected ? String(selected.longitude) : '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLatitude(selected ? String(selected.latitude) : ''); setLongitude(selected ? String(selected.longitude) : ''); }, [selected?.latitude, selected?.longitude]);
  const coordinate = latitude.trim() && longitude.trim() ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
  const valid = !!coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude) && Math.abs(coordinate.latitude) <= 90 && Math.abs(coordinate.longitude) <= 180;
  const apply = (value: Coordinate) => {
    onPress?.({ nativeEvent: { coordinate: value } });
    onRegionChangeComplete?.({ latitudeDelta: region?.latitudeDelta ?? initialRegion?.latitudeDelta ?? 0.05, longitudeDelta: region?.longitudeDelta ?? initialRegion?.longitudeDelta ?? 0.05, ...value });
    setMessage('Pin selected. Check the written address below.');
  };
  const locate = () => {
    if (!navigator.geolocation) { setMessage('Location is unavailable. Enter the coordinates of your pin.'); return; }
    setBusy(true); setMessage('');
    navigator.geolocation.getCurrentPosition(position => { setBusy(false); apply({ latitude: position.coords.latitude, longitude: position.coords.longitude }); },
      () => { setBusy(false); setMessage('Location could not be confirmed. Enter a known pin or use the map in the mobile app.'); }, { timeout: 10000, maximumAge: 0 });
  };
  return <View style={[styles.container, style]}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.note}>Interactive maps are available in the mobile app. Here, use your current location or enter a known pin.</Text>
    <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.label}>Latitude</Text><Input accessibilityLabel="Pin latitude" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" placeholder="−17.8252" /></View>
      <View style={{ flex: 1 }}><Text style={styles.label}>Longitude</Text><Input accessibilityLabel="Pin longitude" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" placeholder="31.0335" /></View></View>
    <View style={styles.row}><Button size="sm" variant="outline" onPress={locate} isLoading={busy} className="flex-1"><LocateFixed size={17} color={colors.primary} /><Text style={styles.buttonText}>Use my location</Text></Button>
      <Button size="sm" disabled={!valid || busy} onPress={() => { if (coordinate && valid) apply(coordinate); }} className="flex-1">Set pin</Button></View>
    {message ? <Text accessibilityRole="alert" style={styles.note}>{message}</Text> : null}
  </ScrollView></View>;
}
export function Marker(_props: { coordinate: Coordinate; pinColor?: string }) { return null; }
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10 },
  buttonText: { color: colors.primary, fontSize: 11, fontWeight: '700', marginLeft: 6 },
});
