export interface LocationPin { latitude: number; longitude: number }
export const recentGpsOptions = { maxAge: 60_000, requiredAccuracy: 100 };

export function validLocationPin(pin: LocationPin | null | undefined): pin is LocationPin {
  return !!pin && Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude)
    && Math.abs(pin.latitude) <= 90 && Math.abs(pin.longitude) <= 180;
}

export function deliveryAddressError(address: string): string {
  const value = address.trim();
  return value.length < 5 || ['selected from map', 'unknown address'].includes(value.toLowerCase())
    ? 'Enter a written delivery address and landmarks for this map pin.' : '';
}

export function gpsLocationFeedback(location: { timestamp: number; coords: LocationPin & { accuracy: number | null } }, now = Date.now()) {
  if (!validLocationPin(location.coords) || !Number.isFinite(location.timestamp) || now - location.timestamp > recentGpsOptions.maxAge || location.timestamp > now + 5000) {
    return { usable: false, message: 'This location is out of date. Try again or choose your pin manually.' };
  }
  const age = Math.max(0, Math.floor((now - location.timestamp) / 1000));
  const found = `Location found ${age < 5 ? 'just now' : `${age} seconds ago`}`;
  const accuracy = location.coords.accuracy;
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0) return { usable: true, message: `${found}. Accuracy is unavailable; check the pin before confirming.` };
  return { usable: true, message: `${found} · accurate to about ${Math.max(1, Math.round(accuracy))} m.${accuracy > recentGpsOptions.requiredAccuracy ? ' Move the pin to your entrance for a more precise delivery location.' : ' Check the pin is at your entrance.'}` };
}
