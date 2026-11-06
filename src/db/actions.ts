// Opérations : elles appliquent le moteur de règles et enregistrent le résultat.
// Chaque action qui modifie le plan renvoie une fonction d'annulation, utilisée par le bandeau « Annuler l'action ».

import { activityFromSession } from '../engine/activity';
import { instantiate, toTemplate } from '../engine/library';
import { cancel, isPending, markDone, postpone, restore, swap, undoDone } from '../engine/status';
import type { Activity, AppSettings, Goal, LocalDate, PlannedSession, SessionContent, SessionTemplate } from '../engine/types';
import { db, type DesertusDB } from './db';

export type Undo = () => Promise<void>;

/** Instantané de lignes avant modification, pour pouvoir revenir en arrière. */
async function snapshot(d: DesertusDB, sessionIds: string[], activityIds: string[]): Promise<Undo> {
  const sessions = await d.sessions.bulkGet(sessionIds);
  const activities = await d.activities.bulkGet(activityIds);
  return async () => {
    await d.transaction('rw', d.sessions, d.activities, async () => {
      for (let i = 0; i < sessionIds.length; i++) {
        const before = sessions[i];
        if (before) await d.sessions.put(before);
        else await d.sessions.delete(sessionIds[i]);
      }
      for (let i = 0; i < activityIds.length; i++) {
        const before = activities[i];
        if (before) await d.activities.put(before);
        else await d.activities.delete(activityIds[i]);
      }
    });
  };
}

async function getSession(id: string, d: DesertusDB): Promise<PlannedSession> {
  const s = await d.sessions.get(id);
  if (!s) throw new Error('Séance introuvable.');
  return s;
}

export async function createFromTemplate(
  templateId: string,
  date: LocalDate,
  d: DesertusDB = db,
): Promise<{ session: PlannedSession; undo: Undo }> {
  const t = await d.templates.get(templateId);
  if (!t) throw new Error('Séance type introuvable.');
  const session = instantiate(t, date);
  await d.transaction('rw', d.sessions, d.templates, async () => {
    await d.sessions.add(session);
    await d.templates.update(t.id, { lastUsedAt: Date.now() });
  });
  return { session, undo: async () => void (await d.sessions.delete(session.id)) };
}

export async function saveSession(s: PlannedSession, d: DesertusDB = db): Promise<void> {
  await d.sessions.put({ ...s, updatedAt: Date.now() });
}

export async function deleteSession(id: string, d: DesertusDB = db): Promise<Undo> {
  const linked = await d.activities.where('plannedSessionId').equals(id).primaryKeys();
  const undo = await snapshot(d, [id], linked);
  await d.transaction('rw', d.sessions, d.activities, async () => {
    await d.sessions.delete(id);
    await d.activities.bulkDelete(linked);
  });
  return undo;
}

export async function postponeSession(id: string, date: LocalDate, today: LocalDate, d: DesertusDB = db): Promise<Undo> {
  const s = await getSession(id, d);
  const next = postpone(s, date, today);
  const undo = await snapshot(d, [id], []);
  await d.sessions.put(next);
  return undo;
}

export async function swapSessions(aId: string, bId: string, today: LocalDate, d: DesertusDB = db): Promise<Undo> {
  const [a, b] = await Promise.all([getSession(aId, d), getSession(bId, d)]);
  const [na, nb] = swap(a, b, today);
  const undo = await snapshot(d, [aId, bId], []);
  await d.sessions.bulkPut([na, nb]);
  return undo;
}

export async function cancelSession(id: string, d: DesertusDB = db): Promise<Undo> {
  const s = await getSession(id, d);
  const undo = await snapshot(d, [id], []);
  await d.sessions.put(cancel(s));
  return undo;
}

export async function restoreSession(id: string, d: DesertusDB = db): Promise<Undo> {
  const s = await getSession(id, d);
  const undo = await snapshot(d, [id], []);
  await d.sessions.put(restore(s));
  return undo;
}

/** « Fait comme prévu » : statut faite + réalisé recopié des cibles. */
export async function markSessionDone(id: string, d: DesertusDB = db): Promise<{ activity: Activity; undo: Undo }> {
  const s = await getSession(id, d);
  const done = markDone(s);
  const activity = activityFromSession(s);
  const undo = await snapshot(d, [id], [activity.id]);
  await d.transaction('rw', d.sessions, d.activities, async () => {
    await d.sessions.put(done);
    await d.activities.add(activity);
  });
  return { activity, undo };
}

/** Enregistre un réalisé ; s'il est lié à une séance en attente, elle passe à « faite ». */
export async function saveActivity(a: Activity, d: DesertusDB = db): Promise<void> {
  await d.transaction('rw', d.sessions, d.activities, async () => {
    await d.activities.put(a);
    if (a.plannedSessionId) {
      const s = await d.sessions.get(a.plannedSessionId);
      if (s && isPending(s)) await d.sessions.put(markDone(s));
    }
  });
}

/** Supprime un réalisé ; la séance liée repasse en attente. */
export async function deleteActivity(id: string, d: DesertusDB = db): Promise<Undo> {
  const a = await d.activities.get(id);
  const sid = a?.plannedSessionId;
  const undo = await snapshot(d, sid ? [sid] : [], [id]);
  await d.transaction('rw', d.sessions, d.activities, async () => {
    await d.activities.delete(id);
    if (sid) {
      const s = await d.sessions.get(sid);
      if (s?.status === 'done') {
        const others = await d.activities.where('plannedSessionId').equals(sid).count();
        if (others === 0) await d.sessions.put(undoDone(s));
      }
    }
  });
  return undo;
}

// --- Bibliothèque ---

export async function saveTemplate(t: SessionTemplate, d: DesertusDB = db): Promise<void> {
  await d.templates.put(t);
}

export async function deleteTemplate(id: string, d: DesertusDB = db): Promise<Undo> {
  const before = await d.templates.get(id);
  await d.templates.delete(id);
  return async () => void (before && (await d.templates.put(before)));
}

export async function saveAsTemplate(s: SessionContent, d: DesertusDB = db): Promise<SessionTemplate> {
  const t = toTemplate(s);
  await d.templates.add(t);
  return t;
}

// --- Paramètres et objectif ---

export async function saveSettings(s: AppSettings, d: DesertusDB = db): Promise<void> {
  await d.settings.put(s);
}

export async function saveGoal(g: Goal, d: DesertusDB = db): Promise<void> {
  await d.goals.put(g);
}

