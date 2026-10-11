import { STAGE_COLOR, STAGES } from '../lib/constants';
import { dayDiff, fmt, initials, todayIso, weekStart } from '../lib/format';
import { makeT, type T } from '../lib/i18n';
import { tk } from '../lib/tk';
import type { Customer, Fabric, Order, Snapshot, Stage, Staff } from '../lib/types';
import { useStore } from './store';

/** An order with everything the screens show, already in the shop's language. */
export interface OrderView extends Order {
  customer: string;
  phone: string;
  tailor: string;
  overdue: boolean;
  open: boolean;
  balance: number;
  paidPct: string;
  dueLabel: string;
  dueLong: string;
  stageColor: string;
  initials: string;
  garmentName: string;
  garmentQty: string;
  fabricName: string;
  /** Lower-case text the search box matches against (codes, names in both scripts, phone). */
  hay: string;
}

export function decorate(o: Order, cust: Map<string, Customer>, staff: Map<string, Staff>, fabrics: Map<string, Fabric>, i: T): OrderView {
  const { t, tv } = i;
  const cu = cust.get(o.customer_id);
  const dd = dayDiff(o.due);
  const open = o.stage === 'Cutting' || o.stage === 'Sewing';
  const overdue = dd < 0 && open;
  const short = i.short(o.due);
  const dueLabel = o.stage === 'Delivered' ? short
    : overdue ? t('{date} · {n}d late', { date: short, n: -dd })
      : dd === 0 ? t('Today') : dd === 1 ? t('Tomorrow') : short;
  const customer = tv(cu?.name) || '—';
  const tailorRaw = (o.tailor_id && staff.get(o.tailor_id)?.name) || '';
  return {
    ...o,
    customer,
    phone: cu?.phone ?? '',
    tailor: tv(tailorRaw) || '—',
    overdue,
    open,
    balance: o.total - o.paid,
    paidPct: `${o.total ? Math.round((o.paid / o.total) * 100) : 0}%`,
    dueLabel,
    dueLong: overdue
      ? t(-dd === 1 ? '{date} · 1 day late' : '{date} · {n} days late', { date: i.long(o.due), n: -dd })
      : i.long(o.due),
    stageColor: STAGE_COLOR[o.stage],
    initials: initials(customer),
    garmentName: tv(o.garment),
    garmentQty: `${tv(o.garment)} ×${o.qty}`,
    fabricName: tv((o.fabric_id && fabrics.get(o.fabric_id)?.name) || '') || t('Own fabric'),
    hay: `${o.code} ${cu?.name ?? ''} ${customer} ${(cu?.phone ?? '').replace(/\s/g, '')}`.toLowerCase(),
  };
}

/** Cash book categories as shown on screen. */
export const CASH_LABEL: Record<string, string> = {
  fabric_sale: tk('Fabric sale'), perfume_sale: tk('Perfume sale'), opening: tk('Opening cash'), other_in: tk('Other income'),
  wages: tk('Tailor wages'), rent: tk('Rent'), bills: tk('Bills (power, water)'), purchase: tk('Stock purchase'), other_out: tk('Other expense'),
};

export type NotifTarget = { kind: 'order'; id: string } | { kind: 'screen'; screen: 'fabrics' };
export interface Notif { key: string; tone: string; text: string; sub: string; target: NotifTarget }

export function derive(v: Snapshot) {
  const i = makeT(v.shop?.lang ?? 'English', v.shop?.calendar ?? 'Solar Hijri');
  const { t, tv } = i;
  const cust = new Map(v.customers.map((c) => [c.id, c]));
  const staff = new Map(v.staff.map((s) => [s.id, s]));
  const fab = new Map(v.fabrics.map((f) => [f.id, f]));
  const orders = v.orders
    .map((o) => decorate(o, cust, staff, fab, i))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.code.localeCompare(a.code));
  const active = orders.filter((o) => o.stage !== 'Delivered');
  const bySoonest = [...active].sort((a, b) => a.due.localeCompare(b.due));
  const byStage = Object.fromEntries(STAGES.map((s) => [s, orders.filter((o) => o.stage === s)])) as Record<Stage, OrderView[]>;
  const maxStage = Math.max(1, ...STAGES.map((s) => byStage[s].length));
  const pipeline = STAGES.map((st, n) => {
    const list = byStage[st];
    return { n: `0${n + 1}`, stage: st, count: list.length, pct: `${(list.length / maxStage) * 100}%`, color: STAGE_COLOR[st], codes: list.slice(0, 3).map((o) => o.code).join('  ') || '—' };
  });
  const dueSoon = bySoonest.filter((o) => dayDiff(o.due) <= 7);
  const owed = active.reduce((a, o) => a + o.balance, 0);
  const lowFabricMark = v.shop?.low_fabric_m ?? 8;
  const lowPerfumeMark = v.shop?.low_perfume ?? 5;
  const fabrics = [...v.fabrics].sort((a, b) => a.code.localeCompare(b.code));
  const perfumes = [...v.perfumes].sort((a, b) => a.code.localeCompare(b.code));
  const lowFabrics = fabrics.filter((f) => f.metres_left < lowFabricMark);
  const lowPerfumes = perfumes.filter((p) => p.stock <= lowPerfumeMark);

  // Wages: pieces that reached Ready this week (Saturday → Friday) × the tailor's piece rate.
  const ws = weekStart().getTime();
  const tailors = v.staff.filter((s) => s.role === 'Tailor');
  const wages = tailors
    .map((tl) => {
      const pieces = v.orders.filter((o) => o.tailor_id === tl.id && o.ready_at && new Date(o.ready_at).getTime() >= ws).reduce((a, o) => a + o.qty, 0);
      return { id: tl.id, name: tv(tl.name), pieces, amount: pieces * tl.piece_rate, active: tl.active };
    })
    .filter((w) => w.active || w.pieces > 0);
  const wageMax = Math.max(1, ...wages.map((w) => w.amount));
  const wagesTotal = wages.reduce((a, w) => a + w.amount, 0);

  const notifs: Notif[] = [
    ...active.filter((o) => o.overdue).map((o) => ({ key: `od-${o.id}`, tone: 'var(--danger)', text: t('{code} for {name} is overdue', { code: o.code, name: o.customer }), sub: o.dueLabel, target: { kind: 'order' as const, id: o.id } })),
    ...byStage.Ready.map((o) => ({ key: `rd-${o.id}`, tone: 'var(--acc)', text: t('Call {name} for pickup', { name: o.customer }), sub: `${o.code} · ${o.phone}`, target: { kind: 'order' as const, id: o.id } })),
    ...lowFabrics.map((f) => ({ key: `lf-${f.id}`, tone: '#e8a33d', text: t('{name} is running low', { name: tv(f.name) }), sub: t('{n} m left', { n: f.metres_left }), target: { kind: 'screen' as const, screen: 'fabrics' as const } })),
  ];

  // Money: every customer payment + cash book in − cash book out.
  const cashBook = v.cash_entries ?? [];
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const since = (iso: string, from: number) => new Date(iso).getTime() >= from;
  const paidIn = v.payments.reduce((a, p) => a + p.amount, 0);
  const bookIn = cashBook.filter((c) => c.direction === 'in').reduce((a, c) => a + c.amount, 0);
  const bookOut = cashBook.filter((c) => c.direction === 'out').reduce((a, c) => a + c.amount, 0);
  const inSince = (from: number) =>
    v.payments.filter((p) => since(p.created_at, from)).reduce((a, p) => a + p.amount, 0)
    + cashBook.filter((c) => c.direction === 'in' && since(c.created_at, from)).reduce((a, c) => a + c.amount, 0);
  const outSince = (from: number) => cashBook.filter((c) => c.direction === 'out' && since(c.created_at, from)).reduce((a, c) => a + c.amount, 0);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const note = (n: string | null) => (n ? n.replace(/^([A-Z]+-\d+) (.+)$/, (_m, code: string, name: string) => `${code} ${tv(name)}`) : '');
  const moves = [
    ...v.payments.map((p) => {
      const o = orderById.get(p.order_id);
      return { id: p.id, in: true, amount: p.amount, at: p.created_at, label: t('Payment · {code}', { code: o?.code ?? '—' }), sub: o?.customer ?? '', orderId: p.order_id };
    }),
    ...cashBook.map((c) => ({ id: c.id, in: c.direction === 'in', amount: c.amount, at: c.created_at, label: t(CASH_LABEL[c.category] ?? c.category), sub: note(c.note), orderId: null as string | null })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const money = {
    cash: paidIn + bookIn - bookOut,
    received: paidIn + bookIn,
    paidOut: bookOut,
    today: inSince(dayStart.getTime()),
    todayOut: outSince(dayStart.getTime()),
    week: inSince(ws),
    weekOut: outSince(ws),
    moves,
  };

  return {
    i, money, orders, active, bySoonest, byStage, pipeline, dueSoon, owed, owedFmt: fmt(owed), lowFabrics, lowPerfumes, fabrics, perfumes,
    wages: wages.map((w) => ({ ...w, amountFmt: fmt(w.amount), pct: `${(w.amount / wageMax) * 100}%` })), wagesTotal,
    notifs, tailors: tailors.filter((x) => x.active), customerMap: cust, staffMap: staff, fabricMap: fab,
    readyCount: byStage.Ready.length, sewingCount: byStage.Sewing.length, overdueCount: active.filter((o) => o.overdue).length,
  };
}
export type Derived = ReturnType<typeof derive>;

// One shared result per snapshot: every component that asks gets the same object, so the
// work is done once per change instead of once per component.
// Re-done after midnight too, so "Today" / "Tomorrow" stay right on a PC left open overnight.
let lastView: Snapshot | null = null;
let lastDay = '';
let lastDerived: Derived | null = null;
export function derivedFor(view: Snapshot): Derived {
  const day = todayIso();
  if (view !== lastView || day !== lastDay || !lastDerived) { lastView = view; lastDay = day; lastDerived = derive(view); }
  return lastDerived;
}

export function useDerived() {
  return derivedFor(useStore((s) => s.view));
}
