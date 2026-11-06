// Bibliothèque de séances types de départ, et copie d'un modèle vers une séance planifiée.
// Une séance planifiée est une copie : la modifier ne change jamais le modèle.

import type { Block, LocalDate, PlannedSession, SessionContent, SessionTemplate, Target } from './types';

export function newId(): string {
  return crypto.randomUUID();
}

const min = (n: number) => n * 60;

function b(label: string, opts: Partial<Omit<Block, 'id' | 'label' | 'target'>> & { target?: Target }): Block {
  return { id: newId(), label, repeat: opts.repeat ?? 1, ...opts, target: opts.target ?? {} };
}

type Seed = Omit<SessionTemplate, 'id' | 'builtin'> & { key: string };

const SEEDS: Seed[] = [
  // --- Home-trainer (cibles en % FTP, compatibles ERG) ---
  {
    key: 'ht-z2-60',
    title: 'HT Endurance Z2',
    sport: 'gravel',
    type: 'endurance',
    environment: 'indoor',
    targetDurationMin: 60,
    priority: 'optional',
    blocks: [
      b('Échauffement', { durationSec: min(10), target: { ftpPct: [50, 65] } }),
      b('Endurance', { durationSec: min(45), target: { ftpPct: [65, 75], text: 'cadence libre 85–95' } }),
      b('Retour au calme', { durationSec: min(5), target: { ftpPct: [50, 50] } }),
    ],
  },
  {
    key: 'ht-ss-3x10',
    title: 'HT Sweet spot 3 × 10\'',
    sport: 'gravel',
    type: 'sweet spot',
    environment: 'indoor',
    targetDurationMin: 60,
    priority: 'key',
    blocks: [
      b('Échauffement', { durationSec: min(12), target: { ftpPct: [55, 70] } }),
      b('Sweet spot', { repeat: 3, durationSec: min(10), recoverySec: min(5), target: { ftpPct: [88, 93] } }),
      b('Retour au calme', { durationSec: min(8), target: { ftpPct: [50, 55] } }),
    ],
  },
  {
    key: 'ht-tempo-2x20',
    title: 'HT Tempo 2 × 20\'',
    sport: 'gravel',
    type: 'tempo',
    environment: 'indoor',
    targetDurationMin: 60,
    priority: 'key',
    blocks: [
      b('Échauffement', { durationSec: min(10), target: { ftpPct: [55, 70] } }),
      b('Tempo', { repeat: 2, durationSec: min(20), recoverySec: min(5), target: { ftpPct: [76, 87] } }),
      b('Retour au calme', { durationSec: min(5), target: { ftpPct: [50, 50] } }),
    ],
  },
  {
    key: 'ht-recup-40',
    title: 'HT Récupération active',
    sport: 'gravel',
    type: 'récupération',
    environment: 'indoor',
    targetDurationMin: 40,
    priority: 'optional',
    blocks: [b('Souple', { durationSec: min(40), target: { ftpPct: [45, 55], text: 'cadence élevée' } })],
  },

  // --- Gravel extérieur (cibles en zone de FC et RPE, sans puissance) ---
  {
    key: 'out-long',
    title: 'Sortie longue',
    sport: 'gravel',
    type: 'sortie longue',
    environment: 'outdoor',
    targetDurationMin: 180,
    targetDistanceKm: 65,
    targetElevationM: 700,
    priority: 'key',
    blocks: [
      b('Mise en route', { durationSec: min(20), target: { hrZone: 1, rpe: 2 } }),
      b('Endurance', { durationSec: min(150), target: { hrZone: 2, rpe: 3, text: 'manger toutes les 45\'' } }),
      b('Retour', { durationSec: min(10), target: { hrZone: 1, rpe: 2 } }),
    ],
  },
  {
    key: 'out-z2-90',
    title: 'Endurance Z2 extérieur',
    sport: 'gravel',
    type: 'endurance',
    environment: 'outdoor',
    targetDurationMin: 90,
    priority: 'optional',
    blocks: [
      b('Mise en route', { durationSec: min(15), target: { hrZone: 1, rpe: 2 } }),
      b('Endurance', { durationSec: min(70), target: { hrZone: 2, rpe: 3 } }),
      b('Retour', { durationSec: min(5), target: { hrZone: 1, rpe: 2 } }),
    ],
  },
  {
    key: 'out-tempo',
    title: 'Tempo extérieur 3 × 12\'',
    sport: 'gravel',
    type: 'tempo',
    environment: 'outdoor',
    targetDurationMin: 85,
    priority: 'key',
    blocks: [
      b('Échauffement', { durationSec: min(20), target: { hrZone: 2, rpe: 3 } }),
      b('Tempo', { repeat: 3, durationSec: min(12), recoverySec: min(5), target: { hrZone: 3, rpe: 6 } }),
      b('Endurance', { durationSec: min(15), target: { hrZone: 2, rpe: 3 } }),
      b('Retour', { durationSec: min(4), target: { hrZone: 1, rpe: 2 } }),
    ],
  },
  {
    key: 'out-recup',
    title: 'Récupération active extérieur',
    sport: 'gravel',
    type: 'récupération',
    environment: 'outdoor',
    targetDurationMin: 45,
    priority: 'optional',
    blocks: [b('Souple', { durationSec: min(45), target: { hrZone: 1, rpe: 2, text: 'plat, petit braquet' } })],
  },

  // --- Course à pied ---
  {
    key: 'run-footing',
    title: 'Footing',
    sport: 'run',
    type: 'footing',
    environment: 'outdoor',
    targetDurationMin: 40,
    priority: 'optional',
    blocks: [b('Footing', { durationSec: min(40), target: { hrZone: 2, rpe: 3, text: 'aisance respiratoire, tu peux parler' } })],
  },
  {
    key: 'run-30-30',
    title: 'Fractionné court 10 × 30/30',
    sport: 'run',
    type: 'fractionné',
    environment: 'outdoor',
    targetDurationMin: 40,
    priority: 'optional',
    blocks: [
      b('Échauffement', { durationSec: min(15), target: { hrZone: 2, rpe: 3 } }),
      b('30/30', { repeat: 10, durationSec: 30, recoverySec: 30, target: { rpe: 8, text: 'récup en trottinant' } }),
      b('Retour au calme', { durationSec: min(15), target: { hrZone: 1, rpe: 2 } }),
    ],
  },
  {
    key: 'run-hills',
    title: 'Côtes 6 × 1\'',
    sport: 'run',
    type: 'côtes',
    environment: 'outdoor',
    targetDurationMin: 45,
    priority: 'optional',
    blocks: [
      b('Échauffement', { durationSec: min(15), target: { hrZone: 2, rpe: 3 } }),
      b('Côte', { repeat: 6, durationSec: 60, recoverySec: 120, target: { rpe: 8, text: 'récup en descendant au trot' } }),
      b('Retour au calme', { durationSec: min(13), target: { hrZone: 1, rpe: 2 } }),
    ],
  },

  // --- Natation (séries en mètres, bassin 25 ou 50 m) ---
  {
    key: 'swim-tech',
    title: 'Natation technique',
    sport: 'swim',
    type: 'technique',
    environment: 'indoor',
    targetDurationMin: 45,
    priority: 'optional',
    notes: 'Matériel : pull buoy.',
    blocks: [
      b('Échauffement', { distanceM: 400, target: { rpe: 3, text: 'nages variées' } }),
      b('Éducatifs respiration', { repeat: 8, distanceM: 50, recoverySec: 20, target: { rpe: 4, text: 'crawl, respiration tous les 3 temps, expirer dans l’eau' } }),
      b('Pull buoy', { repeat: 4, distanceM: 100, recoverySec: 20, target: { rpe: 4, text: 'respiration bilatérale, allonger la coulée' } }),
      b('Retour au calme', { distanceM: 200, target: { rpe: 2, text: 'dos ou brasse' } }),
    ],
  },
  {
    key: 'swim-endurance',
    title: 'Natation endurance',
    sport: 'swim',
    type: 'endurance',
    environment: 'indoor',
    targetDurationMin: 50,
    priority: 'optional',
    notes: 'Matériel : pull buoy.',
    blocks: [
      b('Échauffement', { distanceM: 400, target: { rpe: 3, text: 'nages variées' } }),
      b('Crawl continu', { repeat: 3, distanceM: 400, recoverySec: 30, target: { rpe: 5, text: 'allure régulière' } }),
      b('Pull buoy', { repeat: 4, distanceM: 100, recoverySec: 15, target: { rpe: 5 } }),
      b('Retour au calme', { distanceM: 200, target: { rpe: 2 } }),
    ],
  },
  {
    key: 'swim-speed',
    title: 'Natation vitesse',
    sport: 'swim',
    type: 'vitesse',
    environment: 'indoor',
    targetDurationMin: 45,
    priority: 'optional',
    blocks: [
      b('Échauffement', { distanceM: 400, target: { rpe: 3 } }),
      b('Rapide', { repeat: 8, distanceM: 50, recoverySec: 30, target: { rpe: 8, text: 'crawl' } }),
      b('Sprint', { repeat: 4, distanceM: 25, recoverySec: 40, target: { rpe: 9 } }),
      b('Retour au calme', { distanceM: 300, target: { rpe: 2 } }),
    ],
  },

  // --- Sans contenu : durée et intensité perçue ---
  {
    key: 'football',
    title: 'Football',
    sport: 'football',
    type: 'match',
    environment: 'outdoor',
    targetDurationMin: 90,
    rpe: 7,
    priority: 'optional',
    blocks: [],
  },
  {
    key: 'enduro',
    title: 'Enduro',
    sport: 'enduro',
    type: 'enduro',
    environment: 'outdoor',
    targetDurationMin: 180,
    rpe: 6,
    priority: 'optional',
    blocks: [],
  },
];

/** Modèles de départ, avec des identifiants stables pour qu'un nouvel ensemencement ne crée pas de doublons. */
export function builtinTemplates(): SessionTemplate[] {
  return SEEDS.map(({ key, ...t }) => ({ ...t, id: `builtin:${key}`, builtin: true }));
}

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((x) => ({
    ...x,
    id: newId(),
    target: { ...x.target, ftpPct: x.target.ftpPct ? [...x.target.ftpPct] : undefined },
  }));
}

export function contentOf(t: SessionContent): SessionContent {
  return {
    title: t.title,
    sport: t.sport,
    type: t.type,
    environment: t.environment,
    targetDurationMin: t.targetDurationMin,
    targetDistanceKm: t.targetDistanceKm,
    targetElevationM: t.targetElevationM,
    rpe: t.rpe,
    blocks: cloneBlocks(t.blocks),
    priority: t.priority,
    notes: t.notes,
  };
}

/** Crée une séance planifiée à partir d'un modèle (copie profonde). */
export function instantiate(t: SessionTemplate, date: LocalDate, now: number = Date.now()): PlannedSession {
  return {
    ...contentOf(t),
    id: newId(),
    date,
    status: 'planned',
    origin: 'manual',
    confirmed: true,
    templateId: t.id,
    createdAt: now,
    updatedAt: now,
  };
}

/** Crée un modèle à partir d'une séance (« enregistrer comme séance type »). */
export function toTemplate(s: SessionContent, title?: string): SessionTemplate {
  return { ...contentOf(s), title: title ?? s.title, id: newId(), builtin: false };
}

export function blankSession(date: LocalDate, now: number = Date.now()): PlannedSession {
  return {
    id: newId(),
    title: 'Nouvelle séance',
    sport: 'gravel',
    type: 'endurance',
    environment: 'indoor',
    targetDurationMin: 60,
    blocks: [],
    priority: 'optional',
    date,
    status: 'planned',
    origin: 'manual',
    confirmed: true,
    createdAt: now,
    updatedAt: now,
  };
}
