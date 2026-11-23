import crypto from 'crypto';
import { getOfflineSigningSecret } from '../config';

/**
 * Generates an unpredictable, opaque QR token with no embedded student PII.
 * Format: SA-<48 hex chars> (192 bits of entropy)
 */
export function generateOpaqueQrToken(): string {
  const raw = crypto.randomBytes(24).toString('hex').toUpperCase();
  return `SA-${raw}`;
}

/**
 * Deterministic canonical JSON stringification for HMAC signing.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(',')}}`;
}

export function signPayload(payload: object, secretOverride?: string): string {
  const secret = secretOverride || getOfflineSigningSecret();
  const data = canonicalStringify(payload);
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifySignedPayload(
  payload: object,
  signature: string,
  secretOverride?: string
): boolean {
  if (!signature || typeof signature !== 'string') return false;
  const expected = signPayload(payload, secretOverride);
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
