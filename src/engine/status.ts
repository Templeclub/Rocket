// Cycle de vie d'une séance : prévue, faite, reportée, annulée.
// Fonctions pures : elles renvoient une nouvelle séance et ne modifient jamais l'entrée.
// Aucune séance manquée n'est rattrapée automatiquement : rien ici ne déplace une séance sans action explicite.

import { diffDays } from './dates';
import type { LocalDate, PlannedSession, SessionStatus } from './types';

export const STATUS_LABEL: Record<SessionStatus, string> = {
  planned: 'prévue',
  done: 'faite',
  postponed: 'reportée',
  cancelled: 'annulée',
};

export class TransitionError extends Error {}

/** Une séance « en attente » peut encore être faite, reportée, échangée ou annulée. */
export function isPending(s: Pick<PlannedSession, 'status'>): boolean {
  return s.status === 'planned' || s.status === 'postponed';
}

/** Séance en attente dont la date est passée : elle n'est pas rattrapée, elle est signalée. */
export function isMissed(s: Pick<PlannedSession, 'status' | 'date'>, today: LocalDate): boolean {
  return isPending(s) && diffDays(s.date, today) < 0;
}

const ALLOWED: Record<SessionStatus, SessionStatus[]> = {
  planned: ['done', 'postponed', 'cancelled'],
  postponed: ['done', 'postponed', 'cancelled', 'planned'],
  done: ['planned', 'postponed'],
  cancelled: ['planned', 'postponed'],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return ALLOWED[from].includes(to);
}

function touch(s: PlannedSession, patch: Partial<PlannedSession>, now: number): PlannedSession {
  return { ...s, ...patch, updatedAt: now };
}

/** Statut d'attente selon que la séance est ou non à sa date d'origine. */
function pendingStatusFor(s: PlannedSession): SessionStatus {
  return s.originalDate && s.originalDate !== s.date ? 'postponed' : 'planned';
}

/**
 * Déplace une séance vers une autre date.
 * - garde la toute première date dans `originalDate` ;
 * - revenir à la date d'origine efface le report ;
 * - interdit de reporter dans le passé.
 */
export function postpone(
  s: PlannedSession,
  newDate: LocalDate,
  today: LocalDate,
  now: number = Date.now(),
): PlannedSession {
  if (!isPending(s)) throw new TransitionError(`Impossible de reporter une séance ${STATUS_LABEL[s.status]}.`);
  if (newDate === s.date) throw new TransitionError('La nouvelle date est identique.');
  if (diffDays(newDate, today) < 0) throw new TransitionError('Impossible de reporter dans le passé.');
  const originalDate = s.originalDate ?? s.date;
  if (newDate === originalDate) {
    return touch(s, { date: newDate, originalDate: undefined, status: 'planned' }, now);
  }
  return touch(s, { date: newDate, originalDate, status: 'postponed' }, now);
}

/** Échange les dates de deux séances en attente. */
export function swap(
  a: PlannedSession,
  b: PlannedSession,
  today: LocalDate,
  now: number = Date.now(),
): [PlannedSession, PlannedSession] {
  if (a.id === b.id) throw new TransitionError('Une séance ne peut pas être échangée avec elle-même.');
  if (!isPending(a) || !isPending(b)) throw new TransitionError('Seules des séances en attente peuvent être échangées.');
  if (a.date === b.date) throw new TransitionError('Les deux séances sont le même jour.');
  if (diffDays(a.date, today) < 0 || diffDays(b.date, today) < 0) {
    throw new TransitionError('Impossible d’échanger vers une date passée.');
  }
  return [postpone(a, b.date, today, now), postpone(b, a.date, today, now)];
}

export function cancel(s: PlannedSession, now: number = Date.now()): PlannedSession {
  if (!isPending(s)) throw new TransitionError(`Impossible d’annuler une séance ${STATUS_LABEL[s.status]}.`);
  return touch(s, { status: 'cancelled' }, now);
}

/** Rétablit une séance annulée. */
export function restore(s: PlannedSession, now: number = Date.now()): PlannedSession {
  if (s.status !== 'cancelled') throw new TransitionError('Seule une séance annulée peut être rétablie.');
  return touch(s, { status: pendingStatusFor(s) }, now);
}

export function markDone(s: PlannedSession, now: number = Date.now()): PlannedSession {
  if (!isPending(s)) throw new TransitionError(`Impossible de marquer faite une séance ${STATUS_LABEL[s.status]}.`);
  return touch(s, { status: 'done' }, now);
}

/** Annule le « fait » (le réalisé lié doit être supprimé par l'appelant). */
export function undoDone(s: PlannedSession, now: number = Date.now()): PlannedSession {
  if (s.status !== 'done') throw new TransitionError('La séance n’est pas faite.');
  return touch(s, { status: pendingStatusFor(s) }, now);
}

/** Libellé de statut affiché, avec la notion dérivée de séance manquée. */
export function displayStatus(s: PlannedSession, today: LocalDate): string {
  if (isMissed(s, today)) return 'non faite';
  return STATUS_LABEL[s.status];
}
