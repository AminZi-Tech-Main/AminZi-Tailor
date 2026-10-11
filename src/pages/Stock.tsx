import { useUI } from '../context';
import { moveFabric, movePerfume } from '../data/actions';
import { useDerived } from '../data/derive';
import { fmt } from '../lib/format';
import { Bar, Tx } from '../components/bits';
import { AccBtn, PageHead } from '../components/Shell';

export function Fabrics() {
  const ui = useUI();
  const d = useDerived();
  const { t, tv } = ui.i;
  const low = ui.shop.low_fabric_m;
  const canEdit = ui.me.role !== 'Tailor';
  return (
    <>
      <PageHead title={t('Fabric stock')}
        sub={t('Rolls under {n} m are marked red.', { n: low })}
        action={canEdit ? <AccBtn onClick={() => ui.open({ kind: 'roll' })}>{t('+ Add roll')}</AccBtn> : undefined} />
      {d.fabrics.length === 0 && <Tx className="card block px-[18px] py-6 text-[13px] text-muted">{t('No fabric rolls yet. Add the first roll.')}</Tx>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
        {d.fabrics.map((f) => {
          const isLow = f.metres_left < low;
          const pct = `${Math.max(0, Math.min((f.metres_left / (f.metres_of || 1)) * 100, 100))}%`;
          return (
            <div key={f.id} className="glass flex flex-col gap-3 rounded-3xl p-3.5 transition-transform duration-300 ease-meadow hover:-translate-y-[3px]">
              {/* Woven swatch: two crossing hairline patterns over the roll colour. */}
              <div className="h-[92px] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-20px_30px_rgba(0,0,0,.16)]"
                style={{ backgroundColor: f.swatch, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 2px, transparent 2px 9px), repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 2px, transparent 2px 9px)' }} />
              <div className="flex items-baseline justify-between gap-2">
                <Tx className="font-semibold">{tv(f.name)}</Tx>
                <span className="font-mono text-[11px] font-medium text-muted">{f.code}</span>
              </div>
              <Tx className="-mt-2 text-[13px] text-muted">{t('{colour} · ؋ {price} / m', { colour: tv(f.color), price: fmt(f.price_per_metre) })}</Tx>
              <Bar pct={pct} color={isLow ? 'var(--danger)' : 'var(--acc)'} />
              <div className="flex items-center justify-between gap-2">
                <Tx className={`font-mono text-[13px] font-medium ${isLow ? 'text-danger' : ''}`}>{t('{left} / {of} m', { left: f.metres_left, of: f.metres_of })}</Tx>
                {canEdit && (
                  <div className="flex gap-1.5">
                    <button className="btn-chip h-7 rounded-[14px] px-2.5" onClick={() => {
                      if (f.metres_left < 1) return ui.toast(t('Less than 1 m left on this roll'), true);
                      moveFabric(f.id, -1, 'sale', ui.me.id); ui.toast(t('1 m {name} sold · ؋ {price}', { name: tv(f.name), price: fmt(f.price_per_metre) }));
                    }}><Tx>{t('Sell 1 m')}</Tx></button>
                    <button className="btn-chip h-7 rounded-[14px] px-2.5" onClick={() => { moveFabric(f.id, 20, 'restock', ui.me.id); ui.toast(t('+20 m {name} added', { name: tv(f.name) })); }}><Tx>{t('+20 m')}</Tx></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Perfumes() {
  const ui = useUI();
  const d = useDerived();
  const { t, tv } = ui.i;
  const low = ui.shop.low_perfume;
  const value = d.perfumes.reduce((a, p) => a + p.price * Math.max(p.stock, 0), 0);
  return (
    <>
      <PageHead title={t('Perfumes')}
        sub={t('Stock value ؋ {value} · {n} or fewer are marked red.', { value: fmt(value), n: low })}
        action={<AccBtn onClick={() => ui.open({ kind: 'perfume' })}>{t('+ Add perfume')}</AccBtn>} />
      {d.perfumes.length === 0 && <Tx className="card block px-[18px] py-6 text-[13px] text-muted">{t('No perfumes yet. Add the first one.')}</Tx>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        {d.perfumes.map((p) => (
          <div key={p.id} className="glass flex flex-col gap-2.5 rounded-3xl p-4">
            <div className="flex h-[110px] items-end justify-center rounded-[18px]" style={{ background: `radial-gradient(60% 70% at 50% 100%, ${p.tint}, transparent 70%)` }}>
              <div className="relative h-[74px] w-[46px] rounded-[12px_12px_14px_14px]" style={{ background: `linear-gradient(160deg, rgba(255,255,255,.55), ${p.tint})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.7), 0 14px 24px -12px ${p.tint}` }}>
                <span className="absolute -top-3.5 left-3.5 h-3.5 w-[18px] rounded-[4px] bg-logo opacity-85" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <Tx className="font-semibold">{tv(p.name)}</Tx>
              <Tx className="font-mono text-[11px] font-medium text-muted">{ui.i.size(p.size)}</Tx>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[15px] font-medium">؋ {fmt(p.price)}</span>
              <Tx className={`font-mono text-xs font-medium ${p.stock <= low ? 'text-danger' : ''}`}>{t('{n} in stock', { n: p.stock })}</Tx>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
              <button className="btn btn-acc h-[34px] text-xs" onClick={() => {
                if (p.stock <= 0) return ui.toast(t('Out of stock'), true);
                movePerfume(p.id, -1, 'sale', ui.me.id); ui.toast(t('Sold 1 × {name} · ؋ {price}', { name: tv(p.name), price: fmt(p.price) }));
              }}><Tx>{t('Sell one')}</Tx></button>
              <button className="btn-chip h-[34px] rounded-[17px]" onClick={() => { movePerfume(p.id, 5, 'restock', ui.me.id); ui.toast(t('+5 {name}', { name: tv(p.name) })); }}>+5</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
