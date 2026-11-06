// Programme : génération, recalcul, bilan hebdomadaire et confirmation.

import { CONFIG } from '../engine/config';
import { addDays, diffDays } from '../engine/dates';
import { newId } from '../engine/library';
import { defaultStartWeek, generatePlan } from '../engine/planner';
import { buildReview, realRhythm, type ReviewAction, type ReviewItem, type WeekReview } from '../engine/review';
import { isPending } from '../engine/status';
import type { Goal, LocalDate, Recommendation } from '../engine/types';
import { switchToAlternative } from '../engine/workouts';
import type { Undo } from './actions';
import { db, getSettings, type AsceseDB } from './db';

export async function mainGoal(d: AsceseDB = db): Promise<Goal> {
  const goals = await d.goals.toArray();
  const g = goals.find((x) => x.kind === 'main') ?? goals[0];
  if (!g) throw new Error('Aucun objectif principal.');
  return g;
}

export interface GenerateResult {
  weeks: number;
  sessions: number;
  removedManual: number;
}

/**
 * Génère (ou recalcule) le programme à partir de `fromWeek`.
 * - les semaines déjà confirmées avant `fromWeek` et le réalisé sont conservés ;
 * - les séances générées encore en attente à partir de `fromWeek` sont remplacées ;
 * - les séances manuelles sont gardées, sauf si `removeManual`.
 */
export async function generateProgram(
  opts: { fromWeek?: LocalDate; today: LocalDate; removeManual?: boolean },
  d: AsceseDB = db,
): Promise<GenerateResult> {
  const fromWeek = opts.fromWeek ?? defaultStartWeek(opts.today);
  const [settings, goal, allWeeks, activities] = await Promise.all([getSettings(d), mainGoal(d), d.weeks.toArray(), d.activities.toArray()]);
  const prior = allWeeks.filter((w) => w.weekStart < fromWeek);

  // Reprise : rythme réel si des activités existent, sinon valeur de départ.
  const hasData = activities.some((a) => diffDays(fromWeek, a.date) > 0 && diffDays(fromWeek, a.date) <= 56);
  const rhythm = hasData
    ? realRhythm({ before: fromWeek, activities, weeks: allWeeks, startHours: settings.volume.startWeeklyHours, planStart: CONFIG.planStart })
    : null;
  const longest = Math.max(
    0,
    ...activities.filter((a) => a.sport === 'gravel' && diffDays(fromWeek, a.date) > 0 && diffDays(fromWeek, a.date) <= 28).map((a) => a.durationSec / 60),
  );
  const out = generatePlan({
    startWeek: fromWeek,
    goal,
    settings,
    history: {
      weeks: prior,
      rhythmHours: rhythm ? rhythm.weeks.map((w) => w.hours).reverse() : undefined,
      longestRideMin: longest || undefined,
    },
  });

  let removedManual = 0;
  await d.transaction('rw', d.sessions, d.weeks, async () => {
    const future = await d.sessions.where('date').aboveOrEqual(fromWeek).toArray();
    const toDelete = future.filter((s) => (s.origin === 'generated' && s.status !== 'done') || (opts.removeManual && s.origin === 'manual' && isPending(s)));
    removedManual = toDelete.filter((s) => s.origin === 'manual').length;
    await d.sessions.bulkDelete(toDelete.map((s) => s.id));
    await d.weeks.where('weekStart').aboveOrEqual(fromWeek).delete();
    await d.weeks.bulkPut(out.weeks);
    await d.sessions.bulkAdd(out.sessions);
  });
  return { weeks: out.weeks.length, sessions: out.sessions.length, removedManual };
}

export async function countManualFrom(fromWeek: LocalDate, d: AsceseDB = db): Promise<number> {
  return (await d.sessions.where('date').aboveOrEqual(fromWeek).toArray()).filter((s) => s.origin === 'manual' && isPending(s)).length;
}

export async function loadReview(targetWeek: LocalDate, today: LocalDate, d: AsceseDB = db): Promise<WeekReview> {
  const from = addDays(targetWeek, -7 * (CONFIG.rules.rollingLookbackWeeks + 1));
  const [settings, weeks, sessions, activities] = await Promise.all([
    getSettings(d),
    d.weeks.toArray(),
    d.sessions.where('date').between(from, addDays(targetWeek, 7), true, false).toArray(),
    d.activities.where('date').between(from, addDays(targetWeek, 7), true, false).toArray(),
  ]);
  return buildReview({ targetWeek, today, sessions, activities, weeks, settings });
}

/** Applique un choix de recommandation (hors recalcul du programme). */
export async function applyActions(actions: ReviewAction[], d: AsceseDB = db): Promise<Undo> {
  const ids = [...new Set(actions.flatMap((a) => ('sessionId' in a ? [a.sessionId] : [])))];
  const before = await d.sessions.bulkGet(ids);
  const now = Date.now();
  await d.transaction('rw', d.sessions, async () => {
    for (const a of actions) {
      if (a.kind === 'replan') continue;
      const s = await d.sessions.get(a.sessionId);
      if (!s) continue;
      if (a.kind === 'cancel' && isPending(s)) await d.sessions.put({ ...s, status: 'cancelled', updatedAt: now });
      if (a.kind === 'setDuration') {
        const ratio = a.minutes / s.targetDurationMin;
        await d.sessions.put({
          ...s,
          targetDurationMin: a.minutes,
          targetDistanceKm: s.targetDistanceKm ? Math.round(s.targetDistanceKm * ratio) : undefined,
          targetElevationM: s.targetElevationM ? Math.round((s.targetElevationM * ratio) / 50) * 50 : undefined,
          blocks: scaleMainBlock(s.blocks, a.minutes - s.targetDurationMin),
          updatedAt: now,
        });
      }
      if (a.kind === 'move' && isPending(s)) {
        const originalDate = s.originalDate ?? s.date;
        await d.sessions.put({ ...s, date: a.date, originalDate: a.date === originalDate ? undefined : originalDate, status: a.date === originalDate ? 'planned' : 'postponed', updatedAt: now });
      }
    }
  });
  return async () => {
    await d.sessions.bulkPut(before.filter((x): x is NonNullable<typeof x> => !!x));
  };
}

/** Allonge ou raccourcit le bloc le plus long pour garder des blocs cohérents avec la durée. */
function scaleMainBlock<T extends { durationSec?: number; repeat: number }>(blocks: T[], deltaMin: number): T[] {
  if (!blocks.length) return blocks;
  let idx = 0;
  blocks.forEach((b, i) => {
    if ((b.durationSec ?? 0) * b.repeat > (blocks[idx].durationSec ?? 0) * blocks[idx].repeat) idx = i;
  });
  return blocks.map((b, i) => (i === idx && b.repeat === 1 && b.durationSec ? { ...b, durationSec: Math.max(300, b.durationSec + deltaMin * 60) } : b));
}

export type Decision = { item: ReviewItem; choiceIndex: number | null };

/** Confirme la semaine : enregistre chaque recommandation (acceptée ou ignorée) avec sa justification. */
export async function confirmWeek(weekStart: LocalDate, decisions: Decision[], d: AsceseDB = db): Promise<void> {
  const now = Date.now();
  const recs: Recommendation[] = decisions.map(({ item, choiceIndex }) => ({
    id: `${weekStart}:${item.id}:${newId().slice(0, 8)}`,
    weekStart,
    type: item.type,
    text: item.text,
    justification: item.justification,
    status: choiceIndex === null ? 'ignored' : 'accepted',
    choice: choiceIndex === null ? undefined : item.choices[choiceIndex]?.label,
    decidedAt: now,
  }));
  await d.transaction('rw', d.weeks, d.recommendations, async () => {
    await d.recommendations.bulkPut(recs);
    const w = await d.weeks.get(weekStart);
    if (w) await d.weeks.put({ ...w, confirmedAt: now });
  });
}

export async function setWeekExcluded(weekStart: LocalDate, excluded: boolean, d: AsceseDB = db): Promise<void> {
  const w = await d.weeks.get(weekStart);
  if (w) await d.weeks.put({ ...w, excluded });
}

/** Bascule en 1 tap sur la variante (home-trainer ↔ extérieur, course ↔ natation). */
export async function switchVariant(sessionId: string, d: AsceseDB = db): Promise<Undo> {
  const s = await d.sessions.get(sessionId);
  if (!s?.alternative) throw new Error('Pas de variante pour cette séance.');
  await d.sessions.put({ ...switchToAlternative(s), updatedAt: Date.now() });
  return async () => void (await d.sessions.put(s));
}
