// Downloads openly licensed photos (Openverse: Wikimedia Commons, Flickr CC…) for a project,
// with the credits needed to use them. Only licences that allow commercial use.
//   node scripts/fetch-photos.mjs <slug> "search terms" ...
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [slug, ...queries] = process.argv.slice(2);
if (!slug || !queries.length) throw new Error('usage: fetch-photos.mjs <slug> "<query>" ...');
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'src/content/projects', slug, 'photos');
mkdirSync(OUT, { recursive: true });

const credits = [];
for (const q of queries) {
  const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&size=large&page_size=8`;
  const res = await fetch(api, { headers: { 'User-Agent': 'espace-studio-photo-fetch/1.0' } });
  if (!res.ok) { console.warn('search failed', q, res.status); continue; }
  const { results = [] } = await res.json();
  let n = 0;
  for (const r of results) {
    if (n >= 5) break;
    try {
      const img = await fetch(r.url, { headers: { 'User-Agent': 'espace-studio-photo-fetch/1.0' } });
      const type = img.headers.get('content-type') || '';
      if (!img.ok || !type.startsWith('image/')) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 40_000) continue; // skip thumbnails
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const file = `${q.replace(/\W+/g, '-')}-${++n}.${ext}`;
      writeFileSync(join(OUT, file), buf);
      credits.push({ file, query: q, title: r.title, creator: r.creator, license: `${r.license} ${r.license_version ?? ''}`.trim(), license_url: r.license_url, source: r.foreign_landing_url });
    } catch (e) { console.warn('skip', r.url, e.message); }
  }
  console.log(q, '->', n);
}
writeFileSync(join(OUT, 'credits.json'), JSON.stringify(credits, null, 2));
console.log('saved', credits.length, 'photos to', OUT);
