// Browser users retain the in-app inbox; native Expo registration is separate.
export const pushSupported = false;
export async function devicePushEnabled(_owner: string) { return false; }
export async function enableDevicePush(_owner: string, _isCurrent: () => boolean) { throw Error('Push requires an Android or iOS app build.'); }
export async function refreshDevicePush(_owner: string, _isCurrent: () => boolean) {}
export async function disableDevicePush(_owner: string) {}
export async function disablePushForLogout(_owner: string, _token: string) {}
