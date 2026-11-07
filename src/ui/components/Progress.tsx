import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { CONFIG } from '../../engine/config';
import { addDays, isoWeekday, labelWeek, startOfWeek } from '../../engine/dates';
import type { GameState, HeldStatus } from '../../engine/gamification';
import { PHASE_LABEL } from '../../engine/planner';
import { useNav, useToday } from '../hooks';
import { useGame } from '../useGame';
import { Flame, LevelBadge, Ring } from './GameWidgets';
import { Sheet } from './Sheet';
import { shareWeekCard } from './shareCard';
import { useToast } from './Toast';

const fmt = (n: number) => n.toLocaleString('fr-FR');

/** Bandeau compact : jauge, série, niveau. Un tap ouvre le détail. */
export function ProgressStrip() {
  const nav = useNav();
  const g = useGame();
  if (!g) return null;
  const { readiness: r, held: h, xp } = g;
  return (
    <button onClick={() => nav.open({ kind: 'progress' })} className="w-full grid grid-cols-3 gap-2 text-left" aria-label="Voir ma progression">
      <span className="rounded-2xl bg-surface card-shadow p-2.5 flex items-center gap-2">
        <Ring value={r.percent / 100} size={44} stroke={5}>
          <span className="font-display text-[13px] font-bold tabular-nums">{r.percent}</span>
        </Ring>
        <span className="min-w-0">
          <span className="block text-[11px] text-muted leading-tight">% prêt</span>
          <span className="block text-sm font-semibold leading-tight">Desertus</span>
        </span>
      </span>
      <span className="rounded-2xl bg-surface card-shadow p-2.5 flex items-center gap-2">
        <Flame lit={h.streak > 0} className="w-7 h-7 shrink-0" />
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold leading-none tabular-nums">{h.streak}</span>
          <span className="block text-[11px] text-muted leading-tight">sem. tenue{h.streak > 1 ? 's' : ''}</span>
        </span>
      </span>
      <span className="rounded-2xl bg-surface card-shadow p-2.5 flex items-center gap-2">
        <LevelBadge index={xp.level.index} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-tight truncate">{xp.level.name}</span>
          <span className="block h-1.5 mt-1 rounded-full bg-raised overflow-hidden">
            <span className="block h-full bg-sport rounded-full" style={{ width: `${xp.level.progress * 100}%` }} />
          </span>
        </span>
      </span>
    </button>
  );
}

const HELD_STYLE: Record<HeldStatus | 'current' | 'future', { cls: string; label: string }> = {
  held: { cls: 'bg-ok text-white', label: 'tenue' },
  joker: { cls: 'bg-warn text-white', label: 'joker' },
  missed: { cls: 'bg-danger/80 text-white', label: 'manquée' },
  excluded: { cls: 'bg-raised text-muted', label: 'exclue' },
  current: { cls: 'ring-2 ring-accent text-accent', label: 'en cours' },
  future: { cls: 'border border-dashed border-line text-muted', label: 'à venir' },
};

/** Détail de la progression : jauge et ses composantes, semaines tenues, niveaux. */
export function ProgressSheet() {
  const nav = useNav();
  const toast = useToast();
  const today = useToday();
  const g = useGame();
  const weeks = useLiveQuery(() => db.weeks.orderBy('weekStart').toArray(), []) ?? [];
  if (!g) return null;
  const { readiness: r, held: h, xp } = g;
  const byWeek = new Map(h.weeks.map((w) => [w.weekStart, w]));
  const thisWeek = startOfWeek(today);
  const L = CONFIG.gamification.xp.levels;

  return (
    <Sheet
      title="Ma progression"
      onClose={nav.close}
      full
      footer={
        <button
          onClick={async () => {
            try {
              // Lundi et mardi : la semaine qui vient de se terminer.
              const how = await shareWeekCard(g, isoWeekday(today) <= 2 ? addDays(thisWeek, -7) : thisWeek);
              if (how === 'download') toast('Image de la semaine enregistrée');
            } catch (e) {
              if ((e as Error).name !== 'AbortError') toast(`Partage impossible : ${(e as Error).message}`);
            }
          }}
          className="w-full h-12 rounded-xl bg-sport font-semibold"
        >
          Partager ma semaine
        </button>
      }
    >
      <div className="space-y-5">
        {/* 1. Jauge */}
        <section className="space-y-3">
          <div className="flex items-center gap-4">
            <Ring value={r.percent / 100} size={96} stroke={9}>
              <span className="text-center leading-none">
                <span className="block font-display text-3xl font-black tabular-nums">{r.percent}</span>
                <span className="text-[11px] text-muted">%</span>
              </span>
            </Ring>
            <div>
              <h3 className="font-display text-xl font-bold leading-tight">Prêt pour le Desertus</h3>
              <p className="text-sm text-muted">Ce que tu as réellement fait, comparé à ce que l’épreuve demande.{r.estimated ? ' Rythme encore estimé (départ).' : ''}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-accent-soft p-3">
            <div className="text-xs font-semibold text-accent uppercase tracking-wide">Le plus de points à prendre</div>
            <div className="font-semibold">{r.focus.label}</div>
            <div className="text-sm">{r.focus.next}</div>
          </div>
          <ul className="space-y-2.5">
            {r.parts.map((p) => (
              <li key={p.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{p.label}</span>
                  <span className="tabular-nums text-muted">
                    <span className="text-ink font-semibold">{Math.round(p.points)}</span> / {p.weight}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-raised overflow-hidden mt-1">
                  <div className="h-full bg-sport rounded-full" style={{ width: `${p.score * 100}%` }} />
                </div>
                <div className="text-xs text-muted mt-1">{p.detail}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Semaines tenues */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Flame lit={h.streak > 0} className="w-6 h-6" />
            <h3 className="font-display text-lg font-bold">
              {h.streak} semaine{h.streak > 1 ? 's' : ''} tenue{h.streak > 1 ? 's' : ''} d’affilée
            </h3>
            <span className="ml-auto text-xs text-muted">record {h.best}</span>
          </div>
          {h.current && (
            <p className="text-sm">
              <span className="text-muted">Cette semaine : </span>
              {h.current.ok ? <span className="text-ok font-medium">déjà tenue ✓</span> : h.current.todo.join(', ') || 'en cours'}
            </p>
          )}
          <div className="grid grid-cols-7 gap-1.5">
            {weeks.map((w) => {
              const st = byWeek.get(w.weekStart)?.status ?? (w.weekStart === thisWeek ? 'current' : 'future');
              const s = HELD_STYLE[st];
              return (
                <div
                  key={w.weekStart}
                  title={`${labelWeek(w.weekStart)} · ${PHASE_LABEL[w.phase]} · ${s.label}${byWeek.get(w.weekStart) ? ` : ${byWeek.get(w.weekStart)!.reason}` : ''}`}
                  className={`h-9 rounded-lg grid place-items-center text-[11px] font-semibold tabular-nums ${s.cls}`}
                >
                  {+w.weekStart.slice(8)}/{+w.weekStart.slice(5, 7)}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            <span><span className="inline-block w-2.5 h-2.5 rounded bg-ok mr-1 align-middle" />tenue</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded bg-warn mr-1 align-middle" />joker</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded bg-danger/80 mr-1 align-middle" />manquée</span>
          </div>
          <p className="text-xs text-muted">
            Tenue = séances clés faites (ou laissées tombées proprement, aucune laissée « non faite ») et 60 % des heures prévues. Semaine allégée : tenue si tu ne dépasses pas le
            prévu. Un joker par mois sauve une semaine difficile{h.jokerLeft ? ' (celui de ce mois est disponible)' : ' (celui de ce mois est utilisé)'}.
          </p>
          {h.weeks.length > 0 && (
            <details className="text-sm">
              <summary className="text-muted">Détail des semaines</summary>
              <ul className="mt-1 space-y-0.5">
                {[...h.weeks].reverse().map((w) => (
                  <li key={w.weekStart} className="text-[13px]">
                    <span className="text-muted">{labelWeek(w.weekStart)} :</span> {w.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* 5. Niveaux */}
        <section className="space-y-2">
          <div className="flex items-center gap-3">
            <LevelBadge index={xp.level.index} size={44} />
            <div>
              <h3 className="font-display text-lg font-bold leading-tight">{xp.level.name}</h3>
              <p className="text-sm text-muted tabular-nums">
                {fmt(xp.total)} pts{xp.level.nextXp ? ` · ${fmt(xp.level.nextXp - xp.total)} avant ${xp.level.nextName}` : ''}
              </p>
            </div>
          </div>
          <ol className="space-y-1">
            {L.map((l, i) => (
              <li key={l.name} className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1 ${i === xp.level.index && !xp.finisher ? 'bg-accent-soft font-semibold' : ''} ${xp.total < l.xp ? 'text-muted' : ''}`}>
                <span className="w-4 text-center">{xp.total >= l.xp ? '✓' : '·'}</span>
                <span className="flex-1">{l.name}</span>
                <span className="tabular-nums text-xs">{fmt(l.xp)}</span>
              </li>
            ))}
            <li className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1 ${xp.finisher ? 'bg-accent-soft font-semibold' : 'text-muted'}`}>
              <span className="w-4 text-center">{xp.finisher ? '✓' : '·'}</span>
              <span className="flex-1">{CONFIG.gamification.xp.finisher}</span>
              <span className="text-xs">au Desertus</span>
            </li>
          </ol>
          <p className="text-xs text-muted">
            Points = minutes × effort perçu (RPE), plafonnés chaque semaine à la charge prévue : en faire plus que le plan ne rapporte rien. +{CONFIG.gamification.xp.heldWeekBonus} pts par
            semaine tenue (repos respecté compris).{xp.capped > 0 ? ` ${fmt(xp.capped)} pts non comptés car au-delà du prévu.` : ''}
          </p>
        </section>
      </div>
    </Sheet>
  );
}

export type { GameState };
