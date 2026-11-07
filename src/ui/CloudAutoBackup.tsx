import { useEffect } from 'react';
import { AUTO_BACKUP_MIN, backupNow } from '../db/cloud';
import { db } from '../db/db';

/** Sauvegarde en ligne automatique : à l'ouverture, toutes les 2 min si quelque chose a changé, et en quittant l'appli. */
export function CloudAutoBackup() {
  useEffect(() => {
    let running = false;
    const run = async () => {
      if (running || !navigator.onLine) return;
      const s = await db.cloud.get('cloud');
      if (!s?.auto) return;
      running = true;
      try {
        await backupNow();
      } catch {
        /* l'erreur est enregistrée et affichée dans Paramètres → Sauvegarde */
      } finally {
        running = false;
      }
    };
    run();
    const t = window.setInterval(() => document.visibilityState === 'visible' && run(), AUTO_BACKUP_MIN * 60_000);
    const onHide = () => document.visibilityState === 'hidden' && run();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', run);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', run);
    };
  }, []);
  return null;
}
