import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { countManualFrom, generateProgram } from '../../db/program';
import { addDays, labelShort, labelWeek, startOfWeek } from '../../engine/dates';
import { CONFIG } from '../../engine/config';
import { defaultStartWeek, KIND_LABEL, PHASE_LABEL } from '../../engine/planner';
import { weekToConfirm } from '../../engine/review';
import type { LocalDate } from '../../engine/types';
import { formatHours } from '../../engine/zones';
import { useNav, useToday } from '../hooks';
import { useToast } from './Toast';

/** Lance la génération en demandant quoi faire des séances manuelles déjà prévues. */
export function useGenerate() {
  const toast = useToast();
  const today = useToday();
  const [busy, setBusy] = useState(false);
  const run = async (fromWeek?: LocalDate) => {
    const start = fromWeek ?? defaultStartWeek(today);
    const manual = await countManualFrom(start);
    let removeManual = false;
    if (manual > 0) {
      removeManual = window.confirm(
        `${manual} séance${manual > 1 ? 's' : ''} ajoutée${manual > 1 ? 's' : ''} à la main existe${manual > 1 ? 'nt' : ''} à partir du ${labelShort(start)}.\n\nOK : les supprimer\nAnnuler : les garder à côté du programme`,
      );
    }
    setBusy(true);
    try {
      const r = await generateProgram({ fromWeek: start, today, removeManual });
      toast(`Programme prêt : ${r.weeks} semaines, ${r.sessions} séances`);
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

export function ProgramEmptyCard() {
  const nav = useNav();
  const today = useToday();
  const goal = useLiveQuery(async () => (await db.goals.toArray()).find((g) => g.kind === 'main'), []);
  const gen = useGenerate();
  const start = defaultStartWeek(today);
  return (
    <section className="rounded-2xl border-2 border-accent/60 bg-surface p-4 space-y-3">
      <h2 className="text-lg font-bold">Ton programme vers {goal?.name ?? 'l’objectif'}</h2>
      <p className="text-sm text-muted">
        Je prépare toutes les semaines du {labelShort(start)} jusqu’au {goal ? labelShort(goal.date) : '—'} : base, développement, spécifique, affûtage,
        semaines allégées, congés de Noël et voyage de février, à partir de ton rythme de départ. Tu pourras tout déplacer, et chaque fin de semaine tu confirmes la suivante.
      </p>
      <button disabled={gen.busy} onClick={() => gen.run()} className="w-full h-12 rounded-xl bg-sport font-semibold">
        {gen.busy ? 'Génération…' : 'Générer mon programme'}
      </button>
      <button onClick={() => nav.open({ kind: 'settings', section: 'data' })} className="w-full text-sm text-accent font-medium">
        Nouveau téléphone ? Restaurer ma sauvegarde en ligne
      </button>
    </section>
  );
}

/** Rappel « à l'aube de la semaine » : confirmer la semaine qui vient. */
export function ReminderBanner() {
  const nav = useNav();
  const today = useToday();
  const weeks = useLiveQuery(() => db.weeks.toArray(), []) ?? [];
  const w = weekToConfirm(today, weeks);
  if (!w) return null;
  return (
    <button
      onClick={() => nav.open({ kind: 'review', weekStart: w })}
      className="w-full rounded-2xl bg-surface card-shadow p-3 text-left flex items-center gap-3 border border-accent/30"
    >
      <span className="w-10 h-10 rounded-xl bg-sport grid place-items-center text-lg font-bold shrink-0" aria-hidden="true">
        ✓
      </span>
      <span className="flex-1">
        <span className="block font-semibold">Confirme ta semaine du {labelWeek(w)}</span>
        <span className="block text-sm text-muted">Bilan, rythme réel et propositions chiffrées</span>
      </span>
      <span className="text-accent font-semibold text-sm">Ouvrir</span>
    </button>
  );
}

/** Phase, type de semaine, cible, et accès au bilan. */
export function WeekPlanHeader({ weekStart }: { weekStart: LocalDate }) {
  const nav = useNav();
  const today = useToday();
  const plan = useLiveQuery(() => db.weeks.get(weekStart), [weekStart]);
  if (!plan) return null;
  const canReview = weekStart >= startOfWeek(today) && weekStart <= addDays(startOfWeek(today), 7);
  return (
    <section className="rounded-2xl bg-surface border border-line p-3 space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{PHASE_LABEL[plan.phase]}</span>
        <span className="text-sm text-muted">· {KIND_LABEL[plan.kind]}</span>
        <span className="ml-auto text-sm tabular-nums">cible {formatHours(plan.targetHours)}</span>
      </div>
      {plan.notes.map((n) => (
        <p key={n} className="text-xs text-muted">
          {n}
        </p>
      ))}
      <div className="flex items-center gap-2 pt-1">
        {plan.confirmedAt ? <span className="text-sm text-ok">✓ semaine confirmée</span> : <span className="text-sm text-muted">non confirmée</span>}
        {canReview && (
          <button onClick={() => nav.open({ kind: 'review', weekStart })} className="ml-auto h-9 px-3 rounded-lg bg-raised text-sm font-medium">
            {plan.confirmedAt ? 'Revoir le bilan' : 'Bilan et confirmation'}
          </button>
        )}
      </div>
    </section>
  );
}

/** Programme construit avec une ancienne méthode : proposer de le recalculer (le réalisé est gardé). */
export function ProgramUpgradeCard() {
  const today = useToday();
  const outdated = useLiveQuery(async () => (await db.weeks.where('weekStart').aboveOrEqual(startOfWeek(today)).toArray()).some((w) => (w.version ?? 1) < CONFIG.planVersion), [today]);
  const gen = useGenerate();
  if (!outdated) return null;
  return (
    <section className="rounded-2xl bg-surface card-shadow border border-accent/40 p-3.5 space-y-2">
      <h2 className="font-display font-bold">Nouvelle méthode de planification</h2>
      <p className="text-sm text-muted">
        Plus de vélo : progression vers 8 h d’endurance, home-trainer le soir les jours à la maison, sorties longues jusqu’à près de 5 h, 3 longs week-ends en spécifique,
        course d’abord à la maison. Ton réalisé et tes séances ajoutées à la main sont gardés ; les séances proposées à venir sont remplacées.
      </p>
      <button disabled={gen.busy} onClick={() => gen.run()} className="w-full h-11 rounded-xl bg-sport font-semibold">
        {gen.busy ? 'Calcul…' : 'Recalculer mon programme'}
      </button>
    </section>
  );
}
