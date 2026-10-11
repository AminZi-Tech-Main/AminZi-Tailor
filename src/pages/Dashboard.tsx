import { useState } from 'react';
import { useUI } from '../context';
import { moveFabric } from '../data/actions';
import { useDerived } from '../data/derive';
import { fmt } from '../lib/format';
import { Afn, Bar, Dot, Empty, KeyHint, Tx } from '../components/bits';
import { RingBadge } from '../components/Logo';
import { Panel } from '../components/Shell';
import { useStore } from '../data/store';
import { MoveRow } from '../sheets/MoneySheets';

export function Dashboard() {
  const ui = useUI();
  const d = useDerived();
  const { t, tv, stage } = ui.i;
  const [car, setCar] = useState(0);

  const list = d.bySoonest;
  const n = Math.max(list.length, 1);
  const idx = ((car % n) + n) % n;
  const heroLine = t('{r} pickups waiting, {o} order overdue, {f} fabrics running low. Everything is saved on this PC.', { r: d.readyCount, o: d.overdueCount, f: d.lowFabrics.length });
  const kpis = [
    { label: t('Active orders'), value: d.active.length, note: t('{n} on the machines', { n: d.sewingCount }), go: () => ui.go('orders', { filter: 'All' }) },
    { label: t('Ready for pickup'), value: d.readyCount, note: t('Call customers today'), go: () => ui.go('orders', { filter: 'Ready' }) },
    { label: t('Overdue'), value: d.overdueCount, note: t('Past due, not ready'), go: () => ui.open({ kind: 'notif' }) },
    { label: t('Balance owed ؋'), value: d.owedFmt, note: t('Across active orders'), go: () => ui.go('orders', { filter: 'All' }) },
  ];

  // Only the cards near the centre are drawn: the rest are invisible anyway, and 3D-transformed
  // glass cards are the most expensive thing on this screen.
  const shown = list.map((o, i) => {
    let off = i - idx;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    return { o, off, a: Math.abs(off) };
  }).filter((x) => x.a <= 2);

  return (
    <>
      <section className="flex animate-enter flex-wrap items-center justify-between gap-6">
        <div className="flex max-w-[620px] flex-col gap-3.5">
          <h1 dir="auto" className="m-0 font-serif text-[clamp(44px,6vw,76px)] leading-[.98] font-medium tracking-[-1.5px] text-balance tracking-arabic-safe">
            {t('Today at')} <span dir="ltr" className="text-acc-ink italic transition-colors duration-600">AminZi.</span>
          </h1>
          <p dir="auto" className="m-0 max-w-[460px] text-[15px] text-pretty text-muted">{heroLine}</p>
          <div className="flex flex-wrap gap-2.5">
            <button className="btn btn-acc h-11 rounded-[22px] px-[22px] text-sm" onClick={() => ui.open({ kind: 'order' })}>
              <Tx>{t('+ New order')}</Tx><KeyHint k="N" />
            </button>
            <button className="btn btn-glass h-11 rounded-[22px] px-[22px] text-sm" onClick={() => ui.open({ kind: 'measure' })}>
              <Tx>{t('Take measurements')}</Tx><KeyHint k="M" dim={0.5} />
            </button>
          </div>
        </div>
        <div className="max-sm:hidden">
          <RingBadge label={t('New order')} text={t('NEW ORDER · MEASURE · STITCH · DELIVER · ')} rtl={ui.i.rtl} onClick={() => ui.open({ kind: 'order' })} />
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        {kpis.map((k) => (
          <button key={k.label} onClick={k.go} className="glass flex flex-col gap-1.5 rounded-[22px] px-5 py-[18px] text-start transition-transform duration-250 ease-meadow hover:-translate-y-[3px] active:scale-[.98]">
            <Tx className="text-[13px] text-muted">{k.label}</Tx>
            <span data-kpi className="font-mono text-[34px] leading-[1.05] font-medium tracking-[-1px] tabular-nums max-sm:text-[28px]">{k.value}</span>
            <Tx className="text-xs text-muted">{k.note} {ui.i.fwd}</Tx>
          </button>
        ))}
      </section>

      {ui.me.role !== 'Tailor' && <MoneyPanel />}

      <section className="glass flex flex-col gap-2.5 overflow-hidden rounded-[30px] px-[22px] pt-[22px] pb-[18px]">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Tx className="eyebrow">{t('ON THE WORKBENCH')}</Tx>
            <h2 className="m-0 font-serif text-[26px] font-medium"><Tx>{t('Active orders, soonest first')}</Tx></h2>
          </div>
          <Tx className="text-xs text-muted">{t('Click the centre card to open it here')}</Tx>
        </div>
        {list.length === 0 ? (
          <Empty>{t('No active orders. Press N to take the first one.')}</Empty>
        ) : (
          <>
            <div className="relative mt-1.5 h-[300px] [perspective:1200px]" dir="ltr">
              {shown.map(({ o, off, a }) => (
                <button key={o.id}
                  onClick={() => (off === 0 ? ui.open({ kind: 'detail', orderId: o.id }) : setCar(car + off))}
                  className="absolute top-2.5 left-1/2 -ml-[125px] flex h-[270px] w-[250px] flex-col gap-2 rounded-[26px] border border-stroke p-[18px] text-start text-card-fg transition-[transform,opacity,box-shadow] duration-700 ease-meadow"
                  style={{
                    background: 'var(--card-bg)',
                    transform: `translateX(${off * 56}%) translateZ(${-a * 160}px) rotateY(${off * -34}deg) scale(${off === 0 ? 1 : 0.92})`,
                    opacity: a === 0 ? 1 : a === 1 ? 0.5 : 0.22, zIndex: 10 - a,
                    boxShadow: `${off === 0 ? 'var(--card-glow), ' : ''}var(--hi), var(--drop)`,
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs opacity-80">{o.code}</span>
                    <span className="flex h-[22px] items-center gap-1.5 rounded-[11px] bg-chip px-[9px] text-[11px] font-semibold"><Dot color={o.stageColor} size={6} /><Tx>{stage(o.stage)}</Tx></span>
                  </div>
                  <div className="flex flex-1 items-center justify-center">
                    <span className="avatar size-[74px] font-serif text-[26px] font-medium">{o.initials}</span>
                  </div>
                  <Tx className="text-[17px] leading-[1.2] font-semibold">{o.customer}</Tx>
                  <Tx className="text-[13px] opacity-80">{t('{garment} · due {date}', { garment: o.garmentQty, date: o.dueLabel })}</Tx>
                  <Bar pct={o.paidPct} h={4} />
                  <Tx className="font-mono text-[11px] opacity-75">{t('PAID {pct} · ؋ {bal} DUE', { pct: o.paidPct, bal: fmt(o.balance) })}</Tx>
                </button>
              ))}
              {(['‹', '›'] as const).map((ch, i) => (
                <button key={ch} aria-label={i ? t('Next') : t('Previous')} onClick={() => setCar(car + (i ? 1 : -1))}
                  className={`glass-strong absolute top-1/2 z-20 -mt-[22px] size-11 rounded-full text-xl transition-transform active:scale-[.92] ${i ? 'right-1' : 'left-1'}`}>{ch}</button>
              ))}
            </div>
            <div className="flex justify-center gap-1.5" dir="ltr">
              {list.map((o, i) => (
                <button key={o.id} aria-label={t('Go to {code}', { code: o.code })} onClick={() => setCar(i)}
                  className="h-[7px] rounded-[4px] transition-[width,background-color] duration-350 ease-meadow"
                  style={{ width: i === idx ? 22 : 7, background: i === idx ? 'var(--acc)' : 'var(--track)' }} />
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-5">
        <Panel title={t('Workshop pipeline')} action={<button className="btn-link text-xs" onClick={() => ui.go('waitlist')}><Tx>{t('Board ↗')}</Tx></button>}>
          {d.pipeline.map((p) => (
            <button key={p.stage} onClick={() => ui.go('waitlist')} className="flex flex-col gap-2 rounded-2xl p-3 text-start transition-colors duration-200 hover:bg-sel">
              <div className="flex w-full items-baseline justify-between">
                <span className="flex items-center gap-2.5 font-medium"><span className="font-mono text-[11px] text-muted">{p.n}</span><Tx>{stage(p.stage)}</Tx></span>
                <span className="font-mono text-xl font-medium">{p.count}</span>
              </div>
              <Bar pct={p.pct} color={p.color} />
              <span className="font-mono text-[11px] text-muted">{p.codes}</span>
            </button>
          ))}
        </Panel>

        <Panel title={t('Due in the next 7 days')} bodyClass="px-2 pt-1.5 pb-2">
          {d.dueSoon.length === 0 && <Empty>{t('Nothing due this week.')}</Empty>}
          {d.dueSoon.slice(0, 40).map((o) => (
            <button key={o.id} onClick={() => ui.open({ kind: 'detail', orderId: o.id })} className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] p-2.5 text-start transition-colors duration-200 hover:bg-sel">
              <span className="font-mono text-xs font-medium text-acc-ink">{o.code}</span>
              <span className="flex min-w-0 flex-col">
                <Tx className="truncate font-medium">{o.customer}</Tx>
                <span className="flex items-center gap-1.5 text-xs text-muted"><Dot color={o.stageColor} size={6} /><Tx>{`${stage(o.stage)} · ${o.garmentName}`}</Tx></span>
              </span>
              <Tx className={`font-mono text-xs font-medium whitespace-nowrap ${o.overdue ? 'text-danger' : ''}`}>{o.dueLabel}</Tx>
            </button>
          ))}
        </Panel>

        <div className="flex flex-col gap-5">
          <section className="card flex flex-col gap-3 p-[18px]">
            <div className="flex items-baseline justify-between">
              <Tx className="font-semibold">{t('Fabric running low')}</Tx>
              <button className="btn-link text-xs" onClick={() => ui.go('fabrics')}><Tx>{t('Stock ↗')}</Tx></button>
            </div>
            {d.lowFabrics.length === 0 && <Tx className="text-xs text-muted">{t('All rolls above {n} m.', { n: ui.shop.low_fabric_m })}</Tx>}
            {d.lowFabrics.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <span className="size-[34px] flex-none rounded-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)]" style={{ background: f.swatch }} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <Tx className="font-medium">{tv(f.name)}</Tx>
                  <Tx className="font-mono text-[11px] font-medium text-danger">{t('{n} m left', { n: f.metres_left })}</Tx>
                </span>
                {ui.me.role !== 'Tailor' && (
                  <button className="btn-chip" onClick={() => { moveFabric(f.id, 20, 'restock', ui.me.id); ui.toast(t('+20 m {name} added', { name: tv(f.name) })); }}><Tx>{t('+20 m')}</Tx></button>
                )}
              </div>
            ))}
          </section>

          <section className="card flex flex-col gap-3 p-[18px]">
            <div className="flex items-baseline justify-between">
              <Tx className="font-semibold">{t('Tailor wages · this week')}</Tx>
              <span className="font-mono text-[13px] font-semibold">؋ {fmt(d.wagesTotal)}</span>
            </div>
            {d.wages.length === 0 && <Tx className="text-xs text-muted">{t('Add tailors under Users to track wages.')}</Tx>}
            {d.wages.map((w) => (
              <div key={w.id} className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span><Tx>{w.name}</Tx> <Tx className="text-xs text-muted">· {t('{n} pcs', { n: w.pieces })}</Tx></span>
                  <span className="font-mono text-[13px] font-medium">{w.amountFmt}</span>
                </div>
                <Bar pct={w.pct} h={5} />
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * Money in the shop: every customer payment (deposits and later payments) plus counter sales
 * and other money in, minus money paid out. A payment recorded anywhere adds to it at once.
 */
function MoneyPanel() {
  const ui = useUI();
  const d = useDerived();
  const { t } = ui.i;
  const missing = useStore((s) => s.status.cashBookMissing && !s.demo);
  const m = d.money;
  const stat = (label: string, value: number, tone?: 'in' | 'out') => (
    <div className="flex min-w-[130px] flex-1 flex-col gap-1 rounded-[18px] border border-stroke bg-chip px-3.5 py-3">
      <Tx className="text-xs text-muted">{label}</Tx>
      <Afn value={fmt(value)} sign={tone === 'in' ? '+' : tone === 'out' ? '−' : undefined}
        className={`text-start font-mono text-[17px] font-medium ${tone === 'in' ? 'text-acc-ink' : tone === 'out' ? 'text-danger' : ''}`} />
    </div>
  );
  return (
    <section data-money className="glass grid animate-enter grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-6 rounded-[30px] p-[22px]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Tx className="eyebrow">{t('MONEY IN THE SHOP')}</Tx>
          <span data-cash><Afn value={fmt(m.cash)} className="block text-start font-mono text-[clamp(38px,4.6vw,56px)] leading-none font-medium tracking-[-1.5px] tabular-nums" /></span>
          <Tx className="text-[13px] text-muted">{t('Every customer payment and sale, minus money paid out. Payments are added the moment you record them.')}</Tx>
        </div>
        <div className="flex flex-wrap gap-2">
          {stat(t('Received today'), m.today, 'in')}
          {stat(t('Paid out today'), m.todayOut, 'out')}
          {stat(t('Received this week'), m.week, 'in')}
          {stat(t('Still to collect'), d.owed)}
        </div>
        {missing && <Tx className="text-xs text-danger">{t('Run the cash-book SQL in Supabase first (see README).')}</Tx>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-acc" onClick={() => ui.open({ kind: 'cash', direction: 'in' })}><Tx>{t('+ Money in')}</Tx></button>
          <button className="btn btn-glass" onClick={() => ui.open({ kind: 'cash', direction: 'out' })}><Tx>{t('− Money out')}</Tx></button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline justify-between px-2.5 pb-1">
          <Tx className="font-semibold">{t('Latest money')}</Tx>
          <button className="btn-link text-xs" onClick={() => ui.open({ kind: 'money' })}><Tx>{t('All ↗')}</Tx></button>
        </div>
        {m.moves.length === 0 && <Empty>{t('No money recorded yet.')}</Empty>}
        {m.moves.slice(0, 6).map((x) => <MoveRow key={x.id} x={x} compact />)}
      </div>
    </section>
  );
}
