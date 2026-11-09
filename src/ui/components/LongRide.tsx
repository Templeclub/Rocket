import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, getSettings } from '../../db/db';
import { getLongRide, LONG_RIDE_ID, placeLongRide, removeLongRide } from '../../db/milestone';
import { CONFIG } from '../../engine/config';
import { addDays, cap, isoWeekday, labelDay, startOfWeek } from '../../engine/dates';
import { longRideSlots, milestoneTitle, type Slot } from '../../engine/milestone';
import { formatDuration } from '../../engine/zones';
import { useNav, useToday } from '../hooks';
import { phaseSoft } from './Phases';
import { Sheet } from './Sheet';
import { SportGlyph } from './SportGlyph';
import { useToast } from './Toast';

const M = CONFIG.longRideMilestone;
const kmFor = (min: number) => Math.round(((min / 60) * CONFIG.plan.gravelSpeedKmh) / 5) * 5;

export function useLongRide() {
  return useLiveQuery(() => db.goals.get(LONG_RIDE_ID), []);
}

/** Carte de rappel : la sortie de 6 h à planifier en mars, ou sa date si elle est posée. */
export function LongRideCard() {
  const nav = useNav();
  const today = useToday();
  const g = useLongRide();
  const hasPlan = useLiveQuery(() => db.weeks.count(), []);
  if (!hasPlan || today > `${M.month}-31`) return null;
  return (
    <button onClick={() => nav.open({ kind: 'longride' })} className="w-full rounded-2xl bg-surface card-shadow p-3 flex items-center gap-3 text-left">
      <SportGlyph k="gravel-out" size={40} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{g ? g.name : 'Sortie de 6 h et plus'}</span>
        <span className="block text-sm text-muted truncate">
          {g ? `${cap(labelDay(g.date))} · ${g.distanceKm ?? kmFor(g.durationMin ?? M.defaultMin)} km` : 'À planifier en mars : choisis ton jour'}
        </span>
      </span>
      <span className="text-sm font-semibold text-accent">{g ? 'Modifier' : 'Planifier'}</span>
    </button>
  );
}

const LEVEL: Record<Slot['level'], string> = {
  best: 'ring-2 ring-accent font-bold',
  ok: '',
  no: 'opacity-35',
};

/** Choix du jour de la sortie longue en mars, de sa durée, et déplacement. */
export function LongRideSheet() {
  const nav = useNav();
  const toast = useToast();
  const today = useToday();
  const current = useLongRide();
  const currentSession = useLiveQuery(async () => (current?.sessionId ? db.sessions.get(current.sessionId) : undefined), [current?.sessionId]);
  const data = useLiveQuery(async () => {
    const [weeks, settings] = await Promise.all([db.weeks.toArray(), getSettings()]);
    const sessions = await db.sessions.where('date').between(`${M.month}-01`, addDays(`${M.month}-31`, 1), true, false).toArray();
    return { weeks, settings, sessions };
  }, [current?.date]);
  const [minutes, setMinutes] = useState<number>(M.defaultMin);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const slots = data ? longRideSlots({ today, weeks: data.weeks, sessions: data.sessions, settings: data.settings, current }) : [];
  useEffect(() => {
    if (current) {
      setMinutes(current.durationMin ?? M.defaultMin);
      setLoaded(/chargé/i.test(currentSession?.notes ?? ''));
    }
    if (!selected && slots.length) setSelected(current?.date ?? slots.find((s) => s.level === 'best')?.date ?? slots.find((s) => s.level === 'ok')?.date ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.date, slots.length]);
  if (!data) return null;
  const sel = slots.find((s) => s.date === selected);
  const first = `${M.month}-01`;
  const lead = isoWeekday(first) - 1;
  const weekOf = (d: string) => data.weeks.find((w) => w.weekStart === startOfWeek(d));

  const place = async () => {
    if (!sel || sel.level === 'no') return;
    setBusy(true);
    try {
      const undo = await placeLongRide(sel.date, minutes, { loaded, today });
      nav.close();
      toast(`${milestoneTitle(minutes)} posée le ${labelDay(sel.date)} · semaine réajustée`, { label: 'Annuler', run: undo });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Ta sortie longue de mars"
      onClose={nav.close}
      full
      footer={
        <div className="space-y-2">
          <button disabled={busy || !sel || sel.level === 'no'} onClick={place} className="w-full h-12 rounded-xl bg-sport font-semibold disabled:opacity-40">
            {!sel || sel.level === 'no'
              ? 'Choisis un jour possible'
              : current && current.date === sel.date && current.durationMin === minutes
                ? `Mettre à jour (${formatDuration(minutes * 60)})`
                : current
                  ? `Déplacer au ${labelDay(sel.date)} (${formatDuration(minutes * 60)})`
                  : `Poser la ${milestoneTitle(minutes).toLowerCase()} le ${labelDay(sel.date)}`}
          </button>
          {current && (
            <button
              disabled={busy}
              onClick={async () => {
                const undo = await removeLongRide({ today });
                nav.close();
                toast('Sortie longue retirée', { label: 'Annuler', run: undo });
              }}
              className="w-full text-sm text-danger"
            >
              Retirer la sortie longue
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Ta plus longue sortie avant le Desertus, pour tester le rythme, l’alimentation et le matériel sur une vraie journée. Choisis la durée et le jour ; la semaine se réajuste
          autour.
        </p>

        <section>
          <h3 className="text-sm font-semibold mb-2">Durée</h3>
          <div className="grid grid-cols-4 gap-2">
            {M.choicesMin.map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={`rounded-xl py-2 text-center ${minutes === m ? 'bg-sport' : 'bg-raised'}`}
                aria-pressed={minutes === m}
              >
                <span className="block font-display text-lg font-bold">{formatDuration(m * 60)}</span>
                <span className="block text-[11px] opacity-80">~{kmFor(m)} km</span>
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="w-5 h-5 accent-[var(--c-accent)]" checked={loaded} onChange={(e) => setLoaded(e.target.checked)} />
            Vélo chargé (configuration Desertus)
          </label>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">Mars 2027</h3>
          <div className="grid grid-cols-7 text-center text-[11px] text-muted mb-1">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => (
              <div key={i}>{x}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => (
              <div key={`b${i}`} />
            ))}
            {slots.map((s) => {
              const isCurrent = current?.date === s.date;
              const isSel = selected === s.date;
              const w = weekOf(s.date);
              return (
                <button
                  key={s.date}
                  disabled={s.level === 'no' && !isCurrent}
                  onClick={() => setSelected(s.date)}
                  aria-label={`${labelDay(s.date)} : ${s.level === 'best' ? 'recommandé' : s.level === 'ok' ? 'possible' : 'indisponible'}`}
                  aria-pressed={isSel}
                  className={`relative h-12 rounded-xl grid place-items-center text-sm tabular-nums ${LEVEL[s.level]} ${isCurrent ? 'bg-sport' : ''} ${
                    isSel && !isCurrent ? 'outline-2 outline-offset-1 outline-ink' : ''
                  }`}
                  style={!isCurrent && w ? { background: phaseSoft(w.phase) } : undefined}
                >
                  <span>{+s.date.slice(8)}</span>
                  {isCurrent && <span className="absolute bottom-0.5 text-[9px] font-bold">{formatDuration((current?.durationMin ?? M.defaultMin) * 60)}</span>}
                  {s.level === 'best' && !isCurrent && <span className="absolute top-0.5 right-1 text-[10px] text-accent">★</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted mt-2">
            <span>
              <span className="text-accent">★</span> recommandé (milieu d’un long week-end)
            </span>
            <span>possible</span>
            <span className="opacity-50">grisé : indisponible</span>
          </div>
        </section>

        {sel && (
          <section className={`rounded-2xl p-3 ${sel.level === 'no' ? 'bg-raised' : 'bg-accent-soft'}`}>
            <div className="font-semibold">{cap(labelDay(sel.date))}</div>
            <p className="text-sm">{sel.reason}</p>
            {sel.replaces.length > 0 && sel.level !== 'no' && (
              <p className="text-sm text-muted mt-1">Remplace : {sel.replaces.map((x) => `${x.title} (${formatDuration(x.targetDurationMin * 60)})`).join(', ')}.</p>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}

export { getLongRide };
