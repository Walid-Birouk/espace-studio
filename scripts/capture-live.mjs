// Captures a live client site for its project page (run on a machine that can reach it).
//   node scripts/capture-live.mjs https://www.ghazeline.com ghazeline
//   node scripts/capture-live.mjs <url> <slug> --redact "First,Last"
//     --redact blurs every photo, every element whose text contains one of the words,
//     and contact links (email, phone, LinkedIn, GitHub, WhatsApp), for clients who stay anonymous.
// Writes full-page and first-screen PNGs, plus the fonts and colours the page uses, to
// src/content/projects/<slug>/raw/. make-assets turns them into the project's webp files.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [url, slug] = process.argv.slice(2);
const ri = process.argv.indexOf('--redact');
const redact = ri > 0 ? process.argv[ri + 1].split(',').map((w) => w.trim()).filter(Boolean) : null;
if (!url || !slug) throw new Error('usage: capture-live.mjs <url> <slug>');
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'src/content/projects', slug, 'raw');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const info = {};
for (const [name, viewport, scale] of [['desktop', { width: 1440, height: 900 }, 1], ['mobile', { width: 390, height: 844 }, 2]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale, locale: 'fr-FR' });
  // Some sites never go network-idle (analytics, video); fall back to a fixed wait.
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Close cookie banners so they don't cover the page.
  for (const label of [/tout refuser/i, /refuser/i, /reject all/i, /tout accepter/i, /accept all/i, /accepter/i, /^ok$/i]) {
    const btn = page.getByRole('button', { name: label }).or(page.getByRole('link', { name: label })).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await page.waitForTimeout(600); break; }
  }
  // Newsletter / discount pop-ups: Escape, then any visible close button.
  await page.keyboard.press('Escape').catch(() => {});
  for (const sel of ['[aria-label*="close" i]', '[aria-label*="fermer" i]', 'button.close', '.modal__close']) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) await el.click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
  await page.evaluate(() => document.fonts.ready);
  // Scroll through once so lazy images load, then back to the top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
  if (redact) {
    await page.evaluate((words) => {
      const blur = (el, px) => { el.style.filter = `blur(${px}px)`; el.setAttribute('data-redacted', ''); };
      document.querySelectorAll('img, picture, video, canvas, svg image').forEach((el) => blur(el, 18));
      document.querySelectorAll('*').forEach((el) => {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg.includes('url(') && el.children.length === 0) blur(el, 18);
      });
      const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode()); ) if (re.test(n.textContent) && n.parentElement) blur(n.parentElement, 7);
      document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"], a[href*="linkedin"], a[href*="github"], a[href*="wa.me"]').forEach((el) => blur(el, 7));
    }, redact);
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: join(OUT, `shot-${name}.png`) });
  await page.screenshot({ path: join(OUT, `page-${name}.png`), fullPage: true });
  if (name === 'desktop') {
    info.fonts = await page.evaluate(() => [...new Set([...document.querySelectorAll('h1,h2,h3,p,a,button,body')].map((e) => getComputedStyle(e).fontFamily))]);
    info.colors = await page.evaluate(() => {
      const c = {};
      for (const e of document.querySelectorAll('*')) {
        const s = getComputedStyle(e);
        for (const v of [s.color, s.backgroundColor]) if (v && !v.includes('0)')) c[v] = (c[v] || 0) + 1;
      }
      return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 20);
    });
    info.title = redact ? '(redacted)' : await page.title();
    info.images = redact ? [] : await page.evaluate(() => [...document.images].filter((i) => i.naturalWidth > 300).slice(0, 12).map((i) => ({ src: i.currentSrc, alt: i.alt })));
  }
  await page.close();
}
writeFileSync(join(OUT, 'info.json'), JSON.stringify(info, null, 2));
await browser.close();
console.log('captured', url, '->', OUT);
