import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { addDays, addMonths, labelDay, labelWeek, monthGrid, weekDays } from '../../engine/dates';
import { KIND_LABEL, PHASE_LABEL } from '../../engine/planner';
import { SPORT_KEYS, SPORT_META, sportKey } from '../../engine/sports';
import { summarize } from '../../engine/stats';
import { isMissed } from '../../engine/status';
import type { Activity, LocalDate, PlannedSession, SportKey } from '../../engine/types';
import { formatDuration, formatHours } from '../../engine/zones';
import { LongRideCard } from '../components/LongRide';
import { Segmented } from '../components/Form';
import { PhaseTimeline, phaseColor, phaseSoft } from '../components/Phases';
import { useNav, useToday } from '../hooks';

const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
type Mode = 'sessions' | 'sports';
const MODE_KEY = 'ascese.monthMode';

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'sports' ? 'sports' : 'sessions';
  } catch {
    return 'sessions';
  }
}

/** Disciplines du jour, de la plus longue à la plus courte (la plus longue à l'extérieur). */
function daySports(sessions: PlannedSession[], free: Activity[]): SportKey[] {
  const minutes = new Map<SportKey, number>();
  for (const s of sessions) {
    if (s.status === 'cancelled') continue;
    const k = sportKey(s.sport, s.environment);
    minutes.set(k, (minutes.get(k) ?? 0) + s.targetDurationMin);
  }
  for (const a of free) {
    const k = sportKey(a.sport, a.environment);
    minutes.set(k, (minutes.get(k) ?? 0) + a.durationSec / 60);
  }
  return [...minutes.entries()].sort((a, b) => b[1] - a[1] || SPORT_KEYS.indexOf(a[0]) - SPORT_KEYS.indexOf(b[0])).map(([k]) => k);
}

/** Un rond par discipline, imbriqués du plus grand au plus petit, séparés par un liseré de la couleur du fond. */
function Rings({ keys, size = 30 }: { keys: SportKey[]; size?: number }) {
  if (!keys.length) return <span style={{ width: size, height: size }} className="block" />;
  const R = size / 2 - 1;
  const step = R / keys.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {keys.map((k, i) => (
        <circle key={k} cx={size / 2} cy={size / 2} r={R - i * step} fill={SPORT_META[k].color} stroke="var(--c-surface)" strokeWidth={i === 0 ? 0 : 2} />
      ))}
    </svg>
  );
}

export function MonthView({ monthStart }: { monthStart: LocalDate }) {
  const nav = useNav();
  const today = useToday();
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  };
  const weeks = monthGrid(monthStart);
  const from = weeks[0];
  const to = addDays(weeks[weeks.length - 1], 7);
  const sessions = useLiveQuery(() => db.sessions.where('date').between(from, to, true, false).toArray(), [from, to]) ?? [];
  const activities = useLiveQuery(() => db.activities.where('date').between(from, to, true, false).toArray(), [from, to]) ?? [];
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const plans = useLiveQuery(() => db.weeks.where('weekStart').between(from, to, true, false).toArray(), [from, to]) ?? [];
  const nextMonth = addMonths(monthStart, 1);
  const shownSports = new Set<SportKey>();

  return (
    <div className="space-y-4">
      <LongRideCard />
      <PhaseTimeline current={plans.find((p) => p.weekStart >= monthStart)?.weekStart ?? monthStart} onWeek={(w) => nav.goWeekOf(w)} />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'sessions', label: 'Séances' },
          { value: 'sports', label: 'Disciplines' },
        ]}
      />
      <div className="rounded-2xl bg-surface border border-line p-2">
        <div className="grid grid-cols-7 text-center text-xs text-muted mb-1">
          {WD.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
        {weeks.map((w, wi) => {
          const p = plans.find((x) => x.weekStart === w);
          const prev = wi > 0 ? plans.find((x) => x.weekStart === weeks[wi - 1]) : undefined;
          const showLabel = p && (!prev || prev.phase !== p.phase);
          return (
          <div key={w}>
            {showLabel && (
              <div className="flex items-center gap-1.5 px-1 pt-1.5 pb-0.5 text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full" style={{ background: phaseColor(p.phase) }} />
                {PHASE_LABEL[p.phase]}
              </div>
            )}
          <div className="grid grid-cols-7 gap-0.5 rounded-xl" style={{ background: p ? phaseSoft(p.phase) : undefined }}>
            {weekDays(w).map((d) => {
              const inMonth = d >= monthStart && d < nextMonth;
              const ds = sessions.filter((s) => s.date === d);
              const free = activities.filter((a) => a.date === d && !a.plannedSessionId);
              const goal = goals.find((g) => g.date === d);
              const keys = mode === 'sports' ? daySports(ds, free) : [];
              if (inMonth) keys.forEach((k) => shownSports.add(k));
              const label = `${labelDay(d)}${keys.length ? ' : ' + keys.map((k) => SPORT_META[k].label).join(', ') : ''}`;
              return (
                <button
                  key={d}
                  onClick={() => nav.goWeekOf(d)}
                  className={`min-h-16 rounded-lg p-1 flex flex-col items-center gap-1 ${inMonth ? '' : 'opacity-35'} ${
                    d === today ? 'ring-2 ring-accent' : ''
                  } ${goal?.kind === 'main' ? 'bg-accent/15' : 'active:bg-raised'}`}
                  aria-label={label}
                  title={label}
                >
                  <span className={`text-sm tabular-nums ${d === today ? 'font-bold text-accent' : ''}`}>{+d.slice(8)}</span>
                  {mode === 'sports' ? (
                    <Rings keys={keys} />
                  ) : (
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
                            style={{ background: done ? c : 'transparent', border: `2px solid ${missed ? 'var(--c-danger)' : c}` }}
                          />
                        );
                      })}
                      {free.map((a) => (
                        <span key={a.id} className="w-2.5 h-2.5 rounded-sm" style={{ background: SPORT_META[sportKey(a.sport, a.environment)].color }} />
                      ))}
                    </span>
                  )}
                  {goal &&
                    (goal.kind === 'milestone' ? (
                      <span className="text-[9px] leading-none font-bold px-1 py-0.5 rounded bg-sport">{formatDuration((goal.durationMin ?? 360) * 60)}</span>
                    ) : (
                      <span className="text-[10px] leading-none text-accent font-semibold">🏁</span>
                    ))}
                </button>
              );
            })}
          </div>
          </div>
          );
        })}
        {mode === 'sports' ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-3 px-1" aria-label="Légende des disciplines">
            {SPORT_KEYS.map((k) => (
              <li key={k} className={`flex items-center gap-1.5 ${shownSports.has(k) ? '' : 'opacity-45'}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: SPORT_META[k].color }} />
                <span>{SPORT_META[k].label}</span>
              </li>
            ))}
            <li className="col-span-2 text-muted pt-1">Plusieurs disciplines le même jour : ronds imbriqués, la plus longue à l’extérieur.</li>
          </ul>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted mt-2 px-1">
            <span>● faite</span>
            <span>○ prévue</span>
            <span className="text-danger">○ non faite</span>
            <span>■ non prévue</span>
          </div>
        )}
      </div>

      <section className="rounded-2xl bg-surface border border-line divide-y divide-line">
        {weeks.map((w) => {
          const s = summarize(sessions, activities, w);
          const p = plans.find((x) => x.weekStart === w);
          return (
            <button key={w} onClick={() => nav.goWeekOf(w)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left">
              <span>
                <span className="block">{labelWeek(w)}</span>
                {p && (
                  <span className="block text-xs text-muted">
                    {PHASE_LABEL[p.phase]} · {KIND_LABEL[p.kind]}
                    {p.confirmedAt ? ' · ✓' : ''}
                  </span>
                )}
              </span>
              <span className="tabular-nums text-muted shrink-0">
                <span className="text-ink font-medium">{formatHours(s.all.doneH)}</span> / {formatHours(s.all.plannedH)}
                {s.completionRate !== null && <span className="ml-2">· {Math.round(s.completionRate * 100)} %</span>}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
