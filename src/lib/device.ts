const DEVICE_ID_KEY = 'sa_smkn6_device_id';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `DEV-${crypto.randomUUID().slice(0, 12).toUpperCase()}`
        : `DEV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return 'DEV-BROWSER-FALLBACK';
  }
}

export function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web Device';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android Scanner';
  if (/iPhone|iPad/i.test(ua)) return 'iOS Scanner';
  if (/Windows/i.test(ua)) return 'Windows PC/Laptop';
  if (/Mac/i.test(ua)) return 'Mac Laptop';
  return 'Web Browser Device';
}

export function generateTxUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
