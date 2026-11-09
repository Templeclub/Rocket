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
    // Pas de foot à Paris, en voyage ni pendant les congés (club en pause) : à ajouter à la main si je joue.
    return a.footballDays.includes(isoWeekday(d)) && !paris.has(d) && exc === null;
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
  // Niveau de départ : rythme réel connu (régénération), sinon dernière charge prévue, sinon valeur de départ.
  const real = input.history?.rhythmHours?.length
    ? input.history.rhythmHours.slice(-R.rollingWeeks).reduce((t, x) => t + x, 0) / Math.min(R.rollingWeeks, input.history.rhythmHours.length)
    : undefined;
  const priorLoad = prior.filter((w) => w.kind === 'load').at(-1)?.targetHours;
  // Tendance : monte de 10 % chaque semaine (hors voyage), plafonnée au pic ; les semaines allégées sont un creux, pas un retour en arrière.
  let level = real ?? (priorLoad ? priorLoad : settings.volume.startWeeklyHours);
  if (!real && !priorLoad) level = settings.volume.startWeeklyHours / R.weeklyGrowth; // la 1re semaine vaut départ × 1,10
  if (priorLoad && !real) level = priorLoad;

  const weeks: WeekPlan[] = [];
  for (let i = 0, w = input.startWeek; w <= raceWeek; i++, w = addDays(w, 7)) {
    const phase = phaseOf(w, raceWeek);
    const notes: string[] = [];
    let kind: WeekKind;
    const sinceBlock = i - lastBlockIdx;
    const every = phase === 'specific' ? R.blockWeekEveryWeeksSpecific : R.blockWeekEveryWeeks;
    const blockAllowed = sinceBlock >= every;
    const leaveBlockSoon = [1, 2].some((k) => isLeaveBlockWeek(addDays(w, 7 * k), a));

    if (w === raceWeek) kind = 'race';
    else if (phase === 'taper') kind = 'taper';
    else if (isTravelWeek(w, a)) kind = 'travel';
    else if (prevKind === 'block') kind = 'light';
    // Spécifique : un long week-end de 3 jours une semaine sur deux (3 week-ends prolongés entre fin février et fin mars).
    else if (phase === 'specific' && blockAllowed) kind = 'block';
    else if (streak >= R.lightWeekEveryMax - 1) kind = 'light';
    else if (blockAllowed && isLeaveBlockWeek(w, a)) kind = 'block';
    else if (streak >= R.lightWeekEveryMin - 1 && leaveBlockSoon) {
      kind = 'light';
      notes.push('Allégée une semaine plus tôt pour arriver frais sur le bloc des congés.');
    } else kind = 'load';

    if (kind !== 'travel' && kind !== 'race' && kind !== 'taper') level = Math.min(level * R.weeklyGrowth, peak);
    let target: number;
    switch (kind) {
      case 'load':
        target = prevKind === 'travel' ? level * P.reentryFactor : level;
        if (prevKind === 'travel') notes.push('Reprise après le voyage : volume contenu.');
        break;
      case 'block':
        // Juste après le voyage : pas de surcharge, le long week-end reprend le volume de charge.
        target = prevKind === 'travel' ? level * P.reentryFactor : Math.min(level * R.blockWeekCap, peak * R.blockWeekCap);
        notes.push(
          isLeaveBlockWeek(w, a)
            ? 'Semaine bloc sur les congés : 3 longues journées enchaînées.'
            : 'Long week-end : pose ton vendredi pour enchaîner 3 longues journées (sinon décale la sortie du vendredi).',
        );
        if (prevKind === 'travel') notes.push('Reprise après le voyage : journées en endurance, sans forcer.');
        break;
      case 'light':
        target = level * P.lightFactor;
        break;
      case 'travel':
        target = P.travelRunsMin.reduce((t, x) => t + x, 0) / 60;
        notes.push('À l’étranger : course à pied uniquement, pas de foot.');
        break;
      case 'taper':
        target = level * P.taperFactor;
        break;
      case 'race':
        target = level * P.raceWeekFactor;
        notes.push('Semaine de l’objectif : déblocage léger, repos ; pas de foot à J-2.');
        break;
    }
    target = Math.floor(target * 4 + 1e-9) / 4;

    if (kind === 'load' || kind === 'block') {
      streak++;
      if (kind === 'block') lastBlockIdx = i;
    } else streak = 0;
    prevKind = kind;
    weeks.push({ weekStart: w, phase, kind, targetHours: target, longRideMin: 0, notes, generatedAt: now, version: CONFIG.planVersion });
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
  /** Dernière semaine de charge (ou long week-end) avant l'affûtage ? */
  lastLoadBeforeTaper: boolean;
  /** La sortie de nuit est-elle déjà prévue ? */
  nightPlanned?: boolean;
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
    // Capacité d'un jour de semaine à la maison : le plus long du matin (7h30) ou du home-trainer le soir.
    const home = exc === 'leave' ? P.weekendMaxMin : Math.max(t.minutes, wd <= 5 ? t.evening ?? 0 : 0);
    return { date, wd, exc, minutes: inParis ? 40 : home, paris: inParis };
  });
  const out: PlannedSession[] = [];
  const add = (c: SessionContent, d: Day, alt?: SessionContent) => out.push(session(c, d.date, now, alt));
  const used = new Set<LocalDate>(ctx.occupied ?? []);
  const take = (d: Day | undefined) => (d ? (used.add(d.date), d) : undefined);
  const phase = week.phase;
  const tmpl = (d: Day) => a.template[d.wd] ?? { minutes: 0, paris: false };

  // Football : lundi et jeudi, obligatoires sauf à Paris ou en voyage, prioritaires ce jour-là.
  // Semaine de l'objectif : pas de foot dans les 3 jours avant le départ (risque de blessure).
  const footDays = week.kind === 'travel' ? [] : footballDaysOf(week.weekStart, a).filter((d) => !(week.kind === 'race' && diffDays(ctx.goal.date, d) <= 3));
  const footWds = footDays.map((d) => isoWeekday(d));
  for (const fd of footDays) {
    const d = days.find((x) => x.date === fd)!;
    if (!used.has(d.date)) add(football(a.footballMin), take(d)!);
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

  /** Jour de semaine à la maison, libre (hors Paris, foot, voyage). */
  const homeDay = (d: Day) => !used.has(d.date) && d.wd <= 5 && (d.exc === null || d.exc === 'leave') && !d.paris && d.minutes >= P.minWeekdayMin;
  /** Extérieur possible : congé (en journée) ou séance du matin entièrement de jour (R8). */
  const daylightOk = (d: Day, m: number) => d.exc === 'leave' || (m <= tmpl(d).minutes && fitsInDaylight(d.date, startMin, m));
  const eveningNote = (d: Day, m: number) => (d.exc !== 'leave' && m > tmpl(d).minutes ? 'Le soir sur le home-trainer.' : undefined);
  const notNearFootball = (d: Day) => footWds.every((f) => Math.abs(d.wd - f) > R.footballBufferDays);
  /** Endurance de semaine : dehors le matin s'il fait jour, sinon home-trainer (le soir si plus long que le matin). */
  const weekdayEndurance = (d: Day, m: number) => {
    if (daylightOk(d, m)) add(outdoorEndurance(m, phase), take(d)!, htEndurance(m));
    else {
      const c = htEndurance(m);
      c.notes = eveningNote(d, m);
      add(c, take(d)!);
    }
  };

  const light = week.kind === 'light';
  const taper = week.kind === 'taper';
  const block = week.kind === 'block';

  // Semaine de l'objectif : déblocage en début de semaine, activation la veille du départ.
  if (week.kind === 'race') {
    const k = take(days.find((d) => homeDay(d) && notNearFootball(d)));
    if (k) add(htOpeners(Math.min(45, k.minutes)), k);
    const fri = days.find((d) => d.wd === 5 && !used.has(d.date) && canBike(d));
    if (fri) {
      const outdoor = daylightOk(fri, 30);
      add(outdoor ? outdoorEndurance(30, phase, 'optional', 'Activation 30\'') : htEndurance(30, 'optional', 'HT Activation 30\''), take(fri)!);
    }
    return finish(out, week);
  }

  // 1. Séance structurée (clé) : un jour à la maison, pas à côté du foot (R7). Sinon, intégrée au samedi.
  // Long week-end : tout le volume va aux 3 journées (pas de séance structurée ni de course cette semaine-là).
  const intenseDay = !light && !block ? take(days.find((d) => homeDay(d) && notNearFootball(d))) : undefined;
  if (intenseDay) {
    const keyMin = Math.min(P.keyWeekdayMin, intenseDay.minutes);
    const c = taper ? htOpeners(keyMin) : htIntense(phase, ctx.intenseCount[phase]++, keyMin);
    // Bloc ou spécifique : le week-end porte les clés, la séance structurée devient optionnelle (R4 : 2 clés max).
    if (block || phase === 'specific') c.priority = 'optional';
    c.notes = [c.notes, eveningNote(intenseDay, keyMin)].filter(Boolean).join(' ') || undefined;
    add(c, intenseDay);
    budget -= keyMin;
  }
  const effortsInRide = !intenseDay && !light && !block;

  // 2. Course à pied (gardée) : réservée maintenant, placée après le vélo (un jour à la maison en priorité, Paris en dernier recours).
  const runMin = block ? 0 : phase === 'base' || light || taper ? P.runMin[0] : P.runMin[1];
  budget -= runMin;

  // 3. Week-end : sortie longue, enchaînement ou long week-end de 3 jours.
  const longCap = Math.min(ctx.longest + R.longestRideIncreaseMin, P.weekendMaxMin);
  const sat = days.find((d) => d.wd === 6 && isFreeDay(d) && !used.has(d.date));
  const sun = days.find((d) => d.wd === 7 && isFreeDay(d) && !used.has(d.date));
  const blockFirstDay = block ? days.find((d) => d.wd === 5 && !used.has(d.date) && canBike(d)) : undefined;
  const rides: { day: Day; min: number; opts: Parameters<typeof longRide>[2] }[] = [];
  let rest = Math.max(budget, 0);
  const specialIdx = phase === 'specific' && (week.kind === 'load' || block) ? ctx.specificCount++ : -1;
  const loaded = phase === 'specific' && (specialIdx === 0 || block || ctx.lastLoadBeforeTaper);
  const round = (m: number) => Math.max(0, Math.floor(m / P.roundMin) * P.roundMin);

  if (block && sat && sun) {
    const days3 = blockFirstDay ? [blockFirstDay, sat, sun] : [sat, sun];
    const shares = blockFirstDay ? P.blockShares : [P.backToBackShare, 1 - P.backToBackShare];
    // Samedi le plus long (plafonné), les deux autres jours un peu moins.
    const satMin = Math.min(round(rest * shares[days3.length === 3 ? 1 : 0]), longCap);
    days3.forEach((d, i) => {
      const isSat = d === sat;
      const m = isSat ? satMin : Math.min(round(rest * shares[i]), satMin);
      take(d);
      rides.push({
        day: d,
        min: m,
        opts: {
          title: ctx.lastLoadBeforeTaper ? `Répétition générale J${i + 1}` : `Bloc J${i + 1}${loaded ? ' chargé' : ''}`,
          loaded,
          note: i === 0 && d === blockFirstDay && d.exc !== 'leave' ? 'Jour à poser (congé ou RTT).' : i > 0 ? 'Enchaînement : rester en Z2, tester la récupération et l’alimentation.' : undefined,
        },
      });
    });
    rest -= rides.reduce((t, r) => t + r.min, 0);
  } else if (sat) {
    // Samedi : la sortie longue d'abord (c'est elle qui prépare au Desertus), sans écraser le reste de la semaine.
    // Le samedi progresse de +45 min par marche ; il laisse environ 2h30 au dimanche et à la semaine quand le volume le permet.
    const share = light ? rest * 0.6 : Math.max(rest * P.saturdayShareOfWeek, rest - P.weekRestAfterSaturdayMin);
    const s1 = Math.min(round(Math.max(share, Math.min(rest, 150))), longCap);
    take(sat);
    // Sortie de nuit : la première semaine allégée du spécifique (volume modéré, on teste l'éclairage).
    const night = phase === 'specific' && light && !ctx.nightPlanned;
    if (night) ctx.nightPlanned = true;
    const title = ctx.lastLoadBeforeTaper ? 'Répétition générale J1' : night ? 'Sortie longue qui finit de nuit' : undefined;
    const efforts = effortsInRide && s1 >= 75 ? rideEfforts(phase, taper, ctx.intenseCount[phase]++) : undefined;
    rides.push({ day: sat, min: s1, opts: { title, loaded, efforts, nightSunset: night ? daylight(sat.date).sunset : undefined } });
    rest -= s1;
    // Dimanche : enchaînement (en spécifique, c'est une clé).
    if (sun && !light && rest >= 60) {
      const s2 = Math.min(round(rest), round(s1 * P.sundayShareOfSaturday));
      if (s2 >= 45) {
        take(sun);
        const b2b = phase === 'specific';
        rides.push({
          day: sun,
          min: s2,
          opts: {
            title: ctx.lastLoadBeforeTaper ? 'Répétition générale J2' : b2b ? 'Enchaînement J2' : 'Endurance Z2 extérieur',
            loaded: ctx.lastLoadBeforeTaper,
            priority: b2b ? 'key' : 'optional',
            note: b2b ? 'Lendemain de sortie longue : rester en Z2, tester la récupération.' : undefined,
          },
        });
        rest -= s2;
      }
    }
  }

  // 4. Endurance de semaine : jours à la maison restants (matin dehors s'il fait jour, sinon home-trainer, le soir si plus long).
  const free = days.filter(homeDay);
  for (const d of free) {
    if (rest < P.minWeekdayMin) break;
    // Garder un jour pour la course s'il n'y a pas d'autre solution qu'à Paris.
    const m = Math.min(round(Math.min(rest, block ? 90 : d.minutes)), d.minutes);
    if (m < P.minWeekdayMin) continue;
    weekdayEndurance(d, m);
    rest -= m;
  }

  // 5. Course : un jour à la maison encore libre, sinon le 2e jour à Paris, sinon le dimanche s'il est libre.
  const runDay = !runMin ? undefined :
    days.find(homeDay) ??
    days.find((d) => d.date === parisRunDay(week.weekStart, a) && !used.has(d.date)) ??
    (sun && !used.has(sun.date) ? sun : undefined);
  if (runDay) add(run(runMin), take(runDay)!, swim(runMin));
  else rest += runMin;

  // Reste éventuel : rallonge le samedi (jusqu'au plafond), puis le dimanche (sans dépasser le samedi).
  if (rest >= P.roundMin && rides.length && !block) {
    const r1 = rides[0];
    const add1 = Math.min(round(rest), longCap - r1.min);
    if (add1 > 0) {
      r1.min += add1;
      rest -= add1;
    }
    const r2 = rides[1];
    if (r2 && rest >= P.roundMin) r2.min = Math.min(r2.min + round(rest), r1.min);
  }

  // Week-end indisponible pour le vélo (voyage) : une course le week-end.
  if (!rides.length && rest >= 30 && !runDay) {
    const d = days.find((x) => x.wd >= 6 && !used.has(x.date) && x.exc !== 'unavailable');
    const m = Math.min(round(rest), 50);
    if (d) add(run(m, 'sortie longue'), take(d)!, swim(m));
  }

  for (const r of rides) {
    if (r.min < 30) continue;
    const prio = r.opts?.priority ?? 'key';
    const c =
      prio === 'optional' && r.min < 150
        ? outdoorEndurance(r.min, phase, 'optional', r.opts?.title)
        : longRide(r.min, phase, { ...r.opts, priority: prio });
    add(c, r.day, trainerVariant(r.min, prio));
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
  const lastLoadIdx = weeks.map((w) => w.kind === 'load' || w.kind === 'block').lastIndexOf(true);
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
