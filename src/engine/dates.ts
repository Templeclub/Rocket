// Arithmétique sur des dates locales « YYYY-MM-DD ».
// Les calculs passent par UTC pour éviter tout décalage d'heure d'été.

import { CONFIG } from './config';
import type { LocalDate } from './types';

const DAY_MS = 86_400_000;
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(s: unknown): s is LocalDate {
  if (typeof s !== 'string') return false;
  const m = RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtc(d: LocalDate): Date {
  const m = RE.exec(d);
  if (!m) throw new Error(`Date invalide : ${d}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function fromUtc(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

/** Date du jour dans le fuseau Europe/Paris. */
export function todayLocal(now: Date = new Date()): LocalDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(new Date(toUtc(d).getTime() + n * DAY_MS));
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / DAY_MS);
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(d: LocalDate): number {
  const w = toUtc(d).getUTCDay();
  return w === 0 ? 7 : w;
}

export function startOfWeek(d: LocalDate): LocalDate {
  return addDays(d, 1 - isoWeekday(d));
}

export function weekDays(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function startOfMonth(d: LocalDate): LocalDate {
  return d.slice(0, 8) + '01';
}

export function addMonths(d: LocalDate, n: number): LocalDate {
  const u = toUtc(startOfMonth(d));
  u.setUTCMonth(u.getUTCMonth() + n);
  return fromUtc(u);
}

/** Lundis des semaines couvrant le mois (grille de 4 à 6 semaines). */
export function monthGrid(monthStart: LocalDate): LocalDate[] {
  const first = startOfWeek(monthStart);
  const next = addMonths(monthStart, 1);
  const weeks: LocalDate[] = [];
  for (let w = first; w < next; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' });
const fDay = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const fShort = fmt({ day: 'numeric', month: 'short' });
const fMonth = fmt({ month: 'long', year: 'numeric' });
const fWd = fmt({ weekday: 'short' });

const clean = (s: string) => s.replace(/\./g, '');

/** Majuscule sur la première lettre seulement. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « lun. 9 nov. » → « lun 9 nov » */
export const labelDay = (d: LocalDate) => clean(fDay.format(toUtc(d)));
export const labelShort = (d: LocalDate) => clean(fShort.format(toUtc(d)));
export const labelMonth = (d: LocalDate) => fMonth.format(toUtc(d));
export const labelWeekday = (d: LocalDate) => clean(fWd.format(toUtc(d)));

export function labelWeek(weekStart: LocalDate): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${+weekStart.slice(8)}–${labelShort(end)}`
    : `${labelShort(weekStart)} – ${labelShort(end)}`;
}
