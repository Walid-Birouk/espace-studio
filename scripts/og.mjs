// Renders public/og.png (1200×630) from the studio tokens. Run after `npm run assets`.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const font = readFileSync(`${ROOT}public/fonts/archivo-display.woff2`).toString('base64');
const img = (p) => `data:image/webp;base64,${readFileSync(`${ROOT}src/content/projects/${p}`).toString('base64')}`;
const html = `<!doctype html><html><head><style>
@font-face{font-family:A;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:700 800;font-stretch:70% 85%}
body{margin:0}#c{position:relative;width:1200px;height:630px;overflow:hidden;background:#F5F3EE;font-family:A;color:#1C1E1D}
.p{position:absolute;box-shadow:0 1px 1px rgba(28,30,29,.08),0 10px 28px rgba(28,30,29,.12)}.p img{width:100%;height:100%;object-fit:cover;display:block}
.plaque{display:inline-flex;padding:5px;background:#1E5B4A;border-radius:6px}.plaque span{border:2px solid #fff;border-radius:4px;padding:4px 18px 8px;font-weight:800;font-stretch:70%;font-size:40px;line-height:1;color:#fff}
h1{margin:28px 0 0;font-weight:800;font-stretch:70%;font-size:76px;line-height:.92;letter-spacing:-.01em;max-width:600px}
p{margin:22px 0 0;font-size:24px;color:#5C5F5A;font-family:system-ui,sans-serif}
</style></head><body><div id="c">
<div style="position:absolute;left:64px;top:64px"><div class="plaque"><span>esPAce</span></div>
<h1>Plus de clients, en ligne et en boutique.</h1><p>Site, Google, publicités, vente en ligne, vos chiffres.</p></div>
<div class="p" style="left:700px;top:40px;width:340px;height:220px;transform:rotate(-4deg)"><img src="${img('repair-ninja/frag-boutique.webp')}"></div>
<div class="p" style="left:960px;top:200px;width:200px;height:150px;transform:rotate(5deg)"><img src="${img('repair-ninja/frag-iphones.webp')}"></div>
<div class="p" style="left:760px;top:300px;width:190px;height:240px;transform:rotate(-2deg)"><img src="${img('cafe-mamakin/frag-vinylobar.webp')}"></div>
<div class="p" style="left:900px;top:420px;width:260px;height:120px;transform:rotate(7deg)"><img src="${img('repair-ninja/frag-titre.webp')}"></div>
</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html); await p.evaluate(() => document.fonts.ready);
await p.locator('#c').screenshot({ path: `${ROOT}public/og.png` });
await b.close();
console.log('og.png ok');
