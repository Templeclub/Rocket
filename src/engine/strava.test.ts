import { describe, expect, it } from 'vitest';
import { blankSession } from './library';
import { classify, matchSession, normalize, toActivity, type StravaActivity } from './strava';
import type { PlannedSession } from './types';

const c = (name: string, sport_type: string, trainer = false) => classify({ name, sport_type, trainer });

describe('classement Strava : le titre d’abord', () => {
  it('le foot remonte en « Workout » intitulé football', () => {
    expect(c('Football', 'Workout')).toMatchObject({ sport: 'football', by: 'title' });
    expect(c('Entraînement foot du jeudi', 'Workout')?.sport).toBe('football');
    expect(c('Five entre collègues', 'Workout')?.sport).toBe('football');
  });
  it('Rouvy et home-trainer → gravel intérieur, même en type Ride', () => {
    expect(c('Rouvy - Alpe d’Huez', 'Ride')).toMatchObject({ sport: 'gravel', environment: 'indoor', by: 'title' });
    expect(c('HT sweet spot 3x10', 'Ride')).toMatchObject({ environment: 'indoor' });
    expect(c('Séance home-trainer', 'Workout')).toMatchObject({ sport: 'gravel', environment: 'indoor' });
    expect(c('Zwift - Watopia', 'VirtualRide')).toMatchObject({ environment: 'indoor' });
  });
  it('vélo extérieur : gravel, route, VTT', () => {
    expect(c('Sortie gravel Entre-deux-Mers', 'GravelRide')).toMatchObject({ sport: 'gravel', environment: 'outdoor' });
    expect(c('Vélo de route', 'Ride')).toMatchObject({ sport: 'gravel', environment: 'outdoor' });
    expect(c('Morning Ride', 'Ride')).toMatchObject({ sport: 'gravel', environment: 'outdoor' });
    expect(c('Balade', 'MountainBikeRide')).toMatchObject({ sport: 'gravel', environment: 'outdoor', by: 'type' });
  });
  it('un titre vélo sur une activité marquée home-trainer reste intérieur', () => {
    expect(c('Sortie vélo', 'Ride', true)).toMatchObject({ environment: 'indoor', by: 'trainer' });
    expect(c('Afternoon', 'Ride', true)).toMatchObject({ environment: 'indoor' });
  });
  it('course, natation, enduro', () => {
    expect(c('Footing quais', 'Run')?.sport).toBe('run');
    expect(c('Lunch Run', 'Run')?.sport).toBe('run');
    expect(c('Piscine Judaïque', 'Swim')?.sport).toBe('swim');
    expect(c('Natation 2000 m', 'Workout')?.sport).toBe('swim');
    expect(c('Enduro Médoc', 'Workout')?.sport).toBe('enduro');
  });
  it('« footing » n’est pas du foot ; « course » n’est pas du vélo', () => {
    expect(c('Footing', 'Run')?.sport).toBe('run');
    expect(c('Course à pied', 'Workout')?.sport).toBe('run');
  });
  it('disciplines hors plan : ignorées', () => {
    expect(c('Marche avec le chien', 'Walk')).toBeNull();
    expect(c('Muscu', 'WeightTraining')).toBeNull();
    expect(c('Séance', 'Workout')).toBeNull();
  });
  it('normalisation : accents et ponctuation', () => {
    expect(normalize('Fractionné — Côtes !')).toBe(' fractionne cotes ');
  });
});

describe('conversion', () => {
  const a: StravaActivity = {
    id: 123,
    name: 'Rouvy - Tourmalet',
    sport_type: 'VirtualRide',
    start_date: '2026-11-10T06:31:00Z',
    start_date_local: '2026-11-10T07:31:00Z',
    moving_time: 3540,
    elapsed_time: 3700,
    distance: 28400.4,
    total_elevation_gain: 512.3,
    average_heartrate: 142.6,
    average_watts: 151.2,
    device_watts: true,
    trainer: true,
  };
  it('date locale, durée en mouvement, puissance, identifiant externe', () => {
    const act = toActivity(a, classify(a)!, 'x');
    expect(act).toMatchObject({ date: '2026-11-10', durationSec: 3540, distanceM: 28400, elevationM: 512, avgHr: 143, avgPower: 151, externalId: 'strava:123', source: 'strava', environment: 'indoor', title: 'Rouvy - Tourmalet' });
  });
  it('une activité juste après minuit reste sur la bonne journée locale', () => {
    expect(toActivity({ ...a, start_date_local: '2026-11-11T00:20:00Z' }, classify(a)!, 'y').date).toBe('2026-11-11');
  });
});

describe('rapprochement : jour et discipline seulement', () => {
  const base = blankSession('2026-11-14');
  const ride: PlannedSession = { ...base, id: 'ride', sport: 'gravel', environment: 'outdoor', targetDurationMin: 180, priority: 'key' };
  const run: PlannedSession = { ...base, id: 'run', sport: 'run', environment: 'outdoor', targetDurationMin: 40 };
  it('sortie extérieure prévue, faite sur Rouvy (45 min au lieu de 3h) : associée quand même', () => {
    expect(matchSession({ date: '2026-11-14', sport: 'gravel', environment: 'indoor' }, [ride, run], new Set())?.id).toBe('ride');
  });
  it('autre jour ou autre discipline : rien', () => {
    expect(matchSession({ date: '2026-11-15', sport: 'gravel', environment: 'outdoor' }, [ride], new Set())).toBeNull();
    expect(matchSession({ date: '2026-11-14', sport: 'swim', environment: 'indoor' }, [ride, run], new Set())).toBeNull();
  });
  it('une séance déjà prise ou annulée n’est pas réutilisée', () => {
    expect(matchSession({ date: '2026-11-14', sport: 'gravel', environment: 'outdoor' }, [ride], new Set(['ride']))).toBeNull();
    expect(matchSession({ date: '2026-11-14', sport: 'gravel', environment: 'outdoor' }, [{ ...ride, status: 'cancelled' }], new Set())).toBeNull();
  });
  it('préférence : même environnement', () => {
    const ht: PlannedSession = { ...ride, id: 'ht', environment: 'indoor', priority: 'optional' };
    expect(matchSession({ date: '2026-11-14', sport: 'gravel', environment: 'indoor' }, [ride, ht], new Set())?.id).toBe('ht');
  });
});
