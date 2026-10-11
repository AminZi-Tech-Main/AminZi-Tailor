import { useId, type CSSProperties } from 'react';

/** AminZi mark: monitor frame, A + Z, bar chart and pie — drawn from the brand logo. */
export function LogoMark({ width = 46, height = 42, style, className }: { width?: number; height?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 110" className={className} style={{ flex: 'none', ...style }} role="img" aria-label="AminZi">
      <path d="M50 18H100a8 8 0 0 1 8 8V72a8 8 0 0 1-8 8H62" fill="none" stroke="var(--logo-ink)" strokeWidth="5" strokeLinecap="round" />
      <path d="M40 18H30a8 8 0 0 0-8 8V48" fill="none" stroke="var(--logo-ink)" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 48v6a4 4 0 0 1-4 4h-2" fill="none" stroke="var(--logo-ink)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="11" cy="58" r="4.5" fill="none" stroke="var(--logo-ink)" strokeWidth="3" />
      <path d="M66 18V11" stroke="var(--logo-ink)" strokeWidth="4" />
      <circle cx="66" cy="7" r="4.5" fill="none" stroke="var(--logo-ink)" strokeWidth="3" />
      <circle cx="66" cy="7" r="1.8" fill="var(--acc)" />
      <polygon points="14,96 40,30 54,30 70,62 58,62 47,40 29,96" fill="var(--logo-ink)" />
      <polygon points="40,60 80,60 55,86 82,86 77,96 35,96 61,70 36,70" fill="var(--acc)" opacity=".94" />
      <rect x="80" y="44" width="6" height="14" fill="var(--acc)" />
      <rect x="89" y="36" width="6" height="22" fill="var(--acc)" />
      <rect x="98" y="28" width="6" height="30" fill="var(--acc)" />
      <circle cx="95" cy="70" r="7" fill="var(--acc)" />
      <path d="M95 70V63A7 7 0 0 1 102 70Z" fill="#e8a33d" />
      <path d="M58 80l-3 13h22l-3-13" fill="var(--logo-ink)" />
      <rect x="46" y="93" width="40" height="5" rx="2.5" fill="var(--logo-ink)" />
    </svg>
  );
}

export function Splash({ tagline }: { tagline: string }) {
  return (
    <div aria-hidden="true"
      className="splash pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-center gap-[18px] bg-[color-mix(in_srgb,var(--bg)_55%,transparent)] backdrop-blur-[14px]">
      <LogoMark width={220} height={200} />
      <span dir="auto" className="splash-word text-[15px] font-semibold text-fg uppercase">{tagline}</span>
    </div>
  );
}

/** Spinning text ring around an accent disc — the dashboard's "New order" badge. */
export function RingBadge({ label, text, onClick, rtl, size = 148 }: { label: string; text: string; onClick?: () => void; rtl?: boolean; size?: number }) {
  const id = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <button aria-label={label} onClick={onClick}
      className="relative flex-none text-fg transition-transform duration-400 ease-bounce hover:scale-[1.06] hover:-rotate-4 active:scale-[.96]" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" className="absolute inset-0 ring-spin">
        <defs><path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
        <text className="fill-current font-mono text-[13px] font-semibold" style={{ letterSpacing: rtl ? 0 : 3 }}>
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <span className="absolute flex flex-col items-center justify-center gap-0.5 rounded-full bg-acc text-xs font-semibold text-on-acc" style={{ inset: size * 0.23, boxShadow: 'var(--btn-sh)' }}>
        <span className="text-[22px] leading-none">↗</span><span dir="auto">{label}</span>
      </span>
    </button>
  );
}
