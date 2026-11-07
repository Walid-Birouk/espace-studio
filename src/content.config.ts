import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const t = z.object({ fr: z.string(), en: z.string() });

// Optional campaign piece shown on the work page: a search ad, a social ad or an assistant chat.
// `plan` lists how it is set up (budget, area, guardrails), never invented results.
const plan = z.array(z.object({ label: t, value: t }));
const showcase = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('search'), title: t, query: t, url: z.string(), headline: t, description: t, sitelinks: z.array(t), plan }),
  z.object({ kind: z.literal('social'), title: t, handle: z.string(), image: z.number(), text: t, cta: t, plan }),
  z.object({ kind: z.literal('chat'), title: t, messages: z.array(z.object({ from: z.enum(['user', 'bot']), text: t })), plan }),
]);

const projects = defineCollection({
  loader: glob({ pattern: '*/meta.json', base: './src/content/projects', generateId: ({ entry }) => entry.split('/')[0] }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      kind: z.enum(['concept', 'client']),
      order: z.number(),
      flagship: z.boolean().default(false),
      sector: t,
      place: t,
      year: z.number(),
      idea: t,
      summary: t,
      palette: z.array(z.object({ name: z.string(), hex: z.string() })).min(4).max(6),
      type: z.object({
        display: z.object({ family: z.string(), role: t }),
        body: z.object({ family: z.string(), role: t }),
        sample: z.string(),
      }),
      steps: z.array(z.object({ id: z.string(), title: t, body: t })),
      results: z.array(z.object({ label: t, title: t, body: t })),
      fragments: z.array(
        z.object({
          src: image(),
          alt: t,
          ratio: z.number(), // height / width
          tones: z.array(z.string()).min(2), // placeholder colours until real photos arrive
          x: z.number(), // % of mood-board width
          y: z.number(), // % of mood-board height
          w: z.number(), // % of mood-board width
          r: z.number(), // degrees of rotation when loose
        }),
      ),
      typeSpecimen: image(),
      pageDesktop: image(),
      pageMobile: image(),
      shotDesktop: image(), // first screen only, for the wall
      shotMobile: image(),
      wireframeDesktop: z.string(),
      wireframeMobile: z.string(),
      liveUrl: z.string().url().optional(),
      credits: t.optional(),
      seo: z.object({ title: t, description: t }),
      showcase: showcase.optional(),
    }),
});

export const collections = { projects };
