// Generates the per-project process assets from each project's meta.json.
//
//   node scripts/make-assets.mjs fragments   placeholder photos, type specimen, wireframes
//   node scripts/make-assets.mjs fragments <slug>,<slug>   only these projects
//   node scripts/make-assets.mjs pages       screenshots of /work/<slug>/preview/ (needs `npm run build` first)
//
// Placeholder photos are abstract on purpose: they are swapped for real or licensed
// photos later by overwriting frag-*.webp. No text is baked into them.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const PROJECTS = join(ROOT, 'src/content/projects');
// Optional second argument: comma-separated slugs, to (re)make only those projects.
const only = process.argv[3]?.split(',');
const slugs = readdirSync(PROJECTS).filter((d) => existsSync(join(PROJECTS, d, 'meta.json')) && (!only || only.includes(d)));
const load = (slug) => JSON.parse(readFileSync(join(PROJECTS, slug, 'meta.json'), 'utf8'));

const mode = process.argv[2] ?? 'fragments';

// Deterministic pseudo-random so re-runs give the same images.
function rng(seed) {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function photoHtml(frag, slug, W) {
  const H = Math.round(W * frag.ratio);
  const [a, b, c = b] = frag.tones;
  const r = rng(slug + frag.src);
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const col = [b, c, a][i % 3];
    return `radial-gradient(${Math.round(30 + r() * 50)}% ${Math.round(30 + r() * 50)}% at ${Math.round(r() * 100)}% ${Math.round(r() * 100)}%, ${col}${i < 2 ? 'ee' : '99'} 0%, transparent 70%)`;
  }).join(',');
  return `<!doctype html><html><body style="margin:0">
  <div id="f" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${blobs},${a}">
    <div style="position:absolute;inset:-10%;background:linear-gradient(${Math.round(r() * 180)}deg, transparent 40%, ${c}55 50%, transparent 60%);filter:blur(18px)"></div>
    <svg width="${W}" height="${H}" style="position:absolute;inset:0;mix-blend-mode:overlay;opacity:.55">
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width="100%" height="100%" filter="url(#g)"/>
    </svg>
    <div style="position:absolute;inset:0;box-shadow:inset 0 0 ${Math.round(W / 5)}px rgba(0,0,0,.28)"></div>
  </div></body></html>`;
}

// Same rules as src/i18n/typo.ts: keep "7 h 30", "2,80 €" and "four :" together.
const nb = (t) =>
  t
    .replace(/(\d) (?=h\b|€|%)/g, '$1\u00a0')
    .replace(/\bh (?=\d)/g, 'h\u00a0')
    .replace(/ ([:;?!»])/g, '\u202f$1')
    .replace(/« /g, '«\u202f');

function specimenHtml(meta) {
  const fam = (f) => f.replace(/ /g, '+');
  const [ground, , , , ink] = [meta.palette[2]?.hex ?? '#fff', 0, 0, 0, meta.palette.at(-1).hex];
  const accent = meta.palette[0].hex;
  return `<!doctype html><html><head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fam(meta.type.display.family)}&family=${fam(meta.type.body.family)}:wght@400;600&display=block">
  </head><body style="margin:0">
  <div id="f" style="width:640px;height:800px;box-sizing:border-box;padding:48px;background:${ground};color:${ink};display:flex;flex-direction:column;justify-content:space-between">
    <div style="font-family:'${meta.type.display.family}',serif;font-size:300px;line-height:.85;color:${accent}">Aa</div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="font-family:'${meta.type.display.family}',serif;font-size:46px;line-height:1.05">${nb(meta.type.sample)}</div>
      <div style="font-family:'${meta.type.body.family}',sans-serif;font-size:22px;line-height:1.5">${meta.type.display.family} / ${meta.type.body.family}</div>
    </div>
  </div></body></html>`;
}

// ---- Wireframes: one spec per project, boxes in a W×H grid ----
// kind: box | img (crossed) | btn (rounded) | text (lines) | dark (filled panel outline)
const WF = {
  'repair-ninja': {
    desktop: { W: 1440, H: 2600, boxes: [
      ['dark', 0, 0, 1440, 30], ['dark', 0, 30, 1440, 110], ['text', 360, 76, 520, 14], ['box', 1060, 66, 280, 34],
      ['text', 90, 260, 520, 260], ['btn', 90, 560, 150, 44], ['btn', 256, 560, 130, 44], ['img', 760, 230, 590, 380],
      ['dark', 90, 760, 1260, 230], ['box', 90, 1040, 1260, 140],
      ['dark', 0, 1240, 1440, 260], ['box', 130, 1330, 280, 120], ['box', 430, 1330, 280, 120], ['box', 730, 1330, 280, 120], ['box', 1030, 1330, 280, 120],
      ['text', 130, 1580, 320, 40], ['img', 130, 1650, 280, 380], ['img', 430, 1650, 280, 380], ['img', 730, 1650, 280, 380], ['img', 1030, 1650, 280, 380],
      ['box', 130, 2110, 580, 300], ['box', 730, 2110, 580, 300], ['dark', 0, 2470, 1440, 130],
    ] },
    mobile: { W: 390, H: 1900, boxes: [
      ['dark', 0, 0, 390, 56], ['dark', 0, 56, 390, 96], ['box', 300, 84, 74, 34],
      ['text', 16, 200, 330, 200], ['btn', 16, 430, 170, 46], ['btn', 196, 430, 150, 46], ['box', 16, 500, 358, 80],
      ['img', 16, 620, 358, 280], ['dark', 16, 940, 358, 220], ['box', 16, 1190, 358, 140],
      ['img', 16, 1370, 170, 240], ['img', 204, 1370, 170, 240], ['dark', 0, 1650, 390, 250],
    ] },
  },
  'cafe-sillage': {
    desktop: { W: 1440, H: 2200, boxes: [
      ['text', 60, 30, 180, 28], ['text', 860, 36, 360, 16], ['btn', 1240, 24, 140, 40],
      ['img', 40, 96, 1360, 640], ['text', 100, 520, 560, 90], ['btn', 100, 640, 240, 52],
      ['box', 60, 800, 420, 200], ['box', 510, 800, 420, 200], ['box', 960, 800, 420, 200],
      ['dark', 40, 1060, 1360, 540], ['text', 120, 1140, 520, 380], ['text', 800, 1140, 520, 380],
      ['text', 60, 1680, 520, 200], ['box', 760, 1660, 620, 320], ['btn', 1140, 1910, 220, 50],
      ['text', 60, 2060, 1320, 80],
    ] },
    mobile: { W: 390, H: 1600, boxes: [
      ['text', 16, 20, 120, 20], ['box', 334, 14, 40, 32],
      ['img', 12, 64, 366, 380], ['text', 28, 300, 300, 70], ['btn', 16, 464, 358, 52],
      ['text', 16, 540, 358, 120], ['dark', 12, 690, 366, 480], ['text', 36, 730, 318, 400],
      ['box', 16, 1200, 358, 260], ['text', 16, 1490, 358, 80],
    ] },
  },
  'fournil-aubepine': {
    desktop: { W: 1440, H: 2000, boxes: [
      ['text', 60, 30, 220, 28], ['text', 900, 36, 320, 16], ['btn', 1240, 24, 140, 40],
      ['text', 60, 140, 560, 120], ['box', 60, 300, 620, 420], ['text', 100, 340, 540, 340], ['img', 740, 120, 640, 620],
      ['img', 60, 820, 420, 320], ['img', 510, 820, 420, 320], ['img', 960, 820, 420, 320],
      ['text', 60, 1160, 420, 60], ['text', 510, 1160, 420, 60], ['text', 960, 1160, 420, 60],
      ['dark', 40, 1300, 1360, 300], ['text', 120, 1380, 640, 140], ['btn', 1080, 1420, 240, 56],
      ['text', 60, 1680, 640, 180], ['img', 760, 1660, 620, 220], ['text', 60, 1920, 1320, 50],
    ] },
    mobile: { W: 390, H: 1500, boxes: [
      ['text', 16, 20, 140, 20], ['box', 334, 14, 40, 32],
      ['text', 16, 80, 300, 70], ['box', 16, 170, 358, 300], ['text', 36, 196, 318, 250],
      ['img', 16, 500, 358, 260], ['btn', 16, 784, 358, 52],
      ['img', 16, 860, 170, 160], ['img', 204, 860, 170, 160], ['dark', 12, 1060, 366, 220], ['text', 16, 1310, 358, 150],
    ] },
  },
  'atelier-lin': {
    desktop: { W: 1440, H: 1900, boxes: [
      ['text', 620, 30, 200, 28], ['text', 60, 36, 240, 16], ['btn', 1240, 24, 140, 40],
      ['text', 120, 180, 640, 220], ['text', 120, 430, 520, 60],
      ['box', 860, 160, 460, 420], ['btn', 900, 220, 380, 60], ['btn', 900, 300, 380, 60], ['btn', 900, 380, 380, 60], ['btn', 900, 480, 380, 64],
      ['text', 120, 700, 560, 440], ['text', 760, 700, 560, 440],
      ['img', 40, 1220, 440, 360], ['img', 500, 1220, 440, 360], ['img', 960, 1220, 440, 360],
      ['text', 120, 1660, 640, 120], ['text', 60, 1830, 1320, 40],
    ] },
    mobile: { W: 390, H: 1450, boxes: [
      ['text', 135, 20, 120, 20], ['box', 334, 14, 40, 32],
      ['text', 16, 90, 330, 120], ['box', 16, 240, 358, 330], ['btn', 32, 270, 326, 54], ['btn', 32, 340, 326, 54], ['btn', 32, 410, 326, 54], ['btn', 32, 490, 326, 56],
      ['text', 16, 610, 358, 420], ['img', 16, 1060, 358, 260], ['text', 16, 1350, 358, 70],
    ] },
  },
  'cave-brindille': {
    desktop: { W: 1440, H: 2100, boxes: [
      ['dark', 0, 0, 1440, 76], ['text', 60, 28, 200, 22], ['text', 820, 32, 380, 14], ['btn', 1220, 18, 160, 40],
      ['text', 60, 150, 760, 300], ['text', 60, 480, 560, 60], ['dark', 900, 200, 480, 380], ['text', 940, 240, 400, 300],
      ['img', 60, 660, 420, 316], ['img', 510, 660, 420, 316], ['img', 960, 660, 420, 316],
      ['text', 60, 1000, 420, 70], ['text', 510, 1000, 420, 70], ['text', 960, 1000, 420, 70],
      ['dark', 0, 1140, 1440, 560], ['text', 60, 1220, 360, 50], ['text', 60, 1300, 1100, 320], ['text', 1240, 1300, 140, 320],
      ['text', 60, 1780, 380, 110], ['text', 510, 1780, 380, 110], ['text', 960, 1780, 380, 110], ['text', 60, 2020, 1320, 40],
    ] },
    mobile: { W: 390, H: 1700, boxes: [
      ['dark', 0, 0, 390, 60], ['text', 16, 22, 140, 16], ['btn', 250, 12, 124, 36],
      ['text', 16, 90, 340, 200], ['text', 16, 310, 330, 70], ['dark', 16, 410, 358, 250], ['text', 40, 440, 310, 190],
      ['img', 16, 690, 358, 268], ['text', 16, 970, 300, 60], ['dark', 0, 1060, 390, 400], ['text', 16, 1100, 358, 320],
      ['text', 16, 1500, 358, 160],
    ] },
  },
  'ortie-pivoine': {
    desktop: { W: 1440, H: 2300, boxes: [
      ['dark', 0, 0, 1440, 36], ['text', 60, 60, 260, 26], ['text', 900, 66, 300, 14], ['btn', 1220, 52, 160, 44],
      ['img', 56, 140, 700, 875], ['text', 820, 380, 540, 200], ['text', 820, 600, 480, 60],
      ['btn', 820, 690, 540, 70], ['btn', 820, 770, 540, 70], ['btn', 820, 850, 540, 70],
      ['box', 0, 1100, 1440, 420], ['text', 60, 1220, 520, 180], ['text', 700, 1200, 600, 30], ['btn', 700, 1260, 90, 44], ['btn', 800, 1260, 90, 44], ['btn', 900, 1260, 90, 44], ['btn', 700, 1340, 240, 52],
      ['text', 60, 1590, 500, 40], ['img', 56, 1660, 430, 430], ['img', 505, 1660, 430, 430], ['img', 954, 1660, 430, 430],
      ['dark', 0, 2180, 1440, 120],
    ] },
    mobile: { W: 390, H: 1800, boxes: [
      ['dark', 0, 0, 390, 34], ['text', 16, 54, 160, 20], ['btn', 250, 44, 124, 40],
      ['img', 16, 104, 358, 448], ['text', 16, 576, 320, 120], ['btn', 16, 720, 358, 60], ['btn', 16, 790, 358, 60], ['btn', 16, 860, 358, 60],
      ['box', 0, 960, 390, 380], ['text', 16, 1000, 330, 140], ['btn', 16, 1170, 80, 40], ['btn', 106, 1170, 80, 40], ['btn', 196, 1170, 80, 40], ['btn', 16, 1250, 358, 52],
      ['img', 16, 1380, 114, 114], ['img', 138, 1380, 114, 114], ['img', 260, 1380, 114, 114], ['dark', 0, 1640, 390, 160],
    ] },
  },
  'cremerie-basalte': {
    desktop: { W: 1440, H: 2050, boxes: [
      ['dark', 0, 0, 1440, 820], ['text', 60, 28, 220, 22], ['text', 820, 32, 400, 14], ['btn', 1220, 18, 160, 40],
      ['text', 60, 160, 700, 340], ['text', 60, 540, 560, 80], ['text', 860, 160, 520, 24], ['text', 860, 210, 520, 520],
      ['text', 60, 960, 520, 220], ['box', 720, 900, 660, 340], ['btn', 1040, 930, 300, 44], ['box', 760, 1000, 520, 110], ['btn', 760, 1160, 580, 46],
      ['img', 60, 1320, 420, 336], ['img', 510, 1320, 420, 336], ['img', 960, 1320, 420, 336],
      ['text', 60, 1680, 420, 70], ['text', 510, 1680, 420, 70], ['text', 960, 1680, 420, 70], ['dark', 0, 1930, 1440, 120],
    ] },
    mobile: { W: 390, H: 1900, boxes: [
      ['dark', 0, 0, 390, 860], ['text', 16, 22, 150, 16], ['btn', 230, 12, 144, 36],
      ['text', 16, 90, 340, 240], ['text', 16, 350, 330, 90], ['text', 16, 480, 358, 340],
      ['text', 16, 900, 340, 200], ['box', 16, 1130, 358, 300], ['btn', 140, 1150, 220, 40], ['box', 30, 1210, 300, 120], ['btn', 30, 1360, 330, 44],
      ['img', 16, 1470, 358, 286], ['text', 16, 1770, 300, 60],
    ] },
  },
  'ghazeline': {
    desktop: { W: 1440, H: 2600, boxes: [
      ['dark', 0, 0, 1440, 30], ['text', 160, 66, 160, 22], ['text', 580, 72, 280, 14], ['box', 1220, 60, 120, 30],
      ['text', 160, 220, 360, 260], ['btn', 160, 560, 210, 44], ['img', 640, 230, 200, 280], ['img', 860, 290, 200, 280], ['img', 1080, 230, 200, 280],
      ['dark', 0, 720, 1440, 70], ['text', 160, 850, 300, 40], ['btn', 160, 960, 90, 30], ['btn', 260, 960, 90, 30], ['btn', 360, 960, 90, 30],
      ['img', 160, 1030, 260, 380], ['img', 445, 1030, 550, 680], ['img', 1020, 1030, 260, 480], ['img', 160, 1440, 260, 470], ['img', 1020, 1540, 260, 360],
      ['text', 160, 2000, 300, 80], ['text', 540, 2000, 220, 120], ['text', 800, 2000, 220, 120], ['text', 1060, 2000, 220, 120],
      ['dark', 0, 2250, 1440, 350], ['text', 160, 2320, 520, 100], ['btn', 1060, 2340, 220, 44],
    ] },
    mobile: { W: 390, H: 1900, boxes: [
      ['dark', 0, 0, 390, 26], ['text', 16, 44, 120, 20], ['box', 300, 40, 74, 28],
      ['text', 16, 110, 300, 200], ['btn', 16, 330, 220, 44], ['img', 16, 400, 170, 240], ['img', 204, 400, 170, 240],
      ['dark', 0, 680, 390, 54], ['text', 16, 770, 220, 34], ['img', 16, 830, 170, 260], ['img', 204, 830, 170, 260], ['img', 16, 1110, 170, 260], ['img', 204, 1110, 170, 260],
      ['text', 16, 1410, 358, 220], ['dark', 0, 1660, 390, 240],
    ] },
  },
  'student-portfolio': {
    desktop: { W: 1440, H: 2600, boxes: [
      ['text', 90, 26, 200, 20], ['text', 480, 30, 520, 14], ['btn', 1240, 18, 120, 36],
      ['text', 90, 150, 620, 330], ['text', 90, 510, 560, 80], ['btn', 90, 620, 160, 44], ['btn', 270, 620, 120, 44], ['img', 780, 150, 560, 520],
      ['text', 90, 820, 760, 110], ['box', 90, 980, 680, 380], ['box', 800, 980, 550, 380],
      ['text', 90, 1460, 360, 230], ['box', 680, 1440, 670, 140], ['box', 680, 1600, 670, 140], ['box', 680, 1760, 670, 140],
      ['img', 90, 2000, 610, 300], ['img', 740, 2000, 610, 300],
      ['dark', 90, 2380, 1260, 200], ['text', 150, 2420, 420, 120],
    ] },
    mobile: { W: 390, H: 1900, boxes: [
      ['text', 16, 22, 140, 18], ['btn', 290, 14, 84, 32],
      ['text', 16, 90, 340, 220], ['text', 16, 330, 330, 80], ['btn', 16, 430, 170, 44], ['img', 16, 500, 358, 300],
      ['text', 16, 850, 330, 90], ['box', 16, 960, 358, 220], ['box', 16, 1200, 358, 140], ['box', 16, 1360, 358, 140],
      ['img', 16, 1530, 358, 200], ['dark', 16, 1760, 358, 130],
    ] },
  },
  'cafe-mamakin': {
    desktop: { W: 1440, H: 2600, boxes: [
      ['btn', 36, 20, 1368, 84], ['img', 90, 32, 70, 60], ['text', 260, 40, 200, 40], ['box', 1300, 40, 44, 44],
      ['img', 130, 190, 150, 210], ['img', 470, 190, 150, 210], ['img', 810, 190, 150, 210], ['img', 1180, 190, 100, 210],
      ['img', 530, 810, 380, 260], ['text', 480, 1110, 480, 20],
      ['dark', 16, 1220, 470, 150], ['box', 486, 1220, 470, 150], ['dark', 956, 1220, 470, 150],
      ['img', 190, 1500, 380, 380], ['text', 740, 1510, 620, 380],
      ['text', 90, 2020, 1260, 80], ['btn', 640, 2280, 150, 50],
      ['btn', 70, 2500, 1040, 60],
    ] },
    mobile: { W: 390, H: 2000, boxes: [
      ['btn', 10, 10, 370, 60], ['img', 24, 20, 50, 40], ['box', 330, 24, 32, 32],
      ['img', 30, 110, 150, 210], ['img', 210, 110, 150, 210], ['img', 30, 340, 150, 210], ['img', 210, 340, 150, 210],
      ['img', 70, 600, 250, 170], ['text', 30, 790, 330, 30],
      ['dark', 10, 850, 370, 110], ['box', 10, 970, 370, 110], ['dark', 10, 1090, 370, 110],
      ['img', 40, 1240, 310, 300], ['text', 20, 1570, 350, 300], ['btn', 20, 1900, 350, 60],
    ] },
  },
  'flolove-paris': {
    desktop: { W: 1440, H: 2600, boxes: [
      ['text', 40, 30, 160, 30], ['text', 300, 34, 760, 14], ['box', 1300, 30, 100, 22],
      ['img', 0, 100, 1440, 640], ['dark', 0, 900, 1440, 40],
      ['img', 90, 1000, 650, 900], ['text', 820, 1000, 520, 140], ['btn', 820, 1180, 300, 44], ['btn', 820, 1250, 520, 50], ['text', 820, 1330, 520, 120],
      ['img', 90, 1980, 300, 400], ['img', 420, 1980, 300, 400], ['img', 750, 1980, 300, 400], ['img', 1080, 1980, 300, 400],
      ['text', 90, 2440, 1260, 120],
    ] },
    mobile: { W: 390, H: 2000, boxes: [
      ['box', 16, 20, 30, 24], ['text', 140, 22, 110, 22], ['box', 330, 20, 44, 24],
      ['img', 0, 70, 390, 420], ['dark', 0, 520, 390, 30],
      ['img', 0, 570, 390, 520], ['text', 16, 1110, 358, 120], ['btn', 16, 1250, 358, 50], ['text', 16, 1320, 358, 120],
      ['img', 16, 1470, 170, 240], ['img', 204, 1470, 170, 240], ['text', 16, 1760, 358, 200],
    ] },
  },
};

function wireframeSvg({ W, H, boxes }) {
  const sw = W > 800 ? 3 : 2;
  const els = boxes.map(([kind, x, y, w, h], i) => {
    const common = `pathLength="1" vector-effect="non-scaling-stroke" data-i="${i}"`;
    if (kind === 'btn') return `<rect class="wf" ${common} x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(10, h / 4)}"/>`;
    if (kind === 'img')
      return `<g><rect class="wf" ${common} x="${x}" y="${y}" width="${w}" height="${h}"/><path class="wf wf-thin" ${common} d="M${x} ${y}L${x + w} ${y + h}M${x + w} ${y}L${x} ${y + h}"/></g>`;
    if (kind === 'text') {
      const lh = Math.max(14, Math.min(28, h / 4));
      const n = Math.max(1, Math.floor(h / (lh * 1.6)));
      const lines = Array.from({ length: n }, (_, j) => {
        const ly = y + lh / 2 + j * lh * 1.6;
        const lw = j === n - 1 && n > 1 ? w * 0.6 : w;
        return `M${x} ${ly.toFixed(1)}H${(x + lw).toFixed(1)}`;
      }).join('');
      return `<path class="wf wf-text" ${common} d="${lines}"/>`;
    }
    if (kind === 'dark') return `<rect class="wf wf-dark" ${common} x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    return `<rect class="wf" ${common} x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" aria-hidden="true">\n${els.join('\n')}\n</svg>\n`;
}

async function toWebp(buf, out, width, quality = 72) {
  await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(out);
}

async function fragments() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const slug of slugs) {
    const meta = load(slug);
    const dir = join(PROJECTS, slug);
    // Client projects use crops of their real site as fragments (made by hand), never generated placeholders.
    for (const frag of meta.kind === 'concept' ? meta.fragments : []) {
      await page.setContent(photoHtml(frag, slug, 900));
      const buf = await page.locator('#f').screenshot();
      await toWebp(buf, join(dir, frag.src.replace('./', '')), 900, 70);
    }
    await page.setContent(specimenHtml(meta), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await toWebp(await page.locator('#f').screenshot(), join(dir, 'type-specimen.webp'), 640, 80);
    writeFileSync(join(dir, meta.wireframeDesktop), wireframeSvg(WF[slug].desktop));
    writeFileSync(join(dir, meta.wireframeMobile), wireframeSvg(WF[slug].mobile));
    // Placeholder page shots so the content schema validates before the first real capture.
    for (const f of ['page-desktop.webp', 'page-mobile.webp', 'shot-desktop.webp', 'shot-mobile.webp']) {
      if (!existsSync(join(dir, f))) {
        await sharp({ create: { width: 64, height: 128, channels: 3, background: meta.palette[0].hex } }).webp().toFile(join(dir, f));
      }
    }
    console.log('fragments ok:', slug);
  }
  await browser.close();
}

async function pages() {
  const port = 4329;
  const server = spawn('npx', ['astro', 'preview', '--port', String(port)], { cwd: ROOT, stdio: 'ignore' });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch();
  try {
    for (const slug of slugs) {
      if (load(slug).kind !== 'concept') continue; // client pages come from scripts/capture-live.mjs
      const dir = join(PROJECTS, slug);
      for (const [file, viewport, width] of [
        ['page-desktop.webp', { width: 1440, height: 900 }, 1440],
        ['page-mobile.webp', { width: 390, height: 844 }, 390],
      ]) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: file.includes('mobile') ? 2 : 1 });
        await page.goto(`${base}/work/${slug}/preview/`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const scale = file.includes('mobile') ? 2 : 1;
        await toWebp(await page.screenshot({ fullPage: false }), join(dir, file.replace('page-', 'shot-')), width * scale, 76);
        const buf = await page.screenshot({ fullPage: true });
        await toWebp(buf, join(dir, file), width * scale, 74);
        await page.close();
      }
      console.log('pages ok:', slug);
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

if (mode === 'fragments') await fragments();
else if (mode === 'pages') await pages();
else throw new Error(`unknown mode ${mode}`);
