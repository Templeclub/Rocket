// Jalon « sortie de 6 h » : la poser, la déplacer ou la retirer ; la semaine concernée est réajustée autour.

import { CONFIG } from '../engine/config';
import { addDays, startOfWeek, todayLocal } from '../engine/dates';
import { rebuildWeek } from '../engine/evaluate';
import { newId } from '../engine/library';
import { milestoneTitle } from '../engine/milestone';
import type { Goal, LocalDate, PlannedSession } from '../engine/types';
import { longRide, trainerVariant } from '../engine/workouts';
import type { Undo } from './actions';
import { db, getSettings, type AsceseDB } from './db';
import { mainGoal } from './program';

export const LONG_RIDE_ID = 'milestone:long-ride';

export async function getLongRide(d: AsceseDB = db): Promise<Goal | undefined> {
  return d.goals.get(LONG_RIDE_ID);
}

async function snapshotWeeks(weekStarts: LocalDate[], d: AsceseDB): Promise<Undo> {
  const ranges = await Promise.all(weekStarts.map((w) => d.sessions.where('date').between(w, addDays(w, 7), true, false).toArray()));
  const before = ranges.flat();
  const goal = await d.goals.get(LONG_RIDE_ID);
  return async () => {
    await d.transaction('rw', d.sessions, d.goals, async () => {
      for (const w of weekStarts) await d.sessions.where('date').between(w, addDays(w, 7), true, false).delete();
      await d.sessions.bulkPut(before);
      if (goal) await d.goals.put(goal);
      else await d.goals.delete(LONG_RIDE_ID);
    });
  };
}

/** Réajuste une semaine du programme autour des séances gardées (faites, manuelles, jalon). */
async function reflowWeek(weekStart: LocalDate, today: LocalDate, d: AsceseDB): Promise<void> {
  const [settings, goal, weeks, sessions] = await Promise.all([
    getSettings(d),
    mainGoal(d),
    d.weeks.toArray(),
    d.sessions.where('date').between(weekStart, addDays(weekStart, 7), true, false).toArray(),
  ]);
  const week = weeks.find((w) => w.weekStart === weekStart);
  if (!week) return;
  const r = rebuildWeek({ week, weeks, sessions, settings, goal, fromDate: today > weekStart ? today : weekStart });
  await d.sessions.bulkDelete(r.remove.map((s) => s.id));
  await d.sessions.bulkAdd(r.add);
}

/** Pose (ou déplace) la sortie longue à cette date, pour cette durée. Renvoie l'annulation. */
export async function placeLongRide(
  date: LocalDate,
  minutes: number = CONFIG.longRideMilestone.defaultMin,
  opts: { loaded?: boolean; today?: LocalDate } = {},
  d: AsceseDB = db,
): Promise<Undo> {
  const today = opts.today ?? todayLocal();
  const prev = await d.goals.get(LONG_RIDE_ID);
  const prevSession = prev?.sessionId ? await d.sessions.get(prev.sessionId) : undefined;
  const weeksTouched = [...new Set([startOfWeek(date), ...(prevSession ? [startOfWeek(prevSession.date)] : [])])];
  const undo = await snapshotWeeks(weeksTouched, d);
  const week = (await d.weeks.get(startOfWeek(date)))!;
  const phase = week?.phase ?? 'specific';
  const now = Date.now();
  const c = longRide(minutes, phase, {
    title: milestoneTitle(minutes),
    loaded: opts.loaded,
    priority: 'key',
    note: 'Jalon de préparation : ta plus longue sortie avant le Desertus. Pars tôt, mange toutes les 45 min, teste le matériel et le rythme que tu tiendras sur l’épreuve.',
  });
  const session: PlannedSession = {
    ...c,
    id: prevSession?.id ?? newId(),
    date,
    status: 'planned',
    origin: 'manual',
    confirmed: true,
    milestone: true,
    alternative: trainerVariant(minutes, 'key'),
    createdAt: prevSession?.createdAt ?? now,
    updatedAt: now,
  };
  await d.transaction('rw', d.sessions, d.goals, d.weeks, d.settings, async () => {
    // La sortie remplace les sorties vélo prévues ce jour-là.
    const sameDay = await d.sessions.where('date').equals(date).toArray();
    await d.sessions.bulkDelete(sameDay.filter((s) => s.id !== session.id && s.sport === 'gravel' && s.status !== 'done').map((s) => s.id));
    await d.sessions.put(session);
    await d.goals.put({
      id: LONG_RIDE_ID,
      kind: 'milestone',
      milestoneType: 'longRide',
      name: milestoneTitle(minutes),
      date,
      durationMin: minutes,
      distanceKm: c.targetDistanceKm,
      elevationM: c.targetElevationM,
      sessionId: session.id,
    });
    for (const w of weeksTouched) await reflowWeek(w, today, d);
  });
  return undo;
}

/** Retire la sortie longue ; la semaine retrouve son programme. */
export async function removeLongRide(opts: { today?: LocalDate } = {}, d: AsceseDB = db): Promise<Undo> {
  const today = opts.today ?? todayLocal();
  const g = await d.goals.get(LONG_RIDE_ID);
  const s = g?.sessionId ? await d.sessions.get(g.sessionId) : undefined;
  const w = startOfWeek(s?.date ?? g?.date ?? today);
  const undo = await snapshotWeeks([w], d);
  await d.transaction('rw', d.sessions, d.goals, d.weeks, d.settings, async () => {
    if (s) await d.sessions.delete(s.id);
    await d.goals.delete(LONG_RIDE_ID);
    await reflowWeek(w, today, d);
  });
  return undo;
}
