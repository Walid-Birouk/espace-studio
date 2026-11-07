// Loaded only when motion is allowed (see main.ts). The signature sequence pins and shows
// a project becoming finished: idea -> token -> sketch -> page.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const EASE = 'power2.inOut';

export function start() {
  document.documentElement.classList.add('motion');

  // Smooth scroll on desktop pointers only; native scroll on touch.
  if (matchMedia('(pointer: fine) and (min-width: 900px)').matches) {
    const lenis = new Lenis({ lerp: 0.2, wheelMultiplier: 1.1, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"], a[href*="/#"]');
      if (!a) return;
      const url = new URL(a.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0 });
      history.pushState(null, '', url.hash);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    const cleanups = [...$$('[data-seq]').map(sequence)];
    return () => cleanups.forEach((c) => c?.());
  });
  ScrollTrigger.refresh();
}

/* ---------- Signature sequence: mood board -> tokens -> wireframe -> page ---------- */
function sequence(section: HTMLElement) {
  const pin = $('[data-seq-pin]', section);
  if (!pin) return;
  document.documentElement.classList.add('motion-seq');
  pin.hidden = false;

  const layer = (n: string) => $(`[data-layer="${n}"]`, pin)!;
  const items = $$('[data-seq-item]', pin);
  const copies = $$('[data-seq-copy]', pin);
  const bar = $('[data-progress]', pin);
  const moods = $$('[data-mood]', pin);
  const chips = $$('[data-chip]', pin);
  const type = $('[data-type]', pin);
  const paths = $$<SVGGeometryElement>('[data-layer="wire"] .wf', pin);
  const laptopScreen = $('[data-laptop] [data-screen]', pin);
  const scrollImgs = $$<HTMLImageElement>('[data-scroll-img]', pin);
  const phone2 = $('[data-phone2]', pin);
  const results = $$('.result', layer('result'));
  $$<HTMLImageElement>('img', pin).forEach((img) => { img.loading = 'eager'; });

  const N = copies.length;
  gsap.set(['need', 'mood', 'tokens', 'wire', 'page', 'result'].map(layer), { autoAlpha: 0 });
  gsap.set(layer('need'), { autoAlpha: 1 });
  gsap.set(copies, { autoAlpha: 0, y: 16 });
  gsap.set(copies[0], { autoAlpha: 1, y: 0 });
  gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.set(laptopScreen, { clipPath: 'inset(0% 0% 100% 0%)' });

  const loose = moods.map((_, i) => ({
    x: (i % 2 ? 1 : -1) * (180 + ((i * 97) % 220)),
    y: ((i % 3) - 1) * 160 + ((i * 53) % 80),
    rotation: (i % 2 ? 1 : -1) * (14 + ((i * 7) % 16)),
  }));
  // Chips start on top of the photo they were sampled from.
  const chipFrom = (i: number, axis: 'x' | 'y') => {
    const src = moods[i % moods.length], chip = chips[i];
    if (!src || !chip) return 0;
    const a = src.getBoundingClientRect(), b = chip.getBoundingClientRect();
    return axis === 'x' ? a.left + a.width / 2 - (b.left + b.width / 2) : a.top + a.height / 2 - (b.top + b.height / 2);
  };
  const scrollBy = (img: HTMLImageElement) => () => -Math.max(0, img.offsetHeight - img.parentElement!.clientHeight);

  const step = (i: number) => {
    const tl = gsap.timeline();
    if (i > 0) tl.to(copies[i - 1], { autoAlpha: 0, y: -16, duration: 0.25 }, 0);
    tl.to(copies[i], { autoAlpha: 1, y: 0, duration: 0.3 }, 0.15);
    return tl;
  };

  const tl = gsap.timeline({
    defaults: { ease: EASE },
    scrollTrigger: {
      trigger: pin, start: 'top top', end: () => `+=${innerHeight * 2.8}`,
      pin: true, scrub: 0.25, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (st) => {
        const idx = Math.min(N - 1, Math.floor(st.progress * N * 0.999));
        items.forEach((li, j) => li.classList.toggle('is-on', j === idx));
        if (bar) gsap.set(bar, { scaleX: st.progress });
      },
    },
  });

  tl.add(step(1), 0.7)
    .to(layer('need'), { autoAlpha: 0, duration: 0.3 }, 0.7)
    .set(layer('mood'), { autoAlpha: 1 }, 0.8)
    .from(moods, { x: (i) => loose[i].x, y: (i) => loose[i].y, rotation: (i) => loose[i].rotation, scale: 1.12, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' }, 0.8);
  tl.add(step(2), 1.9)
    .set(layer('tokens'), { autoAlpha: 1 }, 1.95)
    .to(moods, { opacity: 0.35, duration: 0.4 }, 2.0)
    .from(chips, { x: (i) => chipFrom(i, 'x'), y: (i) => chipFrom(i, 'y'), scale: 0.4, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out' }, 2.0);
  if (type) tl.from(type, { x: 80, opacity: 0, rotation: 6, duration: 0.5 }, 2.35);
  tl.add(step(3), 2.9)
    .to(moods, { opacity: 0.08, duration: 0.4 }, 2.95)
    .to(layer('tokens'), { opacity: 0.4, duration: 0.4 }, 2.95)
    .set(layer('wire'), { autoAlpha: 1 }, 2.95)
    .to(paths, { strokeDashoffset: 0, duration: 0.6, stagger: { each: 0.025 }, ease: 'none' }, 3.0);
  tl.add(step(4), 3.9)
    .set(layer('page'), { autoAlpha: 1 }, 3.95)
    .to(laptopScreen, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'steps(5)' }, 3.95)
    .to(layer('wire'), { autoAlpha: 0, duration: 0.3 }, 4.45)
    .to(layer('tokens'), { autoAlpha: 0, duration: 0.3 }, 4.45)
    .to(layer('mood'), { autoAlpha: 0, duration: 0.3 }, 4.45)
    .from(phone2, { x: 80, opacity: 0, duration: 0.4 }, 4.3);
  scrollImgs.forEach((img) => tl.to(img, { y: scrollBy(img), duration: 0.9, ease: 'none' }, 4.5));
  tl.add(step(5), 5.3)
    .set(layer('result'), { autoAlpha: 1 }, 5.35)
    .from(results, { y: 50, opacity: 0, duration: 0.4, stagger: 0.1, ease: 'power3.out' }, 5.35)
    .to(layer('page'), { autoAlpha: 0, duration: 0.3 }, 5.3)
    .to({}, { duration: 0.3 }, 5.8);

  return () => {
    document.documentElement.classList.remove('motion-seq');
    pin.hidden = true;
  };
}
