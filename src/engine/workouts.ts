// Constructeurs de séances paramétrées pour le plan généré.
// Chaque séance a des blocs dont la somme vaut exactement la durée.

import { CONFIG } from './config';
import { newId } from './library';
import { formatClock } from './sun';
import type { Block, Phase, SessionContent, Target } from './types';

const P = CONFIG.plan;
const min = (n: number) => Math.round(n * 60);

function blk(label: string, minutes: number, target: Target, extra: Partial<Block> = {}): Block {
  return { id: newId(), label, repeat: 1, durationSec: min(minutes), target, ...extra };
}
function reps(label: string, n: number, each: number, rec: number, target: Target): Block {
  return { id: newId(), label, repeat: n, durationSec: min(each), recoverySec: min(rec), target };
}
const repsMin = (n: number, each: number, rec: number) => n * each + (n - 1) * rec;

export function roundTo(v: number, step: number = P.roundMin): number {
  return Math.max(step, Math.round(v / step) * step);
}
const round5 = (v: number) => Math.round(v / 5) * 5;
const round50 = (v: number) => Math.round(v / 50) * 50;

function content(c: Omit<SessionContent, 'blocks'> & { blocks?: Block[] }): SessionContent {
  return { blocks: [], ...c };
}

// --- Home-trainer (cibles en % FTP, compatibles ERG) ---

interface Interval {
  name: string;
  type: string;
  n: number;
  each: number;
  rec: number;
  ftp: [number, number];
  rpe: number;
}

const INTENSE: Record<Exclude<Phase, 'taper'>, Interval[]> = {
  base: [
    { name: 'Tempo', type: 'tempo', n: 2, each: 15, rec: 5, ftp: [76, 87], rpe: 6 },
    { name: 'Sweet spot', type: 'sweet spot', n: 3, each: 8, rec: 4, ftp: [88, 93], rpe: 7 },
    { name: 'Tempo', type: 'tempo', n: 2, each: 20, rec: 5, ftp: [76, 87], rpe: 6 },
    { name: 'Sweet spot', type: 'sweet spot', n: 3, each: 10, rec: 5, ftp: [88, 93], rpe: 7 },
  ],
  development: [
    { name: 'Sweet spot', type: 'sweet spot', n: 3, each: 12, rec: 5, ftp: [88, 93], rpe: 7 },
    { name: 'Seuil', type: 'seuil', n: 4, each: 6, rec: 4, ftp: [95, 100], rpe: 8 },
    { name: 'Sweet spot', type: 'sweet spot', n: 2, each: 15, rec: 5, ftp: [88, 94], rpe: 7 },
    { name: 'Sweet spot', type: 'sweet spot', n: 2, each: 20, rec: 5, ftp: [88, 94], rpe: 7 },
  ],
  specific: [
    { name: 'Tempo', type: 'tempo', n: 2, each: 20, rec: 5, ftp: [80, 88], rpe: 6 },
    { name: 'Tempo long', type: 'tempo', n: 1, each: 40, rec: 0, ftp: [78, 85], rpe: 6 },
    { name: 'Sweet spot', type: 'sweet spot', n: 2, each: 15, rec: 5, ftp: [88, 93], rpe: 7 },
  ],
};

/** Séance structurée de semaine (séance clé), progressive selon la phase. */
export function htIntense(phase: Phase, index: number, minutes: number = P.keyWeekdayMin): SessionContent {
  if (phase === 'taper') return htOpeners(minutes);
  const list = INTENSE[phase];
  const it = list[index % list.length];
  const warm = 10;
  const main = repsMin(it.n, it.each, it.rec);
  const restMin = Math.max(3, minutes - warm - main);
  const cool = Math.min(restMin, 8);
  const z2 = restMin - cool;
  const label = it.n > 1 ? `${it.n} × ${it.each}'` : `${it.each}'`;
  const blocks = [
    blk('Échauffement', warm, { ftpPct: [55, 70] }),
    it.n > 1 ? reps(it.name, it.n, it.each, it.rec, { ftpPct: it.ftp, text: 'récup à 55 %' }) : blk(it.name, it.each, { ftpPct: it.ftp }),
    ...(z2 > 0 ? [blk('Endurance', z2, { ftpPct: [65, 75] })] : []),
    blk('Retour au calme', cool, { ftpPct: [50, 55] }),
  ];
  return content({
    title: `HT ${it.name} ${label}`,
    sport: 'gravel',
    type: it.type,
    environment: 'indoor',
    targetDurationMin: warm + main + restMin,
    rpe: it.rpe,
    priority: 'key',
    blocks,
    notes: 'Mode ERG. Cibles calculées sur ta FTP.',
  });
}

/** Déblocage avant l'objectif : court, quelques accélérations. */
export function htOpeners(minutes: number): SessionContent {
  const warm = 15;
  const main = repsMin(3, 3, 3);
  const rest = Math.max(5, minutes - warm - main);
  return content({
    title: `HT Déblocage 3 × 3'`,
    sport: 'gravel',
    type: 'déblocage',
    environment: 'indoor',
    targetDurationMin: warm + main + rest,
    rpe: 5,
    priority: 'key',
    blocks: [
      blk('Échauffement', warm, { ftpPct: [55, 70] }),
      reps('Accélérations', 3, 3, 3, { ftpPct: [100, 105], text: 'récup à 55 %' }),
      blk('Souple', rest, { ftpPct: [55, 65] }),
    ],
  });
}

export function htEndurance(minutes: number, priority: 'key' | 'optional' = 'optional', title = 'HT Endurance Z2'): SessionContent {
  const warm = Math.min(10, Math.round(minutes / 6));
  const cool = 5;
  return content({
    title,
    sport: 'gravel',
    type: 'endurance',
    environment: 'indoor',
    targetDurationMin: minutes,
    rpe: 3,
    priority,
    blocks: [
      blk('Échauffement', warm, { ftpPct: [50, 65] }),
      blk('Endurance', minutes - warm - cool, { ftpPct: [65, 75], text: 'cadence 85–95' }),
      blk('Retour au calme', cool, { ftpPct: [50, 50] }),
    ],
  });
}

/** Variante home-trainer d'une sortie extérieure (bascule en 1 tap par mauvais temps). */
export function trainerVariant(minutes: number, priority: 'key' | 'optional'): SessionContent {
  const m = Math.min(minutes, P.trainerVariantMaxMin);
  if (m < 75) return htEndurance(m, priority, 'HT Endurance Z2 (variante)');
  const warm = 10;
  const cool = 5;
  const tempo = repsMin(2, 15, 5);
  const z2 = m - warm - cool - tempo;
  return content({
    title: 'HT Endurance + tempo (variante)',
    sport: 'gravel',
    type: 'endurance',
    environment: 'indoor',
    targetDurationMin: m,
    rpe: 4,
    priority,
    blocks: [
      blk('Échauffement', warm, { ftpPct: [50, 65] }),
      blk('Endurance', Math.round(z2 / 2), { ftpPct: [65, 75] }),
      reps('Tempo', 2, 15, 5, { ftpPct: [76, 85] }),
      blk('Endurance', z2 - Math.round(z2 / 2), { ftpPct: [65, 75] }),
      blk('Retour au calme', cool, { ftpPct: [50, 50] }),
    ],
    notes: `Variante intérieure plafonnée à ${formatClock(P.trainerVariantMaxMin).replace(/^0/, '')}.`,
  });
}

// --- Gravel extérieur (FC et RPE, sans puissance) ---

function distance(minutes: number, phase: Phase, loaded: boolean) {
  const km = round5((minutes / 60) * (loaded ? P.loadedSpeedKmh : P.gravelSpeedKmh));
  return { km, dplus: round50(km * P.elevationPerKm[phase]) };
}

export function outdoorEndurance(minutes: number, phase: Phase, priority: 'key' | 'optional' = 'optional', title = 'Endurance Z2 extérieur'): SessionContent {
  const warm = Math.min(15, Math.round(minutes / 6));
  const cool = 5;
  const { km, dplus } = distance(minutes, phase, false);
  return content({
    title,
    sport: 'gravel',
    type: 'endurance',
    environment: 'outdoor',
    targetDurationMin: minutes,
    targetDistanceKm: minutes >= 60 ? km : undefined,
    targetElevationM: minutes >= 60 ? dplus : undefined,
    rpe: 3,
    priority,
    blocks: [
      blk('Mise en route', warm, { hrZone: 1, rpe: 2 }),
      blk('Endurance', minutes - warm - cool, { hrZone: 2, rpe: 3 }),
      blk('Retour', cool, { hrZone: 1, rpe: 2 }),
    ],
  });
}

export interface LongRideOptions {
  title?: string;
  loaded?: boolean;
  /** Coucher du soleil (minutes depuis minuit) : la sortie finit 1 h après. */
  nightSunset?: number;
  priority?: 'key' | 'optional';
  note?: string;
}

/** Sortie longue (clé), avec km et D+ estimés, et variante home-trainer. */
export function longRide(minutes: number, phase: Phase, opts: LongRideOptions = {}): SessionContent {
  const loaded = !!opts.loaded;
  const { km, dplus } = distance(minutes, phase, loaded);
  const warm = 20;
  const cool = 10;
  const body = minutes - warm - cool;
  const fuel = 'manger toutes les 45\', boire toutes les 15\'';
  let blocks: Block[];
  if (phase === 'development' && minutes >= 150) {
    const tempo = repsMin(2, 15, 10);
    const z2 = body - tempo;
    blocks = [
      blk('Mise en route', warm, { hrZone: 1, rpe: 2 }),
      blk('Endurance', Math.round(z2 / 2), { hrZone: 2, rpe: 3, text: fuel }),
      reps('Tempo', 2, 15, 10, { hrZone: 3, rpe: 6, text: 'idéalement en montée' }),
      blk('Endurance', z2 - Math.round(z2 / 2), { hrZone: 2, rpe: 3 }),
      blk('Retour', cool, { hrZone: 1, rpe: 2 }),
    ];
  } else {
    blocks = [
      blk('Mise en route', warm, { hrZone: 1, rpe: 2 }),
      blk('Endurance', body, {
        hrZone: 2,
        rpe: 3,
        text: phase === 'specific' ? `${fuel} ; monter les côtes en Z3 maximum` : fuel,
      }),
      blk('Retour', cool, { hrZone: 1, rpe: 2 }),
    ];
  }
  const notes: string[] = [];
  if (loaded) notes.push('Vélo chargé en configuration Desertus (sacoches, eau, ravitaillement) : tester le matériel, les positions et l’alimentation.');
  if (opts.nightSunset !== undefined) {
    const start = opts.nightSunset + 60 - minutes;
    notes.push(
      `Départ vers ${formatClock(start)} pour finir vers ${formatClock(opts.nightSunset + 60)} (coucher du soleil ${formatClock(opts.nightSunset)}) : éclairage avant et arrière, frontale, gilet réfléchissant.`,
    );
  }
  if (opts.note) notes.push(opts.note);
  return content({
    title: opts.title ?? (loaded ? 'Sortie longue chargée' : 'Sortie longue'),
    sport: 'gravel',
    type: 'sortie longue',
    environment: 'outdoor',
    targetDurationMin: minutes,
    targetDistanceKm: km,
    targetElevationM: dplus,
    rpe: 4,
    priority: opts.priority ?? 'key',
    blocks,
    notes: notes.join('\n') || undefined,
  });
}

// --- Course à pied et natation ---

export type RunKind = 'footing' | 'fractionné' | 'côtes' | 'sortie longue';

export function run(minutes: number, kind: RunKind = 'footing', priority: 'key' | 'optional' = 'optional'): SessionContent {
  if (kind === 'fractionné' && minutes >= 35) {
    const main = repsMin(10, 0.5, 0.5);
    const warm = 15;
    return content({
      title: 'Fractionné court 10 × 30/30',
      sport: 'run',
      type: 'fractionné',
      environment: 'outdoor',
      targetDurationMin: minutes,
      rpe: 7,
      priority,
      blocks: [
        blk('Échauffement', warm, { hrZone: 2, rpe: 3 }),
        { ...reps('30/30', 10, 0.5, 0.5, { rpe: 8, text: 'récup en trottinant' }) },
        blk('Retour au calme', minutes - warm - main, { hrZone: 1, rpe: 2 }),
      ],
    });
  }
  if (kind === 'côtes' && minutes >= 35) {
    const main = repsMin(6, 1, 2);
    const warm = 15;
    return content({
      title: 'Côtes 6 × 1\'',
      sport: 'run',
      type: 'côtes',
      environment: 'outdoor',
      targetDurationMin: minutes,
      rpe: 7,
      priority,
      blocks: [
        blk('Échauffement', warm, { hrZone: 2, rpe: 3 }),
        reps('Côte', 6, 1, 2, { rpe: 8, text: 'récup en descendant au trot' }),
        blk('Retour au calme', minutes - warm - main, { hrZone: 1, rpe: 2 }),
      ],
    });
  }
  return content({
    title: kind === 'sortie longue' ? 'Sortie longue course' : 'Footing',
    sport: 'run',
    type: kind === 'sortie longue' ? 'sortie longue' : 'footing',
    environment: 'outdoor',
    targetDurationMin: minutes,
    rpe: 3,
    priority,
    blocks: [blk(kind === 'sortie longue' ? 'Endurance' : 'Footing', minutes, { hrZone: 2, rpe: 3, text: 'aisance respiratoire, tu peux parler' })],
  });
}

/** Natation d'endurance de durée équivalente (remplace la course par mauvais temps). */
export function swim(minutes: number, priority: 'key' | 'optional' = 'optional'): SessionContent {
  const total = Math.max(1000, Math.round((minutes * 40) / 100) * 100);
  const warm = 300;
  const cool = 200;
  const pull = 400;
  const main = Math.max(200, total - warm - cool - pull);
  const n = Math.max(1, Math.round(main / 200));
  const b = (label: string, repeat: number, distanceM: number, recoverySec: number | undefined, target: Target): Block => ({
    id: newId(),
    label,
    repeat,
    distanceM,
    recoverySec,
    target,
  });
  return content({
    title: 'Natation endurance',
    sport: 'swim',
    type: 'endurance',
    environment: 'indoor',
    targetDurationMin: minutes,
    rpe: 4,
    priority,
    notes: 'Bassin de 25 ou 50 m. Matériel : pull buoy.',
    blocks: [
      b('Échauffement', 1, warm, undefined, { rpe: 3, text: 'nages variées' }),
      b('Crawl', n, 200, 20, { rpe: 5, text: 'respiration tous les 3 temps' }),
      b('Pull buoy', 4, 100, 15, { rpe: 4, text: 'respiration bilatérale, allonger la coulée' }),
      b('Retour au calme', 1, cool, undefined, { rpe: 2, text: 'dos ou brasse' }),
    ],
  });
}

export function football(minutes: number): SessionContent {
  return content({
    title: 'Football',
    sport: 'football',
    type: 'match',
    environment: 'outdoor',
    targetDurationMin: minutes,
    rpe: 7,
    priority: 'optional',
  });
}

/** Bascule une séance sur sa variante (et garde l'ancienne en variante). */
export function switchToAlternative<T extends SessionContent & { alternative?: SessionContent }>(s: T): T {
  if (!s.alternative) return s;
  const current: SessionContent = {
    title: s.title,
    sport: s.sport,
    type: s.type,
    environment: s.environment,
    targetDurationMin: s.targetDurationMin,
    targetDistanceKm: s.targetDistanceKm,
    targetElevationM: s.targetElevationM,
    rpe: s.rpe,
    blocks: s.blocks,
    priority: s.priority,
    notes: s.notes,
  };
  const a = s.alternative;
  return {
    ...s,
    title: a.title,
    sport: a.sport,
    type: a.type,
    environment: a.environment,
    targetDurationMin: a.targetDurationMin,
    targetDistanceKm: a.targetDistanceKm,
    targetElevationM: a.targetElevationM,
    rpe: a.rpe,
    blocks: a.blocks,
    notes: a.notes,
    priority: s.priority,
    alternative: current,
  };
}
