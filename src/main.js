import { buildBear } from "./bear.js";
import { createScene } from "./scene.js";
import { bindUI } from "./ui.js";

const state = {
  paths: buildBear(),
  show: { polygon: true, grid: false },
  lineWidth: 1,
  selected: null, // вибрана опорна точка: { pi: індекс контуру, idx: індекс точки }
  moveHandles: true, // при перетягуванні вузла разом із ним рухаються його керуючі точки
};
const app = createScene(document.getElementById("stage"), state);
bindUI(state, app, buildBear);
app.render();
