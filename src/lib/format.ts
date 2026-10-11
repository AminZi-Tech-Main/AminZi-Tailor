export const fmt = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** "Ahmad Shah" → "AS". Arabic-script letters get a zero-width non-joiner so they stay two letters, not a word. */
export const initials = (n: string | null | undefined) => {
  const letters = (n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2);
  return /[\u0600-\u06ff]/.test(letters.join('')) ? letters.join('\u200c') : letters.join('').toUpperCase();
};

/** Afghan mobile numbers: 07X XXX XXXX or +93 7X XXX XXXX (spaces optional). */
export const phoneOk = (p: string) => /^(\+93|0)\s?7\d(\s?\d){7}$/.test((p || '').trim());

export const digitsOnly = (s: string) => s.replace(/[^\d]/g, '');
export const decimalOnly = (s: string) => {
  const clean = s.replace(/[^\d.]/g, '');
  const [a, ...rest] = clean.split('.');
  return rest.length ? `${a}.${rest.join('').slice(0, 1)}` : a;
};

export const uid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >>> 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// ---------------------------------------------------------------------------
// Dates. Due dates are stored as plain YYYY-MM-DD in the shop's local time.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoDate(new Date());
export const parseIso = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (n: number, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
export const dayDiff = (iso: string) =>
  Math.round((parseIso(iso).getTime() - parseIso(todayIso()).getTime()) / 864e5);

/** Afghan working week starts on Saturday. */
export const weekStart = () => {
  const d = new Date();
  const back = (d.getDay() + 1) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
};

// ---- Solar Hijri (jalaali) conversion — algorithm from jalaali-js (MIT) ----
const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;
const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy: number) {
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jm = 0, jump = 0, n = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
export function toJalaali(gy: number, gm: number, gd: number) {
  const jdn = g2d(gy, gm, gd);
  const g = d2g(jdn).gy;
  let jy = g - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

// Localised date text (month names, "Today", "2 days late" …) lives in lib/i18n.ts.
