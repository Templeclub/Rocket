import { useId } from 'react';

/** Logo Ascèse : un profil d'altitude dont le flanc gauche monte jusqu'au sommet (repère de 512 × 512). */
export const LOGO = {
  area: 'M64 404 L152 320 L174 322 L236 238 L254 240 L298 112 L352 210 L368 208 L448 404 Z',
  climb: 'M64 404 L152 320 L174 322 L236 238 L254 240 L298 112',
  summit: { x: 298, y: 112, r: 20 },
  base: 'M48 404 L464 404',
  orange: '#f04a12',
  red: '#e01e4f',
};

/** Le logo sans son fond ; la ligne de base prend la couleur du texte (lisible en clair comme en sombre). */
export function LogoMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="40 92 432 324" height={size} width={(size * 432) / 324} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="120" y1="112" x2="448" y2="360">
          <stop offset="0" stopColor={LOGO.orange} />
          <stop offset="1" stopColor={LOGO.red} />
        </linearGradient>
      </defs>
      <path d={LOGO.area} fill={`url(#${id})`} />
      <path d={LOGO.climb} fill="none" stroke={LOGO.red} strokeWidth={16} strokeLinejoin="round" />
      <circle cx={LOGO.summit.x} cy={LOGO.summit.y} r={LOGO.summit.r} fill="#fff" stroke={LOGO.red} strokeWidth={11} />
      <path d={LOGO.base} stroke="currentColor" strokeWidth={14} strokeLinecap="round" />
    </svg>
  );
}
