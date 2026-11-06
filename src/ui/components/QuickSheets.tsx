import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { db } from '../../db/db';
import { CONFIG } from '../../engine/config';
import { addDays, cap, diffDays, labelDay, labelWeekday } from '../../engine/dates';
import { SPORT_KEYS, SPORT_META, sportKey } from '../../engine/sports';
import { isPending } from '../../engine/status';
import type { LocalDate, SportKey } from '../../engine/types';
import { formatDuration, formatHours } from '../../engine/zones';
import { useNav, useSessionActions } from '../hooks';
import { IconCheck, IconOpen, IconStar, IconX } from './Icons';
import { Sheet } from './Sheet';

function useDayLoads(from: LocalDate, days: number) {
  return (
    useLiveQuery(async () => {
      const list = await db.sessions.where('date').between(from, addDays(from, days), true, false).toArray();
      const map = new Map<LocalDate, { n: number; h: number; sports: SportKey[] }>();
      for (const s of list) {
        if (s.status === 'cancelled') continue;
        const e = map.get(s.date) ?? { n: 0, h: 0, sports: [] };
        e.n += 1;
        e.h += s.targetDurationMin / 60;
        e.sports.push(sportKey(s.sport, s.environment));
        map.set(s.date, e);
      }
      return map;
    }, [from, days]) ?? new Map()
  );
}

function Action({ label, onClick, children, tone }: { label: string; onClick: () => void; children: ReactNode; tone?: 'accent' | 'danger' }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-medium active:scale-95 ${
        tone === 'accent' ? 'bg-accent text-accent-ink' : tone === 'danger' ? 'bg-raised text-danger' : 'bg-raised'
      }`}
    >
      {children}
      <span className="truncate max-w-full px-1">{label}</span>
    </button>
  );
}

/**
 * Toutes les actions d'une séance dans un seul panneau (ouvert par « ⋯ ») :
 * fait, confirmer, variante, annuler en 2 taps ; reporter et échanger en 2 taps (le jour ou la séance sont ici).
 */
export function ActionsSheet({ id }: { id: string }) {
  const nav = useNav();
  const act = useSessionActions();
  const session = useLiveQuery(() => db.sessions.get(id), [id]);
  const start = act.today;
  const n = CONFIG.ui.postponeDaysOffered + 1;
  const loads = useDayLoads(start, n + 1);
  const others = useLiveQuery(() => db.sessions.where('date').between(start, addDays(start, 14), true, false).toArray(), [start]);
  if (!session) return null;
  const meta = SPORT_META[sportKey(session.sport, session.environment)];
  const pending = isPending(session);
  const close = (fn: () => void) => () => {
    nav.close();
    fn();
  };

  const days = Array.from({ length: n + 1 }, (_, i) => addDays(start, i)).filter((d) => d !== session.date);
  const swaps = (others ?? []).filter((s) => s.id !== id && isPending(s) && s.date !== session.date).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <span>{meta.emoji}</span>
          <span className="truncate">{session.title}</span>
        </span>
      }
      onClose={nav.close}
    >
      <div className="space-y-4">
        <div className="text-sm text-muted -mt-1">
          {cap(labelDay(session.date))} · {formatDuration(session.targetDurationMin * 60)} · {pending ? (session.confirmed ? 'confirmée' : 'recommandée') : session.status === 'done' ? 'faite' : 'annulée'}
        </div>

        <div className="flex gap-2">
          {pending && (
            <Action label="Fait" tone="accent" onClick={close(() => act.done(id))}>
              <IconCheck />
            </Action>
          )}
          {pending && (
            <Action label={session.confirmed ? 'Recommandée' : 'Confirmer'} onClick={close(() => act.setConfirmed([id], !session.confirmed))}>
              <span className={`w-5 h-5 rounded-full border-2 ${session.confirmed ? 'border-dashed border-muted' : 'border-accent bg-accent/20'}`} />
            </Action>
          )}
          {pending && session.alternative && (
            <Action label={session.alternative.sport === 'swim' ? 'Natation' : session.alternative.environment === 'indoor' ? 'Home-trainer' : 'Extérieur'} onClick={close(() => act.switchVariant(id, session.alternative!.title))}>
              <span className="text-lg leading-none">{SPORT_META[sportKey(session.alternative.sport, session.alternative.environment)].emoji}</span>
            </Action>
          )}
          {pending && (
            <Action label="Annuler" tone="danger" onClick={close(() => act.cancel(id))}>
              <IconX />
            </Action>
          )}
          {session.status === 'cancelled' && (
            <Action label="Rétablir" tone="accent" onClick={close(() => act.restore(id))}>
              <IconCheck />
            </Action>
          )}
          <Action label="Fiche" onClick={() => nav.replace({ kind: 'session', id })}>
            <IconOpen />
          </Action>
        </div>

        {pending && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Reporter au</h3>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {days.map((d) => {
                const l = loads.get(d);
                const rel = diffDays(d, start);
                return (
                  <button
                    key={d}
                    onClick={close(() => act.postpone(id, d))}
                    className="shrink-0 w-[4.6rem] rounded-2xl bg-raised p-2 text-center active:scale-95"
                    aria-label={`Reporter au ${labelDay(d)}`}
                  >
                    <div className="text-[11px] text-muted">{rel === 0 ? 'Auj.' : rel === 1 ? 'Demain' : cap(labelWeekday(d))}</div>
                    <div className="font-display text-xl font-semibold leading-tight">{+d.slice(8)}</div>
                    <div className="flex justify-center gap-0.5 h-2 mt-1">
                      {l ? l.sports.slice(0, 3).map((k: SportKey, i: number) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: SPORT_META[k].color }} />) : null}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">{l ? formatHours(l.h) : 'libre'}</div>
                  </button>
                );
              })}
              <label className="shrink-0 w-[4.6rem] rounded-2xl border border-dashed border-line p-2 text-center text-[11px] text-muted flex flex-col items-center justify-center relative">
                Autre date
                <input type="date" min={start} className="absolute inset-0 opacity-0" onChange={(e) => e.target.value && (nav.close(), act.postpone(id, e.target.value))} />
              </label>
            </div>
          </section>
        )}

        {pending && session.date >= start && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Échanger avec</h3>
            {swaps.length === 0 ? (
              <p className="text-sm text-muted">Aucune autre séance en attente sur 2 semaines.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {swaps.map((s) => {
                  const m = SPORT_META[sportKey(s.sport, s.environment)];
                  return (
                    <button key={s.id} onClick={close(() => act.swap(id, s.id))} className="shrink-0 w-36 rounded-2xl bg-raised p-2.5 text-left active:scale-95">
                      <div className="text-[11px] text-muted">{cap(labelDay(s.date))}</div>
                      <div className="text-sm font-medium truncate">
                        {m.emoji} {s.title}
                      </div>
                      <div className="text-[11px] text-muted">{formatDuration(s.targetDurationMin * 60)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
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
      title={`Ajouter · ${cap(labelDay(date))}`}
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
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
        {(['all', ...SPORT_KEYS] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 h-9 px-3 rounded-full text-sm ${filter === k ? 'bg-ink text-bg' : 'bg-raised'}`}
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
              className="w-full rounded-2xl bg-raised p-3 text-left flex items-center gap-3 active:scale-[0.99]"
            >
              <span className="w-1 self-stretch rounded" style={{ background: m.color }} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>{m.emoji}</span>
                  <span className="truncate">{t.title}</span>
                  {t.priority === 'key' && (
                    <span className="text-accent">
                      <IconStar className="w-3 h-3" />
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
