import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { labelShort } from '../../engine/dates';
import { KIND_LABEL, PHASE_LABEL } from '../../engine/planner';
import type { LocalDate, Phase, WeekPlan } from '../../engine/types';

export const PHASES: Phase[] = ['base', 'development', 'specific', 'taper'];
export const phaseColor = (p: Phase) => `var(--ph-${p})`;
export const phaseSoft = (p: Phase) => `var(--ph-${p}-soft)`;

export function usePlanWeeks(): WeekPlan[] {
  return useLiveQuery(() => db.weeks.orderBy('weekStart').toArray(), []) ?? [];
}

/**
 * Fil du programme : une case par semaine, colorée par phase, la semaine affichée repérée.
 * Sous la barre, les phases avec leurs dates ; au-dessus, où j'en suis.
 */
export function PhaseTimeline({ current, onWeek, compact = false }: { current: LocalDate; onWeek?: (w: LocalDate) => void; compact?: boolean }) {
  const weeks = usePlanWeeks();
  if (!weeks.length) return null;
  const idx = weeks.findIndex((w) => w.weekStart === current);
  const cur = weeks[idx];
  const groups = PHASES.map((p) => ({ p, list: weeks.filter((w) => w.phase === p) })).filter((g) => g.list.length);
  const posInPhase = cur ? weeks.filter((w) => w.phase === cur.phase && w.weekStart <= cur.weekStart).length : 0;
  const phaseLen = cur ? weeks.filter((w) => w.phase === cur.phase).length : 0;

  return (
    <section className="rounded-2xl bg-surface card-shadow px-3 pt-2.5 pb-2" aria-label="Phases du programme">
      <div className="flex items-baseline gap-2 mb-1.5">
        {cur ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full self-center" style={{ background: phaseColor(cur.phase) }} />
            <span className="font-display font-semibold">{PHASE_LABEL[cur.phase]}</span>
            <span className="text-xs text-muted">
              semaine {posInPhase}/{phaseLen} · {KIND_LABEL[cur.kind]}
            </span>
            <span className="ml-auto text-xs text-muted tabular-nums">
              {idx + 1}/{weeks.length}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">Hors programme</span>
        )}
      </div>
      <div className="flex gap-[3px] items-end" role="list">
        {weeks.map((w) => {
          const on = w.weekStart === current;
          const reduced = w.kind === 'light' || w.kind === 'travel';
          return (
            <button
              key={w.weekStart}
              role="listitem"
              onClick={() => onWeek?.(w.weekStart)}
              aria-label={`${PHASE_LABEL[w.phase]}, semaine du ${labelShort(w.weekStart)}, ${KIND_LABEL[w.kind]}`}
              className={`flex-1 rounded-[3px] transition-all ${on ? 'outline-2 outline-offset-1 outline-ink' : ''}`}
              style={{
                background: phaseColor(w.phase),
                height: on ? 18 : w.kind === 'block' ? 16 : reduced ? 8 : 12,
                opacity: reduced ? 0.55 : 1,
              }}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="flex gap-[3px] mt-1.5">
          {groups.map((g, i) => {
            // La dernière phase (affûtage, 2 semaines) est étroite : libellé aligné à droite, qui déborde vers la gauche.
            const last = i === groups.length - 1 && groups.length > 1;
            return (
              <div key={g.p} style={{ flex: g.list.length }} className={`min-w-0 ${last ? 'flex flex-col items-end' : ''}`}>
                <div className={`text-[10px] font-medium whitespace-nowrap ${last ? '' : 'truncate max-w-full'}`}>{PHASE_LABEL[g.p]}</div>
                <div className={`text-[10px] text-muted whitespace-nowrap ${last ? '' : 'truncate max-w-full'}`}>{labelShort(g.list[0].weekStart)}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
