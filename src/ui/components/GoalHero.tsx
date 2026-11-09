import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { diffDays, labelShort } from '../../engine/dates';
import { summarize } from '../../engine/stats';
import type { LocalDate, PlannedSession, Activity } from '../../engine/types';
import { formatHours } from '../../engine/zones';
import { useToday } from '../hooks';

/** Bandeau d'objectif : compte à rebours, objectif, et avancement d'endurance de la semaine. */
export function GoalHero({ weekStart, sessions, activities }: { weekStart: LocalDate; sessions: PlannedSession[]; activities: Activity[] }) {
  const today = useToday();
  const goal = useLiveQuery(async () => (await db.goals.toArray()).find((g) => g.kind === 'main' && g.date >= today), [today]);
  if (!goal) return null;
  const days = diffDays(goal.date, today);
  const e = summarize(sessions, activities, weekStart).endurance;
  const pct = e.plannedH > 0 ? Math.min(1, e.doneH / e.plannedH) : 0;
  return (
    <section className="relative overflow-hidden rounded-3xl bg-sport px-4 pt-3.5 pb-3 shadow-lg shadow-[var(--c-sport-2)]/20">
      {/* Motif de vitesse */}
      <svg className="absolute -right-6 -top-4 w-48 h-32 opacity-20" viewBox="0 0 200 120" aria-hidden="true">
        <path d="M20 100 L120 0 M60 120 L180 0 M110 120 L230 0" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
      </svg>
      <div className="relative flex items-end gap-3">
        <div className="font-display font-black italic leading-none tracking-tight">
          <span className="text-5xl tabular-nums">J-{days}</span>
        </div>
        <div className="pb-1 min-w-0">
          <div className="font-display font-bold leading-tight truncate">{goal.name}</div>
          <div className="text-xs opacity-90 truncate">
            {labelShort(goal.date)}
            {goal.distanceKm ? ` · ${goal.distanceKm.toLocaleString('fr-FR')} km` : ''}
            {goal.elevationM ? ` · ${goal.elevationM.toLocaleString('fr-FR')} m D+` : ''}
          </div>
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-2 text-xs font-semibold">
        <div className="flex-1 h-2 rounded-full bg-black/20 overflow-hidden">
          <div className="h-full rounded-full bg-current" style={{ width: `${pct * 100}%` }} />
        </div>
        <span className="tabular-nums">
          {formatHours(e.doneH)} / {formatHours(e.plannedH)} cette semaine
        </span>
      </div>
    </section>
  );
}
