import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../db/db';
import * as A from '../db/actions';
import { xpOf } from '../engine/gamification';
import { celebrate } from './feedback';
import { setConfirmed, switchVariant } from '../db/program';
import { labelDay, todayLocal } from '../engine/dates';
import type { AppSettings, LocalDate } from '../engine/types';
import { withDefaults } from '../engine/zones';
import { useToast } from './components/Toast';

export type Overlay =
  | { kind: 'create'; date: LocalDate }
  | { kind: 'session'; id: string }
  | { kind: 'newSession'; date: LocalDate }
  | { kind: 'template'; id?: string }
  | { kind: 'activity'; id?: string; sessionId?: string; date?: LocalDate }
  | { kind: 'postpone'; id: string }
  | { kind: 'swap'; id: string }
  | { kind: 'review'; weekStart: LocalDate }
  | { kind: 'actions'; id: string }
  | { kind: 'replan'; weekStart: LocalDate }
  | { kind: 'paris'; weekStart: LocalDate }
  | { kind: 'settings'; section: string }
  | { kind: 'progress' };

export interface Nav {
  open: (o: Overlay) => void;
  /** Remplace le panneau du dessus (sans empiler). */
  replace: (o: Overlay) => void;
  close: () => void;
  goWeekOf: (d: LocalDate) => void;
}

export const NavCtx = createContext<Nav>({ open: () => {}, replace: () => {}, close: () => {}, goWeekOf: () => {} });
export const useNav = () => useContext(NavCtx);

export function useSettings(): AppSettings {
  return withDefaults(useLiveQuery(() => db.settings.get('app'), []));
}

/** Date du jour (Europe/Paris), recalculée au retour dans l'appli. */
export function useToday(): LocalDate {
  const [today, setToday] = useState(todayLocal());
  useEffect(() => {
    const refresh = () => setToday(todayLocal());
    document.addEventListener('visibilitychange', refresh);
    const t = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(t);
    };
  }, []);
  return today;
}

/** Actions de plan avec bandeau « Annuler l'action ». */
export function useSessionActions() {
  const toast = useToast();
  const nav = useNav();
  const today = useToday();

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const undoAction = (undo: A.Undo) => ({ label: 'Annuler', run: () => guard(undo) });

  return {
    today,
    done: (id: string) =>
      guard(async () => {
        const { activity, undo } = await A.markSessionDone(id);
        celebrate({ kind: 'done' });
        const s = await db.sessions.get(id);
        const pts = s ? xpOf(s.targetDurationMin, s.sport, s.rpe) : 0;
        toast(pts ? `Faite ✓ +${pts} pts` : 'Faite ✓', undoAction(undo), {
          label: 'Détailler',
          run: () => nav.open({ kind: 'activity', id: activity.id }),
        });
      }),
    postpone: (id: string, date: LocalDate) =>
      guard(async () => {
        const undo = await A.postponeSession(id, date, today);
        toast(`Reportée au ${labelDay(date)}`, undoAction(undo));
      }),
    swap: (a: string, b: string) =>
      guard(async () => {
        const undo = await A.swapSessions(a, b, today);
        toast('Séances échangées', undoAction(undo));
      }),
    cancel: (id: string) =>
      guard(async () => {
        const undo = await A.cancelSession(id);
        toast('Séance annulée', undoAction(undo));
      }),
    restore: (id: string) =>
      guard(async () => {
        const undo = await A.restoreSession(id);
        toast('Séance rétablie', undoAction(undo));
      }),
    remove: (id: string) =>
      guard(async () => {
        const undo = await A.deleteSession(id);
        toast('Séance supprimée', undoAction(undo));
      }),
    createFromTemplate: (templateId: string, date: LocalDate) =>
      guard(async () => {
        const { session, undo } = await A.createFromTemplate(templateId, date);
        toast(`Ajoutée le ${labelDay(date)}`, undoAction(undo), {
          label: 'Modifier',
          run: () => nav.open({ kind: 'session', id: session.id }),
        });
      }),
    setConfirmed: (ids: string[], value: boolean) =>
      guard(async () => {
        const undo = await setConfirmed(ids, value);
        toast(value ? (ids.length > 1 ? `${ids.length} séances confirmées` : 'Séance confirmée') : 'Repassée en recommandée', undoAction(undo));
      }),
    switchVariant: (id: string, title: string) =>
      guard(async () => {
        const undo = await switchVariant(id);
        toast(`Basculée : ${title}`, undoAction(undo));
      }),
    removeActivity: (id: string) =>
      guard(async () => {
        const undo = await A.deleteActivity(id);
        toast('Réalisé supprimé', undoAction(undo));
      }),
  };
}
