import { describe, expect, it } from 'vitest';
import {
  postponeOptions,
  canTransition,
  cancel,
  displayStatus,
  isMissed,
  markDone,
  postpone,
  restore,
  swap,
  TransitionError,
  undoDone,
} from './status';
import type { PlannedSession } from './types';

const TODAY = '2026-11-09';

function s(over: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'a',
    title: 'Sweet spot',
    sport: 'gravel',
    type: 'sweet spot',
    environment: 'indoor',
    targetDurationMin: 60,
    blocks: [],
    priority: 'key',
    date: '2026-11-10',
    status: 'planned',
    origin: 'manual',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe('transitions autorisées', () => {
  it('une séance prévue peut être faite, reportée ou annulée', () => {
    expect(canTransition('planned', 'done')).toBe(true);
    expect(canTransition('planned', 'postponed')).toBe(true);
    expect(canTransition('planned', 'cancelled')).toBe(true);
  });
  it('une séance faite ne peut pas être annulée directement', () => {
    expect(canTransition('done', 'cancelled')).toBe(false);
  });
});

describe('report', () => {
  it('déplace la séance et garde la date d’origine', () => {
    const r = postpone(s(), '2026-11-12', TODAY, 5);
    expect(r.date).toBe('2026-11-12');
    expect(r.originalDate).toBe('2026-11-10');
    expect(r.status).toBe('postponed');
    expect(r.updatedAt).toBe(5);
  });

  it('ne modifie pas la séance d’entrée', () => {
    const a = s();
    postpone(a, '2026-11-12', TODAY);
    expect(a.date).toBe('2026-11-10');
    expect(a.status).toBe('planned');
  });

  it('un second report conserve la toute première date', () => {
    const r = postpone(postpone(s(), '2026-11-12', TODAY), '2026-11-14', TODAY);
    expect(r.originalDate).toBe('2026-11-10');
    expect(r.date).toBe('2026-11-14');
  });

  it('revenir à la date d’origine efface le report', () => {
    const r = postpone(postpone(s(), '2026-11-12', TODAY), '2026-11-10', TODAY);
    expect(r.status).toBe('planned');
    expect(r.originalDate).toBeUndefined();
  });

  it('refuse un report dans le passé', () => {
    expect(() => postpone(s(), '2026-11-08', TODAY)).toThrow(TransitionError);
  });

  it('autorise le report d’une séance manquée vers aujourd’hui', () => {
    const r = postpone(s({ date: '2026-11-07' }), TODAY, TODAY);
    expect(r.date).toBe(TODAY);
    expect(r.originalDate).toBe('2026-11-07');
  });

  it('refuse la même date', () => {
    expect(() => postpone(s(), '2026-11-10', TODAY)).toThrow(TransitionError);
  });

  it('refuse de reporter une séance faite ou annulée', () => {
    expect(() => postpone(s({ status: 'done' }), '2026-11-12', TODAY)).toThrow(TransitionError);
    expect(() => postpone(s({ status: 'cancelled' }), '2026-11-12', TODAY)).toThrow(TransitionError);
  });
});

describe('échange', () => {
  it('échange les dates de deux séances', () => {
    const [a, b] = swap(s({ id: 'a', date: '2026-11-10' }), s({ id: 'b', date: '2026-11-14' }), TODAY);
    expect(a.date).toBe('2026-11-14');
    expect(b.date).toBe('2026-11-10');
    expect(a.originalDate).toBe('2026-11-10');
    expect(b.originalDate).toBe('2026-11-14');
    expect(a.status).toBe('postponed');
  });

  it('un double échange ramène les deux séances à l’état prévu', () => {
    const [a1, b1] = swap(s({ id: 'a', date: '2026-11-10' }), s({ id: 'b', date: '2026-11-14' }), TODAY);
    const [a2, b2] = swap(a1, b1, TODAY);
    expect([a2.date, a2.status, a2.originalDate]).toEqual(['2026-11-10', 'planned', undefined]);
    expect([b2.date, b2.status, b2.originalDate]).toEqual(['2026-11-14', 'planned', undefined]);
  });

  it('refuse d’échanger avec une séance faite, passée, ou le même jour', () => {
    expect(() => swap(s({ id: 'a' }), s({ id: 'b', date: '2026-11-12', status: 'done' }), TODAY)).toThrow();
    expect(() => swap(s({ id: 'a' }), s({ id: 'b', date: '2026-11-01' }), TODAY)).toThrow();
    expect(() => swap(s({ id: 'a' }), s({ id: 'b' }), TODAY)).toThrow();
    expect(() => swap(s({ id: 'a' }), s({ id: 'a', date: '2026-11-12' }), TODAY)).toThrow();
  });
});

describe('annulation, rétablissement, fait', () => {
  it('annule puis rétablit une séance prévue', () => {
    const c = cancel(s());
    expect(c.status).toBe('cancelled');
    expect(restore(c).status).toBe('planned');
  });

  it('rétablir une séance reportée puis annulée la remet en « reportée »', () => {
    const c = cancel(postpone(s(), '2026-11-12', TODAY));
    const r = restore(c);
    expect(r.status).toBe('postponed');
    expect(r.date).toBe('2026-11-12');
  });

  it('marque faite puis annule le « fait »', () => {
    const d = markDone(s());
    expect(d.status).toBe('done');
    expect(undoDone(d).status).toBe('planned');
    expect(undoDone(markDone(postpone(s(), '2026-11-12', TODAY))).status).toBe('postponed');
  });

  it('refuse les transitions incohérentes', () => {
    expect(() => cancel(s({ status: 'done' }))).toThrow(TransitionError);
    expect(() => markDone(s({ status: 'cancelled' }))).toThrow(TransitionError);
    expect(() => restore(s())).toThrow(TransitionError);
    expect(() => undoDone(s())).toThrow(TransitionError);
  });
});

describe('séance manquée : jamais rattrapée automatiquement', () => {
  it('une séance prévue passée est signalée « non faite » et reste à sa date', () => {
    const past = s({ date: '2026-11-07' });
    expect(isMissed(past, TODAY)).toBe(true);
    expect(displayStatus(past, TODAY)).toBe('non faite');
    expect(past.date).toBe('2026-11-07');
  });
  it('une séance du jour n’est pas manquée', () => {
    expect(isMissed(s({ date: TODAY }), TODAY)).toBe(false);
  });
  it('une séance faite ou annulée n’est jamais manquée', () => {
    expect(isMissed(s({ date: '2026-11-07', status: 'done' }), TODAY)).toBe(false);
    expect(isMissed(s({ date: '2026-11-07', status: 'cancelled' }), TODAY)).toBe(false);
  });
});

describe('jours proposés pour reporter', () => {
  it('autour de la date de la séance, pas à partir d’aujourd’hui', () => {
    const o = postponeOptions('2026-11-20', '2026-11-09');
    expect(o[0]).toBe('2026-11-17');
    expect(o).not.toContain('2026-11-20');
    expect(o.at(-1)).toBe('2026-11-27');
  });
  it('jamais dans le passé', () => {
    const o = postponeOptions('2026-11-10', '2026-11-09');
    expect(o[0]).toBe('2026-11-09');
  });
  it('séance manquée : à partir d’aujourd’hui', () => {
    const o = postponeOptions('2026-11-05', '2026-11-09');
    expect(o[0]).toBe('2026-11-09');
    expect(o.at(-1)).toBe('2026-11-16');
  });
});
