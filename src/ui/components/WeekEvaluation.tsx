import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { applyReplanWeek, clearParisWeek, generateProgram, loadWeekEvaluation, previewReplanWeek, raisePeakAndReplan, setParisDays, type WeekEvaluation } from '../../db/program';
import { addDays, cap, isoWeekday, labelDay, labelWeek, labelWeekday, startOfWeek, weekDays } from '../../engine/dates';
import { KIND_LABEL, PHASE_LABEL, parisDaysOf, toggleParisDay } from '../../engine/planner';
import { SPORT_META, sportKey } from '../../engine/sports';
import { isPending } from '../../engine/status';
import type { LocalDate, PlannedSession } from '../../engine/types';
import { formatDuration, formatHours } from '../../engine/zones';
import { useNav, useSessionActions, useSettings, useToday } from '../hooks';
import { IconAlert, IconRefresh } from './Icons';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { SportGlyph } from './SportGlyph';

export function useWeekEvaluation(weekStart: LocalDate): WeekEvaluation | undefined {
  const today = useToday();
  return useLiveQuery(() => loadWeekEvaluation(weekStart, today), [weekStart, today]);
}

/** Bande des 7 jours : un point par jour pour indiquer la présence à Paris (2 jours par défaut). */
export function WeekStrip({ weekStart, sessions, onDay }: { weekStart: LocalDate; sessions: PlannedSession[]; onDay: (d: LocalDate) => void }) {
  const nav = useNav();
  const settings = useSettings();
  const today = useToday();
  const toast = useToast();
  const paris = parisDaysOf(weekStart, settings.availability);
  const parisSet = new Set(paris);

  const tap = async (d: LocalDate) => {
    const next = toggleParisDay(paris, d, weekStart);
    const undo = await setParisDays(weekStart, next);
    toast(next.length ? `Paris : ${next.map((x) => labelWeekday(x)).join(', ')}` : 'Pas de Paris cette semaine', { label: 'Annuler', run: undo });
  };

  return (
    <section className="rounded-2xl bg-surface card-shadow px-2 pt-2 pb-1.5">
      <div className="grid grid-cols-7">
        {weekDays(weekStart).map((d) => {
          const day = sessions.filter((s) => s.date === d && s.status !== 'cancelled');
          const isToday = d === today;
          const inParis = parisSet.has(d);
          return (
            <div key={d} className="flex flex-col items-center">
              <button onClick={() => onDay(d)} className="flex flex-col items-center w-full py-0.5 rounded-xl active:bg-raised" aria-label={`Aller au ${labelDay(d)}`}>
                <span className="text-[11px] text-muted uppercase">{labelWeekday(d).slice(0, 3)}</span>
                <span className={`font-display text-lg leading-tight tabular-nums ${isToday ? 'text-accent font-bold' : d < today ? 'text-muted' : 'font-medium'}`}>{+d.slice(8)}</span>
                <span className="flex gap-0.5 h-1.5 mt-0.5">
                  {day.slice(0, 3).map((s) => (
                    <span key={s.id} className="w-1.5 h-1.5 rounded-full" style={{ background: SPORT_META[sportKey(s.sport, s.environment)].color, opacity: s.confirmed || !isPending(s) ? 1 : 0.45 }} />
                  ))}
                </span>
              </button>
              <button
                onClick={() => tap(d)}
                className="mt-1 w-10 h-8 grid place-items-center"
                aria-pressed={inParis}
                aria-label={`${inParis ? 'Retirer' : 'Indiquer'} Paris le ${labelDay(d)}`}
              >
                <span
                  className={`grid place-items-center rounded-full text-[9px] font-bold transition-all ${
                    inParis ? 'w-5 h-5 bg-ink text-bg' : 'w-2.5 h-2.5 border-2 border-line'
                  }`}
                >
                  {inParis ? 'P' : ''}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={() => nav.open({ kind: 'paris', weekStart })} className="w-full text-[11px] text-muted text-center pb-0.5">
        {paris.length ? `À Paris : ${paris.map((x) => labelWeekday(x)).join(', ')}` : 'Touche un point pour tes jours à Paris'} ·{' '}
        <span className="text-accent font-medium">modifier</span>
      </button>
    </section>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  start: { label: 'Début', cls: 'bg-raised text-muted' },
  behind: { label: 'En retard', cls: 'bg-danger/15 text-danger' },
  'on-track': { label: 'Dans le plan', cls: 'bg-ok/15 text-ok' },
  ahead: { label: 'En avance', cls: 'bg-accent-soft text-accent' },
};

/** Évaluation en haut de la semaine : programme suivi, ce qui ne colle plus, et les ajustements proposés. */
export function WeekEvaluationCard({ weekStart, sessions, evaluation }: { weekStart: LocalDate; sessions: PlannedSession[]; evaluation?: WeekEvaluation }) {
  const nav = useNav();
  const act = useSessionActions();
  const today = useToday();
  const toast = useToast();
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const plan = evaluation?.plan;
  if (!plan) return null;
  const current = weekStart >= startOfWeek(today);
  const prog = evaluation.progress;
  const st = STATUS[prog.status];
  const reco = sessions.filter((s) => isPending(s) && !s.confirmed);
  const football = sessions.filter((s) => s.sport === 'football' && s.status !== 'cancelled');

  const replanProgram = async (raise?: number) => {
    const msg = raise
      ? `Relever le pic à ${formatHours(raise)} et recalculer le programme à partir de cette semaine ?`
      : 'Recalculer le programme à partir de cette semaine avec ton rythme réel ? Les séances générées non faites (recommandées ou confirmées) seront remplacées.';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      if (raise) await raisePeakAndReplan(raise, weekStart, today);
      else await generateProgram({ fromWeek: weekStart, today });
      toast('Programme recalculé');
    } finally {
      setBusy(false);
    }
  };

  const peak = settings.volume.peakWeeklyHours;
  const raiseTo = Math.floor(prog.allowedH * 4) / 4;

  return (
    <section className="rounded-2xl bg-surface card-shadow p-3.5 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="font-display font-semibold text-lg leading-tight">{PHASE_LABEL[plan.phase]}</div>
          <div className="text-xs text-muted">{cap(KIND_LABEL[plan.kind])}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-semibold tabular-nums leading-tight">{formatHours(plan.targetHours)}</div>
          <div className="text-xs text-muted">endurance{football.length ? ` + foot ${formatHours((football.reduce((t, s) => t + s.targetDurationMin, 0)) / 60)}` : ''}</div>
        </div>
      </div>
      {plan.notes.map((n) => (
        <p key={n} className="text-xs text-muted -mt-1">
          {n}
        </p>
      ))}

      {current && (
        <div className="rounded-xl bg-raised/70 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            {prog.status !== 'start' && <span className="font-display font-semibold tabular-nums">{Math.round(prog.ratio * 100)} %</span>}
            <span className="text-xs text-muted">du prévu réalisé</span>
          </div>
          <p className="text-[13px] leading-snug">{prog.text}</p>
          {(prog.status === 'behind' || prog.status === 'ahead') && (
            <button
              disabled={busy}
              onClick={() => replanProgram(prog.status === 'ahead' && raiseTo > peak ? raiseTo : undefined)}
              className="h-9 px-3 rounded-lg bg-ink text-bg text-sm font-medium flex items-center gap-1.5"
            >
              <IconRefresh className="w-4 h-4" />
              {prog.status === 'behind'
                ? `Recalculer le programme (${formatHours(prog.allowedH)} cette semaine)`
                : raiseTo > peak
                  ? `Relever le pic à ${formatHours(raiseTo)} et recalculer`
                  : 'Recalculer le programme'}
            </button>
          )}
        </div>
      )}

      {current && evaluation.issues.length > 0 && (
        <div className="rounded-xl border border-warn/50 bg-warn/10 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-warn">
            <IconAlert className="w-4 h-4" /> {evaluation.issues.length} point{evaluation.issues.length > 1 ? 's' : ''} ne colle{evaluation.issues.length > 1 ? 'nt' : ''} plus
          </div>
          <ul className="text-[13px] space-y-0.5">
            {evaluation.issues.slice(0, 4).map((i, k) => (
              <li key={k}>
                <span className="text-muted">{cap(labelDay(i.date))} :</span> {i.text}
              </li>
            ))}
          </ul>
          <button onClick={() => nav.open({ kind: 'replan', weekStart })} className="h-9 px-3 rounded-lg bg-accent text-accent-ink text-sm font-medium flex items-center gap-1.5">
            <IconRefresh className="w-4 h-4" /> Replanifier la semaine
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        {plan.confirmedAt && reco.length === 0 ? (
          <span className="text-ok font-medium">✓ Semaine confirmée</span>
        ) : reco.length ? (
          <button onClick={() => act.setConfirmed(reco.map((s) => s.id), true)} className="h-9 px-3 rounded-lg border border-dashed border-muted/60 text-sm">
            {reco.length} recommandée{reco.length > 1 ? 's' : ''} · <span className="text-accent font-medium">Tout confirmer</span>
          </button>
        ) : (
          <span className="text-muted">Toutes les séances sont confirmées</span>
        )}
        {current && weekStart <= addDays(startOfWeek(today), 7) && (
          <button onClick={() => nav.open({ kind: 'review', weekStart })} className="ml-auto text-sm text-accent font-medium">
            Bilan
          </button>
        )}
      </div>
    </section>
  );
}

/** Aperçu de la replanification de la semaine avant de l'appliquer. */
export function ReplanSheet({ weekStart }: { weekStart: LocalDate }) {
  const nav = useNav();
  const today = useToday();
  const toast = useToast();
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof previewReplanWeek>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    previewReplanWeek(weekStart, today).then(setPlan, (e) => setError((e as Error).message));
  }, [weekStart, today]);

  const byDay = weekDays(weekStart).map((d) => ({
    d,
    removed: plan?.remove.filter((s) => s.date === d) ?? [],
    added: plan?.add.filter((s) => s.date === d) ?? [],
  }));
  const line = (s: PlannedSession, removed: boolean) => {
    return (
      <li key={s.id} className={`flex items-center gap-2 text-sm ${removed ? 'text-muted line-through' : ''}`}>
        <SportGlyph k={sportKey(s.sport, s.environment)} size={20} badge={false} />
        <span className="flex-1 truncate">
          {s.title}
          {removed && s.confirmed ? ' (confirmée)' : ''}
        </span>
        <span className="tabular-nums">{formatDuration(s.targetDurationMin * 60)}</span>
      </li>
    );
  };

  return (
    <Sheet
      title="Replanifier la semaine"
      onClose={nav.close}
      full
      footer={
        <button
          disabled={!plan}
          onClick={async () => {
            if (!plan) return;
            const undo = await applyReplanWeek(plan);
            nav.close();
            toast('Semaine replanifiée', { label: 'Annuler', run: undo });
          }}
          className="w-full h-12 rounded-xl bg-accent text-accent-ink font-semibold"
        >
          Appliquer
        </button>
      }
    >
      {error && <p className="text-danger text-sm">{error}</p>}
      <p className="text-sm text-muted mb-3">
        Avec tes jours à Paris et le foot du lundi et du jeudi. Les séances faites et celles ajoutées à la main sont gardées ; les nouvelles arrivent en « recommandées ».
      </p>
      <div className="space-y-3">
        {byDay
          .filter((x) => x.removed.length || x.added.length)
          .map((x) => (
            <section key={x.d}>
              <h3 className="text-sm font-semibold mb-1">{cap(labelDay(x.d))}</h3>
              <ul className="space-y-1 rounded-xl bg-raised p-2.5">
                {x.removed.map((s) => line(s, true))}
                {x.added.map((s) => line(s, false))}
              </ul>
            </section>
          ))}
        {plan && byDay.every((x) => !x.removed.length && !x.added.length) && <p className="text-sm">Rien à changer.</p>}
      </div>
    </Sheet>
  );
}

/** Présence à Paris pour une semaine : jours à cocher, un seul jour, aucun, ou la semaine type. */
export function ParisSheet({ weekStart }: { weekStart: LocalDate }) {
  const nav = useNav();
  const settings = useSettings();
  const toast = useToast();
  const evaluation = useWeekEvaluation(weekStart);
  const a = settings.availability;
  const paris = parisDaysOf(weekStart, a);
  const set = new Set(paris);
  const typical = weekDays(weekStart).filter((d) => a.template[isoWeekday(d)]?.paris);
  const save = async (days: LocalDate[] | undefined, label: string) => {
    const undo = await setParisDays(weekStart, days ?? []);
    if (days === undefined) await clearParisWeek(weekStart);
    toast(label, { label: 'Annuler', run: undo });
  };
  const issues = evaluation?.issues.length ?? 0;

  return (
    <Sheet title="Jours à Paris" onClose={nav.close}>
      <div className="space-y-4">
        <p className="text-sm text-muted -mt-1">
          Semaine du {labelWeek(weekStart)}. À Paris : course uniquement ; pas de foot ces jours-là.
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays(weekStart).map((d) => {
            const on = set.has(d);
            return (
              <button
                key={d}
                onClick={() => save(on ? paris.filter((x) => x !== d) : [...paris, d].sort(), on ? `${cap(labelWeekday(d))} retiré` : `${cap(labelWeekday(d))} à Paris`)}
                className={`h-16 rounded-2xl flex flex-col items-center justify-center ${on ? 'bg-ink text-bg' : 'bg-raised'}`}
                aria-pressed={on}
                aria-label={`${labelDay(d)} à Paris`}
              >
                <span className="text-[11px] uppercase opacity-70">{labelWeekday(d).slice(0, 3)}</span>
                <span className="font-display text-lg font-semibold">{+d.slice(8)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save([], 'Pas de Paris cette semaine')} className="h-10 px-3 rounded-xl bg-raised text-sm">
            Aucun jour
          </button>
          <button onClick={() => save(undefined, 'Semaine type rétablie')} className="h-10 px-3 rounded-xl bg-raised text-sm">
            Semaine type ({typical.map((d) => labelWeekday(d)).join(', ') || 'aucun'})
          </button>
        </div>
        <p className="text-xs text-muted">Astuce : sur la vue Semaine, un tap sur un point pose 2 jours si la semaine n’a pas encore de Paris, puis ajoute ou retire un jour à chaque tap.</p>
        {issues > 0 && (
          <button onClick={() => nav.replace({ kind: 'replan', weekStart })} className="w-full h-12 rounded-xl bg-accent text-accent-ink font-semibold flex items-center justify-center gap-2">
            <IconRefresh className="w-4 h-4" /> Replanifier la semaine ({issues} point{issues > 1 ? 's' : ''} à revoir)
          </button>
        )}
      </div>
    </Sheet>
  );
}
