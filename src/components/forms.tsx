import { useMemo } from 'react';
import { MEAS_KEYS, PERAHAN, TUNBAN } from '../lib/constants';
import { decimalOnly, initials } from '../lib/format';
import type { T } from '../lib/i18n';
import type { Customer, Meas, MeasKey } from '../lib/types';
import { cx, Tx } from './bits';

export type MeasForm = Record<MeasKey, string>;
export const blankMeas = (): MeasForm => Object.fromEntries(MEAS_KEYS.map((k) => [k, ''])) as MeasForm;
export const measToForm = (m: Meas): MeasForm =>
  Object.fromEntries(MEAS_KEYS.map((k) => [k, m[k] != null ? String(m[k]) : ''])) as MeasForm;

export const stepLabel = 'font-mono text-[11px] font-medium tracking-[1.2px] text-muted uppercase tracking-arabic-safe';

/**
 * Numbered Perahan + Tunban inputs, fully translated (labels, "CM", placeholders).
 * `layout` matches the three places they appear in the design.
 */
export function MeasGrid({ value, onChange, layout, i, steps }: {
  value: MeasForm; onChange: (k: MeasKey, v: string) => void; layout: 'list' | 'two' | 'three'; i: T; steps?: [string, string];
}) {
  const { t } = i;
  const cm = t('CM');
  const perahan = t('Perahan');
  const tunban = t('Tunban');
  if (layout === 'list') {
    const head = (title: string, border: boolean) => (
      <div className={cx('flex items-baseline justify-between', border ? 'mt-1.5 border-t border-stroke pt-3 pb-1' : 'pb-1')}>
        <Tx className="h-section">{title}</Tx><Tx className="font-mono text-[11px] font-medium text-muted">{cm}</Tx>
      </div>
    );
    const row = ([k, label]: [MeasKey, string], n: number, ring: boolean, aria: string) => (
      <label key={k} className="flex h-[42px] items-center gap-2.5">
        <span className={cx('size-6 flex-none rounded-full text-center font-mono text-[11px] font-semibold',
          ring ? 'border border-acc leading-[22px] text-acc-ink' : 'bg-acc leading-6 text-on-acc')}>{n}</span>
        <Tx className="flex-1">{t(label)}</Tx>
        <input className="h-[34px] w-[74px] rounded-[12px] border border-stroke bg-field px-2.5 text-end font-mono text-sm font-medium outline-none focus-visible:border-acc"
          dir="ltr" inputMode="decimal" value={value[k]} onChange={(e) => onChange(k, decimalOnly(e.target.value))} aria-label={aria} />
      </label>
    );
    return (
      <>
        {head(perahan, false)}
        {PERAHAN.map((x, n) => row(x, n + 1, false, `${perahan} · ${t(x[1])}`))}
        {head(tunban, true)}
        {TUNBAN.map((x, n) => row(x, n + 1 + PERAHAN.length, true, `${tunban} · ${t(x[1])}`))}
      </>
    );
  }
  const cell = ([k, label]: [MeasKey, string], n: number, prefix = '') => (
    <label key={k} className="field">
      <span className={cx('truncate', layout === 'three' && 'text-[11px]')}><span className="font-mono text-acc-ink">{n}</span> <Tx>{prefix}{t(label)}</Tx></span>
      <input className={cx('input font-mono', layout === 'three' ? 'h-9 rounded-[10px]' : 'h-10 text-[15px]')} dir="ltr" inputMode="decimal" placeholder={t('cm')}
        aria-label={`${prefix}${t(label)}`} value={value[k]} onChange={(e) => onChange(k, decimalOnly(e.target.value))} />
    </label>
  );
  if (layout === 'three') {
    return <div className="grid grid-cols-3 gap-2">{PERAHAN.map((x, n) => cell(x, n + 1))}{TUNBAN.map((x, n) => cell(x, n + 1 + PERAHAN.length, `${t('T.')} `))}</div>;
  }
  const [s1, s2] = steps ?? ['', ''];
  return (
    <>
      <Tx className={stepLabel}>{s1}{perahan} · {cm}</Tx>
      <div className="grid grid-cols-2 gap-2.5">{PERAHAN.map((x, n) => cell(x, n + 1))}</div>
      <Tx className={cx(stepLabel, 'mt-1.5')}>{s2}{tunban} · {cm}</Tx>
      <div className="grid grid-cols-2 gap-2.5">{TUNBAN.map((x, n) => cell(x, n + 1 + PERAHAN.length))}</div>
    </>
  );
}

export interface PickerState { mode: 'pick' | 'new'; q: string; customerId: string | null; name: string; phone: string }
export const blankPicker = (customerId: string | null = null): PickerState => ({ mode: 'pick', q: '', customerId, name: '', phone: '' });

/** Find an existing customer by name/phone, or add a walk-in inline. */
export function CustomerPicker({ customers, value, onChange, onPicked, note, newLabel, i }: {
  customers: Customer[]; value: PickerState; onChange: (p: Partial<PickerState>) => void; onPicked?: (c: Customer | null) => void; note: string; newLabel: string; i: T;
}) {
  const { t, tv } = i;
  const picked = value.customerId ? customers.find((c) => c.id === value.customerId) ?? null : null;
  const matches = useMemo(() => {
    const q = value.q.trim().toLowerCase();
    if (!q) return [];
    const qd = q.replace(/\s/g, '');
    return customers.filter((c) => c.name.toLowerCase().includes(q) || tv(c.name).toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(qd) || c.code.toLowerCase() === q).slice(0, 5);
  }, [customers, value.q, tv]);

  if (picked) {
    return (
      <div className="flex items-center gap-3 rounded-[18px] border border-stroke bg-chip p-2.5">
        <span className="avatar size-10 border-0 bg-acc text-[13px] text-on-acc">{initials(tv(picked.name))}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <Tx className="font-semibold">{tv(picked.name)}</Tx>
          <span className="font-mono text-xs text-muted">{picked.phone} · <Tx>{note}</Tx></span>
        </span>
        <button className="btn-chip bg-transparent" onClick={() => { onChange({ customerId: null }); onPicked?.(null); }}><Tx>{t('Change')}</Tx></button>
      </div>
    );
  }
  if (value.mode === 'new') {
    return (
      <>
        <div className="grid animate-pop grid-cols-2 gap-2.5">
          <label className="field"><Tx>{t('Name')}</Tx><input className="input" dir="auto" placeholder={t('Full name')} value={value.name} onChange={(e) => onChange({ name: e.target.value })} autoFocus /></label>
          <label className="field"><Tx>{t('Phone')}</Tx><input className="input font-mono" dir="ltr" inputMode="tel" placeholder="07X XXX XXXX" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} /></label>
        </div>
        <button className="btn-link self-start" onClick={() => onChange({ mode: 'pick', name: '', phone: '' })}><Tx>{t('← Pick an existing customer')}</Tx></button>
      </>
    );
  }
  const hasDigit = /\d/.test(value.q);
  return (
    <>
      <input className="input h-11 rounded-[14px] px-3.5 text-[15px]" dir="auto" placeholder={t('Type a name or phone…')} aria-label={t('Find customer')} value={value.q} onChange={(e) => onChange({ q: e.target.value })} autoFocus />
      {matches.length > 0 && (
        <div className="flex animate-pop flex-col gap-1">
          {matches.map((c) => (
            <button key={c.id} className="list-btn border border-stroke bg-chip px-2.5 py-2"
              onClick={() => { onChange({ customerId: c.id, q: '', mode: 'pick' }); onPicked?.(c); }}>
              <span className="avatar size-[30px] border-0 bg-sel text-[11px]">{initials(tv(c.name))}</span>
              <Tx className="flex-1 font-medium">{tv(c.name)}</Tx>
              <span className="font-mono text-[11px] text-muted">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
      {value.q.trim() !== '' && matches.length === 0 && (
        <button className="h-10 animate-pop rounded-[14px] border border-dashed border-acc bg-acc-soft text-[13px] font-medium"
          onClick={() => onChange({ mode: 'new', name: hasDigit ? '' : value.q, phone: hasDigit ? value.q : '', q: '' })}>
          <Tx>{t('No match · add “{q}” as a new customer', { q: value.q })}</Tx>
        </button>
      )}
      <button className="btn-link self-start" onClick={() => onChange({ mode: 'new', customerId: null })}><Tx>{newLabel}</Tx></button>
    </>
  );
}
