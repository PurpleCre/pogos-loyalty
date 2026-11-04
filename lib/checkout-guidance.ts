import type { CheckoutRequest } from './cash-checkout';

export type CheckoutField = 'name' | 'phone' | 'location' | 'address' | 'instructions';
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

// Local guidance mirrors the public request rules. The server still resolves
// prices, branch intake, delivery coverage, stock and all financial decisions.
export function checkoutFieldErrors(request: CheckoutRequest): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (request.contact.name.trim().length < 2 || request.contact.name.trim().length > 120) errors.name = 'Enter a contact name between 2 and 120 characters.';
  if (!/^\+[1-9][0-9]{7,14}$/.test(request.contact.phone)) errors.phone = 'Use a Zimbabwe number such as 077 123 4567, or an international number starting with +.';
  if (request.fulfilment_mode === 'delivery') {
    const address = request.address;
    if (!address || !Number.isFinite(address.latitude) || !Number.isFinite(address.longitude) || Math.abs(address.latitude) > 90 || Math.abs(address.longitude) > 180) errors.location = 'Choose a delivery pin so the branch can check coverage.';
    if (!address || address.address.trim().length < 5 || address.address.trim().length > 500 || ['selected from map', 'unknown address'].includes(address.address.trim().toLowerCase())) errors.address = 'Enter the street, suburb and useful landmarks for your delivery.';
    if (address && address.instructions.length > 500) errors.instructions = 'Keep delivery instructions within 500 characters.';
  }
  return errors;
}
