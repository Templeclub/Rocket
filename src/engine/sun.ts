// Lever, coucher, aube et crépuscule civils, calculés localement (aucune API).
// Formules de position du soleil d'après « Astronomy Answers » (même approche que la librairie suncalc).

import { CONFIG } from './config';
import type { LocalDate } from './types';

const rad = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const J0 = 0.0009;
const OBLIQUITY = rad * 23.4397;

const toDays = (d: Date) => d.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const declination = (l: number) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
const meanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
function eclipticLongitude(m: number): number {
  const c = rad * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  return m + c + rad * 102.9372 + Math.PI;
}
const approxTransit = (ht: number, lw: number, n: number) => J0 + (ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, m: number, l: number) => J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);

/** Heures UTC où le soleil passe à l'altitude donnée (null si jamais, ex. nuit polaire). */
export function sunCrossings(date: LocalDate, lat: number, lon: number, altitudeDeg: number): { rise: Date; set: Date } | null {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(noonUtc);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = approxTransit(0, lw, n);
  const m = meanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l);
  const jNoon = solarTransitJ(ds, m, l);
  const cosW = (Math.sin(altitudeDeg * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null;
  const jSet = solarTransitJ(approxTransit(Math.acos(cosW), lw, n), m, l);
  const jRise = jNoon - (jSet - jNoon);
  return { rise: fromJulian(jRise), set: fromJulian(jSet) };
}

const hm = new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Minutes depuis minuit, heure de Paris. */
export function localMinutes(d: Date): number {
  const parts = hm.formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return h * 60 + m;
}

export function formatClock(min: number): string {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`;
}

export function parseClock(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

export interface Daylight {
  /** Aube civile, lever, coucher, crépuscule civil : minutes depuis minuit (heure de Paris). */
  dawn: number;
  sunrise: number;
  sunset: number;
  dusk: number;
}

const loc = CONFIG.availability.location;

export function daylight(date: LocalDate, lat: number = loc.lat, lon: number = loc.lon): Daylight {
  const civil = sunCrossings(date, lat, lon, CONFIG.rules.sunAltitudeDeg)!;
  const sun = sunCrossings(date, lat, lon, -0.833)!;
  return {
    dawn: localMinutes(civil.rise),
    sunrise: localMinutes(sun.rise),
    sunset: localMinutes(sun.set),
    dusk: localMinutes(civil.set),
  };
}

/** R8 : toute la séance tombe-t-elle entre l'aube et le crépuscule civils ? */
export function fitsInDaylight(date: LocalDate, startMin: number, durationMin: number): boolean {
  const d = daylight(date);
  return startMin >= d.dawn && startMin + durationMin <= d.dusk;
}
