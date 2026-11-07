import type { ReactNode } from 'react';

/** Anneau de progression (jauge « Prêt à … % »). */
export function Ring({ value, size = 56, stroke = 6, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = `ring-${size}`;
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--c-sport-1)" />
            <stop offset="100%" stopColor="var(--c-sport-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-raised)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

/** Flamme de la série de semaines tenues. */
export function Flame({ lit = true, className = 'w-5 h-5' }: { lit?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--c-sport-2)" />
          <stop offset="100%" stopColor="var(--c-sport-1)" />
        </linearGradient>
      </defs>
      <path
        d="M12.4 2C13.3 5.6 18 8 18 13.6A6 6 0 0 1 6 13.8c0-3 1.6-4.9 3-6.4.3 2 1.1 3.3 2.4 3.9-.5-3.3.1-6.3 1-9.3zM12 21a2.8 2.8 0 0 1-2.8-2.9c0-1.6 1.3-2.6 2.2-3.8.5 1.3 1.4 1.7 2.3 2.4.7.6 1.1 1.2 1.1 1.9A2.8 2.8 0 0 1 12 21z"
        fillRule="evenodd"
        fill={lit ? 'url(#flame)' : 'none'}
        stroke={lit ? 'none' : 'var(--c-muted)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Insigne de niveau : le numéro du niveau sur le dégradé. */
export function LevelBadge({ index, size = 34 }: { index: number; size?: number }) {
  return (
    <span
      className="inline-grid place-items-center rounded-xl bg-sport shrink-0 font-display font-black italic leading-none"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {index + 1}
    </span>
  );
}
