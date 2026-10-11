import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { fmt } from '../lib/format';
import { makeT, type T } from '../lib/i18n';
import type { Payment, Shop } from '../lib/types';
import type { OrderView } from '../data/derive';

export type PrintJob =
  | { kind: 'receipt'; order: OrderView; payments: Payment[]; shop: Shop; cashier: string }
  | { kind: 'label'; order: OrderView; shop: Shop }
  | { kind: 'test-receipt'; shop: Shop }
  | { kind: 'test-label'; shop: Shop };

let root: Root | null = null;

function host() {
  let el = document.getElementById('print-root');
  if (!el) { el = document.createElement('div'); el.id = 'print-root'; document.body.appendChild(el); }
  if (!root) root = createRoot(el);
  return el;
}

/**
 * Prints through the browser's print dialog. Pick the receipt printer (80 mm) or the
 * label printer (Zebra, 50×30 mm) there; tick "Remember" / set it as default so the
 * counter only has to press Enter.
 */
export function printJob(job: PrintJob, ui?: T) {
  // Always print in the shop's own language and calendar.
  const i = ui && ui.lang === job.shop.lang && ui.cal === job.shop.calendar ? ui : makeT(job.shop.lang, job.shop.calendar);
  host();
  const isLabel = job.kind === 'label' || job.kind === 'test-label';
  let style = document.getElementById('print-page-style') as HTMLStyleElement | null;
  if (!style) { style = document.createElement('style'); style.id = 'print-page-style'; document.head.appendChild(style); }
  style.textContent = isLabel ? '@page { size: 50mm 30mm; margin: 0; }' : '@page { size: 80mm auto; margin: 0; }';
  flushSync(() => root!.render(<PrintDoc job={job} i={i} />));
  const done = () => { window.removeEventListener('afterprint', done); flushSync(() => root!.render(null)); };
  window.addEventListener('afterprint', done);
  window.print();
}

// Print layouts use fixed black-on-white, sized for 80 mm thermal paper and 50×30 mm labels.
const R = 'flex justify-between gap-2';
const HR = () => <hr className="my-1.5 border-0 border-t border-dashed border-black" />;
const receipt = 'w-[72mm] px-[4mm] py-[2mm] font-sans text-[11px] leading-[1.35] text-black';
const label = 'flex h-[30mm] w-[50mm] flex-col justify-between overflow-hidden px-[3mm] py-[2mm] font-sans text-[10px] text-black';

const D = ({ children, className }: { children: React.ReactNode; className?: string }) => <span dir="auto" className={className}>{children}</span>;

function PrintDoc({ job, i }: { job: PrintJob; i: T }) {
  const { t, tv } = i;
  const head = (
    <>
      <h1 dir="auto" className="m-0 mb-0.5 text-center text-[15px] font-bold">{tv(job.shop.name)}</h1>
      {job.shop.phone && <div className="text-center">{job.shop.phone}</div>}
      <HR />
    </>
  );
  if (job.kind === 'test-receipt') {
    return (
      <div className={receipt}>
        {head}
        <div className="text-center font-bold"><D>{t('TEST PRINT')}</D></div>
        <div className="text-center"><D>{i.long(new Date())}</D> · {i.timeHM(new Date())}</div><HR />
        <div className="text-center"><D>{t('Receipt printer: {name}', { name: job.shop.receipt_printer })}</D></div>
      </div>
    );
  }
  if (job.kind === 'test-label') {
    return (
      <div className={label}>
        <b><D>{tv(job.shop.name)}</D></b>
        <div className="font-mono text-lg font-bold"><D>{t('TEST')}</D></div>
        <D>{i.long(new Date())}</D>
      </div>
    );
  }
  const o = job.order;
  if (job.kind === 'label') {
    return (
      <div className={label}>
        <div className="flex justify-between gap-1"><b><D>{tv(job.shop.name)}</D></b><D>{o.tailor}</D></div>
        <div className="font-mono text-lg font-bold">{o.code}</div>
        <div><b><D>{o.customer}</D></b> · <D>{o.garmentQty}</D></div>
        <D>{t('Due {date}', { date: i.long(o.due) })}</D>
      </div>
    );
  }
  const row = (k: string, v: React.ReactNode, cls = '') => <div className={`${R} ${cls}`}><D>{k}</D><span>{v}</span></div>;
  return (
    <div className={receipt}>
      {head}
      {row(t('Order'), <span className="font-mono font-bold">{o.code}</span>)}
      {row(t('Date'), <D>{i.num(o.created_at || new Date())}</D>)}
      {row(t('Customer'), <D>{o.customer}</D>)}
      {row(t('Phone'), <span className="font-mono">{o.phone}</span>)}
      <HR />
      {row(o.garmentQty, <span className="font-mono">؋ {fmt(o.total)}</span>)}
      {row(t('Fabric'), <D>{o.fabricName}</D>)}
      {row(t('Tailor'), <D>{o.tailor}</D>)}
      {row(t('Due'), <D className="font-bold">{i.long(o.due)}</D>)}
      <HR />
      {job.payments.map((p) => <div className={R} key={p.id}><D>{t('Paid {date}', { date: i.num(p.created_at) })}</D><span className="font-mono">؋ {fmt(p.amount)}</span></div>)}
      {row(t('Total'), <span className="font-mono">؋ {fmt(o.total)}</span>, 'font-bold')}
      {row(t('Paid'), <span className="font-mono">؋ {fmt(o.paid)}</span>)}
      {row(t('Balance'), <span className="font-mono">؋ {fmt(o.balance)}</span>, 'font-bold')}
      <HR />
      <div className="text-center"><D>{t('Served by {name}', { name: job.cashier })}</D></div>
      <div className="text-center"><D>{t('Please bring this receipt to collect.')}</D></div>
      <div className="mt-1 text-center"><D>{t('Powered by AminZi Tech')}</D></div>
    </div>
  );
}
