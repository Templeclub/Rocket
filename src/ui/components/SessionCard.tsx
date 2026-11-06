import { labelShort } from '../../engine/dates';
import { SPORT_META, sportKey } from '../../engine/sports';
import { displayStatus, isPending } from '../../engine/status';
import type { Activity, PlannedSession } from '../../engine/types';
import { formatDuration } from '../../engine/zones';
import { useNav, useSessionActions } from '../hooks';
import { IconAlert, IconCheck, IconMore, IconStar } from './Icons';

const statusStyle: Record<string, string> = {
  prévue: 'text-muted',
  reportée: 'text-warn',
  faite: 'text-ok',
  annulée: 'text-muted line-through',
  'non faite': 'text-danger',
};

/**
 * Carte compacte : une seule action visible (« ⋯ », qui ouvre toutes les actions en 1 tap).
 * Recommandée = bord pointillé et pastille « Confirmer » ; confirmée = carte pleine.
 */
export function SessionCard({ session, activity, issue }: { session: PlannedSession; activity?: Activity; issue?: string }) {
  const nav = useNav();
  const act = useSessionActions();
  const meta = SPORT_META[sportKey(session.sport, session.environment)];
  const status = displayStatus(session, act.today);
  const pending = isPending(session);
  const cancelled = session.status === 'cancelled';
  const done = session.status === 'done';
  const reco = pending && !session.confirmed;

  return (
    <div
      onClick={() => nav.open({ kind: 'session', id: session.id })}
      className={`relative rounded-2xl border flex items-stretch overflow-hidden ${
        reco ? 'card-reco border-muted/40' : 'bg-surface border-transparent card-shadow'
      } ${cancelled ? 'opacity-50' : ''} ${issue ? 'ring-1 ring-warn/60' : ''}`}
    >
      <div className="w-1 shrink-0" style={{ background: meta.color, opacity: reco ? 0.55 : 1 }} />
      <div className="flex-1 min-w-0 pl-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-base leading-none">
            {meta.emoji}
          </span>
          <span className={`font-medium truncate ${cancelled ? 'line-through' : ''} ${done ? 'text-muted' : ''}`}>{session.title}</span>
          {session.priority === 'key' && (
            <span className="text-accent shrink-0" title="Séance clé">
              <IconStar className="w-3 h-3" />
            </span>
          )}
          {done && (
            <span className="text-ok shrink-0" title="Faite">
              <IconCheck className="w-4 h-4" />
            </span>
          )}
        </div>
        <div className="text-[13px] text-muted mt-0.5 flex flex-wrap items-center gap-x-1.5 tabular-nums">
          <span>{formatDuration(session.targetDurationMin * 60)}</span>
          {session.targetDistanceKm ? <span>· {session.targetDistanceKm} km</span> : null}
          {session.targetElevationM ? <span>· {session.targetElevationM} m D+</span> : null}
          {status !== 'prévue' && <span className={statusStyle[status]}>· {status}</span>}
          {session.originalDate && pending && <span className="text-warn">(du {labelShort(session.originalDate)})</span>}
          {activity && <span className="text-ok">· fait {formatDuration(activity.durationSec)}</span>}
        </div>
        {(reco || issue) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {reco && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  act.setConfirmed([session.id], true);
                }}
                className="h-7 pl-2 pr-2.5 rounded-full border border-dashed border-muted/60 text-xs text-muted flex items-center gap-1 active:scale-95"
                aria-label={`Confirmer « ${session.title} »`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-muted/60" />
                Recommandée · <span className="text-accent font-medium">Confirmer</span>
              </button>
            )}
            {issue && (
              <span className="text-xs text-warn flex items-center gap-1">
                <IconAlert className="w-3.5 h-3.5" /> {issue}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          nav.open({ kind: 'actions', id: session.id });
        }}
        aria-label={`Actions pour « ${session.title} »`}
        className="w-12 shrink-0 grid place-items-center text-muted active:bg-raised"
      >
        <IconMore />
      </button>
    </div>
  );
}

/** Activité réalisée sans séance prévue. */
export function ActivityCard({ activity }: { activity: Activity }) {
  const nav = useNav();
  const meta = SPORT_META[sportKey(activity.sport, activity.environment)];
  return (
    <button
      onClick={() => nav.open({ kind: 'activity', id: activity.id })}
      className="w-full text-left rounded-2xl bg-surface card-shadow overflow-hidden flex"
    >
      <div className="w-1 shrink-0" style={{ background: meta.color }} />
      <div className="flex-1 pl-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">{meta.emoji}</span>
          <span className="font-medium">{meta.label}</span>
          <span className="text-xs text-muted">non prévue</span>
          <span className="text-ok">
            <IconCheck className="w-4 h-4" />
          </span>
        </div>
        <div className="text-[13px] text-muted mt-0.5 flex gap-1.5 tabular-nums">
          <span className="text-ok">fait {formatDuration(activity.durationSec)}</span>
          {activity.distanceM ? <span>· {(activity.distanceM / 1000).toFixed(1)} km</span> : null}
          {activity.elevationM ? <span>· {activity.elevationM} m D+</span> : null}
        </div>
      </div>
    </button>
  );
}
