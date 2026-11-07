// Évaluation d'une semaine par rapport au programme :
// - signalements sur les séances (recommandées ou confirmées) qui ne collent plus (Paris, foot, R7, doublons) ;
// - suivi du programme (en retard, dans le plan, en avance) sur les dernières semaines terminées ;
// - reconstruction d'une semaine en gardant le réalisé et les séances manuelles.

import { CONFIG } from './config';
import { diffDays, labelDay, weekDays } from './dates';
import { buildWeek, dayException, footballDaysOf, parisDaysOf, parisRunDay, raceWeekOf } from './planner';
import { isIntense, realRhythm, weekDone } from './review';
import { isEndurance } from './sports';
import { isPending } from './status';
import { inRange } from './stats';
import type { Activity, AppSettings, Goal, LocalDate, Phase, PlannedSession, WeekPlan } from './types';
import { formatHours } from './zones';

export interface Issue {
  sessionId?: string;
  date: LocalDate;
  text: string;
}

/** Ce qui ne colle plus dans la semaine (à partir d'aujourd'hui). */
export function weekIssues(p: { weekStart: LocalDate; sessions: PlannedSession[]; settings: AppSettings; today: LocalDate; plan?: WeekPlan }): Issue[] {
  const a = p.settings.availability;
  const paris = new Set(parisDaysOf(p.weekStart, a));
  const footDays = p.plan?.kind === 'travel' ? [] : footballDaysOf(p.weekStart, a);
  const list = p.sessions.filter((s) => inRange(s.date, p.weekStart, 7) && s.status !== 'cancelled');
  const future = list.filter((s) => isPending(s) && s.date >= p.today);
  const football = list.filter((s) => s.sport === 'football');
  const issues: Issue[] = [];

  const runDay = parisRunDay(p.weekStart, a);
  for (const s of future) {
    const exc = dayException(s.date, a);
    // Course générée à Paris : uniquement le 2e jour de présence (aucune si un seul jour).
    if (s.sport === 'run' && s.origin === 'generated' && paris.has(s.date) && s.date !== runDay) {
      issues.push({ sessionId: s.id, date: s.date, text: runDay ? `À Paris, la course se place le 2e jour (${labelDay(runDay)}).` : 'Un seul jour à Paris : pas de course prévue.' });
      continue;
    }
    if (s.sport === 'football' && paris.has(s.date)) {
      issues.push({ sessionId: s.id, date: s.date, text: 'Tu es à Paris ce jour-là : pas de foot.' });
      continue;
    }
    if (paris.has(s.date) && s.sport !== 'run') issues.push({ sessionId: s.id, date: s.date, text: 'Jour à Paris : course uniquement.' });
    else if ((exc === 'runOnly' && s.sport !== 'run') || exc === 'unavailable') issues.push({ sessionId: s.id, date: s.date, text: exc === 'runOnly' ? 'Course uniquement ce jour-là.' : 'Jour indisponible.' });
    else if (footDays.includes(s.date) && s.sport !== 'football') issues.push({ sessionId: s.id, date: s.date, text: 'Jour de foot : le foot est prioritaire.' });
    else if (isIntense(s) && football.some((f) => Math.abs(diffDays(f.date, s.date)) <= CONFIG.rules.footballBufferDays)) {
      issues.push({ sessionId: s.id, date: s.date, text: 'Séance intense à côté du foot (R7).' });
    }
    if (list.filter((x) => x.date === s.date).length > 1 && s === list.filter((x) => x.date === s.date).find((x) => isPending(x))) {
      issues.push({ sessionId: s.id, date: s.date, text: 'Deux séances le même jour.' });
    }
  }
  for (const d of footDays) {
    if (d < p.today) continue;
    if (!football.some((f) => f.date === d)) issues.push({ date: d, text: `Foot du ${labelDay(d)} non prévu.` });
  }
  return issues;
}

export type ProgressStatus = 'start' | 'behind' | 'on-track' | 'ahead';

export interface Progress {
  status: ProgressStatus;
  /** Semaines terminées prises en compte. */
  weeks: { weekStart: LocalDate; doneH: number; targetH: number }[];
  doneH: number;
  targetH: number;
  ratio: number;
  /** Rythme réel (heures d'endurance) et cible qu'il permet. */
  rhythmH: number;
  allowedH: number;
  /** Cible actuelle de la semaine évaluée. */
  weekTargetH: number;
  text: string;
}

/** Suivi du programme : réalisé / prévu sur les dernières semaines terminées avant `weekStart`. */
export function programProgress(p: { weekStart: LocalDate; today: LocalDate; weeks: WeekPlan[]; activities: Activity[]; settings: AppSettings }): Progress {
  const C = CONFIG.progress;
  const plan = p.weeks.find((w) => w.weekStart === p.weekStart);
  const done = p.weeks
    .filter((w) => w.weekStart < p.weekStart && diffDays(p.today, w.weekStart) >= 7 && !w.excluded && w.kind !== 'travel')
    .sort((x, y) => y.weekStart.localeCompare(x.weekStart))
    .slice(0, C.weeks)
    .map((w) => ({ weekStart: w.weekStart, doneH: weekDone(p.activities, w.weekStart).hours, targetH: w.targetHours }));
  const doneH = done.reduce((s, w) => s + w.doneH, 0);
  const targetH = done.reduce((s, w) => s + w.targetH, 0);
  const ratio = targetH > 0 ? doneH / targetH : 1;
  const rhythm = realRhythm({ before: p.weekStart, activities: p.activities, weeks: p.weeks, startHours: p.settings.volume.startWeeklyHours, planStart: CONFIG.planStart });
  const factor = plan?.kind === 'block' ? CONFIG.rules.blockWeekCap : CONFIG.rules.weeklyVolumeCap;
  const allowedH = rhythm.hours * factor;
  const weekTargetH = plan?.targetHours ?? 0;
  let status: ProgressStatus = 'on-track';
  if (!done.length) status = 'start';
  else if (ratio < C.behindRatio) status = 'behind';
  else if (ratio > C.aheadRatio) status = 'ahead';

  const n = done.length;
  const pct = Math.round(ratio * 100);
  const text =
    status === 'start'
      ? 'Début du programme : pas encore de semaine terminée à comparer.'
      : status === 'behind'
        ? `En retard : ${formatHours(doneH)} faites sur ${formatHours(targetH)} prévues (${pct} %) sur ${n} semaine${n > 1 ? 's' : ''}. Ton rythme réel (${formatHours(rhythm.hours)}) permet ${formatHours(allowedH)} cette semaine.`
        : status === 'ahead'
          ? `En avance : ${formatHours(doneH)} faites sur ${formatHours(targetH)} prévues (${pct} %). Ton rythme réel (${formatHours(rhythm.hours)}) permet ${formatHours(allowedH)} cette semaine.`
          : `Dans le plan : ${formatHours(doneH)} faites sur ${formatHours(targetH)} prévues (${pct} %) sur ${n} semaine${n > 1 ? 's' : ''}.`;
  return { status, weeks: done, doneH, targetH, ratio, rhythmH: rhythm.hours, allowedH, weekTargetH, text };
}

/**
 * Reconstruit une semaine avec les disponibilités actuelles (jours à Paris, foot…).
 * Gardées : séances faites, séances manuelles en attente, et tout ce qui est avant `fromDate`.
 * Renvoie les nouvelles séances (recommandées) et celles à retirer.
 */
export function rebuildWeek(p: {
  week: WeekPlan;
  weeks: WeekPlan[];
  sessions: PlannedSession[];
  settings: AppSettings;
  goal: Goal;
  fromDate: LocalDate;
  now?: number;
}): { add: PlannedSession[]; remove: PlannedSession[] } {
  const inWeek = p.sessions.filter((s) => inRange(s.date, p.week.weekStart, 7));
  const remove = inWeek.filter((s) => s.origin === 'generated' && isPending(s) && s.date >= p.fromDate);
  const keep = inWeek.filter((s) => !remove.includes(s) && s.status !== 'cancelled');
  const occupied = new Set<LocalDate>(keep.map((s) => s.date));
  for (const d of weekDays(p.week.weekStart)) if (d < p.fromDate) occupied.add(d);
  const keptMin = keep.filter((s) => isEndurance(s.sport)).reduce((t, s) => t + s.targetDurationMin, 0);

  const prior = p.weeks.filter((w) => w.weekStart < p.week.weekStart);
  const intenseCount: Record<Phase, number> = { base: 0, development: 0, specific: 0, taper: 0 };
  let specificCount = 0;
  for (const w of prior) {
    if (w.kind === 'load' || w.kind === 'block') {
      intenseCount[w.phase]++;
      if (w.phase === 'specific') specificCount++;
    }
  }
  const lastLoad = p.weeks.filter((w) => w.kind === 'load' && w.weekStart < raceWeekOf(p.goal)).at(-1);
  const week = { ...p.week, notes: [...p.week.notes] };
  const add = buildWeek(week, {
    settings: p.settings,
    goal: p.goal,
    occupied,
    keptMin,
    longest: Math.max(CONFIG.startVolume.longestRideMin, ...prior.map((w) => w.longRideMin)),
    intenseCount,
    specificCount,
    lastLoadBeforeTaper: lastLoad?.weekStart === p.week.weekStart && p.week.phase === 'specific',
    now: p.now ?? Date.now(),
  });
  // Une séance identique déjà en place est gardée telle quelle (avec sa confirmation) : pas de bruit dans l'aperçu.
  const same = (x: PlannedSession, y: PlannedSession) =>
    x.date === y.date && x.sport === y.sport && x.environment === y.environment && x.title === y.title && x.targetDurationMin === y.targetDurationMin;
  const kept = new Set<PlannedSession>();
  const addOut = add.filter((n) => {
    const old = remove.find((o) => !kept.has(o) && same(o, n));
    if (old) kept.add(old);
    return !old;
  });
  return { add: addOut, remove: remove.filter((o) => !kept.has(o)) };
}

