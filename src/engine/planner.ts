// Génération du programme jusqu'à l'objectif.
// 1. macro-plan : phase, type de semaine (charge, allégée, bloc, voyage, affûtage) et volume cible ;
// 2. construction de chaque semaine en séances, en respectant les disponibilités et les règles 4 à 8.

import { CONFIG } from './config';
import { addDays, diffDays, isoWeekday, startOfWeek, weekDays } from './dates';
import { newId } from './library';
import { daylight, fitsInDaylight, parseClock } from './sun';
import type {
  AppSettings,
  Availability,
  ExceptionKind,
  Goal,
  LocalDate,
  Phase,
  PlannedSession,
  SessionContent,
  WeekKind,
  WeekPlan,
} from './types';
import {
  football,
  htEndurance,
  htIntense,
  htOpeners,
  longRide,
  outdoorEndurance,
  roundTo,
  run,
  swim,
  trainerVariant,
  type RideEfforts,
  type RunKind,
} from './workouts';

const R = CONFIG.rules;
const P = CONFIG.plan;

export const PHASE_LABEL: Record<Phase, string> = {
  base: 'Base',
  development: 'Développement',
  specific: 'Spécifique',
  taper: 'Affûtage',
};

export const KIND_LABEL: Record<WeekKind, string> = {
  load: 'semaine de charge',
  light: 'semaine allégée',
  block: 'semaine bloc',
  travel: 'voyage, course uniquement',
  taper: 'affûtage',
  race: 'semaine de l’objectif',
};

/** Semaines dont le volume est volontairement réduit : exclues du rythme réel. */
export const REDUCED_KINDS: WeekKind[] = ['light', 'travel', 'taper', 'race'];

export function raceWeekOf(goal: Goal): LocalDate {
  return startOfWeek(goal.date);
}

export function phaseOf(weekStart: LocalDate, raceWeek: LocalDate): Phase {
  if (diffDays(raceWeek, weekStart) < CONFIG.phases.taperWeeks * 7) return 'taper';
  if (weekStart <= CONFIG.phases.baseEnd) return 'base';
  if (weekStart <= CONFIG.phases.devEnd) return 'development';
  return 'specific';
}

export function dayException(date: LocalDate, a: Availability): ExceptionKind | null {
  const e = a.exceptions.find((x) => x.start <= date && date <= x.end);
  return e ? e.kind : null;
}

/** Jours à Paris d'une semaine : saisis dans la vue semaine, sinon ceux de la semaine type (hors congés et voyages). */
export function parisDaysOf(weekStart: LocalDate, a: Availability): LocalDate[] {
  const explicit = a.parisByWeek?.[weekStart];
  if (explicit) return [...explicit].sort();
  return weekDays(weekStart).filter((d) => a.template[isoWeekday(d)]?.paris && dayException(d, a) === null);
}

/** Jour de la course à Paris : le 2e jour de présence (consécutive ou non), sinon aucun. */
export function parisRunDay(weekStart: LocalDate, a: Availability): LocalDate | null {
  const days = parisDaysOf(weekStart, a).filter((d) => {
    const exc = dayException(d, a);
    return exc !== 'runOnly' && exc !== 'unavailable';
  });
  return days.length >= 2 ? days[1] : null;
}

/** Jours de foot d'une semaine : lundi et jeudi, sauf à Paris, en voyage ou indisponible. */
export function footballDaysOf(weekStart: LocalDate, a: Availability): LocalDate[] {
  const paris = new Set(parisDaysOf(weekStart, a));
  return weekDays(weekStart).filter((d) => {
    const exc = dayException(d, a);
    return a.footballDays.includes(isoWeekday(d)) && !paris.has(d) && exc !== 'runOnly' && exc !== 'unavailable';
  });
}

/**
 * Présence à Paris après un tap sur le point d'un jour :
 * - semaine sans Paris → N jours (2 par défaut) à partir du jour touché ;
 * - jour à Paris → retiré ;
 * - autre jour → ajouté seul (on compose ainsi 1, 2, 3 jours… ou des jours non consécutifs).
 */
export function toggleParisDay(current: LocalDate[], day: LocalDate, weekStart: LocalDate, length: number = CONFIG.availability.parisDefaultLength): LocalDate[] {
  if (current.includes(day)) return current.filter((d) => d !== day).sort();
  if (current.length) return [...current, day].sort();
  const end = addDays(weekStart, 6);
  return Array.from({ length }, (_, i) => addDays(day, i)).filter((d) => d <= end);
}

function countDays(weekStart: LocalDate, a: Availability, pred: (k: ExceptionKind | null, wd: number) => boolean): number {
  return weekDays(weekStart).filter((d) => pred(dayException(d, a), isoWeekday(d))).length;
}

const isTravelWeek = (w: LocalDate, a: Availability) => countDays(w, a, (k) => k === 'runOnly' || k === 'unavailable') >= 4;
const isLeaveBlockWeek = (w: LocalDate, a: Availability) => countDays(w, a, (k, wd) => k === 'leave' && wd <= 5) >= R.blockWeekMinLeaveDays;

export interface PlanHistory {
  /** Semaines déjà planifiées avant la date de départ (pour reprendre le cycle). */
  weeks?: WeekPlan[];
  /** Rythme réel connu (heures totales) des dernières semaines normales, la plus récente en dernier. */
  rhythmHours?: number[];
  /** Plus longue sortie récente (minutes). */
  longestRideMin?: number;
}

export interface PlanInput {
  startWeek: LocalDate;
  goal: Goal;
  settings: AppSettings;
  history?: PlanHistory;
  now?: number;
}

const round025 = (h: number) => Math.round(h * 4) / 4;

/** Phase, type et volume cible de chaque semaine, de la semaine de départ à celle de l'objectif. */
export function macroPlan(input: PlanInput): WeekPlan[] {
  const { settings, goal } = input;
  const a = settings.availability;
  const peak = settings.volume.peakWeeklyHours;
  const now = input.now ?? Date.now();
  const raceWeek = raceWeekOf(goal);
  const prior = (input.history?.weeks ?? []).filter((w) => w.weekStart < input.startWeek).sort((x, y) => x.weekStart.localeCompare(y.weekStart));

  // Reprise du cycle : semaines de charge depuis la dernière semaine réduite, et dernière semaine bloc.
  let streak: number;
  let lastBlockIdx = -Infinity;
  let prevKind: WeekKind | undefined = prior.at(-1)?.kind;
  if (prior.length) {
    streak = 0;
    for (let i = prior.length - 1; i >= 0 && !REDUCED_KINDS.includes(prior[i].kind); i--) streak++;
    const lb = [...prior].reverse().find((w) => w.kind === 'block');
    if (lb) lastBlockIdx = -diffDays(input.startWeek, lb.weekStart) / 7;
  } else {
    streak = Math.max(0, diffDays(input.startWeek, R.lastLightWeek) / 7 - 1);
  }
  const rhythm = [...(input.history?.rhythmHours ?? [])];
  while (rhythm.length < R.rollingWeeks) rhythm.unshift(settings.volume.startWeeklyHours);
  let lastLoad = prior.filter((w) => w.kind === 'load').at(-1)?.targetHours ?? rhythm.at(-1)!;

  const weeks: WeekPlan[] = [];
  for (let i = 0, w = input.startWeek; w <= raceWeek; i++, w = addDays(w, 7)) {
    const phase = phaseOf(w, raceWeek);
    const notes: string[] = [];
    let kind: WeekKind;
    const sinceBlock = i - lastBlockIdx;
    const blockAllowed = sinceBlock >= R.blockWeekEveryWeeks;
    const leaveBlockSoon = [1, 2].some((k) => isLeaveBlockWeek(addDays(w, 7 * k), a));

    if (w === raceWeek) kind = 'race';
    else if (phase === 'taper') kind = 'taper';
    else if (isTravelWeek(w, a)) kind = 'travel';
    else if (prevKind === 'block') kind = 'light';
    else if (streak >= R.lightWeekEveryMax - 1) kind = 'light';
    else if (blockAllowed && (isLeaveBlockWeek(w, a) || (phase === 'specific' && streak === R.lightWeekEveryMin - 1))) kind = 'block';
    else if (streak >= R.lightWeekEveryMin - 1 && leaveBlockSoon) {
      kind = 'light';
      notes.push('Allégée une semaine plus tôt pour arriver frais sur le bloc des congés.');
    } else kind = 'load';

    const r = rhythm.slice(-R.rollingWeeks).reduce((s, x) => s + x, 0) / R.rollingWeeks;
    let target: number;
    switch (kind) {
      case 'load':
        target = Math.min(r * (prevKind === 'travel' ? P.reentryFactor : R.weeklyVolumeCap), peak);
        if (prevKind === 'travel') notes.push('Reprise après le voyage : volume contenu.');
        break;
      case 'block':
        target = Math.min(r * R.blockWeekCap, peak * R.blockWeekCap);
        notes.push(
          isLeaveBlockWeek(w, a)
            ? 'Semaine bloc sur les congés : enchaînement de 3 jours.'
            : 'Semaine bloc : pose ton vendredi pour enchaîner 3 jours (sinon décale la séance du vendredi).',
        );
        break;
      case 'light':
        target = lastLoad * P.lightFactor;
        break;
      case 'travel':
        target = P.travelRunsMin.reduce((s, x) => s + x, 0) / 60;
        notes.push('À l’étranger : course à pied uniquement, pas de foot.');
        break;
      case 'taper':
        target = lastLoad * P.taperFactor;
        break;
      case 'race':
        target = lastLoad * P.raceWeekFactor;
        notes.push('Semaine de l’objectif : déblocage léger, repos ; foot à J-2 déconseillé.');
        break;
    }
    // Charge et bloc : arrondi au quart d'heure inférieur pour rester sous le plafond (R3).
    target = kind === 'load' || kind === 'block' ? Math.floor(target * 4 + 1e-9) / 4 : round025(target);

    if (kind === 'load' || kind === 'block') {
      rhythm.push(target);
      streak++;
      if (kind === 'load') lastLoad = target;
      if (kind === 'block') lastBlockIdx = i;
    } else streak = 0;
    prevKind = kind;
    weeks.push({ weekStart: w, phase, kind, targetHours: target, longRideMin: 0, notes, generatedAt: now });
  }
  return weeks;
}

// --- Construction d'une semaine ---

interface Day {
  date: LocalDate;
  wd: number;
  exc: ExceptionKind | null;
  minutes: number;
  paris: boolean;
}

interface BuildCtx {
  settings: AppSettings;
  /** Jours déjà occupés (séances faites ou gardées, jours passés) : rien n'y est ajouté. */
  occupied?: Set<LocalDate>;
  /** Minutes d'endurance déjà couvertes par les séances gardées. */
  keptMin?: number;
  goal: Goal;
  /** Plus longue sortie prévue ou faite jusqu'ici (minutes). */
  longest: number;
  /** Nombre de séances structurées déjà générées par phase (progression). */
  intenseCount: Record<Phase, number>;
  /** Nombre de semaines de charge ou bloc déjà générées en spécifique. */
  specificCount: number;
  /** Dernière semaine de charge avant l'affûtage ? */
  lastLoadBeforeTaper: boolean;
  now: number;
}

function session(c: SessionContent, date: LocalDate, now: number, alternative?: SessionContent): PlannedSession {
  return { ...c, id: newId(), date, status: 'planned', origin: 'generated', alternative, createdAt: now, updatedAt: now };
}

function isWeekend(d: Day) {
  return d.wd >= 6;
}
/** Journée entière disponible : week-end ou congé. */
function isFreeDay(d: Day) {
  return d.exc === 'leave' || (d.exc === null && isWeekend(d));
}
function canBike(d: Day) {
  return d.exc !== 'runOnly' && d.exc !== 'unavailable' && !d.paris;
}

export function buildWeek(week: WeekPlan, ctx: BuildCtx): PlannedSession[] {
  const a = ctx.settings.availability;
  const now = ctx.now;
  const startMin = parseClock(a.weekdayMorningStart);
  const paris = new Set(parisDaysOf(week.weekStart, a));
  const days: Day[] = weekDays(week.weekStart).map((date) => {
    const wd = isoWeekday(date);
    const t = a.template[wd] ?? { minutes: 0, paris: false };
    const exc = dayException(date, a);
    const inParis = paris.has(date) && exc !== 'runOnly' && exc !== 'unavailable';
    // À Paris : course uniquement, avec le temps du matin (au moins 40 min).
    const minutes = inParis ? Math.max(40, t.paris ? t.minutes : 40) : exc === 'leave' ? P.weekendMaxMin : t.minutes;
    return { date, wd, exc, minutes, paris: inParis };
  });
  const out: PlannedSession[] = [];
  const add = (c: SessionContent, d: Day, alt?: SessionContent) => out.push(session(c, d.date, now, alt));
  const used = new Set<LocalDate>(ctx.occupied ?? []);
  const take = (d: Day | undefined) => (d ? (used.add(d.date), d) : undefined);
  const phase = week.phase;

  // Football : lundi et jeudi, obligatoires sauf à Paris ou en voyage, prioritaires ce jour-là.
  // La semaine de l'objectif, le foot à J-2 est proposé en optionnel (risque de blessure).
  const footDays = week.kind === 'travel' ? [] : footballDaysOf(week.weekStart, a);
  const footWds: number[] = [];
  for (const fd of footDays) {
    const d = days.find((x) => x.date === fd)!;
    footWds.push(d.wd);
    if (used.has(d.date)) continue;
    const c = football(a.footballMin);
    if (week.kind === 'race' && diffDays(ctx.goal.date, d.date) <= 3) {
      c.notes = 'À quelques jours du départ : je te conseille de t’abstenir (risque de blessure).';
    }
    add(c, take(d)!);
  }
  let budget = Math.round(week.targetHours * 60) - (ctx.keptMin ?? 0);

  // Voyage : course uniquement.
  if (week.kind === 'travel') {
    const kinds: RunKind[] = ['footing', 'côtes', 'sortie longue'];
    const prefs = [1, 3, 6];
    P.travelRunsMin.forEach((m, i) => {
      const d = days.find((x) => x.wd >= prefs[i] && !used.has(x.date) && x.exc !== 'unavailable');
      if (d) add(run(m, kinds[i]), take(d)!, swim(m));
    });
    return finish(out, week);
  }

  // Séance structurée : premier matin libre, pas la veille ni le lendemain du foot (R7).
  const morning = (d: Day) => !used.has(d.date) && d.wd <= 5 && (d.exc === null || d.exc === 'leave') && !d.paris && d.minutes >= 45;
  /** Extérieur possible : congé (en journée) ou séance du matin entièrement de jour (R8). */
  const daylightOk = (d: Day, m: number) => d.exc === 'leave' || fitsInDaylight(d.date, startMin, m);
  const notNearFootball = (d: Day) => footWds.every((f) => Math.abs(d.wd - f) > R.footballBufferDays);
  const intenseDay = take(days.find((d) => morning(d) && notNearFootball(d)));

  if (week.kind === 'race') {
    if (intenseDay) add(htOpeners(Math.min(45, intenseDay.minutes)), intenseDay);
    const fri = days.find((d) => d.wd === 5 && !used.has(d.date) && canBike(d));
    if (fri) {
      const outdoor = daylightOk(fri, 30);
      add(outdoor ? outdoorEndurance(30, phase, 'optional', 'Activation 30\'') : htEndurance(30, 'optional', 'HT Activation 30\''), take(fri)!);
    }
    return finish(out, week);
  }

  const light = week.kind === 'light';
  const taper = week.kind === 'taper';
  const block = week.kind === 'block';
  const keyMin = Math.min(P.keyWeekdayMin, intenseDay?.minutes ?? 0);
  // Aucun matin compatible avec le foot : la séance structurée est intégrée à la sortie du samedi.
  const effortsInRide = !intenseDay && !light;
  if (intenseDay) {
    if (light) add(htEndurance(45), intenseDay);
    else {
      const c = taper ? htOpeners(keyMin) : htIntense(phase, ctx.intenseCount[phase]++, keyMin);
      // Dans une semaine bloc ou un enchaînement, la séance structurée devient optionnelle (R4 : 2 clés max).
      if (block || phase === 'specific') c.priority = 'optional';
      add(c, intenseDay);
    }
    budget -= light ? 45 : keyMin;
  }

  // Footing à Paris (avec variante natation) : toujours le 2e jour de présence ; une seule journée à Paris → pas de course.
  const runDate = parisRunDay(week.weekStart, a);
  const parisDay = take(days.find((d) => d.date === runDate && !used.has(d.date) && d.minutes >= 20));
  let runMin = 0;
  if (parisDay) {
    runMin = Math.min(parisDay.minutes, phase === 'base' || light || taper ? P.parisRunMin[0] : P.parisRunMin[1]);
  }

  // Endurance optionnelle de semaine (pas pendant une semaine allégée ou d'affûtage).
  const blockFirstDay = block ? days.find((d) => d.wd === 5 && !used.has(d.date) && canBike(d)) : undefined;
  // En spécifique, le week-end enchaîné prime : pas d'endurance optionnelle en semaine.
  let optDay = !light && !taper && phase !== 'specific' ? days.find((d) => morning(d) && d !== blockFirstDay) : undefined;
  let optMin = optDay ? Math.min(P.optionalWeekdayMin, optDay.minutes) : 0;

  let rest = budget - runMin - optMin;
  if (rest < P.minWeekendMin && optMin) {
    rest += optMin;
    optMin = 0;
    optDay = undefined;
  }
  if (rest < P.minWeekendMin && runMin) {
    rest += runMin;
    runMin = 0;
  }
  if (parisDay && runMin) add(run(runMin), parisDay, swim(runMin));
  if (optDay && optMin) {
    take(optDay);
    const outdoor = daylightOk(optDay, optMin);
    add(outdoor ? outdoorEndurance(optMin, phase) : htEndurance(optMin), optDay, outdoor ? htEndurance(optMin) : undefined);
  }

  // Week-end : sortie longue, enchaînement ou bloc.
  const longCap = Math.min(ctx.longest + R.longestRideIncreaseMin, P.weekendMaxMin);
  const sat = days.find((d) => d.wd === 6 && isFreeDay(d) && !used.has(d.date));
  const sun = days.find((d) => d.wd === 7 && isFreeDay(d) && !used.has(d.date));
  const rides: { day: Day; min: number; opts: Parameters<typeof longRide>[2] }[] = [];
  rest = Math.max(rest, 0);

  const specialIdx = phase === 'specific' && (week.kind === 'load' || block) ? ctx.specificCount++ : -1;
  const loaded = specialIdx === 0 || block || ctx.lastLoadBeforeTaper;

  if (block && sat && sun) {
    const days3 = blockFirstDay ? [blockFirstDay, sat, sun] : [sat, sun];
    const shares = blockFirstDay ? P.blockShares : [P.backToBackShare, 1 - P.backToBackShare];
    days3.forEach((d, i) => {
      const m = Math.min(roundTo(rest * shares[i]), longCap);
      rides.push({
        day: d,
        min: m,
        opts: {
          title: `Bloc J${i + 1}${loaded && phase === 'specific' ? ' chargé' : ''}`,
          loaded: loaded && phase === 'specific',
          note: i === 0 && d === blockFirstDay && d.exc !== 'leave' ? 'Jour à poser (congé ou RTT).' : i > 0 ? 'Enchaînement : rester en Z2, tester la récupération et l’alimentation.' : undefined,
        },
      });
    });
  } else if (phase === 'specific' && !light && !taper && sat && sun && rest >= 180) {
    const s1 = Math.min(roundTo(rest * P.backToBackShare), longCap);
    const s2 = Math.min(roundTo(rest - s1), s1);
    const lastBeforeTaper = ctx.lastLoadBeforeTaper;
    rides.push({
      day: sat,
      min: s1,
      opts: {
        title: lastBeforeTaper ? 'Répétition générale J1' : specialIdx === 1 ? 'Sortie longue qui finit de nuit' : loaded ? 'Sortie longue chargée' : 'Enchaînement J1',
        loaded,
        nightSunset: specialIdx === 1 ? daylight(sat.date).sunset : undefined,
      },
    });
    rides.push({
      day: sun,
      min: s2,
      opts: {
        title: lastBeforeTaper ? 'Répétition générale J2' : 'Enchaînement J2',
        loaded: lastBeforeTaper,
        note: 'Lendemain de sortie longue : rester en Z2, tester la récupération.',
      },
    });
  } else if (sat) {
    let s1 = rest;
    let s2 = 0;
    if (!light && sun && rest > P.secondWeekendRideAboveMin) {
      s1 = roundTo(rest * P.saturdayShare);
      s2 = rest - s1;
    }
    if (s1 > longCap) {
      s2 += s1 - longCap;
      s1 = longCap;
    }
    s1 = roundTo(s1);
    s2 = s2 >= 45 && sun ? Math.min(roundTo(s2), s1) : 0;
    if (s1 >= 30) {
      const efforts = effortsInRide && s1 >= 75 ? rideEfforts(phase, taper, ctx.intenseCount[phase]++) : undefined;
      rides.push({ day: sat, min: s1, opts: { loaded: specialIdx === 0 && phase === 'specific', efforts } });
    }
    if (s2 && sun) rides.push({ day: sun, min: s2, opts: { priority: 'optional', title: 'Endurance Z2 extérieur' } });
  }

  // Week-end indisponible pour le vélo (voyage) : le volume restant devient une course.
  if (!rides.length && rest >= 30) {
    const d = days.find((x) => x.wd >= 6 && !used.has(x.date) && x.exc !== 'unavailable');
    const m = Math.min(roundTo(rest), 50);
    if (d) add(run(m, 'sortie longue'), take(d)!, swim(m));
  }

  for (const r of rides) {
    const prio = r.opts?.priority ?? 'key';
    const c =
      prio === 'optional' && r.min < 150
        ? outdoorEndurance(r.min, phase, 'optional', r.opts?.title)
        : longRide(r.min, phase, { ...r.opts, priority: prio });
    add(c, take(r.day)!, trainerVariant(r.min, prio));
    ctx.longest = Math.max(ctx.longest, r.min);
  }
  return finish(out, week);
}

/** Efforts structurés intégrés à une sortie extérieure (cibles en zone de FC et RPE). */
function rideEfforts(phase: Phase, taper: boolean, index: number): RideEfforts {
  if (taper) return { label: 'Accélérations', n: 3, each: 3, rec: 3, hrZone: 4, rpe: 7 };
  const list: Record<Phase, RideEfforts[]> = {
    base: [
      { label: 'Tempo', n: 2, each: 15, rec: 5, hrZone: 3, rpe: 6 },
      { label: 'Tempo', n: 2, each: 20, rec: 5, hrZone: 3, rpe: 6 },
    ],
    development: [
      { label: 'Sweet spot', n: 3, each: 12, rec: 5, hrZone: 4, rpe: 7 },
      { label: 'Seuil', n: 4, each: 6, rec: 4, hrZone: 4, rpe: 8 },
      { label: 'Sweet spot', n: 2, each: 20, rec: 5, hrZone: 4, rpe: 7 },
    ],
    specific: [{ label: 'Tempo', n: 2, each: 20, rec: 5, hrZone: 3, rpe: 6 }],
    taper: [{ label: 'Accélérations', n: 3, each: 3, rec: 3, hrZone: 4, rpe: 7 }],
  };
  const l = list[phase];
  return l[index % l.length];
}

function finish(sessions: PlannedSession[], week: WeekPlan): PlannedSession[] {
  if (week.kind === 'race' || week.kind === 'travel') {
    const endurance = sessions.filter((x) => x.sport !== 'football' && x.sport !== 'enduro');
    week.targetHours = Math.round((endurance.reduce((s, x) => s + x.targetDurationMin, 0) / 60) * 4) / 4;
  }
  week.longRideMin = Math.max(0, ...sessions.filter((s) => s.sport === 'gravel').map((s) => s.targetDurationMin));
  return sessions.sort((x, y) => x.date.localeCompare(y.date));
}

export interface PlanOutput {
  weeks: WeekPlan[];
  sessions: PlannedSession[];
}

/** Programme complet de la semaine de départ jusqu'à la semaine de l'objectif. */
export function generatePlan(input: PlanInput): PlanOutput {
  const now = input.now ?? Date.now();
  const weeks = macroPlan({ ...input, now });
  const prior = input.history?.weeks ?? [];
  const intenseCount: Record<Phase, number> = { base: 0, development: 0, specific: 0, taper: 0 };
  let specificCount = 0;
  for (const w of prior) {
    if (w.weekStart >= input.startWeek) continue;
    if (w.kind === 'load' || w.kind === 'block') {
      intenseCount[w.phase]++;
      if (w.phase === 'specific') specificCount++;
    }
  }
  const lastLoadIdx = weeks.map((w) => w.kind).lastIndexOf('load');
  const ctx: BuildCtx = {
    settings: input.settings,
    goal: input.goal,
    longest: Math.max(input.history?.longestRideMin ?? CONFIG.startVolume.longestRideMin, ...prior.map((w) => w.longRideMin)),
    intenseCount,
    specificCount,
    lastLoadBeforeTaper: false,
    now,
  };
  const sessions: PlannedSession[] = [];
  weeks.forEach((w, i) => {
    ctx.lastLoadBeforeTaper = i === lastLoadIdx && w.phase === 'specific';
    sessions.push(...buildWeek(w, ctx));
  });
  return { weeks, sessions };
}

/** Semaine de départ d'une (re)génération : la semaine en cours le lundi ou le mardi, sinon la suivante. */
export function defaultStartWeek(today: LocalDate): LocalDate {
  const monday = startOfWeek(today);
  const start = isoWeekday(today) <= 2 ? monday : addDays(monday, 7);
  return start < CONFIG.planStart ? CONFIG.planStart : start;
}
