import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import * as A from '../../db/actions';
import { db } from '../../db/db';
import { isLocalDate, labelShort } from '../../engine/dates';
import { newId } from '../../engine/library';
import { defaultStartWeek, KIND_LABEL, PHASE_LABEL } from '../../engine/planner';
import type { AppSettings, Availability, AvailabilityException, ExceptionKind, Phase } from '../../engine/types';
import { formatHours } from '../../engine/zones';
import { Field, inputCls, NumberInput } from '../components/Form';
import { IconTrash } from '../components/Icons';
import { useGenerate } from '../components/ProgramCards';
import { useSettings, useToday } from '../hooks';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const EXC_LABEL: Record<ExceptionKind, string> = { leave: 'Congé (journée libre)', runOnly: 'Course uniquement', unavailable: 'Indisponible' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface border border-line p-3 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ProgramSection() {
  const settings = useSettings();
  const today = useToday();
  const weeks = useLiveQuery(() => db.weeks.orderBy('weekStart').toArray(), []) ?? [];
  const gen = useGenerate();
  const start = defaultStartWeek(today);

  // Phases regroupées en périodes consécutives.
  const periods: { phase: Phase; from: string; to: string; n: number }[] = [];
  for (const w of weeks) {
    const last = periods.at(-1);
    if (last && last.phase === w.phase) {
      last.to = w.weekStart;
      last.n++;
    } else periods.push({ phase: w.phase, from: w.weekStart, to: w.weekStart, n: 1 });
  }
  const peakWeek = weeks.reduce((m, w) => (w.kind !== 'block' && w.targetHours > m ? w.targetHours : m), 0);
  const longest = weeks.reduce((m, w) => Math.max(m, w.longRideMin), 0);
  const setVolume = (v: Partial<AppSettings['volume']>) => A.saveSettings({ ...settings, volume: { ...settings.volume, ...v } });

  return (
    <Section title="Programme">
      {weeks.length > 0 && (
        <>
          <ul className="text-sm divide-y divide-line rounded-xl bg-raised">
            {periods.map((p) => (
              <li key={p.from} className="px-3 py-2 flex justify-between">
                <span className="font-medium">{PHASE_LABEL[p.phase]}</span>
                <span className="text-muted">
                  {labelShort(p.from)} → {labelShort(p.to)} · {p.n} sem.
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Semaine la plus chargée {formatHours(peakWeek)} d’endurance (+ foot), plus longue sortie prévue {formatHours(longest / 60)}.{' '}
            {weeks.filter((w) => w.kind === 'light').length} semaines allégées, {weeks.filter((w) => w.kind === 'block').length} semaines bloc,{' '}
            {weeks.filter((w) => w.kind === 'travel').length} en voyage ({KIND_LABEL.travel}).
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Endurance au départ (h/sem., hors foot)">
          <NumberInput value={settings.volume.startWeeklyHours} step={0.25} onChange={(v) => v && setVolume({ startWeeklyHours: v })} />
        </Field>
        <Field label="Pic d’endurance (h/sem.)">
          <NumberInput value={settings.volume.peakWeeklyHours} step={0.25} onChange={(v) => v && setVolume({ peakWeeklyHours: v })} />
        </Field>
      </div>
      <button disabled={gen.busy} onClick={() => gen.run(start)} className="w-full h-11 rounded-xl bg-sport font-medium">
        {gen.busy ? 'Calcul…' : weeks.length ? `Recalculer à partir du ${labelShort(start)}` : 'Générer mon programme'}
      </button>
      <p className="text-xs text-muted">
        Le recalcul part de ton rythme réel. Le réalisé et les semaines passées sont conservés ; les séances générées non faites sont remplacées.
      </p>
    </Section>
  );
}

export function AvailabilitySection() {
  const settings = useSettings();
  const a = settings.availability;
  const save = (p: Partial<Availability>) => A.saveSettings({ ...settings, availability: { ...a, ...p } });
  const setDay = (wd: number, p: Partial<Availability['template'][number]>) => save({ template: { ...a.template, [wd]: { ...a.template[wd], ...p } } });
  const [draft, setDraft] = useState<AvailabilityException>({ id: '', start: '', end: '', kind: 'leave', label: '' });

  return (
    <Section title="Disponibilités">
      <p className="text-xs text-muted">
        Minutes disponibles le matin, et home-trainer le soir (jours à la maison sans foot). « Paris » = semaine type ; pour une semaine précise, touche les points en haut de la vue
        Semaine.
      </p>
      <div className="divide-y divide-line rounded-xl bg-raised">
        {DAYS.map((name, i) => {
          const wd = i + 1;
          const t = a.template[wd] ?? { minutes: 0, paris: false };
          return (
            <div key={wd} className="flex items-center gap-2 px-3 py-1.5">
              <span className="w-24 text-sm">{name}</span>
              <input
                type="number"
                inputMode="numeric"
                className="w-20 h-9 rounded-md bg-surface text-right px-2"
                value={t.minutes}
                onChange={(e) => setDay(wd, { minutes: Number(e.target.value) || 0 })}
                aria-label={`Minutes disponibles ${name}`}
              />
              <span className="text-xs text-muted">min</span>
              {wd <= 5 && (
                <>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-16 h-9 rounded-md bg-surface text-right px-2"
                    value={t.evening ?? 0}
                    onChange={(e) => setDay(wd, { evening: Number(e.target.value) || 0 })}
                    aria-label={`Home-trainer le soir ${name} (minutes)`}
                  />
                  <span className="text-xs text-muted">soir</span>
                </>
              )}
              {wd <= 5 && (
                <label className="ml-auto flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={t.paris} onChange={(e) => setDay(wd, { paris: e.target.checked })} className="w-5 h-5 accent-[var(--c-accent)]" />
                  Paris
                </label>
              )}
            </div>
          );
        })}
      </div>
      <Field label="Jours de foot (obligatoires sauf à Paris)" group>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => {
            const wd = i + 1;
            const on = a.footballDays.includes(wd);
            return (
              <button
                key={d}
                type="button"
                onClick={() => save({ footballDays: on ? a.footballDays.filter((x) => x !== wd) : [...a.footballDays, wd].sort() })}
                className={`h-10 rounded-lg text-sm ${on ? 'bg-ink text-bg font-semibold' : 'bg-raised text-muted'}`}
                aria-pressed={on}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Durée foot (min)">
          <NumberInput value={a.footballMin} onChange={(v) => v && save({ footballMin: v })} />
        </Field>
        <Field label="Début le matin">
          <input type="time" className={inputCls} value={a.weekdayMorningStart} onChange={(e) => e.target.value && save({ weekdayMorningStart: e.target.value })} />
        </Field>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">Congés, voyages, indisponibilités</div>
        <ul className="divide-y divide-line rounded-xl bg-raised">
          {a.exceptions.length === 0 && <li className="px-3 py-2 text-sm text-muted">Aucune.</li>}
          {[...a.exceptions]
            .sort((x, y) => x.start.localeCompare(y.start))
            .map((e) => (
              <li key={e.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span className="flex-1">
                  <span className="block font-medium">{e.label || EXC_LABEL[e.kind]}</span>
                  <span className="block text-xs text-muted">
                    {labelShort(e.start)} → {labelShort(e.end)} · {EXC_LABEL[e.kind]}
                  </span>
                </span>
                <button
                  className="w-9 h-9 grid place-items-center rounded-lg text-danger"
                  aria-label={`Supprimer ${e.label}`}
                  onClick={() => save({ exceptions: a.exceptions.filter((x) => x.id !== e.id) })}
                >
                  <IconTrash />
                </button>
              </li>
            ))}
        </ul>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Libellé" className="col-span-2">
            <input className={inputCls} value={draft.label} placeholder="ex. Pont de l’Ascension" onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Du">
            <input type="date" className={inputCls} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value, end: draft.end || e.target.value })} />
          </Field>
          <Field label="Au (inclus)">
            <input type="date" className={inputCls} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </Field>
          <Field label="Type" className="col-span-2">
            <select className={inputCls} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ExceptionKind })}>
              {(Object.keys(EXC_LABEL) as ExceptionKind[]).map((k) => (
                <option key={k} value={k}>
                  {EXC_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="col-span-2 h-11 rounded-xl bg-raised font-medium disabled:opacity-50"
            disabled={!isLocalDate(draft.start) || !isLocalDate(draft.end) || draft.end < draft.start}
            onClick={() => {
              save({ exceptions: [...a.exceptions, { ...draft, id: newId(), label: draft.label || EXC_LABEL[draft.kind] }] });
              setDraft({ id: '', start: '', end: '', kind: 'leave', label: '' });
            }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </Section>
  );
}
