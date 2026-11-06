import { newId } from './library';
import type { Activity, Goal, LocalDate, PlannedSession, Sport, Environment } from './types';

/** Réalisé « fait comme prévu » : recopie les cibles de la séance. */
export function activityFromSession(s: PlannedSession): Activity {
  return {
    id: newId(),
    source: 'manual',
    sport: s.sport,
    environment: s.environment,
    date: s.date,
    durationSec: Math.round(s.targetDurationMin * 60),
    distanceM: s.targetDistanceKm ? Math.round(s.targetDistanceKm * 1000) : undefined,
    elevationM: s.targetElevationM,
    rpe: s.rpe,
    plannedSessionId: s.id,
  };
}

export function blankActivity(date: LocalDate, sport: Sport = 'gravel', environment: Environment = 'outdoor'): Activity {
  return { id: newId(), source: 'manual', sport, environment, date, durationSec: 3600 };
}

export function defaultGoals(): Goal[] {
  return [
    {
      id: 'goal:desertus-2027',
      kind: 'main',
      name: 'Desertus Bikus',
      date: '2027-04-10',
      distanceKm: 1300,
      elevationM: 13000,
      maxDays: 7,
    },
  ];
}
