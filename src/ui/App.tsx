import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, cap, labelMonth, labelWeek, startOfMonth, startOfWeek, todayLocal } from '../engine/dates';
import type { LocalDate } from '../engine/types';
import { IconLeft, IconMonth, IconRight, IconSettings, IconWeek } from './components/Icons';
import { ActionsSheet, CreateSheet } from './components/QuickSheets';
import { ParisSheet, ReplanSheet } from './components/WeekEvaluation';
import { ToastProvider } from './components/Toast';
import { StravaAutoSync } from './StravaAutoSync';
import { CloudAutoBackup } from './CloudAutoBackup';
import { ThemeSync } from './ThemeSync';
import { CelebrationLayer, GameWatcher } from './Celebrations';
import { LogoMark } from './components/Logo';
import { ProgressSheet } from './components/Progress';
import { LongRideSheet } from './components/LongRide';
import { NavCtx, type Nav, type Overlay } from './hooks';
import { MonthView } from './views/MonthView';
import { WeekView } from './views/WeekView';
import { ActivitySheet, NewSessionSheet, SessionSheet, TemplateSheet } from './views/SessionSheet';
import { ReviewSheet } from './views/ReviewSheet';
import { SettingsSheet, SettingsView, type SettingsSection } from './views/SettingsView';

type View = 'week' | 'month' | 'settings';

function OverlayView({ o }: { o: Overlay }) {
  switch (o.kind) {
    case 'create':
      return <CreateSheet date={o.date} />;
    case 'session':
      return <SessionSheet id={o.id} />;
    case 'newSession':
      return <NewSessionSheet date={o.date} />;
    case 'template':
      return <TemplateSheet id={o.id} />;
    case 'activity':
      return <ActivitySheet id={o.id} sessionId={o.sessionId} date={o.date} />;
    case 'actions':
    case 'postpone':
    case 'swap':
      return <ActionsSheet id={o.id} />;
    case 'replan':
      return <ReplanSheet weekStart={o.weekStart} />;
    case 'progress':
      return <ProgressSheet />;
    case 'longride':
      return <LongRideSheet />;
    case 'paris':
      return <ParisSheet weekStart={o.weekStart} />;
    case 'settings':
      return <SettingsSheet section={o.section as SettingsSection} />;
    case 'review':
      return <ReviewSheet weekStart={o.weekStart} />;
  }
}

export function App() {
  const [view, setView] = useState<View>('week');
  const [weekStart, setWeekStart] = useState<LocalDate>(() => startOfWeek(todayLocal()));
  const [monthStart, setMonthStart] = useState<LocalDate>(() => startOfMonth(todayLocal()));
  const [focusDate, setFocusDate] = useState<LocalDate | undefined>();
  const [stack, setStack] = useState<Overlay[]>([]);
  const depth = useRef(0);
  depth.current = stack.length;

  // Le bouton retour d'Android ferme le panneau ouvert.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const d = typeof e.state?.depth === 'number' ? e.state.depth : 0;
      setStack((s) => s.slice(0, d));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = useCallback((o: Overlay) => {
    history.pushState({ depth: depth.current + 1 }, '');
    depth.current += 1;
    setStack((s) => [...s, o]);
  }, []);
  const replace = useCallback((o: Overlay) => setStack((s) => [...s.slice(0, -1), o]), []);
  const close = useCallback(() => {
    if (depth.current > 0) history.back();
  }, []);
  const goWeekOf = useCallback((d: LocalDate) => {
    if (depth.current > 0) history.go(-depth.current);
    setWeekStart(startOfWeek(d));
    setFocusDate(d);
    setView('week');
  }, []);
  const nav: Nav = useMemo(() => ({ open, replace, close, goWeekOf }), [open, replace, close, goWeekOf]);

  const shift = (n: number) => {
    setFocusDate(undefined);
    if (view === 'week') setWeekStart((w) => addDays(w, 7 * n));
    else setMonthStart((m) => addMonths(m, n));
  };
  const toToday = () => {
    const t = todayLocal();
    setFocusDate(t);
    setWeekStart(startOfWeek(t));
    setMonthStart(startOfMonth(t));
  };

  const title = view === 'week' ? `Semaine ${labelWeek(weekStart)}` : view === 'month' ? labelMonth(monthStart) : 'Paramètres';

  return (
    <NavCtx.Provider value={nav}>
      <ToastProvider>
        <StravaAutoSync />
        <CloudAutoBackup />
        <ThemeSync />
        <GameWatcher />
        <CelebrationLayer />
        <div className="min-h-dvh max-w-xl mx-auto flex flex-col">
          <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex items-end gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{cap(title)}</h1>
            <span className="ml-auto mb-1 flex items-center gap-1.5 text-ink">
              <LogoMark size={18} />
              <span className="font-display text-sm font-extrabold italic tracking-[0.18em] text-sport uppercase">Ascèse</span>
            </span>
          </header>
          <main className="flex-1 px-3 pb-44">
            {view === 'week' && <WeekView weekStart={weekStart} focusDate={focusDate} />}
            {view === 'month' && <MonthView monthStart={monthStart} />}
            {view === 'settings' && <SettingsView />}
          </main>

          <nav className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pointer-events-none">
            <div className="max-w-xl mx-auto space-y-2 pointer-events-auto">
              {view !== 'settings' && (
                <div className="mx-auto w-fit flex items-center gap-1 rounded-full bg-surface/95 backdrop-blur card-shadow border border-line p-1">
                  <button onClick={() => shift(-1)} className="w-10 h-10 grid place-items-center rounded-full active:bg-raised" aria-label="Précédent">
                    <IconLeft />
                  </button>
                  <button onClick={toToday} className="h-10 px-3 rounded-full text-sm font-medium active:bg-raised tabular-nums">
                    {view === 'week' ? labelWeek(weekStart) : cap(labelMonth(monthStart))}
                  </button>
                  <button onClick={() => shift(1)} className="w-10 h-10 grid place-items-center rounded-full active:bg-raised" aria-label="Suivant">
                    <IconRight />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-3 rounded-3xl bg-nav text-white p-1.5 shadow-xl shadow-black/20 ring-1 ring-white/5">
                {(
                  [
                    ['week', 'Semaine', <IconWeek key="w" />],
                    ['month', 'Mois', <IconMonth key="m" />],
                    ['settings', 'Paramètres', <IconSettings key="s" />],
                  ] as const
                ).map(([v, label, icon]) => (
                  <button
                    key={v}
                    onClick={() => {
                      setFocusDate(undefined);
                      setView(v);
                    }}
                    className={`h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                      view === v ? 'bg-sport shadow-lg shadow-black/20' : 'text-white/60'
                    }`}
                    aria-current={view === v ? 'page' : undefined}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {stack.map((o, i) => (
            <OverlayView key={i} o={o} />
          ))}
        </div>
      </ToastProvider>
    </NavCtx.Provider>
  );
}

