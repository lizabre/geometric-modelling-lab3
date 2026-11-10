// ============================================================================
// Морфінг: усі точки малюнка → контур однієї зірки.
//
// Усі опорні точки всіх контурів (вузли й керуючі) по черзі розкладаються
// вздовж периметра зірки на рівних відстанях. Кожна точка
// лінійно їде від свого місця в малюнку до свого місця на периметрі:
//     P(s) = (1 − e)·A + e·B,   e = s²(3 − 2s)
// Крива Безьє йде за точками; наприкінці всі лінії лягають на сторони зірки.
// ============================================================================
import { segmentCount } from "./bezier.js";

const CENTER = { x: 60, y: 52 }; // центр малюнка та зірки
const STAR = { R: 44, r: 17, n: 5 }; // зовнішній / внутрішній радіус, кількість променів
const START_DEG = 18; // з якої вершини починається обхід периметра (проти годинникової)

// Вершини зірки: чергуються зовнішні й внутрішні
function starVertices() {
  const v = [];
  for (let i = 0; i < 2 * STAR.n; i++) {
    const rad = i % 2 === 0 ? STAR.R : STAR.r;
    const a = ((START_DEG + (i * 180) / STAR.n) * Math.PI) / 180;
    v.push({ x: CENTER.x + rad * Math.cos(a), y: CENTER.y + rad * Math.sin(a) });
  }
  return v;
}

// Периметр як функція: f ∈ [0, 1] → точка на ламаній (f = 1 збігається з f = 0)
function makePerimeter() {
  const v = starVertices();
  const n = v.length;
  const len = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = v[i], b = v[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    len.push(l);
    total += l;
  }
  return (f) => {
    let d = Math.max(0, Math.min(1, f)) * total;
    for (let i = 0; i < n; i++) {
      if (d <= len[i] || i === n - 1) {
        const t = len[i] ? Math.min(1, d / len[i]) : 0;
        const a = v[i], b = v[(i + 1) % n];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      d -= len[i];
    }
  };
}

const ease = (s) => s * s * (3 - 2 * s);

export function createMorph(state, app, onUpdate) {
  let from = null;
  let to = null;
  const m = { s: 0, dir: 1, speed: 0.4, loop: true, playing: false };
  let raf = 0;
  let last = 0;

  // Готуємо пари «було → буде». Викликається на s = 0 — з поточного стану малюнка.
  function prepare() {
    const perimeter = makePerimeter();
    from = state.paths.map((p) => p.pts.map((q) => ({ x: q.x, y: q.y })));
    to = state.paths.map((p) => p.pts.map((q) => ({ x: q.x, y: q.y })));

    // 1) порядок контурів — за кутом центра контуру навколо центра малюнка
    const angle = (path) => {
      const anchors = path.pts.filter((_, i) => i % 3 === 0);
      const cx = anchors.reduce((a, p) => a + p.x, 0) / anchors.length;
      const cy = anchors.reduce((a, p) => a + p.y, 0) / anchors.length;
      const deg = (Math.atan2(cy - CENTER.y, cx - CENTER.x) * 180) / Math.PI;
      return (((deg - START_DEG) % 360) + 360) % 360;
    };
    const order = state.paths.map((_, i) => i).sort((i, j) => angle(state.paths[i]) - angle(state.paths[j]) || i - j);

    // 2) ділянка периметра для кожного контуру ∝ кількості його сегментів
    const totalSegs = state.paths.reduce((s, p) => s + segmentCount(p.pts), 0);
    let F = 0;
    order.forEach((idx) => {
      const pts = state.paths[idx].pts;
      const F0 = F;
      const F1 = F + segmentCount(pts) / totalSegs;
      pts.forEach((_, k) => {
        const f = pts.length > 1 ? F0 + ((F1 - F0) * k) / (pts.length - 1) : F0;
        const p = perimeter(f);
        to[idx][k] = { x: p.x, y: p.y };
      });
      F = F1;
    });
  }

  function apply(s) {
    m.s = Math.max(0, Math.min(1, s));
    if (!from) prepare();
    const e = ease(m.s);
    state.paths.forEach((path, i) => {
      const A = from[i];
      const B = to[i];
      path.pts.forEach((q, k) => {
        q.x = A[k].x * (1 - e) + B[k].x * e;
        q.y = A[k].y * (1 - e) + B[k].y * e;
      });
      path.fillAlpha = 1 - e; // заливки плавно зникають, лишається чистий контур зірки
      app.rebuildPath(i);
    });
    app.rebuildOverlay();
    app.render();
    if (m.s <= 0) from = null; // повернулися до початку — знову можна редагувати точки
    onUpdate();
  }

  function loop(now) {
    if (!m.playing) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let s = m.s + m.dir * m.speed * dt;
    if (s >= 1) {
      s = 1;
      m.dir = -1;
      if (!m.loop) m.playing = false;
    } else if (s <= 0) {
      s = 0;
      m.dir = 1;
      if (!m.loop) m.playing = false;
    }
    apply(s);
    raf = requestAnimationFrame(loop);
  }

  m.set = apply;
  m.start = () => {
    if (m.playing) return;
    m.playing = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  m.stop = () => {
    m.playing = false;
    cancelAnimationFrame(raf);
  };
  m.invalidate = () => {
    from = null;
  };
  m.active = () => m.s > 0;
  return m;
}
