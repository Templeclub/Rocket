// Dérivés non stockés : heures prévues et faites par sport pour une période.

import { addDays, diffDays } from './dates';
import { isEndurance, sportKey, SPORT_KEYS } from './sports';
import type { Activity, LocalDate, PlannedSession, SportKey } from './types';

export interface SportHours {
  plannedH: number;
  doneH: number;
  plannedCount: number;
  doneCount: number;
}

export interface WeekSummary {
  bySport: Record<SportKey, SportHours>;
  /** Total des heures d'endurance (vélo, course, natation). */
  endurance: SportHours;
  /** Total de toutes les activités (foot et enduro inclus). */
  all: SportHours;
  /** Séances prévues faites / séances prévues non annulées (null s'il n'y en a aucune). */
  completionRate: number | null;
}

const empty = (): SportHours => ({ plannedH: 0, doneH: 0, plannedCount: 0, doneCount: 0 });

export function inRange(d: LocalDate, start: LocalDate, days: number): boolean {
  const k = diffDays(d, start);
  return k >= 0 && k < days;
}

export function summarize(
  sessions: PlannedSession[],
  activities: Activity[],
  start: LocalDate,
  days = 7,
): WeekSummary {
  const bySport = Object.fromEntries(SPORT_KEYS.map((k) => [k, empty()])) as Record<SportKey, SportHours>;
  const endurance = empty();
  const all = empty();
  let counted = 0;
  let done = 0;

  for (const s of sessions) {
    if (!inRange(s.date, start, days) || s.status === 'cancelled') continue;
    const h = s.targetDurationMin / 60;
    const k = sportKey(s.sport, s.environment);
    for (const t of isEndurance(s.sport) ? [bySport[k], endurance, all] : [bySport[k], all]) {
      t.plannedH += h;
      t.plannedCount += 1;
    }
    counted += 1;
    if (s.status === 'done') done += 1;
  }

  for (const a of activities) {
    if (!inRange(a.date, start, days)) continue;
    const h = a.durationSec / 3600;
    const k = sportKey(a.sport, a.environment);
    for (const t of isEndurance(a.sport) ? [bySport[k], endurance, all] : [bySport[k], all]) {
      t.doneH += h;
      t.doneCount += 1;
    }
  }

  return { bySport, endurance, all, completionRate: counted ? done / counted : null };
}

export function weekEnd(start: LocalDate): LocalDate {
  return addDays(start, 6);
}
