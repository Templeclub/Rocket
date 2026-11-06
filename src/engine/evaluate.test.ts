import { describe, expect, it } from 'vitest';
import { defaultGoals } from './activity';
import { isoWeekday } from './dates';
import { programProgress, rebuildWeek, weekIssues } from './evaluate';
import { footballDaysOf, generatePlan, parisDaysOf, toggleParisDay } from './planner';
import type { Activity, AppSettings } from './types';
import { defaultSettings } from './zones';

const goal = defaultGoals()[0];
const W = '2026-11-16';

function withParis(days: string[]): AppSettings {
  const s = defaultSettings();
  return { ...s, availability: { ...s.availability, parisByWeek: { [W]: days } } };
}

describe('présence à Paris depuis la vue semaine', () => {
  it('par défaut : mardi et mercredi de la semaine type', () => {
    expect(parisDaysOf(W, defaultSettings().availability)).toEqual(['2026-11-17', '2026-11-18']);
  });
  it('un tap sur un jour pose 2 jours à partir de celui-ci', () => {
    expect(toggleParisDay([], '2026-11-19', W)).toEqual(['2026-11-19', '2026-11-20']);
  });
  it('ne déborde pas sur la semaine suivante', () => {
    expect(toggleParisDay([], '2026-11-22', W)).toEqual(['2026-11-22']);
  });
  it('un tap sur un jour à Paris le retire (présence plus courte)', () => {
    expect(toggleParisDay(['2026-11-17', '2026-11-18'], '2026-11-18', W)).toEqual(['2026-11-17']);
  });
  it('un tap sur un jour voisin l’ajoute (présence plus longue)', () => {
    expect(toggleParisDay(['2026-11-17', '2026-11-18'], '2026-11-19', W)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19']);
  });
  it('un tap ailleurs déplace la présence', () => {
    expect(toggleParisDay(['2026-11-17', '2026-11-18'], '2026-11-20', W)).toEqual(['2026-11-20', '2026-11-21']);
  });
});

describe('foot lundi et jeudi, sauf à Paris', () => {
  it('Paris mardi-mercredi → foot lundi et jeudi', () => {
    expect(footballDaysOf(W, defaultSettings().availability)).toEqual(['2026-11-16', '2026-11-19']);
  });
  it('Paris mercredi-jeudi → foot le lundi seulement', () => {
    expect(footballDaysOf(W, withParis(['2026-11-18', '2026-11-19']).availability)).toEqual(['2026-11-16']);
  });
  it('la semaine générée respecte Paris et le foot ; la séance structurée trouve un matin compatible', () => {
    const settings = withParis(['2026-11-18', '2026-11-19']);
    const { sessions } = generatePlan({ startWeek: W, goal, settings, now: 0 });
    const week = sessions.filter((s) => s.date >= W && s.date <= '2026-11-22');
    expect(week.filter((s) => s.sport === 'football').map((s) => s.date)).toEqual(['2026-11-16']);
    for (const s of week.filter((x) => x.date === '2026-11-18' || x.date === '2026-11-19')) expect(s.sport).toBe('run');
    // Lundi = foot, mardi = lendemain du foot : le vendredi accueille la séance structurée.
    const structured = week.find((s) => s.environment === 'indoor' && (s.rpe ?? 0) >= 6);
    expect(structured && isoWeekday(structured.date)).toBe(5);
  });
  it('sans matin compatible (Paris mar-mer, foot lun-jeu) : efforts intégrés à la sortie du samedi', () => {
    const { sessions } = generatePlan({ startWeek: W, goal, settings: defaultSettings(), now: 0 });
    const sat = sessions.find((s) => s.date === '2026-11-21')!;
    expect(sat.title).toMatch(/tempo/i);
    expect(sat.notes).toMatch(/intégrée/);
  });
});

describe('signalements et replanification de la semaine', () => {
  const base = generatePlan({ startWeek: '2026-11-09', goal, settings: defaultSettings(), now: 0 });
  const plan = base.weeks.find((w) => w.weekStart === W)!;

  it('semaine générée cohérente : aucun signalement', () => {
    expect(weekIssues({ weekStart: W, sessions: base.sessions, settings: defaultSettings(), today: '2026-11-15', plan })).toEqual([]);
  });

  it('Paris déplacé au jeudi-vendredi : foot du jeudi et séance du vendredi signalés, foot du mardi manquant', () => {
    const settings = withParis(['2026-11-19', '2026-11-20']);
    const issues = weekIssues({ weekStart: W, sessions: base.sessions, settings, today: '2026-11-15', plan });
    const texts = issues.map((i) => i.text).join(' | ');
    expect(texts).toMatch(/Paris ce jour-là : pas de foot/);
    expect(issues.some((i) => i.date === '2026-11-17' && /Foot du/.test(i.text))).toBe(false); // mardi n’est pas un jour de foot
  });

  it('replanifier une semaine qui colle déjà ne propose rien', () => {
    for (const w of base.weeks.slice(0, 8)) {
      const r = rebuildWeek({ week: w, weeks: base.weeks, sessions: base.sessions, settings: defaultSettings(), goal, fromDate: w.weekStart, now: 0 });
      expect({ week: w.weekStart, add: r.add.map((s) => s.title), remove: r.remove.map((s) => s.title) }).toEqual({ week: w.weekStart, add: [], remove: [] });
    }
  });

  it('replanifier : garde le réalisé et le manuel, remplace les séances générées (recommandées ou confirmées)', () => {
    const settings = withParis(['2026-11-19', '2026-11-20']);
    const sessions = base.sessions.map((s) =>
      s.date === '2026-11-16' ? { ...s, status: 'done' as const } : s.date === '2026-11-21' ? { ...s, confirmed: true } : s,
    );
    const manual = { ...sessions.find((s) => s.date === '2026-11-21')!, id: 'manual', origin: 'manual' as const, date: '2026-11-22' };
    const r = rebuildWeek({ week: plan, weeks: base.weeks, sessions: [...sessions, manual], settings, goal, fromDate: '2026-11-16', now: 0 });
    expect(r.remove.some((s) => s.date === '2026-11-16')).toBe(false);
    // Le foot du lundi (inchangé) n’apparaît ni dans les retraits ni dans les ajouts.
    expect([...r.remove, ...r.add].some((s) => s.sport === 'football' && s.date === '2026-11-16')).toBe(false);
    expect(r.remove.some((s) => s.id === 'manual')).toBe(false);
    expect(r.remove.some((s) => s.date === '2026-11-21')).toBe(true);
    expect(r.add.some((s) => s.date === '2026-11-16' || s.date === '2026-11-22')).toBe(false);
    for (const s of r.add.filter((x) => x.date === '2026-11-19' || x.date === '2026-11-20')) expect(s.sport).toBe('run');
    expect(r.add.every((s) => !s.confirmed)).toBe(true);
    const after = [...sessions.filter((s) => !r.remove.includes(s)), manual, ...r.add];
    expect(weekIssues({ weekStart: W, sessions: after, settings, today: '2026-11-16', plan })).toEqual([]);
  });
});

describe('suivi du programme', () => {
  const { weeks } = generatePlan({ startWeek: '2026-11-09', goal, settings: defaultSettings(), now: 0 });
  const a = (date: string, h: number): Activity => ({ id: date + h, source: 'manual', sport: 'gravel', environment: 'outdoor', date, durationSec: h * 3600 });

  it('début : rien à comparer', () => {
    expect(programProgress({ weekStart: '2026-11-09', today: '2026-11-09', weeks, activities: [], settings: defaultSettings() }).status).toBe('start');
  });
  it('en retard sous 85 % du prévu', () => {
    const p = programProgress({ weekStart: '2026-11-23', today: '2026-11-23', weeks, activities: [a('2026-11-14', 1), a('2026-11-21', 1.5)], settings: defaultSettings() });
    expect(p.status).toBe('behind');
    expect(p.ratio).toBeLessThan(0.85);
    expect(p.weeks).toHaveLength(2);
  });
  it('en avance au-dessus de 110 %', () => {
    const p = programProgress({ weekStart: '2026-11-23', today: '2026-11-23', weeks, activities: [a('2026-11-14', 4.5), a('2026-11-21', 4.5)], settings: defaultSettings() });
    expect(p.status).toBe('ahead');
  });
  it('dans le plan sinon', () => {
    const t = weeks.filter((w) => w.weekStart < '2026-11-23').map((w) => w.targetHours);
    const p = programProgress({ weekStart: '2026-11-23', today: '2026-11-23', weeks, activities: [a('2026-11-14', t[0]), a('2026-11-21', t[1])], settings: defaultSettings() });
    expect(p.status).toBe('on-track');
  });
});
