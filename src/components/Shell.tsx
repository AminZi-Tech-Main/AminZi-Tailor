import { memo, type ReactNode } from 'react';
import { useUI, type Screen } from '../context';
import { useDerived } from '../data/derive';
import { useStore } from '../data/store';
import { ACCENTS, type AccentKey, type IconKey } from '../lib/constants';
import { initials } from '../lib/format';
import type { T } from '../lib/i18n';
import { tk } from '../lib/tk';
import { cx, Icon, Tx } from './bits';
import { LogoMark } from './Logo';
import { BACKDROPS, type Prefs } from './Theme';

export const SCREEN_TITLE: Record<Screen, string> = {
  dashboard: tk('Dashboard'), orders: tk('Orders'), customers: tk('Customers'), fabrics: tk('Fabric stock'), waitlist: tk('Waitlist'),
  perfumes: tk('Perfumes'), users: tk('Users'), settings: tk('Settings'), help: tk('Help'),
};

export function useSyncLabel(i: T) {
  const { t } = i;
  const status = useStore((s) => s.status);
  const pending = useStore((s) => s.outbox.length);
  const failed = useStore((s) => s.failed.length);
  const demo = useStore((s) => s.demo);
  if (demo) return { text: t('Demo · sample data on this PC'), color: '#e8a33d', pulse: true };
  if (failed) return { text: t(failed === 1 ? '1 change needs attention' : '{n} changes need attention', { n: failed }), color: 'var(--danger)', pulse: false };
  if (status.needsSignIn) return { text: t('Sign in again to sync'), color: 'var(--danger)', pulse: false };
  if (!status.online) return { text: pending ? t('Offline · {n} saved on this PC', { n: pending }) : t('Offline · saved on this PC'), color: '#e8a33d', pulse: false };
  if (status.syncing || pending) return { text: pending ? t('Syncing {n}…', { n: pending }) : t('Syncing…'), color: 'var(--acc)', pulse: true };
  if (status.lastError) return { text: t('Sync problem — tap for details'), color: 'var(--danger)', pulse: false };
  return { text: t('Synced · offline-ready'), color: 'var(--acc)', pulse: true };
}

const navHead = 'px-2.5 pb-1 font-mono text-[10px] font-semibold tracking-[1.4px] text-muted tracking-arabic-safe';

/** Floating glass sidebar (Glass mockup). */
export function Sidebar({ prefs, setPrefs }: { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void }) {
  const ui = useUI();
  const d = useDerived();
  const customers = useStore((s) => s.view.customers.length);
  const { t } = ui.i;
  const narrow = !!prefs.narrow;
  const expanded = !prefs.collapsed && !narrow;
  const tailor = ui.me.role === 'Tailor';
  const width = narrow ? 64 : prefs.collapsed ? 84 : 264;

  const item = (key: Screen, icon: IconKey, count?: number) => {
    const on = ui.screen === key;
    const label = t(SCREEN_TITLE[key]);
    return (
      <button key={key} onClick={() => ui.go(key)} title={label} aria-label={expanded ? undefined : label} aria-current={on ? 'page' : undefined}
        className={cx(
          'flex h-10 flex-none items-center gap-3 rounded-[14px] text-start text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-250 ease-out active:scale-[.97]',
          expanded ? 'px-3' : 'justify-center px-0',
          on ? 'act' : 'hover:bg-sel',
        )}>
        <Icon name={icon} />
        {expanded && <Tx className="flex-1 truncate">{label}</Tx>}
        {expanded && count != null && <span className="h-5 min-w-5 rounded-[10px] bg-chip px-1.5 text-center font-mono text-[11px] leading-5 font-semibold">{count}</span>}
      </button>
    );
  };

  return (
    <aside aria-label={t('Main menu')} style={{ width }}
      className={cx('glass sticky top-5 z-20 flex h-[calc(100vh-40px)] flex-none flex-col gap-3.5 overflow-hidden rounded-[30px] transition-[width] duration-500 ease-meadow max-sm:top-2.5 max-sm:h-[calc(100vh-20px)] max-sm:rounded-[22px]',
        narrow ? 'px-2 py-3.5' : 'px-3.5 py-4')}>
      {!narrow && (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <div className="flex gap-1.5 ps-1">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          {expanded && (
            <button aria-label={t('Notifications')} title={t('Notifications')} onClick={() => ui.open({ kind: 'notif' })} className="relative flex rounded-lg p-1 hover:bg-sel">
              <Icon name="bell" size={17} />
              {d.notifs.length > 0 && <span className="absolute -top-1 -right-[5px] h-[15px] min-w-[15px] rounded-lg bg-acc px-[3px] text-center text-[10px] leading-[15px] font-semibold text-on-acc">{d.notifs.length}</span>}
            </button>
          )}
        </div>
      )}
      <div className={cx('flex items-center gap-2.5', expanded ? 'px-1 py-0.5' : 'justify-center')}>
        <LogoMark width={narrow ? 38 : 46} height={narrow ? 35 : 42} style={{ filter: 'drop-shadow(0 6px 14px var(--acc-soft))' }} />
        {expanded && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[17px] leading-[1.1] font-semibold tracking-[-.2px]">AminZi</span>
            <Tx className="truncate text-xs text-muted">{t('Fabrics & Tailors')}</Tx>
          </div>
        )}
      </div>
      {!narrow && (
        <button onClick={() => setPrefs({ collapsed: !prefs.collapsed })} aria-label={prefs.collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
          className="flex h-[26px] items-center gap-1.5 self-start rounded-[13px] border border-stroke bg-glass-strong ps-1.5 pe-2.5 text-xs font-medium transition-transform active:scale-95">
          <span className="flex size-4 items-center justify-center rounded-full bg-fg text-[10px] text-bg transition-transform duration-400 ease-meadow" style={{ transform: `rotate(${prefs.collapsed ? 180 : 0}deg)` }}>‹</span>
          {expanded && <Tx>{t('Collapse')}</Tx>}
        </button>
      )}
      <button onClick={() => ui.open({ kind: 'account' })} title={t('Switch account')}
        className={cx('flex items-center gap-2.5 rounded-[18px] border border-stroke bg-glass-strong text-start transition-transform active:scale-[.98]', expanded ? 'p-2.5' : 'justify-center p-1.5')}>
        <span className="flex size-9 flex-none items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: 'linear-gradient(140deg, var(--acc), #0b0d12)' }}>{initials(ui.i.tv(ui.me.name))}</span>
        {expanded && (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <Tx className="truncate font-semibold">{ui.i.tv(ui.me.name)}</Tx>
              <Tx className="truncate text-[11px] text-muted">{ui.i.role(ui.me.role)} · ⇄ {t('Switch')}</Tx>
            </span>
            <span className="text-muted">›</span>
          </>
        )}
      </button>
      {expanded ? (
        <button onClick={() => ui.open({ kind: 'search' })}
          className="flex h-[34px] items-center gap-2 rounded-[17px] border border-stroke bg-field px-3 text-start font-mono text-[11px] font-medium tracking-[1.2px] text-muted tracking-arabic-safe">
          <Icon name="search" size={13} />
          <Tx className="flex-1">{t('SEARCH…')}</Tx>
          <span className="opacity-70">/</span>
        </button>
      ) : (
        <button aria-label={t('Search')} title={t('Search')} onClick={() => ui.open({ kind: 'search' })} className="flex h-9 items-center justify-center rounded-[14px] hover:bg-sel"><Icon name="search" /></button>
      )}
      <nav className="-mx-2.5 flex min-h-0 flex-1 flex-col gap-3.5 overflow-x-hidden overflow-y-auto px-2.5 py-1">
        <div className="flex flex-col gap-[3px]">
          {expanded && <Tx className={navHead}>{t('MENU')}</Tx>}
          {item('dashboard', 'dashboard')}
          {item('orders', 'orders', d.active.length)}
          {item('customers', 'customers', customers)}
          {item('fabrics', 'fabrics')}
          {item('waitlist', 'waitlist')}
        </div>
        {!tailor && (
          <div className="flex flex-col gap-[3px]">
            {expanded && <Tx className={navHead}>{t('MANAGEMENT')}</Tx>}
            {item('perfumes', 'perfumes')}
            {ui.isAdmin && item('users', 'users')}
          </div>
        )}
        <div className="flex flex-col gap-[3px]">
          {expanded && <Tx className={navHead}>{t('GENERAL')}</Tx>}
          {ui.isAdmin && item('settings', 'settings')}
          {item('help', 'help')}
          <button onClick={ui.signOutCounter} title={t('Log out')} aria-label={expanded ? undefined : t('Log out')}
            className={cx('flex h-10 flex-none items-center gap-3 rounded-[14px] text-sm font-medium whitespace-nowrap text-muted hover:bg-sel hover:text-fg', expanded ? 'px-3' : 'justify-center')}>
            <Icon name="logout" />
            {expanded && <Tx>{t('Log out')}</Tx>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

/** Header: breadcrumb + date, the magnifying quick-action dock, sync pill. */
export function TopBar() {
  const ui = useUI();
  const { t } = ui.i;
  const sync = useSyncLabel(ui.i);
  const dates = ui.i.header();
  const quick: { label: string; icon: IconKey; go: () => void }[] = [
    { label: t('New order (N)'), icon: 'plus', go: () => ui.open({ kind: 'order' }) },
    { label: t('Take measurements (M)'), icon: 'ruler', go: () => ui.open({ kind: 'measure' }) },
    ...(ui.me.role !== 'Tailor' ? [{ label: t('Add fabric roll'), icon: 'roll' as IconKey, go: () => ui.open({ kind: 'roll' }) }] : []),
    { label: t('Print last receipt'), icon: 'printer', go: () => window.dispatchEvent(new CustomEvent('aminzi:print-last')) },
    { label: t('Search (/)'), icon: 'search', go: () => ui.open({ kind: 'search' }) },
  ];
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-4 max-sm:gap-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Tx className="truncate font-mono text-[11px] font-medium tracking-[1.4px] text-muted uppercase tracking-arabic-safe">
          {ui.i.tv(ui.shop.name)} / {t(SCREEN_TITLE[ui.screen])}
        </Tx>
        <span dir="auto" className="font-medium">{dates.main} <span className="text-muted">·</span> <span dir="ltr" className="font-mono text-xs text-muted">{dates.sub}</span></span>
      </div>
      <div className="glass mx-auto flex items-end gap-2 rounded-[22px] px-2.5 py-2 max-sm:mx-0 max-sm:gap-1.5 max-sm:px-2">
        {quick.map((q) => (
          <button key={q.icon} onClick={q.go} title={q.label} aria-label={q.label}
            className="flex size-11 origin-bottom items-center justify-center rounded-[14px] border border-stroke bg-chip transition-[transform,background-color,color] duration-350 ease-bounce hover:-translate-y-[5px] hover:scale-[1.16] hover:bg-acc hover:text-on-acc active:-translate-y-0.5 active:scale-[1.04] max-sm:size-10">
            <Icon name={q.icon} />
          </button>
        ))}
      </div>
      <button onClick={() => ui.open({ kind: 'sync' })} title={t('Sync details')}
        className="glass flex h-[34px] items-center gap-2 rounded-[17px] px-3.5 text-xs font-medium whitespace-nowrap max-md:hidden">
        <span className={cx('dot', sync.pulse && 'pulse-ring')} style={{ background: sync.color }} /><Tx>{sync.text}</Tx>
      </button>
    </header>
  );
}

/** Bottom-right dock: backdrops, accent swatches and the Motion switch (Glass mockup + Motion). */
export const ThemeDock = memo(function ThemeDock({ prefs, setPrefs, t }: { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; t: T['t'] }) {
  return (
    <div dir="ltr" className="glass-strong fixed right-5 bottom-5 z-30 flex flex-wrap items-center gap-2.5 rounded-3xl px-2.5 py-2 max-sm:right-2.5 max-sm:bottom-2.5 max-sm:hidden">
      <div className="flex gap-0.5">
        {BACKDROPS.map((b) => (
          <button key={b} aria-pressed={prefs.backdrop === b} onClick={() => setPrefs({ backdrop: b })}
            className="h-7 rounded-[14px] px-[11px] text-xs font-medium transition-colors duration-200 aria-pressed:bg-acc aria-pressed:text-on-acc">
            <Tx>{t(b)}</Tx>
          </button>
        ))}
      </div>
      <span className="h-[18px] w-px bg-stroke" />
      <div className="flex gap-1.5">
        {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
          <button key={k} title={t(ACCENTS[k].name)} aria-label={t('{name} accent', { name: t(ACCENTS[k].name) })} aria-pressed={prefs.accent === k} onClick={() => setPrefs({ accent: k })}
            className="size-5 rounded-full transition-[transform,box-shadow] duration-200 hover:scale-[1.18]"
            style={{ background: ACCENTS[k].acc, boxShadow: `0 0 0 2px var(--bg), 0 0 0 ${prefs.accent === k ? 4 : 0}px ${ACCENTS[k].acc}` }} />
        ))}
      </div>
      <span className="h-[18px] w-px bg-stroke" />
      <button aria-pressed={prefs.motion} onClick={() => setPrefs({ motion: !prefs.motion })}
        title={t('Moving background. Turn off if this PC feels slow.')}
        className="h-7 rounded-[14px] px-[11px] text-xs font-medium transition-colors duration-200 aria-pressed:bg-acc aria-pressed:text-on-acc">
        <Tx>{t('Motion')}</Tx>
      </button>
    </div>
  );
});

export function PageHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex animate-enter flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="h-page"><Tx>{title}</Tx></h1>
        {sub && <Tx className="text-muted">{sub}</Tx>}
      </div>
      {action}
    </div>
  );
}

export function AccBtn({ children, onClick, className = '' }: { children: ReactNode; onClick: () => void; className?: string }) {
  return <button className={`btn btn-acc ${className}`} onClick={onClick}><Tx>{children}</Tx></button>;
}

/** Glass section with a header row (title left, action right). */
export function Panel({ title, action, children, className, bodyClass = 'p-2' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('card overflow-hidden', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-stroke px-[18px] py-3.5 font-semibold">
          <Tx>{title}</Tx>{action}
        </div>
      )}
      <div className={cx('flex flex-col', bodyClass)}>{children}</div>
    </section>
  );
}
