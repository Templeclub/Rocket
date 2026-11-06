import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { CONFIG } from '../../engine/config';
import { addDays, cap, diffDays, labelDay } from '../../engine/dates';
import { SPORT_KEYS, SPORT_META, sportKey } from '../../engine/sports';
import { isPending } from '../../engine/status';
import type { LocalDate, SportKey } from '../../engine/types';
import { formatDuration, formatHours } from '../../engine/zones';
import { useNav, useSessionActions } from '../hooks';
import { IconStar } from './Icons';
import { Sheet } from './Sheet';

function useDayLoads(from: LocalDate, days: number) {
  return (
    useLiveQuery(async () => {
      const list = await db.sessions.where('date').between(from, addDays(from, days), true, false).toArray();
      const map = new Map<LocalDate, { n: number; h: number }>();
      for (const s of list) {
        if (s.status === 'cancelled') continue;
        const e = map.get(s.date) ?? { n: 0, h: 0 };
        e.n += 1;
        e.h += s.targetDurationMin / 60;
        map.set(s.date, e);
      }
      return map;
    }, [from, days]) ?? new Map()
  );
}

/** Report : 1er tap sur « Reporter » (carte), 2e tap sur le jour. */
export function PostponeSheet({ id }: { id: string }) {
  const nav = useNav();
  const act = useSessionActions();
  const session = useLiveQuery(() => db.sessions.get(id), [id]);
  const start = act.today;
  const n = CONFIG.ui.postponeDaysOffered + 1;
  const loads = useDayLoads(start, n + 1);
  if (!session) return null;

  const days = Array.from({ length: n + 1 }, (_, i) => addDays(start, i)).filter((d) => d !== session.date);
  const pick = (d: LocalDate) => {
    nav.close();
    act.postpone(id, d);
  };

  return (
    <Sheet title={`Reporter « ${session.title} »`} onClose={nav.close}>
      <div className="grid grid-cols-2 gap-2">
        {days.map((d) => {
          const l = loads.get(d);
          const rel = diffDays(d, start);
          return (
            <button key={d} onClick={() => pick(d)} className="rounded-xl bg-raised p-3 text-left active:scale-[0.98]">
              <div className="font-medium">{rel === 0 ? 'Aujourd’hui' : rel === 1 ? 'Demain' : cap(labelDay(d))}</div>
              <div className="text-xs text-muted">
                {rel <= 1 ? labelDay(d) + ' · ' : ''}
                {l ? `${l.n} séance${l.n > 1 ? 's' : ''} · ${formatHours(l.h)}` : 'libre'}
              </div>
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-3 rounded-xl border border-line p-3">
        <span className="text-sm text-muted">Autre date</span>
        <input
          type="date"
          min={start}
          className="flex-1 bg-transparent"
          onChange={(e) => e.target.value && pick(e.target.value)}
        />
      </label>
    </Sheet>
  );
}

/** Échange : 1er tap sur ⇄ (carte), 2e tap sur l'autre séance. */
export function SwapSheet({ id }: { id: string }) {
  const nav = useNav();
  const act = useSessionActions();
  const session = useLiveQuery(() => db.sessions.get(id), [id]);
  const others = useLiveQuery(
    () => db.sessions.where('date').between(act.today, addDays(act.today, 14), true, false).toArray(),
    [act.today],
  );
  if (!session) return null;
  const candidates = (others ?? [])
    .filter((s) => s.id !== id && isPending(s) && s.date !== session.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Sheet title={`Échanger « ${session.title} » avec…`} onClose={nav.close}>
      {candidates.length === 0 && <p className="text-muted text-sm">Aucune autre séance en attente sur les 2 prochaines semaines.</p>}
      <div className="space-y-2">
        {candidates.map((s) => {
          const m = SPORT_META[sportKey(s.sport, s.environment)];
          return (
            <button
              key={s.id}
              onClick={() => {
                nav.close();
                act.swap(id, s.id);
              }}
              className="w-full rounded-xl bg-raised p-3 text-left flex items-center gap-3"
            >
              <span className="w-1.5 self-stretch rounded" style={{ background: m.color }} />
              <span className="flex-1">
                <span className="block font-medium">
                  {m.emoji} {s.title}
                </span>
                <span className="block text-xs text-muted">
                  {labelDay(s.date)} · {formatDuration(s.targetDurationMin * 60)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Création rapide : « + » sur le jour, puis tap sur une séance type. */
export function CreateSheet({ date }: { date: LocalDate }) {
  const nav = useNav();
  const act = useSessionActions();
  const [filter, setFilter] = useState<SportKey | 'all'>('all');
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];

  const order = (k: SportKey) => SPORT_KEYS.indexOf(k);
  const list = templates
    .filter((t) => filter === 'all' || sportKey(t.sport, t.environment) === filter)
    .sort(
      (a, b) =>
        (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) ||
        order(sportKey(a.sport, a.environment)) - order(sportKey(b.sport, b.environment)) ||
        a.title.localeCompare(b.title),
    );

  return (
    <Sheet
      title={`Ajouter · ${labelDay(date)}`}
      onClose={nav.close}
      full
      footer={
        <div className="flex gap-2">
          <button onClick={() => nav.replace({ kind: 'newSession', date })} className="flex-1 h-11 rounded-xl bg-raised font-medium">
            Séance vierge
          </button>
          <button onClick={() => nav.replace({ kind: 'activity', date })} className="flex-1 h-11 rounded-xl bg-raised font-medium">
            Activité non prévue
          </button>
        </div>
      }
    >
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4">
        {(['all', ...SPORT_KEYS] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 h-9 px-3 rounded-full text-sm ${filter === k ? 'bg-accent text-accent-ink' : 'bg-raised'}`}
          >
            {k === 'all' ? 'Tous' : `${SPORT_META[k].emoji} ${SPORT_META[k].short}`}
          </button>
        ))}
      </div>
      <div className="space-y-2 mt-1">
        {list.map((t) => {
          const m = SPORT_META[sportKey(t.sport, t.environment)];
          return (
            <button
              key={t.id}
              onClick={() => {
                nav.close();
                act.createFromTemplate(t.id, date);
              }}
              className="w-full rounded-xl bg-raised p-3 text-left flex items-center gap-3 active:scale-[0.99]"
            >
              <span className="w-1.5 self-stretch rounded" style={{ background: m.color }} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>{m.emoji}</span>
                  <span className="truncate">{t.title}</span>
                  {t.priority === 'key' && (
                    <span className="text-accent">
                      <IconStar />
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted">
                  {m.label} · {formatDuration(t.targetDurationMin * 60)}
                  {t.targetDistanceKm ? ` · ${t.targetDistanceKm} km` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
