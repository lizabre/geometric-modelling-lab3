import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { samplePath } from "./bezier.js";

export function createScene(container, state) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
  camera.position.z = 10;

  // ---- сітка (необов'язкова) ----
  const gridMat = new THREE.LineBasicMaterial({ color: 0xe3e6ea, depthTest: false });
  const axisXMat = new THREE.LineBasicMaterial({ color: 0xe8a0a0, depthTest: false });
  const axisYMat = new THREE.LineBasicMaterial({ color: 0x9fd3ad, depthTest: false });
  const mkLines = (Cls, pts, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts.flatMap((p) => [p[0], p[1], 0])), 3));
    const o = new Cls(g, mat);
    o.frustumCulled = false;
    o.renderOrder = -10;
    return o;
  };
  const gridPts = [];
  for (let i = -20; i <= 150; i += 10) {
    gridPts.push([i, -20], [i, 130], [-20, i], [150, i]);
  }
  const grid = mkLines(THREE.LineSegments, gridPts.filter(() => true), gridMat);
  const axisX = mkLines(THREE.Line, [[-20, 0], [150, 0]], axisXMat);
  const axisY = mkLines(THREE.Line, [[0, -20], [0, 130]], axisYMat);
  scene.add(grid, axisX, axisY);

  // ---- об'єкти шляхів: заливка (білим, щоб закривати нижні шари) + контур ----
  const strokeMats = [];
  const items = []; // { fill, line, mat }
  const lineRes = new THREE.Vector2(1, 1);

  function makeItems() {
    items.forEach((it) => {
      if (it.fill) scene.remove(it.fill);
      scene.remove(it.line);
    });
    items.length = 0;
    state.paths.forEach((path, i) => {
      const it = { fill: null, line: null, mat: null };
      if (path.fill) {
        it.fill = new THREE.Mesh(
          new THREE.BufferGeometry(),
          new THREE.MeshBasicMaterial({ color: path.fill, side: THREE.DoubleSide, depthTest: false, transparent: true })
        );
        it.fill.renderOrder = i * 2;
        it.fill.frustumCulled = false;
        scene.add(it.fill);
      }
      it.mat = new LineMaterial({ color: path.color, linewidth: 2.2 * path.width, depthTest: false, transparent: true });
      it.mat.resolution.copy(lineRes);
      it.line = new Line2(new LineGeometry(), it.mat);
      it.line.renderOrder = i * 2 + 1;
      it.line.frustumCulled = false;
      scene.add(it.line);
      items.push(it);
    });
  }

  function rebuildPath(i) {
    const path = state.paths[i];
    const it = items[i];
    const samp = samplePath(path.pts);
    const flat = new Float32Array(samp.length * 3);
    samp.forEach((p, k) => {
      flat[k * 3] = p.x;
      flat[k * 3 + 1] = p.y;
    });
    it.line.geometry.dispose();
    it.line.geometry = new LineGeometry();
    it.line.geometry.setPositions(flat);
    if (it.fill) {
      it.fill.material.opacity = path.fillAlpha ?? 1;
      const poly = samp.slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y));
      it.fill.geometry.dispose();
      it.fill.geometry = new THREE.ShapeGeometry(new THREE.Shape(poly));
    }
  }

  // ---- характеристичний багатокутник: ламана, вузли (чорні), керуючі (зелені) ----
  const polyMat = new THREE.LineBasicMaterial({ color: 0x9aa0a6, depthTest: false, transparent: true });
  const anchorMat = new THREE.PointsMaterial({ color: 0x111111, size: 7, sizeAttenuation: false, depthTest: false, transparent: true });
  const ctrlMat = new THREE.PointsMaterial({ color: 0x1fb04a, size: 7, sizeAttenuation: false, depthTest: false, transparent: true });
  const selMat = new THREE.PointsMaterial({ color: 0xe5383b, size: 14, sizeAttenuation: false, depthTest: false, transparent: true });
  const selPts = new THREE.Points(new THREE.BufferGeometry(), selMat); // «ореол» навколо вибраної точки (усі матеріали прозорі, щоб порядок шарів визначався renderOrder)
  selPts.renderOrder = 100000.5;
  selPts.frustumCulled = false;
  scene.add(selPts);
  const polyLines = new THREE.LineSegments(new THREE.BufferGeometry(), polyMat);
  const anchorPts = new THREE.Points(new THREE.BufferGeometry(), anchorMat);
  const ctrlPts = new THREE.Points(new THREE.BufferGeometry(), ctrlMat);
  [polyLines, anchorPts, ctrlPts].forEach((o, k) => {
    o.renderOrder = 100000 + k;
    o.frustumCulled = false;
    scene.add(o);
  });
  const setPos = (obj, arr) => {
    obj.geometry.dispose();
    obj.geometry = new THREE.BufferGeometry();
    obj.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(arr), 3));
  };

  function rebuildOverlay() {
    const lines = [], anchors = [], ctrls = [];
    state.paths.forEach((path) => {
      if (path.hidden) return;
      const pts = path.pts;
      pts.forEach((p, i) => {
        if (i > 0) lines.push(pts[i - 1].x, pts[i - 1].y, 0, p.x, p.y, 0);
        // замкнений контур: останній вузол — дубль першого, малюємо один раз
        if (path.closed && i === pts.length - 1) return;
        (i % 3 === 0 ? anchors : ctrls).push(p.x, p.y, 0);
      });
    });
    setPos(polyLines, lines);
    setPos(anchorPts, anchors);
    setPos(ctrlPts, ctrls);
    const on = state.show.polygon;
    polyLines.visible = anchorPts.visible = ctrlPts.visible = on;
    const sel = state.selected;
    const sp = sel && state.paths[sel.pi] ? state.paths[sel.pi].pts[sel.idx] : null;
    setPos(selPts, sp ? [sp.x, sp.y, 0] : []);
    selPts.visible = on && !!sp;
  }

  // ---- камера: вписуємо малюнок з відступом ----
  const bounds = { x0: -6, x1: 126, y0: -2, y1: 104 };
  function fitCamera() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    lineRes.set(w, h);
    items.forEach((it) => it.mat.resolution.set(w, h));
    const cx = (bounds.x0 + bounds.x1) / 2;
    const cy = (bounds.y0 + bounds.y1) / 2;
    const bw = bounds.x1 - bounds.x0;
    const bh = bounds.y1 - bounds.y0;
    const aspect = w / h;
    let halfX = bw / 2;
    let halfY = bh / 2;
    if (halfX / halfY < aspect) halfX = halfY * aspect;
    else halfY = halfX / aspect;
    camera.left = cx - halfX;
    camera.right = cx + halfX;
    camera.top = cy + halfY;
    camera.bottom = cy - halfY;
    camera.updateProjectionMatrix();
  }

  function render() {
    fitCamera();
    items.forEach((it, i) => {
      it.mat.linewidth = 2.2 * state.lineWidth;
      const vis = !state.paths[i].hidden;
      it.line.visible = vis;
      if (it.fill) it.fill.visible = vis;
    });
    grid.visible = axisX.visible = axisY.visible = state.show.grid;
    renderer.render(scene, camera);
  }

  // клієнтські координати → координати малюнка
  function toWorld(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    return {
      x: camera.left + ((clientX - r.left) / r.width) * (camera.right - camera.left),
      y: camera.top - ((clientY - r.top) / r.height) * (camera.top - camera.bottom),
    };
  }

  // найближча опорна точка в межах tolPx пікселів: { path, idx } | null
  function pickPoint(clientX, clientY, tolPx = 10) {
    const w = toWorld(clientX, clientY);
    const r = renderer.domElement.getBoundingClientRect();
    const tol = (tolPx * (camera.right - camera.left)) / r.width;
    let best = null;
    state.paths.forEach((path, pi) => {
      if (path.hidden) return;
      path.pts.forEach((p, idx) => {
        if (path.closed && idx === path.pts.length - 1) return;
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        // у разі збігу віддаємо перевагу точці з верхнього шару (більший pi)
        if (d <= tol && (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && pi > best.pi))) best = { d, pi, idx };
      });
    });
    return best;
  }

  function rebuildAll() {
    makeItems();
    state.paths.forEach((_, i) => rebuildPath(i));
    rebuildOverlay();
  }

  window.addEventListener("resize", render);
  rebuildAll();

  return { render, rebuildAll, rebuildPath, rebuildOverlay, toWorld, pickPoint, canvas: renderer.domElement };
}
