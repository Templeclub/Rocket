// Génère les icônes PNG de la PWA à partir de public/favicon.svg (utilise Playwright/Chromium).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, maskable = false) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#fff6e5;display:grid;place-items:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg.replace('rx="112"', 'rx="0"')}</div></div>`
    : svg;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.addStyleTag({ content: `svg{width:100%;height:100%;display:block} body>svg{width:${size}px;height:${size}px}` });
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: !maskable });
}
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', true);
await browser.close();
console.log('icônes générées');
