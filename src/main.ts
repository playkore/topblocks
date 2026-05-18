import { World } from "./world/World";
import { Camera } from "./game/Camera";
import { PixiRenderer } from "./render/PixiRenderer";
import { clamp } from "./shared/math";

const gameRoot = document.getElementById("game");
const seedInput = document.getElementById("seedInput") as HTMLInputElement;
const blastInput = document.getElementById("blastInput") as HTMLInputElement;
const blastLabel = document.getElementById("blastLabel") as HTMLSpanElement;
const applyBtn = document.getElementById("applyBtn") as HTMLButtonElement;
const randomBtn = document.getElementById("randomBtn") as HTMLButtonElement;
const centerBtn = document.getElementById("centerBtn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

if (!gameRoot) throw new Error("Missing #game root");

const world = new World(seedInput.value.trim() || "topblocks-001");
const camera = new Camera();
const renderer = new PixiRenderer();

let isPointerDown = false;
let isDragging = false;
let pointerMoved = false;
let lastPointerX = 0;
let lastPointerY = 0;
let pointerDownX = 0;
let pointerDownY = 0;

function pointerPos(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = renderer.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (renderer.canvas.width / rect.width),
    y: (event.clientY - rect.top) * (renderer.canvas.height / rect.height),
  };
}

function screenToWorldTile(event: PointerEvent | WheelEvent) {
  const pointer = pointerPos(event);
  return camera.screenToTile(pointer.x, pointer.y);
}

function redraw(): void {
  renderer.render(world, camera);
  const summary = world.getFeatureSummary();
  statusEl.textContent = `seed ${world.state.seedText} | zoom ${camera.zoom.toFixed(2)} | buildings ${summary.buildingCount} | cities ${summary.cityCount} | forest patches ${summary.treePatchCount}`;
}

function applySeed(): void {
  world.setSeed(seedInput.value.trim() || "0");
  redraw();
}

function centerCamera(): void {
  camera.zoom = 1;
  camera.centerOnTile(0, 0, renderer.width, renderer.height);
  redraw();
}

function tryDamageAtPointer(event: PointerEvent): void {
  const { tileX, tileY } = screenToWorldTile(event);
  world.applyDamageAt(tileX, tileY, Number(blastInput.value));
  redraw();
}

function updateBlastLabel(): void {
  blastLabel.textContent = `${blastInput.value}%`;
}

canvasSetup().catch(error => {
  console.error(error);
  statusEl.textContent = "failed to start";
});

async function canvasSetup(): Promise<void> {
  await renderer.init(gameRoot);
  camera.centerOnTile(0, 0, renderer.width, renderer.height);

  renderer.canvas.addEventListener("pointerdown", event => {
    isPointerDown = true;
    isDragging = false;
    pointerMoved = false;
    renderer.canvas.classList.add("dragging");
    renderer.canvas.setPointerCapture(event.pointerId);
    const pointer = pointerPos(event);
    lastPointerX = pointer.x;
    lastPointerY = pointer.y;
    pointerDownX = pointer.x;
    pointerDownY = pointer.y;
  });

  renderer.canvas.addEventListener("pointermove", event => {
    if (!isPointerDown) return;
    const pointer = pointerPos(event);
    const dx = pointer.x - lastPointerX;
    const dy = pointer.y - lastPointerY;

    if (!isDragging && Math.hypot(pointer.x - pointerDownX, pointer.y - pointerDownY) > 4) {
      isDragging = true;
    }

    if (isDragging) {
      camera.panBy(-dx, -dy);
      redraw();
    }

    if (Math.hypot(pointer.x - pointerDownX, pointer.y - pointerDownY) > 4) pointerMoved = true;
    lastPointerX = pointer.x;
    lastPointerY = pointer.y;
  });

  renderer.canvas.addEventListener("pointerup", event => {
    renderer.canvas.classList.remove("dragging");
    if (isPointerDown && !isDragging && !pointerMoved) tryDamageAtPointer(event);
    isPointerDown = false;
    isDragging = false;
    pointerMoved = false;
    if (renderer.canvas.hasPointerCapture(event.pointerId)) renderer.canvas.releasePointerCapture(event.pointerId);
  });

  renderer.canvas.addEventListener("pointercancel", () => {
    renderer.canvas.classList.remove("dragging");
    isPointerDown = false;
    isDragging = false;
    pointerMoved = false;
  });

  renderer.canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const pointer = pointerPos(event);
    const nextZoom = event.deltaY < 0 ? camera.zoom * 1.15 : camera.zoom / 1.15;
    camera.setZoomAround(pointer.x, pointer.y, nextZoom);
    redraw();
  }, { passive: false });

  blastInput.addEventListener("input", updateBlastLabel);
  applyBtn.addEventListener("click", applySeed);
  randomBtn.addEventListener("click", () => {
    seedInput.value = `world-${Math.floor(Math.random() * 1_000_000_000)}`;
    applySeed();
  });
  centerBtn.addEventListener("click", centerCamera);
  seedInput.addEventListener("keydown", event => {
    if (event.key === "Enter") applySeed();
  });

  updateBlastLabel();
  redraw();
  window.addEventListener("resize", redraw);
  requestAnimationFrame(function loop() {
    redraw();
    requestAnimationFrame(loop);
  });
}
