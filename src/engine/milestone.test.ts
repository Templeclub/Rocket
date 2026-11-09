import { describe, expect, it } from 'vitest';
import { defaultGoals } from './activity';
import { longRideSlots } from './milestone';
import { generatePlan } from './planner';
import { defaultSettings } from './zones';

const goal = defaultGoals()[0];
const settings = defaultSettings();
const plan = generatePlan({ startWeek: '2026-11-09', goal, settings, now: 0 });
const slots = longRideSlots({ today: '2026-11-09', weeks: plan.weeks, sessions: plan.sessions, settings });
const at = (d: string) => slots.find((s) => s.date === d)!;

describe('créneaux de la sortie de 6 h en mars', () => {
  it('tous les jours de mars, du 1er au 31', () => {
    expect(slots).toHaveLength(31);
    expect(slots[0].date).toBe('2027-03-01');
  });
  it('recommandé : le samedi des longs week-ends (13 et 27 mars) ; il remplace la grande journée', () => {
    expect(slots.filter((s) => s.level === 'best').map((s) => s.date)).toEqual(['2027-03-13', '2027-03-27']);
    expect(at('2027-03-13').replaces.map((s) => s.title)[0]).toMatch(/Bloc J2/);
  });
  it('possible : vendredi posé du long week-end, autres week-ends', () => {
    expect(at('2027-03-12').level).toBe('ok');
    expect(at('2027-03-06').level).toBe('ok');
    expect(at('2027-03-21').level).toBe('ok');
  });
  it('impossible : jours de travail, Paris, foot, affûtage', () => {
    expect(at('2027-03-03').level).toBe('no'); // mercredi, Paris
    expect(at('2027-03-04').level).toBe('no'); // jeudi, foot
    expect(at('2027-03-05').reason).toMatch(/travail/);
    expect(at('2027-03-30').reason).toMatch(/Affûtage/);
  });
  it('dates passées refusées', () => {
    const late = longRideSlots({ today: '2027-03-10', weeks: plan.weeks, sessions: plan.sessions, settings });
    expect(late.find((s) => s.date === '2027-03-06')!.level).toBe('no');
  });
});
