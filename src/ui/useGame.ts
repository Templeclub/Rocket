import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { gameState, type GameState } from '../engine/gamification';
import { withDefaults } from '../engine/zones';
import { useToday } from './hooks';

/** État de motivation (jauge, semaines tenues, niveau), recalculé à chaque changement des données. */
export function useGame(): GameState | undefined {
  const today = useToday();
  return useLiveQuery(async () => {
    const [weeks, sessions, activities, s, goals] = await Promise.all([
      db.weeks.toArray(),
      db.sessions.toArray(),
      db.activities.toArray(),
      db.settings.get('app'),
      db.goals.toArray(),
    ]);
    if (!weeks.length) return undefined;
    return gameState({ today, weeks, sessions, activities, settings: withDefaults(s), goal: goals.find((g) => g.kind === 'main') });
  }, [today]);
}
