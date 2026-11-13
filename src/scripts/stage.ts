// Hero stage: the projects' real pieces (screens, mood photos, type, swatches) float in a deep field behind the
// headline. The camera glides forward on its own, scrolling pushes it faster, the mouse steers it a little.
// Cards that pass the camera are recycled to the far end, so the field is endless. OGL only, one program,
// textures ≤ 560px, device pixel ratio capped at 1.5. Loaded lazily from main.ts, never before the page is usable.
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from 'ogl';

type CardData = { src?: string; color?: string; ratio: number; size: number };

const vertex = /* glsl */ `
  attribute vec2 uv; attribute vec3 position;
  uniform mat4 modelMatrix, modelViewMatrix, projectionMatrix; uniform float uCamZ;
  varying vec2 vUv, vNdc; varying float vDist;
  void main() {
    vUv = uv;
    vDist = uCamZ - (modelMatrix * vec4(position, 1.0)).z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vNdc = gl_Position.xy / gl_Position.w;
  }`;
const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap; uniform float uHasTex, uFog, uMax; uniform vec3 uColor; uniform vec4 uText;
  varying vec2 vUv, vNdc; varying float vDist;
  void main() {
    vec3 c = mix(uColor, texture2D(tMap, vUv).rgb, uHasTex);
    float a = smoothstep(0.6, 2.6, vDist) * (1.0 - smoothstep(uFog * 0.65, uFog, vDist)) * uMax;
    // Where the small text sits (uText: y from, y to, right column from x, offers below y), only far, hazy cards may pass.
    float band = step(uText.x, vNdc.y) * step(vNdc.y, uText.y) * max(step(uText.z, vNdc.x), step(vNdc.y, uText.w));
    a *= mix(1.0, 0.45 * smoothstep(7.0, 12.0, vDist), band);
    vec2 d = abs(vUv - 0.5) - 0.47;
    a *= 1.0 - smoothstep(0.0, 0.02, length(max(d, 0.0)));
    gl_FragColor = vec4(c * a, a);
  }`;

export function mountStage(canvas: HTMLCanvasElement, cards: CardData[]) {
  const hero = canvas.parentElement!;
  const phone = matchMedia('(max-width: 899px)').matches;
  const DEPTH = 28, FOG = 23;
  const renderer = new Renderer({ canvas, alpha: true, antialias: false, dpr: Math.min(devicePixelRatio || 1, 1.5), premultipliedAlpha: true });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const camera = new Camera(gl, { fov: 42, near: 0.1, far: 60 });
  const scene = new Transform();
  const geometry = new Plane(gl);
  const blank = new Texture(gl);
  const program = new Program(gl, {
    vertex, fragment, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { tMap: { value: blank }, uHasTex: { value: 0 }, uColor: { value: [1, 1, 1] }, uCamZ: { value: 0 }, uFog: { value: FOG }, uMax: { value: phone ? 0.85 : 0.95 },
      // Desktop: the pitch column (right of x=0.05) between y=-0.75 and 0.62, plus the offers rows below y=-0.2. Phone: the whole column.
      uText: { value: phone ? [-0.95, 0.8, -2, 2] : [-0.75, 0.62, 0.05, -0.2] } },
  });
  program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const rnd = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
  type Card = { mesh: Mesh; tex: Texture | null; color: number[]; phase: number; tilt: number };
  const list: Card[] = [];
  const n = phone ? Math.min(cards.length, 16) : Math.min(cards.length, 26);
  // Golden-angle spiral around the headline, so cards fill the edges and only cross the text when far away.
  for (let i = 0; i < n; i++) {
    const d = cards[(i * 7) % cards.length];
    const mesh = new Mesh(gl, { geometry, program });
    const a = i * 2.399963 + rnd(i) * 0.6, r = (phone ? 1.9 : 2.5) + rnd(i + 1) * 2.8;
    const s = d.size * (phone ? 0.8 : 1);
    mesh.scale.set(s, s * d.ratio, 1);
    mesh.position.set(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.7, -2 - (i / n) * DEPTH - rnd(i + 2) * 1.5);
    mesh.setParent(scene);
    let tex: Texture | null = null;
    if (d.src) {
      tex = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
      const img = new Image(); img.decoding = 'async';
      img.onload = () => { tex!.image = img; };
      img.src = d.src;
    }
    const c: Card = { mesh, tex, color: d.color ? hex(d.color) : [1, 1, 1], phase: rnd(i + 3) * 6.28, tilt: (rnd(i + 4) - 0.5) * 0.3 };
    mesh.onBeforeRender(() => {
      const ready = c.tex?.image as HTMLImageElement | undefined;
      program.uniforms.tMap.value = ready ? c.tex! : blank;
      program.uniforms.uHasTex.value = ready ? 1 : 0;
      program.uniforms.uColor.value = c.color;
    });
    list.push(c);
  }

  let w = 1, h = 1;
  const resize = () => {
    w = hero.clientWidth; h = hero.clientHeight;
    renderer.setSize(w, h);
    camera.perspective({ aspect: w / h });
  };
  resize();
  new ResizeObserver(resize).observe(hero);

  // Mouse steers the camera a little; it eases back when the pointer leaves.
  let tx = 0, ty = 0, mx = 0, my = 0;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

  let visible = true, raf = 0, last = 0, travel = 0;
  const frame = (t: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
    // Forward on its own (slowly), plus how far the hero has scrolled away.
    travel += dt * (phone ? 0.55 : 0.4);
    const scrolled = Math.min(1.2, Math.max(0, -hero.getBoundingClientRect().top / Math.max(1, h)));
    const camZ = -(travel + scrolled * DEPTH * 0.8);
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    camera.position.set(mx * 0.7, -my * 0.45, camZ);
    camera.rotation.set(my * 0.03, -mx * 0.05, 0);
    program.uniforms.uCamZ.value = camZ;
    const time = t / 1000;
    for (const c of list) {
      const p = c.mesh.position;
      if (p.z > camZ + 0.4) p.z -= DEPTH; // passed the camera: send it to the far end
      c.mesh.rotation.set(Math.sin(time * 0.35 + c.phase) * 0.06, Math.sin(time * 0.27 + c.phase) * 0.16, c.tilt + Math.sin(time * 0.4 + c.phase) * 0.03);
      p.y += Math.sin(time * 0.5 + c.phase) * 0.0012;
    }
    renderer.render({ scene, camera });
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', run);
  hero.setAttribute('data-live', '');
  run();
}
