# esPAce

Website of esPAce, the web studio of Walid Birouk: websites, Google visibility, ads, online stores and data for businesses. Built with Astro as a static site, French at `/` and English at `/en/`.

## Development

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm run preview    # serve dist/
npm test           # Playwright checks: pages, hreflang, overflow, typography, reduced motion
```

## Configuration

| Setting | Where |
|---|---|
| Site address | `astro.config.mjs` (`SITE`) and `public/robots.txt` |
| Contact details, booking link, form key | `src/i18n/index.ts` (`CONTACT`) |
| Copy (French / English) | `src/content/site.fr.json`, `src/content/site.en.json` |
| Projects | `src/content/projects/<slug>/meta.json` and its images |

## Adding a project

1. Create `src/content/projects/<slug>/meta.json` (copy an existing one).
2. Capture the live site: `node scripts/capture-live.mjs <url> <slug>`, then convert the captures to webp.
3. Add the type specimen and wireframes with `node scripts/make-assets.mjs fragments <slug>`.

Every project appears in the home page carousel and gets its own `/work/<slug>/` page in both languages. The project marked `"flagship": true` drives the process section.

## Structure

- `src/scripts/main.ts`: menu, project carousel, theme toggle, fade-ins, contact form.
- `src/scripts/motion.ts`: GSAP + ScrollTrigger + Lenis, loaded only when motion is allowed, for the pinned process section on desktop.
- With JavaScript off or reduced motion on, every section is plain, readable HTML.

## Deployment

Static output, deployed on Vercel (framework preset: Astro).
