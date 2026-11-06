import { describe, expect, it } from 'vitest';
import { defaultGoals } from './activity';
import { addDays, diffDays, isoWeekday } from './dates';
import { defaultStartWeek, generatePlan, macroPlan } from './planner';
import { buildReview, isIntense, realRhythm, weekToConfirm } from './review';
import { summarize } from './stats';
import { daylight } from './sun';
import type { Activity, PlannedSession, WeekPlan } from './types';
import { switchToAlternative } from './workouts';
import { blocksDurationSec, defaultSettings } from './zones';

const goal = defaultGoals()[0];
const settings = defaultSettings();
const plan = generatePlan({ startWeek: '2026-11-09', goal, settings, now: 0 });
const week = (w: string) => plan.weeks.find((x) => x.weekStart === w)!;
const sessionsOf = (w: string) => plan.sessions.filter((s) => diffDays(s.date, w) >= 0 && diffDays(s.date, w) < 7);

describe('macro-plan jusqu’au Desertus', () => {
  it('22 semaines, du 9 novembre à la semaine du 5 avril', () => {
    expect(plan.weeks).toHaveLength(22);
    expect(plan.weeks[0].weekStart).toBe('2026-11-09');
    expect(plan.weeks.at(-1)!.weekStart).toBe('2027-04-05');
    expect(plan.weeks.at(-1)!.kind).toBe('race');
  });

  it('phases : base → développement → spécifique → affûtage (2 dernières semaines)', () => {
    expect(week('2026-12-28').phase).toBe('base');
    expect(week('2027-01-04').phase).toBe('development');
    expect(week('2027-02-15').phase).toBe('specific');
    expect(week('2027-03-29').phase).toBe('taper');
    expect(week('2027-03-22').phase).toBe('specific');
  });

  it('semaine allégée toutes les 3 à 4 semaines (dernière connue : 26 octobre)', () => {
    expect(week('2026-11-23').kind).toBe('light');
    const kinds = plan.weeks.map((w) => w.kind);
    let streak = 1;
    for (const k of kinds) {
      if (k === 'load' || k === 'block') streak++;
      else streak = 0;
      expect(streak).toBeLessThanOrEqual(3);
    }
  });

  it('congés de Noël → semaine bloc, suivie d’une semaine allégée', () => {
    expect(week('2026-12-28').kind).toBe('block');
    expect(week('2027-01-04').kind).toBe('light');
  });

  it('étranger du 6 au 20 février → semaines course uniquement, sans foot', () => {
    for (const w of ['2027-02-08', '2027-02-15']) {
      expect(week(w).kind).toBe('travel');
      expect(sessionsOf(w).every((s) => s.sport === 'run')).toBe(true);
    }
    expect(plan.sessions.some((s) => s.date >= '2027-02-06' && s.date <= '2027-02-20' && s.sport !== 'run')).toBe(false);
  });

  it('volume d’endurance : départ ≤ 3h × 1,10, jamais au-dessus du pic hors semaine bloc', () => {
    expect(plan.weeks[0].targetHours).toBeLessThanOrEqual(3 * 1.1);
    for (const w of plan.weeks) {
      if (w.kind !== 'block') expect(w.targetHours).toBeLessThanOrEqual(settings.volume.peakWeeklyHours);
    }
  });

  it('les heures d’endurance prévues collent à la cible (± 30 min), le foot en plus', () => {
    for (const w of plan.weeks) {
      const sum = summarize(sessionsOf(w.weekStart), [], w.weekStart);
      if (w.weekStart === '2027-02-01') continue; // week-end à l’étranger
      expect(Math.abs(sum.endurance.plannedH - w.targetHours)).toBeLessThanOrEqual(0.5);
    }
  });

  it('foot le lundi et le jeudi, sauf à Paris et en voyage ; rien d’autre ces jours-là', () => {
    const w = sessionsOf('2026-11-16');
    expect(w.filter((s) => s.sport === 'football').map((s) => s.date)).toEqual(['2026-11-16', '2026-11-19']);
    for (const f of plan.sessions.filter((s) => s.sport === 'football')) {
      expect(plan.sessions.filter((s) => s.date === f.date)).toHaveLength(1);
      expect([1, 4]).toContain(isoWeekday(f.date));
    }
  });

  it('la plus longue sortie progresse d’au plus 45 min', () => {
    let longest = 120;
    for (const w of plan.weeks) {
      expect(w.longRideMin).toBeLessThanOrEqual(longest + 45);
      longest = Math.max(longest, w.longRideMin);
    }
  });
});

describe('règles de construction des semaines', () => {
  it('R4 : au plus 2 séances clés par semaine (un enchaînement compte pour une)', () => {
    for (const w of plan.weeks) {
      const keys = sessionsOf(w.weekStart).filter((s) => s.priority === 'key');
      const units = new Set(keys.map((s) => (/^(Bloc|Enchaînement|Répétition)|chargée|de nuit/.test(s.title) && isoWeekday(s.date) >= 5 ? 'weekend' : s.id)));
      expect(units.size).toBeLessThanOrEqual(2);
    }
  });

  it('R7 : aucune séance intense la veille, le jour ou le lendemain du foot', () => {
    const foot = plan.sessions.filter((s) => s.sport === 'football');
    for (const s of plan.sessions.filter(isIntense)) {
      expect(foot.some((f) => Math.abs(diffDays(f.date, s.date)) <= 1)).toBe(false);
    }
  });

  it('R8 : en semaine, extérieur seulement si la séance est entièrement de jour (hors congés)', () => {
    for (const s of plan.sessions) {
      if (s.sport !== 'gravel' || s.environment !== 'outdoor' || isoWeekday(s.date) >= 6) continue;
      const leave = settings.availability.exceptions.some((e) => e.kind === 'leave' && e.start <= s.date && s.date <= e.end);
      const blockFriday = /^Bloc J1/.test(s.title);
      if (leave || blockFriday) continue;
      const d = daylight(s.date);
      expect(d.dawn).toBeLessThanOrEqual(450);
      expect(450 + s.targetDurationMin).toBeLessThanOrEqual(d.dusk);
    }
  });

  it('les jours à Paris ne portent que de la course', () => {
    for (const s of plan.sessions) {
      const wd = isoWeekday(s.date);
      const exc = settings.availability.exceptions.some((e) => e.start <= s.date && s.date <= e.end);
      if ((wd === 2 || wd === 3) && !exc) expect(s.sport).toBe('run');
    }
  });

  it('pas de double séance dans la journée', () => {
    const days = plan.sessions.map((s) => s.date);
    expect(new Set(days).size).toBe(days.length);
  });

  it('chaque séance générée a des blocs qui valent sa durée (vélo, course)', () => {
    for (const s of plan.sessions) {
      if (s.sport === 'football' || s.sport === 'swim') continue;
      expect(Math.round(blocksDurationSec(s.blocks) / 60)).toBe(s.targetDurationMin);
    }
  });

  it('spécifique : sortie chargée, sortie de nuit, bloc de 3 jours, répétition générale', () => {
    const titles = plan.sessions.filter((s) => s.date >= '2027-02-15').map((s) => s.title);
    expect(titles.some((t) => /chargée/.test(t))).toBe(true);
    expect(titles.some((t) => /de nuit/.test(t))).toBe(true);
    expect(titles.filter((t) => /^Bloc J/.test(t)).length).toBe(3);
    expect(titles.some((t) => /Répétition générale/.test(t))).toBe(true);
  });

  it('variantes : sortie → home-trainer, course → natation, bascule en 1 tap et retour', () => {
    const ride = plan.sessions.find((s) => s.type === 'sortie longue')!;
    expect(ride.alternative?.environment).toBe('indoor');
    const sw = switchToAlternative(ride);
    expect(sw.environment).toBe('indoor');
    expect(sw.targetDistanceKm).toBeUndefined();
    expect(switchToAlternative(sw).targetDistanceKm).toBe(ride.targetDistanceKm);
    const footing = plan.sessions.find((s) => s.sport === 'run')!;
    expect(footing.alternative?.sport).toBe('swim');
  });

  it('semaine de départ d’une génération', () => {
    expect(defaultStartWeek('2026-11-06')).toBe('2026-11-09');
    expect(defaultStartWeek('2026-11-17')).toBe('2026-11-16');
    expect(defaultStartWeek('2026-11-19')).toBe('2026-11-23');
  });

  it('régénération en cours de route : reprend le cycle et la progression', () => {
    const prior = plan.weeks.filter((w) => w.weekStart < '2027-01-11');
    const re = macroPlan({ startWeek: '2027-01-11', goal, settings, history: { weeks: prior, rhythmHours: [4, 4, 4, 4] }, now: 0 });
    expect(re[0].kind).toBe('load');
    expect(re[0].targetHours).toBe(4.25);
    expect(re.at(-1)!.kind).toBe('race');
  });
});

// --- Bilan hebdomadaire ---

const act = (date: string, hours: number, over: Partial<Activity> = {}): Activity => ({
  id: `${date}-${hours}-${Math.random()}`,
  source: 'manual',
  sport: 'gravel',
  environment: 'outdoor',
  date,
  durationSec: hours * 3600,
  ...over,
});

describe('rythme réel (R1)', () => {
  const weeks: WeekPlan[] = plan.weeks;
  it('sans données avant le plan : valeur de départ (3h d’endurance)', () => {
    const r = realRhythm({ before: '2026-11-09', activities: [], weeks, startHours: 3, planStart: '2026-11-09' });
    expect(r.hours).toBe(3);
  });
  it('le foot ne compte pas dans le rythme d’endurance', () => {
    const r = realRhythm({ before: '2026-11-16', activities: [act('2026-11-09', 1.5, { sport: 'football' }), act('2026-11-14', 2)], weeks, startHours: 3, planStart: '2026-11-09' });
    expect(r.weeks[0].hours).toBe(2);
  });
  it('ignore les semaines allégées et prend les 4 dernières semaines normales', () => {
    const acts = [act('2026-11-10', 5), act('2026-11-17', 6), act('2026-11-24', 1), act('2026-12-01', 5), act('2026-12-08', 6)];
    const r = realRhythm({ before: '2026-12-14', activities: acts, weeks, startHours: 4.5, planStart: '2026-11-09' });
    expect(r.weeks.map((w) => w.weekStart)).toEqual(['2026-12-07', '2026-11-30', '2026-11-16', '2026-11-09']);
    expect(r.hours).toBe(5.5);
  });
  it('une semaine exclue n’est pas comptée', () => {
    const ws = weeks.map((w) => (w.weekStart === '2026-12-07' ? { ...w, excluded: true } : w));
    const r = realRhythm({ before: '2026-12-14', activities: [act('2026-12-08', 1)], weeks: ws, startHours: 4.5, planStart: '2026-11-09' });
    expect(r.weeks.map((w) => w.weekStart)).not.toContain('2026-12-07');
  });
});

describe('bilan et recommandations', () => {
  const base = { weeks: plan.weeks, settings, planStart: '2026-11-09' };
  const w2 = '2026-11-16';

  it('plafond = rythme réel × 1,10 ; au-dessus → alléger en sacrifiant d’abord les optionnelles', () => {
    // Semaine 1 très peu faite : 1h au lieu de 3h15
    const acts = [act('2026-11-14', 1)];
    const sessions: PlannedSession[] = plan.sessions.map((s) => (s.date < w2 ? { ...s, status: s.date === '2026-11-14' ? 'done' : s.status } : s));
    const r = buildReview({ ...base, targetWeek: w2, today: '2026-11-15', sessions, activities: acts });
    expect(r.cap).toBeCloseTo(((3 * 3 + 1) / 4) * 1.1);
    const reduce = r.items.find((i) => i.type === 'reduce-volume')!;
    expect(reduce).toBeDefined();
    expect(reduce.justification).toMatchObject({ metric: 'volume prévu', unit: 'h' });
    const first = reduce.choices[0].actions[0];
    expect(first.kind).toBe('cancel');
    const cancelled = sessions.find((s) => first.kind === 'cancel' && s.id === first.sessionId)!;
    expect(cancelled.priority).toBe('optional');
    expect(cancelled.sport).not.toBe('football');
  });

  it('séance clé manquée : laisser tomber ou déplacer si la semaine suivante n’est pas chargée, jamais automatiquement', () => {
    const acts = [act('2026-11-10', 1, { environment: 'indoor' }), act('2026-11-11', 0.5, { sport: 'run' }), act('2026-11-12', 1.5, { sport: 'football' }), act('2026-11-08', 3), act('2026-11-01', 3)];
    const r = buildReview({ ...base, targetWeek: w2, today: '2026-11-15', sessions: plan.sessions, activities: acts });
    const missed = r.items.find((i) => i.type === 'missed-key');
    expect(missed).toBeDefined();
    expect(missed!.choices[0].label).toBe('Laisser tomber');
    expect(r.previousMissed.every((s) => s.status === 'planned')).toBe(true);
  });

  it('deux semaines sous 70 % → proposer de baisser la cible', () => {
    const w3 = '2026-11-30';
    const r = buildReview({ ...base, targetWeek: w3, today: '2026-11-29', sessions: plan.sessions, activities: [] });
    expect(r.items.some((i) => i.type === 'low-completion')).toBe(true);
    const low = r.items.find((i) => i.type === 'low-completion')!;
    expect(low.justification.unit).toBe('%');
  });

  it('R7 : séance intense le lendemain du foot → signalée avec une proposition', () => {
    const sessions = plan.sessions.map((s) => (s.date === '2026-11-17' && s.sport === 'run' ? { ...s, rpe: 8 } : s));
    const r = buildReview({ ...base, targetWeek: w2, today: '2026-11-15', sessions, activities: [] });
    const item = r.items.find((i) => i.type === 'football-intensity');
    expect(item?.justification.value).toBe(1);
  });

  it('semaine à confirmer : la suivante dès le samedi, la courante le lundi', () => {
    expect(weekToConfirm('2026-11-14', plan.weeks)).toBe('2026-11-16');
    expect(weekToConfirm('2026-11-16', plan.weeks)).toBe('2026-11-16');
    expect(weekToConfirm('2026-11-18', plan.weeks)).toBeNull();
    const confirmed = plan.weeks.map((w) => (w.weekStart === '2026-11-16' ? { ...w, confirmedAt: 1 } : w));
    expect(weekToConfirm('2026-11-14', confirmed)).toBeNull();
    expect(addDays('2026-11-14', 0)).toBe('2026-11-14');
  });
});
