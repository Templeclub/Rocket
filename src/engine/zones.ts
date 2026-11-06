import { CONFIG } from './config';
import type { AppSettings, Availability, Block, Profile, Target } from './types';

export interface Zone {
  index: number; // 1-based
  name: string;
  lowPct: number;
  highPct: number | null; // null = ouverte
  low: number;
  high: number | null;
}

export function powerZones(ftp: number, upperPct: readonly number[] = CONFIG.powerZoneUpperPct): Zone[] {
  const bounds = [0, ...upperPct];
  return bounds.map((lowPct, i) => {
    const highPct = i < upperPct.length ? upperPct[i] : null;
    return {
      index: i + 1,
      name: CONFIG.powerZoneNames[i] ?? `Z${i + 1}`,
      lowPct: i === 0 ? 0 : lowPct + 1,
      highPct,
      low: i === 0 ? 0 : Math.round((ftp * (lowPct + 1)) / 100),
      high: highPct === null ? null : Math.round((ftp * highPct) / 100),
    };
  });
}

export function hrZones(hrMax: number, boundsPct: readonly number[] = CONFIG.hrZoneBoundsPct): Zone[] {
  const zones: Zone[] = [];
  for (let i = 0; i < boundsPct.length - 1; i++) {
    zones.push({
      index: i + 1,
      name: CONFIG.hrZoneNames[i] ?? `Z${i + 1}`,
      lowPct: boundsPct[i],
      highPct: boundsPct[i + 1],
      low: Math.round((hrMax * boundsPct[i]) / 100),
      high: Math.round((hrMax * boundsPct[i + 1]) / 100),
    });
  }
  return zones;
}

export function watts(ftp: number, pct: number): number {
  return Math.round((ftp * pct) / 100);
}

export function defaultAvailability(): Availability {
  const a = CONFIG.availability;
  return {
    template: Object.fromEntries(Object.entries(a.template).map(([k, v]) => [Number(k), { ...v }])),
    footballDays: [...a.footballDays],
    footballMin: a.footballMin,
    parisByWeek: {},
    weekdayMorningStart: a.weekdayMorningStart,
    exceptions: a.exceptions.map((e) => ({ ...e })),
  };
}

export function defaultSettings(): AppSettings {
  return {
    id: 'app',
    profile: { ...CONFIG.profile },
    availability: defaultAvailability(),
    volume: { startWeeklyHours: CONFIG.startVolume.weeklyHours, peakWeeklyHours: CONFIG.startVolume.peakWeeklyHours, basis: 'endurance' },
    powerZoneUpperPct: [...CONFIG.powerZoneUpperPct],
    hrZoneBoundsPct: [...CONFIG.hrZoneBoundsPct],
  };
}

/** Complète des paramètres enregistrés par une version antérieure. */
export function withDefaults(s: Partial<AppSettings> | undefined): AppSettings {
  const d = defaultSettings();
  if (!s) return d;
  const legacy = s.availability as (Partial<Availability> & { footballDay?: number }) | undefined;
  const availability: Availability = legacy ? { ...d.availability, ...legacy } : d.availability;
  // Ancienne version : un seul jour de foot → lundi et jeudi désormais.
  if (!Array.isArray(availability.footballDays)) availability.footballDays = [...d.availability.footballDays];
  delete (availability as { footballDay?: number }).footballDay;
  availability.parisByWeek = availability.parisByWeek ?? {};
  // Ancienne version : volume en heures totales (foot compris) → heures d'endurance.
  let volume = { ...d.volume, ...s.volume };
  if (s.volume && s.volume.basis !== 'endurance') {
    const f = CONFIG.startVolume.legacyFootballHours;
    volume = {
      startWeeklyHours: Math.max(1, s.volume.startWeeklyHours - f),
      peakWeeklyHours: Math.max(1.5, s.volume.peakWeeklyHours - f),
      basis: 'endurance',
    };
  }
  return { ...d, ...s, id: 'app', profile: { ...d.profile, ...s.profile }, availability, volume };
}

// --- Durées ---

/** Lit « 45 » (minutes), « 1:30 » (min:s), « 1h30 », « 30s », « 90' », « 30" ». Renvoie des secondes. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
  if (!s) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)h(\d{1,2})?(?:min|m|')?$/.exec(s))) return +m[1] * 3600 + (m[2] ? +m[2] * 60 : 0);
  if ((m = /^(\d+):(\d{2}):(\d{2})$/.exec(s))) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  if ((m = /^(\d+):(\d{2})$/.exec(s))) return +m[1] * 60 + +m[2];
  if ((m = /^(\d+)(?:s|sec|")$/.exec(s))) return +m[1];
  if ((m = /^(\d+)'(\d{1,2})"?$/.exec(s))) return +m[1] * 60 + +m[2];
  if ((m = /^(\d+(?:\.\d+)?)(?:min|mn|m|')?$/.exec(s))) return Math.round(+m[1] * 60);
  return null;
}

/** 3600 → « 1h », 5400 → « 1h30 », 600 → « 10' », 90 → « 1'30" », 30 → « 30" ». */
export function formatDuration(sec: number): string {
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${min ? String(min).padStart(2, '0') : ''}`;
  if (min > 0) return s ? `${min}'${String(s).padStart(2, '0')}"` : `${min}'`;
  return `${s}"`;
}

/** Heures décimales → « 4h30 ». */
export function formatHours(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

// --- Blocs ---

export function blockDurationSec(b: Block): number {
  const reps = Math.max(1, b.repeat);
  return (b.durationSec ?? 0) * reps + (b.recoverySec ?? 0) * (reps - 1);
}

export function blockDistanceM(b: Block): number {
  return (b.distanceM ?? 0) * Math.max(1, b.repeat);
}

export function blocksDurationSec(blocks: Block[]): number {
  return blocks.reduce((a, b) => a + blockDurationSec(b), 0);
}

export function blocksDistanceM(blocks: Block[]): number {
  return blocks.reduce((a, b) => a + blockDistanceM(b), 0);
}

export function describeTarget(t: Target, profile: Profile, hrBoundsPct: readonly number[]): string[] {
  const parts: string[] = [];
  if (t.ftpPct) {
    const [lo, hi] = t.ftpPct;
    parts.push(
      lo === hi
        ? `${lo} % FTP (${watts(profile.ftp, lo)} W)`
        : `${lo}–${hi} % FTP (${watts(profile.ftp, lo)}–${watts(profile.ftp, hi)} W)`,
    );
  }
  if (t.hrZone) {
    const z = hrZones(profile.hrMax, hrBoundsPct)[t.hrZone - 1];
    parts.push(z ? `Z${t.hrZone} FC (${z.low}–${z.high} bpm)` : `Z${t.hrZone} FC`);
  }
  if (t.rpe) parts.push(`RPE ${t.rpe}`);
  if (t.text) parts.push(t.text);
  return parts;
}

/** « 3 × 10' · 88–93 % FTP (162–171 W) · récup 5' » */
export function describeBlock(b: Block, profile: Profile, hrBoundsPct: readonly number[]): string {
  const parts: string[] = [];
  const size = [b.durationSec ? formatDuration(b.durationSec) : '', b.distanceM ? `${b.distanceM} m` : '']
    .filter(Boolean)
    .join(' / ');
  if (size) parts.push(b.repeat > 1 ? `${b.repeat} × ${size}` : size);
  parts.push(...describeTarget(b.target, profile, hrBoundsPct));
  if (b.repeat > 1 && b.recoverySec) parts.push(`récup ${formatDuration(b.recoverySec)}`);
  return parts.join(' · ');
}
