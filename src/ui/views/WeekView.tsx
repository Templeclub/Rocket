import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { db } from '../../db/db';
import { addDays, cap, diffDays, labelDay, weekDays } from '../../engine/dates';
import { SPORT_KEYS, SPORT_META } from '../../engine/sports';
import { summarize, type SportHours } from '../../engine/stats';
import type { Activity, LocalDate, PlannedSession } from '../../engine/types';
import { formatHours } from '../../engine/zones';
import { IconPlus } from '../components/Icons';
import { ProgramEmptyCard, ReminderBanner, WeekPlanHeader } from '../components/ProgramCards';
import { ActivityCard, SessionCard } from '../components/SessionCard';
import { useNav, useToday } from '../hooks';

function Bar({ h, label, emoji, color, strong }: { h: SportHours; label: string; emoji?: string; color: string; strong?: boolean }) {
  const max = Math.max(h.plannedH, h.doneH, 0.01);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-28 shrink-0 truncate ${strong ? 'font-semibold' : ''}`}>
        {emoji && <span className="mr-1">{emoji}</span>}
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full bg-raised overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${(h.plannedH / max) * 100}%`, background: color }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(h.doneH / max) * 100}%`, background: color }} />
      </div>
      <span className={`w-24 shrink-0 text-right tabular-nums ${strong ? 'font-semibold' : 'text-muted'}`}>
        {formatHours(h.doneH)} / {formatHours(h.plannedH)}
      </span>
    </div>
  );
}

export function WeekSummaryPanel({ sessions, activities, weekStart }: { sessions: PlannedSession[]; activities: Activity[]; weekStart: LocalDate }) {
  const sum = summarize(sessions, activities, weekStart);
  const rows = SPORT_KEYS.filter((k) => sum.bySport[k].plannedH > 0 || sum.bySport[k].doneH > 0);
  const rate = sum.completionRate;
  return (
    <section className="rounded-2xl bg-surface border border-line p-3 space-y-2" aria-label="Heures de la semaine">
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span>fait / prévu</span>
        {rate !== null && <span>réalisation {Math.round(rate * 100)} %</span>}
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">Aucune séance cette semaine. Touchez « + » sur un jour.</p>}
      {rows.map((k) => (
        <Bar key={k} h={sum.bySport[k]} label={SPORT_META[k].short} emoji={SPORT_META[k].emoji} color={SPORT_META[k].color} />
      ))}
      {rows.length > 0 && (
        <div className="pt-1 border-t border-line space-y-2">
          <Bar h={sum.endurance} label="Endurance" color="var(--c-accent)" strong />
          {sum.all.plannedH + sum.all.doneH > sum.endurance.plannedH + sum.endurance.doneH && (
            <Bar h={sum.all} label="Tout (foot…)" color="var(--c-muted)" />
          )}
        </div>
      )}
    </section>
  );
}

export function WeekView({ weekStart, focusDate }: { weekStart: LocalDate; focusDate?: LocalDate }) {
  const nav = useNav();
  const today = useToday();
  const end = addDays(weekStart, 7);
  const sessions = useLiveQuery(() => db.sessions.where('date').between(weekStart, end, true, false).toArray(), [weekStart]) ?? [];
  const activities = useLiveQuery(() => db.activities.where('date').between(weekStart, end, true, false).toArray(), [weekStart]) ?? [];
  const goal = useLiveQuery(() => db.goals.where('date').aboveOrEqual(today).first(), [today]);
  const weekCount = useLiveQuery(() => db.weeks.count(), []);
  const dayRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const target = focusDate ?? today;
    const el = dayRefs.current[target];
    if (el) el.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [weekStart, focusDate, today]);

  const byId = new Map(activities.filter((a) => a.plannedSessionId).map((a) => [a.plannedSessionId!, a]));
  const order = { planned: 0, postponed: 0, done: 1, cancelled: 2 } as const;

  return (
    <div className="space-y-3">
      {goal && (
        <div className="text-xs text-muted">
          {goal.name} dans {diffDays(goal.date, today)} jours
        </div>
      )}
      {weekCount === 0 && <ProgramEmptyCard />}
      <ReminderBanner />
      <WeekPlanHeader weekStart={weekStart} />
      <WeekSummaryPanel sessions={sessions} activities={activities} weekStart={weekStart} />

      {weekDays(weekStart).map((d) => {
        const daySessions = sessions
          .filter((s) => s.date === d)
          .sort((a, b) => order[a.status] - order[b.status] || (a.priority === 'key' ? -1 : 1));
        const free = activities.filter((a) => a.date === d && !a.plannedSessionId);
        const isToday = d === today;
        return (
          <section key={d} ref={(el) => void (dayRefs.current[d] = el)} className="scroll-mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className={`font-semibold ${isToday ? 'text-accent' : d < today ? 'text-muted' : ''}`}>
                {cap(labelDay(d))}
                {isToday && <span className="ml-2 text-xs font-normal">aujourd’hui</span>}
              </h2>
              <button
                onClick={() => nav.open({ kind: 'create', date: d })}
                className="w-11 h-11 -mr-1 grid place-items-center rounded-full text-accent active:bg-raised"
                aria-label={`Ajouter une séance le ${labelDay(d)}`}
              >
                <IconPlus className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-2">
              {daySessions.map((s) => (
                <SessionCard key={s.id} session={s} activity={byId.get(s.id)} />
              ))}
              {free.map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
              {daySessions.length === 0 && free.length === 0 && <div className="text-sm text-muted/70 pl-1">—</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
