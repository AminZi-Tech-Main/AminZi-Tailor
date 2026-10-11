import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '../context';
import { addFabric, addPerfume, addStaff, updateStaff } from '../data/actions';
import { useDerived } from '../data/derive';
import { dismissFailed, retryFailed, syncNow, useStore } from '../data/store';
import { PERFUME_SIZES, SWATCHES } from '../lib/constants';
import { decimalOnly, digitsOnly, initials, phoneOk } from '../lib/format';
import type { T } from '../lib/i18n';
import { tk } from '../lib/tk';
import type { Op, Role } from '../lib/types';
import { cx, Empty, Icon, Tx } from '../components/bits';
import { stepLabel } from '../components/forms';
import { sheetBody, sheetFoot } from './OrderSheets';

const big = 'input h-[42px] text-[15px]';

function Foot({ error, children }: { error?: string | false; children: React.ReactNode }) {
  return (
    <div className={sheetFoot}>
      {error && <span role="alert" dir="auto" className="alert">{error}</span>}
      {children}
    </div>
  );
}

const saveBtn = 'btn btn-acc h-[46px] text-sm';

export function RollForm() {
  const ui = useUI();
  const { t, tv } = ui.i;
  const [f, setF] = useState({ name: '', color: 'White', metres: '', price: '', tried: false });
  const errs: string[] = [];
  if (!f.name.trim()) errs.push(t('Fabric name is required'));
  if (!(Number(f.metres) > 0)) errs.push(t('Metres must be more than 0'));
  if (!(Number(f.price) > 0)) errs.push(t('Price per metre is required'));
  const save = () => {
    if (errs.length) return setF({ ...f, tried: true });
    const sw = SWATCHES.find((x) => x[0] === f.color)!;
    addFabric({ name: f.name, color: f.color, swatch: sw[1], metres: Number(f.metres), price: Number(f.price) });
    ui.close(); ui.toast(t('{name} added to stock', { name: f.name.trim() }));
  };
  return (
    <>
      <div className={cx(sheetBody, 'gap-3.5')}>
        <label className="field"><Tx>{t('Fabric name')}</Tx><input className={big} dir="auto" placeholder={t('e.g. Kandahari cotton')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
        <div className="flex flex-col gap-2">
          <Tx className="text-xs text-muted">{t('Colour · {colour}', { colour: tv(f.color) })}</Tx>
          <div className="flex flex-wrap gap-2.5">
            {SWATCHES.map(([nm, hex]) => (
              <button key={nm} title={tv(nm)} aria-label={tv(nm)} aria-pressed={f.color === nm} onClick={() => setF({ ...f, color: nm })}
                className="size-[34px] rounded-[10px] transition-[box-shadow,transform] duration-200 active:scale-[.92]"
                style={{ background: hex, boxShadow: `inset 0 0 0 1px rgba(255,255,255,.25), 0 0 0 2px var(--bg), 0 0 0 ${f.color === nm ? 4 : 0}px var(--acc)` }} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field"><Tx>{t('Metres on the roll')}</Tx><input className={cx(big, 'font-mono')} dir="ltr" inputMode="decimal" placeholder="50" value={f.metres} onChange={(e) => setF({ ...f, metres: decimalOnly(e.target.value) })} /></label>
          <label className="field"><Tx>{t('Price per metre ؋')}</Tx><input className={cx(big, 'font-mono')} dir="ltr" inputMode="numeric" placeholder="350" value={f.price} onChange={(e) => setF({ ...f, price: digitsOnly(e.target.value) })} /></label>
        </div>
      </div>
      <Foot error={f.tried && errs[0]}><button className={saveBtn} onClick={save}><Tx>{t('Add to stock')}</Tx></button></Foot>
    </>
  );
}

export function PerfumeForm() {
  const ui = useUI();
  const { t } = ui.i;
  const [f, setF] = useState({ name: '', size: '50 ml', price: '', stock: '', tried: false });
  const errs: string[] = [];
  if (!f.name.trim()) errs.push(t('Name is required'));
  if (!(Number(f.price) > 0)) errs.push(t('Price is required'));
  if (f.stock === '') errs.push(t('Stock count is required'));
  const save = () => {
    if (errs.length) return setF({ ...f, tried: true });
    addPerfume({ name: f.name, size: f.size, price: Number(f.price), stock: Number(f.stock), tint: '#a98bd6' });
    ui.close(); ui.toast(t('{name} added', { name: f.name.trim() }));
  };
  return (
    <>
      <div className={cx(sheetBody, 'gap-3.5')}>
        <label className="field"><Tx>{t('Name')}</Tx><input className={big} dir="auto" placeholder={t('e.g. Oud Al Noor')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
        <div className="flex flex-col gap-2">
          <Tx className="text-xs text-muted">{t('Bottle size')}</Tx>
          <div className="flex flex-wrap gap-1.5">{PERFUME_SIZES.map((s) => <button key={s} aria-pressed={f.size === s} className="chip h-[34px]" onClick={() => setF({ ...f, size: s })}><Tx>{ui.i.size(s)}</Tx></button>)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field"><Tx>{t('Price ؋')}</Tx><input className={cx(big, 'font-mono')} dir="ltr" inputMode="numeric" placeholder="1500" value={f.price} onChange={(e) => setF({ ...f, price: digitsOnly(e.target.value) })} /></label>
          <label className="field"><Tx>{t('Bottles in stock')}</Tx><input className={cx(big, 'font-mono')} dir="ltr" inputMode="numeric" placeholder="10" value={f.stock} onChange={(e) => setF({ ...f, stock: digitsOnly(e.target.value) })} /></label>
        </div>
      </div>
      <Foot error={f.tried && errs[0]}><button className={saveBtn} onClick={save}><Tx>{t('Add perfume')}</Tx></button></Foot>
    </>
  );
}

/** Add a user (mockup form) — or, opened from a row in Users, edit one: role, phone, tailor wage rate, PIN reset. */
export function UserForm({ staffId }: { staffId?: string }) {
  const ui = useUI();
  const { t, tv } = ui.i;
  const staff = useStore((s) => s.view.staff);
  const editing = staffId ? staff.find((x) => x.id === staffId) ?? null : null;
  const linked = !!editing?.user_id; // a Supabase Auth user: always Admin
  const [f, setF] = useState({
    name: editing?.name ?? '', role: (editing?.role ?? 'Tailor') as Role, phone: editing?.phone ?? '',
    rate: editing ? String(editing.piece_rate || '') : '', tried: false,
  });
  const errs: string[] = [];
  if (!f.name.trim()) errs.push(t('Name is required'));
  if (!phoneOk(f.phone)) errs.push(t('Phone: use 07X XXX XXXX or +93 7X XXX XXXX'));
  const save = () => {
    if (errs.length) return setF({ ...f, tried: true });
    if (editing) {
      updateStaff(editing.id, { name: f.name.trim(), phone: f.phone.trim(), ...(linked ? {} : { role: f.role }), piece_rate: f.role === 'Tailor' ? Number(f.rate) || 0 : 0 });
      ui.close(); ui.toast(t('{name} saved', { name: tv(f.name.trim()) }));
      return;
    }
    addStaff({ name: f.name, phone: f.phone, role: f.role, pieceRate: 0 });
    ui.close(); ui.toast(t('{name} can now sign in', { name: f.name.trim() }));
  };
  return (
    <>
      <div className={cx(sheetBody, 'gap-3.5')}>
        <label className="field"><Tx>{t('Name')}</Tx><input className={big} dir="auto" placeholder={t('Full name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
        <label className="field"><Tx>{t('Phone')}</Tx><input className={cx(big, 'font-mono')} dir="ltr" inputMode="tel" placeholder="07X XXX XXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <div className="flex flex-col gap-2">
          <Tx className="text-xs text-muted">{t('Role')}</Tx>
          <div className="flex flex-wrap gap-1.5">{(['Admin', 'Front desk', 'Tailor'] as Role[]).map((r) => (
            <button key={r} aria-pressed={f.role === r} disabled={linked && r !== 'Admin'} className="chip h-[34px]" onClick={() => setF({ ...f, role: r })}><Tx>{ui.i.role(r)}</Tx></button>
          ))}</div>
          {linked && <Tx className="text-xs text-muted">{t('Signs in with a Supabase account, so this person is always an Admin.')}</Tx>}
        </div>
        {editing && f.role === 'Tailor' && (
          <label className="field"><Tx>{t('Wage per finished piece ؋')}</Tx><input className={cx(big, 'font-mono')} dir="ltr" inputMode="numeric" placeholder="500" value={f.rate} onChange={(e) => setF({ ...f, rate: digitsOnly(e.target.value) })} /></label>
        )}
        {editing ? (
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-stroke bg-chip p-3">
            <Tx className="text-[13px]">{editing.pin_hash ? t('PIN is set') : t('No PIN yet — set at next sign-in')}</Tx>
            {editing.pin_hash && editing.id !== ui.me.id && (
              <button className="btn-chip" onClick={() => { updateStaff(editing.id, { pin_hash: null, pin_salt: null }); ui.toast(t('{name} will set a new PIN at next sign-in', { name: tv(editing.name) })); }}><Tx>{t('Reset PIN')}</Tx></button>
            )}
          </div>
        ) : (
          <Tx className="text-xs text-muted">{t('They set their own 4-digit PIN the first time they sign in.')}</Tx>
        )}
      </div>
      <Foot error={f.tried && errs[0]}><button className={saveBtn} onClick={save}><Tx>{editing ? t('Save') : t('Add user')}</Tx></button></Foot>
    </>
  );
}

export function Notifications() {
  const ui = useUI();
  const d = useDerived();
  return (
    <div className={cx(sheetBody, 'gap-1 p-2.5')}>
      {d.notifs.length === 0 && <Empty>{ui.i.t('All clear. Nothing needs you right now.')}</Empty>}
      {d.notifs.map((n) => (
        <button key={n.key} className="list-btn gap-3 rounded-2xl p-3"
          onClick={() => (n.target.kind === 'order' ? ui.open({ kind: 'detail', orderId: n.target.id }) : ui.go(n.target.screen))}>
          <span className="dot size-2.5" style={{ background: n.tone }} />
          <span className="flex flex-1 flex-col"><Tx className="font-medium">{n.text}</Tx><Tx className="font-mono text-xs text-muted">{n.sub}</Tx></span>
          <span className="text-muted">›</span>
        </button>
      ))}
    </div>
  );
}

export function AccountSwitch() {
  const ui = useUI();
  const { t, tv } = ui.i;
  const staff = useStore((s) => s.view.staff);
  return (
    <>
      <div className={cx(sheetBody, 'gap-1 p-2.5')}>
        {staff.filter((u) => u.active).map((u) => (
          <button key={u.id} className={cx('list-btn gap-3 rounded-2xl px-3 py-2.5', u.id === ui.me.id && 'act')} onClick={() => ui.switchTo(u.id)}>
            <span className="avatar size-[38px] text-xs">{initials(tv(u.name))}</span>
            <span className="flex flex-1 flex-col">
              <Tx className="font-semibold">{tv(u.name)}</Tx>
              <Tx className="text-xs opacity-75">{ui.i.role(u.role)}{u.id === ui.me.id ? ` · ${t('signed in')}` : ''}</Tx>
            </span>
          </button>
        ))}
      </div>
      <Foot><button className="btn h-11 w-full rounded-[22px] border border-stroke bg-chip text-sm font-semibold" onClick={ui.signOutCounter}><Tx>{t('Log out')}</Tx></button></Foot>
    </>
  );
}

const TABLE_NAME: Record<string, string> = {
  staff: tk('staff'), customers: tk('customer'), measurement_history: tk('measurement'), fabrics: tk('fabric roll'), perfumes: tk('perfume'),
  orders: tk('order'), payments: tk('payment'), fabric_movements: tk('fabric stock change'), perfume_movements: tk('perfume stock change'),
};
const describeOp = (op: Op, i: T) => {
  const { t } = i;
  if (op.kind === 'shop') return t('Settings changed');
  const what = t(TABLE_NAME[op.table] ?? op.table);
  if (op.kind === 'update') return t('Changed {what}', { what });
  const r = op.row as Record<string, unknown>;
  const ref = r.code ? String(r.code) : r.name ? i.tv(String(r.name)) : r.amount ? `؋ ${r.amount}` : '';
  return t('New {what} {ref}', { what, ref }).trim();
};

export function SyncPanel() {
  const ui = useUI();
  const { t } = ui.i;
  const status = useStore((s) => s.status);
  const outbox = useStore((s) => s.outbox);
  const failed = useStore((s) => s.failed);
  return (
    <>
      <div className={cx(sheetBody, 'gap-3.5')}>
        <div className="boxed">
          <div className="flex justify-between"><Tx className="text-muted">{t('Connection')}</Tx><Tx>{status.online ? t('Online') : t('Offline')}</Tx></div>
          <div className="flex justify-between"><Tx className="text-muted">{t('Last synced')}</Tx><span className="font-mono">{status.lastSync ? ui.i.timeHM(new Date(status.lastSync)) : '—'}</span></div>
          <div className="flex justify-between"><Tx className="text-muted">{t('Waiting to send')}</Tx><span className="font-mono">{outbox.length}</span></div>
          {status.lastError && <span className="alert" dir="auto">{status.lastError}</span>}
          {status.needsSignIn && <span className="alert" dir="auto">{t('The shop sign-in expired. Sign this PC in again from Settings to keep syncing. Nothing is lost.')}</span>}
        </div>
        {outbox.length > 0 && (
          <div className="flex flex-col gap-1">
            <Tx className={stepLabel}>{t('Saved on this PC, not yet sent')}</Tx>
            {outbox.slice(0, 30).map((op) => <Tx key={op.id} className="text-xs">{describeOp(op, ui.i)}</Tx>)}
          </div>
        )}
        {failed.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Tx className={cx(stepLabel, 'text-danger')}>{t('Rejected by the server')}</Tx>
            {failed.map((f) => (
              <div key={f.op.id} className="boxed gap-0.5">
                <Tx className="font-medium">{describeOp(f.op, ui.i)}</Tx>
                <span className="text-xs text-danger" dir="auto">{f.error}</span>
              </div>
            ))}
            <div className="flex gap-2.5">
              <button className="btn-chip" onClick={retryFailed}><Tx>{t('Try again')}</Tx></button>
              <button className="btn-chip" onClick={dismissFailed}><Tx>{t('Discard these changes')}</Tx></button>
            </div>
          </div>
        )}
      </div>
      <Foot><button className="btn btn-acc" onClick={() => void syncNow()}><Tx>{t('Sync now')}</Tx></button></Foot>
    </>
  );
}

export function SearchPop() {
  const ui = useUI();
  const { t, tv } = ui.i;
  const d = useDerived();
  const customers = useStore((s) => s.view.customers);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const sd = s.replace(/\s/g, '');
    const has = (...xs: string[]) => xs.some((x) => x.toLowerCase().includes(s));
    return [
      ...d.orders.filter((o) => o.hay.includes(s) || (sd && o.hay.includes(sd))).slice(0, 5)
        .map((o) => ({ kind: t('Order'), label: `${o.code} · ${o.customer}`, sub: `${o.garmentQty} · ${ui.i.stage(o.stage)}`, go: () => ui.open({ kind: 'detail', orderId: o.id }) })),
      ...customers.filter((c) => has(c.name, tv(c.name), c.code) || c.phone.replace(/\s/g, '').includes(sd)).slice(0, 5)
        .map((c) => ({ kind: t('Customer'), label: tv(c.name), sub: `${c.code} · ${c.phone}`, go: () => ui.go('customers', { customerId: c.id }) })),
      ...d.fabrics.filter((f) => has(f.name, tv(f.name), f.code, f.color, tv(f.color))).slice(0, 3)
        .map((f) => ({ kind: t('Fabric'), label: tv(f.name), sub: `${f.code} · ${t('{n} m left', { n: f.metres_left })}`, go: () => ui.go('fabrics') })),
      ...d.perfumes.filter((p) => has(p.name, tv(p.name), p.code)).slice(0, 3)
        .map((p) => ({ kind: t('Perfume'), label: tv(p.name), sub: `${ui.i.size(p.size)} · ${t('{n} in stock', { n: p.stock })}`, go: () => ui.go('perfumes') })),
    ];
  }, [q, d, customers, ui, t, tv]);
  return (
    <>
      <div className="fixed inset-0 z-60 animate-fade bg-scrim" onClick={ui.close} />
      <div role="dialog" aria-modal="true" aria-label={t('Search')}
        className="sheet fixed top-[12vh] left-1/2 z-61 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[26px] border border-stroke bg-glass-strong">
        <div className="flex animate-pop items-center gap-3 border-b border-stroke px-[18px]">
          <Icon name="search" className="text-muted" />
          <input ref={ref} dir="auto" value={q} placeholder={t('Search orders, customers, fabric, perfume…')} aria-label={t('Search')}
            className="h-[60px] flex-1 bg-transparent text-[17px] font-medium outline-none"
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(x + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
              if (e.key === 'Enter' && results[sel]) results[sel].go();
            }} />
          <span className="font-mono text-[11px] font-medium text-muted">ESC</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!q.trim() && <Empty>{t('Try a name, an order number like “{code}”, a phone like “070” or “wool”.', { code: d.orders[0]?.code ?? 'AZ-1001' })}</Empty>}
          {q.trim() && results.length === 0 && <Empty>{t('Nothing found for “{q}”.', { q })}</Empty>}
          {results.map((r, n) => (
            <button key={`${r.kind}-${r.label}-${n}`} className={cx('list-btn gap-3 rounded-[14px] px-3 py-2.5', n === sel && 'bg-sel')} onClick={r.go} onMouseEnter={() => setSel(n)}>
              <Tx className="w-[70px] flex-none font-mono text-[10px] font-medium tracking-[1px] text-acc-ink uppercase tracking-arabic-safe">{r.kind}</Tx>
              <span className="flex min-w-0 flex-1 flex-col"><Tx className="font-medium">{r.label}</Tx><Tx className="text-xs text-muted">{r.sub}</Tx></span>
              <span className="text-muted">↵</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
