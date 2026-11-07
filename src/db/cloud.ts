// Sauvegarde en ligne chiffrée : les données sont chiffrées sur le téléphone avant l'envoi.
// Clé AES-GCM dérivée de la phrase secrète (PBKDF2) ; le serveur ne reçoit qu'un jeton d'accès dérivé.

import { makeBackup, parseBackup } from '../engine/backup';
import { db, exportData, importData, type AsceseDB } from './db';

const API = '/api/backup';
/** Sauvegarde automatique : au plus toutes les N minutes, et seulement si les données ont changé. */
export const AUTO_BACKUP_MIN = 2;

export class CloudError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function authToken(passphrase: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(`ascese-auth:${passphrase}`)));
}

async function aesKey(passphrase: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ascese-backup-v1'), iterations: 150_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(text: string, passphrase: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(passphrase), enc.encode(text)));
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv);
  out.set(data, iv.length);
  // Encodage par morceaux pour ne pas dépasser la pile avec de gros volumes.
  let s = '';
  for (let i = 0; i < out.length; i += 0x8000) s += b64(out.subarray(i, i + 0x8000)).replace(/=+$/, '') + '|';
  return `v1:${s}`;
}

export async function decrypt(payload: string, passphrase: string): Promise<string> {
  if (!payload.startsWith('v1:')) throw new CloudError('Format de sauvegarde inconnu.');
  const parts = payload.slice(3).split('|').filter(Boolean).map((p) => unb64(p + '='.repeat((4 - (p.length % 4)) % 4)));
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, await aesKey(passphrase), all.subarray(12));
    return new TextDecoder().decode(plain);
  } catch {
    throw new CloudError('Impossible de déchiffrer : phrase secrète différente de celle de la sauvegarde.', 'decrypt');
  }
}

async function call<T>(action: string, passphrase: string | null, init?: { body?: unknown; params?: Record<string, string> }): Promise<T> {
  const q = new URLSearchParams({ action, ...(init?.params ?? {}) });
  let res: Response;
  try {
    res = await fetch(`${API}?${q}`, {
      method: init?.body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(passphrase ? { 'x-ascese-auth': await authToken(passphrase) } : {}) },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new CloudError('Pas de connexion réseau.', 'offline');
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new CloudError('La fonction de sauvegarde n’est pas déployée.', 'no_function');
  const data = await res.json();
  if (res.status === 401) throw new CloudError('Phrase secrète incorrecte.', 'bad_passphrase');
  if (res.status === 503) throw new CloudError('Sauvegarde en ligne non configurée sur Netlify (variable ASCESE_BACKUP_KEY).', 'not_configured');
  if (!res.ok) throw new CloudError(data.error ?? `Erreur ${res.status}`, data.error);
  return data as T;
}

export async function cloudStatus(): Promise<{ configured: boolean; missingFunction?: boolean }> {
  try {
    return await call<{ configured: boolean }>('status', null);
  } catch (e) {
    if (e instanceof CloudError && e.code === 'no_function') return { configured: false, missingFunction: true };
    throw e;
  }
}

export interface BackupInfo {
  name: string;
  meta: { savedAt?: string; sessions?: number; activities?: number; weeks?: number; schemaVersion?: number };
}

/** Vérifie la phrase secrète auprès du serveur puis l'enregistre sur le téléphone. */
export async function connectCloud(passphrase: string, d: AsceseDB = db): Promise<BackupInfo[]> {
  const { backups } = await call<{ backups: BackupInfo[] }>('list', passphrase);
  await d.cloud.put({ id: 'cloud', passphrase, auto: true });
  return backups;
}

export async function listBackups(d: AsceseDB = db): Promise<BackupInfo[]> {
  const s = await d.cloud.get('cloud');
  if (!s) throw new CloudError('Sauvegarde en ligne non activée.', 'not_connected');
  return (await call<{ backups: BackupInfo[] }>('list', s.passphrase)).backups;
}

async function snapshot(d: AsceseDB): Promise<{ text: string; hash: string; counts: BackupInfo['meta'] }> {
  const data = await exportData(d);
  const backup = makeBackup(data);
  const stable = JSON.stringify({ ...backup, exportedAt: '' });
  return {
    text: JSON.stringify(backup),
    hash: hex(await crypto.subtle.digest('SHA-256', enc.encode(stable))),
    counts: { sessions: data.sessions.length, activities: data.activities.length, weeks: data.weeks.length, schemaVersion: backup.schemaVersion },
  };
}

/** Envoie une sauvegarde chiffrée si les données ont changé (ou toujours si `force`). Renvoie true si envoyée. */
export async function backupNow(opts: { force?: boolean } = {}, d: AsceseDB = db): Promise<boolean> {
  const s = await d.cloud.get('cloud');
  if (!s) throw new CloudError('Sauvegarde en ligne non activée.', 'not_connected');
  const snap = await snapshot(d);
  if (!opts.force && snap.hash === s.lastHash) return false;
  try {
    await call('put', s.passphrase, { body: { payload: await encrypt(snap.text, s.passphrase), meta: snap.counts } });
    await d.cloud.update('cloud', { lastBackupAt: Date.now(), lastHash: snap.hash, lastError: undefined });
    return true;
  } catch (e) {
    await d.cloud.update('cloud', { lastError: (e as Error).message });
    throw e;
  }
}

/** Remplace les données du téléphone par une sauvegarde en ligne (la plus récente par défaut). */
export async function restoreBackup(name = 'latest', passphrase?: string, d: AsceseDB = db): Promise<{ sessions: number; activities: number }> {
  const pass = passphrase ?? (await d.cloud.get('cloud'))?.passphrase;
  if (!pass) throw new CloudError('Saisis ta phrase secrète.', 'not_connected');
  const { payload } = await call<{ payload: string }>('get', pass, { params: { name } });
  const parsed = parseBackup(await decrypt(payload, pass));
  if (!parsed.ok) throw new CloudError(`Sauvegarde illisible : ${parsed.errors[0]}`);
  await importData(parsed.backup.data, d);
  const snap = await snapshot(d);
  await d.cloud.put({ id: 'cloud', passphrase: pass, auto: true, lastBackupAt: Date.now(), lastHash: snap.hash });
  return { sessions: parsed.backup.data.sessions.length, activities: parsed.backup.data.activities.length };
}

export async function disconnectCloud(d: AsceseDB = db): Promise<void> {
  await d.cloud.delete('cloud');
}
