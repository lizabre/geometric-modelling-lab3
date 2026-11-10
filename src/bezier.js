// ============================================================================
// Кубічна крива Безьє (3-го порядку).
//   B(t) = (1−t)³·P0 + 3t(1−t)²·P1 + 3t²(1−t)·P2 + t³·P3,   t ∈ [0, 1]
// A* — вузли (кінці сегментів, крива проходить через них), h* — керуючі
// точки. Сусідні сегменти ділять спільний вузол, тому контур неперервний.
// Ламана через усі точки масиву — характеристичний багатокутник контуру.
// ============================================================================

// Раціональна крива Безьє: кожна опорна точка має вагу w (за замовчуванням 1).
//   B(t) = Σ wᵢ·bᵢ(t)·Pᵢ  /  Σ wᵢ·bᵢ(t),   bᵢ — поліноми Бернштейна 3-го степеня
// Чим більша вага w керуючої точки, тим сильніше крива до неї притягується
// (w → 0 — точка майже не впливає). Якщо всі ваги = 1, знаменник дорівнює 1
// (Σbᵢ = 1) і формула збігається зі звичайною кривою Безьє. Вага зберігається
// як поле `w` об'єкта точки; вузли (кінці сегментів) мають вагу 1.
export function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const b = [u * u * u, 3 * t * u * u, 3 * t * t * u, t * t * t];
  const P = [p0, p1, p2, p3];
  let x = 0;
  let y = 0;
  let den = 0;
  for (let i = 0; i < 4; i++) {
    const k = (P[i].w ?? 1) * b[i];
    x += k * P[i].x;
    y += k * P[i].y;
    den += k;
  }
  return { x: x / den, y: y / den };
}

// Кількість сегментів у контурі з масиву опорних точок
export const segmentCount = (pts) => Math.max(0, (pts.length - 1) / 3);

// Цикл побудови: для кожного сегмента t від 0 до 1
// з кроком 1/perSeg, сусідні точки з'єднуються лініями.
export function samplePath(pts, perSeg = 28) {
  const out = [];
  const n = segmentCount(pts);
  for (let s = 0; s < n; s++) {
    const [p0, p1, p2, p3] = [pts[3 * s], pts[3 * s + 1], pts[3 * s + 2], pts[3 * s + 3]];
    for (let i = s === 0 ? 0 : 1; i <= perSeg; i++) {
      out.push(bezierPoint(p0, p1, p2, p3, i / perSeg));
    }
  }
  return out;
}

// Поділ сегмента на два за алгоритмом де Кастельжо в точці t
// (для звичайної кривої, без ваг). Форма кривої
// не змінюється — просто той самий сегмент записується як два.
export function splitBezier([p0, p1, p2, p3], t) {
  const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const a = lerp(p0, p1), b = lerp(p1, p2), c = lerp(p2, p3);
  const d = lerp(a, b), e = lerp(b, c);
  const m = lerp(d, e); // точка кривої B(t)
  return [[p0, a, d, m], [m, e, c, p3]];
}

// Збільшує кількість сегментів контуру до T без зміни його форми:
// сегменти ділять навпіл/на частини (рівномірно по t). Потрібно, щоб два
// контури мали однакову кількість точок і їх можна було інтерполювати.
export function resample(pts, T) {
  const m = segmentCount(pts);
  const copy = (p) => ({ x: p.x, y: p.y });
  if (T <= m) return pts.map(copy);
  const out = [copy(pts[0])];
  for (let s = 0; s < m; s++) {
    const k = Math.floor(((s + 1) * T) / m) - Math.floor((s * T) / m); // на скільки частин ділимо
    let seg = [pts[3 * s], pts[3 * s + 1], pts[3 * s + 2], pts[3 * s + 3]];
    for (let j = k; j > 1; j--) {
      const [left, right] = splitBezier(seg, 1 / j);
      out.push(copy(left[1]), copy(left[2]), copy(left[3]));
      seg = right;
    }
    out.push(copy(seg[1]), copy(seg[2]), copy(seg[3]));
  }
  return out;
}
