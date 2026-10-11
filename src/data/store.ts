import { useSyncExternalStore } from 'react';
import { get, set, del } from 'idb-keyval';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { FailedOp, ListTable, Op, Shop, Snapshot, WriteTable } from '../lib/types';
import { applyOp, emptySnapshot, normalise, rebase } from './apply';
import { uid } from '../lib/format';
import { DEMO_SHOP_ID, demoSnapshot } from './demo';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  lastSync: number | null;
  lastError: string | null;
  needsSignIn: boolean;
  /** The cash-book SQL (20261011000000_cash_book.sql) has not been run on this Supabase project yet. */
  cashBookMissing: boolean;
}

export interface StoreState {
  shopId: string | null;
  demo: boolean;      // local sample shop: no Supabase traffic at all
  loaded: boolean;
  server: Snapshot;   // last copy confirmed by Supabase
  outbox: Op[];       // local changes not yet pushed
  failed: FailedOp[]; // changes Supabase rejected
  view: Snapshot;     // server + outbox: what the screen shows
  status: SyncStatus;
}

const initial = (): StoreState => ({
  shopId: null,
  demo: false,
  loaded: false,
  server: emptySnapshot(),
  outbox: [],
  failed: [],
  view: emptySnapshot(),
  status: { online: navigator.onLine, syncing: false, lastSync: null, lastError: null, needsSignIn: false, cashBookMissing: false },
});

let state: StoreState = initial();
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

function update(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  if ('server' in patch || 'outbox' in patch) state.view = rebase(state.server, state.outbox);
  emit();
  if ('server' in patch || 'outbox' in patch || 'failed' in patch) schedulePersist();
}
/** Only emit when something actually changed — every emit re-renders whoever watches the status. */
function setStatus(p: Partial<SyncStatus>) {
  const cur = state.status as unknown as Record<string, unknown>;
  if (Object.entries(p).every(([k, v]) => cur[k] === v)) return;
  update({ status: { ...state.status, ...p } });
}

export const getState = () => state;
export function useStore<T>(sel: (s: StoreState) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => sel(state));
}

// ---------------------------------------------------------------------------
// Local persistence (IndexedDB) — the counter keeps working with no internet
// ---------------------------------------------------------------------------

const cacheKey = (shopId: string) => `aminzi:shop:${shopId}`;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 250);
}
async function persistNow() {
  if (!state.shopId) return;
  try {
    await set(cacheKey(state.shopId), { server: state.server, outbox: state.outbox, failed: state.failed, lastSync: state.status.lastSync });
  } catch (e) {
    console.error('Could not save local copy', e);
  }
}
window.addEventListener('beforeunload', () => { clearTimeout(persistTimer); void persistNow(); });

// ---------------------------------------------------------------------------
// Opening / closing a shop
// ---------------------------------------------------------------------------

let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let openGen = 0; // guards against overlapping open/close (e.g. React StrictMode double-mount)

export async function openShop(shopId: string) {
  closeShop();
  const gen = openGen;
  const cached = (await get(cacheKey(shopId))) as
    | { server: Snapshot; outbox: Op[]; failed: FailedOp[]; lastSync: number | null }
    | undefined;
  if (gen !== openGen) return; // closed or reopened while reading the cache
  state = initial();
  update({
    shopId,
    loaded: !!cached?.server?.shop,
    server: cached?.server ?? emptySnapshot(),
    outbox: cached?.outbox ?? [],
    failed: cached?.failed ?? [],
    status: { ...state.status, lastSync: cached?.lastSync ?? null },
  });

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  timer = setInterval(() => void syncNow(), 30_000);
  subscribeRealtime(shopId);
  await syncNow();
  if (!state.loaded && state.server.shop) update({ loaded: true });
}

/** Open the sample shop (mock data from the design handoff). Runs only in this browser. */
export async function openDemo(fresh: boolean) {
  closeShop();
  const gen = openGen;
  const cached = fresh ? undefined : ((await get(cacheKey(DEMO_SHOP_ID))) as { server: Snapshot } | undefined);
  if (gen !== openGen) return;
  state = initial();
  update({
    shopId: DEMO_SHOP_ID, demo: true, loaded: true,
    server: cached?.server?.shop ? cached.server : demoSnapshot(), outbox: [], failed: [],
    status: { ...state.status, online: true, lastSync: Date.now() },
  });
}

export function closeShop() {
  openGen += 1;
  lastPullRaw = '';
  if (state.shopId) { clearTimeout(persistTimer); void persistNow(); }
  clearInterval(timer);
  clearTimeout(pullTimer);
  clearTimeout(pushSoon);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisible);
  if (channel) { void supabase.removeChannel(channel); channel = null; }
  state = initial();
  emit();
}

export async function forgetShopCache(shopId: string) { await del(cacheKey(shopId)); }

function onOnline() { setStatus({ online: true }); void syncNow(); }
function onOffline() { setStatus({ online: false }); }
function onVisible() { if (document.visibilityState === 'visible') void syncNow(); }

function subscribeRealtime(shopId: string) {
  const tables: string[] = ['staff', 'customers', 'measurement_history', 'fabrics', 'perfumes', 'orders', 'payments', 'cash_entries'];
  let ch = supabase.channel(`shop-${shopId}-${uid().slice(0, 8)}`);
  for (const t of tables) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `shop_id=eq.${shopId}` }, () => schedulePull());
  }
  ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'shops', filter: `id=eq.${shopId}` }, () => schedulePull());
  channel = ch.subscribe();
}
let pullTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePull() { clearTimeout(pullTimer); pullTimer = setTimeout(() => void syncNow(), 700); }

// ---------------------------------------------------------------------------
// Queueing changes
// ---------------------------------------------------------------------------

type NewOp =
  | { kind: 'insert'; table: WriteTable; row: Record<string, unknown> }
  | { kind: 'update'; table: ListTable; rowId: string; patch: Record<string, unknown> }
  | { kind: 'shop'; patch: Partial<Shop> };

/** Queue several changes as one step. They show on screen at once and sync in order. */
export function enqueue(...ops: NewOp[]) {
  const stamped = ops.map((o) => ({ ...o, id: uid(), ts: Date.now() }) as Op);
  if (state.demo) { update({ server: stamped.reduce(applyOp, state.server) }); return; }
  update({ outbox: [...state.outbox, ...stamped] });
  clearTimeout(pushSoon);
  pushSoon = setTimeout(() => void syncNow(), 150);
}
let pushSoon: ReturnType<typeof setTimeout> | undefined;

export function retryFailed() {
  update({ outbox: [...state.outbox, ...state.failed.map((f) => f.op)], failed: [] });
  void syncNow();
}
export function dismissFailed() { update({ failed: [] }); }

// ---------------------------------------------------------------------------
// Sync: push the outbox, then pull a fresh copy
// ---------------------------------------------------------------------------

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const shopId = state.shopId;
  if (!shopId || state.demo) return;
  if (!navigator.onLine) { setStatus({ online: false }); return; }
  setStatus({ syncing: true });
  try {
    const pushed = await pushAll();
    if (pushed === 'offline') { setStatus({ online: false, syncing: false }); return; }
    await pull(shopId);
    setStatus({ online: true, syncing: false, lastSync: Date.now(), lastError: null, needsSignIn: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const offline = isNetworkError(msg);
    setStatus({ syncing: false, online: !offline, lastError: offline ? null : msg });
  }
}

const isNetworkError = (msg: string, status?: number) =>
  status === 0 || /failed to fetch|networkerror|network request failed|fetch failed|load failed|timeout/i.test(msg);

type PgErr = { message: string; code?: string; details?: string | null; hint?: string | null };

async function runOp(op: Op): Promise<{ error: PgErr | null; status: number }> {
  if (op.kind === 'shop') {
    const { error, status } = await supabase.from('shops').update(op.patch).eq('id', state.shopId!);
    return { error, status };
  }
  if (op.kind === 'update') {
    const { error, status } = await supabase.from(op.table).update(op.patch).eq('id', op.rowId);
    return { error, status };
  }
  const { error, status } = await supabase.from(op.table).upsert(op.row, { onConflict: 'id', ignoreDuplicates: true });
  return { error, status };
}

async function pushAll(): Promise<'ok' | 'offline'> {
  let renumberTries = 0;
  let refreshed = false;
  const shopId = state.shopId;
  while (state.outbox.length) {
    const op = state.outbox[0];
    const { error, status } = await runOp(op);
    if (state.shopId !== shopId || state.outbox[0]?.id !== op.id) return 'offline'; // shop closed meanwhile
    if (!error) {
      // Confirmed: fold the change into the server copy and drop it from the outbox.
      update({ server: applyOp(state.server, op), outbox: state.outbox.slice(1) });
      renumberTries = 0;
      continue;
    }
    if (isNetworkError(error.message, status) || status >= 500) return 'offline';
    if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') {
      if (refreshed) { setStatus({ needsSignIn: true }); return 'offline'; }
      refreshed = true;
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) { setStatus({ needsSignIn: true }); return 'offline'; }
      continue;
    }
    // Two counters made the same order/customer number while offline: take the next free one.
    if (error.code === '23505' && op.kind === 'insert' && /code/.test(`${error.message} ${error.details ?? ''}`) && renumberTries < 5) {
      renumberTries += 1;
      const code = await nextServerCode(op.table as CodedTable, String(op.row.code));
      const fixed: Op = { ...op, row: { ...op.row, code } };
      update({ outbox: [fixed, ...state.outbox.slice(1)] });
      continue;
    }
    // Anything else is a real rejection (bad data, permissions). Park it so the queue keeps moving.
    update({ outbox: state.outbox.slice(1), failed: [...state.failed, { op, error: error.message }] });
  }
  return 'ok';
}

type CodedTable = 'orders' | 'customers' | 'fabrics' | 'perfumes';
async function nextServerCode(table: CodedTable, current: string) {
  const { data } = await supabase.from(table).select('code').eq('shop_id', state.shopId!);
  const codes = [...(data ?? []).map((r: { code: string }) => r.code), ...state.view[table].map((r) => r.code)];
  return nextCode(table, codes, current.replace(/-\d+$/, ''));
}

/** Next free code for a table, e.g. AZ-1043, C-0144, FB-207, PF-06. */
export function nextCode(table: CodedTable, codes: string[], prefix?: string) {
  const nums = codes.map((c) => Number((c.match(/(\d+)$/) || [])[1] || 0));
  const max = Math.max(0, ...nums);
  switch (table) {
    case 'orders': return `${prefix || 'AZ'}-${Math.max(max + 1, 1001)}`;
    case 'customers': return `C-${String(max + 1).padStart(4, '0')}`;
    case 'fabrics': return `FB-${Math.max(max + 1, 201)}`;
    case 'perfumes': return `PF-${String(max + 1).padStart(2, '0')}`;
  }
}

async function fetchAll(table: string, shopId: string) {
  const page = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += page) {
    const { data, error, status } = await supabase
      .from(table).select('*').eq('shop_id', shopId)
      .order('created_at', { ascending: false }).order('id').range(from, from + page - 1);
    if (error) throw Object.assign(new Error(error.message), { status });
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return rows;
}

let lastPullRaw = '';
async function pull(shopId: string) {
  const [shopRes, staff, customers, history, fabrics, perfumes, orders, payments, cash] = await Promise.all([
    supabase.from('shops').select('*').eq('id', shopId).maybeSingle(),
    fetchAll('staff', shopId),
    fetchAll('customers', shopId),
    fetchAll('measurement_history', shopId),
    fetchAll('fabrics', shopId),
    fetchAll('perfumes', shopId),
    fetchAll('orders', shopId),
    fetchAll('payments', shopId),
    // Older databases don't have the cash book yet: keep syncing everything else.
    fetchAll('cash_entries', shopId).then((rows) => ({ rows, missing: false }), (e: Error & { status?: number }) => {
      if (isNetworkError(e.message, e.status)) throw e;
      if (e.status === 404 || /cash_entries|schema cache|does not exist/i.test(e.message)) return { rows: [] as unknown[], missing: true };
      throw e;
    }),
  ]);
  if (state.shopId !== shopId) return; // shop closed while downloading
  if (shopRes.error) throw new Error(shopRes.error.message);
  setStatus({ cashBookMissing: cash.missing });
  const raw = JSON.stringify([shopRes.data, staff, customers, history, fabrics, perfumes, orders, payments, cash.rows]);
  // The 30-second pull usually brings back exactly what we already have: keep the same objects so
  // nothing on screen re-renders.
  if (raw === lastPullRaw && state.loaded && state.server.shop) return;
  lastPullRaw = raw;
  if (!shopRes.data) throw new Error('This shop is not available to the signed-in account.');
  const server = normalise({
    shop: shopRes.data as Shop,
    staff: (staff as Snapshot['staff']).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.name.localeCompare(b.name)),
    customers: customers as Snapshot['customers'],
    measurement_history: history as Snapshot['measurement_history'],
    fabrics: (fabrics as Snapshot['fabrics']).sort((a, b) => a.code.localeCompare(b.code)),
    perfumes: (perfumes as Snapshot['perfumes']).sort((a, b) => a.code.localeCompare(b.code)),
    orders: orders as Snapshot['orders'],
    payments: payments as Snapshot['payments'],
    cash_entries: cash.rows as Snapshot['cash_entries'],
  });
  update({ server, loaded: true });
}
