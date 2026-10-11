import type { CSSProperties, ReactNode } from 'react';
import { ICONS, type IconKey } from '../lib/constants';
import { initials } from '../lib/format';

/** Join class names, skipping falsy values. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Icon({ name, size = 18, className, style }: { name: IconKey; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cx('flex-none', className)} style={style} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Avatar({ name, size = 36, acc = false, serif = false, className }: { name: string; size?: number; acc?: boolean; serif?: boolean; className?: string }) {
  return (
    <span className={cx('avatar', acc && 'border-0 bg-acc text-on-acc', className)}
      style={{ width: size, height: size, font: serif ? `500 ${Math.round(size * 0.38)}px var(--font-serif)` : undefined }}>
      {initials(name)}
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="dot" style={{ width: size, height: size, background: color }} />;
}

/** Rounded progress bar. */
export function Bar({ pct, color = 'var(--acc)', h = 6 }: { pct: string; color?: string; h?: number }) {
  return (
    <div className="w-full bg-track" style={{ height: h, borderRadius: h / 2 }}>
      <div className="h-full transition-[width] duration-600 ease-meadow" style={{ width: pct, background: color, borderRadius: h / 2 }} />
    </div>
  );
}

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={onClick} dir="ltr"
      className={cx('relative h-6 w-10 flex-none rounded-xl transition-colors duration-250', on ? 'bg-acc' : 'bg-track')}>
      <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.25)] transition-[left] duration-300 ease-meadow', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

/** Dari/Pashto text keeps its own direction inside the left-to-right layout. */
export function Tx({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <span dir="auto" className={className} style={style}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="h-[26px] min-w-7 rounded-lg border border-stroke bg-chip px-2 text-center font-mono text-xs leading-6 font-medium">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div dir="auto" className="px-[18px] py-6 text-[13px] text-muted">{children}</div>;
}

/**
 * An amount in afghani: "؋ 52,610". The sign is isolated so it stays in front of the number
 * (the Afghani sign is a right-to-left character and would otherwise jump behind it).
 */
export function Afn({ value, sign, className }: { value: string; sign?: '+' | '−'; className?: string }) {
  return (
    <span dir="ltr" className={cx('whitespace-nowrap', className)}>
      {sign && `${sign} `}<span className="me-[.3em] text-[.62em] opacity-70 [unicode-bidi:isolate]">؋</span>{value}
    </span>
  );
}

/** "N" / "M" key hint inside a button. */
export function KeyHint({ k, dim = 0.6 }: { k: string; dim?: number }) {
  return <span className="ms-1.5 font-mono text-[11px] font-medium" style={{ opacity: dim }}>{k}</span>;
}
