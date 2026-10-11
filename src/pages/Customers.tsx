import { useEffect, useMemo, useState } from 'react';
import { useUI } from '../context';
import { cleanMeas, saveMeasurements } from '../data/actions';
import { useDerived } from '../data/derive';
import { useStore } from '../data/store';
import { fmt, initials } from '../lib/format';
import type { MeasKey } from '../lib/types';
import { cx, Dot, Tx } from '../components/bits';
import { MeasGrid, measToForm, type MeasForm } from '../components/forms';
import { AccBtn } from '../components/Shell';

/** Names drawn in the list at once; the search box finds the rest. */
const LIST_MAX = 200;

export function Customers() {
  const ui = useUI();
  const d = useDerived();
  const { t, tv, stage } = ui.i;
  const customers = useStore((s) => s.view.customers);
  const history = useStore((s) => s.view.measurement_history);
  const [q, setQ] = useState('');

  const sorted = useMemo(() => [...customers].sort((a, b) => tv(a.name).localeCompare(tv(b.name))), [customers, tv]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sorted;
    const sd = s.replace(/\s/g, '');
    return sorted.filter((c) => c.name.toLowerCase().includes(s) || tv(c.name).toLowerCase().includes(s) || c.phone.replace(/\s/g, '').includes(sd) || c.code.toLowerCase().includes(s));
  }, [sorted, q, tv]);
  const cust = customers.find((c) => c.id === ui.customerId) ?? sorted[0];

  const [form, setForm] = useState<MeasForm>(() => measToForm(cust?.meas ?? {}));
  // Reload the form when switching customer or when another counter changed the measurements.
  useEffect(() => { setForm(measToForm(cust?.meas ?? {})); }, [cust?.id, JSON.stringify(cust?.meas)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cust) {
    return (
      <div className="card flex max-w-[520px] flex-col gap-3 p-7">
        <Tx className="h-section">{t('No customers yet')}</Tx>
        <Tx className="text-muted">{t('Take measurements or a new order — the customer is created as you go.')}</Tx>
        <AccBtn onClick={() => ui.open({ kind: 'measure', startNew: true })}>{t('+ New customer')}</AccBtn>
      </div>
    );
  }

  const orders = d.orders.filter((o) => o.customer_id === cust.id);
  const balance = orders.reduce((a, o) => a + o.balance, 0);
  const hist = history.filter((h) => h.customer_id === cust.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const last = orders[0];
  const name = tv(cust.name);

  const save = () => {
    const n = saveMeasurements(cust.id, cleanMeas(form), ui.me.id);
    ui.toast(n ? t(n === 1 ? '1 measurement saved' : '{n} measurements saved', { n }) : t('Nothing changed'));
  };

  return (
    <div className="flex animate-enter flex-wrap items-start gap-5">
      <section className="card flex min-w-[230px] flex-[0_1_260px] flex-col gap-1.5 p-2.5">
        <button className="btn btn-acc h-[38px] rounded-[19px]" onClick={() => ui.open({ kind: 'measure', startNew: true })}><Tx>{t('+ New customer')}</Tx></button>
        <input className="input h-9 rounded-[18px] px-3.5 text-[13px]" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Name or phone…')} aria-label={t('Find customer')} />
        <div className="flex max-h-[520px] flex-col gap-0.5 overflow-y-auto">
          {list.slice(0, LIST_MAX).map((c) => (
            <button key={c.id} className={cx('flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-start transition-colors duration-200', c.id === cust.id ? 'act' : 'hover:bg-sel')}
              aria-current={c.id === cust.id ? 'true' : undefined} onClick={() => ui.setCustomerId(c.id)}>
              <span className="avatar size-8 text-[11px]">{initials(tv(c.name))}</span>
              <span className="flex min-w-0 flex-col">
                <Tx className="truncate font-medium">{tv(c.name)}</Tx>
                <span className="font-mono text-[11px] opacity-70">{c.phone}</span>
              </span>
            </button>
          ))}
          {list.length > LIST_MAX && <Tx className="px-3 py-2 text-xs text-muted">{t('{n} more — type to find them', { n: list.length - LIST_MAX })}</Tx>}
          {list.length === 0 && <Tx className="px-3 py-6 text-[13px] text-muted">{t('No match.')}</Tx>}
        </div>
      </section>

      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Tx className="eyebrow tracking-[1.2px]">{t('{code} · SINCE {year}', { code: cust.code, year: cust.since })}</Tx>
            <h1 className="m-0 font-serif text-[46px] leading-[1.02] font-medium tracking-[-1px] tracking-arabic-safe max-sm:text-[38px]"><Tx>{name}</Tx></h1>
            <span className="text-muted">
              <span dir="ltr" className="font-mono">{cust.phone}</span> · <Tx>{t(orders.length === 1 ? '1 order' : '{n} orders', { n: orders.length })}</Tx> · <Tx>{t('balance')}</Tx> <span className="font-mono whitespace-nowrap text-fg">؋ {fmt(balance)}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-glass" onClick={() => {
              if (!last) { ui.open({ kind: 'order', preset: { customerId: cust.id } }); return; }
              ui.open({ kind: 'order', preset: { customerId: cust.id, garment: last.garment, qty: last.qty, tailorId: last.tailor_id, fabricId: last.fabric_id } });
              ui.toast(t('Copied {code} · check and save', { code: last.code }));
            }}><Tx>{t('↻ Repeat last order')}</Tx></button>
            <AccBtn onClick={() => ui.open({ kind: 'order', preset: { customerId: cust.id } })}>{t('+ New order')}</AccBtn>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-5">
          <section className="card flex flex-col gap-1.5 p-[18px]">
            <MeasGrid layout="list" i={ui.i} value={form} onChange={(k: MeasKey, v) => setForm((f) => ({ ...f, [k]: v }))} />
            <button className="btn btn-acc mt-2.5" onClick={save}><Tx>{t('Save measurements')}</Tx></button>
          </section>
          <div className="flex flex-col gap-5">
            <section className="card flex flex-col gap-3 p-[18px]">
              <Tx className="font-semibold">{t('Measurement history')}</Tx>
              {hist.length === 0 && <Tx className="text-xs text-muted">{t('No measurements saved yet.')}</Tx>}
              {hist.slice(0, 12).map((h) => (
                <div key={h.id} className="flex items-baseline gap-3">
                  <span className="dot" />
                  <span className="w-[78px] flex-none font-mono text-[11px] text-muted">{ui.i.num(h.created_at)}</span>
                  <Tx>{ui.i.hist(h.text)}</Tx>
                </div>
              ))}
            </section>
            <section className="card flex flex-col gap-0.5 p-2.5">
              <Tx className="px-2 pt-2 pb-1.5 font-semibold">{t('Orders')}</Tx>
              {orders.length === 0 && <Tx className="px-2 pb-2 text-xs text-muted">{t('No orders yet.')}</Tx>}
              {orders.map((o) => (
                <button key={o.id} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 text-start transition-colors duration-200 hover:bg-sel" onClick={() => ui.open({ kind: 'detail', orderId: o.id })}>
                  <span className="w-16 flex-none font-mono text-xs font-medium text-acc-ink">{o.code}</span>
                  <Tx className="flex-1 text-muted">{o.garmentQty}</Tx>
                  <span className="flex items-center gap-1.5 text-xs"><Dot color={o.stageColor} size={7} /><Tx>{stage(o.stage)}</Tx></span>
                </button>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
