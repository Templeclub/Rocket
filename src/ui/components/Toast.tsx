import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CONFIG } from '../../engine/config';

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
interface ToastState {
  id: number;
  message: string;
  actions: ToastAction[];
}

type Show = (message: string, ...actions: ToastAction[]) => void;
const Ctx = createContext<Show>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const show: Show = useCallback((message, ...actions) => {
    window.clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ id, message, actions });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), CONFIG.ui.undoToastMs);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className="fixed inset-x-0 bottom-36 z-50 px-3 pointer-events-none" role="status">
          <div className="pointer-events-auto mx-auto max-w-xl flex items-center gap-3 rounded-2xl bg-ink text-bg px-4 py-3 shadow-xl">
            <span className="flex-1 text-sm">{toast.message}</span>
            {toast.actions.map((a) => (
              <button
                key={a.label}
                className="font-semibold text-sm text-accent px-1"
                onClick={async () => {
                  setToast(null);
                  await a.run();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
