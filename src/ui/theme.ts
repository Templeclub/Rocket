// Thème d'affichage : automatique (réglage du téléphone), clair ou sombre.
// Le choix est enregistré dans les paramètres (donc sauvegardé en ligne) et recopié en local
// pour être appliqué avant le premier affichage (voir index.html).

export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'ascese.theme';
const BAR: Record<'light' | 'dark', string> = { light: '#f2f4f7', dark: '#080c13' };

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function effectiveTheme(p: ThemePref): 'light' | 'dark' {
  return p === 'auto' ? (media().matches ? 'dark' : 'light') : p;
}

export function applyTheme(p: ThemePref): void {
  const root = document.documentElement;
  if (p === 'auto') delete root.dataset.theme;
  else root.dataset.theme = p;
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[effectiveTheme(p)]);
}

/** Suit le passage jour/nuit du téléphone quand le thème est automatique. */
export function watchSystemTheme(get: () => ThemePref): () => void {
  const m = media();
  const on = () => get() === 'auto' && applyTheme('auto');
  m.addEventListener('change', on);
  return () => m.removeEventListener('change', on);
}
