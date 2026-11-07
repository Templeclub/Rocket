// Connexion Strava et synchronisation des activités vers le plan.

import { CONFIG } from '../engine/config';
import { addDays } from '../engine/dates';
import { newId } from '../engine/library';
import { markDone } from '../engine/status';
import { classify, matchSession, stravaLocalDate, toActivity, type StravaActivity } from '../engine/strava';
import type { Activity, StravaIntegration, SyncReport } from '../engine/types';
import { db, type AsceseDB } from './db';

export const STRAVA_SCOPE = 'read,activity:read_all';
const API = '/api/strava';
/** Synchronisation automatique au plus toutes les N minutes (ouverture et retour dans l'appli). */
export const AUTO_SYNC_MIN = 30;
/** Première synchronisation : 8 semaines avant le début du plan (pour le rythme réel). */
const FIRST_SYNC_FROM = addDays(CONFIG.planStart, -56);

export class StravaError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function call<T>(action: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}?action=${action}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new StravaError('Pas de connexion réseau.', 'offline');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new StravaError('Le relais Strava n’est pas déployé (fonction Netlify absente).', 'no_function');
  const data = await res.json();
  if (!res.ok) throw new StravaError(data.message ?? data.error ?? `Erreur ${res.status}`, data.error);
  return data as T;
}

export interface StravaConfig {
  configured: boolean;
  clientId: string | null;
}

export async function stravaConfig(): Promise<StravaConfig | { configured: false; clientId: null; missingFunction: true }> {
  try {
    return await call<StravaConfig>('config');
  } catch (e) {
    if (e instanceof StravaError && e.code === 'no_function') return { configured: false, clientId: null, missingFunction: true };
    throw e;
  }
}

export function redirectUri(): string {
  return `${location.origin}/`;
}

/** Page d'autorisation Strava (le retour se fait sur l'appli avec ?code=…&scope=…&state=ascese). */
export function authorizeUrl(clientId: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
    state: 'ascese-strava',
  });
  return `https://www.strava.com/oauth/authorize?${q}`;
}

export function hasPrivateScope(scope: string): boolean {
  return scope.split(/[ ,]/).includes('activity:read_all');
}

/** À l'ouverture : traite le retour de Strava s'il y en a un. Renvoie un message à afficher, ou null. */
export async function handleStravaRedirect(d: AsceseDB = db): Promise<{ ok: boolean; message: string } | null> {
  const url = new URL(location.href);
  if (url.searchParams.get('state') !== 'ascese-strava') return null;
  const code = url.searchParams.get('code');
  const scope = url.searchParams.get('scope') ?? '';
  const error = url.searchParams.get('error');
  history.replaceState(null, '', '/');
  if (error || !code) return { ok: false, message: 'Connexion Strava annulée.' };
  const t = await call<{ accessToken: string; refreshToken: string; expiresAt: number; athleteName?: string }>('exchange', { code });
  await d.integrations.put({ id: 'strava', ...t, scope, connectedAt: Date.now() });
  return hasPrivateScope(scope)
    ? { ok: true, message: `Strava connecté${t.athleteName ? ` (${t.athleteName})` : ''}` }
    : { ok: true, message: 'Strava connecté, mais SANS les activités privées : reconnecte et laisse cochée « activités privées ».' };
}

async function validToken(d: AsceseDB): Promise<StravaIntegration> {
  const s = await d.integrations.get('strava');
  if (!s) throw new StravaError('Strava n’est pas connecté.', 'not_connected');
  if (s.expiresAt - 120 > Date.now() / 1000) return s;
  const t = await call<{ accessToken: string; refreshToken: string; expiresAt: number }>('refresh', { refreshToken: s.refreshToken });
  if (!t.accessToken) throw new StravaError('Strava a refusé le renouvellement : reconnecte-toi.', 'refresh_failed');
  const next = { ...s, accessToken: t.accessToken, refreshToken: t.refreshToken ?? s.refreshToken, expiresAt: t.expiresAt };
  await d.integrations.put(next);
  return next;
}

/**
 * Importe les activités Strava et les rapproche du plan (même jour, même discipline).
 * - le titre puis le type Strava décident de la discipline ; le reste est ignoré et listé ;
 * - une activité déjà importée est mise à jour, jamais dupliquée ;
 * - une séance prévue rapprochée passe à « faite » ; un « Fait » saisi à la main ce jour-là est remplacé.
 */
export async function syncStrava(opts: { full?: boolean } = {}, d: AsceseDB = db): Promise<SyncReport> {
  const integ = await validToken(d);
  const from = opts.full || !integ.lastSyncAt ? Date.parse(`${FIRST_SYNC_FROM}T00:00:00Z`) / 1000 : integ.lastSyncAt / 1000 - 3 * 86400;
  const all: StravaActivity[] = [];
  for (let page = 1; page <= 20; page++) {
    const { activities } = await call<{ activities: StravaActivity[] }>('activities', { accessToken: integ.accessToken, after: from, page, perPage: 100 });
    all.push(...activities);
    if (activities.length < 100) break;
  }
  const report = await importStravaActivities(all, d);
  await d.integrations.update('strava', { lastSyncAt: Date.now(), lastReport: report });
  return report;
}

/** Cœur de l'import (testable sans réseau). */
export async function importStravaActivities(list: StravaActivity[], d: AsceseDB = db): Promise<SyncReport> {
  const report: SyncReport = { at: Date.now(), fetched: list.length, imported: 0, updated: 0, linked: 0, ignored: [] };
  await d.transaction('rw', d.activities, d.sessions, async () => {
    const taken = new Set((await d.activities.where('source').equals('strava').toArray()).map((a) => a.plannedSessionId).filter((x): x is string => !!x));
    for (const s of [...list].sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))) {
      const c = classify(s);
      if (!c) {
        report.ignored.push({ title: s.name, type: s.sport_type ?? s.type ?? '?', date: stravaLocalDate(s) });
        continue;
      }
      const externalId = `strava:${s.id}`;
      const existing = await d.activities.where('externalId').equals(externalId).first();
      const act = toActivity(s, c, existing?.id ?? newId());
      if (existing) {
        const unchanged = existing.date === act.date && existing.sport === act.sport;
        await d.activities.put({ ...act, plannedSessionId: unchanged ? existing.plannedSessionId : undefined, rpe: existing.rpe, notes: existing.notes });
        report.updated++;
        if (unchanged) continue;
        if (existing.plannedSessionId) taken.delete(existing.plannedSessionId);
      } else {
        await d.activities.add(act);
        report.imported++;
      }

      const day = await d.sessions.where('date').equals(act.date).toArray();
      const session = matchSession(act, day, taken);
      if (!session) continue;
      taken.add(session.id);
      // Un « Fait » saisi à la main pour cette séance est remplacé par l'activité Strava.
      const manual = await d.activities.where('plannedSessionId').equals(session.id).filter((a: Activity) => a.source === 'manual').toArray();
      await d.activities.bulkDelete(manual.map((a) => a.id));
      await d.activities.update(act.id, { plannedSessionId: session.id });
      if (session.status !== 'done') await d.sessions.put({ ...markDone(session), confirmed: true });
      report.linked++;
    }
  });
  return report;
}

export async function disconnectStrava(d: AsceseDB = db): Promise<void> {
  const s = await d.integrations.get('strava');
  if (s) await call('deauthorize', { accessToken: s.accessToken }).catch(() => {});
  await d.integrations.delete('strava');
}

export function shouldAutoSync(s: StravaIntegration | undefined, now = Date.now()): boolean {
  return !!s && (!s.lastSyncAt || now - s.lastSyncAt > AUTO_SYNC_MIN * 60_000);
}
