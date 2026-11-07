// Strava → activités réalisées. Module pur : classement, conversion et rapprochement avec le plan.
//
// Classement : le TITRE d'abord (le foot remonte en « Workout » intitulé « Football », une séance Rouvy
// en « Ride » intitulé « Rouvy … »), puis le type Strava, puis l'indicateur home-trainer.
// Rapprochement : uniquement le jour et la discipline, jamais la durée ni le contenu.

import { isPending } from './status';
import type { Activity, Environment, LocalDate, PlannedSession, Sport } from './types';

/** Champs utiles d'une activité Strava (SummaryActivity de l'API v3). */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date?: string;
  /** Heure locale de l'activité, notée en ISO avec un « Z » trompeur (c'est bien l'heure locale). */
  start_date_local: string;
  moving_time: number;
  elapsed_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  average_watts?: number;
  device_watts?: boolean;
  trainer?: boolean;
  private?: boolean;
}

export interface Classification {
  sport: Sport;
  environment: Environment;
  /** Ce qui a décidé : le titre, le type Strava, ou l'indicateur home-trainer. */
  by: 'title' | 'type' | 'trainer';
}

/** Minuscules, sans accents ni ponctuation, pour comparer des titres. */
export function normalize(s: string): string {
  return ` ${s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const has = (t: string, words: string[]) => words.some((w) => t.includes(` ${w} `));

// Mots-clés de titre, du plus spécifique au plus général (normalisés, entourés d'espaces à la comparaison).
const TITLE_RULES: { words: string[]; sport: Sport; environment: Environment }[] = [
  { words: ['football', 'foot', 'futsal', 'five', 'soccer', 'match de foot', 'entrainement foot'], sport: 'football', environment: 'outdoor' },
  { words: ['enduro', 'moto', 'motocross', 'mx', 'trial', 'dirt'], sport: 'enduro', environment: 'outdoor' },
  {
    words: ['rouvy', 'zwift', 'home trainer', 'hometrainer', 'ht', 'trainer', 'erg', 'indoor', 'interieur', 'rouleau', 'rouleaux', 'wahoo systm', 'mywhoosh', 'tacx', 'kickr', 'virtual'],
    sport: 'gravel',
    environment: 'indoor',
  },
  { words: ['natation', 'nage', 'piscine', 'swim', 'swimming', 'crawl', 'brasse', 'bassin', 'pull buoy'], sport: 'swim', environment: 'indoor' },
  { words: ['course', 'footing', 'run', 'running', 'jogging', 'trail', 'fractionne', 'cotes', 'fartlek', 'vma', 'semi', 'marathon'], sport: 'run', environment: 'outdoor' },
  {
    words: ['gravel', 'velo', 'bike', 'ride', 'route', 'vtt', 'cyclisme', 'sortie longue', 'bikepacking', 'desertus', 'randonnee velo'],
    sport: 'gravel',
    environment: 'outdoor',
  },
];

const RIDE_TYPES = ['Ride', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide', 'Velomobile', 'Handcycle'];
const RUN_TYPES = ['Run', 'TrailRun'];

/** Classe une activité Strava, ou null si elle ne correspond à aucune de mes disciplines (marche, muscu…). */
export function classify(a: Pick<StravaActivity, 'name' | 'sport_type' | 'type' | 'trainer'>): Classification | null {
  const t = normalize(a.name ?? '');
  const type = a.sport_type ?? a.type ?? '';
  for (const r of TITLE_RULES) {
    if (has(t, r.words)) {
      // Un titre vélo sur une activité marquée home-trainer reste du home-trainer.
      if (r.sport === 'gravel' && r.environment === 'outdoor' && (a.trainer || type === 'VirtualRide')) {
        return { sport: 'gravel', environment: 'indoor', by: 'trainer' };
      }
      return { sport: r.sport, environment: r.environment, by: 'title' };
    }
  }
  if (type === 'VirtualRide') return { sport: 'gravel', environment: 'indoor', by: 'type' };
  if (RIDE_TYPES.includes(type)) return { sport: 'gravel', environment: a.trainer ? 'indoor' : 'outdoor', by: a.trainer ? 'trainer' : 'type' };
  if (RUN_TYPES.includes(type) || type === 'VirtualRun') return { sport: 'run', environment: type === 'VirtualRun' || a.trainer ? 'indoor' : 'outdoor', by: 'type' };
  if (type === 'Swim') return { sport: 'swim', environment: 'indoor', by: 'type' };
  if (type === 'Soccer') return { sport: 'football', environment: 'outdoor', by: 'type' };
  return null;
}

/** Date locale (Europe/Paris) d'une activité Strava. */
export function stravaLocalDate(a: Pick<StravaActivity, 'start_date_local'>): LocalDate {
  return a.start_date_local.slice(0, 10);
}

export function toActivity(a: StravaActivity, c: Classification, id: string): Activity {
  return {
    id,
    source: 'strava',
    sport: c.sport,
    environment: c.environment,
    date: stravaLocalDate(a),
    start: a.start_date ?? a.start_date_local,
    durationSec: Math.round(a.moving_time || a.elapsed_time || 0),
    distanceM: a.distance ? Math.round(a.distance) : undefined,
    elevationM: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : undefined,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
    avgPower: a.average_watts && (a.device_watts || c.environment === 'indoor') ? Math.round(a.average_watts) : undefined,
    externalId: `strava:${a.id}`,
    title: a.name,
  };
}

/**
 * Séance prévue à associer à une activité réalisée : même jour, même discipline
 * (le gravel extérieur et le home-trainer sont la même discipline : une sortie faite sur Rouvy valide la séance).
 * Préférence : même environnement, puis séance clé, puis la première de la journée.
 */
export function matchSession(a: Pick<Activity, 'date' | 'sport' | 'environment'>, sessions: PlannedSession[], taken: Set<string>): PlannedSession | null {
  const candidates = sessions.filter((s) => s.date === a.date && s.sport === a.sport && s.status !== 'cancelled' && !taken.has(s.id));
  if (!candidates.length) return null;
  const score = (s: PlannedSession) => (isPending(s) ? 0 : 4) + (s.environment === a.environment ? 0 : 2) + (s.priority === 'key' ? 0 : 1);
  return [...candidates].sort((x, y) => score(x) - score(y))[0];
}

export const SPORT_TYPE_LABEL: Record<string, string> = {
  Ride: 'Vélo',
  GravelRide: 'Gravel',
  MountainBikeRide: 'VTT',
  VirtualRide: 'Vélo virtuel',
  EBikeRide: 'VAE',
  Run: 'Course',
  TrailRun: 'Trail',
  Swim: 'Natation',
  Workout: 'Entraînement',
  WeightTraining: 'Musculation',
  Walk: 'Marche',
  Hike: 'Randonnée',
  Soccer: 'Football',
};
