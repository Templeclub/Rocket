// Bilan hebdomadaire : rythme réel, plafond de volume et recommandations chiffrées.
// Module pur : il propose des actions, l'interface les applique seulement si je les accepte.

import { CONFIG } from './config';
import { addDays, diffDays, isoWeekday, labelDay, weekDays } from './dates';
import { dayException, REDUCED_KINDS } from './planner';
import { isPending } from './status';
import { inRange, summarize, type WeekSummary } from './stats';
import type { Activity, AppSettings, Justification, LocalDate, PlannedSession, WeekPlan } from './types';
import { formatDuration, formatHours } from './zones';

const R = CONFIG.rules;

export interface RhythmWeek {
  weekStart: LocalDate;
  hours: number;
  sessions: number;
  /** Semaine avant le début du plan sans données : valeur de départ supposée. */
  assumed: boolean;
}

export interface Rhythm {
  hours: number;
  sessions: number;
  weeks: RhythmWeek[];
}

export function weekDone(activities: Activity[], weekStart: LocalDate): { hours: number; sessions: number } {
  const list = activities.filter((a) => inRange(a.date, weekStart, 7));
  return { hours: list.reduce((s, a) => s + a.durationSec / 3600, 0), sessions: list.length };
}

/**
 * R1 : rythme réel = moyenne des heures (et séances) réalisées sur les 4 dernières semaines « normales »
 * avant `before`. Les semaines volontairement réduites (allégée, voyage, affûtage) et celles que j'exclus sont ignorées.
 */
export function realRhythm(p: {
  before: LocalDate;
  activities: Activity[];
  weeks: WeekPlan[];
  startHours: number;
  planStart: LocalDate;
}): Rhythm {
  const byWeek = new Map(p.weeks.map((w) => [w.weekStart, w]));
  const picked: RhythmWeek[] = [];
  for (let k = 1; k <= R.rollingLookbackWeeks && picked.length < R.rollingWeeks; k++) {
    const w = addDays(p.before, -7 * k);
    const plan = byWeek.get(w);
    if (plan && (plan.excluded || REDUCED_KINDS.includes(plan.kind))) continue;
    const done = weekDone(p.activities, w);
    if (w < p.planStart && done.sessions === 0) picked.push({ weekStart: w, hours: p.startHours, sessions: 0, assumed: true });
    else picked.push({ weekStart: w, ...done, assumed: false });
  }
  while (picked.length < R.rollingWeeks) {
    picked.push({ weekStart: addDays(p.before, -7 * (R.rollingLookbackWeeks + picked.length)), hours: p.startHours, sessions: 0, assumed: true });
  }
  const n = picked.length;
  return {
    hours: picked.reduce((s, w) => s + w.hours, 0) / n,
    sessions: picked.reduce((s, w) => s + w.sessions, 0) / n,
    weeks: picked,
  };
}

// --- Recommandations ---

export type ReviewAction =
  | { kind: 'cancel'; sessionId: string }
  | { kind: 'move'; sessionId: string; date: LocalDate }
  | { kind: 'setDuration'; sessionId: string; minutes: number }
  | { kind: 'replan'; fromWeek: LocalDate };

export interface ReviewChoice {
  label: string;
  actions: ReviewAction[];
}

export interface ReviewItem {
  id: string;
  type: 'missed-key' | 'missed-optional' | 'reduce-volume' | 'raise-volume' | 'low-completion' | 'football-intensity' | 'trainer-sequence' | 'behind';
  text: string;
  justification: Justification;
  choices: ReviewChoice[];
}

export interface WeekReview {
  targetWeek: LocalDate;
  previousWeek: LocalDate;
  plan?: WeekPlan;
  previous: WeekSummary;
  previousMissed: PlannedSession[];
  rhythm: Rhythm;
  capFactor: number;
  cap: number;
  plannedHours: number;
  targetSessions: PlannedSession[];
  items: ReviewItem[];
}

/** Séance intense (R7) : RPE élevé, bloc au-dessus du sweet spot ou en zone 4+. */
export function isIntense(s: PlannedSession): boolean {
  if (s.sport === 'football' || s.sport === 'enduro') return false;
  if ((s.rpe ?? 0) >= R.intenseRpe) return true;
  return s.blocks.some(
    (b) => (b.target.ftpPct?.[1] ?? 0) >= R.intenseFtpPct || (b.target.hrZone ?? 0) >= R.intenseHrZone || (b.target.rpe ?? 0) >= R.intenseRpe + 1,
  );
}

const isBike = (s: PlannedSession) => s.sport === 'gravel';
const live = (s: PlannedSession) => s.status !== 'cancelled';
const sacrificable = (s: PlannedSession) => isPending(s) && s.priority === 'optional' && s.sport !== 'football' && s.sport !== 'enduro';
const hours = (list: PlannedSession[]) => list.filter(live).reduce((s, x) => s + x.targetDurationMin / 60, 0);
const h = (v: number) => formatHours(v);

/** Annule des séances optionnelles (les plus longues d'abord), puis raccourcit la plus longue clé. */
function reduceTo(target: number, list: PlannedSession[]): { actions: ReviewAction[]; names: string[]; after: number } {
  let total = hours(list);
  const actions: ReviewAction[] = [];
  const names: string[] = [];
  const opts = list.filter(sacrificable).sort((a, b) => b.targetDurationMin - a.targetDurationMin);
  for (const s of opts) {
    if (total <= target + 1e-6) break;
    actions.push({ kind: 'cancel', sessionId: s.id });
    names.push(`annuler « ${s.title} » du ${labelDay(s.date)} (${formatDuration(s.targetDurationMin * 60)})`);
    total -= s.targetDurationMin / 60;
  }
  if (total > target + 0.1) {
    const longest = list.filter((s) => isPending(s) && s.priority === 'key' && isBike(s)).sort((a, b) => b.targetDurationMin - a.targetDurationMin)[0];
    if (longest) {
      const cut = Math.ceil(((total - target) * 60) / 15) * 15;
      const minutes = Math.max(60, longest.targetDurationMin - cut);
      if (minutes < longest.targetDurationMin) {
        actions.push({ kind: 'setDuration', sessionId: longest.id, minutes });
        names.push(`raccourcir « ${longest.title} » à ${formatDuration(minutes * 60)}`);
        total -= (longest.targetDurationMin - minutes) / 60;
      }
    }
  }
  return { actions, names, after: total };
}

/** Jour libre de la semaine pour déplacer une séance (disponible, sans séance, compatible avec le foot si intense). */
function freeDay(s: PlannedSession, weekStart: LocalDate, list: PlannedSession[], settings: AppSettings, today: LocalDate): LocalDate | null {
  const a = settings.availability;
  const footDays = list.filter((x) => live(x) && x.sport === 'football').map((x) => x.date);
  for (const d of weekDays(weekStart)) {
    if (d < today) continue;
    if (list.some((x) => live(x) && x.date === d)) continue;
    const exc = dayException(d, a);
    if (exc === 'unavailable') continue;
    const t = a.template[isoWeekday(d)];
    const needs = Math.min(s.targetDurationMin, 60);
    const isFree = exc === 'leave' || isoWeekday(d) >= 6;
    if (!isFree && (!t || t.minutes < needs)) continue;
    if (!isFree && t.paris && s.sport !== 'run') continue;
    if (exc === 'runOnly' && s.sport !== 'run') continue;
    if (isIntense(s) && footDays.some((f) => Math.abs(diffDays(f, d)) <= R.footballBufferDays)) continue;
    return d;
  }
  return null;
}

export function buildReview(p: {
  targetWeek: LocalDate;
  today: LocalDate;
  sessions: PlannedSession[];
  activities: Activity[];
  weeks: WeekPlan[];
  settings: AppSettings;
  planStart?: LocalDate;
}): WeekReview {
  const { targetWeek, today, settings } = p;
  const previousWeek = addDays(targetWeek, -7);
  const plan = p.weeks.find((w) => w.weekStart === targetWeek);
  const inWeek = (w: LocalDate) => p.sessions.filter((s) => inRange(s.date, w, 7));
  const target = inWeek(targetWeek);
  const prevList = inWeek(previousWeek);
  const previous = summarize(prevList, p.activities, previousWeek);
  const previousMissed = prevList.filter((s) => isPending(s) && s.date < today);
  const rhythm = realRhythm({
    before: targetWeek,
    activities: p.activities,
    weeks: p.weeks,
    startHours: settings.volume.startWeeklyHours,
    planStart: p.planStart ?? CONFIG.planStart,
  });
  const capFactor = plan?.kind === 'block' ? R.blockWeekCap : R.weeklyVolumeCap;
  const cap = rhythm.hours * capFactor;
  const plannedHours = hours(target);
  const items: ReviewItem[] = [];

  // R2 : séances manquées, jamais rattrapées automatiquement.
  const loaded = plannedHours > cap + R.volumeToleranceH;
  for (const s of previousMissed.filter((x) => x.priority === 'key')) {
    const choices: ReviewChoice[] = [{ label: 'Laisser tomber', actions: [{ kind: 'cancel', sessionId: s.id }] }];
    const d = loaded ? null : freeDay(s, targetWeek, target, settings, today);
    if (d) choices.push({ label: `Déplacer au ${labelDay(d)}`, actions: [{ kind: 'move', sessionId: s.id, date: d }] });
    items.push({
      id: `missed:${s.id}`,
      type: 'missed-key',
      text: `Séance clé non faite : « ${s.title} » (${labelDay(s.date)}). ${
        d ? 'La semaine qui vient n’est pas chargée : tu peux la déplacer ou la laisser tomber.' : loaded ? 'La semaine qui vient est déjà chargée : je propose de la laisser tomber.' : 'Aucun créneau libre compatible : je propose de la laisser tomber.'
      }`,
      justification: { metric: 'volume prévu la semaine suivante', value: plannedHours, threshold: cap, unit: 'h' },
      choices,
    });
  }
  const missedOpt = previousMissed.filter((x) => x.priority === 'optional');
  if (missedOpt.length) {
    items.push({
      id: `missed-opt:${previousWeek}`,
      type: 'missed-optional',
      text: `${missedOpt.length} séance${missedOpt.length > 1 ? 's' : ''} optionnelle${missedOpt.length > 1 ? 's' : ''} non faite${missedOpt.length > 1 ? 's' : ''} : ${missedOpt.map((s) => s.title).join(', ')}. Elles ne sont pas rattrapées.`,
      justification: { metric: 'séances optionnelles non faites', value: missedOpt.length, threshold: 0 },
      choices: [{ label: 'Les marquer annulées', actions: missedOpt.map((s) => ({ kind: 'cancel' as const, sessionId: s.id })) }],
    });
  }

  // R3 : plafond de volume.
  if (loaded) {
    const r = reduceTo(cap, target);
    if (r.actions.length) {
      items.push({
        id: `reduce:${targetWeek}`,
        type: 'reduce-volume',
        text: `Volume prévu ${h(plannedHours)} au-dessus du plafond ${h(cap)} (rythme réel ${h(rhythm.hours)} × ${String(capFactor).replace('.', ',')}). Je propose de ${r.names.join(', puis ')} : ${h(r.after)}.`,
        justification: { metric: 'volume prévu', value: plannedHours, threshold: cap, unit: 'h' },
        choices: [{ label: 'Alléger la semaine', actions: r.actions }],
      });
    }
  } else if (plan && (plan.kind === 'load' || plan.kind === 'block') && cap - plannedHours >= R.raiseMinGapH) {
    // Le pic n'est relevé que si le rythme réel le permet.
    const longest = target.filter((s) => isPending(s) && s.priority === 'key' && isBike(s) && s.environment === 'outdoor').sort((a, b) => b.targetDurationMin - a.targetDurationMin)[0];
    const recentLongest = Math.max(
      0,
      ...p.activities.filter((a) => a.sport === 'gravel' && diffDays(targetWeek, a.date) <= 28 && diffDays(targetWeek, a.date) > 0).map((a) => a.durationSec / 60),
    );
    if (longest) {
      const room = Math.min((cap - plannedHours) * 60, R.longestRideIncreaseMin, Math.max(0, recentLongest + R.longestRideIncreaseMin - longest.targetDurationMin));
      const add = Math.floor(room / 15) * 15;
      if (add >= 15) {
        items.push({
          id: `raise:${targetWeek}`,
          type: 'raise-volume',
          text: `Ton rythme réel (${h(rhythm.hours)}) permet jusqu’à ${h(cap)} ; ${h(plannedHours)} prévues. Je propose d’allonger « ${longest.title} » de ${add} min (${formatDuration((longest.targetDurationMin + add) * 60)}).`,
          justification: { metric: 'plafond disponible', value: cap, threshold: plannedHours, unit: 'h' },
          choices: [{ label: `Allonger de ${add} min`, actions: [{ kind: 'setDuration', sessionId: longest.id, minutes: longest.targetDurationMin + add }] }],
        });
      }
    }
  }

  // R3 bis : taux de réalisation bas deux semaines de suite.
  const rates = Array.from({ length: R.lowCompletionWeeks }, (_, k) => {
    const w = addDays(targetWeek, -7 * (k + 1));
    return summarize(inWeek(w), p.activities, w).completionRate;
  });
  if (rates.every((r) => r !== null && r < R.lowCompletionThreshold)) {
    const r = reduceTo(plannedHours * (1 - R.lowCompletionReduction), target);
    if (r.actions.length) {
      items.push({
        id: `low:${targetWeek}`,
        type: 'low-completion',
        text: `Taux de réalisation sous ${Math.round(R.lowCompletionThreshold * 100)} % deux semaines de suite (${rates.map((x) => `${Math.round(x! * 100)} %`).join(', ')}). Je propose de baisser la cible de ${Math.round(R.lowCompletionReduction * 100)} % : ${r.names.join(', ')}.`,
        justification: { metric: 'taux de réalisation', value: Math.round(rates[0]! * 100), threshold: Math.round(R.lowCompletionThreshold * 100), unit: '%' },
        choices: [{ label: 'Baisser la cible', actions: r.actions }],
      });
    }
  }

  // R7 : pas de séance intense la veille, le jour ou le lendemain du foot.
  const foot = target.filter((s) => live(s) && s.sport === 'football');
  for (const s of target.filter((x) => isPending(x) && isIntense(x))) {
    const f = foot.find((x) => Math.abs(diffDays(x.date, s.date)) <= R.footballBufferDays);
    if (!f) continue;
    const d = freeDay(s, targetWeek, target.filter((x) => x.id !== s.id), settings, today);
    const gap = diffDays(s.date, f.date);
    items.push({
      id: `foot:${s.id}`,
      type: 'football-intensity',
      text: `« ${s.title} » (${labelDay(s.date)}) tombe ${gap === 0 ? 'le jour' : gap < 0 ? 'la veille' : 'le lendemain'} du foot (${labelDay(f.date)}).${d ? ` Je propose de la déplacer au ${labelDay(d)}.` : ''}`,
      justification: { metric: 'jours d’écart avec le foot', value: Math.abs(gap), threshold: R.footballBufferDays + 1, unit: 'j' },
      choices: d ? [{ label: `Déplacer au ${labelDay(d)}`, actions: [{ kind: 'move', sessionId: s.id, date: d }] }] : [],
    });
  }

  // R6 : extérieur, home-trainer, extérieur sur 3 jours consécutifs (le vélo doit être démonté puis remonté).
  const bikes = p.sessions.filter((s) => live(s) && isBike(s) && inRange(s.date, addDays(targetWeek, -1), 9));
  const envOn = (d: LocalDate) => bikes.filter((s) => s.date === d).map((s) => s.environment);
  for (const d of weekDays(targetWeek)) {
    const mid = bikes.find((s) => s.date === d && s.environment === 'indoor' && isPending(s));
    if (!mid) continue;
    if (envOn(addDays(d, -1)).includes('outdoor') && envOn(addDays(d, 1)).includes('outdoor')) {
      const choices: ReviewChoice[] = [];
      if (mid.priority === 'optional') choices.push({ label: 'Laisser tomber la séance HT', actions: [{ kind: 'cancel', sessionId: mid.id }] });
      items.push({
        id: `seq:${mid.id}`,
        type: 'trainer-sequence',
        text: `Extérieur, home-trainer (« ${mid.title} », ${labelDay(d)}), extérieur : le vélo doit être monté puis démonté (${R.trainerSwapMin * 2} min). Regroupe les séances home-trainer sur des jours qui se suivent.`,
        justification: { metric: 'jours consécutifs ext./HT/ext.', value: 3, threshold: R.trainerSequenceDays, unit: 'j' },
        choices,
      });
    }
  }

  // R10 : réalisé en retard sur le plan → le dire, proposer de recalculer (et de raccourcir le spécifique).
  const counted = rhythm.weeks.filter((w) => !w.assumed).slice(0, R.behindWeeks);
  const behind = counted.length === R.behindWeeks && counted.every((w) => {
    const pw = p.weeks.find((x) => x.weekStart === w.weekStart);
    return pw && w.hours < pw.targetHours * R.behindRatio;
  });
  if (behind) {
    const ratio = counted.reduce((s, w) => s + w.hours, 0) / counted.reduce((s, w) => s + (p.weeks.find((x) => x.weekStart === w.weekStart)?.targetHours ?? 0), 0);
    items.push({
      id: `behind:${targetWeek}`,
      type: 'behind',
      text: `Ton réalisé est en retard sur le plan depuis ${R.behindWeeks} semaines (${Math.round(ratio * 100)} % des heures prévues). Je propose de recalculer le programme à partir de ton rythme réel${
        plan?.phase === 'specific' || plan?.phase === 'development' ? ' plutôt que de forcer : le spécifique sera raccourci' : ''
      }.`,
      justification: { metric: 'réalisé / prévu', value: Math.round(ratio * 100), threshold: Math.round(R.behindRatio * 100), unit: '%' },
      choices: [{ label: 'Recalculer le programme', actions: [{ kind: 'replan', fromWeek: targetWeek }] }],
    });
  }

  return { targetWeek, previousWeek, plan, previous, previousMissed, rhythm, capFactor, cap, plannedHours, targetSessions: target, items };
}

/** Semaine à confirmer : la suivante à partir du samedi, sinon la semaine en cours (lundi, mardi) si elle ne l'est pas. */
export function weekToConfirm(today: LocalDate, weeks: WeekPlan[]): LocalDate | null {
  const wd = isoWeekday(today);
  const monday = addDays(today, 1 - wd);
  const candidates = wd >= 6 ? [addDays(monday, 7)] : wd <= 2 ? [monday] : [];
  for (const c of candidates) {
    const w = weeks.find((x) => x.weekStart === c);
    if (w && !w.confirmedAt) return c;
  }
  return null;
}
