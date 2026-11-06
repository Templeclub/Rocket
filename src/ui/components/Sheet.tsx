import { useEffect, type ReactNode } from 'react';
import { IconX } from './Icons';

/** Panneau qui monte du bas de l'écran (atteignable au pouce). */
export function Sheet({
  title,
  onClose,
  children,
  full = false,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45" aria-label="Fermer" onClick={onClose} />
      <div
        className={`animate-sheet relative bg-surface rounded-t-3xl shadow-2xl flex flex-col w-full max-w-xl mx-auto ${
          full ? 'h-[94dvh]' : 'max-h-[85dvh]'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center gap-2 px-4 pt-2 pb-2">
          <div className="flex-1 font-display font-semibold text-lg truncate">{title}</div>
          <button onClick={onClose} className="p-2 -mr-2 text-muted" aria-label="Fermer">
            <IconX />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3 pb-safe">{footer}</div>}
      </div>
    </div>
  );
}
