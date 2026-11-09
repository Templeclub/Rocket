// Jalon « sortie de 6 h et plus » : où la placer en mars, et ce qu'elle remplace.

import { CONFIG } from './config';
import { addDays, isoWeekday, labelDay, startOfWeek } from './dates';
import { dayException, footballDaysOf, parisDaysOf } from './planner';
import { isPending } from './status';
import type { AppSettings, Goal, LocalDate, PlannedSession, WeekPlan } from './types';
import { formatDuration } from './zones';

export type SlotLevel = 'best' | 'ok' | 'no';

export interface Slot {
  date: LocalDate;
  level: SlotLevel;
  reason: string;
  /** Séances vélo prévues ce jour-là, que la sortie remplacera. */
  replaces: PlannedSession[];
}

/** Tous les jours du mois avec leur intérêt pour la sortie longue. */
export function longRideSlots(p: { month?: string; today: LocalDate; weeks: WeekPlan[]; sessions: PlannedSession[]; settings: AppSettings; current?: Goal }): Slot[] {
  const month = p.month ?? CONFIG.longRideMilestone.month;
  const a = p.settings.availability;
  const first = `${month}-01`;
  const out: Slot[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    const week = p.weeks.find((w) => w.weekStart === startOfWeek(d));
    const exc = dayException(d, a);
    const day = p.sessions.filter((s) => s.date === d && s.status !== 'cancelled' && s.id !== p.current?.sessionId);
    const replaces = day.filter((s) => s.sport === 'gravel' && isPending(s) && !s.milestone);
    const slot = (level: SlotLevel, reason: string): Slot => ({ date: d, level, reason, replaces });
    const isFriOfBlock = week?.kind === 'block' && wd === 5;
    if (d < p.today) out.push(slot('no', 'Date passée.'));
    else if (!week) out.push(slot('no', 'Hors programme.'));
    else if (week.kind === 'taper' || week.kind === 'race') out.push(slot('no', 'Affûtage : trop près du départ.'));
    else if (exc === 'runOnly' || exc === 'unavailable' || week.kind === 'travel') out.push(slot('no', 'Indisponible ce jour-là.'));
    else if (parisDaysOf(week.weekStart, a).includes(d)) out.push(slot('no', 'Jour à Paris.'));
    else if (day.some((s) => s.status === 'done')) out.push(slot('no', 'Une séance est déjà faite ce jour-là.'));
    else if (footballDaysOf(week.weekStart, a).includes(d)) out.push(slot('no', 'Jour de foot.'));
    else if (wd <= 5 && exc !== 'leave' && !isFriOfBlock) out.push(slot('no', 'Jour de travail : pose une journée pour l’utiliser.'));
    else if (week.kind === 'block' && wd === 6) out.push(slot('best', 'Milieu du long week-end : la grande journée devient ta sortie longue, vendredi et dimanche sont raccourcis.'));
    else if (isFriOfBlock) out.push(slot('ok', 'Vendredi du long week-end (jour posé) : samedi et dimanche sont raccourcis.'));
    else if (week.kind === 'light') out.push(slot('ok', 'Semaine allégée : possible, mais la semaine ne sera plus vraiment légère.'));
    else if (wd === 7 && footballDaysOf(startOfWeek(addDays(d, 1)), a).includes(addDays(d, 1))) {
      out.push(slot('ok', 'Possible ; foot le lendemain, prévois une récupération soignée.'));
    } else out.push(slot('ok', 'Week-end : possible, le reste de la semaine est réajusté.'));
  }
  return out;
}

export function milestoneTitle(minutes: number): string {
  return `Sortie de ${formatDuration(minutes * 60)}`;
}

export function slotSummary(s: Slot): string {
  return `${labelDay(s.date)} : ${s.reason}${s.replaces.length ? ` Remplace « ${s.replaces.map((x) => x.title).join(' », « ')} ».` : ''}`;
}
