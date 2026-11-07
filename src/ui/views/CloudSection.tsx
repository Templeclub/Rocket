import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { backupNow, cloudStatus, connectCloud, disconnectCloud, listBackups, restoreBackup, type BackupInfo } from '../../db/cloud';
import { db } from '../../db/db';
import { inputCls } from '../components/Form';
import { IconRefresh } from '../components/Icons';
import { useToast } from '../components/Toast';

const when = (iso?: string | number) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** Sauvegarde en ligne chiffrée : activation, état, versions, restauration. */
export function CloudSection() {
  const toast = useToast();
  const state = useLiveQuery(() => db.cloud.get('cloud'), []);
  const [status, setStatus] = useState<{ configured: boolean; missingFunction?: boolean } | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<BackupInfo[] | null>(null);

  useEffect(() => {
    cloudStatus().then(setStatus, () => setStatus({ configured: false }));
  }, []);
  useEffect(() => {
    if (state) listBackups().then(setVersions, () => setVersions(null));
  }, [state?.lastBackupAt, state]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restore = (name: string, label: string, passphrase?: string) =>
    guard(async () => {
      if (!window.confirm(`Remplacer les données de ce téléphone par la sauvegarde du ${label} ?`)) return;
      const r = await restoreBackup(name, passphrase);
      toast(`Sauvegarde restaurée : ${r.sessions} séances, ${r.activities} activités`);
    });

  if (state) {
    return (
      <section className="rounded-2xl bg-raised/60 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${state.lastError ? 'bg-warn' : 'bg-ok'}`} />
          <h3 className="font-semibold">Sauvegarde en ligne activée</h3>
        </div>
        <p className="text-sm">
          Dernière sauvegarde : <b>{when(state.lastBackupAt)}</b>
        </p>
        {state.lastError && <p className="text-sm text-warn">Dernier envoi en échec : {state.lastError}</p>}
        <p className="text-xs text-muted">
          Automatique : à l’ouverture, toutes les 2 minutes s’il y a du nouveau, et quand tu quittes l’appli. Chiffrée sur le téléphone avec ta phrase secrète ; 30 versions
          quotidiennes conservées.
        </p>
        <button disabled={busy} onClick={() => guard(async () => void (await backupNow({ force: true }), toast('Sauvegarde envoyée')))} className="w-full h-11 rounded-xl bg-sport font-semibold flex items-center justify-center gap-2">
          <IconRefresh className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Sauvegarder maintenant
        </button>
        {versions && versions.length > 0 && (
          <details>
            <summary className="text-sm font-medium">Restaurer une version ({versions.length})</summary>
            <ul className="mt-2 divide-y divide-line rounded-xl bg-surface">
              {versions.map((v) => (
                <li key={v.name} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1">
                    <span className="block">{v.name === 'latest' ? 'Dernière' : `Jour du ${v.name.slice(6)}`}</span>
                    <span className="block text-xs text-muted">
                      {when(v.meta.savedAt)} · {v.meta.sessions ?? '?'} séances · {v.meta.activities ?? '?'} activités
                    </span>
                  </span>
                  <button disabled={busy} onClick={() => restore(v.name, when(v.meta.savedAt))} className="text-accent font-medium">
                    Restaurer
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <button
          onClick={async () => {
            if (!window.confirm('Désactiver la sauvegarde en ligne sur ce téléphone ? Les sauvegardes déjà envoyées restent en ligne.')) return;
            await disconnectCloud();
            toast('Sauvegarde en ligne désactivée');
          }}
          className="text-sm text-danger"
        >
          Désactiver sur ce téléphone
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-raised/60 p-3 space-y-3">
      <h3 className="font-semibold">Sauvegarde en ligne</h3>
      <p className="text-sm">
        Tes données restent sur le téléphone d’une version à l’autre de l’appli. La sauvegarde en ligne les protège si tu désinstalles l’appli, effaces les données de Chrome ou
        changes de téléphone.
      </p>
      {status?.configured ? (
        <>
          <label className="block">
            <span className="block text-xs text-muted mb-1">Phrase secrète (celle de la variable ASCESE_BACKUP_KEY sur Netlify)</span>
            <input type="password" autoComplete="current-password" className={inputCls} value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              disabled={busy || pass.length < 8}
              onClick={() =>
                guard(async () => {
                  const list = await connectCloud(pass);
                  if (list.length && (await db.weeks.count()) === 0) {
                    if (window.confirm(`Une sauvegarde existe (${when(list[0].meta.savedAt)}). La restaurer sur ce téléphone ?`)) {
                      const r = await restoreBackup('latest', pass);
                      toast(`Sauvegarde restaurée : ${r.sessions} séances`);
                      return;
                    }
                  }
                  await backupNow({ force: true });
                  toast('Sauvegarde en ligne activée');
                })
              }
              className="flex-1 h-11 rounded-xl bg-sport font-semibold disabled:opacity-50"
            >
              Activer
            </button>
          </div>
          <p className="text-xs text-muted">Sur un nouveau téléphone : installe l’appli, saisis la même phrase ici, et la dernière sauvegarde est proposée.</p>
        </>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="text-warn">
            {status?.missingFunction ? 'La fonction de sauvegarde n’est pas disponible ici (elle fonctionne une fois l’appli déployée sur Netlify).' : status ? 'À configurer une seule fois sur Netlify :' : 'Vérification…'}
          </p>
          {status && !status.missingFunction && (
            <ol className="list-decimal pl-5 space-y-1 text-[13px]">
              <li>
                Choisis une <b>phrase secrète</b> d’au moins 12 caractères (note-la : sans elle, la sauvegarde est illisible).
              </li>
              <li>
                Netlify → ton site → <b>Site configuration</b> → <b>Environment variables</b> → ajoute <code className="px-1 rounded bg-raised">ASCESE_BACKUP_KEY</code> = ta phrase.
              </li>
              <li>
                <b>Deploys</b> → <b>Trigger deploy</b>, puis reviens ici et saisis la même phrase.
              </li>
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
