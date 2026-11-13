// The customer story as a path: one line snakes from the title's full stop, behind each phone, down to the closing
// line's full stop. It draws itself as you scroll (the tip stays at ~56% of the window), a dot rides the tip, the step
// nearest the middle of the screen lights up, and the line merges into the final dot. Native scroll only, no library.
// With reduced motion the line is drawn in full and nothing moves.

type Pt = { x: number; y: number };

const TIP = 0.56; // where the tip of the line sits, as a share of the window height
const LERP = 0.16; // smoothing of the tip per frame

export function journey(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-journey-line]');
  const ghost = svg?.querySelector<SVGPathElement>('[data-line-ghost]');
  const line = svg?.querySelector<SVGPathElement>('[data-line-progress]');
  const dot = svg?.querySelector<SVGCircleElement>('[data-line-dot]');
  const start = root.querySelector<HTMLElement>('[data-journey-start]');
  const end = root.querySelector<HTMLElement>('[data-journey-end]');
  const steps = [...root.querySelectorAll<HTMLElement>('[data-beat]')];
  const anchors = steps.map((s) => s.querySelector<HTMLElement>('[data-journey-anchor]') || s);
  if (!svg || !ghost || !line || !dot || !start || !end || !steps.length) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let total = 0;
  let samples: { len: number; y: number }[] = [];
  let target = 0;
  let shown = -1;
  let raf = 0;
  let merged = false;

  const centre = (el: Element, base: DOMRect): Pt => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
  };

  // A smooth S-curve through the anchors: vertical tangents, so the path only ever goes down.
  const build = () => {
    const base = root.getBoundingClientRect();
    const narrow = matchMedia('(max-width: 899px)').matches;
    let mid = anchors.map((a) => centre(a, base));
    // Phones: the copy card sits between two phones and would hide the crossing, so the line drops straight out of a
    // phone, crosses in the open gap above the next card, then runs straight down behind it.
    if (narrow) {
      mid = mid.flatMap((p, i) => {
        const next = steps[i + 1]?.querySelector('.story__copy');
        if (!next) return [p];
        const from = anchors[i].getBoundingClientRect().bottom - base.top + 6;
        const to = next.getBoundingClientRect().top - base.top - 6;
        return to - from > 40 ? [p, { x: p.x, y: from }, { x: mid[i + 1].x, y: to }] : [p];
      });
    }
    const pts = [centre(start, base), ...mid, centre(end, base)];
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const k = a.x === b.x ? (b.y - a.y) / 3 : Math.max(narrow ? 0 : 40, (b.y - a.y) * (narrow ? 0.6 : 0.75));
      d += ` C${a.x.toFixed(1)} ${(a.y + k).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - k).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
    const w = Math.ceil(base.width), h = Math.ceil(base.height);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    ghost.setAttribute('d', d);
    line.setAttribute('d', d);
    total = line.getTotalLength();
    line.style.strokeDasharray = `${total} ${total}`;
    samples = [];
    const n = Math.max(2, Math.ceil(total / 6));
    for (let i = 0; i <= n; i++) {
      const len = (total * i) / n;
      samples.push({ len, y: line.getPointAtLength(len).y });
    }
    if (reduced) { line.style.strokeDashoffset = '0'; dot.style.display = 'none'; return; }
    paint(target = lengthAtY(tipY()), true);
  };

  const tipY = () => innerHeight * TIP - root.getBoundingClientRect().top;

  // Path length where the line reaches a given y (the path is monotonic in y).
  const lengthAtY = (y: number) => {
    if (!samples.length) return 0;
    if (y <= samples[0].y) return 0;
    if (y >= samples[samples.length - 1].y) return total;
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (samples[m].y < y) lo = m + 1; else hi = m; }
    const a = samples[lo - 1], b = samples[lo];
    const f = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
    return a.len + (b.len - a.len) * f;
  };

  const paint = (len: number, snap = false) => {
    shown = snap ? len : shown < 0 ? len : shown + (len - shown) * LERP;
    if (Math.abs(len - shown) < 0.3) shown = len;
    line.style.strokeDashoffset = String(total - shown);
    const p = line.getPointAtLength(shown);
    dot.setAttribute('cx', p.x.toFixed(1));
    dot.setAttribute('cy', p.y.toFixed(1));
    const done = shown >= total - 1;
    if (done !== merged) {
      merged = done;
      root.classList.toggle('is-complete', done);
      end.classList.toggle('is-merged', done);
    }
    dot.style.opacity = shown < 2 || done ? '0' : '1';
  };

  const tick = () => {
    raf = 0;
    paint(target);
    if (shown !== target) raf = requestAnimationFrame(tick);
  };

  const onScroll = () => {
    if (reduced || !total) return;
    target = lengthAtY(tipY());
    if (!raf) raf = requestAnimationFrame(tick);
  };

  // The step closest to the middle of the window is the live one.
  const ratios = new Map<Element, number>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
      let best: Element | null = null, max = 0;
      ratios.forEach((r, el) => { if (r > max) { max = r; best = el; } });
      steps.forEach((s) => {
        const on = s === best;
        s.classList.toggle('is-in-view', on);
        if (on) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
      });
    },
    { rootMargin: '-18% 0px -34% 0px', threshold: [0, 0.08, 0.16, 0.24, 0.32, 0.42, 0.55, 0.7] },
  );
  steps.forEach((s) => io.observe(s));

  let rebuild = 0;
  const schedule = () => { cancelAnimationFrame(rebuild); rebuild = requestAnimationFrame(build); };
  build();
  document.fonts?.ready.then(schedule);
  addEventListener('resize', schedule, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(root);
  addEventListener('scroll', onScroll, { passive: true });
  root.classList.add('is-journey');
}
