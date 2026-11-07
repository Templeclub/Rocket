import { describe, expect, it } from 'vitest';
import { activityFromSession, defaultGoals } from './activity';
import { gameState, heldWeeks, judgeWeek, levelFor, readiness, xpOf, xpSummary } from './gamification';
import { generatePlan } from './planner';
import type { Activity, PlannedSession } from './types';
import { defaultSettings } from './zones';

const goal = defaultGoals()[0];
const settings = defaultSettings();
const plan = generatePlan({ startWeek: '2026-11-09', goal, settings, now: 0 });
const W1 = plan.weeks[0];
const inW = (w: string) => plan.sessions.filter((s) => s.date >= w && s.date < addD(w, 7));
function addD(d: string, n: number) {
  return new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
}
const doneUpTo = (today: string, filter: (s: PlannedSession) => boolean = () => true) => {
  const sessions = plan.sessions.map((s) => (s.date < today && filter(s) ? { ...s, status: 'done' as const } : s));
  const activities = sessions.filter((s) => s.status === 'done').map((s) => ({ ...activityFromSession(s), elevationM: s.targetElevationM }));
  return { sessions, activities };
};
const input = (today: string, d: { sessions: PlannedSession[]; activities: Activity[] }) => ({ today, weeks: plan.weeks, ...d, settings, goal });

describe('semaines tenues', () => {
  it('semaine de charge : séances clés faites et 60 % des heures → tenue', () => {
    const d = doneUpTo('2026-11-16');
    expect(judgeWeek(W1, d.sessions, d.activities).ok).toBe(true);
  });
  it('séance clé laissée « non faite » → pas tenue ; laissée tomber proprement → tenue', () => {
    const d = doneUpTo('2026-11-16', (s) => s.priority !== 'key' || s.sport === 'football');
    const j = judgeWeek(W1, d.sessions, d.activities);
    expect(j.ok).toBe(false);
    expect(j.reason).toMatch(/non faite/);
    const key = inW('2026-11-09').find((s) => s.priority === 'key' && s.sport === 'gravel')!;
    const cancelled = d.sessions.map((s) => (s.id === key.id ? { ...s, status: 'cancelled' as const } : s));
    // Clé laissée tombée mais aucune autre clé faite : pas tenue (il faut au moins une clé)
    expect(judgeWeek(W1, cancelled, d.activities).reason).toMatch(/Aucune séance clé|heures/);
  });
  it('semaine allégée : respecter le repos compte, le dépasser non', () => {
    const light = plan.weeks.find((w) => w.kind === 'light')!;
    const base = doneUpTo(addD(light.weekStart, 7));
    expect(judgeWeek(light, base.sessions, base.activities).ok).toBe(true);
    const extra: Activity = { id: 'x', source: 'manual', sport: 'gravel', environment: 'outdoor', date: addD(light.weekStart, 6), durationSec: 4 * 3600 };
    const j = judgeWeek(light, base.sessions, [...base.activities, extra]);
    expect(j.ok).toBe(false);
    expect(j.reason).toMatch(/repos dépassée/);
  });
  it('un joker par mois sauve une semaine ratée ; la série continue', () => {
    const d = doneUpTo('2026-11-30', (s) => s.date >= '2026-11-16');
    const h = heldWeeks(input('2026-11-30', d));
    expect(h.weeks.map((w) => w.status)).toEqual(['joker', 'held', 'held']);
    expect(h.streak).toBe(3);
    expect(h.jokerLeft).toBe(false); // le joker de novembre est utilisé
    expect(heldWeeks(input('2026-12-07', d)).jokerLeft).toBe(true); // nouveau mois, nouveau joker
  });
  it('deux semaines ratées le même mois → la série casse', () => {
    const d = doneUpTo('2026-11-30', (s) => s.date >= '2026-11-23');
    const h = heldWeeks(input('2026-11-30', d));
    expect(h.weeks.map((w) => w.status)).toEqual(['joker', 'missed', 'held']);
    expect(h.streak).toBe(1);
    expect(h.best).toBe(1);
  });
  it('semaine en cours : ce qu’il reste pour la tenir', () => {
    const h = heldWeeks(input('2026-11-10', doneUpTo('2026-11-10')));
    expect(h.current?.todo.join(' ')).toMatch(/clé|endurance/);
  });
});

describe('points et niveaux', () => {
  it('points = minutes × effort perçu (par défaut selon le sport)', () => {
    expect(xpOf(60, 'gravel', 6)).toBe(360);
    expect(xpOf(90, 'football')).toBe(630);
  });
  it('le surplus au-delà de la charge prévue ne rapporte rien', () => {
    const d = doneUpTo('2026-11-16');
    const normal = xpSummary(input('2026-11-16', d), heldWeeks(input('2026-11-16', d)));
    const extra: Activity = { id: 'x', source: 'manual', sport: 'gravel', environment: 'outdoor', date: '2026-11-15', durationSec: 5 * 3600, rpe: 6 };
    const more = { ...d, activities: [...d.activities, extra] };
    const s = xpSummary(input('2026-11-16', more), heldWeeks(input('2026-11-16', more)));
    expect(s.total).toBe(normal.total);
    expect(s.capped).toBeGreaterThan(0);
  });
  it('niveaux : programme suivi à la lettre → « Ascète du désert » la semaine du Desertus, pas avant fin mars', () => {
    expect(gameState(input('2027-03-22', doneUpTo('2027-03-22'))).xp.level.name).not.toBe('Ascète du désert');
    expect(gameState(input('2027-04-05', doneUpTo('2027-04-05'))).xp.level.name).toBe('Ascète du désert');
  });
  it('Finisher : une sortie vélo pendant le Desertus', () => {
    const d = doneUpTo('2027-04-12');
    const race: Activity = { id: 'r', source: 'manual', sport: 'gravel', environment: 'outdoor', date: '2027-04-10', durationSec: 9 * 3600 };
    expect(gameState(input('2027-04-12', { ...d, activities: [...d.activities, race] })).xp.level.name).toBe('Finisher');
  });
  it('progression vers le niveau suivant', () => {
    const l = levelFor(10000);
    expect(l).toMatchObject({ name: 'Pèlerin', nextName: 'Nomade' });
    expect(l.progress).toBeCloseTo(0.5);
  });
});

describe('jauge de préparation', () => {
  it('honnête : au départ, bas ; plan suivi, monte ; jamais 100 % avec un pic à 5h30', () => {
    const start = gameState(input('2026-11-09', { sessions: plan.sessions, activities: [] })).readiness;
    const mid = gameState(input('2027-02-01', doneUpTo('2027-02-01'))).readiness;
    const end = gameState(input('2027-04-05', doneUpTo('2027-04-05'))).readiness;
    expect(start.percent).toBeLessThan(15);
    expect(start.estimated).toBe(true);
    expect(mid.percent).toBeGreaterThan(start.percent);
    expect(end.percent).toBeGreaterThan(mid.percent);
    expect(end.percent).toBeLessThan(80);
  });
  it('chaque composante explique ses points et la prochaine marche', () => {
    const r = gameState(input('2026-12-01', doneUpTo('2026-12-01'))).readiness;
    expect(r.parts.map((p) => p.key)).toEqual(['rhythm', 'longest', 'backToBack', 'specific', 'consistency']);
    expect(r.parts.reduce((s, p) => s + p.weight, 0)).toBe(100);
    for (const p of r.parts) expect(p.next.length).toBeGreaterThan(5);
    expect(r.focus.weight - r.focus.points).toBe(Math.max(...r.parts.map((p) => p.weight - p.points)));
  });
  it('sortie chargée et de nuit faites → spécifique', () => {
    const d = doneUpTo('2027-03-08');
    const r = readiness(input('2027-03-08', d), heldWeeks(input('2027-03-08', d)));
    const sp = r.parts.find((p) => p.key === 'specific')!;
    expect(sp.detail).toMatch(/✓ sortie chargée/);
    expect(sp.detail).toMatch(/✓ sortie de nuit/);
  });
});
