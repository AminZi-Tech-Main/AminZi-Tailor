import { useEffect, useMemo, useState } from 'react';
import { useUI, type OrderPreset } from '../context';
import { cleanMeas, createCustomer, createOrder, recordPayment, saveMeasurements, setStage } from '../data/actions';
import { useDerived } from '../data/derive';
import { useStore } from '../data/store';
import { DEFAULT_GARMENTS, DUE_OPTIONS, STAGES } from '../lib/constants';
import { addDays, digitsOnly, fmt, phoneOk } from '../lib/format';
import type { MeasKey } from '../lib/types';
import { Avatar, Bar, cx, Empty, Icon, Tx } from '../components/bits';
import { blankMeas, blankPicker, CustomerPicker, MeasGrid, measToForm, stepLabel, type MeasForm, type PickerState } from '../components/forms';

export const sheetBody = 'flex flex-1 flex-col gap-[18px] overflow-x-hidden overflow-y-auto p-[18px]';
export const sheetFoot = 'flex flex-none flex-col gap-2 border-t border-stroke px-[18px] py-3.5';

// ---------------------------------------------------------------------------
// Order detail
// ---------------------------------------------------------------------------

export function OrderDetail({ orderId, initialTab }: { orderId: string; initialTab?: 'Overview' | 'Measurements' }) {
  const ui = useUI();
  const d = useDerived();
  const { t, stage } = ui.i;
  const payments = useStore((s) => s.view.payments);
  const o = d.orders.find((x) => x.id === orderId);
  const cust = o ? d.customerMap.get(o.customer_id) : undefined;
  const [tab, setTab] = useState<'Overview' | 'Measurements'>(initialTab ?? 'Overview');
  const [pay, setPay] = useState('');
  const [meas, setMeas] = useState<MeasForm>(() => measToForm(cust?.meas ?? {}));
  useEffect(() => setMeas(measToForm(cust?.meas ?? {})), [cust?.id, JSON.stringify(cust?.meas)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!o) return <div className={sheetBody}><Empty>{t('This order is no longer here.')}</Empty></div>;
  const si = STAGES.indexOf(o.stage);
  const orderPayments = payments.filter((p) => p.order_id === o.id).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const record = () => {
    const v = recordPayment(o.id, Number(pay) || 0, ui.me.id);
    if (!v) return ui.toast(o.balance <= 0 ? t('Already paid in full') : t('Enter an amount first'), true);
    setPay('');
    ui.toast(t('؋ {amount} recorded for {code}', { amount: fmt(v), code: o.code }));
  };

  return (
    <>
      <div className={cx(sheetBody, 'gap-4')}>
        <div className="flex items-center gap-3.5">
          <Avatar name={o.customer} size={52} acc serif />
          <div className="flex min-w-0 flex-1 flex-col">
            <Tx className="text-[17px] font-semibold">{o.customer}</Tx>
            <span className="text-[13px] text-muted"><Tx>{o.garmentQty}</Tx> · <Tx>{o.tailor}</Tx> · <span className="font-mono">{o.phone}</span></span>
          </div>
          <a className="btn-chip h-[34px] rounded-[17px] text-fg no-underline" href={`tel:${o.phone.replace(/\s/g, '')}`} aria-label={t('Call customer')}><Tx>{t('Call')}</Tx></a>
        </div>
        <div className="flex gap-1 rounded-[18px] border border-stroke bg-field p-1">
          {(['Overview', 'Measurements'] as const).map((x) => (
            <button key={x} aria-pressed={tab === x} onClick={() => setTab(x)}
              className={cx('h-8 flex-1 rounded-[14px] text-[13px] font-medium transition-colors duration-200', tab === x && 'act')}>
              <Tx>{x === 'Overview' ? t('Overview') : t('Measurements')}</Tx>
            </button>
          ))}
        </div>

        {tab === 'Overview' ? (
          <>
            <div className="flex flex-col gap-2">
              <Tx className={stepLabel}>{t('Stage · click to set')}</Tx>
              <div className="grid grid-cols-4 gap-1.5" dir="ltr">
                {STAGES.map((x, n) => (
                  <button key={x} className="flex flex-col gap-1.5 text-start" onClick={() => { if (x !== o.stage) { setStage(o.id, x); ui.toast(`${o.code} → ${stage(x)}`); } }}>
                    <span className={cx('block h-1.5 w-full rounded-[3px] transition-colors duration-400', n <= si ? 'bg-acc' : 'bg-track')} />
                    <Tx className={cx('text-xs', n === si ? 'font-semibold text-fg' : 'text-muted')}>{stage(x)}</Tx>
                  </button>
                ))}
              </div>
              <Tx className={cx('text-[13px]', o.overdue && 'text-danger')}>{t('Due {date}', { date: o.dueLong })}</Tx>
            </div>
            <div className="boxed">
              <div className="flex justify-between"><Tx className="text-muted">{t('Total')}</Tx><span className="font-mono">؋ {fmt(o.total)}</span></div>
              <div className="flex justify-between"><Tx className="text-muted">{t('Paid')}</Tx><span className="font-mono">؋ {fmt(o.paid)}</span></div>
              <Bar pct={o.paidPct} h={5} />
              <div className="flex justify-between font-semibold"><Tx>{t('Balance due')}</Tx><span className="font-mono">؋ {fmt(o.balance)}</span></div>
              {o.balance > 0 && (
                <div className="mt-1 flex gap-1.5">
                  <input className="input h-[38px] min-w-0 flex-1 font-mono" dir="ltr" inputMode="numeric" placeholder={t('Amount ؋')} aria-label={t('Payment amount')} value={pay}
                    onChange={(e) => setPay(digitsOnly(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && record()} />
                  <button className="h-[38px] rounded-[12px] border border-stroke bg-chip px-3 text-xs font-medium whitespace-nowrap" onClick={() => setPay(String(o.balance))}><Tx>{t('Full')}</Tx></button>
                  <button className="h-[38px] rounded-[12px] bg-acc px-3.5 text-xs font-semibold whitespace-nowrap text-on-acc" onClick={record}><Tx>{t('Record')}</Tx></button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <MeasGrid layout="two" i={ui.i} value={meas} onChange={(k: MeasKey, v) => setMeas((m) => ({ ...m, [k]: v }))} />
            <button className="btn btn-acc" onClick={() => {
              const n = saveMeasurements(o.customer_id, cleanMeas(meas), ui.me.id, `From ${o.code}`);
              ui.toast(n ? t('Measurements saved for {name}', { name: o.customer }) : t('Nothing changed'));
            }}><Tx>{t('Save measurements')}</Tx></button>
          </>
        )}
      </div>
      <div className={cx(sheetFoot, 'flex-row flex-wrap')}>
        {si < 3 && (
          <button className="btn btn-acc h-11 flex-[1_1_100%] text-sm" onClick={() => { setStage(o.id, STAGES[si + 1]); ui.toast(t('{code} moved to {stage}', { code: o.code, stage: stage(STAGES[si + 1]) })); }}>
            <Tx>{t('Move to {stage} →', { stage: stage(STAGES[si + 1]) })}</Tx>
          </button>
        )}
        <button className="btn-chip h-[38px] flex-1 rounded-[19px] text-[13px]" onClick={() => ui.print({ kind: 'receipt', order: o, payments: orderPayments, shop: ui.shop, cashier: ui.i.tv(ui.me.name) })}><Tx>{t('Print receipt')}</Tx></button>
        <button className="btn-chip h-[38px] flex-1 rounded-[19px] text-[13px]" onClick={() => ui.print({ kind: 'label', order: o, shop: ui.shop })}><Tx>{t('Print label')}</Tx></button>
        <button className="btn-chip h-[38px] flex-1 rounded-[19px] text-[13px]" onClick={() => ui.go('customers', { customerId: o.customer_id })}><Tx>{t('Customer')}</Tx></button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// New order
// ---------------------------------------------------------------------------

export function OrderForm({ preset }: { preset?: OrderPreset }) {
  const ui = useUI();
  const d = useDerived();
  const { t, tv } = ui.i;
  const customers = useStore((s) => s.view.customers);
  const garments = ui.shop.garments?.length ? ui.shop.garments : DEFAULT_GARMENTS;
  const fabrics = d.fabrics;

  const [who, setWho] = useState<PickerState>(blankPicker(preset?.customerId ?? null));
  const [garment, setGarment] = useState(garments.find((g) => g.name === preset?.garment)?.name ?? garments[0].name);
  const [qty, setQty] = useState(preset?.qty ?? 1);
  const [fabricId, setFabricId] = useState<string | null>(preset?.fabricId !== undefined ? preset.fabricId : fabrics.find((f) => f.metres_left > 0)?.id ?? null);
  const [tailorId, setTailorId] = useState<string | null>(preset?.tailorId ?? d.tailors[0]?.id ?? null);
  const [dueIn, setDueIn] = useState(7);
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [withMeas, setWithMeas] = useState(false);
  const [meas, setMeas] = useState<MeasForm>(() => measToForm(customers.find((c) => c.id === preset?.customerId)?.meas ?? {}));
  const [tried, setTried] = useState(false);

  const g = garments.find((x) => x.name === garment) ?? garments[0];
  const suggested = g.price * qty;
  const priceN = price === '' ? suggested : Number(price) || 0;
  const depositN = Number(deposit) || 0;
  const fab = fabrics.find((f) => f.id === fabricId);
  const metres = Math.round(g.m * qty * 10) / 10;
  const picked = who.customerId ? customers.find((c) => c.id === who.customerId) : null;

  const errors = useMemo(() => {
    const e: string[] = [];
    if (who.mode === 'pick' && !picked) e.push(t('Pick a customer or add a new one'));
    if (who.mode === 'new' && !who.name.trim()) e.push(t('Customer name is required'));
    if (who.mode === 'new' && !phoneOk(who.phone)) e.push(t('Phone: use 07X XXX XXXX or +93 7X XXX XXXX'));
    if (priceN <= 0) e.push(t('Price must be more than 0'));
    if (depositN > priceN) e.push(t('Deposit is more than the price'));
    if (fab && fab.metres_left < metres) e.push(t('Only {n} m of {name} left', { n: fab.metres_left, name: tv(fab.name) }));
    return e;
  }, [who, picked, priceN, depositN, fab, metres, t, tv]);

  const submit = () => {
    if (errors.length) { setTried(true); return; }
    const res = createOrder({
      customerId: picked?.id ?? null,
      newCustomer: who.mode === 'new' ? { name: who.name, phone: who.phone } : undefined,
      meas: withMeas || who.mode === 'new' ? cleanMeas(meas) : {},
      garment: g, qty, fabricId, tailorId, dueInDays: dueIn, price: priceN, deposit: depositN, notes: '',
    }, ui.me.id);
    ui.open({ kind: 'detail', orderId: res.id });
    ui.toast(fab ? t('Order saved · {n} m taken from {name}', { n: res.metres, name: tv(fab.name) }) : t('Order saved'));
  };

  const qtyBtn = 'size-8 rounded-full bg-chip text-base';

  return (
    <>
      <div className={cx(sheetBody, 'gap-5')}>
        <div className="flex flex-col gap-2.5">
          <Tx className={stepLabel}>{t('1 · Customer')}</Tx>
          <CustomerPicker i={ui.i} customers={customers} value={who} note={t('measurements on file')} newLabel={t('+ Walk-in / new customer')}
            onChange={(p) => { setWho((w) => ({ ...w, ...p })); if (p.mode === 'new') setWithMeas(true); }}
            onPicked={(c) => setMeas(measToForm(c?.meas ?? {}))} />
        </div>

        <div className="flex flex-col gap-2.5">
          <Tx className={stepLabel}>{t('2 · Garment & fabric')}</Tx>
          <div className="flex flex-wrap gap-1.5">
            {garments.map((x) => <button key={x.name} aria-pressed={garment === x.name} className="chip" onClick={() => { setGarment(x.name); setPrice(''); }}><Tx>{tv(x.name)}</Tx></button>)}
          </div>
          <div className="flex items-center gap-2.5">
            <Tx className="flex-1 text-[13px] text-muted">{t('Quantity')}</Tx>
            <div className="flex items-center gap-1 rounded-[18px] border border-stroke bg-field p-[3px]" dir="ltr">
              <button aria-label={t('Less')} className={qtyBtn} onClick={() => { setQty(Math.max(1, qty - 1)); setPrice(''); }}>−</button>
              <span className="min-w-7 text-center font-mono text-[15px] font-semibold">{qty}</span>
              <button aria-label={t('More')} className={qtyBtn} onClick={() => { setQty(qty + 1); setPrice(''); }}>+</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {fabrics.map((f) => (
              <button key={f.id} title={tv(f.name)} aria-pressed={fabricId === f.id} className="chip h-auto min-w-0 justify-start gap-2 rounded-[14px] px-2 py-1.5 text-start" onClick={() => setFabricId(f.id)}>
                <span className="size-[22px] flex-none rounded-[7px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.25)]" style={{ background: f.swatch }} />
                <span className="flex min-w-0 flex-col">
                  <Tx className="truncate text-xs font-semibold">{tv(f.name)}</Tx>
                  <Tx className="font-mono text-[10px] opacity-75">{ui.i.m(f.metres_left)}</Tx>
                </span>
              </button>
            ))}
          </div>
          <Tx className="text-xs text-muted">{t('Uses about {m} · {left} in stock', { m: ui.i.m(metres), left: ui.i.m(fab?.metres_left ?? 0) })}</Tx>
        </div>

        <div className="flex flex-col gap-2.5">
          <Tx className={stepLabel}>{t('3 · Tailor & due date')}</Tx>
          <div className="flex flex-wrap gap-1.5">
            {d.tailors.length === 0 && <Tx className="text-xs text-muted">{t('No active tailors — add them under Users.')}</Tx>}
            {d.tailors.map((x) => <button key={x.id} aria-pressed={tailorId === x.id} className="chip" onClick={() => setTailorId(x.id)}><Tx>{tv(x.name)}</Tx></button>)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DUE_OPTIONS.map(([n, l]) => <button key={n} aria-pressed={dueIn === n} className="chip" onClick={() => setDueIn(n)}><Tx>{t(l)}</Tx></button>)}
            <Tx className="font-mono text-xs font-medium text-muted">{ui.i.fwd} {ui.i.short(addDays(dueIn))}</Tx>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Tx className={stepLabel}>{t('4 · Price & deposit')}</Tx>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="field"><Tx>{t('Price ؋ (suggested)')}</Tx><input className="input font-mono text-[15px]" dir="ltr" inputMode="numeric" value={price === '' ? String(suggested) : price} onChange={(e) => setPrice(digitsOnly(e.target.value))} /></label>
            <label className="field"><Tx>{t('Deposit ؋')}</Tx><input className="input font-mono text-[15px]" dir="ltr" inputMode="numeric" placeholder="0" value={deposit} onChange={(e) => setDeposit(digitsOnly(e.target.value))} /></label>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="btn-chip" onClick={() => setDeposit(String(Math.round(priceN / 2)))}><Tx>{t('Half')}</Tx></button>
            <button className="btn-chip" onClick={() => setDeposit(String(priceN))}><Tx>{t('Paid in full')}</Tx></button>
            <span className="ms-auto text-[13px] text-muted"><Tx>{t('Balance')}</Tx> <span className="font-mono text-[15px] font-semibold text-fg">؋ {fmt(Math.max(priceN - depositN, 0))}</span></span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button className="flex h-11 items-center gap-2.5 rounded-[14px] border border-stroke bg-chip px-3.5 text-start text-sm font-medium" onClick={() => setWithMeas(!withMeas)}>
            <Icon name="ruler" size={17} />
            <Tx className="flex-1">{withMeas ? t('Hide measurements') : picked ? t('Update measurements now') : t('Take measurements now')}</Tx>
            <Tx className="text-muted">{t('optional')}</Tx>
          </button>
          {withMeas && <div className="animate-pop"><MeasGrid layout="three" i={ui.i} value={meas} onChange={(k, v) => setMeas((m) => ({ ...m, [k]: v }))} /></div>}
        </div>
      </div>
      <div className={sheetFoot}>
        {tried && errors.length > 0 && <span role="alert" dir="auto" className="alert">{errors[0]}</span>}
        <button className="btn btn-acc h-12 text-[15px]" onClick={submit}><Tx>{t('Save order · ؋ {amount}', { amount: fmt(priceN) })}</Tx></button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Take measurements
// ---------------------------------------------------------------------------

export function MeasureForm({ customerId, startNew }: { customerId?: string | null; startNew?: boolean }) {
  const ui = useUI();
  const { t } = ui.i;
  const customers = useStore((s) => s.view.customers);
  const [who, setWho] = useState<PickerState>({ ...blankPicker(customerId ?? null), mode: startNew ? 'new' : 'pick' });
  const [meas, setMeas] = useState<MeasForm>(() => measToForm(customers.find((c) => c.id === customerId)?.meas ?? {}));
  const [tried, setTried] = useState(false);
  const picked = who.customerId ? customers.find((c) => c.id === who.customerId) : null;
  const filled = Object.keys(cleanMeas(meas)).length;

  const errors: string[] = [];
  if (who.mode === 'pick' && !picked) errors.push(t('Pick a customer or add a new one'));
  if (who.mode === 'new' && !who.name.trim()) errors.push(t('Customer name is required'));
  if (who.mode === 'new' && !phoneOk(who.phone)) errors.push(t('Phone: use 07X XXX XXXX or +93 7X XXX XXXX'));
  if (who.mode === 'new' && phoneOk(who.phone) && customers.some((c) => c.phone.replace(/\s/g, '') === who.phone.replace(/\s/g, ''))) errors.push(t('A customer with this phone already exists — pick them instead'));
  if (filled === 0) errors.push(t('Enter at least one measurement'));

  const save = (thenOrder: boolean) => {
    if (errors.length) { setTried(true); return; }
    let id = picked?.id ?? null;
    if (who.mode === 'new') id = createCustomer(who.name, who.phone, cleanMeas(meas), ui.me.id);
    else if (id) saveMeasurements(id, cleanMeas(meas), ui.me.id);
    if (id) ui.setCustomerId(id);
    ui.toast(thenOrder ? t('Measurements saved · now add the order') : t('Measurements saved on this PC'));
    if (thenOrder && id) ui.open({ kind: 'order', preset: { customerId: id } });
    else ui.close();
  };

  return (
    <>
      <div className={sheetBody}>
        <div className="flex flex-col gap-2.5">
          <Tx className={stepLabel}>{t('1 · Who')}</Tx>
          <CustomerPicker i={ui.i} customers={customers} value={who} note={t('last values filled in')} newLabel={t('+ New customer')}
            onChange={(p) => { setWho((w) => ({ ...w, ...p })); if (p.mode === 'new') setMeas(blankMeas()); }}
            onPicked={(c) => setMeas(measToForm(c?.meas ?? {}))} />
        </div>
        <div className="flex flex-col gap-2.5">
          <MeasGrid layout="two" i={ui.i} steps={['2 · ', '3 · ']} value={meas} onChange={(k, v) => setMeas((m) => ({ ...m, [k]: v }))} />
        </div>
      </div>
      <div className={sheetFoot}>
        {tried && errors.length > 0 && <span role="alert" dir="auto" className="alert">{errors[0]}</span>}
        <div className="flex gap-2">
          <button className="btn h-[46px] flex-1 rounded-[23px] border border-stroke bg-chip text-sm font-semibold" onClick={() => save(false)}><Tx>{t('Save')}</Tx></button>
          <button className="btn btn-acc h-[46px] flex-[1.4] text-sm" onClick={() => save(true)}><Tx>{t('Save & start order →')}</Tx></button>
        </div>
      </div>
    </>
  );
}
