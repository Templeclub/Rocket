import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, cap, labelMonth, labelWeek, startOfMonth, startOfWeek, todayLocal } from '../engine/dates';
import type { LocalDate } from '../engine/types';
import { IconLeft, IconMonth, IconRight, IconSettings, IconWeek } from './components/Icons';
import { CreateSheet, PostponeSheet, SwapSheet } from './components/QuickSheets';
import { ToastProvider } from './components/Toast';
import { NavCtx, type Nav, type Overlay } from './hooks';
import { MonthView } from './views/MonthView';
import { WeekView } from './views/WeekView';
import { ActivitySheet, NewSessionSheet, SessionSheet, TemplateSheet } from './views/SessionSheet';
import { SettingsView } from './views/SettingsView';

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
    case 'postpone':
      return <PostponeSheet id={o.id} />;
    case 'swap':
      return <SwapSheet id={o.id} />;
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
        <div className="min-h-dvh max-w-xl mx-auto flex flex-col">
          <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur px-4 pt-3 pb-2">
            <h1 className="text-xl font-bold">{cap(title)}</h1>
          </header>
          <main className="flex-1 px-3 pb-40">
            {view === 'week' && <WeekView weekStart={weekStart} focusDate={focusDate} />}
            {view === 'month' && <MonthView monthStart={monthStart} />}
            {view === 'settings' && <SettingsView />}
          </main>

          <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe">
            <div className="max-w-xl mx-auto">
              {view !== 'settings' && (
                <div className="flex items-center justify-between px-2 pt-1.5">
                  <button onClick={() => shift(-1)} className="w-12 h-11 grid place-items-center rounded-full active:bg-raised" aria-label="Précédent">
                    <IconLeft />
                  </button>
                  <button onClick={toToday} className="h-11 px-4 rounded-full text-sm font-medium active:bg-raised">
                    {view === 'week' ? labelWeek(weekStart) : cap(labelMonth(monthStart))} · aujourd’hui
                  </button>
                  <button onClick={() => shift(1)} className="w-12 h-11 grid place-items-center rounded-full active:bg-raised" aria-label="Suivant">
                    <IconRight />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-3">
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
                    className={`h-14 flex flex-col items-center justify-center gap-0.5 text-xs ${view === v ? 'text-accent font-semibold' : 'text-muted'}`}
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

