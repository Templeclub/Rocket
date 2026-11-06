import { describe, expect, it } from 'vitest';
import { activityFromSession, defaultGoals } from './activity';
import { makeBackup, parseBackup } from './backup';
import { addDays, diffDays, isLocalDate, isoWeekday, labelWeek, monthGrid, startOfWeek, todayLocal } from './dates';
import { blankSession, builtinTemplates, instantiate } from './library';
import { summarize } from './stats';
import type { Activity, PlannedSession } from './types';
import {
  blocksDurationSec,
  defaultSettings,
  describeBlock,
  formatDuration,
  formatHours,
  hrZones,
  parseDuration,
  powerZones,
} from './zones';

describe('dates', () => {
  it('arithmétique simple, y compris au passage à l’heure d’été', () => {
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29');
    expect(diffDays('2027-04-10', '2026-11-09')).toBe(152);
  });
  it('semaine du lundi', () => {
    expect(isoWeekday('2026-11-09')).toBe(1);
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09');
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09');
    expect(labelWeek('2026-11-09')).toBe('9–15 nov');
  });
  it('aujourd’hui dans le fuseau Europe/Paris', () => {
    // 23h30 UTC le 31 décembre = 0h30 le 1er janvier à Paris
    expect(todayLocal(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
  it('grille du mois', () => {
    const g = monthGrid('2026-11-01');
    expect(g[0]).toBe('2026-10-26');
    expect(g.at(-1)).toBe('2026-11-30');
  });
  it('valide les dates', () => {
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-11-09')).toBe(true);
  });
});

describe('zones', () => {
  it('zones de puissance à partir de la FTP 184 W', () => {
    const z = powerZones(184);
    expect(z).toHaveLength(7);
    expect(z[1]).toMatchObject({ lowPct: 56, highPct: 75, low: 103, high: 138 });
    expect(z[6].high).toBeNull();
  });
  it('zones de FC à partir de la FC max 199', () => {
    const z = hrZones(199);
    expect(z).toHaveLength(5);
    expect(z[1]).toMatchObject({ low: 119, high: 139 });
  });
  it('décrit un bloc en watts', () => {
    const p = defaultSettings().profile;
    const t = builtinTemplates().find((t) => t.id === 'builtin:ht-ss-3x10')!;
    expect(describeBlock(t.blocks[1], p, defaultSettings().hrZoneBoundsPct)).toBe(
      "3 × 10' · 88–93 % FTP (162–171 W) · récup 5'",
    );
    expect(blocksDurationSec(t.blocks)).toBe(3600);
  });
});

describe('durées', () => {
  it.each([
    ['45', 2700],
    ['1h30', 5400],
    ['1h', 3600],
    ['1:30', 90],
    ['30s', 30],
    ["10'", 600],
    ['1,5', 90],
    ['', null],
    ['abc', null],
  ])('parseDuration(%s)', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
  it('formatDuration', () => {
    expect(formatDuration(5400)).toBe('1h30');
    expect(formatDuration(600)).toBe("10'");
    expect(formatDuration(90)).toBe(`1'30"`);
    expect(formatHours(4.5)).toBe('4h30');
  });
});

describe('bibliothèque', () => {
  it('une séance planifiée est une copie indépendante du modèle', () => {
    const t = builtinTemplates()[1];
    const p = instantiate(t, '2026-11-10');
    p.blocks[1].target.ftpPct![0] = 70;
    p.blocks[1].repeat = 5;
    expect(t.blocks[1].target.ftpPct![0]).toBe(88);
    expect(t.blocks[1].repeat).toBe(3);
    expect(p.blocks[1].id).not.toBe(t.blocks[1].id);
    expect(p.templateId).toBe(t.id);
    expect(p.status).toBe('planned');
  });
  it('les durées cibles des modèles correspondent à la somme des blocs (à 2 min près)', () => {
    for (const t of builtinTemplates()) {
      if (!t.blocks.length || t.sport === 'swim') continue;
      expect(Math.abs(blocksDurationSec(t.blocks) / 60 - t.targetDurationMin)).toBeLessThanOrEqual(2);
    }
  });
});

describe('résumé de semaine', () => {
  const W = '2026-11-09';
  const base = blankSession(W);
  const sessions: PlannedSession[] = [
    { ...base, id: '1', sport: 'gravel', environment: 'indoor', targetDurationMin: 60, status: 'done' },
    { ...base, id: '2', sport: 'gravel', environment: 'outdoor', targetDurationMin: 180, date: '2026-11-15' },
    { ...base, id: '3', sport: 'run', environment: 'outdoor', targetDurationMin: 40, status: 'cancelled' },
    { ...base, id: '4', sport: 'football', environment: 'outdoor', targetDurationMin: 90, date: '2026-11-12' },
    { ...base, id: '5', sport: 'run', environment: 'outdoor', targetDurationMin: 40, date: '2026-11-16' },
  ];
  const activities: Activity[] = [
    { ...activityFromSession(sessions[0]), durationSec: 3300 },
    { id: 'x', source: 'manual', sport: 'run', environment: 'outdoor', date: '2026-11-11', durationSec: 1800 },
  ];
  const sum = summarize(sessions, activities, W);

  it('heures prévues par sport, sans les annulées ni la semaine suivante', () => {
    expect(sum.bySport['gravel-in'].plannedH).toBe(1);
    expect(sum.bySport['gravel-out'].plannedH).toBe(3);
    expect(sum.bySport.run.plannedH).toBe(0);
  });
  it('heures faites, y compris une activité non prévue', () => {
    expect(sum.bySport['gravel-in'].doneH).toBeCloseTo(55 / 60);
    expect(sum.bySport.run.doneH).toBe(0.5);
  });
  it('le foot compte dans le total mais pas dans les heures d’endurance', () => {
    expect(sum.endurance.plannedH).toBe(4);
    expect(sum.all.plannedH).toBe(5.5);
  });
  it('taux de réalisation', () => {
    expect(sum.completionRate).toBeCloseTo(1 / 3);
  });
});

describe('sauvegarde', () => {
  const data = {
    sessions: [instantiate(builtinTemplates()[0], '2026-11-10')],
    activities: [] as Activity[],
    templates: builtinTemplates(),
    goals: defaultGoals(),
    settings: [defaultSettings()],
  };

  it('aller-retour export → import', () => {
    const text = JSON.stringify(makeBackup(data));
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data).toEqual(JSON.parse(JSON.stringify(data)));
  });

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(parseBackup('pas du json').ok).toBe(false);
    expect(parseBackup('{"app":"autre"}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...makeBackup(data), schemaVersion: 99 })).ok).toBe(false);
  });

  it('signale les éléments invalides', () => {
    const bad = makeBackup({ ...data, sessions: [{ ...data.sessions[0], date: '2026-13-01' }] });
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/sessions\[0\].*date/);
  });

  it('signale les doublons d’identifiant', () => {
    const bad = makeBackup({ ...data, sessions: [data.sessions[0], data.sessions[0]] });
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });
});
