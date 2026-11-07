import { useEffect, useRef, useState } from 'react';
import * as A from '../db/actions';
import { db } from '../db/db';
import { withDefaults } from '../engine/zones';
import { Flame, LevelBadge } from './components/GameWidgets';
import { celebrate, setFeedbackEnabled, type Celebration } from './feedback';
import { useSettings } from './hooks';
import { useGame } from './useGame';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Couche d'animation : éclat discret pour une séance faite, carte pour une semaine tenue ou un niveau. */
export function CelebrationLayer() {
  const [c, setC] = useState<(Celebration & { id: number }) | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const on = (e: Event) => {
      if (reduced() && (e as CustomEvent<Celebration>).detail.kind === 'done') return;
      const id = ++seq.current;
      setC({ ...(e as CustomEvent<Celebration>).detail, id });
      window.setTimeout(() => setC((x) => (x?.id === id ? null : x)), (e as CustomEvent<Celebration>).detail.kind === 'done' ? 900 : 2800);
    };
    window.addEventListener('ascese:celebrate', on);
    return () => window.removeEventListener('ascese:celebrate', on);
  }, []);
  if (!c) return null;
  if (c.kind === 'done') {
    return (
      <div className="fixed inset-0 z-[60] pointer-events-none grid place-items-center" aria-hidden="true">
        <div className="celebrate-burst">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-46px)` }} />
          ))}
          <svg viewBox="0 0 24 24" className="w-14 h-14 text-white relative" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 top-24 z-[60] px-4 pointer-events-none" role="status">
      <div className="celebrate-card mx-auto max-w-sm rounded-3xl bg-sport shadow-2xl p-4 flex items-center gap-3">
        {c.kind === 'level' ? <LevelBadge index={5} size={52} /> : <Flame className="w-12 h-12" />}
        <div>
          <div className="font-display text-xl font-black italic leading-tight">{c.title}</div>
          {c.subtitle && <div className="text-sm opacity-90">{c.subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

/** Fête une seule fois chaque nouveau niveau et chaque nouvelle semaine tenue (mémorisé dans les paramètres). */
export function GameWatcher() {
  const g = useGame();
  const settings = useSettings();
  useEffect(() => setFeedbackEnabled(settings.feedback !== false), [settings.feedback]);
  useEffect(() => {
    if (!g) return;
    (async () => {
      const s = withDefaults(await db.settings.get('app'));
      const now = { level: g.xp.level.index, held: g.held.held };
      const seen = s.gameSeen;
      if (!seen) {
        await A.saveSettings({ ...s, gameSeen: now });
        return;
      }
      if (now.level > seen.level) celebrate({ kind: 'level', title: `Niveau ${g.xp.level.name}`, subtitle: `${g.xp.total.toLocaleString('fr-FR')} pts · continue comme ça` });
      else if (now.held > seen.held) celebrate({ kind: 'week', title: 'Semaine tenue', subtitle: `${g.held.streak} d’affilée · prêt à ${g.readiness.percent} %` });
      if (now.level !== seen.level || now.held !== seen.held) await A.saveSettings({ ...s, gameSeen: now });
    })();
  }, [g?.xp.level.index, g?.held.held]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
