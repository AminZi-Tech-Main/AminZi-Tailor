import { useState } from 'react';
import { useUI } from '../context';
import { addCash } from '../data/actions';
import { CASH_LABEL, useDerived } from '../data/derive';
import { useStore } from '../data/store';
import { digitsOnly, fmt } from '../lib/format';
import type { CashCategory } from '../lib/types';
import { Afn, cx, Empty, Tx } from '../components/bits';
import { sheetBody, sheetFoot } from './OrderSheets';

const IN: CashCategory[] = ['opening', 'other_in', 'fabric_sale', 'perfume_sale'];
const OUT: CashCategory[] = ['wages', 'rent', 'bills', 'purchase', 'other_out'];

/** Record money coming in (opening cash, other income) or going out (wages, rent, bills…). */
export function CashForm({ direction: initial }: { direction: 'in' | 'out' }) {
  const ui = useUI();
  const d = useDerived();
  const { t } = ui.i;
  const missing = useStore((s) => s.status.cashBookMissing && !s.demo);
  const [direction, setDirection] = useState(initial);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CashCategory>(initial === 'in' ? 'opening' : 'wages');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const n = Number(amount) || 0;
  const cats = direction === 'in' ? IN : OUT;

  const err = missing ? t('Run the cash-book SQL in Supabase first (see README).') : n <= 0 ? t('Enter an amount first') : '';
  const save = () => {
    if (err) { setTried(true); return; }
    addCash(direction, n, category, note, ui.me.id);
    ui.close();
    ui.toast(t(direction === 'in' ? '؋ {amount} added to the money in the shop' : '؋ {amount} taken out of the money in the shop', { amount: fmt(n) }));
  };

  return (
    <>
      <div className={cx(sheetBody, 'gap-4')}>
        <div className="flex gap-1 rounded-[18px] border border-stroke bg-field p-1">
          {(['in', 'out'] as const).map((x) => (
            <button key={x} aria-pressed={direction === x} onClick={() => { setDirection(x); setCategory(x === 'in' ? 'opening' : 'wages'); }}
              className={cx('h-9 flex-1 rounded-[14px] text-[13px] font-medium transition-colors duration-200', direction === x && 'act')}>
              <Tx>{x === 'in' ? t('+ Money in') : t('− Money out')}</Tx>
            </button>
          ))}
        </div>
        <label className="field"><Tx>{t('Amount ؋')}</Tx>
          <input className="input h-14 font-mono text-[26px]" dir="ltr" inputMode="numeric" placeholder="0" value={amount} autoFocus
            onChange={(e) => setAmount(digitsOnly(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <div className="flex flex-col gap-2">
          <Tx className="text-xs text-muted">{t('What for')}</Tx>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => <button key={c} aria-pressed={category === c} className="chip h-[34px]" onClick={() => setCategory(c)}><Tx>{t(CASH_LABEL[c])}</Tx></button>)}
          </div>
          {direction === 'in' && (category === 'fabric_sale' || category === 'perfume_sale') && (
            <Tx className="text-xs text-muted">{t('Sales from the Fabric stock and Perfumes pages are added automatically.')}</Tx>
          )}
        </div>
        <label className="field"><Tx>{t('Note (optional)')}</Tx>
          <input className="input" dir="auto" maxLength={200} placeholder={direction === 'in' ? t('e.g. cash in the drawer this morning') : t('e.g. Rahim, last week')} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {direction === 'out' && n > d.money.cash && (
          <Tx className="text-xs text-danger">{t('This is more than the money recorded in the shop (؋ {cash}).', { cash: fmt(d.money.cash) })}</Tx>
        )}
        <div className="boxed">
          <div className="flex justify-between"><Tx className="text-muted">{t('Money in the shop now')}</Tx><span className="font-mono">؋ {fmt(d.money.cash)}</span></div>
          <div className="flex justify-between font-semibold"><Tx>{t('After this')}</Tx><span className="font-mono">؋ {fmt(d.money.cash + (direction === 'in' ? n : -n))}</span></div>
        </div>
      </div>
      <div className={sheetFoot}>
        {tried && err && <span role="alert" dir="auto" className="alert">{err}</span>}
        <button className="btn btn-acc h-[46px] text-sm" onClick={save}>
          <Tx>{t(direction === 'in' ? 'Add ؋ {amount}' : 'Take out ؋ {amount}', { amount: fmt(n) })}</Tx>
        </button>
      </div>
    </>
  );
}

/** Every payment, sale and expense, newest first. */
export function MoneyHistory() {
  const ui = useUI();
  const d = useDerived();
  const { t } = ui.i;
  const [limit, setLimit] = useState(100);
  const m = d.money;
  return (
    <>
      <div className={cx(sheetBody, 'gap-3')}>
        <div className="boxed">
          <div className="flex justify-between"><Tx className="text-muted">{t('All money received')}</Tx><span className="font-mono">؋ {fmt(m.received)}</span></div>
          <div className="flex justify-between"><Tx className="text-muted">{t('All money paid out')}</Tx><span className="font-mono">؋ {fmt(m.paidOut)}</span></div>
          <div className="flex justify-between font-semibold"><Tx>{t('Money in the shop now')}</Tx><span className="font-mono">؋ {fmt(m.cash)}</span></div>
        </div>
        {m.moves.length === 0 && <Empty>{t('No money recorded yet.')}</Empty>}
        <div className="flex flex-col">
          {m.moves.slice(0, limit).map((x) => <MoveRow key={x.id} x={x} />)}
        </div>
        {m.moves.length > limit && <button className="btn-chip mx-auto h-9 px-4" onClick={() => setLimit(limit + 200)}><Tx>{t('Show more ({n} left)', { n: m.moves.length - limit })}</Tx></button>}
      </div>
      <div className={cx(sheetFoot, 'flex-row')}>
        <button className="btn btn-glass h-11 flex-1" onClick={() => ui.open({ kind: 'cash', direction: 'in' })}><Tx>{t('+ Money in')}</Tx></button>
        <button className="btn btn-glass h-11 flex-1" onClick={() => ui.open({ kind: 'cash', direction: 'out' })}><Tx>{t('− Money out')}</Tx></button>
      </div>
    </>
  );
}

type Move = ReturnType<typeof useDerived>['money']['moves'][number];

/** One line of money: what, who/which, when, ± amount. */
export function MoveRow({ x, compact }: { x: Move; compact?: boolean }) {
  const ui = useUI();
  const open = x.orderId ? () => ui.open({ kind: 'detail', orderId: x.orderId! }) : undefined;
  const Tag = open ? 'button' : 'div';
  return (
    <Tag onClick={open} className={cx('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-2.5 text-start', compact ? 'py-2' : 'py-2.5', open && 'transition-colors duration-200 hover:bg-sel')}>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="dot" style={{ background: x.in ? 'var(--acc)' : 'var(--danger)' }} />
        <span className="flex min-w-0 flex-col">
          <Tx className="truncate font-medium">{x.label}</Tx>
          <Tx className="truncate text-xs text-muted">{[x.sub, compact ? ui.i.ago(x.at) : `${ui.i.num(x.at)} ${ui.i.timeHM(x.at)}`].filter(Boolean).join(' · ')}</Tx>
        </span>
      </span>
      <Afn value={fmt(x.amount)} sign={x.in ? '+' : '−'} className={cx('font-mono text-[13px] font-medium', x.in ? 'text-acc-ink' : 'text-danger')} />
    </Tag>
  );
}
