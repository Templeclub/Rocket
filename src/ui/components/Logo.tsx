/**
 * Logo Ascèse, façon autocollant : un seul geste (on monte, sommet, on redescend, ça finit en vague)
 * et un soleil, contour encre et ombre nette. Repère de 512 × 512, décalé de (-14, -6) dans l'icône.
 */
export const LOGO = {
  path: 'M92 404 C101.3 386.7 134 319.7 148 300 C162 280.3 165 307.7 176 286 C187 264.3 202.3 199 214 170 C225.7 141 235.3 113.7 246 112 C256.7 110.3 267.3 131 278 160 C288.7 189 299.3 259.3 310 286 C320.7 312.7 330.3 320 342 320 C353.7 320 367.3 286.7 380 286 C392.7 285.3 407 314.3 418 316 C429 317.7 441.3 299.3 446 296',
  sun: { x: 372, y: 150, r: 46 },
  /** Épaisseur du trait coloré, du contour (de chaque côté) et décalage de l'ombre. */
  stroke: 34,
  outline: 10,
  shadow: 9,
  ink: '#0b1220',
  orange: '#f04a12',
  yellow: '#ffd23f',
  cream: '#fff6e5',
};

/** Le logo sans sa tuile (pour l'en-tête). */
export function LogoMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  const { path, sun, stroke, outline, shadow, ink } = LOGO;
  const w = stroke + outline * 2;
  return (
    <svg viewBox="62 80 432 370" height={size} width={(size * 432) / 370} className={className} aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx={sun.x + shadow} cy={sun.y + shadow} r={sun.r + outline} fill={ink} />
        <circle cx={sun.x} cy={sun.y} r={sun.r + outline} fill={ink} />
        <circle cx={sun.x} cy={sun.y} r={sun.r} fill={LOGO.yellow} />
        <path d={path} transform={`translate(${shadow} ${shadow})`} stroke={ink} strokeWidth={w} />
        <path d={path} stroke={ink} strokeWidth={w} />
        <path d={path} stroke={LOGO.orange} strokeWidth={stroke} />
      </g>
    </svg>
  );
}
