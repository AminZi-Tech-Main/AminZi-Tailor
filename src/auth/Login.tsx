import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { checkPin, hashPin, pinOk } from '../lib/pin';
import { initials } from '../lib/format';
import type { T } from '../lib/i18n';
import type { Lang, Staff } from '../lib/types';
import { cx, Tx } from '../components/bits';

/*
  Sign-in screens in the Glass mockup's own style: the app stays visible behind a
  blurred scrim, and a rounded glass card sits in the middle ("Who is at the counter?").
  No sign-up: accounts are created by the admin in Supabase → Authentication.
*/

/** The last shop language this PC saw — the sign-in card speaks it before a shop is open. */
const LANG_KEY = 'aminzi:lang';
export function rememberLang(l: Lang) { try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode */ } }
export function savedLang(): Lang { try { return (localStorage.getItem(LANG_KEY) as Lang) || 'English'; } catch { return 'English'; } }

// ---------------------------------------------------------------------------
// The mockup's overlay + card
// ---------------------------------------------------------------------------

export function Gate({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-70 flex animate-fade items-center justify-center overflow-y-auto bg-scrim p-4 backdrop-blur-[24px]">
      <div className="flex w-[min(420px,calc(100vw-32px))] animate-pop flex-col gap-3.5 rounded-[30px] border border-stroke bg-glass-strong p-7" style={{ boxShadow: 'var(--hi), var(--drop)' }}>
        {children}
        {footer && <div className="mt-1 flex items-center justify-between gap-3 border-t border-stroke pt-3.5">{footer}</div>}
      </div>
    </div>
  );
}

const Title = ({ children }: { children: ReactNode }) => <span dir="auto" className="font-serif text-[32px] leading-[1.15] font-medium">{children}</span>;
const Sub = ({ children }: { children: ReactNode }) => <span dir="auto" className="text-muted">{children}</span>;
const inputCls = 'h-[42px] w-full rounded-[12px] border border-stroke bg-field px-3 text-[15px] font-medium text-fg outline-none focus-visible:border-acc';
const primary = 'h-[46px] w-full rounded-[23px] bg-acc text-sm font-semibold text-on-acc shadow-(--btn-sh) transition-transform active:scale-[.98] disabled:opacity-60';
const secondary = 'h-[46px] w-full rounded-[23px] border border-stroke bg-chip text-sm font-semibold transition-[background-color,transform] hover:bg-sel active:scale-[.98] disabled:opacity-60';
const link = 'bg-transparent p-0 text-[13px] font-medium text-acc-ink hover:text-fg';

function Msg({ text, err }: { text: string; err: boolean }) {
  return <span role={err ? 'alert' : 'status'} dir="auto" className={cx('animate-pop text-[13px]', err ? 'text-danger' : 'text-acc-ink')}>{text}</span>;
}

function PasswordInput({ value, onChange, onEnter, autoComplete, show, hide, label }: { value: string; onChange: (v: string) => void; onEnter: () => void; autoComplete: string; show: string; hide: string; label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input className={cx(inputCls, 'pe-20')} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} aria-label={label}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter()} />
      <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}
        className="absolute inset-y-1 end-1 rounded-[9px] px-3 text-xs font-medium text-muted hover:bg-sel hover:text-fg"><Tx>{visible ? hide : show}</Tx></button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign in (Supabase Auth) + demo
// ---------------------------------------------------------------------------

export function SignIn({ i, onDemo }: { i: T; onDemo: () => void }) {
  const { t } = i;
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ text: t('Enter a valid email'), err: true });
    if (!pw) return setMsg({ text: t('Wrong email or password'), err: true });
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg({ text: /invalid login credentials/i.test(error.message) ? t('Wrong email or password') : error.message, err: true });
    } catch {
      setMsg({ text: t('No internet. The first sign-in on a PC needs a connection; after that the app works offline.'), err: true });
    } finally {
      setBusy(false);
    }
  };
  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ text: t('Enter a valid email'), err: true });
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      setMsg(error ? { text: error.message, err: true } : { text: t('A link to set a new password is on its way to your email.'), err: false });
    } catch {
      setMsg({ text: t('No internet. The first sign-in on a PC needs a connection; after that the app works offline.'), err: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Gate>
      <Title>{t('Sign in')}</Title>
      <Sub>{t('Use the account your admin created for this shop.')}</Sub>
      <label className="flex flex-col gap-1"><Tx className="text-xs text-muted">{t('Email')}</Tx>
        <input className={inputCls} dir="ltr" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value.trim())} autoFocus />
      </label>
      <label className="flex flex-col gap-1"><Tx className="text-xs text-muted">{t('Password')}</Tx>
        <PasswordInput value={pw} onChange={setPw} onEnter={submit} autoComplete="current-password" show={t('Show')} hide={t('Hide')} label={t('Password')} />
      </label>
      <button className={cx(link, 'self-end text-xs')} onClick={forgot} disabled={busy}><Tx>{t('Forgot password?')}</Tx></button>
      {msg && <Msg {...msg} />}
      <button className={primary} onClick={submit} disabled={busy}><Tx>{busy ? t('Please wait…') : t('Sign in')}</Tx></button>
      <div className="flex items-center gap-3 text-muted"><span className="h-px flex-1 bg-stroke" /><Tx className="font-mono text-[11px] tracking-[1.4px] tracking-arabic-safe">{t('OR')}</Tx><span className="h-px flex-1 bg-stroke" /></div>
      <button className={secondary} onClick={onDemo}><Tx>{t('Try the demo')}</Tx></button>
      <span dir="auto" className="text-xs text-muted">{t('Sample shop with mock orders, customers and stock. Nothing is saved to Supabase.')}</span>
    </Gate>
  );
}

/** Shown after the user follows a password-reset email link. */
export function ResetPassword({ i, onDone }: { i: T; onDone: () => void }) {
  const { t } = i;
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const save = async () => {
    if (pw.length < 8) return setMsg({ text: t('Password must be at least 8 characters'), err: true });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ text: error.message, err: true });
    setMsg({ text: t('Password changed.'), err: false });
    setTimeout(onDone, 1000);
  };
  return (
    <Gate>
      <Title>{t('Set a new password')}</Title>
      <label className="flex flex-col gap-1"><Tx className="text-xs text-muted">{t('New password')}</Tx>
        <PasswordInput value={pw} onChange={setPw} onEnter={save} autoComplete="new-password" show={t('Show')} hide={t('Hide')} label={t('New password')} />
      </label>
      {msg && <Msg {...msg} />}
      <button className={primary} onClick={save} disabled={busy}><Tx>{busy ? t('Please wait…') : t('Save new password')}</Tx></button>
    </Gate>
  );
}

// ---------------------------------------------------------------------------
// "Who is at the counter?" — exactly the mockup's card, plus a PIN step for real shops
// ---------------------------------------------------------------------------

export function CounterLogin({ i, staff, demo, myUserId, initialId, onSignedIn, onSetPin, onLeave }: {
  i: T; staff: Staff[]; demo: boolean; myUserId: string | null; initialId?: string | null;
  onSignedIn: (s: Staff) => void; onSetPin: (s: Staff, hash: string, salt: string) => void; onLeave: () => void;
}) {
  const { t, tv } = i;
  const [who, setWho] = useState<Staff | null>(() => (demo ? null : staff.find((s) => s.id === initialId && s.active) ?? null));
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const active = staff.filter((s) => s.active);
  const setting = !!who && !who.pin_hash;
  const fail = (m: string) => { setErr(m); setPin(''); setShake((x) => x + 1); };

  const pick = (u: Staff) => {
    if (demo) { onSignedIn(u); return; } // the demo signs in with one click, like the mockup
    setWho(u); setPin(''); setFirst(''); setErr('');
  };

  const press = async (k: string) => {
    if (busy || !who) return;
    setErr('');
    const next = k === '⌫' ? pin.slice(0, -1) : (pin + k).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    setBusy(true);
    try {
      if (setting) {
        if (!first) { setFirst(next); setPin(''); return; }
        if (first !== next) { setFirst(''); fail(t('PINs did not match. Start again.')); return; }
        if (!pinOk(next)) { fail(t('Choose a 4-digit PIN')); return; }
        const { hash, salt } = await hashPin(next);
        onSetPin(who, hash, salt);
        onSignedIn(who);
      } else if (who.pin_hash && who.pin_salt && (await checkPin(next, who.pin_hash, who.pin_salt))) {
        onSignedIn(who);
      } else {
        fail(t('Wrong PIN'));
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!who) return undefined;
    const kd = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); void press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); void press('⌫'); }
      else if (e.key === 'Escape') setWho(null);
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  });

  const footer = <button className={link} onClick={onLeave}><Tx>{demo ? t('Exit demo') : t('Sign this PC out')}</Tx></button>;

  if (!who) {
    return (
      <Gate footer={footer}>
        <Title>{t('Who is at the counter?')}</Title>
        <Sub>{t('Pick your name to sign in. Your work stays saved on this PC.')}</Sub>
        {active.length === 0 && <Msg text={t('No active users. Ask an admin to activate you.')} err />}
        <div className="-mx-1 flex max-h-[56vh] flex-col gap-3.5 overflow-y-auto px-1">
          {active.map((u) => (
            <button key={u.id} onClick={() => pick(u)}
              className="flex items-center gap-3 rounded-2xl border border-stroke bg-chip px-3 py-2.5 text-start transition-colors duration-200 hover:bg-sel">
              <span className="flex size-[38px] flex-none items-center justify-center rounded-full bg-acc text-xs font-semibold text-on-acc">{initials(tv(u.name))}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold"><Tx>{tv(u.name)}</Tx>{u.user_id && u.user_id === myUserId ? <span className="font-normal text-muted"> · <Tx>{t('you')}</Tx></span> : null}</span>
                <Tx className="text-xs text-muted">{i.role(u.role)}{!demo && !u.pin_hash ? ` · ${t('set a PIN')}` : ''}</Tx>
              </span>
              <span className="text-muted">›</span>
            </button>
          ))}
        </div>
      </Gate>
    );
  }

  return (
    <Gate footer={footer}>
      <div className="flex items-center gap-3 rounded-2xl border border-stroke bg-chip px-3 py-2.5">
        <span className="flex size-[38px] flex-none items-center justify-center rounded-full bg-acc text-xs font-semibold text-on-acc">{initials(tv(who.name))}</span>
        <span className="flex min-w-0 flex-1 flex-col"><Tx className="font-semibold">{tv(who.name)}</Tx><Tx className="text-xs text-muted">{i.role(who.role)}</Tx></span>
        <button className={cx(link, 'text-xs')} onClick={() => setWho(null)}><Tx>{t('Not you?')}</Tx></button>
      </div>
      <Title>{setting ? (first ? t('Type the same PIN again') : t('Choose a 4-digit PIN')) : t('Enter your PIN')}</Title>
      <div key={shake} className={cx('flex justify-center gap-4 py-1', shake > 0 && 'animate-shake')} aria-label={t('{n} of 4 digits', { n: pin.length })}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={cx('size-3.5 rounded-full border border-fg transition-colors duration-150', i < pin.length && 'bg-fg')} />)}
      </div>
      <div className="min-h-5 text-center">{err && <Msg text={err} err />}</div>
      <div className="grid grid-cols-3 gap-1.5" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
          k ? (
            <button key={i} tabIndex={-1} onClick={() => void press(k)} aria-label={k === '⌫' ? t('Delete') : k}
              className="h-[52px] rounded-2xl border border-stroke bg-chip font-mono text-xl font-medium transition-[background-color,transform] hover:bg-sel active:scale-[.97]">{k}</button>
          ) : <span key={i} />
        ))}
      </div>
      {setting && <span dir="auto" className="text-xs text-muted">{t('Keep it private. An admin can reset it under Users.')}</span>}
    </Gate>
  );
}

// ---------------------------------------------------------------------------
// Small states in the same card
// ---------------------------------------------------------------------------

export function GateMessage({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <Gate footer={action}>
      <span className="font-serif text-[32px] leading-[1.1] font-medium">AminZi</span>
      <div className="h-1 w-full overflow-hidden rounded-sm bg-track"><div className="h-full w-1/3 animate-loadbar rounded-sm bg-acc" /></div>
      <Sub>{text}</Sub>
    </Gate>
  );
}

export function ConfigError({ i, message, onDemo }: { i: T; message: string; onDemo: () => void }) {
  const { t } = i;
  return (
    <Gate>
      <Title>{t('Connect Supabase')}</Title>
      <Msg text={t(message)} err />
      <Sub>{t('Open the .env file next to package.json and set:')}</Sub>
      <pre dir="ltr" className="m-0 rounded-2xl border border-stroke bg-chip p-3.5 font-mono text-xs whitespace-pre-wrap">{'VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...'}</pre>
      <span dir="auto" className="text-xs text-muted">{t('Then stop and restart npm run dev. The demo works without it.')}</span>
      <button className={secondary} onClick={onDemo}><Tx>{t('Try the demo')}</Tx></button>
    </Gate>
  );
}
