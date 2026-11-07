import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import { authorizeUrl, disconnectStrava, hasPrivateScope, redirectUri, stravaConfig, syncStrava, AUTO_SYNC_MIN } from '../../db/strava';
import { labelShort } from '../../engine/dates';
import { SPORT_TYPE_LABEL } from '../../engine/strava';
import { IconRefresh } from '../components/Icons';
import { useToast } from '../components/Toast';

type Cfg = Awaited<ReturnType<typeof stravaConfig>> | { error: string };

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-ink text-bg text-xs font-bold grid place-items-center shrink-0 mt-0.5">{n}</span>
      <div className="text-sm leading-snug space-y-1">{children}</div>
    </li>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="px-1.5 py-0.5 rounded bg-raised text-[13px] break-all">{children}</code>;

export function StravaSection() {
  const toast = useToast();
  const integ = useLiveQuery(() => db.integrations.get('strava'), []);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    stravaConfig().then(setCfg, (e) => setCfg({ error: (e as Error).message }));
  }, []);
  const host = typeof location !== 'undefined' ? location.host : '';

  const sync = async (full = false) => {
    setBusy(true);
    try {
      const r = await syncStrava({ full });
      toast(`Strava : ${r.imported} nouvelle(s), ${r.linked} associée(s) au plan, ${r.ignored.length} ignorée(s)`);
    } catch (e) {
      toast(`Synchronisation impossible : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (integ) {
    const r = integ.lastReport;
    const privateOk = hasPrivateScope(integ.scope);
    return (
      <div className="space-y-3">
        <section className="rounded-2xl bg-raised/60 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-ok" />
            <span className="font-semibold">Connecté{integ.athleteName ? ` · ${integ.athleteName}` : ''}</span>
          </div>
          {!privateOk && (
            <p className="text-sm text-danger">
              Les activités privées ne sont pas autorisées. Déconnecte puis reconnecte en laissant cochée l’option « activités privées ».
            </p>
          )}
          <p className="text-xs text-muted">
            Synchronisation automatique à l’ouverture de l’appli et quand tu y reviens (au plus toutes les {AUTO_SYNC_MIN} min). Dernière :{' '}
            {integ.lastSyncAt ? new Date(integ.lastSyncAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais'}.
          </p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => sync()} className="flex-1 h-11 rounded-xl bg-sport font-medium flex items-center justify-center gap-2">
              <IconRefresh className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? 'Synchronisation…' : 'Synchroniser'}
            </button>
            <button disabled={busy} onClick={() => sync(true)} className="h-11 px-3 rounded-xl bg-raised text-sm">
              Tout réimporter
            </button>
          </div>
        </section>

        {r && (
          <section className="rounded-2xl bg-raised/60 p-3 space-y-2">
            <h3 className="font-semibold text-sm">Dernière synchronisation</h3>
            {r.error && <p className="text-sm text-danger">{r.error}</p>}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['lues', r.fetched],
                ['nouvelles', r.imported],
                ['au plan', r.linked],
                ['ignorées', r.ignored.length],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-surface p-2">
                  <div className="font-display text-xl font-semibold tabular-nums">{v}</div>
                  <div className="text-[11px] text-muted">{l}</div>
                </div>
              ))}
            </div>
            {r.ignored.length > 0 && (
              <details className="text-sm">
                <summary className="text-muted">Activités ignorées (discipline non reconnue)</summary>
                <ul className="mt-1 space-y-0.5">
                  {r.ignored.slice(0, 30).map((x, i) => (
                    <li key={i} className="text-[13px]">
                      <span className="text-muted">{labelShort(x.date)} ·</span> {x.title} <span className="text-muted">({SPORT_TYPE_LABEL[x.type] ?? x.type})</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted mt-1">Pour qu’une activité soit reconnue, mets la discipline dans son titre sur Strava (ex. « Football », « Rouvy », « Natation »).</p>
              </details>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-raised/60 p-3 space-y-1.5 text-sm">
          <h3 className="font-semibold">Comment les activités sont reconnues</h3>
          <p className="text-[13px] text-muted">
            D’abord le <b>titre</b> : « foot », « futsal », « five » → football ; « Rouvy », « Zwift », « home trainer », « HT » → home-trainer ; « natation », « piscine »
            → natation ; « footing », « course », « trail » → course ; « gravel », « vélo », « route », « VTT » → gravel extérieur ; « enduro », « moto » → enduro. Ensuite le
            type Strava (Ride, GravelRide, VirtualRide, Run, Swim…), et l’indicateur home-trainer.
          </p>
          <p className="text-[13px] text-muted">
            Une activité valide la séance prévue <b>le même jour dans la même discipline</b>, quelle que soit sa durée ou son contenu (une sortie prévue dehors mais faite sur Rouvy compte). Sinon, elle s’affiche en « non prévue ».
          </p>
        </section>

        <button
          onClick={async () => {
            if (!window.confirm('Déconnecter Strava ? Les activités déjà importées restent dans ton plan.')) return;
            await disconnectStrava();
            toast('Strava déconnecté');
          }}
          className="text-sm text-danger px-1"
        >
          Déconnecter Strava
        </button>
      </div>
    );
  }

  const ready = cfg && 'configured' in cfg && cfg.configured && cfg.clientId;
  const missingFunction = cfg && 'missingFunction' in cfg;
  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-raised/60 p-3 space-y-2">
        <p className="text-sm">
          Ta Suunto envoie déjà tes activités sur Strava. Une fois connecté, Ascèse les récupère et coche toute seule les séances faites de ton plan.
        </p>
        {ready ? (
          <>
            <a href={authorizeUrl(cfg.clientId!)} className="w-full h-12 rounded-xl bg-[#fc4c02] text-white font-semibold flex items-center justify-center">
              Se connecter avec Strava
            </a>
            <p className="text-xs text-muted">
              Sur la page Strava, <b>laisse cochée « Voir les données de vos activités privées »</b> : sinon les activités en « Moi uniquement » ne remonteront pas. Si le retour s’ouvre dans Chrome plutôt que dans l’appli, reviens simplement dans Ascèse.
            </p>
          </>
        ) : (
          <p className="text-sm text-warn">
            {missingFunction
              ? 'Le relais Strava n’est pas disponible ici (il fonctionne une fois l’appli déployée sur Netlify).'
              : cfg && 'error' in cfg
                ? `Impossible de joindre le relais : ${cfg.error}`
                : cfg
                  ? 'Il reste à créer ton application Strava et à donner ses identifiants à Netlify (une seule fois, 5 minutes) :'
                  : 'Vérification…'}
          </p>
        )}
      </section>

      {!ready && (
        <section className="rounded-2xl bg-raised/60 p-3">
          <h3 className="font-semibold text-sm mb-2">Mise en place (une seule fois)</h3>
          <ol className="space-y-3">
            <Step n={1}>
              <p>
                Sur ordinateur ou téléphone, ouvre <Code>strava.com/settings/api</Code> et crée une application :
              </p>
              <p className="text-[13px] text-muted">
                Nom : <Code>Ascèse</Code> · Catégorie : <Code>Training</Code> · Site web : <Code>https://{host || 'ton-site.netlify.app'}</Code> ·{' '}
                <b>Domaine de rappel d’autorisation</b> : <Code>{host || 'ton-site.netlify.app'}</Code>
              </p>
            </Step>
            <Step n={2}>
              <p>Strava affiche un <b>ID client</b> (un nombre) et un <b>secret client</b> (cliquer sur « afficher »). Garde la page ouverte.</p>
            </Step>
            <Step n={3}>
              <p>
                Sur <Code>app.netlify.com</Code> → ton site → <b>Site configuration</b> → <b>Environment variables</b> → <b>Add a variable</b>, ajoute :
              </p>
              <p className="text-[13px]">
                <Code>STRAVA_CLIENT_ID</Code> = l’ID client
                <br />
                <Code>STRAVA_CLIENT_SECRET</Code> = le secret client
              </p>
              <p className="text-[13px] text-muted">Le secret reste chez Netlify : il n’est jamais dans l’appli ni sur ton téléphone.</p>
            </Step>
            <Step n={4}>
              <p>
                <b>Deploys</b> → <b>Trigger deploy</b> → <b>Deploy site</b> (les variables ne sont prises en compte qu’au déploiement suivant). Puis rouvre cette page : le bouton « Se connecter avec Strava » apparaît.
              </p>
            </Step>
          </ol>
          <p className="text-xs text-muted mt-3">Adresse de retour utilisée : <Code>{redirectUri()}</Code></p>
        </section>
      )}
    </div>
  );
}
