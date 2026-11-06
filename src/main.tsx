import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import './ui/install';
import { App } from './ui/App';
import { ensureSeeded } from './db/db';

registerSW({ immediate: true });

// Demande un stockage persistant pour que le navigateur n'efface pas les données.
navigator.storage?.persist?.().catch(() => {});

ensureSeeded().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
