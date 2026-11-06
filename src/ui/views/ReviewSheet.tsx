import { useEffect, useState } from 'react';
import { applyActions, confirmWeek, generateProgram, loadReview, setWeekExcluded, type Decision } from '../../db/program';
import { cap, labelDay, labelWeek } from '../../engine/dates';
import { KIND_LABEL, PHASE_LABEL } from '../../engine/planner';
import type { ReviewItem, WeekReview } from '../../engine/review';
import { SPORT_META, sportKey } from '../../engine/sports';
import { isPending } from '../../engine/status';
import { formatDuration, formatHours } from '../../engine/zones';
import { IconStar } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { useNav, useToday } from '../hooks';

function fmtValue(v: number, unit?: string) {
  if (unit === 'h') return formatHours(v);
  return `${Math.round(v * 10) / 10}${unit ? ` ${unit}` : ''}`;
}

/** Chiffre qui justifie la recommandation, mis en avant. */
function Figure({ item }: { item: ReviewItem }) {
  const j = item.justification;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold tabular-nums">{fmtValue(j.value, j.unit)}</span>
      <span className="text-xs text-muted">
        {j.metric} · seuil {fmtValue(j.threshold, j.unit)}
      </span>
    </div>
  );
}

export function ReviewSheet({ weekStart }: { weekStart: string }) {
  const nav = useNav();
  const toast = useToast();
  const today = useToday();
  const [review, setReview] = useState<WeekReview | null>(null);
  const [decided, setDecided] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState(false);

  const reload = () => loadReview(weekStart, today).then(setReview);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, today]);

  if (!review) return null;
  const r = review;
  const pending = r.items.filter((i) => !(i.id in decided));
  const prevAll = r.previous.all;

  const choose = async (item: ReviewItem, index: number | null) => {
    if (index !== null) {
      const choice = item.choices[index];
      const replan = choice.actions.find((a) => a.kind === 'replan');
      if (replan && replan.kind === 'replan') {
        if (!window.confirm('Recalculer le programme à partir de cette semaine avec ton rythme réel ? Les séances générées non faites seront remplacées.')) return;
        setBusy(true);
        await generateProgram({ fromWeek: replan.fromWeek, today });
        setBusy(false);
        toast('Programme recalculé');
      } else {
        const undo = await applyActions(choice.actions);
        toast(`${choice.label} ✓`, { label: 'Annuler', run: async () => (await undo(), setDecided((d) => { const n = { ...d }; delete n[item.id]; return n; })) });
      }
    }
    setDecided((d) => ({ ...d, [item.id]: index }));
    await reload();
  };

  const confirm = async () => {
    const decisions: Decision[] = review.items.map((item) => ({ item, choiceIndex: decided[item.id] ?? null }));
    await confirmWeek(weekStart, decisions);
    nav.close();
    toast(`Semaine du ${labelWeek(weekStart)} confirmée`);
  };

  const target = r.targetSessions.filter((s) => s.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Sheet
      title={`Bilan et semaine du ${labelWeek(weekStart)}`}
      onClose={nav.close}
      full
      footer={
        <button disabled={busy} onClick={confirm} className="w-full h-12 rounded-xl bg-accent text-accent-ink font-semibold">
          Confirmer la semaine{pending.length ? ` (${pending.length} proposition${pending.length > 1 ? 's' : ''} ignorée${pending.length > 1 ? 's' : ''})` : ''}
        </button>
      }
    >
      <div className="space-y-4">
        <section className="rounded-xl bg-raised p-3">
          <h3 className="font-semibold">Semaine écoulée · {labelWeek(r.previousWeek)}</h3>
          <div className="mt-1 text-sm">
            <span className="text-xl font-bold tabular-nums">{formatHours(prevAll.doneH)}</span>
            <span className="text-muted"> faites sur {formatHours(prevAll.plannedH)} prévues</span>
            {r.previous.completionRate !== null && <span className="text-muted"> · réalisation {Math.round(r.previous.completionRate * 100)} %</span>}
          </div>
          {r.previousMissed.length > 0 && (
            <div className="text-sm text-muted mt-1">Non faites : {r.previousMissed.map((s) => s.title).join(', ')}</div>
          )}
        </section>

        <section className="rounded-xl bg-raised p-3 space-y-1">
          <h3 className="font-semibold">Rythme réel (4 semaines)</h3>
          <div className="text-sm">
            <span className="text-xl font-bold tabular-nums">{formatHours(r.rhythm.hours)}</span>
            <span className="text-muted">
              {' '}
              / semaine · plafond {formatHours(r.cap)} (× {String(r.capFactor).replace('.', ',')})
            </span>
          </div>
          <div className="text-xs text-muted">
            {r.rhythm.weeks
              .map((w) => `${labelWeek(w.weekStart)} : ${formatHours(w.hours)}${w.assumed ? ' (départ)' : ''}`)
              .join(' · ')}
          </div>
          {(
            <button className="text-xs text-accent" onClick={async () => (await setWeekExcluded(r.previousWeek, true), reload())}>
              Exclure la semaine écoulée du rythme (semaine exceptionnelle)
            </button>
          )}
        </section>

        <section>
          <h3 className="font-semibold mb-2">
            Propositions {r.items.length === 0 && <span className="font-normal text-muted text-sm">· rien à signaler, le plan tient</span>}
          </h3>
          <div className="space-y-2">
            {r.items.map((item) => {
              const d = decided[item.id];
              const done = item.id in decided;
              return (
                <div key={item.id} className={`rounded-xl border border-line p-3 space-y-2 ${done ? 'opacity-60' : ''}`}>
                  <Figure item={item} />
                  <p className="text-sm">{item.text}</p>
                  {done ? (
                    <div className="text-sm text-muted">{d === null ? 'Ignorée' : `Acceptée : ${item.choices[d!]?.label}`}</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {item.choices.map((c, i) => (
                        <button key={c.label} disabled={busy} onClick={() => choose(item, i)} className="h-10 px-3 rounded-lg bg-accent text-accent-ink text-sm font-medium">
                          {c.label}
                        </button>
                      ))}
                      <button onClick={() => choose(item, null)} className="h-10 px-3 rounded-lg bg-raised text-sm">
                        Ignorer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">
            Semaine prévue · {formatHours(r.plannedHours)}
            {r.plan && (
              <span className="font-normal text-sm text-muted">
                {' '}
                · {PHASE_LABEL[r.plan.phase]}, {KIND_LABEL[r.plan.kind]}
              </span>
            )}
          </h3>
          {r.plan?.notes.map((n) => (
            <p key={n} className="text-xs text-muted mt-1">
              {n}
            </p>
          ))}
          <ul className="mt-2 divide-y divide-line rounded-xl bg-surface border border-line">
            {target.map((s) => {
              const m = SPORT_META[sportKey(s.sport, s.environment)];
              return (
                <li key={s.id}>
                  <button className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm" onClick={() => nav.open({ kind: 'session', id: s.id })}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="w-20 shrink-0 text-muted">{cap(labelDay(s.date))}</span>
                    <span className="flex-1 truncate">{s.title}</span>
                    {s.priority === 'key' && (
                      <span className="text-accent">
                        <IconStar />
                      </span>
                    )}
                    <span className="tabular-nums text-muted">{formatDuration(s.targetDurationMin * 60)}</span>
                    {!isPending(s) && <span className="text-ok">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Sheet>
  );
}
