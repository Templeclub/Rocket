import type { Environment, Sport, SportKey } from './types';

export const SPORT_KEYS: SportKey[] = ['gravel-out', 'gravel-in', 'run', 'swim', 'football', 'enduro'];

export const SPORT_META: Record<SportKey, { label: string; short: string; emoji: string; color: string }> = {
  'gravel-out': { label: 'Gravel extérieur', short: 'Gravel', emoji: '🚵', color: 'var(--sp-gravel-out)' },
  'gravel-in': { label: 'Home-trainer', short: 'HT', emoji: '🏠', color: 'var(--sp-gravel-in)' },
  run: { label: 'Course à pied', short: 'Course', emoji: '🏃', color: 'var(--sp-run)' },
  swim: { label: 'Natation', short: 'Natation', emoji: '🏊', color: 'var(--sp-swim)' },
  football: { label: 'Football', short: 'Foot', emoji: '⚽', color: 'var(--sp-football)' },
  enduro: { label: 'Enduro', short: 'Enduro', emoji: '🏍️', color: 'var(--sp-enduro)' },
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
