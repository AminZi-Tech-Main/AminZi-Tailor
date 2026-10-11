import type { ListTable, Op, Order, Snapshot, Stage } from '../lib/types';

export const emptySnapshot = (): Snapshot => ({
  shop: null, staff: [], customers: [], measurement_history: [], fabrics: [], perfumes: [], orders: [], payments: [], cash_entries: [],
});

const LIST_TABLES: ListTable[] = ['staff', 'customers', 'measurement_history', 'fabrics', 'perfumes', 'orders', 'payments', 'cash_entries'];
const isList = (t: string): t is ListTable => (LIST_TABLES as string[]).includes(t);

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Mirror of the database's orders trigger so the screen matches the server. */
function stageStamps(prev: Order | null, stage: Stage) {
  const now = new Date().toISOString();
  const open = stage === 'Cutting' || stage === 'Sewing';
  return {
    ready_at: open ? null : prev?.ready_at ?? now,
    delivered_at: stage === 'Delivered' ? prev?.delivered_at ?? now : null,
  };
}

/** Apply one queued change to a snapshot. Pure — returns a new snapshot. */
export function applyOp(s: Snapshot, op: Op): Snapshot {
  if (op.kind === 'shop') return s.shop ? { ...s, shop: { ...s.shop, ...op.patch } } : s;

  if (op.kind === 'update') {
    const list = (s[op.table] ?? []) as unknown as { id: string }[];
    const next = list.map((r) => {
      if (r.id !== op.rowId) return r;
      let merged = { ...r, ...op.patch } as Record<string, unknown>;
      if (op.table === 'orders' && 'stage' in op.patch && (r as unknown as Order).stage !== op.patch.stage) {
        merged = { ...merged, ...stageStamps(r as unknown as Order, op.patch.stage as Stage) };
      }
      return merged as unknown as { id: string };
    });
    return { ...s, [op.table]: next };
  }

  // insert
  const row = op.row as Record<string, unknown> & { id: string };
  let out = s;
  if (isList(op.table)) {
    const list = (s[op.table] ?? []) as unknown as { id: string }[]; // copies saved before a table existed lack it
    if (list.some((r) => r.id === row.id)) return s;
    let r: Record<string, unknown> = row;
    if (op.table === 'orders') {
      r = { ...row, paid: 0, ...stageStamps(null, row.stage as Stage) };
    }
    out = { ...s, [op.table]: [r, ...list] };
  }

  switch (op.table) {
    case 'payments':
      return {
        ...out,
        orders: out.orders.map((o) => (o.id === row.order_id ? { ...o, paid: Number(o.paid) + Number(row.amount) } : o)),
      };
    case 'fabric_movements':
      return {
        ...out,
        fabrics: out.fabrics.map((f) => {
          if (f.id !== row.fabric_id) return f;
          const left = round1(Number(f.metres_left) + Number(row.delta));
          return { ...f, metres_left: left, metres_of: Math.max(Number(f.metres_of), left) };
        }),
      };
    case 'perfume_movements':
      return {
        ...out,
        perfumes: out.perfumes.map((p) => (p.id === row.perfume_id ? { ...p, stock: Number(p.stock) + Number(row.delta) } : p)),
      };
    default:
      return out;
  }
}

export const rebase = (server: Snapshot, outbox: Op[]) => outbox.reduce(applyOp, server);

/** Postgres numeric can arrive as strings; normalise everything we compute with. */
export function normalise(s: Snapshot): Snapshot {
  const n = (v: unknown) => (v == null ? 0 : Number(v));
  return {
    shop: s.shop ? { ...s.shop, low_fabric_m: n(s.shop.low_fabric_m), low_perfume: n(s.shop.low_perfume), garments: s.shop.garments ?? [] } : null,
    staff: s.staff.map((x) => ({ ...x, piece_rate: n(x.piece_rate) })),
    customers: s.customers.map((x) => ({ ...x, meas: x.meas ?? {} })),
    measurement_history: s.measurement_history,
    fabrics: s.fabrics.map((x) => ({ ...x, metres_left: n(x.metres_left), metres_of: n(x.metres_of), price_per_metre: n(x.price_per_metre) })),
    perfumes: s.perfumes.map((x) => ({ ...x, price: n(x.price), stock: n(x.stock) })),
    orders: s.orders.map((x) => ({ ...x, total: n(x.total), paid: n(x.paid), qty: n(x.qty), metres: n(x.metres) })),
    payments: s.payments.map((x) => ({ ...x, amount: n(x.amount) })),
    cash_entries: (s.cash_entries ?? []).map((x) => ({ ...x, amount: n(x.amount) })),
  };
}
