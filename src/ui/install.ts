import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

// L'événement peut arriver avant l'affichage des paramètres : on le capture dès le chargement.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((l) => l());
});

export function useInstallPrompt(): BeforeInstallPromptEvent | null {
  const [evt, setEvt] = useState(deferred);
  useEffect(() => {
    const l = () => setEvt(deferred);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return evt;
}
