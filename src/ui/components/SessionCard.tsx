import { labelShort } from '../../engine/dates';
import { SPORT_META, sportKey } from '../../engine/sports';
import { displayStatus, isMissed, isPending } from '../../engine/status';
import type { Activity, PlannedSession } from '../../engine/types';
import { formatDuration } from '../../engine/zones';
import { useNav, useSessionActions } from '../hooks';
import { IconCheck, IconPostpone, IconStar, IconSwap, IconX } from './Icons';

const statusStyle: Record<string, string> = {
  prévue: 'text-muted',
  reportée: 'text-warn',
  faite: 'text-ok',
  annulée: 'text-muted line-through',
  'non faite': 'text-danger',
};

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className="h-10 flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-raised text-ink text-sm active:scale-95"
    >
      {children}
    </button>
  );
}

export function SessionCard({ session, activity }: { session: PlannedSession; activity?: Activity }) {
  const nav = useNav();
  const act = useSessionActions();
  const meta = SPORT_META[sportKey(session.sport, session.environment)];
  const status = displayStatus(session, act.today);
  const pending = isPending(session);
  const cancelled = session.status === 'cancelled';

  return (
    <div
      onClick={() => nav.open({ kind: 'session', id: session.id })}
      className={`rounded-xl bg-surface border border-line overflow-hidden flex ${cancelled ? 'opacity-55' : ''}`}
    >
      <div className="w-1.5 shrink-0" style={{ background: meta.color }} />
      <div className="flex-1 min-w-0 p-3">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">{meta.emoji}</span>
          <span className={`font-medium truncate ${cancelled ? 'line-through' : ''}`}>{session.title}</span>
          {session.priority === 'key' && (
            <span className="text-accent shrink-0" title="Séance clé">
              <IconStar />
            </span>
          )}
        </div>
        <div className="text-sm text-muted mt-0.5 flex flex-wrap gap-x-2">
          <span>{formatDuration(session.targetDurationMin * 60)}</span>
          {session.targetDistanceKm ? <span>{session.targetDistanceKm} km</span> : null}
          {session.targetElevationM ? <span>{session.targetElevationM} m D+</span> : null}
          <span className={statusStyle[status]}>· {status}</span>
          {session.originalDate && pending && <span className="text-warn">(du {labelShort(session.originalDate)})</span>}
          {activity && <span className="text-ok">fait {formatDuration(activity.durationSec)}</span>}
        </div>
        {pending && (
          <div className="flex gap-1.5 mt-2.5">
            <ActionButton label="Faite comme prévu" onClick={() => act.done(session.id)}>
              <IconCheck /> Fait
            </ActionButton>
            <ActionButton label="Reporter" onClick={() => nav.open({ kind: 'postpone', id: session.id })}>
              <IconPostpone /> Reporter
            </ActionButton>
            {!isMissed(session, act.today) && (
              <ActionButton label="Échanger" onClick={() => nav.open({ kind: 'swap', id: session.id })}>
                <IconSwap />
              </ActionButton>
            )}
            <ActionButton label="Annuler la séance" onClick={() => act.cancel(session.id)}>
              <IconX />
            </ActionButton>
          </div>
        )}
      </div>
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
      className="w-full text-left rounded-xl bg-surface border border-dashed border-line overflow-hidden flex"
    >
      <div className="w-1.5 shrink-0" style={{ background: meta.color }} />
      <div className="flex-1 p-3">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">{meta.emoji}</span>
          <span className="font-medium">{meta.label}</span>
          <span className="text-xs text-muted">(non prévue)</span>
        </div>
        <div className="text-sm text-muted mt-0.5 flex gap-2">
          <span className="text-ok">fait {formatDuration(activity.durationSec)}</span>
          {activity.distanceM ? <span>{(activity.distanceM / 1000).toFixed(1)} km</span> : null}
          {activity.elevationM ? <span>{activity.elevationM} m D+</span> : null}
        </div>
      </div>
    </button>
  );
}
