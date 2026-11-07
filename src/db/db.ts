import Dexie, { type EntityTable } from 'dexie';
import { defaultGoals } from '../engine/activity';
import { type BackupData } from '../engine/backup';
import { builtinTemplates } from '../engine/library';
import type { Activity, AppSettings, CloudBackupState, Goal, PlannedSession, Recommendation, SessionTemplate, StravaIntegration, WeekPlan } from '../engine/types';
import { defaultSettings, withDefaults } from '../engine/zones';

export class AsceseDB extends Dexie {
  sessions!: EntityTable<PlannedSession, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  templates!: EntityTable<SessionTemplate, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  weeks!: EntityTable<WeekPlan, 'weekStart'>;
  recommendations!: EntityTable<Recommendation, 'id'>;
  /** Connexions externes (Strava). Jamais exportées : elles contiennent des jetons. */
  integrations!: EntityTable<StravaIntegration, 'id'>;
  /** Sauvegarde en ligne : phrase secrète et état (jamais exportés). */
  cloud!: EntityTable<CloudBackupState, 'id'>;

  // Le nom de la base reste « desertusplan » : le changer effacerait les données déjà saisies.
  constructor(name = 'desertusplan') {
    super(name);
    this.version(1).stores({
      sessions: 'id, date, status, sport',
      activities: 'id, date, sport, plannedSessionId, externalId',
      templates: 'id, sport, lastUsedAt',
      goals: 'id, date',
      settings: 'id',
    });
    this.version(2).stores({
      sessions: 'id, date, status, sport, origin',
      weeks: 'weekStart',
      recommendations: 'id, weekStart, status',
    });
    this.version(3).stores({
      activities: 'id, date, sport, plannedSessionId, externalId, source',
      integrations: 'id',
    });
    this.version(4).stores({ cloud: 'id' });
  }
}

/** Alias conservé pour les tests et le code existant. */
export { AsceseDB as DesertusDB };

export const db = new AsceseDB();

export async function getSettings(d: AsceseDB = db): Promise<AppSettings> {
  return withDefaults(await d.settings.get('app'));
}

/** Premier lancement : bibliothèque, objectif principal et paramètres par défaut. */
export async function ensureSeeded(d: AsceseDB = db): Promise<void> {
  await d.transaction('rw', d.templates, d.goals, d.settings, async () => {
    const s = await d.settings.get('app');
    if (!s) await d.settings.put(defaultSettings());
    else if (!s.availability || !s.volume) await d.settings.put(withDefaults(s));
    if ((await d.goals.count()) === 0) await d.goals.bulkPut(defaultGoals());
    if ((await d.templates.count()) === 0) await d.templates.bulkPut(builtinTemplates());
  });
}

const ALL = (d: AsceseDB) => [d.sessions, d.activities, d.templates, d.goals, d.settings, d.weeks, d.recommendations];

export async function exportData(d: AsceseDB = db): Promise<BackupData> {
  return d.transaction('r', ALL(d), async () => ({
    sessions: await d.sessions.toArray(),
    activities: await d.activities.toArray(),
    templates: await d.templates.toArray(),
    goals: await d.goals.toArray(),
    settings: await d.settings.toArray(),
    weeks: await d.weeks.toArray(),
    recommendations: await d.recommendations.toArray(),
  }));
}

/** Remplace toutes les données par celles de la sauvegarde (déjà validée). */
export async function importData(data: BackupData, d: AsceseDB = db): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    await Promise.all(ALL(d).map((t) => t.clear()));
    await d.sessions.bulkAdd(data.sessions);
    await d.activities.bulkAdd(data.activities);
    await d.templates.bulkAdd(data.templates);
    await d.goals.bulkAdd(data.goals.length ? data.goals : defaultGoals());
    await d.settings.bulkAdd(data.settings.length ? data.settings.map(withDefaults) : [defaultSettings()]);
    await d.weeks.bulkAdd(data.weeks ?? []);
    await d.recommendations.bulkAdd(data.recommendations ?? []);
  });
}
