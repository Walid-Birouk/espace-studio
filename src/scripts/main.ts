// Always-on, tiny: menu, step strip on phones, before/after slider, contact form.
// Everything animated lives in ./motion and loads only when motion is allowed.

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

// ---- Menu (phones) ----
const panel = $('#menu');
const openBtn = $<HTMLButtonElement>('.site-header .menu-toggle');
if (panel && openBtn) {
  const close = () => {
    panel.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    openBtn.focus();
  };
  openBtn.addEventListener('click', () => {
    panel.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    $<HTMLButtonElement>('[data-close]', panel)?.focus();
  });
  $('[data-close]', panel)?.addEventListener('click', close);
  $$('nav a', panel).forEach((a) => a.addEventListener('click', () => { panel.hidden = true; document.body.style.overflow = ''; openBtn.setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
}

// ---- Process steps as a swipeable strip (phones) ----
for (const seq of $$('[data-seq]')) {
  const track = $('.seq__steps', seq);
  const steps = track ? $$('.seq__step', track) : [];
  const dots = $$('.seq__dots i', seq);
  const label = $('[data-seq-count]', seq);
  const prev = $<HTMLButtonElement>('[data-seq-prev]', seq);
  const next = $<HTMLButtonElement>('[data-seq-next]', seq);
  if (!track || !steps.length) continue;
  let current = 0;
  const update = (i: number) => {
    current = i;
    dots.forEach((d, j) => d.classList.toggle('is-on', j <= i));
    if (label) label.textContent = String(i + 1);
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === steps.length - 1;
  };
  const go = (i: number) => {
    const target = steps[Math.max(0, Math.min(steps.length - 1, i))];
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft - (track.clientWidth - target.clientWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  prev?.addEventListener('click', () => go(current - 1));
  next?.addEventListener('click', () => go(current + 1));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.6) update(steps.indexOf(e.target as HTMLElement)); }),
    { root: track, threshold: [0.6] },
  );
  steps.forEach((s) => io.observe(s));
  update(0);
}

// ---- Fade-ins: blocks rise into place as they enter the screen (skipped with reduced motion) ----
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const sel = [
    '.wall__intro > *', '.story__head > *', '.story__beat > *', '.story__end > *',
    '.case__head > *', '.seq__steps', '.seq__nav', '.prices__title', '.prices__list > li', '.prices__quote',
    '.about > *', '.contact__inner > :not(form)',
  ].join(',');
  const els = [...document.querySelectorAll<HTMLElement>(sel)];
  const rv = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('rv-in');
    rv.unobserve(e.target);
  }), { rootMargin: '0px 0px -6% 0px', threshold: 0.12 });
  els.forEach((el) => {
    const i = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
    el.style.setProperty('--rv-d', `${Math.min(Math.max(i, 0), 5) * 70}ms`);
    el.classList.add('rv');
    rv.observe(el);
  });
}

// ---- Project carousel: auto-advances one project at a time, with a progress signal ----
const wallVp = document.querySelector<HTMLElement>('[data-wall-viewport]');
const wallCtrl = document.querySelector<HTMLElement>('[data-wall-ctrl]');
if (wallVp && wallCtrl) {
  const titles = [...wallVp.querySelectorAll<HTMLElement>('.cluster__title')];
  const dots = [...wallCtrl.querySelectorAll<HTMLButtonElement>('[data-wall-go]')];
  const pauseBtn = wallCtrl.querySelector<HTMLButtonElement>('[data-wall-pause]')!;
  const DUR = 3500;
  let idx = 0, timer = 0, userPaused = matchMedia('(prefers-reduced-motion: reduce)').matches, hold = false, onScreen = true, resumeAt = 0;
  wallCtrl.style.setProperty('--slide', `${DUR}ms`);
  // Line each project up with the page's text edge (the controls row is a .wrap, so it knows that edge).
  const board = wallVp.querySelector<HTMLElement>('[data-wall-board]')!;
  let edge = 16, ml = 0;
  const measure = () => {
    edge = wallCtrl.getBoundingClientRect().left + parseFloat(getComputedStyle(wallCtrl).paddingLeft) - wallVp.getBoundingClientRect().left;
    ml = Math.max(0, edge - titles[0].offsetLeft); board.style.marginLeft = `${ml}px`;
    wallVp.style.scrollPaddingLeft = '0px';
    titles.forEach((t) => { t.style.scrollMarginLeft = `${edge}px`; });
  };
  measure();
  addEventListener('resize', measure);
  const left = (i: number) => Math.max(0, titles[i].offsetLeft + ml - edge);
  const mark = (i: number) => {
    idx = i;
    dots.forEach((d, k) => { d.parentElement!.toggleAttribute('data-on', k === i); d.parentElement!.toggleAttribute('data-done', k < i); });
  };
  const running = () => !userPaused && !hold && onScreen && !document.hidden && Date.now() >= resumeAt;
  const sync = () => {
    wallCtrl.toggleAttribute('data-running', running());
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.setAttribute('aria-label', userPaused ? pauseBtn.dataset.labelPlay! : pauseBtn.dataset.labelPause!);
  };
  const go = (i: number, smooth = true) => {
    const n = (i + titles.length) % titles.length;
    wallVp.scrollTo({ left: left(n), behavior: smooth ? 'smooth' : 'auto' });
    mark(n);
    restart();
  };
  const restart = () => {
    clearTimeout(timer);
    // Restart the progress bar animation on the active dot.
    const bar = dots[idx]?.querySelector('b');
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    sync();
    if (running()) timer = window.setTimeout(() => go(idx + 1), DUR);
    else if (!userPaused && Date.now() < resumeAt) timer = window.setTimeout(restart, resumeAt - Date.now());
  };
  // Swiping or scrolling by hand: follow along, and wait a moment before sliding again.
  let scrollT = 0;
  wallVp.addEventListener('scroll', () => {
    clearTimeout(scrollT);
    scrollT = window.setTimeout(() => {
      const x = wallVp.scrollLeft + 40;
      let k = 0;
      titles.forEach((_, j) => { if (left(j) <= x) k = j; });
      if (k !== idx) { mark(k); restart(); }
    }, 120);
  }, { passive: true });
  const nudge = () => { resumeAt = Date.now() + 8000; restart(); };
  wallVp.addEventListener('touchstart', nudge, { passive: true });
  wallVp.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) nudge(); }, { passive: true });
  wallVp.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hold = true; restart(); } });
  wallVp.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hold = false; restart(); } });
  wallVp.addEventListener('focusin', () => { hold = true; restart(); });
  wallVp.addEventListener('focusout', () => { hold = false; restart(); });
  dots.forEach((d, k) => d.addEventListener('click', () => { resumeAt = Date.now() + 8000; go(k); }));
  pauseBtn.addEventListener('click', () => { userPaused = !userPaused; resumeAt = 0; restart(); });
  document.addEventListener('visibilitychange', restart);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; restart(); }, { threshold: 0.3 }).observe(wallVp);
  // Grab and throw with the mouse, like a map: hold, drag, let go fast and it glides.
  // (Touch and trackpads already scroll natively, with their own momentum.)
  let down = false, moved = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, vel = 0, glide = 0;
  const stopGlide = () => { cancelAnimationFrame(glide); glide = 0; };
  wallVp.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    stopGlide(); clearTimeout(timer);
    down = true; moved = false; startX = lastX = e.clientX; startLeft = wallVp.scrollLeft; lastT = performance.now(); vel = 0;
    wallVp.classList.add('is-grab');
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) { moved = true; wallVp.classList.add('is-dragging'); }
    if (!moved) return;
    e.preventDefault();
    wallVp.scrollLeft = startLeft - dx;
    const now = performance.now(), dt = Math.max(1, now - lastT);
    vel = 0.8 * ((lastX - e.clientX) / dt) + 0.2 * vel; // px per ms
    lastX = e.clientX; lastT = now;
  });
  addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    wallVp.classList.remove('is-grab');
    if (!moved) return;
    resumeAt = Date.now() + 8000;
    let v = performance.now() - lastT > 80 ? 0 : vel * 16; // px per frame
    const step = () => {
      v *= 0.95;
      wallVp.scrollLeft += v;
      if (Math.abs(v) > 0.4) glide = requestAnimationFrame(step);
      else { glide = 0; wallVp.classList.remove('is-dragging'); restart(); }
    };
    glide = requestAnimationFrame(step);
  });
  // A drag is not a click on the project underneath.
  wallVp.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  wallVp.addEventListener('dragstart', (e) => e.preventDefault());
  wallVp.addEventListener('wheel', stopGlide, { passive: true });

  mark(0);
  restart();
}

// ---- Theme toggle: remembers the choice; otherwise follows the system ----
const themeBtn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
if (themeBtn) {
  const root = document.documentElement;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const sync = () => {
    themeBtn.setAttribute('aria-pressed', String(isDark()));
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => { m.content = isDark() ? '#141615' : '#F5F3EE'; });
  };
  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.classList.add('theme-anim');
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    sync();
    setTimeout(() => root.classList.remove('theme-anim'), 400);
  });
  sync();
}

// ---- Back to top: shows after one screen of scrolling ----
const toTop = $<HTMLAnchorElement>('[data-to-top]');
if (toTop) {
  let ticking = false;
  const check = () => { toTop.toggleAttribute('data-show', scrollY > innerHeight * 0.9); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  check();
  // With Lenis running (desktop), its own anchor handler scrolls smoothly. Otherwise scroll here.
  toTop.addEventListener('click', (e) => {
    if (document.documentElement.classList.contains('lenis')) return;
    e.preventDefault();
    scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('#top')?.focus({ preventScroll: true });
  });
}

// ---- Before / after slider ----
for (const cmp of $$('.compare')) {
  const input = $<HTMLInputElement>('input[type=range]', cmp);
  input?.addEventListener('input', () => cmp.style.setProperty('--pos', `${input.value}%`));
}

// ---- Contact form (Web3Forms) ----
const form = $<HTMLFormElement>('form[data-contact]');
if (form) {
  const status = $('.form__status', form)!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (!String(data.get('name') || '').trim() || !String(data.get('reply') || '').trim()) {
      status.textContent = form.dataset.required || '';
      return;
    }
    const btn = $<HTMLButtonElement>('button[type=submit]', form);
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { Accept: 'application/json' }, body: data });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error('send');
      form.reset();
      status.textContent = form.dataset.sent || '';
    } catch {
      status.textContent = form.dataset.error || '';
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// ---- Motion: only when allowed, after first paint ----
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduce.matches) {
  const start = () => import('./motion').then((m) => m.start());
  if (document.readyState === 'complete') requestAnimationFrame(start);
  else addEventListener('load', () => requestAnimationFrame(start), { once: true });
}
