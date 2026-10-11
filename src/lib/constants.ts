import type { Garment, MeasKey, Stage } from './types';
import { tk } from './tk';

export const STAGES: Stage[] = ['Cutting', 'Sewing', 'Ready', 'Delivered'];

export const STAGE_COLOR: Record<Stage, string> = {
  Cutting: '#8fb0d9',
  Sewing: '#9d8cff',
  Ready: 'var(--acc)',
  Delivered: 'var(--muted)',
};

export const DEFAULT_GARMENTS: Garment[] = [
  { name: 'Perahan Tunban', price: 2400, m: 4.5 },
  { name: 'Waskat', price: 2200, m: 1.5 },
  { name: 'Over Coat', price: 9500, m: 3 },
  { name: 'Chapan', price: 12000, m: 4 },
];

export const PERAHAN: [MeasKey, string][] = [
  ['shoulder', tk('Shoulder')], ['chest', tk('Chest')], ['waist', tk('Waist')], ['hem', tk('Hem width')],
  ['length', tk('Length')], ['sleeve', tk('Sleeve')], ['collar', tk('Collar')],
];
export const TUNBAN: [MeasKey, string][] = [
  ['tlength', tk('Length')], ['twaist', tk('Waist')], ['thigh', tk('Thigh')], ['cuff', tk('Cuff')],
];
export const MEAS_KEYS: MeasKey[] = [...PERAHAN, ...TUNBAN].map(([k]) => k);
export const MEAS_LABEL: Record<MeasKey, string> = Object.fromEntries(
  [...PERAHAN, ...TUNBAN.map(([k, l]) => [k, `T. ${l}`] as [MeasKey, string])],
) as Record<MeasKey, string>;

export const SWATCHES: [string, string][] = [
  ['White', '#f4f1ea'], ['Sand', '#d8c7a4'], ['Sky', '#b9d4e6'], ['Olive', '#7a7d4f'],
  ['Maroon', '#6b2333'], ['Navy', '#1f2b4a'], ['Grey', '#6e6a66'], ['Black', '#1b1b1d'],
];

export const PERFUME_SIZES = ['12 ml', '30 ml', '50 ml', '100 ml'];
export const PERFUME_TINTS = ['#7a4b2a', '#e9dfe8', '#d18b2c', '#c4566b', '#b99a6b', '#8a9a6a', '#6f8fa8'];

export const DUE_OPTIONS: [number, string][] = [[3, tk('3 days')], [7, tk('1 week')], [14, tk('2 weeks')], [21, tk('3 weeks')]];

/** Glass accent colours (AminZi Glass.dc.html). inkDark/inkLight = accent text on dark/light backdrops. */
export const ACCENTS = {
  teal: { name: tk('Teal'), acc: '#1db5a7', on: '#06201d', inkDark: '#4be3d4', inkLight: '#0f7d73' },
  navy: { name: tk('Navy'), acc: '#0052a3', on: '#ffffff', inkDark: '#79b0ff', inkLight: '#0052a3' },
  crimson: { name: tk('Crimson'), acc: '#e11d48', on: '#ffffff', inkDark: '#ff6b8b', inkLight: '#be123c' },
  amber: { name: tk('Amber'), acc: '#e8a33d', on: '#1f1405', inkDark: '#ffc56e', inkLight: '#945400' },
  violet: { name: tk('Violet'), acc: '#6d4cff', on: '#ffffff', inkDark: '#ab98ff', inkLight: '#5536e0' },
  ice: { name: tk('Ice'), acc: '#cfd9e6', on: '#111722', inkDark: '#e8eef6', inkLight: '#4a5a72' },
} as const;
export type AccentKey = keyof typeof ACCENTS;

export const SUPPORT_PHONE = '+93 73 006 7306';

export const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  orders: 'M9 2h6v4H9zM16 4h3v18H5V4h3M9 12h6M9 16h6',
  customers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  fabrics: 'M12 8c5 0 9-1.3 9-3s-4-3-9-3-9 1.3-9 3 4 3 9 3zM3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3',
  waitlist: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  perfumes: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  users: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  plus: 'M12 5v14M5 12h14',
  ruler: 'M21.3 15.3l-6.6 6.6a1 1 0 0 1-1.4 0L2.1 10.7a1 1 0 0 1 0-1.4l6.6-6.6a1 1 0 0 1 1.4 0l11.2 11.2a1 1 0 0 1 0 1.4zM7.5 10.5l2 2M10.5 7.5l2 2M13.5 13.5l2 2M16.5 10.5l2 2',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  roll: 'M4 6a8 3 0 0 0 16 0a8 3 0 0 0-16 0zM4 6v12a8 3 0 0 0 16 0V6M20 12h2',
} as const;
export type IconKey = keyof typeof ICONS;
