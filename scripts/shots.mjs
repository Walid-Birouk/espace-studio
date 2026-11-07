// Screenshots for review: home + a work page, FR/EN, 1440 and 390, at several scroll depths.
//   npm run build && node scripts/shots.mjs [label]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}shots/${process.argv[2] ?? 'latest'}`;
mkdirSync(OUT, { recursive: true });
const port = 4330, base = `http://localhost:${port}`;
const server = spawn('npx', ['astro', 'preview', '--port', String(port)], { cwd: ROOT, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const lang of ['fr', 'en']) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(`${lang} ${w}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${lang} ${w} console: ${m.text()}`); });
      await page.goto(`${base}${lang === 'en' ? '/en/' : '/'}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const stops = w > 900 ? [0, 0.6, 1.0, 1.25, 2.1, 2.6, 3.0, 3.4, 3.7, 4.05] : [0, 0.9, 1.8, 2.8];
      for (const vh of stops) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(vh * h));
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/${lang}-${w}-at${String(vh).replace('.', '_')}vh.png` });
      }
      if (w < 900) await page.screenshot({ path: `${OUT}/${lang}-${w}-full.png`, fullPage: true });
      console.log(lang, w, 'height', total);
      await page.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/fr-1440-reduced-full.png`, fullPage: true });
  await page.close();
} finally {
  await browser.close();
  server.kill();
}
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
