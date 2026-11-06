import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { db } from '../../db/db';
import { addDays, cap, diffDays, labelDay, weekDays } from '../../engine/dates';
import { parisDaysOf } from '../../engine/planner';
import { SPORT_KEYS, SPORT_META } from '../../engine/sports';
import { summarize, type SportHours } from '../../engine/stats';
import type { Activity, LocalDate, PlannedSession } from '../../engine/types';
import { formatHours } from '../../engine/zones';
import { IconPlus } from '../components/Icons';
import { ProgramEmptyCard, ReminderBanner } from '../components/ProgramCards';
import { ActivityCard, SessionCard } from '../components/SessionCard';
import { useWeekEvaluation, WeekEvaluationCard, WeekStrip } from '../components/WeekEvaluation';
import { useNav, useSettings, useToday } from '../hooks';

function Bar({ h, label, color }: { h: SportHours; label: string; color: string }) {
  const max = Math.max(h.plannedH, h.doneH, 0.01);
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-20 shrink-0 truncate text-muted">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-raised overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${(h.plannedH / max) * 100}%`, background: color }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(h.doneH / max) * 100}%`, background: color }} />
      </div>
      <span className="w-[4.5rem] shrink-0 text-right tabular-nums">
        {formatHours(h.doneH)}
        <span className="text-muted"> / {formatHours(h.plannedH)}</span>
      </span>
    </div>
  );
}

export function WeekSummaryPanel({ sessions, activities, weekStart }: { sessions: PlannedSession[]; activities: Activity[]; weekStart: LocalDate }) {
  const sum = summarize(sessions, activities, weekStart);
  const rows = SPORT_KEYS.filter((k) => sum.bySport[k].plannedH > 0 || sum.bySport[k].doneH > 0);
  if (!rows.length) return null;
  const e = sum.endurance;
  return (
    <section className="rounded-2xl bg-surface card-shadow p-3.5 space-y-2" aria-label="Heures de la semaine">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold tabular-nums">{formatHours(e.doneH)}</span>
        <span className="text-sm text-muted">/ {formatHours(e.plannedH)} d’endurance faites</span>
        {sum.completionRate !== null && <span className="ml-auto text-xs text-muted tabular-nums">{Math.round(sum.completionRate * 100)} % des séances</span>}
      </div>
      {rows.map((k) => (
        <Bar key={k} h={sum.bySport[k]} label={`${SPORT_META[k].emoji} ${SPORT_META[k].short}`} color={SPORT_META[k].color} />
      ))}
    </section>
  );
}

export function WeekView({ weekStart, focusDate }: { weekStart: LocalDate; focusDate?: LocalDate }) {
  const nav = useNav();
  const today = useToday();
  const settings = useSettings();
  const end = addDays(weekStart, 7);
  const sessions = useLiveQuery(() => db.sessions.where('date').between(weekStart, end, true, false).toArray(), [weekStart]) ?? [];
  const activities = useLiveQuery(() => db.activities.where('date').between(weekStart, end, true, false).toArray(), [weekStart]) ?? [];
  const goal = useLiveQuery(() => db.goals.where('date').aboveOrEqual(today).first(), [today]);
  const weekCount = useLiveQuery(() => db.weeks.count(), []);
  const evaluation = useWeekEvaluation(weekStart);
  const dayRefs = useRef<Record<string, HTMLElement | null>>({});
  const paris = new Set(parisDaysOf(weekStart, settings.availability));

  const scrollTo = (d: LocalDate) => dayRefs.current[d]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  useEffect(() => {
    const target = focusDate ?? today;
    const el = dayRefs.current[target];
    if (el && focusDate) el.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [weekStart, focusDate, today]);

  const byId = new Map(activities.filter((a) => a.plannedSessionId).map((a) => [a.plannedSessionId!, a]));
  const issueBySession = new Map((evaluation?.issues ?? []).filter((i) => i.sessionId).map((i) => [i.sessionId!, i.text]));
  const order = { planned: 0, postponed: 0, done: 1, cancelled: 2 } as const;

  return (
    <div className="space-y-3">
      {goal && (
        <div className="text-xs text-muted -mt-1">
          {goal.name} dans <span className="font-semibold text-ink">{diffDays(goal.date, today)} jours</span>
        </div>
      )}
      {weekCount === 0 && <ProgramEmptyCard />}
      <ReminderBanner />
      <WeekStrip weekStart={weekStart} sessions={sessions} onDay={scrollTo} />
      <WeekEvaluationCard weekStart={weekStart} sessions={sessions} evaluation={evaluation} />
      <WeekSummaryPanel sessions={sessions} activities={activities} weekStart={weekStart} />

      <div className="space-y-4 pt-1">
        {weekDays(weekStart).map((d) => {
          const daySessions = sessions
            .filter((s) => s.date === d)
            .sort((a, b) => order[a.status] - order[b.status] || (a.priority === 'key' ? -1 : 1));
          const free = activities.filter((a) => a.date === d && !a.plannedSessionId);
          const isToday = d === today;
          const empty = daySessions.length === 0 && free.length === 0;
          return (
            <section key={d} ref={(el) => void (dayRefs.current[d] = el)} className="scroll-mt-16">
              <div className="flex items-center gap-2 mb-1.5 pl-1">
                <h2 className={`font-display font-semibold ${isToday ? 'text-accent' : d < today ? 'text-muted' : ''}`}>{cap(labelDay(d))}</h2>
                {isToday && <span className="text-[11px] font-medium text-accent">aujourd’hui</span>}
                {paris.has(d) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-ink text-bg">PARIS</span>}
                {empty && <span className="text-xs text-muted">repos</span>}
                <button
                  onClick={() => nav.open({ kind: 'create', date: d })}
                  className="ml-auto w-9 h-9 -mr-1 grid place-items-center rounded-full text-muted active:bg-raised"
                  aria-label={`Ajouter une séance le ${labelDay(d)}`}
                >
                  <IconPlus className="w-5 h-5" />
                </button>
              </div>
              {!empty && (
                <div className="space-y-2">
                  {daySessions.map((s) => (
                    <SessionCard key={s.id} session={s} activity={byId.get(s.id)} issue={issueBySession.get(s.id)} />
                  ))}
                  {free.map((a) => (
                    <ActivityCard key={a.id} activity={a} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
