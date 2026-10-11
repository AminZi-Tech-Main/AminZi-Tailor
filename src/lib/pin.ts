/**
 * Counter PINs. Hashed on the device with PBKDF2-SHA256 so a counter can switch
 * users while offline. The PIN is a convenience lock between staff at one shop;
 * the real security boundary is the shop's Supabase sign-in plus row-level security.
 */
const ITER = 120_000;
const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');

export async function hashPin(pin: string, saltHex?: string) {
  const salt = saltHex ? new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return { hash: hex(bits), salt: hex(salt) };
}

export async function checkPin(pin: string, hash: string, salt: string) {
  const r = await hashPin(pin, salt);
  // constant-time-ish compare
  let diff = r.hash.length ^ hash.length;
  for (let i = 0; i < Math.min(r.hash.length, hash.length); i += 1) diff |= r.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export const pinOk = (p: string) => /^\d{4}$/.test(p);
