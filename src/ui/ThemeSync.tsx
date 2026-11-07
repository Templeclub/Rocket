import { useEffect, useRef } from 'react';
import { useSettings } from './hooks';
import { applyTheme, watchSystemTheme, type ThemePref } from './theme';

/** Applique le thème des paramètres (y compris après une restauration) et suit le téléphone en automatique. */
export function ThemeSync() {
  const pref: ThemePref = useSettings().theme ?? 'auto';
  const ref = useRef(pref);
  ref.current = pref;
  useEffect(() => applyTheme(pref), [pref]);
  useEffect(() => watchSystemTheme(() => ref.current), []);
  return null;
}
