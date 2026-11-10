import { segmentCount } from "./bezier.js";
import { createMorph } from "./morph.js";
import { translateMatrix, rotateAbout, applyMatrix } from "./matrix.js";

// Переміщення опорної точки. Масив точок шляху має довжину 3n+1: точки з
// індексом, кратним 3, — вузли; решта — керуючі. У замкненого шляху перший і
// останній вузли — одна й та сама точка, тому рухаємо обидва.
export function movePoint(path, idx, x, y, withHandles) {
  const pts = path.pts;
  const last = pts.length - 1;
  const dx = x - pts[idx].x;
  const dy = y - pts[idx].y;
  const shift = (i) => {
    if (i >= 0 && i <= last) {
      pts[i].x += dx;
      pts[i].y += dy;
    }
  };
  const isAnchor = idx % 3 === 0;
  if (path.closed && isAnchor && (idx === 0 || idx === last)) {
    shift(0);
    shift(last);
    if (withHandles) {
      shift(1);
      shift(last - 1);
    }
  } else {
    shift(idx);
    if (isAnchor && withHandles) {
      shift(idx - 1);
      shift(idx + 1);
    }
  }
}

export function bindUI(state, app, buildBear) {
  const $ = (id) => document.getElementById(id);

  function updateInfo() {
    const segs = state.paths.reduce((s, p) => s + segmentCount(p.pts), 0);
    $("roPaths").textContent = state.paths.length;
    $("roSegs").textContent = segs;
    $("roPts").textContent = state.paths.reduce(
      (s, p) => s + p.pts.length - (p.closed ? 1 : 0),
      0,
    );
  }

  $("showPolygon").addEventListener("change", (e) => {
    state.show.polygon = e.target.checked;
    app.rebuildOverlay();
    app.render();
  });
  $("showGrid").addEventListener("change", (e) => {
    state.show.grid = e.target.checked;
    app.render();
  });
  $("moveHandles").addEventListener(
    "change",
    (e) => (state.moveHandles = e.target.checked),
  );
  $("lineWidth").addEventListener("input", (e) => {
    state.lineWidth = parseFloat(e.target.value);
    $("lineWidthVal").textContent = state.lineWidth.toFixed(1);
    app.render();
  });

  // ---- ваги керуючих точок (раціональні криві Безьє) ----
  const isHandle = (idx) => idx % 3 !== 0; // вузли мають індекс, кратний 3
  const rebuildAllPaths = () => {
    state.paths.forEach((_, i) => app.rebuildPath(i));
    app.render();
  };

  // повзунок «усі»: однакова вага для всіх керуючих точок
  $("allW").addEventListener("input", (e) => {
    const w = parseFloat(e.target.value);
    $("allWVal").textContent = w.toFixed(2);
    state.paths.forEach((path) =>
      path.pts.forEach((p, i) => {
        if (isHandle(i)) p.w = w;
      }),
    );
    rebuildAllPaths();
    refreshSelected();
  });

  // вага вибраної точки
  $("selW").addEventListener("input", (e) => {
    const sel = state.selected;
    if (!sel || !isHandle(sel.idx)) return;
    const w = parseFloat(e.target.value);
    state.paths[sel.pi].pts[sel.idx].w = w;
    $("selWVal").textContent = w.toFixed(2);
    app.rebuildPath(sel.pi);
    app.render();
  });

  $("resetWeights").addEventListener("click", () => {
    state.paths.forEach((path) =>
      path.pts.forEach((p) => {
        p.w = 1;
      }),
    );
    $("allW").value = 1;
    $("allWVal").textContent = "1.00";
    rebuildAllPaths();
    refreshSelected();
  });

  function refreshSelected() {
    const sel = state.selected;
    const slider = $("selW");
    if (!sel || !state.paths[sel.pi]) {
      $("selName").textContent = "не вибрано";
      slider.disabled = true;
      $("selWVal").textContent = "–";
      return;
    }
    const path = state.paths[sel.pi];
    if (isHandle(sel.idx)) {
      const w = path.pts[sel.idx].w ?? 1;
      $("selName").textContent = `${path.name}, керуюча точка №${sel.idx}`;
      slider.disabled = false;
      slider.value = w;
      $("selWVal").textContent = w.toFixed(2);
    } else {
      $("selName").textContent = `${path.name}, вузол №${sel.idx}`;
      slider.disabled = true;
      slider.value = 1;
      $("selWVal").textContent = "1.00";
    }
  }
  function selectPoint(hit) {
    state.selected = hit ? { pi: hit.pi, idx: hit.idx } : null;
    app.rebuildOverlay();
    app.render();
    refreshSelected();
  }

  // Застосувати матрицю перетворення до ВСІХ опорних точок усіх контурів
  function transformAll(M) {
    if (morph.active()) return; // під час морфінгу не змінюємо точки
    state.paths.forEach((path, i) => {
      path.pts.forEach((p) => {
        const q = applyMatrix(p, M);
        p.x = q.x;
        p.y = q.y;
      });
      app.rebuildPath(i);
    });
    app.rebuildOverlay();
    app.render();
    morph.invalidate(); // новий стан стає відправною фігурою морфінгу
  }
  const num = (id) => parseFloat($(id).value) || 0;
  $("applyTranslate").addEventListener("click", () =>
    transformAll(translateMatrix(num("tdx"), num("tdy"))),
  );
  $("applyRotate").addEventListener("click", () =>
    transformAll(rotateAbout(num("rx"), num("ry"), num("rangle"))),
  );

  // ---- анімація-морфінг ----
  const morph = createMorph(state, app, () => {
    $("morphS").value = Math.round(morph.s * 1000);
    $("morphSVal").textContent = Math.round(morph.s * 100) + "%";
    $("morphPlay").textContent = morph.playing
      ? "⏸ Пауза"
      : morph.s >= 1 && !morph.loop
        ? "↺ Назад"
        : "▶ Старт";
    updateInfo();
  });
  $("morphPlay").addEventListener("click", () => {
    if (morph.playing) morph.stop();
    else {
      if (morph.s >= 1) morph.dir = -1;
      else if (morph.s <= 0) morph.dir = 1;
      morph.start();
    }
    $("morphPlay").textContent = morph.playing ? "⏸ Пауза" : "▶ Старт";
  });
  $("morphReset").addEventListener("click", () => {
    morph.stop();
    morph.dir = 1;
    morph.set(0);
    $("morphPlay").textContent = "▶ Старт";
  });
  $("morphS").addEventListener("input", (e) => {
    morph.stop();
    $("morphPlay").textContent = "▶ Старт";
    morph.set(parseFloat(e.target.value) / 1000);
  });
  $("morphSpeed").addEventListener("input", (e) => {
    morph.speed = parseFloat(e.target.value);
    $("morphSpeedVal").textContent = morph.speed.toFixed(2);
  });
  $("morphLoop").addEventListener(
    "change",
    (e) => (morph.loop = e.target.checked),
  );

  $("reset").addEventListener("click", () => {
    morph.stop();
    morph.s = 0;
    morph.invalidate();
    $("morphS").value = 0;
    $("morphSVal").textContent = "0%";
    $("morphPlay").textContent = "▶ Старт";
    state.paths = buildBear();
    state.selected = null;
    $("allW").value = 1;
    $("allWVal").textContent = "1.00";
    refreshSelected();
    app.rebuildAll();
    app.render();
    updateInfo();
  });

  $("export").addEventListener("click", () => {
    const data = state.paths.map((p) => ({
      name: p.name,
      closed: p.closed,
      fill: p.fill,
      points: p.pts.map((q) => [
        +q.x.toFixed(3),
        +q.y.toFixed(3),
        +(q.w ?? 1).toFixed(3),
      ]), // x, y, вага
    }));
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "bear-bezier-points.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // ---- перетягування опорних точок мишею (коли багатокутник видимий) ----
  let drag = null;
  const canvas = app.canvas;
  canvas.addEventListener("pointerdown", (e) => {
    if (!state.show.polygon || morph.active()) return; // під час морфінгу точки не редагуються
    const hit = app.pickPoint(e.clientX, e.clientY);
    selectPoint(hit); // клік по точці вибирає її (показує вагу), клік повз — знімає вибір
    if (!hit) return;
    drag = hit;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) {
      canvas.style.cursor =
        state.show.polygon &&
        !morph.active() &&
        app.pickPoint(e.clientX, e.clientY)
          ? "grab"
          : "default";
      return;
    }
    const w = app.toWorld(e.clientX, e.clientY);
    movePoint(state.paths[drag.pi], drag.idx, w.x, w.y, state.moveHandles);
    app.rebuildPath(drag.pi);
    app.rebuildOverlay();
    app.render();
  });
  const end = () => {
    if (drag) morph.invalidate(); // відредаговані точки — нова відправна фігура морфінгу
    drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  refreshSelected();
  updateInfo();
}
