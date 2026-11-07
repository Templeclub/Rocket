// Motivation : jauge de préparation au Desertus, semaines tenues (avec joker), points et niveaux.
// Principe : on récompense la régularité et les bonnes décisions, jamais le volume en plus du plan.
// Module pur, toutes les valeurs dans CONFIG.gamification.

import { CONFIG } from './config';
import { diffDays, labelWeek, startOfWeek } from './dates';
import { realRhythm, weekDone } from './review';
import { isEndurance } from './sports';
import { isPending } from './status';
import { inRange } from './stats';
import type { Activity, AppSettings, Goal, LocalDate, PlannedSession, Sport, WeekPlan } from './types';
import { formatDuration, formatHours } from './zones';

const G = CONFIG.gamification;

export interface GameInput {
  today: LocalDate;
  weeks: WeekPlan[];
  sessions: PlannedSession[];
  activities: Activity[];
  settings: AppSettings;
  goal?: Goal;
}

// --- 3. Semaines tenues ---

export type HeldStatus = 'held' | 'joker' | 'missed' | 'excluded';

export interface WeekHeld {
  weekStart: LocalDate;
  status: HeldStatus;
  /** Pourquoi (affiché tel quel). */
  reason: string;
}

const isKey = (s: PlannedSession) => s.priority === 'key' && s.sport !== 'football' && s.sport !== 'enduro';

/** Une semaine est-elle tenue ? (sans le joker) */
export function judgeWeek(w: WeekPlan, sessions: PlannedSession[], activities: Activity[]): { ok: boolean; reason: string } {
  const list = sessions.filter((s) => inRange(s.date, w.weekStart, 7));
  const done = weekDone(activities, w.weekStart).hours;
  const ratio = w.targetHours > 0 ? done / w.targetHours : 1;
  const pct = `${Math.round(ratio * 100)} %`;
  if (w.kind === 'travel') {
    const ok = activities.some((a) => inRange(a.date, w.weekStart, 7) && isEndurance(a.sport));
    return { ok, reason: ok ? 'Voyage : tu as bougé.' : 'Voyage : aucune sortie.' };
  }
  if (w.kind === 'light' || w.kind === 'taper' || w.kind === 'race') {
    if (ratio > G.held.lightMaxRatio) return { ok: false, reason: `Semaine de repos dépassée (${pct} du prévu).` };
    if (ratio < G.held.lightMinRatio) return { ok: false, reason: `Trop peu bougé (${pct} du prévu).` };
    return { ok: true, reason: `Repos respecté (${pct} du prévu).` };
  }
  const keys = list.filter(isKey);
  const left = keys.filter(isPending);
  const doneKeys = keys.filter((s) => s.status === 'done');
  if (left.length) return { ok: false, reason: `Séance clé non faite et non replanifiée : ${left[0].title}.` };
  if (keys.length && !doneKeys.length) return { ok: false, reason: 'Aucune séance clé faite.' };
  if (ratio < G.held.loadMinRatio) return { ok: false, reason: `${pct} des heures prévues (il faut ${Math.round(G.held.loadMinRatio * 100)} %).` };
  return { ok: true, reason: `${doneKeys.length} séance${doneKeys.length > 1 ? 's' : ''} clé${doneKeys.length > 1 ? 's' : ''}, ${pct} des heures.` };
}

export interface HeldSummary {
  weeks: WeekHeld[];
  /** Série en cours (semaines tenues ou sauvées par un joker, d'affilée). */
  streak: number;
  best: number;
  held: number;
  jokersUsed: number;
  /** Joker encore disponible ce mois-ci. */
  jokerLeft: boolean;
  /** Ce qu'il reste pour tenir la semaine en cours. */
  current?: { weekStart: LocalDate; todo: string[]; ok: boolean };
}

export function heldWeeks(p: GameInput): HeldSummary {
  const thisWeek = startOfWeek(p.today);
  const done = p.weeks.filter((w) => w.weekStart < thisWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const jokers = new Map<string, number>();
  const out: WeekHeld[] = [];
  for (const w of done) {
    if (w.excluded) {
      out.push({ weekStart: w.weekStart, status: 'excluded', reason: 'Semaine exclue (exceptionnelle).' });
      continue;
    }
    const j = judgeWeek(w, p.sessions, p.activities);
    if (j.ok) out.push({ weekStart: w.weekStart, status: 'held', reason: j.reason });
    else {
      const month = w.weekStart.slice(0, 7);
      const used = jokers.get(month) ?? 0;
      if (used < G.held.jokersPerMonth) {
        jokers.set(month, used + 1);
        out.push({ weekStart: w.weekStart, status: 'joker', reason: `Joker du mois utilisé : ${j.reason}` });
      } else out.push({ weekStart: w.weekStart, status: 'missed', reason: j.reason });
    }
  }
  let streak = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].status === 'missed') break;
    if (out[i].status !== 'excluded') streak++;
  }
  let best = 0;
  let run = 0;
  for (const w of out) {
    if (w.status === 'missed') run = 0;
    else if (w.status !== 'excluded') best = Math.max(best, ++run);
  }

  // Semaine en cours : ce qu'il reste à faire pour la tenir.
  let current: HeldSummary['current'];
  const cw = p.weeks.find((w) => w.weekStart === thisWeek);
  if (cw) {
    const j = judgeWeek(cw, p.sessions, p.activities);
    const todo: string[] = [];
    const list = p.sessions.filter((s) => inRange(s.date, thisWeek, 7));
    const doneH = weekDone(p.activities, thisWeek).hours;
    if (cw.kind === 'load' || cw.kind === 'block') {
      const keys = list.filter((s) => isKey(s) && isPending(s));
      if (keys.length) todo.push(`${keys.length} séance${keys.length > 1 ? 's' : ''} clé${keys.length > 1 ? 's' : ''} à faire ou replanifier`);
      const need = cw.targetHours * G.held.loadMinRatio - doneH;
      if (need > 0.05) todo.push(`encore ${formatHours(need)} d’endurance`);
    } else if (cw.kind === 'light' || cw.kind === 'taper' || cw.kind === 'race') {
      const max = cw.targetHours * G.held.lightMaxRatio;
      todo.push(doneH > max ? 'repos dépassé : lève le pied' : `repos : pas plus de ${formatHours(max)} d’endurance (${formatHours(doneH)} faites)`);
    } else if (cw.kind === 'travel' && !j.ok) todo.push('une sortie de course');
    current = { weekStart: thisWeek, todo, ok: j.ok };
  }
  const month = p.today.slice(0, 7);
  return {
    weeks: out,
    streak,
    best,
    held: out.filter((w) => w.status === 'held').length,
    jokersUsed: out.filter((w) => w.status === 'joker').length,
    jokerLeft: (jokers.get(month) ?? 0) < G.held.jokersPerMonth,
    current,
  };
}

// --- 5. Points et niveaux ---

export function rpeOf(sport: Sport, rpe?: number): number {
  return rpe ?? G.xp.defaultRpe[sport] ?? 4;
}

/** Points d'une séance ou activité : minutes × effort perçu. */
export function xpOf(minutes: number, sport: Sport, rpe?: number): number {
  return Math.round(minutes * rpeOf(sport, rpe));
}

export interface Level {
  index: number;
  name: string;
  xp: number;
  nextName?: string;
  nextXp?: number;
  /** Avancement vers le niveau suivant (0 à 1). */
  progress: number;
}

export interface XpSummary {
  total: number;
  /** Points non comptés car au-delà de la charge prévue (le surplus ne paie pas). */
  capped: number;
  bonus: number;
  level: Level;
  finisher: boolean;
  thisWeek: number;
}

export function levelFor(xp: number, finisher = false): Level {
  const L = G.xp.levels;
  if (finisher) return { index: L.length, name: G.xp.finisher, xp, progress: 1 };
  let i = 0;
  while (i + 1 < L.length && xp >= L[i + 1].xp) i++;
  const next = L[i + 1];
  return {
    index: i,
    name: L[i].name,
    xp,
    nextName: next?.name ?? G.xp.finisher,
    nextXp: next?.xp,
    progress: next ? (xp - L[i].xp) / (next.xp - L[i].xp) : 1,
  };
}

export function xpSummary(p: GameInput, held: HeldSummary): XpSummary {
  const byId = new Map(p.sessions.map((s) => [s.id, s]));
  const raw = new Map<LocalDate, number>();
  for (const a of p.activities) {
    const w = startOfWeek(a.date);
    const linked = a.plannedSessionId ? byId.get(a.plannedSessionId) : undefined;
    raw.set(w, (raw.get(w) ?? 0) + xpOf(a.durationSec / 60, a.sport, a.rpe ?? linked?.rpe));
  }
  const planned = new Map<LocalDate, number>();
  for (const s of p.sessions) {
    if (s.status === 'cancelled') continue;
    const w = startOfWeek(s.date);
    planned.set(w, (planned.get(w) ?? 0) + xpOf(s.targetDurationMin, s.sport, s.rpe));
  }
  let total = 0;
  let capped = 0;
  for (const [w, x] of raw) {
    const cap = planned.get(w);
    const counted = cap !== undefined && cap > 0 ? Math.min(x, cap) : x;
    capped += x - counted;
    total += counted;
  }
  const bonus = held.weeks.filter((w) => w.status === 'held').length * G.xp.heldWeekBonus;
  total += bonus;
  const g = p.goal;
  const finisher = !!g && p.activities.some((a) => a.sport === 'gravel' && diffDays(a.date, g.date) >= 0 && diffDays(a.date, g.date) < (g.maxDays ?? 7));
  const tw = startOfWeek(p.today);
  const thisWeek = Math.min(raw.get(tw) ?? 0, planned.get(tw) ?? Infinity);
  return { total, capped, bonus, level: levelFor(total, finisher), finisher, thisWeek };
}

// --- 1. Jauge de préparation ---

export interface ReadinessPart {
  key: keyof typeof G.readiness.weights;
  label: string;
  /** 0 à 1. */
  score: number;
  weight: number;
  points: number;
  detail: string;
  /** Prochaine marche pour gagner des points. */
  next: string;
}

export interface Readiness {
  percent: number;
  parts: ReadinessPart[];
  /** La composante où il y a le plus de points à prendre. */
  focus: ReadinessPart;
  estimated: boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function readiness(p: GameInput, held: HeldSummary): Readiness {
  const R = G.readiness;
  const W = R.weights;
  // Semaines terminées seulement : la semaine en cours ne fait pas baisser le rythme.
  const before = startOfWeek(p.today);
  const rhythm = realRhythm({ before, activities: p.activities, weeks: p.weeks, startHours: p.settings.volume.startWeeklyHours, planStart: CONFIG.planStart });
  const rides = p.activities.filter((a) => a.sport === 'gravel');
  const longest = Math.max(0, ...rides.map((a) => a.durationSec / 60));
  // Plus longue suite de jours consécutifs avec une sortie d'au moins 2 h.
  const longDays = [...new Set(rides.filter((a) => a.durationSec / 60 >= R.backToBackMinMin).map((a) => a.date))].sort();
  let b2b = 0;
  let run = 0;
  longDays.forEach((d, i) => {
    run = i > 0 && diffDays(d, longDays[i - 1]) === 1 ? run + 1 : 1;
    b2b = Math.max(b2b, run);
  });
  const doneTitles = p.sessions.filter((s) => s.status === 'done' && s.sport === 'gravel');
  const loaded = doneTitles.some((s) => /charg/i.test(s.title));
  const night = doneTitles.some((s) => /nuit/i.test(s.title));
  const climb = Math.max(0, ...rides.map((a) => a.elevationM ?? 0));
  const bigClimb = climb >= R.bigClimbM;
  const totalWeeks = Math.max(1, p.weeks.filter((w) => w.kind !== 'race').length);
  const heldCount = held.weeks.filter((w) => w.status === 'held' || w.status === 'joker').length;

  const part = (key: ReadinessPart['key'], label: string, score: number, detail: string, next: string): ReadinessPart => ({
    key,
    label,
    score: clamp01(score),
    weight: W[key],
    points: Math.round(clamp01(score) * W[key] * 10) / 10,
    detail,
    next,
  });
  const nextRide = Math.min(R.longestRideMin, Math.max(longest, CONFIG.startVolume.longestRideMin) + CONFIG.rules.longestRideIncreaseMin);
  const parts = [
    part(
      'rhythm',
      'Rythme réel',
      rhythm.hours / R.weeklyEnduranceH,
      `${formatHours(rhythm.hours)} d’endurance par semaine sur 4 semaines (objectif ${formatHours(R.weeklyEnduranceH)})`,
      'Tenir tes semaines de charge fait monter le rythme de 10 % à la fois.',
    ),
    part(
      'longest',
      'Plus longue sortie',
      longest / R.longestRideMin,
      longest ? `${formatDuration(longest * 60)} (objectif ${formatDuration(R.longestRideMin * 60)})` : 'Aucune sortie vélo enregistrée',
      `Prochaine marche : une sortie de ${formatDuration(nextRide * 60)}.`,
    ),
    part(
      'backToBack',
      'Jours enchaînés',
      b2b / R.backToBackDays,
      `${b2b} jour${b2b > 1 ? 's' : ''} d’affilée avec 2 h de vélo ou plus (objectif ${R.backToBackDays})`,
      b2b < 2 ? 'Enchaîne deux sorties de 2 h un week-end.' : 'Un bloc de 3 jours (Noël, ou un vendredi posé en spécifique).',
    ),
    part(
      'specific',
      'Spécifique Desertus',
      (Number(loaded) + Number(night) + Number(bigClimb)) / 3,
      [loaded ? '✓ sortie chargée' : '○ sortie chargée', night ? '✓ sortie de nuit' : '○ sortie de nuit', bigClimb ? `✓ ${R.bigClimbM} m D+` : `○ ${R.bigClimbM} m D+ (record ${climb} m)`].join(' · '),
      !loaded ? 'Une sortie avec le vélo chargé.' : !night ? 'Une sortie qui finit de nuit, éclairage testé.' : `Une sortie à ${R.bigClimbM} m de D+.`,
    ),
    part(
      'consistency',
      'Régularité',
      heldCount / totalWeeks,
      `${heldCount} semaine${heldCount > 1 ? 's' : ''} tenue${heldCount > 1 ? 's' : ''} sur ${totalWeeks}`,
      'Chaque semaine tenue compte, les semaines de repos respectées aussi.',
    ),
  ];
  const percent = Math.round(parts.reduce((s, x) => s + x.points, 0));
  const focus = [...parts].sort((a, b) => b.weight - b.points - (a.weight - a.points))[0];
  return { percent, parts, focus, estimated: rhythm.weeks.some((w) => w.assumed) };
}

// --- Tout en un ---

export interface GameState {
  held: HeldSummary;
  xp: XpSummary;
  readiness: Readiness;
}

export function gameState(p: GameInput): GameState {
  const held = heldWeeks(p);
  return { held, xp: xpSummary(p, held), readiness: readiness(p, held) };
}

export function heldLabel(w: WeekHeld): string {
  return `${labelWeek(w.weekStart)} : ${w.status === 'held' ? 'tenue' : w.status === 'joker' ? 'joker' : w.status === 'missed' ? 'manquée' : 'exclue'}`;
}
