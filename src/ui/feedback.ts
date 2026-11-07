// Petits moments de satisfaction : vibration et animation (désactivables, et sans animation si le téléphone le demande).

export type CelebrationKind = 'done' | 'week' | 'level';

export interface Celebration {
  kind: CelebrationKind;
  title?: string;
  subtitle?: string;
}

let enabled = true;
export function setFeedbackEnabled(v: boolean) {
  enabled = v;
}

const PATTERN: Record<CelebrationKind, number | number[]> = { done: 25, week: [30, 60, 30], level: [40, 70, 40, 70, 80] };

export function celebrate(c: Celebration): void {
  if (!enabled) return;
  try {
    // Chrome refuse de vibrer avant le premier tap : on ne vibre qu'après une interaction.
    const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
    if (active) navigator.vibrate?.(PATTERN[c.kind]);
  } catch {
    /* vibration indisponible */
  }
  window.dispatchEvent(new CustomEvent<Celebration>('ascese:celebrate', { detail: c }));
}
