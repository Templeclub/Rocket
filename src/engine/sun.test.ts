import { describe, expect, it } from 'vitest';
import { daylight, fitsInDaylight, formatClock } from './sun';

describe('soleil', () => {
  it('Paris au solstice d’été : lever ~05h47, coucher ~21h58 (heure d’été)', () => {
    const d = daylight('2026-06-21', 48.8566, 2.3522);
    expect(Math.abs(d.sunrise - (5 * 60 + 47))).toBeLessThanOrEqual(3);
    expect(Math.abs(d.sunset - (21 * 60 + 58))).toBeLessThanOrEqual(3);
  });
  it('Bordeaux : l’aube civile précède le lever d’environ 30 minutes', () => {
    const d = daylight('2026-11-09');
    expect(d.sunrise - d.dawn).toBeGreaterThan(25);
    expect(d.sunrise - d.dawn).toBeLessThan(40);
  });
  it('7h30–8h30 en semaine : faisable début novembre et à partir de fin février, pas de fin novembre à mi-février', () => {
    const at = (date: string) => fitsInDaylight(date, 450, 60);
    expect(at('2026-12-21')).toBe(false);
    expect(at('2027-01-15')).toBe(false);
    expect(at('2027-03-05')).toBe(true);
    expect(at('2027-03-30')).toBe(true);
    expect(at('2026-11-09')).toBe(true);
    expect(at('2026-11-20')).toBe(false);
  });
  it('format horaire', () => {
    expect(formatClock(450)).toBe('07h30');
  });
});
