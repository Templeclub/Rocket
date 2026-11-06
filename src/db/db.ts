import Dexie, { type EntityTable } from 'dexie';
import { defaultGoals } from '../engine/activity';
import { type BackupData } from '../engine/backup';
import { builtinTemplates } from '../engine/library';
import type { Activity, AppSettings, Goal, PlannedSession, SessionTemplate } from '../engine/types';
import { defaultSettings } from '../engine/zones';

export class DesertusDB extends Dexie {
  sessions!: EntityTable<PlannedSession, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  templates!: EntityTable<SessionTemplate, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor(name = 'desertusplan') {
    super(name);
    this.version(1).stores({
      sessions: 'id, date, status, sport',
      activities: 'id, date, sport, plannedSessionId, externalId',
      templates: 'id, sport, lastUsedAt',
      goals: 'id, date',
      settings: 'id',
    });
  }
}

export const db = new DesertusDB();

/** Premier lancement : bibliothèque, objectif principal et paramètres par défaut. */
export async function ensureSeeded(d: DesertusDB = db): Promise<void> {
  await d.transaction('rw', d.templates, d.goals, d.settings, async () => {
    if ((await d.settings.count()) === 0) await d.settings.put(defaultSettings());
    if ((await d.goals.count()) === 0) await d.goals.bulkPut(defaultGoals());
    if ((await d.templates.count()) === 0) await d.templates.bulkPut(builtinTemplates());
  });
}

export async function exportData(d: DesertusDB = db): Promise<BackupData> {
  return d.transaction('r', [d.sessions, d.activities, d.templates, d.goals, d.settings], async () => ({
    sessions: await d.sessions.toArray(),
    activities: await d.activities.toArray(),
    templates: await d.templates.toArray(),
    goals: await d.goals.toArray(),
    settings: await d.settings.toArray(),
  }));
}

/** Remplace toutes les données par celles de la sauvegarde (déjà validée). */
export async function importData(data: BackupData, d: DesertusDB = db): Promise<void> {
  await d.transaction('rw', [d.sessions, d.activities, d.templates, d.goals, d.settings], async () => {
    await Promise.all([d.sessions.clear(), d.activities.clear(), d.templates.clear(), d.goals.clear(), d.settings.clear()]);
    await d.sessions.bulkAdd(data.sessions);
    await d.activities.bulkAdd(data.activities);
    await d.templates.bulkAdd(data.templates);
    await d.goals.bulkAdd(data.goals);
    await d.settings.bulkAdd(data.settings.length ? data.settings : [defaultSettings()]);
  });
}
