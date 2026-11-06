// Format de sauvegarde JSON et validation à l'import. Module pur.

import { isLocalDate } from './dates';
import type { Activity, AppSettings, Goal, PlannedSession, Recommendation, SessionTemplate, WeekPlan } from './types';

export const BACKUP_APP = 'ascese';
/** Identifiant des sauvegardes faites avant le changement de nom (toujours acceptées). */
export const LEGACY_BACKUP_APPS = ['desertusplan'];
export const BACKUP_SCHEMA_VERSION = 2;

export interface BackupData {
  sessions: PlannedSession[];
  activities: Activity[];
  templates: SessionTemplate[];
  goals: Goal[];
  settings: AppSettings[];
  weeks: WeekPlan[];
  recommendations: Recommendation[];
}

export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export function makeBackup(data: BackupData, now: Date = new Date()): Backup {
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export function backupFileName(now: Date = new Date()): string {
  return `ascese-${now.toISOString().slice(0, 10)}.json`;
}

const SPORTS = new Set(['gravel', 'run', 'swim', 'football', 'enduro']);
const ENVS = new Set(['indoor', 'outdoor']);
const STATUSES = new Set(['planned', 'done', 'postponed', 'cancelled']);
const PRIORITIES = new Set(['key', 'optional']);

type Check = (x: Record<string, unknown>) => string | null;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown) => typeof x === 'string' && x.length > 0;
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);

const content: Check = (x) => {
  if (!isStr(x.id)) return 'id manquant';
  if (typeof x.title !== 'string') return 'titre manquant';
  if (!SPORTS.has(x.sport as string)) return `sport inconnu (${String(x.sport)})`;
  if (!ENVS.has(x.environment as string)) return 'intérieur/extérieur invalide';
  if (!isNum(x.targetDurationMin)) return 'durée cible invalide';
  if (!PRIORITIES.has(x.priority as string)) return 'priorité invalide';
  if (!Array.isArray(x.blocks) || !x.blocks.every((b) => isObj(b) && isStr(b.id) && isNum(b.repeat) && isObj(b.target))) {
    return 'blocs invalides';
  }
  return null;
};

const session: Check = (x) => {
  const e = content(x);
  if (e) return e;
  if (!isLocalDate(x.date)) return 'date invalide';
  if (!STATUSES.has(x.status as string)) return 'statut invalide';
  if (x.originalDate !== undefined && !isLocalDate(x.originalDate)) return 'date d’origine invalide';
  return null;
};

const activity: Check = (x) => {
  if (!isStr(x.id)) return 'id manquant';
  if (!SPORTS.has(x.sport as string)) return 'sport inconnu';
  if (!ENVS.has(x.environment as string)) return 'intérieur/extérieur invalide';
  if (!isLocalDate(x.date)) return 'date invalide';
  if (!isNum(x.durationSec)) return 'durée invalide';
  return null;
};

const goal: Check = (x) => {
  if (!isStr(x.id) || typeof x.name !== 'string') return 'id ou nom manquant';
  if (!isLocalDate(x.date)) return 'date invalide';
  return null;
};

const week: Check = (x) => {
  if (!isLocalDate(x.weekStart)) return 'semaine invalide';
  if (!isStr(x.phase) || !isStr(x.kind) || !isNum(x.targetHours)) return 'semaine incomplète';
  return null;
};

const recommendation: Check = (x) => {
  if (!isStr(x.id) || !isLocalDate(x.weekStart)) return 'recommandation invalide';
  return null;
};

const settings: Check = (x) => {
  if (x.id !== 'app') return 'id de paramètres invalide';
  const p = x.profile;
  if (!isObj(p) || !isNum(p.ftp) || !isNum(p.hrMax)) return 'profil invalide';
  if (!Array.isArray(x.powerZoneUpperPct) || !Array.isArray(x.hrZoneBoundsPct)) return 'zones invalides';
  return null;
};

export type ParseResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

/** Valide un fichier de sauvegarde (texte JSON). N'écrit rien. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Fichier illisible : ce n’est pas du JSON.'] };
  }
  if (!isObj(raw) || (raw.app !== BACKUP_APP && !LEGACY_BACKUP_APPS.includes(raw.app as string))) {
    return { ok: false, errors: ['Ce fichier n’est pas une sauvegarde Ascèse.'] };
  }
  if (!isNum(raw.schemaVersion) || (raw.schemaVersion as number) > BACKUP_SCHEMA_VERSION) {
    return { ok: false, errors: [`Version de sauvegarde non prise en charge (${String(raw.schemaVersion)}).`] };
  }
  if (!isObj(raw.data)) return { ok: false, errors: ['Section « data » absente.'] };

  const errors: string[] = [];
  const tables: [keyof BackupData, Check][] = [
    ['sessions', session],
    ['activities', activity],
    ['templates', content],
    ['goals', goal],
    ['settings', settings],
    ['weeks', week],
    ['recommendations', recommendation],
  ];
  const data = raw.data as Record<string, unknown>;
  for (const [name, check] of tables) {
    const arr = data[name] ?? [];
    if (!Array.isArray(arr)) {
      errors.push(`${name} : ce n’est pas une liste.`);
      continue;
    }
    const ids = new Set<string>();
    arr.forEach((item, i) => {
      const e = isObj(item) ? check(item) : 'élément invalide';
      if (e) errors.push(`${name}[${i}] : ${e}`);
      else {
        const key = (item.id ?? item.weekStart) as string;
        if (ids.has(key)) errors.push(`${name}[${i}] : id en double`);
        else ids.add(key);
      }
    });
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 10) };

  const backup: Backup = {
    app: BACKUP_APP,
    schemaVersion: raw.schemaVersion as number,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    data: {
      sessions: (data.sessions ?? []) as PlannedSession[],
      activities: (data.activities ?? []) as Activity[],
      templates: (data.templates ?? []) as SessionTemplate[],
      goals: (data.goals ?? []) as Goal[],
      settings: (data.settings ?? []) as AppSettings[],
      weeks: (data.weeks ?? []) as WeekPlan[],
      recommendations: (data.recommendations ?? []) as Recommendation[],
    },
  };
  return { ok: true, backup };
}
