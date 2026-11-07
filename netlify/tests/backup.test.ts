import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backupNow, connectCloud, decrypt, encrypt, listBackups, restoreBackup } from '../../src/db/cloud';
import { DesertusDB, ensureSeeded, exportData } from '../../src/db/db';
import { generateProgram } from '../../src/db/program';
// @ts-expect-error module JavaScript de la fonction Netlify
import { handle } from '../functions/backup.mjs';

/** Netlify Blobs en mémoire. */
function memStore() {
  const m = new Map<string, { value: string; metadata: Record<string, unknown> }>();
  return {
    m,
    async set(k: string, value: string, o?: { metadata?: Record<string, unknown> }) {
      m.set(k, { value, metadata: o?.metadata ?? {} });
    },
    async get(k: string) {
      return m.get(k)?.value ?? null;
    },
    async getMetadata(k: string) {
      const e = m.get(k);
      return e ? { metadata: e.metadata } : null;
    },
    async list({ prefix }: { prefix: string }) {
      return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
    async delete(k: string) {
      m.delete(k);
    },
  };
}

let store: ReturnType<typeof memStore>;
let n = 0;
const KEY = 'une phrase secrète assez longue';

beforeEach(() => {
  store = memStore();
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => handle(new Request(new URL(input, 'https://ascese.netlify.app'), init), { key: KEY }, store));
});
afterEach(() => vi.unstubAllGlobals());

describe('chiffrement', () => {
  it('aller-retour, et refus avec une autre phrase', async () => {
    const c = await encrypt('{"a":"éè 🚴"}', 'phrase');
    expect(c.startsWith('v1:')).toBe(true);
    expect(c).not.toContain('éè');
    expect(await decrypt(c, 'phrase')).toBe('{"a":"éè 🚴"}');
    await expect(decrypt(c, 'autre')).rejects.toThrow(/phrase secrète/);
  });
  it('gros volume (plusieurs morceaux)', async () => {
    const big = 'x'.repeat(200_000);
    expect(await decrypt(await encrypt(big, 'p'), 'p')).toBe(big);
  });
});

describe('sauvegarde en ligne', () => {
  it('phrase incorrecte refusée par le serveur', async () => {
    const d = new DesertusDB(`cloud-${n++}`);
    await expect(connectCloud('mauvaise', d)).rejects.toThrow(/incorrecte/);
  });

  it('sauvegarde chiffrée puis restauration dans une base vide (nouveau téléphone)', async () => {
    const d = new DesertusDB(`cloud-${n++}`);
    await ensureSeeded(d);
    await generateProgram({ today: '2026-11-06' }, d);
    await connectCloud(KEY, d);
    expect(await backupNow({}, d)).toBe(true);
    // Rien de neuf : pas d'envoi
    expect(await backupNow({}, d)).toBe(false);
    // Le serveur ne voit que du chiffré
    const raw = store.m.get('backup/latest')!.value;
    expect(raw).not.toContain('Desertus');
    expect(store.m.get('backup/latest')!.metadata).toMatchObject({ weeks: 22 });
    expect((await listBackups(d)).map((b) => b.name).sort()).toEqual([expect.stringMatching(/^daily-/), 'latest']);

    const phone2 = new DesertusDB(`cloud-${n++}`);
    const r = await restoreBackup('latest', KEY, phone2);
    expect(r.sessions).toBeGreaterThan(50);
    const a = await exportData(d);
    const b = await exportData(phone2);
    expect(b.sessions).toEqual(a.sessions);
    expect(b.weeks).toEqual(a.weeks);
    expect(b.settings).toEqual(a.settings);
    // Le nouveau téléphone garde la phrase pour les sauvegardes suivantes
    expect((await phone2.cloud.get('cloud'))?.passphrase).toBe(KEY);
  });

  it('garde au plus 30 versions quotidiennes', async () => {
    for (let i = 0; i < 35; i++) await store.set(`backup/daily-2026-01-${String(i + 1).padStart(2, '0')}`, 'v1:x', { metadata: {} });
    const d = new DesertusDB(`cloud-${n++}`);
    await ensureSeeded(d);
    await connectCloud(KEY, d);
    await backupNow({}, d);
    expect([...store.m.keys()].filter((k) => k.startsWith('backup/daily-'))).toHaveLength(30);
  });

  it('fonction non configurée : statut explicite', async () => {
    const r = await handle(new Request('https://x/api/backup?action=status'), {}, store);
    expect(await r.json()).toEqual({ configured: false });
  });
});
