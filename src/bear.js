// ============================================================================
// Варіант 28 — ведмедик із зірочками. Шляхи йдуть у порядку «від дальнього до ближнього»
// (замкнені контури зафарбовуються білим, тож закривають те, що позаду).
// Координати: x вправо, y вгору, умовні одиниці (~см), центр ведмедика x = 60.
// ============================================================================

const P = (x, y) => ({ x, y });
const MX = 120; // вісь симетрії: x → 120 − x
export const mirrorPts = (pts) => pts.map((p) => P(MX - p.x, p.y));

// Еліпс із 4 сегментів Безьє (k = 0.5523 — стандартна апроксимація чверті кола)
function ellipse(cx, cy, rx, ry, rotDeg = 0) {
  const k = 0.5523;
  const raw = [
    [rx, 0], [rx, k * ry], [k * rx, ry], [0, ry],
    [-k * rx, ry], [-rx, k * ry], [-rx, 0],
    [-rx, -k * ry], [-k * rx, -ry], [0, -ry],
    [k * rx, -ry], [rx, -k * ry], [rx, 0],
  ];
  const a = (rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return raw.map(([x, y]) => P(cx + x * c - y * s, cy + x * s + y * c));
}

// Гладкий контур через вузли (Catmull–Rom → Безьє): керуючі точки в кожному
// вузлі лежать на одній прямій із сусідніми — це дає гладке (C¹) з'єднання.
// Вузол із ознакою "c" — кут (гострий зламом).
function smooth(anchors, closed) {
  const A = anchors.map((a) => ({ x: a[0], y: a[1], c: a[2] === "c" }));
  const n = A.length;
  const nx = (i) => (closed ? (i + 1) % n : Math.min(n - 1, i + 1));
  const pv = (i) => (closed ? (i - 1 + n) % n : Math.max(0, i - 1));
  const K = 1 / 6;
  const out = (i) => {
    const p = A[i], N = A[nx(i)], R = A[pv(i)];
    return p.c ? P(p.x + (N.x - p.x) / 3, p.y + (N.y - p.y) / 3) : P(p.x + (N.x - R.x) * K, p.y + (N.y - R.y) * K);
  };
  const inn = (j) => {
    const p = A[j], N = A[nx(j)], R = A[pv(j)];
    return p.c ? P(p.x + (R.x - p.x) / 3, p.y + (R.y - p.y) / 3) : P(p.x - (N.x - R.x) * K, p.y - (N.y - R.y) * K);
  };
  const pts = [P(A[0].x, A[0].y)];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = nx(i);
    pts.push(out(i), inn(j), P(A[j].x, A[j].y));
  }
  return pts;
}

// Багатокутник, кожна сторона якого — крива Безьє. bend > 0: сторони
// вгнуті до центра (зірка), bend < 0: випуклі (заокруглений трикутник).
function bentPoly(verts, bend) {
  const n = verts.length;
  const C = P(verts.reduce((s, v) => s + v[0], 0) / n, verts.reduce((s, v) => s + v[1], 0) / n);
  const pts = [P(verts[0][0], verts[0][1])];
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const pull = (t) => {
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      return P(x + (C.x - x) * bend, y + (C.y - y) * bend);
    };
    pts.push(pull(1 / 3), pull(2 / 3), P(b[0], b[1]));
  }
  return pts;
}

// shift — з якої за порядком вершини починається обхід (потрібно для морфінгу,
// щоб початок обходу зірки був близько до початку обходу еліпса).
export function star(cx, cy, R, r, rotDeg, bend = 0.3, n = 5, shift = 0) {
  let verts = [];
  for (let i = 0; i < 2 * n; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = ((rotDeg + 90) * Math.PI) / 180 + (i * Math.PI) / n;
    verts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  verts = verts.slice(shift).concat(verts.slice(0, shift));
  return bentPoly(verts, bend);
}

// Один сегмент Безьє «вручну»: [x0,y0, x1,y1, x2,y2, x3,y3]
const seg = (a) => [P(a[0], a[1]), P(a[2], a[3]), P(a[4], a[5]), P(a[6], a[7])];

// Створює малюнок. Викликається знову при «Скинути» — повертає свіжі копії.
export function buildBear() {
  const paths = [];
  const add = (name, pts, o = {}) =>
    paths.push({ name, pts, closed: !!o.closed, fill: o.fill ?? null, color: o.color ?? "#15171a", width: o.width ?? 1 });
  const addSym = (name, pts, o) => {
    add(name + " (л)", pts, o);
    add(name + " (п)", mirrorPts(pts), o);
  };

  // --- зірочки та «ніжки» до них ---
  add("зірка велика (л)", star(14, 58, 11.5, 4.4, 18), { closed: true, fill: "#ffffff" });
  add("зірка мала (л)", star(9, 32, 8, 3.3, -6), { closed: true, fill: "#ffffff" });
  add("зірка велика (п)", star(108, 52, 11.5, 4.4, -12), { closed: true, fill: "#ffffff" });
  add("стебло (л)", seg([17, 51, 20, 47, 23, 43, 27, 40]));
  add("стебло (п)", seg([105, 45, 101, 42, 98, 40, 94, 38]));

  // --- вуха ---
  addSym("вухо", ellipse(42, 91, 8.5, 8.5), { closed: true, fill: "#ffffff" });
  addSym("вухо всередині", ellipse(42.3, 91.3, 4.6, 4.6), { closed: true, fill: "#ffffff" });

  // --- тулуб, живіт ---
  add("тулуб", smooth([[48, 62], [42, 51], [39, 37], [42, 23], [50, 14], [60, 12], [70, 14], [78, 23], [81, 37], [78, 51], [72, 62], [60, 65]], true), { closed: true, fill: "#ffffff" });
  add("живіт", ellipse(60, 34, 10.5, 13), { closed: true, fill: "#ffffff" });
  add("усмішка на животі", seg([54.5, 32, 56.5, 26.5, 63.5, 26.5, 65.5, 32]));
  addSym("лямка", seg([50.5, 63, 52, 56, 52.5, 50, 53, 45]));

  // --- ноги ---
  addSym("лапа-нога", ellipse(43, 14, 12, 8.5, 14), { closed: true, fill: "#ffffff" });
  addSym("подушечка ноги", ellipse(43.5, 14.5, 6.5, 4.5, 14), { closed: true, fill: "#ffffff" });

  // --- руки ---
  addSym("рука", smooth([[44, 60], [34, 57], [27, 48], [24, 38], [29, 31], [35.5, 34], [37.5, 43], [44, 50]], true), { closed: true, fill: "#ffffff" });

  // --- голова ---
  add("голова", ellipse(60, 76, 22, 18), { closed: true, fill: "#ffffff" });
  add("морда", ellipse(60, 69, 9.5, 7.2), { closed: true, fill: "#ffffff" });
  addSym("око", ellipse(51.5, 79, 1.9, 2.1), { closed: true, fill: "#15171a" });
  add("ніс", bentPoly([[55.7, 73.6], [64.3, 73.6], [60, 69.4]], -0.32), { closed: true, fill: "#15171a" });
  add("носова борозенка", seg([60, 69.6, 60, 68.6, 60, 67.9, 60, 67]));
  add("рот (л)", seg([60, 67, 59, 64.6, 56.6, 64, 55, 65.9]));
  add("рот (п)", seg([60, 67, 61, 64.6, 63.4, 64, 65, 65.9]));

  return paths;
}
