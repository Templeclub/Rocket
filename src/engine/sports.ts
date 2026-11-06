import type { Environment, Sport, SportKey } from './types';

export const SPORT_KEYS: SportKey[] = ['gravel-out', 'gravel-in', 'run', 'swim', 'football', 'enduro'];

export const SPORT_META: Record<SportKey, { label: string; short: string; emoji: string; color: string }> = {
  'gravel-out': { label: 'Gravel extérieur', short: 'Gravel', emoji: '🚵', color: '#e0892b' },
  'gravel-in': { label: 'Home-trainer', short: 'HT', emoji: '🏠', color: '#8b6cf0' },
  run: { label: 'Course à pied', short: 'Course', emoji: '🏃', color: '#3fae6a' },
  swim: { label: 'Natation', short: 'Natation', emoji: '🏊', color: '#2f9ad6' },
  football: { label: 'Football', short: 'Foot', emoji: '⚽', color: '#d65a5a' },
  enduro: { label: 'Enduro', short: 'Enduro', emoji: '🏍️', color: '#9a8466' },
};

export function sportKey(sport: Sport, environment: Environment): SportKey {
  if (sport === 'gravel') return environment === 'indoor' ? 'gravel-in' : 'gravel-out';
  return sport;
}

export function fromSportKey(k: SportKey): { sport: Sport; environment: Environment } {
  if (k === 'gravel-in') return { sport: 'gravel', environment: 'indoor' };
  if (k === 'gravel-out') return { sport: 'gravel', environment: 'outdoor' };
  return { sport: k, environment: k === 'swim' ? 'indoor' : 'outdoor' };
}

/** Sports sans contenu détaillé : durée et intensité perçue seulement. */
export function hasNoContent(sport: Sport): boolean {
  return sport === 'football' || sport === 'enduro';
}

/** Sports comptés dans les heures d'endurance (le foot et l'enduro ne comptent que dans la charge). */
export function isEndurance(sport: Sport): boolean {
  return sport === 'gravel' || sport === 'run' || sport === 'swim';
}
