import { MEAS_KEYS, MEAS_LABEL } from '../lib/constants';
import { addDays, uid } from '../lib/format';
import type { CashCategory, CashDirection, Garment, Meas, MeasKey, Role, Shop, Stage } from '../lib/types';
import { enqueue, getState, nextCode } from './store';

const shopId = () => {
  const id = getState().shopId;
  if (!id) throw new Error('No shop open');
  return id;
};
const now = () => new Date().toISOString();
const view = () => getState().view;

/** Turn form strings into a clean measurement object (only filled fields). */
export function cleanMeas(m: Partial<Record<MeasKey, string | number | null | undefined>>): Meas {
  const out: Meas = {};
  for (const k of MEAS_KEYS) {
    const v = m[k];
    if (v === '' || v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.round(n * 10) / 10;
  }
  return out;
}

/** "Chest 102 → 104, waist 94 → 96" */
export function measDiff(before: Meas, after: Meas) {
  const changes: string[] = [];
  for (const k of MEAS_KEYS) {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    if (b != null && a !== b) changes.push(a == null ? `${MEAS_LABEL[k]} ${b}` : `${MEAS_LABEL[k]} ${a} → ${b}`);
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Customers & measurements
// ---------------------------------------------------------------------------

export function createCustomer(name: string, phone: string, meas: Meas, by: string | null) {
  const id = uid();
  const code = nextCode('customers', view().customers.map((c) => c.code));
  const hasMeas = Object.keys(meas).length > 0;
  enqueue(
    { kind: 'insert', table: 'customers', row: { id, shop_id: shopId(), code, name: name.trim(), phone: phone.trim(), since: new Date().getFullYear(), meas, created_at: now() } },
    ...(hasMeas
      ? [{ kind: 'insert' as const, table: 'measurement_history' as const, row: { id: uid(), shop_id: shopId(), customer_id: id, staff_id: by, text: 'First measurement', meas, created_at: now() } }]
      : []),
  );
  return id;
}

/** Merge new values into a customer's measurements and log what changed. Returns the change count. */
export function saveMeasurements(customerId: string, values: Meas, by: string | null, note?: string) {
  const c = view().customers.find((x) => x.id === customerId);
  if (!c) return 0;
  const merged: Meas = { ...c.meas, ...values };
  const changes = measDiff(c.meas, merged);
  if (!changes.length) return 0;
  const text = note ? `${note}: ${changes.join(', ')}` : changes.join(', ');
  enqueue(
    { kind: 'update', table: 'customers', rowId: customerId, patch: { meas: merged } },
    { kind: 'insert', table: 'measurement_history', row: { id: uid(), shop_id: shopId(), customer_id: customerId, staff_id: by, text: text.length > 240 ? `${text.slice(0, 237)}…` : text, meas: merged, created_at: now() } },
  );
  return changes.length;
}

export function updateCustomer(customerId: string, patch: { name?: string; phone?: string }) {
  enqueue({ kind: 'update', table: 'customers', rowId: customerId, patch });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface NewOrderInput {
  customerId: string | null;
  newCustomer?: { name: string; phone: string };
  meas: Meas;
  garment: Garment;
  qty: number;
  fabricId: string | null;
  tailorId: string | null;
  dueInDays: number;
  price: number;
  deposit: number;
  notes: string;
}

/** One step: create customer if new, merge measurements, create order, take fabric, record deposit. */
export function createOrder(input: NewOrderInput, by: string | null) {
  const s = view();
  const shop = s.shop!;
  let customerId = input.customerId;
  if (!customerId && input.newCustomer) {
    customerId = createCustomer(input.newCustomer.name, input.newCustomer.phone, input.meas, by);
  } else if (customerId && Object.keys(input.meas).length) {
    saveMeasurements(customerId, input.meas, by, 'With new order');
  }
  if (!customerId) throw new Error('Pick a customer first');

  const id = uid();
  const code = nextCode('orders', getState().view.orders.map((o) => o.code), shop.order_prefix);
  const metres = Math.round(input.garment.m * input.qty * 10) / 10;
  const ops: Parameters<typeof enqueue> = [
    {
      kind: 'insert', table: 'orders',
      row: {
        id, shop_id: shop.id, code, customer_id: customerId, garment: input.garment.name, qty: input.qty,
        fabric_id: input.fabricId, metres: input.fabricId ? metres : 0, tailor_id: input.tailorId, stage: 'Cutting',
        due: addDays(input.dueInDays), total: input.price, paid: 0, notes: input.notes.trim() || null, created_by: by, created_at: now(),
      },
    },
  ];
  if (input.fabricId && metres > 0) {
    ops.push({ kind: 'insert', table: 'fabric_movements', row: { id: uid(), shop_id: shop.id, fabric_id: input.fabricId, delta: -metres, reason: 'order', order_id: id, staff_id: by, created_at: now() } });
  }
  if (input.deposit > 0) {
    ops.push({ kind: 'insert', table: 'payments', row: { id: uid(), shop_id: shop.id, order_id: id, amount: input.deposit, staff_id: by, created_at: now() } });
  }
  enqueue(...ops);
  return { id, code, metres };
}

export function setStage(orderId: string, stage: Stage) {
  enqueue({ kind: 'update', table: 'orders', rowId: orderId, patch: { stage } });
}

export function setDue(orderId: string, due: string) {
  enqueue({ kind: 'update', table: 'orders', rowId: orderId, patch: { due } });
}

export function recordPayment(orderId: string, amount: number, by: string | null) {
  const o = view().orders.find((x) => x.id === orderId);
  if (!o) return 0;
  const v = Math.min(Math.round(amount), o.total - o.paid);
  if (v <= 0) return 0;
  enqueue({ kind: 'insert', table: 'payments', row: { id: uid(), shop_id: shopId(), order_id: orderId, amount: v, staff_id: by, created_at: now() } });
  return v;
}

// ---------------------------------------------------------------------------
// Fabric & perfume stock (ledger moves)
// ---------------------------------------------------------------------------

/**
 * A sale also puts the money in the cash book, so "Money in the shop" goes up at once
 * (skipped while the cash-book SQL hasn't been run, so the server doesn't reject it).
 */
export function moveFabric(fabricId: string, delta: number, reason: 'sale' | 'restock' | 'adjust', by: string | null) {
  const f = view().fabrics.find((x) => x.id === fabricId);
  enqueue(
    { kind: 'insert', table: 'fabric_movements', row: { id: uid(), shop_id: shopId(), fabric_id: fabricId, delta, reason, order_id: null, staff_id: by, created_at: now() } },
    ...(reason === 'sale' && f && f.price_per_metre > 0 && !getState().status.cashBookMissing
      ? [cashOp('in', Math.round(-delta * f.price_per_metre), 'fabric_sale', `${f.code} ${f.name}`.slice(0, 200), by)]
      : []),
  );
}

function cashOp(direction: CashDirection, amount: number, category: CashCategory, note: string | null, by: string | null) {
  return { kind: 'insert' as const, table: 'cash_entries' as const, row: { id: uid(), shop_id: shopId(), direction, amount, category, note, staff_id: by, created_at: now() } };
}

/** Money in (opening cash, other income) or money out (wages, rent, bills, purchases, other). */
export function addCash(direction: CashDirection, amount: number, category: CashCategory, note: string, by: string | null) {
  const v = Math.round(amount);
  if (!(v > 0)) return 0;
  enqueue(cashOp(direction, v, category, note.trim().slice(0, 200) || null, by));
  return v;
}

export function addFabric(f: { name: string; color: string; swatch: string; metres: number; price: number }) {
  const code = nextCode('fabrics', view().fabrics.map((x) => x.code));
  enqueue({ kind: 'insert', table: 'fabrics', row: { id: uid(), shop_id: shopId(), code, name: f.name.trim(), color: f.color, swatch: f.swatch, metres_left: f.metres, metres_of: f.metres, price_per_metre: f.price, created_at: now() } });
  return code;
}

export function movePerfume(perfumeId: string, delta: number, reason: 'sale' | 'restock' | 'adjust', by: string | null) {
  const p = view().perfumes.find((x) => x.id === perfumeId);
  enqueue(
    { kind: 'insert', table: 'perfume_movements', row: { id: uid(), shop_id: shopId(), perfume_id: perfumeId, delta, reason, unit_price: reason === 'sale' ? p?.price ?? null : null, staff_id: by, created_at: now() } },
    ...(reason === 'sale' && p && p.price > 0 && !getState().status.cashBookMissing
      ? [cashOp('in', Math.round(-delta * p.price), 'perfume_sale', `${p.code} ${p.name}`.slice(0, 200), by)]
      : []),
  );
}

export function addPerfume(p: { name: string; size: string; price: number; stock: number; tint: string }) {
  const code = nextCode('perfumes', view().perfumes.map((x) => x.code));
  enqueue({ kind: 'insert', table: 'perfumes', row: { id: uid(), shop_id: shopId(), code, name: p.name.trim(), size: p.size, price: p.price, stock: p.stock, tint: p.tint, created_at: now() } });
  return code;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export function addStaff(u: { name: string; phone: string; role: Role; pieceRate: number }) {
  const id = uid();
  enqueue({ kind: 'insert', table: 'staff', row: { id, shop_id: shopId(), name: u.name.trim(), phone: u.phone.trim(), role: u.role, piece_rate: u.pieceRate, active: true, pin_hash: null, pin_salt: null, created_at: now() } });
  return id;
}
export function updateStaff(id: string, patch: Partial<{ active: boolean; piece_rate: number; role: Role; phone: string; name: string; pin_hash: string | null; pin_salt: string | null; last_seen: string }>) {
  enqueue({ kind: 'update', table: 'staff', rowId: id, patch });
}

// ---------------------------------------------------------------------------
// Shop settings
// ---------------------------------------------------------------------------

export function updateShop(patch: Partial<Shop>) {
  enqueue({ kind: 'shop', patch });
}
