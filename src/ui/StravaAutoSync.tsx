import { useEffect } from 'react';
import { db } from '../db/db';
import { handleStravaRedirect, shouldAutoSync, syncStrava } from '../db/strava';
import { useToast } from './components/Toast';
import { useNav } from './hooks';

/** Retour de l'autorisation Strava, puis synchronisation à l'ouverture et à chaque retour dans l'appli. */
export function StravaAutoSync() {
  const toast = useToast();
  const nav = useNav();
  useEffect(() => {
    let running = false;
    const run = async (force = false) => {
      if (running || !navigator.onLine) return;
      const s = await db.integrations.get('strava');
      if (!s || (!force && !shouldAutoSync(s))) return;
      running = true;
      try {
        const r = await syncStrava();
        if (r.imported > 0) toast(`Strava : ${r.imported} activité${r.imported > 1 ? 's' : ''} importée${r.imported > 1 ? 's' : ''}, ${r.linked} au plan`);
      } catch (e) {
        await db.integrations.update('strava', { lastSyncAt: Date.now(), lastReport: { at: Date.now(), fetched: 0, imported: 0, updated: 0, linked: 0, ignored: [], error: (e as Error).message } });
      } finally {
        running = false;
      }
    };
    handleStravaRedirect()
      .then((r) => {
        if (!r) return run();
        toast(r.message);
        if (r.ok) {
          nav.open({ kind: 'settings', section: 'strava' });
          return run(true);
        }
      })
      .catch((e) => toast(`Connexion Strava impossible : ${(e as Error).message}`));
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
