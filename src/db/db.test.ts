import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from '../engine/backup';
import {
  cancelSession,
  createFromTemplate,
  deleteActivity,
  markSessionDone,
  postponeSession,
  saveActivity,
  swapSessions,
} from './actions';
import { DesertusDB, ensureSeeded, exportData, importData } from './db';

const TODAY = '2026-11-09';
let d: DesertusDB;
let n = 0;

beforeEach(async () => {
  d = new DesertusDB(`test-${n++}`);
  await ensureSeeded(d);
});

describe('base locale', () => {
  it('ensemence la bibliothèque, l’objectif et les paramètres une seule fois', async () => {
    const t = await d.templates.count();
    expect(t).toBeGreaterThan(10);
    await ensureSeeded(d);
    expect(await d.templates.count()).toBe(t);
    expect((await d.goals.toArray())[0].name).toBe('Desertus Bikus');
    expect((await d.settings.get('app'))?.profile.ftp).toBe(184);
  });

  it('crée une séance depuis un modèle et met à jour « récemment utilisé »', async () => {
    const { session } = await createFromTemplate('builtin:ht-ss-3x10', '2026-11-10', d);
    expect((await d.sessions.get(session.id))?.title).toMatch(/Sweet spot/);
    expect((await d.templates.get('builtin:ht-ss-3x10'))?.lastUsedAt).toBeGreaterThan(0);
  });

  it('reporte puis annule le report', async () => {
    const { session } = await createFromTemplate('builtin:ht-z2-60', '2026-11-10', d);
    const undo = await postponeSession(session.id, '2026-11-11', TODAY, d);
    expect((await d.sessions.get(session.id))).toMatchObject({ date: '2026-11-11', status: 'postponed', originalDate: '2026-11-10' });
    await undo();
    expect((await d.sessions.get(session.id))).toMatchObject({ date: '2026-11-10', status: 'planned' });
  });

  it('échange deux séances', async () => {
    const a = (await createFromTemplate('builtin:ht-z2-60', '2026-11-10', d)).session;
    const b = (await createFromTemplate('builtin:run-footing', '2026-11-12', d)).session;
    await swapSessions(a.id, b.id, TODAY, d);
    expect((await d.sessions.get(a.id))?.date).toBe('2026-11-12');
    expect((await d.sessions.get(b.id))?.date).toBe('2026-11-10');
  });

  it('« fait comme prévu » crée le réalisé, et l’annulation le supprime', async () => {
    const { session } = await createFromTemplate('builtin:out-long', '2026-11-15', d);
    const { activity, undo } = await markSessionDone(session.id, d);
    expect((await d.sessions.get(session.id))?.status).toBe('done');
    expect(await d.activities.get(activity.id)).toMatchObject({ durationSec: 10800, distanceM: 65000, plannedSessionId: session.id });
    await undo();
    expect((await d.sessions.get(session.id))?.status).toBe('planned');
    expect(await d.activities.get(activity.id)).toBeUndefined();
  });

  it('supprimer le réalisé remet la séance en attente', async () => {
    const { session } = await createFromTemplate('builtin:ht-z2-60', '2026-11-10', d);
    const { activity } = await markSessionDone(session.id, d);
    await deleteActivity(activity.id, d);
    expect((await d.sessions.get(session.id))?.status).toBe('planned');
  });

  it('un réalisé saisi pour une séance la marque faite ; un réalisé libre n’a pas de séance', async () => {
    const { session } = await createFromTemplate('builtin:run-footing', '2026-11-11', d);
    await saveActivity({ id: 'r1', source: 'manual', sport: 'run', environment: 'outdoor', date: '2026-11-11', durationSec: 2400, plannedSessionId: session.id }, d);
    expect((await d.sessions.get(session.id))?.status).toBe('done');
    await saveActivity({ id: 'r2', source: 'manual', sport: 'enduro', environment: 'outdoor', date: '2026-11-14', durationSec: 9000 }, d);
    expect(await d.activities.count()).toBe(2);
  });

  it('annuler une séance', async () => {
    const { session } = await createFromTemplate('builtin:ht-z2-60', '2026-11-10', d);
    const undo = await cancelSession(session.id, d);
    expect((await d.sessions.get(session.id))?.status).toBe('cancelled');
    await undo();
    expect((await d.sessions.get(session.id))?.status).toBe('planned');
  });

  it('export puis import JSON dans une base vide restitue les mêmes données', async () => {
    const { session } = await createFromTemplate('builtin:ht-ss-3x10', '2026-11-10', d);
    await markSessionDone(session.id, d);
    const text = JSON.stringify(makeBackup(await exportData(d)));

    const other = new DesertusDB(`test-${n++}`);
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await importData(parsed.backup.data, other);
    expect(await exportData(other)).toEqual(await exportData(d));
  });
});
