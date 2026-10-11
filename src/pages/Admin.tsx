import { useEffect, useState } from 'react';
import { useUI } from '../context';
import { updateShop, updateStaff } from '../data/actions';
import { getState, useStore } from '../data/store';
import { SUPPORT_PHONE } from '../lib/constants';
import { initials } from '../lib/format';
import { LANG_LABEL, makeT } from '../lib/i18n';
import { tk } from '../lib/tk';
import type { Calendar, Lang } from '../lib/types';
import { cx, Kbd, Switch, Tx } from '../components/bits';
import { AccBtn, PageHead } from '../components/Shell';

// Mockup row: avatar · name · role chip · phone · last seen · active switch
const USER_ROW = 'grid min-w-[620px] grid-cols-[40px_minmax(120px,1fr)_110px_minmax(130px,auto)_90px_52px] items-center gap-3 rounded-2xl px-3 py-2.5';

export function Users() {
  const ui = useUI();
  const staff = useStore((s) => s.view.staff);
  const { t, tv } = ui.i;
  const admins = staff.filter((s) => s.role === 'Admin' && s.active);
  return (
    <>
      <PageHead title={t('Users')} sub={t('Each person signs in with their own PIN. Paused users cannot sign in.')} action={<AccBtn onClick={() => ui.open({ kind: 'user' })}>{t('+ Add user')}</AccBtn>} />
      <section className="card flex flex-col overflow-x-auto p-1.5">
        {staff.map((u) => {
          const lastAdmin = u.role === 'Admin' && u.active && admins.length <= 1;
          const name = tv(u.name);
          return (
            <div key={u.id} className={USER_ROW}>
              <span className="avatar size-9 text-xs">{initials(name)}</span>
              <button className="truncate text-start font-semibold hover:text-acc-ink" title={t('Edit user')} onClick={() => ui.open({ kind: 'user', staffId: u.id })}><Tx>{name}</Tx></button>
              <Tx className="h-6 justify-self-start rounded-xl border border-stroke bg-chip px-2.5 text-xs leading-[22px]">{ui.i.role(u.role)}</Tx>
              <span className="font-mono text-xs text-muted">{u.phone || '—'}</span>
              <Tx className="text-xs text-muted">{u.id === ui.me.id ? t('Now') : ui.i.ago(u.last_seen)}</Tx>
              <Switch on={u.active} label={u.active ? t('Active') : t('Paused')} onClick={() => {
                if (u.user_id) return ui.toast(t('{name} signs in with Supabase — remove them there instead', { name }), true);
                if (lastAdmin) return ui.toast(t('Keep at least one active admin'), true);
                updateStaff(u.id, { active: !u.active }); ui.toast(t(u.active ? '{name} paused' : '{name} activated', { name }));
              }} />
            </div>
          );
        })}
      </section>
    </>
  );
}

/** Text input that saves on blur / Enter, and follows remote changes. */
function SavedInput({ value, onSave, className = 'input', ...rest }: { value: string; onSave: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input {...rest} className={className} value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => v.trim() !== value && onSave(v.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

export function downloadBackup() {
  const { view } = getState();
  const shop = view.shop!;
  const stamp = new Date();
  const data = { app: 'aminzi-tailor', version: 1, exported_at: stamp.toISOString(), ...view, staff: view.staff.map(({ pin_hash: _h, pin_salt: _s, ...rest }) => rest) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aminzi-backup-${shop.name.replace(/[^\w]+/g, '-').toLowerCase()}-${stamp.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  updateShop({ last_backup: stamp.toISOString() });
}

export function Settings() {
  const ui = useUI();
  const st = ui.shop;
  const { t } = ui.i;
  const chips = <V extends string>(cur: V, opts: V[], label: (v: V) => string, on: (v: V) => void) => (
    <div className="flex flex-wrap gap-1.5">{opts.map((o) => <button key={o} aria-pressed={cur === o} className="chip h-[34px]" onClick={() => on(o)}><Tx>{label(o)}</Tx></button>)}</div>
  );
  const printer = (label: string, name: string, test: string, run: () => void) => (
    <div className="flex items-center gap-3">
      <span className="flex flex-1 flex-col"><Tx className="font-medium">{label}</Tx><span className="font-mono text-xs text-muted">{name}</span></span>
      <button className="btn-chip h-8 rounded-2xl px-3.5" onClick={run}><Tx>{test}</Tx></button>
    </div>
  );
  const CAL_LABEL: Record<Calendar, string> = { 'Solar Hijri': t('Solar Hijri'), Gregorian: t('Gregorian') };

  return (
    <>
      <h1 className="h-page animate-enter"><Tx>{t('Settings')}</Tx></h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-5">
        <section className="card flex flex-col gap-3.5 p-5">
          <Tx className="h-section">{t('Shop')}</Tx>
          <label className="field gap-1.5"><Tx>{t('Shop name (on receipts)')}</Tx><SavedInput dir="auto" value={st.name} onSave={(v) => v && updateShop({ name: v })} /></label>
          <label className="field gap-1.5"><Tx>{t('Shop phone')}</Tx><SavedInput className="input font-mono" dir="ltr" inputMode="tel" value={st.phone ?? ''} onSave={(v) => updateShop({ phone: v || null })} /></label>
          <div className="field gap-1.5"><Tx>{t('Language')}</Tx>{chips<Lang>(st.lang, ['English', 'Dari', 'Pashto'], (l) => LANG_LABEL[l], (l) => { updateShop({ lang: l }); ui.toast(makeT(l).t('Language: {lang}', { lang: LANG_LABEL[l] })); })}</div>
          <div className="field gap-1.5"><Tx>{t('Calendar')}</Tx>{chips<Calendar>(st.calendar, ['Solar Hijri', 'Gregorian'], (c) => CAL_LABEL[c], (c) => { updateShop({ calendar: c }); ui.toast(t('Calendar: {cal}', { cal: CAL_LABEL[c] })); })}</div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="card flex flex-col gap-3 p-5">
            <Tx className="h-section">{t('Printers')}</Tx>
            {printer(t('Receipt printer'), st.receipt_printer, t('Test print'), () => ui.print({ kind: 'test-receipt', shop: st }))}
            {printer(t('Label printer'), st.label_printer, t('Test label'), () => ui.print({ kind: 'test-label', shop: st }))}
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <Tx className="h-section">{t('Backup')}</Tx>
            <div className="flex items-center gap-3">
              <span className="flex flex-1 flex-col">
                <Tx className="font-medium">{t('Back up every night to USB')}</Tx>
                <span className="text-xs text-muted"><Tx>{t('Last backup')}</Tx> <Tx className="font-mono">{st.last_backup ? `${ui.i.num(st.last_backup)} ${ui.i.timeHM(st.last_backup)}` : t('never')}</Tx></span>
              </span>
              <Switch on={st.auto_backup} label={t('Automatic backup')} onClick={() => updateShop({ auto_backup: !st.auto_backup })} />
            </div>
            <button className="btn btn-acc h-10 rounded-[20px]" onClick={() => { downloadBackup(); ui.toast(t('Backup copied — save it to the USB drive')); }}><Tx>{t('Back up now')}</Tx></button>
          </section>
        </div>
      </div>
    </>
  );
}

// FAQ and shortcuts exactly as in the design handoff.
const FAQ = [
  { q: tk('Does it work without internet?'), a: tk('Yes. Everything is saved on this PC first. When the shop network is back, changes sync to the other counters.') },
  { q: tk('How do I print a label for a garment?'), a: tk('Open any order, then press Print label. The USB label printer set in Settings prints the order ID, customer and due date.') },
  { q: tk('A customer changed size. Do I lose the old measurements?'), a: tk('No. Every save keeps a dated entry in Measurement history, so you can see what changed and when.') },
  { q: tk('How are tailor wages counted?'), a: tk('Each finished piece is credited to the tailor on the order. The weekly total shows on the Dashboard and under Users.') },
];
const SHORTCUTS: [string, string][] = [['/', tk('Search')], ['N', tk('New order')], ['M', tk('Take measurements')], ['Esc', tk('Close panel')]];

export function Help() {
  const ui = useUI();
  const { t } = ui.i;
  const [open, setOpen] = useState(0);
  return (
    <>
      <h1 className="h-page animate-enter"><Tx>{t('Help')}</Tx></h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-5">
        <section className="card flex flex-col p-2">
          {FAQ.map((f, i) => (
            <div key={f.q} className="flex flex-col rounded-[18px]">
              <button className={cx('flex items-center gap-3 rounded-2xl p-3.5 text-start text-sm font-semibold hover:bg-sel')} aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                <Tx className="flex-1">{t(f.q)}</Tx>
                <span className="font-mono text-base font-medium text-acc-ink">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <p dir="auto" className="m-0 animate-enter px-3.5 pb-3.5 text-pretty text-muted">{t(f.a)}</p>}
            </div>
          ))}
        </section>
        <div className="flex flex-col gap-5">
          <section className="card flex flex-col gap-2.5 p-5">
            <Tx className="h-section">{t('Keyboard shortcuts')}</Tx>
            {SHORTCUTS.map(([k, l]) => <div key={k} className="flex items-center justify-between"><Tx>{t(l)}</Tx><Kbd>{k}</Kbd></div>)}
          </section>
          <section className="card flex flex-col gap-2.5 p-5">
            <Tx className="h-section">{t('Need a hand?')}</Tx>
            <Tx className="text-muted">{t('AminZi Tech support answers in Dari, Pashto and English.')}</Tx>
            <a className="btn btn-acc no-underline" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} onClick={() => ui.toast(t('Calling AminZi Tech · {phone}', { phone: SUPPORT_PHONE }))}>
              <Tx>{t('Call {phone}', { phone: SUPPORT_PHONE })}</Tx>
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
