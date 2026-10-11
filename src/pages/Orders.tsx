import { useMemo, useState } from 'react';
import { useUI } from '../context';
import { setStage } from '../data/actions';
import { useDerived } from '../data/derive';
import { STAGE_COLOR, STAGES } from '../lib/constants';
import { fmt } from '../lib/format';
import type { Stage } from '../lib/types';
import { cx, Dot, Empty, Tx } from '../components/bits';
import { AccBtn, PageHead } from '../components/Shell';

const ROW = 'grid min-w-[760px] grid-cols-[76px_minmax(130px,1.4fr)_minmax(120px,1fr)_90px_104px_110px_90px] items-center gap-2.5';
/** Rows drawn at once. A busy shop has thousands of orders; drawing them all made the page slow. */
const PAGE = 120;

export function Orders() {
  const ui = useUI();
  const d = useDerived();
  const { t, stage } = ui.i;
  const filter = ui.orderFilter;
  const [limit, setLimit] = useState(PAGE);
  const shown = useMemo(() => (filter === 'All' ? d.orders : d.byStage[filter as Stage] ?? []), [d, filter]);
  const visible = shown.slice(0, limit);

  return (
    <>
      <div className="flex animate-enter flex-wrap items-end justify-between gap-4">
        <h1 className="h-page"><Tx>{t('Orders')}</Tx></h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="glass flex gap-1 overflow-x-auto rounded-[20px] p-1">
            {['All', ...STAGES].map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => { ui.setOrderFilter(f); setLimit(PAGE); }}
                className={cx('flex h-8 items-center gap-[7px] rounded-2xl px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-200', filter === f && 'act')}>
                <Tx>{f === 'All' ? t('All') : stage(f as Stage)}</Tx>
                <span className="font-mono text-[11px] font-medium opacity-70">{f === 'All' ? d.orders.length : d.byStage[f as Stage].length}</span>
              </button>
            ))}
          </div>
          <AccBtn onClick={() => ui.open({ kind: 'order' })}>{t('+ New order')}</AccBtn>
        </div>
      </div>
      <section className="card overflow-x-auto overflow-y-hidden">
        <div className={`${ROW} border-b border-stroke px-[18px] py-3 font-mono text-[11px] font-medium tracking-[1px] text-muted tracking-arabic-safe`}>
          <Tx>{t('ORDER')}</Tx><Tx>{t('CUSTOMER')}</Tx><Tx>{t('GARMENT')}</Tx><Tx>{t('TAILOR')}</Tx>
          <Tx>{t('STAGE')}</Tx><Tx>{t('DUE')}</Tx><Tx className="text-end">{t('BAL ؋')}</Tx>
        </div>
        <div className="flex min-w-[760px] flex-col p-1.5">
          {shown.length === 0 && <Empty>{t('No orders here yet.')}</Empty>}
          {visible.map((o) => (
            <button key={o.id} onClick={() => ui.open({ kind: 'detail', orderId: o.id })} className={`${ROW} rounded-[14px] px-3 py-[11px] text-start transition-colors duration-200 hover:bg-sel`}>
              <span className="font-mono text-xs font-medium text-acc-ink">{o.code}</span>
              <Tx className="truncate font-medium">{o.customer}</Tx>
              <Tx className="truncate text-muted">{o.garmentQty}</Tx>
              <Tx className="truncate text-muted">{o.tailor}</Tx>
              <span className="flex items-center gap-[7px] text-[13px]"><Dot color={o.stageColor} /><Tx>{stage(o.stage)}</Tx></span>
              <Tx className={`font-mono text-xs whitespace-nowrap ${o.overdue ? 'text-danger' : ''}`}>{o.dueLabel}</Tx>
              <span className="text-end font-mono text-xs font-medium">{fmt(o.balance)}</span>
            </button>
          ))}
          {shown.length > visible.length && (
            <button className="btn-chip mx-auto my-2 h-9 px-4" onClick={() => setLimit(limit + PAGE * 2)}>
              <Tx>{t('Show more ({n} left)', { n: shown.length - visible.length })}</Tx>
            </button>
          )}
        </div>
        <Tx className="block px-[18px] pt-2.5 pb-3.5 text-xs text-muted">
          {t('Showing {shown} of {total} orders · click a row to open it here', { shown: visible.length, total: d.orders.length })}
        </Tx>
      </section>
    </>
  );
}

export function Waitlist() {
  const ui = useUI();
  const d = useDerived();
  const { t, stage } = ui.i;
  const next = (s: Stage) => STAGES[STAGES.indexOf(s) + 1];
  return (
    <>
      <PageHead title={t('Waitlist')} sub={t('Every order by stage. Move a card forward with one click.')} action={<AccBtn onClick={() => ui.open({ kind: 'order' })}>{t('+ New order')}</AccBtn>} />
      <div className="grid grid-cols-[repeat(4,minmax(220px,1fr))] gap-3.5 overflow-x-auto pb-1.5">
        {STAGES.map((col) => {
          const cards = [...d.byStage[col]].sort((a, b) => a.due.localeCompare(b.due));
          // Delivered keeps growing forever: show the latest 12. Other columns cap at 60 cards.
          const visible = col === 'Delivered' ? cards.slice(-12).reverse() : cards.slice(0, 60);
          return (
            <section key={col} className="glass flex min-h-80 flex-col gap-2.5 rounded-3xl p-3">
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className="flex items-center gap-2 font-semibold"><Dot color={STAGE_COLOR[col]} /><Tx>{stage(col)}</Tx></span>
                <span className="font-mono text-xs font-medium text-muted">{cards.length}</span>
              </div>
              {cards.length > visible.length && <Tx className="px-1.5 text-xs text-muted">{t('Showing {n} of {total}', { n: visible.length, total: cards.length })}</Tx>}
              {visible.map((o) => (
                <div key={o.id} className="flex animate-enter flex-col gap-2 rounded-[18px] border border-stroke bg-glass-strong p-3" style={{ boxShadow: 'var(--hi)' }}>
                  <button className="flex flex-col gap-[3px] text-start" onClick={() => ui.open({ kind: 'detail', orderId: o.id })}>
                    <span className="flex w-full justify-between">
                      <span className="font-mono text-xs font-medium text-acc-ink">{o.code}</span>
                      <Tx className={`font-mono text-[11px] font-medium ${o.overdue ? 'text-danger' : ''}`}>{o.dueLabel}</Tx>
                    </span>
                    <Tx className="font-semibold">{o.customer}</Tx>
                    <Tx className="text-xs text-muted">{`${o.garmentQty} · ${o.tailor}`}</Tx>
                  </button>
                  {col !== 'Delivered' && (
                    <button className="h-[30px] rounded-[15px] border border-stroke bg-chip text-xs font-medium transition-[background-color,color,transform] duration-200 hover:bg-acc hover:text-on-acc active:scale-[.96]"
                      onClick={() => { setStage(o.id, next(col)); ui.toast(`${o.code} → ${stage(next(col))}`); }}>
                      <Tx>{col === 'Ready' ? t('Hand over') : t('→ {stage}', { stage: stage(next(col)) })}</Tx>
                    </button>
                  )}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
