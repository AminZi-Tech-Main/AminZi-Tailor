import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ACCENTS, type AccentKey } from '../lib/constants';
import { tk } from '../lib/tk';

export type Backdrop = 'Silk' | 'Dusk' | 'Alpine' | 'Pearl';
export const BACKDROPS: Backdrop[] = [tk('Silk'), tk('Dusk'), tk('Alpine'), tk('Pearl')];

export interface Prefs {
  backdrop: Backdrop;
  accent: AccentKey;
  /** Moving backdrop + parallax. Off by default: it costs the most on older counter PCs. */
  motion: boolean;
  collapsed: boolean;
  narrow?: boolean;
}

const KEY = 'aminzi:prefs';
const defaults: Prefs = { backdrop: 'Silk', accent: 'teal', motion: false, collapsed: false };

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs>;
    return {
      backdrop: BACKDROPS.includes(raw.backdrop as Backdrop) ? (raw.backdrop as Backdrop) : defaults.backdrop,
      accent: raw.accent && raw.accent in ACCENTS ? raw.accent : defaults.accent,
      motion: raw.motion === true,
      collapsed: raw.collapsed === true,
    };
  } catch {
    return defaults;
  }
}

/** Per-counter look & feel. Lives in this browser only. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const set = (p: Partial<Prefs>) => setPrefs((x) => {
    const { narrow: _n, ...next } = { ...x, ...p };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  return [prefs, set] as const;
}

/** Colour tokens — exactly the Glass mockup's theme(): Pearl is the light backdrop, the rest are dark. */
export function themeVars(prefs: Prefs): Record<string, string> {
  const a = ACCENTS[prefs.accent] ?? ACCENTS.teal;
  const light = prefs.backdrop === 'Pearl';
  const base = light ? {
    '--bg': '#eeece7', '--fg': '#14161b', '--muted': 'rgba(20,22,27,.64)', '--glass': 'rgba(255,255,255,.42)', '--glass-strong': 'rgba(255,255,255,.7)', '--stroke': 'rgba(20,22,40,.07)',
    '--hi': 'inset 0 1px 0 rgba(255,255,255,.9)', '--drop': '0 24px 50px -28px rgba(40,40,70,.28)', '--track': 'rgba(20,22,27,.09)', '--sel': 'rgba(255,255,255,.7)', '--chip': 'rgba(255,255,255,.5)',
    '--danger': '#c0262d', '--logo-ink': '#1b2a4a', '--input': 'rgba(255,255,255,.6)', '--acc-ink': a.inkLight, '--scrim': 'rgba(30,30,50,.18)', '--card-bg': 'rgba(255,255,255,.55)', '--card-fg': '#14161b',
  } : {
    '--bg': '#07080b', '--fg': '#f3f5f9', '--muted': 'rgba(243,245,249,.64)', '--glass': 'rgba(255,255,255,.06)', '--glass-strong': 'rgba(22,24,30,.72)', '--stroke': 'rgba(255,255,255,.07)',
    '--hi': 'inset 0 1px 0 rgba(255,255,255,.1)', '--drop': '0 30px 60px -30px rgba(0,0,0,.7)', '--track': 'rgba(255,255,255,.1)', '--sel': 'rgba(255,255,255,.07)', '--chip': 'rgba(255,255,255,.05)',
    '--danger': '#ff6b6b', '--logo-ink': '#e9eef5', '--input': 'rgba(0,0,0,.22)', '--acc-ink': a.inkDark, '--scrim': 'rgba(0,0,0,.45)', '--card-bg': `linear-gradient(165deg, ${a.acc} -40%, rgba(20,22,30,.55) 70%)`, '--card-fg': '#ffffff',
  };
  return {
    ...base,
    '--acc': a.acc, '--btn-fg': a.on,
    '--act-sh': `0 10px 30px -10px ${a.acc}bb, inset 0 1px 0 rgba(255,255,255,.3)`,
    '--btn-sh': `0 10px 30px -12px ${a.acc}cc, inset 0 1px 0 rgba(255,255,255,.3)`,
    '--card-glow': `0 30px 80px -24px ${a.acc}aa`,
    '--acc-soft': `${a.acc}30`, '--inset': 'none', '--blur': 'blur(30px) saturate(170%)',
  };
}

/**
 * Applies the theme tokens once per change (never on mouse move — writing CSS variables on the
 * app root makes the browser restyle every element, which is what made the old build slow).
 */
export function ThemeRoot({ prefs, children }: { prefs: Prefs; children: ReactNode }) {
  const vars = useMemo(() => themeVars(prefs), [prefs.accent, prefs.backdrop]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const root = document.documentElement;
    for (const k of ['--bg', '--fg', '--acc', '--acc-ink', '--btn-fg', '--scrim', '--glass-strong', '--stroke', '--logo-ink']) root.style.setProperty(k, vars[k]);
    root.style.colorScheme = prefs.backdrop === 'Pearl' ? 'light' : 'dark';
    document.body.style.background = vars['--bg'];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg']);
  }, [vars, prefs.backdrop]);

  return (
    <div dir="ltr" style={vars as CSSProperties} data-motion={prefs.motion ? 'on' : 'off'}
      className="relative min-h-screen overflow-x-clip bg-bg font-sans text-sm text-fg transition-[background-color] duration-600">
      <GlassBackdrop backdrop={prefs.backdrop} motion={prefs.motion} />
      {children}
    </div>
  );
}

/**
 * The aurora behind the glass. Static unless Motion is on; then it drifts slowly and follows the
 * mouse (transform on this one layer only, batched to one write per frame).
 */
export const GlassBackdrop = memo(function GlassBackdrop({ backdrop, motion }: { backdrop: Backdrop; motion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!motion || !window.matchMedia('(pointer:fine)').matches) return undefined;
    let raf = 0;
    let x = 0;
    let y = 0;
    const mm = (e: MouseEvent) => {
      x = e.clientX / window.innerWidth - 0.5;
      y = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (ref.current) ref.current.style.transform = `translate3d(${x * -28}px, ${y * -22}px, 0)`; });
    };
    window.addEventListener('mousemove', mm, { passive: true });
    return () => { window.removeEventListener('mousemove', mm); cancelAnimationFrame(raf); if (ref.current) ref.current.style.transform = ''; };
  }, [motion]);

  const blob = (cls: string, style: CSSProperties) => <div className={`absolute rounded-full ${cls}`} style={style} />;
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none fixed -inset-[60px] z-0 overflow-hidden transition-transform duration-900 ease-[cubic-bezier(.2,.8,.2,1)]">
      {backdrop === 'Silk' && (
        <>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 70% 10%, #1a1d24 0%, #07080b 60%)' }} />
          {blob('bd-spin', { width: 1400, height: 1400, left: '30%', top: '-45%', background: 'repeating-conic-gradient(from 10deg, rgba(255,255,255,0) 0deg 9deg, rgba(255,255,255,.11) 15deg, rgba(255,255,255,0) 24deg)', filter: 'blur(14px)' })}
          {blob('bd-spin-rev', { width: 1100, height: 1100, left: '-20%', top: '25%', background: 'repeating-conic-gradient(from 80deg, rgba(255,255,255,0) 0deg 12deg, rgba(255,255,255,.08) 19deg, rgba(0,0,0,0) 28deg)', filter: 'blur(20px)' })}
          {blob('bd-drift', { width: 760, height: 760, left: '-8%', top: '-20%', background: 'radial-gradient(circle, var(--acc) 0%, transparent 62%)', opacity: 0.32, filter: 'blur(60px)' })}
          {blob('bd-drift2', { width: 620, height: 620, right: '-6%', bottom: '-14%', background: 'radial-gradient(circle, var(--acc) 0%, transparent 60%)', opacity: 0.2, filter: 'blur(70px)' })}
        </>
      )}
      {backdrop === 'Dusk' && (
        <>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 70% at 50% 40%, #1c0710 0%, #0a0205 70%)' }} />
          {blob('bd-drift', { width: 900, height: 900, left: '-18%', top: '-30%', background: 'radial-gradient(circle, var(--acc) 0%, transparent 60%)', opacity: 0.55, filter: 'blur(50px)' })}
          {blob('bd-drift2', { width: 1000, height: 1000, right: '-22%', bottom: '-40%', background: 'radial-gradient(circle, var(--acc) 0%, transparent 58%)', opacity: 0.5, filter: 'blur(60px)' })}
          {blob('', { width: 1500, height: 1500, left: '15%', top: '-30%', border: '1px solid rgba(255,255,255,.06)' })}
        </>
      )}
      {backdrop === 'Alpine' && (
        <>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #2a3f62 30%, #7a8fb0 50%, #e3b892 58%, #2a3550 60%, #15203a 100%)' }} />
          <div className="absolute inset-x-0 top-[18%] h-[42%]" style={{ background: 'linear-gradient(180deg, #f2f4f8 0%, #8d9bb4 22%, #3a4766 60%, #1d2740 100%)', clipPath: 'polygon(0 100%, 0 70%, 8% 52%, 14% 60%, 24% 30%, 30% 40%, 38% 12%, 44% 26%, 50% 4%, 57% 30%, 63% 22%, 72% 48%, 80% 36%, 88% 58%, 94% 50%, 100% 64%, 100% 100%)' }} />
          <div className="absolute inset-x-0 top-[34%] h-[26%]" style={{ background: 'linear-gradient(180deg, #4b5a7a 0%, #1a2238 100%)', clipPath: 'polygon(0 100%, 0 60%, 12% 40%, 22% 62%, 34% 30%, 46% 58%, 60% 36%, 70% 60%, 82% 44%, 92% 66%, 100% 50%, 100% 100%)' }} />
          <div className="absolute inset-x-0 top-[60%] h-[42%] opacity-55 blur-[3px]" style={{ background: 'linear-gradient(180deg, #1d2740 0%, #3a4766 30%, #6a7b9c 60%, #1a2236 100%)', clipPath: 'polygon(0 0, 0 30%, 8% 48%, 14% 40%, 24% 70%, 30% 60%, 38% 88%, 44% 74%, 50% 96%, 57% 70%, 63% 78%, 72% 52%, 80% 64%, 88% 42%, 94% 50%, 100% 36%, 100% 0)' }} />
          <div className="bd-drift absolute -inset-x-[10%] top-[52%] h-[14%] blur-[24px]" style={{ background: 'linear-gradient(180deg, transparent, rgba(220,228,240,.35), transparent)' }} />
        </>
      )}
      {backdrop === 'Pearl' && (
        <>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #f6f4ef 0%, #ebe7df 55%, #e4e7ee 100%)' }} />
          {blob('bd-drift', { width: 900, height: 900, left: '-12%', top: '-30%', background: 'radial-gradient(circle, var(--acc) 0%, transparent 62%)', opacity: 0.28, filter: 'blur(70px)' })}
          {blob('bd-drift2', { width: 800, height: 800, right: '-10%', bottom: '-30%', background: 'radial-gradient(circle, #ffffff 0%, transparent 60%)', opacity: 0.9, filter: 'blur(40px)' })}
          {blob('bd-drift', { width: 520, height: 520, left: '42%', top: '30%', background: 'radial-gradient(circle, #d9c3a5 0%, transparent 62%)', opacity: 0.45, filter: 'blur(60px)' })}
        </>
      )}
    </div>
  );
});
