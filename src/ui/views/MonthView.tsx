import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addDays, addMonths, labelWeek, monthGrid, weekDays } from '../../engine/dates';
import { SPORT_META, sportKey } from '../../engine/sports';
import { summarize } from '../../engine/stats';
import { isMissed } from '../../engine/status';
import type { LocalDate } from '../../engine/types';
import { formatHours } from '../../engine/zones';
import { useNav, useToday } from '../hooks';

const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function MonthView({ monthStart }: { monthStart: LocalDate }) {
  const nav = useNav();
  const today = useToday();
  const weeks = monthGrid(monthStart);
  const from = weeks[0];
  const to = addDays(weeks[weeks.length - 1], 7);
  const sessions = useLiveQuery(() => db.sessions.where('date').between(from, to, true, false).toArray(), [from, to]) ?? [];
  const activities = useLiveQuery(() => db.activities.where('date').between(from, to, true, false).toArray(), [from, to]) ?? [];
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const nextMonth = addMonths(monthStart, 1);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface border border-line p-2">
        <div className="grid grid-cols-7 text-center text-xs text-muted mb-1">
          {WD.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w} className="grid grid-cols-7 gap-0.5">
            {weekDays(w).map((d) => {
              const inMonth = d >= monthStart && d < nextMonth;
              const ds = sessions.filter((s) => s.date === d);
              const free = activities.filter((a) => a.date === d && !a.plannedSessionId);
              const goal = goals.find((g) => g.date === d);
              return (
                <button
                  key={d}
                  onClick={() => nav.goWeekOf(d)}
                  className={`min-h-16 rounded-lg p-1 flex flex-col items-center gap-1 ${inMonth ? '' : 'opacity-35'} ${
                    d === today ? 'ring-2 ring-accent' : ''
                  } ${goal ? 'bg-accent/15' : 'active:bg-raised'}`}
                  aria-label={d}
                >
                  <span className={`text-sm tabular-nums ${d === today ? 'font-bold text-accent' : ''}`}>{+d.slice(8)}</span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {ds.map((s) => {
                      const c = SPORT_META[sportKey(s.sport, s.environment)].color;
                      const done = s.status === 'done';
                      const cancelled = s.status === 'cancelled';
                      const missed = isMissed(s, today);
                      return (
                        <span
                          key={s.id}
                          className={`w-2.5 h-2.5 rounded-full ${cancelled ? 'opacity-30' : ''}`}
                          style={{
                            background: done ? c : 'transparent',
                            border: `2px solid ${missed ? 'var(--c-danger)' : c}`,
                          }}
                        />
                      );
                    })}
                    {free.map((a) => (
                      <span key={a.id} className="w-2.5 h-2.5 rounded-sm" style={{ background: SPORT_META[sportKey(a.sport, a.environment)].color }} />
                    ))}
                  </span>
                  {goal && <span className="text-[10px] leading-none text-accent font-semibold">🏁</span>}
                </button>
              );
            })}
          </div>
        ))}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted mt-2 px-1">
          <span>● faite</span>
          <span>○ prévue</span>
          <span className="text-danger">○ non faite</span>
          <span>■ non prévue</span>
        </div>
      </div>

      <section className="rounded-2xl bg-surface border border-line divide-y divide-line">
        {weeks.map((w) => {
          const s = summarize(sessions, activities, w);
          return (
            <button key={w} onClick={() => nav.goWeekOf(w)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm">
              <span>{labelWeek(w)}</span>
              <span className="tabular-nums text-muted">
                <span className="text-ink font-medium">{formatHours(s.endurance.doneH)}</span> / {formatHours(s.endurance.plannedH)}
                {s.completionRate !== null && <span className="ml-2">· {Math.round(s.completionRate * 100)} %</span>}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
