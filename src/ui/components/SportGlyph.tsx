import type { ReactNode } from 'react';
import { SPORT_META, sportKey } from '../../engine/sports';
import type { Environment, Sport, SportKey } from '../../engine/types';

// Pictogrammes au trait, épurés, dans la couleur de chaque discipline (remplacent les emojis).
// Dessinés sur une grille de 32 × 32, trait de 1,8.

const BIKE = (
  <>
    <circle cx="8.5" cy="21" r="5.2" />
    <circle cx="23.5" cy="21" r="5.2" />
    <path d="M8.5 21 13.6 13.2 16.2 21Z M13.6 13.2 H21.2 L16.2 21 M21.2 13.2 23.5 21 M21.2 13.2 21.8 10.4 H24.2 M11.9 11.6 H15.2" />
  </>
);

const GLYPHS: Record<SportKey, ReactNode> = {
  'gravel-out': (
    <>
      {BIKE}
      <circle cx="6.5" cy="6.8" r="2.1" />
      <path d="M2.8 6.8h1M6.5 3.1v1" opacity="0.7" />
    </>
  ),
  'gravel-in': (
    <>
      <circle cx="9.5" cy="18.5" r="5" />
      <circle cx="23.5" cy="20.5" r="4.6" />
      <path d="M9.5 18.5 14.3 11 16.8 18.5Z M14.3 11 H21.4 L16.8 18.5 M21.4 11 23.5 20.5 M21.4 11 22 8.4 H24.3 M12.6 9.5 H15.8" />
      <path d="M9.5 18.5 6 27.5 M9.5 18.5 13 27.5 M4 27.5 H15 M20 27.5 H27.5" />
    </>
  ),
  run: (
    <>
      <circle cx="19.6" cy="6.2" r="2.4" />
      <path d="M18 10.2 14.8 17.2 M17.4 11.6 21.2 14.4 24 12.2 M16.8 11.4 12.6 12.6 10.4 15.8 M14.8 17.2 18.8 20.4 17.2 26 M14.8 17.2 11.6 21.8 6.8 22.8" />
    </>
  ),
  swim: (
    <>
      <circle cx="10.6" cy="13.2" r="2.4" />
      <path d="M13.6 15.4C16.4 9.6 22.6 8.8 26 13.4 M14.8 15.6 21 16" />
      <path d="M3.5 20.4c2.1-1.8 4.2-1.8 6.3 0s4.2 1.8 6.3 0 4.2-1.8 6.3 0 4.2 1.8 6.3 0 M3.5 25.4c2.1-1.8 4.2-1.8 6.3 0s4.2 1.8 6.3 0 4.2-1.8 6.3 0 4.2 1.8 6.3 0" />
    </>
  ),
  football: (
    <>
      <circle cx="16" cy="16" r="10.5" />
      <path d="M16 11.6 20.2 14.6 18.6 19.6H13.4L11.8 14.6Z M16 11.6V5.5 M20.2 14.6 26 12.7 M18.6 19.6 22.2 24.6 M13.4 19.6 9.8 24.6 M11.8 14.6 6 12.7" />
    </>
  ),
  enduro: (
    <>
      <circle cx="7.8" cy="21.6" r="5" strokeDasharray="2.2 1.3" />
      <circle cx="24.2" cy="21.6" r="5" strokeDasharray="2.2 1.3" />
      <path d="M7.8 21.6 12.4 15.4H19.6L24.2 21.6 M10.4 13.2H17.8 M19.6 15.4 21.4 10.6H24.4 M21.4 10.6 24.2 21.6" />
      <rect x="12.6" y="17" width="5.4" height="4" rx="1" />
    </>
  ),
};

export function SportGlyph({
  k,
  size = 28,
  badge = true,
  muted = false,
  className = '',
}: {
  k: SportKey;
  size?: number;
  /** Pastille teintée (fond à 14 % de la couleur). */
  badge?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const color = SPORT_META[k].color;
  const icon = (
    <svg
      viewBox="0 0 32 32"
      width={badge ? size * 0.72 : size}
      height={badge ? size * 0.72 : size}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[k]}
    </svg>
  );
  if (!badge) return <span className={`inline-grid place-items-center shrink-0 ${className}`}>{icon}</span>;
  return (
    <span
      className={`inline-grid place-items-center shrink-0 rounded-[30%] ${className}`}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 14%, transparent)`, opacity: muted ? 0.6 : 1 }}
      title={SPORT_META[k].label}
    >
      {icon}
    </span>
  );
}

export function SessionGlyph({ sport, environment, ...rest }: { sport: Sport; environment: Environment } & Omit<Parameters<typeof SportGlyph>[0], 'k'>) {
  return <SportGlyph k={sportKey(sport, environment)} {...rest} />;
}
