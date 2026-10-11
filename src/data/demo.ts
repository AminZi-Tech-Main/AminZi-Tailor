/**
 * Demo shop — the exact mock data from the design handoff (aminzi-model.js),
 * with due dates shifted so they stay relative to today.
 * Runs entirely in this browser; nothing is sent to Supabase.
 */
import { addDays, uid } from '../lib/format';
import type { CashEntry, Customer, Fabric, HistoryEntry, Meas, Order, Payment, Perfume, Shop, Snapshot, Stage, Staff } from '../lib/types';
import { DEFAULT_GARMENTS } from '../lib/constants';

export const DEMO_SHOP_ID = 'demo-shop';
const MODEL_TODAY = new Date(2026, 9, 10); // the mockup's "today"

const KEYS = ['shoulder', 'chest', 'waist', 'hem', 'length', 'sleeve', 'collar', 'tlength', 'twaist', 'thigh', 'cuff'] as const;
const M = (a: number[]): Meas => Object.fromEntries(KEYS.map((k, i) => [k, a[i]]));
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
/** Shift a mockup date (relative to 10 Oct 2026) onto today's calendar. */
const shift = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - MODEL_TODAY.getTime()) / 864e5);
  return addDays(diff);
};

export function demoSnapshot(): Snapshot {
  const S = DEMO_SHOP_ID;
  const now = new Date();
  const yesterday1830 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 30).toISOString();

  const shop: Shop = {
    id: S, name: 'AminZi Fabrics & Tailors', phone: '+93 70 000 1100', calendar: 'Solar Hijri', lang: 'English', flip_rtl: false,
    receipt_printer: 'XP-80 (USB)', label_printer: 'Zebra ZD220 (USB)', auto_backup: true, last_backup: yesterday1830,
    order_prefix: 'AT', low_fabric_m: 8, low_perfume: 5, garments: DEFAULT_GARMENTS,
  };

  const st = (name: string, role: Staff['role'], phone: string, active: boolean, lastMins: number, rate = 0): Staff => ({
    id: uid(), shop_id: S, name, role, phone, active, piece_rate: rate, pin_hash: null, pin_salt: null, last_seen: ago(lastMins), created_at: ago(100000),
  });
  const staff = [
    st('Roohullamin', 'Admin', '+93 70 000 1100', true, 0),
    st('Sadia Noori', 'Front desk', '+93 79 000 2211', true, 10),
    st('Rahim', 'Tailor', '+93 78 000 3322', true, 60, 500),
    st('Gul Agha', 'Tailor', '+93 77 000 4433', true, 60 * 24, 550),
    st('Najib', 'Tailor', '+93 70 000 5544', false, 60 * 24 * 3, 600),
  ];
  const tailor = (n: string) => staff.find((x) => x.name === n)!.id;

  const custRows: [string, string, string, number, number[]][] = [
    ['C-0118', 'Ahmad Shah Noori', '+93 70 412 8831', 2023, [46, 104, 96, 118, 102, 61, 40, 104, 92, 64, 22]],
    ['C-0121', 'Farid Ahmadzai', '+93 79 220 1045', 2024, [48, 110, 102, 122, 106, 63, 42, 106, 98, 67, 23]],
    ['C-0097', 'Hamid Karimi', '+93 78 553 9012', 2022, [44, 98, 88, 112, 98, 59, 39, 100, 86, 60, 21]],
    ['C-0130', 'Sayed Jawad Hashimi', '+93 77 680 3321', 2025, [47, 106, 98, 120, 104, 62, 41, 105, 94, 65, 22]],
    ['C-0102', 'Mirwais Popal', '+93 70 901 4476', 2022, [49, 112, 104, 124, 108, 64, 43, 108, 100, 68, 24]],
    ['C-0125', 'Zubair Amiri', '+93 79 314 7720', 2024, [45, 100, 90, 114, 100, 60, 40, 102, 88, 62, 21]],
    ['C-0140', 'Khalid Rahimi', '+93 72 118 0934', 2025, [45, 101, 92, 115, 101, 60, 40, 103, 90, 62, 21]],
    ['C-0141', 'Naveed Sultani', '+93 78 772 4410', 2025, [46, 103, 94, 117, 102, 61, 40, 104, 91, 63, 22]],
    ['C-0142', 'Bashir Ludin', '+93 70 640 2287', 2026, [47, 105, 97, 119, 103, 62, 41, 104, 93, 64, 22]],
  ];
  const customers: Customer[] = custRows.map(([code, name, phone, since, m]) => ({ id: uid(), shop_id: S, code, name, phone, since, meas: M(m), created_at: `${since}-05-06T09:00:00Z` }));
  const cust = (code: string) => customers.find((c) => c.code === code)!;

  const history: HistoryEntry[] = [];
  const hist = (code: string, isoDate: string, text: string) =>
    history.push({ id: uid(), shop_id: S, customer_id: cust(code).id, staff_id: null, text, meas: cust(code).meas, created_at: `${isoDate}T10:00:00Z` });
  hist('C-0118', '2026-03-02', 'Chest 102 → 104, waist 94 → 96');
  hist('C-0118', '2025-09-14', 'Sleeve 60 → 61');
  hist('C-0118', '2023-05-06', 'First measurement');
  for (const c of customers) if (c.code !== 'C-0118') hist(c.code, `${c.since}-05-06`, 'First measurement');

  const fabRows: [string, string, string, string, number, number, number][] = [
    ['FB-201', 'Kandahari cotton', 'White', '#f4f1ea', 38, 60, 320],
    ['FB-202', 'Wool suiting', 'Navy', '#1f2b4a', 6.5, 50, 1450],
    ['FB-203', 'Linen', 'Sand', '#d8c7a4', 22, 40, 680],
    ['FB-204', 'Wool coating', 'Karakul grey', '#6e6a66', 4, 30, 1800],
    ['FB-205', 'Lawn cotton', 'Sky', '#b9d4e6', 41, 60, 360],
    ['FB-206', 'Silk blend', 'Charcoal', '#3a3a3c', 12, 25, 2100],
  ];
  const fabrics: Fabric[] = fabRows.map(([code, name, color, swatch, left, of, price]) => ({ id: uid(), shop_id: S, code, name, color, swatch, metres_left: left, metres_of: of, price_per_metre: price }));

  const perfumes: Perfume[] = [
    ['PF-01', 'Oud Al Noor', '50 ml', 1800, 12, '#7a4b2a'],
    ['PF-02', 'Musk Tahara', '12 ml', 350, 40, '#e9dfe8'],
    ['PF-03', 'Amber Kabul', '100 ml', 2600, 5, '#d18b2c'],
    ['PF-04', 'Rose Herat', '30 ml', 900, 18, '#c4566b'],
    ['PF-05', 'Sandal Royal', '50 ml', 1500, 3, '#b99a6b'],
  ].map(([code, name, size, price, stock, tint]) => ({ id: uid(), shop_id: S, code: code as string, name: name as string, size: size as string, price: price as number, stock: stock as number, tint: tint as string }));

  const garmentM: Record<string, number> = Object.fromEntries(DEFAULT_GARMENTS.map((g) => [g.name, g.m]));
  const orderRows: [string, string, string, number, string, Stage, string, number, number][] = [
    ['AT-1042', 'C-0118', 'Perahan Tunban', 2, 'Rahim', 'Sewing', '2026-10-14', 4800, 2000],
    ['AT-1041', 'C-0121', 'Over Coat', 1, 'Najib', 'Cutting', '2026-10-20', 9500, 5000],
    ['AT-1040', 'C-0097', 'Waskat', 1, 'Rahim', 'Ready', '2026-10-11', 2200, 2200],
    ['AT-1039', 'C-0130', 'Perahan Tunban', 3, 'Gul Agha', 'Sewing', '2026-10-09', 7200, 3000],
    ['AT-1038', 'C-0102', 'Chapan', 1, 'Najib', 'Cutting', '2026-10-25', 12000, 6000],
    ['AT-1037', 'C-0125', 'Over Coat', 2, 'Gul Agha', 'Ready', '2026-10-10', 18000, 10000],
    ['AT-1036', 'C-0140', 'Perahan Tunban', 1, 'Rahim', 'Delivered', '2026-10-06', 2400, 2400],
    ['AT-1035', 'C-0141', 'Waskat', 2, 'Najib', 'Sewing', '2026-10-13', 4400, 1500],
    ['AT-1034', 'C-0142', 'Perahan Tunban', 2, 'Gul Agha', 'Cutting', '2026-10-12', 4800, 2000],
    ['AT-1033', 'C-0118', 'Waskat', 1, 'Rahim', 'Delivered', '2026-09-28', 2200, 2200],
    ['AT-1032', 'C-0097', 'Perahan Tunban', 2, 'Najib', 'Ready', '2026-10-09', 4800, 4000],
  ];
  const fabFor: Record<string, string> = { 'Perahan Tunban': 'FB-201', Waskat: 'FB-202', 'Over Coat': 'FB-204', Chapan: 'FB-206' };
  const orders: Order[] = [];
  const payments: Payment[] = [];
  orderRows.forEach(([code, c, garment, qty, t, stage, due, total, paid], i) => {
    const id = uid();
    const done = stage === 'Ready' || stage === 'Delivered';
    orders.push({
      id, shop_id: S, code, customer_id: cust(c).id, garment, qty, fabric_id: fabrics.find((f) => f.code === fabFor[garment])!.id,
      metres: Math.round(garmentM[garment] * qty * 10) / 10, tailor_id: tailor(t), stage, due: shift(due), total, paid, notes: null,
      ready_at: done ? ago(60 * (i + 2)) : null, delivered_at: stage === 'Delivered' ? ago(60 * (i + 1)) : null,
      created_by: staff[0].id, created_at: ago(60 * 24 * (i + 1)),
    });
    if (paid > 0) payments.push({ id: uid(), shop_id: S, order_id: id, amount: paid, staff_id: staff[1].id, created_at: ago(60 * 24 * (i + 1)) });
  });

  // Cash book: opening cash, a few counter sales and two expenses (order payments above count too).
  const cash = (direction: CashEntry['direction'], amount: number, category: CashEntry['category'], note: string, mins: number): CashEntry =>
    ({ id: uid(), shop_id: S, direction, amount, category, note, staff_id: staff[1].id, created_at: ago(mins) });
  const cash_entries: CashEntry[] = [
    cash('in', 1800, 'perfume_sale', 'PF-01 Oud Al Noor', 95),
    cash('in', 1360, 'fabric_sale', 'FB-203 Linen', 180),
    cash('in', 350, 'perfume_sale', 'PF-02 Musk Tahara', 60 * 26),
    cash('out', 5000, 'wages', 'Rahim', 60 * 24 * 2),
    cash('out', 1200, 'bills', 'Electricity', 60 * 24 * 3),
    cash('in', 15000, 'opening', 'Cash in the drawer', 60 * 24 * 6),
  ];

  return { shop, staff, customers, measurement_history: history, fabrics, perfumes, orders, payments, cash_entries };
}
