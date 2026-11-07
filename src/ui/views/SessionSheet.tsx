import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import * as A from '../../db/actions';
import { switchVariant } from '../../db/program';
import { db } from '../../db/db';
import { activityFromSession, blankActivity } from '../../engine/activity';
import { cap, isLocalDate, labelDay, labelShort } from '../../engine/dates';
import { blankSession, newId } from '../../engine/library';
import { fromSportKey, SPORT_META, sportKey } from '../../engine/sports';
import { displayStatus, isPending, postpone } from '../../engine/status';
import type { Activity, PlannedSession, SessionTemplate } from '../../engine/types';
import { formatDuration } from '../../engine/zones';
import { ContentForm, ContentView } from '../components/ContentForm';
import { DurationInput, Field, inputCls, NumberInput, RpeSelect, SportPicker } from '../components/Form';
import { IconMore } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { useNav, useSessionActions, useSettings } from '../hooks';
import { SportGlyph } from '../components/SportGlyph';

const btn = 'h-11 rounded-xl px-4 font-medium';
const primary = `${btn} bg-accent text-accent-ink flex-1`;
const secondary = `${btn} bg-raised`;

/** Applique un changement de date fait dans le formulaire avec la logique de report. */
function withDateChange(before: PlannedSession, after: PlannedSession, today: string): PlannedSession {
  if (before.date === after.date || !isPending(before)) return after;
  try {
    const moved = postpone(before, after.date, today);
    return { ...after, status: moved.status, originalDate: moved.originalDate };
  } catch {
    return after; // date passée : simple correction de saisie
  }
}

export function SessionSheet({ id }: { id: string }) {
  const nav = useNav();
  const act = useSessionActions();
  const toast = useToast();
  const settings = useSettings();
  const session = useLiveQuery(() => db.sessions.get(id), [id]);
  const activity = useLiveQuery(() => db.activities.where('plannedSessionId').equals(id).first(), [id]);
  const [draft, setDraft] = useState<PlannedSession | null>(null);

  if (!session) return null;
  const meta = SPORT_META[sportKey(session.sport, session.environment)];
  const pending = isPending(session);

  if (draft) {
    return (
      <Sheet
        title="Modifier la séance"
        onClose={() => setDraft(null)}
        full
        footer={
          <div className="flex gap-2">
            <button className={secondary} onClick={() => setDraft(null)}>
              Annuler
            </button>
            <button
              className={primary}
              onClick={async () => {
                await A.saveSession(withDateChange(session, draft, act.today));
                setDraft(null);
                toast('Séance enregistrée');
              }}
            >
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Date">
            <input
              type="date"
              className={inputCls}
              value={draft.date}
              onChange={(e) => isLocalDate(e.target.value) && setDraft({ ...draft, date: e.target.value })}
            />
          </Field>
          <ContentForm value={draft} onChange={setDraft} settings={settings} />
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={
        <span>
          <SportGlyph k={sportKey(session.sport, session.environment)} size={30} className="mr-2 align-middle" />
          {session.title}
        </span>
      }
      onClose={nav.close}
      full
      footer={
        <div className="flex gap-2">
          {pending && (
            <>
              <button className={primary} onClick={() => (nav.close(), act.done(id))}>
                Fait comme prévu
              </button>
              <button className={secondary} aria-label="Toutes les actions" onClick={() => nav.open({ kind: 'actions', id })}>
                <IconMore />
              </button>
            </>
          )}
          {session.status === 'cancelled' && (
            <button className={primary} onClick={() => act.restore(id)}>
              Rétablir
            </button>
          )}
          {session.status === 'done' && (
            <button className={primary} onClick={() => nav.open({ kind: 'activity', id: activity?.id, sessionId: id })}>
              Modifier le réalisé
            </button>
          )}
          <button className={secondary} onClick={() => setDraft(structuredClone(session))}>
            Modifier
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm">
          <span className="font-medium">{cap(labelDay(session.date))}</span>
          <span className="text-muted"> · {meta.label} · {displayStatus(session, act.today)}</span>
          {session.originalDate && <span className="text-warn"> · prévue d’abord le {labelShort(session.originalDate)}</span>}
        </div>
        {pending && (
          <button
            onClick={() => act.setConfirmed([id], !session.confirmed)}
            className={`h-9 px-3 rounded-full text-sm flex items-center gap-2 ${
              session.confirmed ? 'bg-ok/15 text-ok font-medium' : 'border border-dashed border-muted/60 text-muted'
            }`}
          >
            {session.confirmed ? '✓ Confirmée · repasser en recommandée' : <>Recommandée par le programme · <span className="text-accent font-medium">Confirmer</span></>}
          </button>
        )}

        {session.alternative && pending && (
          <button
            className="w-full rounded-xl border border-dashed border-accent text-left p-3 flex items-center gap-3"
            onClick={async () => {
              const undo = await switchVariant(id);
              toast(`Basculée : ${session.alternative!.title}`, { label: 'Annuler', run: undo });
            }}
          >
            <span className="text-xl" aria-hidden="true">
              <SportGlyph k={sportKey(session.alternative.sport, session.alternative.environment)} size={32} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">Basculer sur la variante</span>
              <span className="block text-xs text-muted">
                {session.alternative.title} · {formatDuration(session.alternative.targetDurationMin * 60)}
                {session.sport === 'run' ? ' (mauvais temps)' : session.environment === 'outdoor' ? ' (météo, nuit)' : ''}
              </span>
            </span>
          </button>
        )}

        <ContentView c={session} settings={settings} />

        <section className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Réalisé</h3>
            <button className="text-sm text-accent" onClick={() => nav.open({ kind: 'activity', id: activity?.id, sessionId: id })}>
              {activity ? 'Modifier' : 'Saisir'}
            </button>
          </div>
          {activity ? <ActivitySummary a={activity} /> : <p className="text-sm text-muted mt-1">Rien de saisi.</p>}
        </section>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm pt-1">
          <button
            className="text-accent"
            onClick={async () => {
              const t = await A.saveAsTemplate(session);
              toast(`« ${t.title} » ajoutée à la bibliothèque`);
            }}
          >
            Enregistrer comme séance type
          </button>
          <button className="text-danger" onClick={() => (nav.close(), act.remove(id))}>
            Supprimer
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function ActivitySummary({ a }: { a: Activity }) {
  const parts = [
    formatDuration(a.durationSec),
    a.distanceM ? `${(a.distanceM / 1000).toFixed(1)} km` : '',
    a.elevationM ? `${a.elevationM} m D+` : '',
    a.avgHr ? `FC ${a.avgHr}` : '',
    a.avgPower ? `${a.avgPower} W` : '',
    a.rpe ? `RPE ${a.rpe}` : '',
  ].filter(Boolean);
  return (
    <div className="mt-1 text-sm">
      <div>{parts.join(' · ')}</div>
      {a.notes && <div className="text-muted mt-1">{a.notes}</div>}
    </div>
  );
}

export function NewSessionSheet({ date }: { date: string }) {
  const nav = useNav();
  const settings = useSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<PlannedSession>(() => blankSession(date));
  return (
    <Sheet
      title="Nouvelle séance"
      onClose={nav.close}
      full
      footer={
        <button
          className={`${primary} w-full`}
          onClick={async () => {
            await A.saveSession(draft);
            nav.close();
            toast(`Ajoutée le ${labelDay(draft.date)}`);
          }}
        >
          Enregistrer
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="Date">
          <input type="date" className={inputCls} value={draft.date} onChange={(e) => isLocalDate(e.target.value) && setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <ContentForm value={draft} onChange={setDraft} settings={settings} />
      </div>
    </Sheet>
  );
}

export function TemplateSheet({ id }: { id?: string }) {
  const nav = useNav();
  const settings = useSettings();
  const toast = useToast();
  const existing = useLiveQuery(() => (id ? db.templates.get(id) : undefined), [id]);
  const [draft, setDraft] = useState<SessionTemplate | null>(null);

  useEffect(() => {
    if (!id) setDraft({ ...blankSession('2026-01-01'), id: newId(), builtin: false, title: 'Nouvelle séance type' } as SessionTemplate);
    else if (existing && !draft) setDraft(structuredClone(existing));
  }, [id, existing, draft]);

  if (!draft) return null;
  const clean = (t: SessionTemplate): SessionTemplate => {
    const { title, sport, type, environment, targetDurationMin, targetDistanceKm, targetElevationM, rpe, blocks, priority, notes } = t;
    return { id: t.id, builtin: t.builtin, lastUsedAt: t.lastUsedAt, title, sport, type, environment, targetDurationMin, targetDistanceKm, targetElevationM, rpe, blocks, priority, notes };
  };

  return (
    <Sheet
      title={id ? 'Modifier la séance type' : 'Nouvelle séance type'}
      onClose={nav.close}
      full
      footer={
        <div className="flex gap-2">
          {id && (
            <button
              className={`${secondary} text-danger`}
              onClick={async () => {
                const undo = await A.deleteTemplate(id);
                nav.close();
                toast('Séance type supprimée', { label: 'Annuler', run: undo });
              }}
            >
              Supprimer
            </button>
          )}
          <button
            className={primary}
            onClick={async () => {
              await A.saveTemplate(clean(draft));
              nav.close();
              toast('Séance type enregistrée');
            }}
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <p className="text-xs text-muted mb-3">Modifier un modèle ne change pas les séances déjà planifiées.</p>
      <ContentForm value={draft} onChange={setDraft} settings={settings} />
    </Sheet>
  );
}

/** Saisie manuelle du réalisé (lié à une séance ou libre). */
export function ActivitySheet({ id, sessionId, date }: { id?: string; sessionId?: string; date?: string }) {
  const nav = useNav();
  const act = useSessionActions();
  const toast = useToast();
  const existing = useLiveQuery(() => (id ? db.activities.get(id) : undefined), [id]);
  const session = useLiveQuery(() => (sessionId ? db.sessions.get(sessionId) : undefined), [sessionId]);
  const [draft, setDraft] = useState<Activity | null>(null);

  useEffect(() => {
    if (draft) return;
    if (id) {
      if (existing) setDraft(structuredClone(existing));
    } else if (sessionId) {
      if (session) setDraft(activityFromSession(session));
    } else {
      setDraft(blankActivity(date ?? act.today));
    }
  }, [id, sessionId, existing, session, draft, date, act.today]);

  if (!draft) return null;
  const set = (p: Partial<Activity>) => setDraft({ ...draft, ...p });
  const key = sportKey(draft.sport, draft.environment);
  const linkedTitle = session?.title;

  return (
    <Sheet
      title={linkedTitle ? `Réalisé · ${linkedTitle}` : 'Activité réalisée'}
      onClose={nav.close}
      full
      footer={
        <div className="flex gap-2">
          {id && (
            <button
              className={`${secondary} text-danger`}
              onClick={() => {
                nav.close();
                act.removeActivity(id);
              }}
            >
              Supprimer
            </button>
          )}
          <button
            className={primary}
            onClick={async () => {
              await A.saveActivity(draft);
              nav.close();
              toast(draft.plannedSessionId ? 'Réalisé enregistré, séance faite ✓' : 'Activité enregistrée');
            }}
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {!draft.plannedSessionId && (
          <Field label="Sport" group>
            <SportPicker value={key} onChange={(k) => set(fromSportKey(k))} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <input type="date" className={inputCls} value={draft.date} onChange={(e) => isLocalDate(e.target.value) && set({ date: e.target.value })} />
          </Field>
          <Field label="Durée">
            <DurationInput seconds={draft.durationSec} onChange={(s) => set({ durationSec: s ?? 0 })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={draft.sport === 'swim' ? 'Distance (m)' : 'Distance (km)'}>
            {draft.sport === 'swim' ? (
              <NumberInput value={draft.distanceM} step={25} onChange={(distanceM) => set({ distanceM })} />
            ) : (
              <NumberInput
                value={draft.distanceM !== undefined ? Math.round(draft.distanceM / 100) / 10 : undefined}
                step={0.1}
                onChange={(km) => set({ distanceM: km === undefined ? undefined : Math.round(km * 1000) })}
              />
            )}
          </Field>
          <Field label="D+ (m)">
            <NumberInput value={draft.elevationM} onChange={(elevationM) => set({ elevationM })} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="FC moy.">
            <NumberInput value={draft.avgHr} onChange={(avgHr) => set({ avgHr })} />
          </Field>
          <Field label="Puiss. moy. (W)">
            <NumberInput value={draft.avgPower} onChange={(avgPower) => set({ avgPower })} />
          </Field>
          <Field label="RPE">
            <RpeSelect value={draft.rpe} onChange={(rpe) => set({ rpe })} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={`${inputCls} h-20 py-2`} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
        </Field>
      </div>
    </Sheet>
  );
}
