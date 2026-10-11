import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ConfigError, CounterLogin, GateMessage, rememberLang, ResetPassword, savedLang, SignIn } from './auth/Login';
import { cx, Tx } from './components/bits';
import { Splash } from './components/Logo';
import { Sidebar, ThemeDock, TopBar } from './components/Shell';
import { ThemeRoot, usePrefs, type Prefs } from './components/Theme';
import { UICtx, type Screen, type Sheet, type UI } from './context';
import { updateStaff } from './data/actions';
import { DEMO_SHOP_ID } from './data/demo';
import { derivedFor } from './data/derive';
import { closeShop, getState, openDemo, openShop, useStore } from './data/store';
import { htmlLang, makeT } from './lib/i18n';
import { tk } from './lib/tk';
import { configError, supabase } from './lib/supabase';
import type { Lang, Staff } from './lib/types';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Help, Settings, Users } from './pages/Admin';
import { Orders, Waitlist } from './pages/Orders';
import { Fabrics, Perfumes } from './pages/Stock';
import { printJob, type PrintJob } from './print/Print';
import { MeasureForm, OrderDetail, OrderForm } from './sheets/OrderSheets';
import { AccountSwitch, Notifications, PerfumeForm, RollForm, SearchPop, SyncPanel, UserForm } from './sheets/OtherSheets';
import { CashForm, MoneyHistory } from './sheets/MoneySheets';

// ---------------------------------------------------------------------------
// Root: demo | Supabase sign-in → shop → "Who is at the counter?"
// ---------------------------------------------------------------------------

function useNarrow() {
  const q = '(max-width: 900px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setNarrow(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return narrow;
}

const DEMO_FLAG = 'aminzi:demo';
const SPLASH_FLAG = 'aminzi:splash';

export function Root() {
  const [savedPrefs, setPrefs] = usePrefs();
  const narrow = useNarrow();
  // On tablets and phones the menu stays as an icon rail so the content has room.
  const prefs = narrow ? { ...savedPrefs, collapsed: true, narrow: true } : savedPrefs;
  const [lang, setLang] = useState<Lang>(savedLang);
  const [demo, setDemo] = useState<'fresh' | 'resume' | null>(() => (sessionStorage.getItem(DEMO_FLAG) ? 'resume' : null));
  // The logo animation plays once per browser session, not on every reload.
  const [splash, setSplash] = useState(() => { try { return !sessionStorage.getItem(SPLASH_FLAG); } catch { return false; } });
  useEffect(() => {
    if (!splash) return undefined;
    try { sessionStorage.setItem(SPLASH_FLAG, '1'); } catch { /* private mode */ }
    const t = setTimeout(() => setSplash(false), 2700);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.lang = htmlLang(lang); }, [lang]);
  const i = useMemo(() => makeT(lang), [lang]);

  const startDemo = () => { sessionStorage.setItem(DEMO_FLAG, '1'); setDemo('fresh'); };
  const exitDemo = () => { sessionStorage.removeItem(DEMO_FLAG); sessionStorage.removeItem(`aminzi:me:${DEMO_SHOP_ID}`); closeShop(); setDemo(null); };
  const onLang = (l: Lang) => { setLang(l); rememberLang(l); };

  return (
    <ThemeRoot prefs={prefs}>
      {demo
        ? <ShopApp shopId={DEMO_SHOP_ID} demo={demo} lang={lang} onLang={onLang} myUserId={null} onLeave={exitDemo} prefs={prefs} setPrefs={setPrefs} />
        : configError
          ? <ConfigError i={i} message={configError} onDemo={startDemo} />
          : <AuthFlow lang={lang} onLang={onLang} onDemo={startDemo} prefs={prefs} setPrefs={setPrefs} />}
      {splash && <Splash tagline={i.t('AminZi · Solutions fit to your needs')} />}
    </ThemeRoot>
  );
}

function AuthFlow({ lang, onLang, onDemo, prefs, setPrefs }: {
  lang: Lang; onLang: (l: Lang) => void; onDemo: () => void; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
}) {
  const i = useMemo(() => makeT(lang), [lang]);
  const { t } = i;
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [shopId, setShopId] = useState<string | null | undefined>(undefined);
  const [offlineNoShop, setOfflineNoShop] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setShopId(undefined); return; }
    const key = `aminzi:member:${userId}`;
    const cached = localStorage.getItem(key);
    if (cached) setShopId(cached);
    void supabase.from('shop_members').select('shop_id').eq('user_id', userId).limit(1).then(({ data, error }) => {
      if (error) { if (!cached) setOfflineNoShop(true); return; }
      const id = (data?.[0]?.shop_id as string | undefined) ?? null;
      if (id) localStorage.setItem(key, id); else localStorage.removeItem(key);
      setOfflineNoShop(false);
      setShopId(id);
    });
  }, [userId]);

  const signOutPc = async () => {
    if (getState().outbox.length) {
      window.dispatchEvent(new CustomEvent('aminzi:toast', { detail: { msg: t('{n} changes are still waiting to sync. Connect to the internet first.', { n: getState().outbox.length }), err: true } }));
      return;
    }
    closeShop();
    if (userId) localStorage.removeItem(`aminzi:member:${userId}`);
    await supabase.auth.signOut();
  };
  const leave = <button className="btn-link" onClick={() => void signOutPc()}><Tx>{t('Sign this PC out')}</Tx></button>;

  if (session === undefined) return null;
  if (recovery && session) return <ResetPassword i={i} onDone={() => setRecovery(false)} />;
  if (!session) return <SignIn i={i} onDemo={onDemo} />;
  if (offlineNoShop) return <GateMessage text={t('Can’t reach Supabase. This PC needs internet once to download the shop.')} action={leave} />;
  if (shopId === undefined) return <GateMessage text={t('Opening the shop…')} />;
  if (shopId === null) return <GateMessage text={t('This account is not linked to the shop. Run supabase/migrations/…_init.sql in the Supabase SQL Editor, then sign in again.')} action={leave} />;
  return <ShopApp shopId={shopId} demo={null} lang={lang} onLang={onLang} myUserId={userId ?? null} onLeave={() => void signOutPc()} prefs={prefs} setPrefs={setPrefs} />;
}

// ---------------------------------------------------------------------------
// The shop app
// ---------------------------------------------------------------------------

const ADMIN_ONLY: Screen[] = ['users', 'settings'];

function ShopApp({ shopId, demo, lang, onLang, myUserId, onLeave, prefs, setPrefs }: {
  shopId: string; demo: 'fresh' | 'resume' | null; lang: Lang; onLang: (l: Lang) => void; myUserId: string | null;
  onLeave: () => void; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
}) {
  useEffect(() => {
    if (demo) void openDemo(demo === 'fresh'); else void openShop(shopId);
    return () => closeShop();
  }, [shopId, demo]);
  const loaded = useStore((s) => s.loaded);
  const view = useStore((s) => s.view);
  const online = useStore((s) => s.status.online);
  const shop = view.shop;

  const meKey = `aminzi:me:${shopId}`;
  const [meId, setMeId] = useState<string | null>(() => (demo === 'fresh' ? null : sessionStorage.getItem(meKey)));
  const me = view.staff.find((s) => s.id === meId && s.active) ?? null;
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; err: boolean; id: number } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState('All');
  const [preselect, setPreselect] = useState<string | null>(null);

  const i = derivedFor(view).i; // same translator the derived data used
  const { t } = i;
  // Re-render once just after midnight so "Today", the header date and due labels roll over.
  const [, setDay] = useState(0);
  useEffect(() => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime() - now.getTime();
    const tm = setTimeout(() => setDay((x) => x + 1), ms);
    return () => clearTimeout(tm);
  });
  // The sign-in card speaks the shop's language next time too.
  useEffect(() => { if (shop?.lang && shop.lang !== lang) onLang(shop.lang); }, [shop?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const toast = useCallback((msg: string, err = false) => {
    const id = Date.now();
    setToastMsg({ msg, err, id });
    setTimeout(() => setToastMsg((t) => (t?.id === id ? null : t)), err ? 4000 : 2400);
  }, []);
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail; toast(d.msg, d.err); };
    window.addEventListener('aminzi:toast', h);
    return () => window.removeEventListener('aminzi:toast', h);
  }, [toast]);

  const signIn = (staffId: string) => {
    sessionStorage.setItem(meKey, staffId);
    setMeId(staffId);
    updateStaff(staffId, { last_seen: new Date().toISOString() });
    const u = view.staff.find((s) => s.id === staffId);
    if (u) toast(t('Welcome back, {name}', { name: i.tv(u.name) }));
  };
  const signOutCounter = () => { sessionStorage.removeItem(meKey); setMeId(null); setSheet(null); setScreen('dashboard'); };

  const print = useCallback((job: PrintJob) => {
    try { printJob(job, i); } catch { toast(i.t('Printing failed'), true); }
  }, [toast, i]);

  // Until someone picks their name, the app is drawn (inert) behind the sign-in card — as in the mockup.
  const viewer: Staff | null = me ?? view.staff.find((s) => s.role === 'Admin' && s.active) ?? view.staff[0] ?? null;

  const ui: UI | null = shop && viewer ? {
    screen,
    go: (s, extra) => {
      if (ADMIN_ONLY.includes(s) && viewer.role !== 'Admin') return;
      if (extra?.customerId) setCustomerId(extra.customerId);
      if (extra?.filter) setOrderFilter(extra.filter);
      setScreen(s); setSheet(null); window.scrollTo({ top: 0 });
    },
    sheet, open: setSheet, close: () => setSheet(null), toast, print,
    me: viewer, isAdmin: viewer.role === 'Admin', shop, cal: shop.calendar, i, demo: !!demo,
    customerId, setCustomerId, orderFilter, setOrderFilter,
    signOutCounter,
    switchTo: (id) => { if (id === viewer.id) { setSheet(null); return; } setPreselect(id); signOutCounter(); },
  } : null;

  // Keyboard shortcuts (only once someone is signed in at the counter)
  useEffect(() => {
    if (!ui || !me) return undefined;
    const kd = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSheet({ kind: 'search' }); return; }
      if (e.key === 'Escape') { setSheet(null); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setSheet({ kind: 'search' }); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setSheet({ kind: 'order' }); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setSheet({ kind: 'measure' }); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [ui !== null, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Print last receipt" from the top bar
  useEffect(() => {
    if (!ui || !me) return undefined;
    const h = () => {
      const d = derivedFor(getState().view);
      const last = d.orders[0];
      if (!last) { toast(t('No orders yet')); return; }
      print({ kind: 'receipt', order: last, payments: getState().view.payments.filter((p) => p.order_id === last.id), shop: shop!, cashier: me.name });
    };
    window.addEventListener('aminzi:print-last', h);
    return () => window.removeEventListener('aminzi:print-last', h);
  });

  if (!loaded || !shop) {
    const L = makeT(lang);
    return <GateMessage text={online ? L.t('Downloading the shop…') : L.t('Offline, and this PC has no saved copy of the shop yet. Connect once to download it.')} />;
  }
  if (!ui) {
    return (
      <CounterLogin i={i} staff={view.staff} demo={!!demo} myUserId={myUserId} initialId={preselect}
        onSignedIn={(s) => { setPreselect(null); signIn(s.id); }} onSetPin={(s, hash, salt) => updateStaff(s.id, { pin_hash: hash, pin_salt: salt })} onLeave={onLeave} />
    );
  }

  const page = (() => {
    const s = ADMIN_ONLY.includes(screen) && !ui.isAdmin ? 'dashboard' : screen;
    switch (s) {
      case 'orders': return <Orders />;
      case 'customers': return <Customers />;
      case 'fabrics': return <Fabrics />;
      case 'waitlist': return <Waitlist />;
      case 'perfumes': return <Perfumes />;
      case 'users': return <Users />;
      case 'settings': return <Settings />;
      case 'help': return <Help />;
      default: return <Dashboard />;
    }
  })();

  const titles: Record<string, string> = { order: tk('New order'), measure: tk('Take measurements'), roll: tk('Add fabric roll'), perfume: tk('Add perfume'), notif: tk('Notifications'), account: tk('Switch account'), sync: tk('Sync'), money: tk('Money in and out') };
  const sheetTitle = sheet?.kind === 'detail' ? view.orders.find((o) => o.id === sheet.orderId)?.code ?? ''
    : sheet?.kind === 'user' ? t(sheet.staffId ? 'Edit user' : 'Add user')
      : sheet?.kind === 'cash' ? t(sheet.direction === 'in' ? 'Money in' : 'Money out')
      : sheet ? t(titles[sheet.kind] ?? '') : '';

  return (
    <UICtx.Provider value={ui}>
      <div ref={(el) => { if (el) { if (me) el.removeAttribute('inert'); else el.setAttribute('inert', ''); } }} aria-hidden={me ? undefined : true}>
        <div className="relative z-[1] flex min-h-screen gap-5 p-5 max-sm:gap-2.5 max-sm:p-2.5">
          <Sidebar prefs={prefs} setPrefs={setPrefs} />
          <main className="flex min-w-0 flex-1 flex-col gap-5 pb-20" key={screen}>
            <TopBar />
            {page}
          </main>
        </div>
        <ThemeDock prefs={prefs} setPrefs={setPrefs} t={t} />

        {sheet && sheet.kind !== 'search' && (
          <>
            <div className="fixed inset-0 z-50 animate-fade bg-scrim" onClick={() => setSheet(null)} />
            <aside role="dialog" aria-modal="true" aria-label={sheetTitle} key={sheet.kind + (sheet.kind === 'detail' ? sheet.orderId : '')}
              className="sheet fixed top-4 end-4 bottom-4 z-51 flex w-[min(480px,calc(100vw-32px))] animate-sheet flex-col overflow-hidden rounded-[28px] border border-stroke bg-glass-strong max-sm:top-2.5 max-sm:end-2.5 max-sm:bottom-2.5 max-sm:w-[calc(100vw-20px)]">
              <div className="flex flex-none items-center gap-3 border-b border-stroke px-[18px] py-4">
                <Tx className="flex-1 truncate font-serif text-[22px] font-medium">{sheetTitle}</Tx>
                <span className="font-mono text-[11px] font-medium text-muted">ESC</span>
                <button aria-label={t('Close')} onClick={() => setSheet(null)} className="size-[34px] rounded-full border border-stroke bg-chip text-base transition-transform active:scale-90">✕</button>
              </div>
              {sheet.kind === 'detail' && <OrderDetail orderId={sheet.orderId} initialTab={sheet.tab} />}
              {sheet.kind === 'order' && <OrderForm preset={sheet.preset} />}
              {sheet.kind === 'measure' && <MeasureForm customerId={sheet.customerId} startNew={sheet.startNew} />}
              {sheet.kind === 'roll' && <RollForm />}
              {sheet.kind === 'perfume' && <PerfumeForm />}
              {sheet.kind === 'user' && <UserForm staffId={sheet.staffId} />}
              {sheet.kind === 'notif' && <Notifications />}
              {sheet.kind === 'account' && <AccountSwitch />}
              {sheet.kind === 'sync' && <SyncPanel />}
              {sheet.kind === 'cash' && <CashForm direction={sheet.direction} />}
              {sheet.kind === 'money' && <MoneyHistory />}
            </aside>
          </>
        )}
        {sheet?.kind === 'search' && <SearchPop />}
      </div>

      {!me && (
        <CounterLogin i={i} staff={view.staff} demo={!!demo} myUserId={myUserId} initialId={preselect}
          onSignedIn={(s) => { setPreselect(null); signIn(s.id); }} onSetPin={(s, hash, salt) => updateStaff(s.id, { pin_hash: hash, pin_salt: salt })} onLeave={onLeave} />
      )}
      {toastMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[26px] z-80 flex justify-center px-4">
          <div role={toastMsg.err ? 'alert' : 'status'} key={toastMsg.id}
            className={cx('toast glass-strong flex max-w-full animate-toast items-center gap-2.5 rounded-[22px] px-[18px] py-3 font-medium', toastMsg.err && 'text-danger')}>
            <span className="dot" style={{ background: toastMsg.err ? 'var(--danger)' : 'var(--acc)' }} /><Tx className="truncate">{toastMsg.msg}</Tx>
          </div>
        </div>
      )}
    </UICtx.Provider>
  );
}
