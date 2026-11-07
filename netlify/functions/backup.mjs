// Sauvegarde en ligne (fonction Netlify + Netlify Blobs).
// Les données arrivent déjà chiffrées par le téléphone (AES-GCM, clé dérivée de ma phrase secrète) :
// la fonction ne fait que vérifier l'accès et ranger des versions. Elle ne peut pas lire leur contenu.
//
// Variable d'environnement Netlify : ASCESE_BACKUP_KEY (la phrase secrète choisie).

import { getStore } from '@netlify/blobs';

const PREFIX = 'backup/';
const KEEP_DAILY = 30;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function authToken(passphrase) {
  const bytes = new TextEncoder().encode(`ascese-auth:${passphrase}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison à temps constant. */
function same(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function handle(req, env, store) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  if (action === 'status') return json({ configured: Boolean(env.key) });
  if (!env.key) return json({ error: 'not_configured' }, 503);
  if (!same(req.headers.get('x-ascese-auth'), await authToken(env.key))) return json({ error: 'bad_passphrase' }, 401);

  if (action === 'list') {
    const { blobs } = await store.list({ prefix: PREFIX });
    const items = await Promise.all(
      blobs.map(async (b) => ({ name: b.key.slice(PREFIX.length), meta: (await store.getMetadata(b.key))?.metadata ?? {} })),
    );
    items.sort((x, y) => String(y.meta.savedAt ?? '').localeCompare(String(x.meta.savedAt ?? '')));
    return json({ backups: items });
  }
  if (action === 'get') {
    const name = url.searchParams.get('name') ?? 'latest';
    if (!/^[a-z0-9-]+$/.test(name)) return json({ error: 'bad_name' }, 400);
    const payload = await store.get(PREFIX + name, { type: 'text' });
    if (payload === null) return json({ error: 'not_found' }, 404);
    return json({ name, payload });
  }
  if (action === 'put' && req.method === 'POST') {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.payload !== 'string' || !body.payload.startsWith('v1:')) return json({ error: 'bad_payload' }, 400);
    const savedAt = new Date().toISOString();
    const meta = { ...(body.meta ?? {}), savedAt };
    await store.set(`${PREFIX}latest`, body.payload, { metadata: meta });
    await store.set(`${PREFIX}daily-${savedAt.slice(0, 10)}`, body.payload, { metadata: meta });
    // Garde les 30 dernières versions quotidiennes.
    const { blobs } = await store.list({ prefix: `${PREFIX}daily-` });
    const old = blobs.map((b) => b.key).sort().reverse().slice(KEEP_DAILY);
    await Promise.all(old.map((k) => store.delete(k)));
    return json({ ok: true, savedAt });
  }
  return json({ error: 'unknown_action' }, 400);
}

export default (req) => handle(req, { key: process.env.ASCESE_BACKUP_KEY }, getStore({ name: 'ascese-backups', consistency: 'strong' }));

export const config = { path: '/api/backup' };
