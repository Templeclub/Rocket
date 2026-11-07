// Carte de fin de semaine à partager (image PNG dessinée sur le téléphone, sans librairie).

import { db } from '../../db/db';
import { addDays, diffDays, labelWeek, todayLocal } from '../../engine/dates';
import type { GameState } from '../../engine/gamification';
import { summarize } from '../../engine/stats';
import { formatHours } from '../../engine/zones';

const W = 1080;
const H = 1350;

export async function renderWeekCard(g: GameState, weekStart: string): Promise<Blob> {
  const end = addDays(weekStart, 7);
  const [sessions, activities, goals] = await Promise.all([
    db.sessions.where('date').between(weekStart, end, true, false).toArray(),
    db.activities.where('date').between(weekStart, end, true, false).toArray(),
    db.goals.toArray(),
  ]);
  const sum = summarize(sessions, activities, weekStart);
  const goal = goals.find((x) => x.kind === 'main');
  const done = sessions.filter((s) => s.status === 'done').length;
  const planned = sessions.filter((s) => s.status !== 'cancelled').length;
  await Promise.all([document.fonts.load('900 120px "Outfit Variable"'), document.fonts.load('600 40px "Inter Variable"')]).catch(() => {});

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f04a12');
  bg.addColorStop(1, '#e01e4f');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  // Traits de vitesse
  x.strokeStyle = 'rgba(255,255,255,0.12)';
  x.lineWidth = 70;
  x.lineCap = 'round';
  for (const o of [0, 220, 440]) {
    x.beginPath();
    x.moveTo(560 + o, 560);
    x.lineTo(1120 + o, -60);
    x.stroke();
  }
  x.fillStyle = '#fff';
  const display = (size: number, weight = 900, italic = true) => `${italic ? 'italic ' : ''}${weight} ${size}px "Outfit Variable", system-ui, sans-serif`;
  const text = (size: number, weight = 600) => `${weight} ${size}px "Inter Variable", system-ui, sans-serif`;

  x.font = display(44, 800);
  x.fillText('ASCÈSE', 80, 120);
  x.font = text(40, 500);
  x.globalAlpha = 0.9;
  x.fillText(`Semaine du ${labelWeek(weekStart)}`, 80, 190);
  x.globalAlpha = 1;

  x.font = display(230);
  x.fillText(formatHours(sum.endurance.doneH), 72, 460);
  x.font = text(46, 600);
  x.fillText(`d’endurance sur ${formatHours(sum.endurance.plannedH)} prévues`, 80, 540);
  x.font = text(40, 500);
  x.globalAlpha = 0.9;
  x.fillText(`${done} séance${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${planned}`, 80, 600);
  x.globalAlpha = 1;

  // Trois tuiles
  const tiles: [string, string][] = [
    [`${g.readiness.percent} %`, 'prêt pour le Desertus'],
    [`${g.held.streak}`, `semaine${g.held.streak > 1 ? 's' : ''} tenue${g.held.streak > 1 ? 's' : ''}`],
    [g.xp.level.name, `${g.xp.total.toLocaleString('fr-FR')} pts`],
  ];
  const ty = 720;
  tiles.forEach(([big, small], i) => {
    const tx = 80 + i * 315;
    x.fillStyle = 'rgba(255,255,255,0.16)';
    x.beginPath();
    x.roundRect(tx, ty, 290, 300, 36);
    x.fill();
    x.fillStyle = '#fff';
    // Taille ajustée pour tenir dans la tuile.
    let size = 96;
    x.font = display(size, 900);
    while (size > 40 && x.measureText(big).width > 236) {
      size -= 4;
      x.font = display(size, 900);
    }
    wrap(x, big, tx + 28, ty + 70 + Math.min(size, 96) * 0.75, 240, size * 1.05);
    x.font = text(32, 500);
    x.globalAlpha = 0.9;
    wrap(x, small, tx + 28, ty + 250, 240, 38);
    x.globalAlpha = 1;
  });

  if (goal) {
    const days = diffDays(goal.date, todayLocal());
    x.font = display(64, 900);
    x.fillText(`J-${days}`, 80, 1200);
    x.font = text(40, 600);
    x.fillText(`${goal.name}${goal.distanceKm ? ` · ${goal.distanceKm.toLocaleString('fr-FR')} km` : ''}`, 80 + x.measureText(`J-${days}`).width + 70, 1196);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image non générée'))), 'image/png'));
}

function wrap(x: CanvasRenderingContext2D, s: string, left: number, top: number, max: number, lh: number) {
  const words = s.split(' ');
  let line = '';
  let y = top;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (x.measureText(t).width > max && line) {
      x.fillText(line, left, y);
      line = w;
      y += lh;
    } else line = t;
  }
  x.fillText(line, left, y);
}

/** Partage l'image (menu de partage Android) ou la télécharge si le partage n'est pas possible. */
export async function shareWeekCard(g: GameState, weekStart: string): Promise<'shared' | 'download'> {
  const blob = await renderWeekCard(g, weekStart);
  const file = new File([blob], `ascese-semaine-${weekStart}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Ma semaine Ascèse' });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'download';
}
