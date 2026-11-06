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

import { applyActions, confirmWeek, generateProgram, loadReview, switchVariant } from './program';

describe('programme', () => {
  it('génère le programme jusqu’au Desertus à partir du 9 novembre', async () => {
    const r = await generateProgram({ today: '2026-11-06' }, d);
    expect(r.weeks).toBe(22);
    expect(await d.weeks.count()).toBe(22);
    expect(await d.sessions.where('origin').equals('generated').count()).toBe(r.sessions);
    expect((await d.sessions.orderBy('date').first())!.date >= '2026-11-09').toBe(true);
  });

  it('recalcul : garde le réalisé et les séances manuelles, remplace les séances générées en attente', async () => {
    await generateProgram({ today: '2026-11-06' }, d);
    const first = (await d.sessions.where('date').equals('2026-11-09').first())!;
    await markSessionDone(first.id, d);
    const manual = (await createFromTemplate('builtin:enduro', '2026-11-22', d)).session;
    await generateProgram({ fromWeek: '2026-11-09', today: '2026-11-09' }, d);
    expect((await d.sessions.get(first.id))?.status).toBe('done');
    expect(await d.sessions.get(manual.id)).toBeDefined();
    const r = await generateProgram({ fromWeek: '2026-11-16', today: '2026-11-16', removeManual: true }, d);
    expect(r.removedManual).toBe(1);
    expect(await d.sessions.get(manual.id)).toBeUndefined();
  });

  it('bilan, application d’un choix avec annulation, puis confirmation de la semaine', async () => {
    await generateProgram({ today: '2026-11-06' }, d);
    const review = await loadReview('2026-11-16', '2026-11-15', d);
    expect(review.cap).toBeGreaterThan(0);
    const target = review.targetSessions.find((s) => s.priority === 'optional' && s.sport === 'run')!;
    const undo = await applyActions([{ kind: 'cancel', sessionId: target.id }], d);
    expect((await d.sessions.get(target.id))?.status).toBe('cancelled');
    await undo();
    expect((await d.sessions.get(target.id))?.status).toBe('planned');
    const item = { id: 'x', type: 'reduce-volume' as const, text: 't', justification: { metric: 'm', value: 6, threshold: 5, unit: 'h' }, choices: [{ label: 'Alléger', actions: [] }] };
    await confirmWeek('2026-11-16', [{ item, choiceIndex: 0 }], d);
    expect((await d.weeks.get('2026-11-16'))?.confirmedAt).toBeGreaterThan(0);
    expect((await d.recommendations.toArray())[0]).toMatchObject({ status: 'accepted', choice: 'Alléger', justification: { value: 6 } });
  });

  it('bascule sur la variante home-trainer puis retour', async () => {
    await generateProgram({ today: '2026-11-06' }, d);
    const ride = (await d.sessions.where('date').equals('2026-11-14').first())!;
    await switchVariant(ride.id, d);
    expect((await d.sessions.get(ride.id))?.environment).toBe('indoor');
    await switchVariant(ride.id, d);
    expect((await d.sessions.get(ride.id))?.environment).toBe('outdoor');
  });
});

import Dexie from 'dexie';

describe('migration depuis la phase 0', () => {
  it('ouvre une base v1 sans perte et complète les paramètres', async () => {
    const name = `legacy-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ sessions: 'id, date, status, sport', activities: 'id, date, sport, plannedSessionId, externalId', templates: 'id, sport, lastUsedAt', goals: 'id, date', settings: 'id' });
    await old.table('settings').put({ id: 'app', profile: { ftp: 190, hrMax: 199, hrRest: 49, vo2max: 53.8 }, powerZoneUpperPct: [55, 75, 90, 105, 120, 150], hrZoneBoundsPct: [50, 60, 70, 80, 90, 100] });
    await old.table('sessions').put({ id: 's1', title: 'x', sport: 'run', type: 'footing', environment: 'outdoor', targetDurationMin: 30, blocks: [], priority: 'optional', date: '2026-11-07', status: 'planned', origin: 'manual', createdAt: 0, updatedAt: 0 });
    old.close();
    const upgraded = new DesertusDB(name);
    await ensureSeeded(upgraded);
    const s = await upgraded.settings.get('app');
    expect(s?.profile.ftp).toBe(190);
    expect(s?.availability.footballDay).toBe(4);
    expect(s?.volume.startWeeklyHours).toBe(4.5);
    expect(await upgraded.sessions.get('s1')).toBeDefined();
    expect(await upgraded.weeks.count()).toBe(0);
  });
});
