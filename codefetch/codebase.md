<source_code>
index.html
```
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Topblocks</title>
  <link rel="icon" href="data:," />
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1220;
      --panel: #182235;
      --panel-2: #111827;
      --text: #e5eefc;
      --muted: #8ea2be;
      --border: #2e415f;
      --accent: #70a5ff;
      --accent-2: #d4a258;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        linear-gradient(180deg, #07101c 0%, var(--bg) 70%, #060c15 100%);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }

    .app {
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
      padding: 14px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      background: color-mix(in srgb, var(--panel) 94%, black);
      border: 1px solid var(--border);
      border-radius: 14px;
    }

    h1 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0;
    }

    .subtitle {
      margin-top: 3px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
      white-space: nowrap;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    input, button {
      height: 34px;
      border-radius: 9px;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text);
      padding: 0 10px;
      font: inherit;
    }

    input[type="text"] { width: 150px; }
    input[type="range"] { width: 120px; padding: 0; }

    button {
      cursor: pointer;
      background: #2b3d58;
    }

    button:hover {
      background: #39516f;
    }

    .stage {
      min-height: 0;
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      background: #08111d;
      position: relative;
    }

    #game {
      width: 100%;
      height: 100%;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: grab;
    }

    canvas.dragging {
      cursor: grabbing;
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="topbar">
      <div>
        <h1>Topblocks</h1>
        <div id="status" class="subtitle"></div>
      </div>
      <div class="controls">
        <input id="seedInput" type="text" aria-label="Seed" value="topblocks-001" />
        <label>Сила
          <input id="blastInput" type="range" min="20" max="100" value="60" />
          <span id="blastLabel">60%</span>
        </label>
        <button id="applyBtn">Применить seed</button>
        <button id="randomBtn">Случайный seed</button>
        <button id="centerBtn">В центр</button>
      </div>
    </section>
    <section class="stage">
      <div id="game"></div>
    </section>
  </main>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

package.json
```
{
  "name": "topblocks-migration",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "pixi.js": "^8.7.2"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.1.2"
  }
}
```

tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

vite.config.ts
```
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  test: {
    environment: "node",
  },
});
```

vitest.config.ts
```
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

src/main.ts
```
import { World } from "./world/World";
import { Camera } from "./game/Camera";
import { PixiRenderer } from "./render/PixiRenderer";

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
let redrawQueued = false;
let statusDirty = true;
let lastStatusUpdateAt = 0;

function pointerPos(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = renderer.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function screenToWorldTile(event: PointerEvent | WheelEvent) {
  const pointer = pointerPos(event);
  return camera.screenToTile(pointer.x, pointer.y);
}

function renderNow(): void {
  renderer.render(world, camera);

  const now = performance.now();
  if (statusDirty || now - lastStatusUpdateAt > 250) {
    const summary = world.getFeatureSummary();
    statusEl.textContent = `seed ${world.state.seedText} | zoom ${camera.zoom.toFixed(2)} | buildings ${summary.buildingCount} | cities ${summary.cityCount} | forest patches ${summary.treePatchCount}`;
    statusDirty = false;
    lastStatusUpdateAt = now;
  }
}

function requestRedraw(updateStatus = false): void {
  if (updateStatus) statusDirty = true;
  if (redrawQueued) return;

  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    renderNow();
  });
}

function applySeed(): void {
  world.setSeed(seedInput.value.trim() || "0");
  requestRedraw(true);
}

function centerCamera(): void {
  camera.zoom = 1;
  camera.centerOnTile(0, 0, renderer.width, renderer.height);
  requestRedraw(true);
}

function tryDamageAtPointer(event: PointerEvent): void {
  const { tileX, tileY } = screenToWorldTile(event);
  world.applyDamageAt(tileX, tileY, Number(blastInput.value));
  requestRedraw(true);
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
      requestRedraw();
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
    requestRedraw(true);
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
  requestRedraw(true);
  window.addEventListener("resize", () => requestRedraw(true));
}
```

.github/workflows/deploy.yml
```
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      VITE_BASE: /topblocks/
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

src/game/Camera.ts
```
import { clamp, mod } from "../shared/math";

export const VIEW_BASE_TILE_SIZE = 16;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  get tileSize(): number {
    return VIEW_BASE_TILE_SIZE * this.zoom;
  }

  centerOnTile(tileX: number, tileY: number, screenWidth: number, screenHeight: number): void {
    this.x = tileX * this.tileSize - screenWidth / 2;
    this.y = tileY * this.tileSize - screenHeight / 2;
  }

  setZoomAround(screenX: number, screenY: number, nextZoom: number): void {
    const oldTileSize = this.tileSize;
    const worldTileX = (this.x + screenX) / oldTileSize;
    const worldTileY = (this.y + screenY) / oldTileSize;
    this.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const newTileSize = this.tileSize;
    this.x = worldTileX * newTileSize - screenX;
    this.y = worldTileY * newTileSize - screenY;
  }

  panBy(deltaX: number, deltaY: number): void {
    this.x += deltaX;
    this.y += deltaY;
  }

  screenToTile(screenX: number, screenY: number): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor((this.x + screenX) / this.tileSize),
      tileY: Math.floor((this.y + screenY) / this.tileSize),
    };
  }

  visibleBounds(screenWidth: number, screenHeight: number) {
    const startTileX = Math.floor(this.x / this.tileSize);
    const startTileY = Math.floor(this.y / this.tileSize);
    const offsetX = -mod(this.x, this.tileSize);
    const offsetY = -mod(this.y, this.tileSize);
    const tilesAcross = Math.ceil(screenWidth / this.tileSize) + 2;
    const tilesDown = Math.ceil(screenHeight / this.tileSize) + 2;

    return { startTileX, startTileY, offsetX, offsetY, tilesAcross, tilesDown };
  }
}
```

src/generation/buildings.ts
```
import { TILE, type BuildingObject, type BuildingOrientation, type BuildingSnapshot, type Rect, type RoofMask, type TileGrid } from "../world/types";
import { cloneGrid, countNeighbors, inBounds, makeGrid } from "../shared/math";
import { createRng, randInt, random01 } from "./rng";
import type { World } from "../world/World";

export const BUILDING_PADDING = 4;
export const BUILDING_MIN_W = 12;
export const BUILDING_MAX_W = 20;
export const BUILDING_MIN_H = 9;
export const BUILDING_MAX_H = 16;
export const BUILDING_ATTEMPTS = 4;

function isGrassLike(tile: string): boolean {
  return tile === TILE.GRASS || tile === TILE.DIRT;
}

function isBuildingTile(tile: string): boolean {
  return tile !== TILE.GRASS && tile !== TILE.WATER && tile !== TILE.ROCK;
}

function splitRect(rect: Rect, rng: () => number, depth = 0): Rect[] {
  const minRoom = 4;
  const maxDepth = 3;
  if (depth >= maxDepth) return [rect];

  const canSplitV = rect.w >= minRoom * 2 + 2;
  const canSplitH = rect.h >= minRoom * 2 + 2;
  if (!canSplitV && !canSplitH) return [rect];
  if (depth > 1 && rng() < 0.25) return [rect];

  let splitVertical: boolean;
  if (canSplitV && canSplitH) splitVertical = rect.w > rect.h ? rng() < 0.65 : rng() < 0.35;
  else splitVertical = canSplitV;

  if (splitVertical) {
    const split = randInt(rng, rect.x + minRoom, rect.x + rect.w - minRoom - 1);
    const left = { x: rect.x, y: rect.y, w: split - rect.x, h: rect.h };
    const right = { x: split, y: rect.y, w: rect.x + rect.w - split, h: rect.h };
    return [...splitRect(left, rng, depth + 1), ...splitRect(right, rng, depth + 1)];
  }

  const split = randInt(rng, rect.y + minRoom, rect.y + rect.h - minRoom - 1);
  const top = { x: rect.x, y: rect.y, w: rect.w, h: split - rect.y };
  const bottom = { x: rect.x, y: split, w: rect.w, h: rect.y + rect.h - split };
  return [...splitRect(top, rng, depth + 1), ...splitRect(bottom, rng, depth + 1)];
}

function carveRooms(targetGrid: TileGrid, roomList: Rect[]): void {
  for (const room of roomList) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        const isEdge = x === room.x || y === room.y || x === room.x + room.w - 1 || y === room.y + room.h - 1;
        if (isEdge) {
          if (targetGrid[y][x] !== TILE.DOOR) targetGrid[y][x] = TILE.WALL;
        } else {
          targetGrid[y][x] = TILE.FLOOR;
        }
      }
    }
  }
}

function addOuterIrregularity(targetGrid: TileGrid, rng: () => number): void {
  const main = {
    x: BUILDING_PADDING,
    y: BUILDING_PADDING,
    w: targetGrid[0].length - BUILDING_PADDING * 2,
    h: targetGrid.length - BUILDING_PADDING * 2,
  };
  const additions = randInt(rng, 1, 3);

  for (let i = 0; i < additions; i++) {
    const side = ["top", "right", "bottom", "left"][randInt(rng, 0, 3)];
    let add: Rect;
    if (side === "top") {
      const w = randInt(rng, 4, 7);
      add = {
        x: randInt(rng, main.x + 1, main.x + main.w - w - 1),
        y: Math.max(1, main.y - randInt(rng, 1, 3)),
        w,
        h: randInt(rng, 3, 5),
      };
    } else if (side === "bottom") {
      const w = randInt(rng, 4, 7);
      const h = randInt(rng, 3, 5);
      add = {
        x: randInt(rng, main.x + 1, main.x + main.w - w - 1),
        y: main.y + main.h - 1,
        w,
        h,
      };
    } else if (side === "left") {
      const h = randInt(rng, 4, 7);
      add = {
        x: Math.max(1, main.x - randInt(rng, 1, 3)),
        y: randInt(rng, main.y + 1, main.y + main.h - h - 1),
        w: randInt(rng, 3, 5),
        h,
      };
    } else {
      const h = randInt(rng, 4, 7);
      const w = randInt(rng, 3, 5);
      add = {
        x: main.x + main.w - 1,
        y: randInt(rng, main.y + 1, main.y + main.h - h - 1),
        w,
        h,
      };
    }

    for (let y = add.y; y < add.y + add.h; y++) {
      for (let x = add.x; x < add.x + add.w; x++) {
        if (!inBounds(targetGrid, x, y)) continue;
        const isEdge = x === add.x || y === add.y || x === add.x + add.w - 1 || y === add.y + add.h - 1;
        targetGrid[y][x] = isEdge ? TILE.WALL : TILE.FLOOR;
      }
    }
  }
}

function addDoorsBetweenRooms(targetGrid: TileGrid, roomList: Rect[], rng: () => number): void {
  for (let i = 0; i < roomList.length; i++) {
    for (let j = i + 1; j < roomList.length; j++) {
      const a = roomList[i];
      const b = roomList[j];

      if (a.x + a.w === b.x || b.x + b.w === a.x) {
        const wallX = a.x + a.w === b.x ? b.x : a.x;
        const y1 = Math.max(a.y + 1, b.y + 1);
        const y2 = Math.min(a.y + a.h - 2, b.y + b.h - 2);
        if (y2 >= y1 && rng() < 0.9) {
          const y = randInt(rng, y1, y2);
          targetGrid[y][wallX] = TILE.DOOR;
          if (inBounds(targetGrid, wallX - 1, y)) targetGrid[y][wallX - 1] = TILE.FLOOR;
          if (inBounds(targetGrid, wallX + 1, y)) targetGrid[y][wallX + 1] = TILE.FLOOR;
        }
      }

      if (a.y + a.h === b.y || b.y + b.h === a.y) {
        const wallY = a.y + a.h === b.y ? b.y : a.y;
        const x1 = Math.max(a.x + 1, b.x + 1);
        const x2 = Math.min(a.x + a.w - 2, b.x + b.w - 2);
        if (x2 >= x1 && rng() < 0.9) {
          const x = randInt(rng, x1, x2);
          targetGrid[wallY][x] = TILE.DOOR;
          if (inBounds(targetGrid, x, wallY - 1)) targetGrid[wallY - 1][x] = TILE.FLOOR;
          if (inBounds(targetGrid, x, wallY + 1)) targetGrid[wallY + 1][x] = TILE.FLOOR;
        }
      }
    }
  }
}

function addEntrance(targetGrid: TileGrid, rng: () => number): void {
  const candidates: { x: number; y: number }[] = [];
  for (let y = 1; y < targetGrid.length - 1; y++) {
    for (let x = 1; x < targetGrid[0].length - 1; x++) {
      if (targetGrid[y][x] !== TILE.WALL) continue;
      const floorNeighbors = countNeighbors(targetGrid, x, y, [TILE.FLOOR, TILE.DOOR]);
      const grassNeighbors = countNeighbors(targetGrid, x, y, [TILE.GRASS, TILE.DIRT]);
      if (floorNeighbors > 0 && grassNeighbors > 0) candidates.push({ x, y });
    }
  }

  if (candidates.length) {
    const door = candidates[randInt(rng, 0, candidates.length - 1)];
    targetGrid[door.y][door.x] = TILE.DOOR;
  }
}

function addFloorVariation(targetGrid: TileGrid, rng: () => number): void {
  for (let y = 0; y < targetGrid.length; y++) {
    for (let x = 0; x < targetGrid[0].length; x++) {
      if (targetGrid[y][x] === TILE.FLOOR && rng() < 0.08) targetGrid[y][x] = TILE.DIRT;
      if (targetGrid[y][x] === TILE.FLOOR && rng() < 0.04) targetGrid[y][x] = TILE.WOOD;
    }
  }
}

function getBuildingBounds(targetGrid: TileGrid): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < targetGrid.length; y++) {
    for (let x = 0; x < targetGrid[0].length; x++) {
      if (!isBuildingTile(targetGrid[y][x])) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function chooseRoofOrientation(bounds: Rect, seed: number): BuildingOrientation {
  if (Math.abs(bounds.w - bounds.h) <= 3) return random01(seed, bounds.x, bounds.y, 8800) < 0.5 ? "horizontal" : "vertical";
  return bounds.w >= bounds.h ? "horizontal" : "vertical";
}

function createRoofMask(targetGrid: TileGrid): RoofMask {
  const mask = makeGrid(targetGrid[0].length, targetGrid.length, 0);
  for (let y = 0; y < targetGrid.length; y++) {
    for (let x = 0; x < targetGrid[0].length; x++) {
      if (isBuildingTile(targetGrid[y][x])) mask[y][x] = 1;
    }
  }
  return mask;
}

function applySnapshot(building: BuildingObject, snapshot: BuildingSnapshot): void {
  building.grid = cloneGrid(snapshot.grid);
  building.roofMask = cloneGrid(snapshot.roofMask);
  building.damageCount = snapshot.damageCount;
}

export function createBuildingGrid(world: World, footprintW: number, footprintH: number, seedText: string) {
  const rng = createRng(seedText);
  const gridW = footprintW + BUILDING_PADDING * 2;
  const gridH = footprintH + BUILDING_PADDING * 2;
  const grid = makeGrid(gridW, gridH, TILE.GRASS);
  const baseRect = { x: BUILDING_PADDING, y: BUILDING_PADDING, w: footprintW, h: footprintH };
  const rooms = splitRect(baseRect, rng);

  carveRooms(grid, rooms);
  addOuterIrregularity(grid, rng);
  addDoorsBetweenRooms(grid, rooms, rng);
  addEntrance(grid, rng);
  addFloorVariation(grid, rng);

  const bounds = getBuildingBounds(grid);
  return {
    grid,
    rooms,
    roofMask: createRoofMask(grid),
    bounds,
    orientation: chooseRoofOrientation(bounds, world.state.seed),
  };
}

export function cloneSnapshot(snapshot: BuildingSnapshot): BuildingSnapshot {
  return {
    grid: cloneGrid(snapshot.grid),
    roofMask: cloneGrid(snapshot.roofMask),
    damageCount: snapshot.damageCount,
  };
}

export function getBuildingAt(world: World, worldX: number, worldY: number): BuildingObject | null {
  return world.getBuildingAt(worldX, worldY);
}

export function generateBuildingForSector(world: World, sectorX: number, sectorY: number): BuildingObject | null {
  const key = `${sectorX},${sectorY}`;
  const cached = world.buildingCache.get(key);
  if (cached !== undefined) return cached;

  const terrainBias = world.getTerrainScoreForSector(sectorX, sectorY);
  const spawnChance = random01(world.state.seed, sectorX, sectorY, 7700);
  const districtBias = world.getDistrictBias(sectorX, sectorY);
  const canSpawn = spawnChance > 0.34 && (terrainBias > 0.35 || districtBias > 0.48);
  if (!canSpawn) {
    world.buildingCache.set(key, null);
    return null;
  }

  for (let attempt = 0; attempt < BUILDING_ATTEMPTS; attempt++) {
    const rng = createRng(`${world.state.seed}:${sectorX}:${sectorY}:${attempt}`);
    const footprintW = randInt(rng, BUILDING_MIN_W, BUILDING_MAX_W);
    const footprintH = randInt(rng, BUILDING_MIN_H, BUILDING_MAX_H);
    const gridW = footprintW + BUILDING_PADDING * 2;
    const gridH = footprintH + BUILDING_PADDING * 2;

    if (gridW >= world.SECTOR_SIZE - 8 || gridH >= world.SECTOR_SIZE - 8) continue;

    const minOriginX = sectorX * world.SECTOR_SIZE + 4;
    const minOriginY = sectorY * world.SECTOR_SIZE + 4;
    const maxOriginX = sectorX * world.SECTOR_SIZE + world.SECTOR_SIZE - gridW - 4;
    const maxOriginY = sectorY * world.SECTOR_SIZE + world.SECTOR_SIZE - gridH - 4;
    if (maxOriginX < minOriginX || maxOriginY < minOriginY) continue;

    const originX = randInt(rng, minOriginX, maxOriginX);
    const originY = randInt(rng, minOriginY, maxOriginY);

    let grassScore = 0;
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        if (isGrassLike(world.getTerrainTile(originX + x, originY + y))) grassScore++;
      }
    }

    const density = grassScore / (gridW * gridH);
    if (density < 0.68) continue;

    const built = createBuildingGrid(world, footprintW, footprintH, `${world.state.seed}:${sectorX}:${sectorY}:${originX}:${originY}`);
    const building: BuildingObject = {
      key,
      sectorX,
      sectorY,
      originX,
      originY,
      width: gridW,
      height: gridH,
      footprintW,
      footprintH,
      grid: built.grid,
      rooms: built.rooms,
      roofMask: built.roofMask,
      bounds: built.bounds,
      orientation: built.orientation,
      damageCount: 0,
      cityKey: null,
    };

    const snapshot = world.state.buildingSnapshots.get(key);
    if (snapshot) applySnapshot(building, snapshot);

    world.buildingCache.set(key, building);
    return building;
  }

  world.buildingCache.set(key, null);
  return null;
}

export function applyDamageToBuilding(world: World, building: BuildingObject, localX: number, localY: number, power: number): void {
  if (!building) return;
  if (!inBounds(building.grid, localX, localY)) return;

  const radius = 2 + Math.round(power / 22);
  const strength = 0.32 + power / 110;

  applySingleBlast(world.state.seed, building.grid, localX, localY, radius, strength);
  erodeExposedEdgesLocal(world.state.seed, building.grid, power, localX, localY, radius + 2);
  scatterDebrisOutsideLocal(world.state.seed, building.grid, power, localX, localY, radius + 2);
  carveRoofOpening(world.state.seed, building.roofMask, building.grid, localX, localY, Math.max(2, Math.round(radius * 1.15)));

  for (let y = 0; y < building.grid.length; y++) {
    for (let x = 0; x < building.grid[0].length; x++) {
      if ([TILE.HOLE, TILE.RUBBLE, TILE.BROKEN_WALL].includes(building.grid[y][x])) building.roofMask[y][x] = 0;
    }
  }

  smoothRoofMask(world.state.seed, building.roofMask, building.grid);
  building.damageCount++;
  world.state.buildingSnapshots.set(building.key, {
    grid: cloneGrid(building.grid),
    roofMask: cloneGrid(building.roofMask),
    damageCount: building.damageCount,
  });
}

function applySingleBlast(seed: number, targetGrid: TileGrid, cx: number, cy: number, radius: number, strength: number): void {
  for (let y = cy - radius - 2; y <= cy + radius + 2; y++) {
    for (let x = cx - radius - 2; x <= cx + radius + 2; x++) {
      if (!inBounds(targetGrid, x, y)) continue;

      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius + random01(seed, x, y, 9100) * 1.5) continue;

      const falloff = Math.max(0, 1 - distance / radius);
      const chance = falloff * strength;
      const tile = targetGrid[y][x];

      if (tile === TILE.WALL || tile === TILE.DOOR) {
        if (random01(seed, x, y, 9101) < chance * 0.48) targetGrid[y][x] = TILE.HOLE;
        else if (random01(seed, x, y, 9102) < chance * 0.82) targetGrid[y][x] = TILE.BROKEN_WALL;
        else if (random01(seed, x, y, 9103) < chance) targetGrid[y][x] = TILE.CRACKED_WALL;
      } else if (tile === TILE.FLOOR || tile === TILE.DIRT || tile === TILE.WOOD) {
        if (random01(seed, x, y, 9104) < chance * 0.16) targetGrid[y][x] = TILE.HOLE;
        else if (random01(seed, x, y, 9105) < chance * 0.58) targetGrid[y][x] = TILE.RUBBLE;
        else if (random01(seed, x, y, 9106) < chance * 0.82) targetGrid[y][x] = TILE.DIRT;
      } else if (tile === TILE.CRACKED_WALL) {
        if (random01(seed, x, y, 9107) < chance * 0.7) targetGrid[y][x] = TILE.BROKEN_WALL;
      } else if (tile === TILE.BROKEN_WALL) {
        if (random01(seed, x, y, 9108) < chance * 0.5) targetGrid[y][x] = TILE.RUBBLE;
      } else if (tile === TILE.GRASS && distance < radius * 0.6 && random01(seed, x, y, 9109) < chance * 0.15) {
        targetGrid[y][x] = TILE.DIRT;
      }
    }
  }
}

function erodeExposedEdgesLocal(seed: number, targetGrid: TileGrid, power: number, cx: number, cy: number, radius: number): void {
  const copy = targetGrid.map(row => row.slice());
  const minX = Math.max(1, cx - radius);
  const maxX = Math.min(targetGrid[0].length - 2, cx + radius);
  const minY = Math.max(1, cy - radius);
  const maxY = Math.min(targetGrid.length - 2, cy + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) > radius) continue;

      const tile = targetGrid[y][x];
      if (![TILE.WALL, TILE.CRACKED_WALL, TILE.BROKEN_WALL].includes(tile)) continue;

      const holes = countNeighbors(targetGrid, x, y, [TILE.GRASS, TILE.HOLE, TILE.RUBBLE]);
      if (holes >= 2 && random01(seed, x, y, 9200) < power / 190) copy[y][x] = TILE.BROKEN_WALL;
      if (holes >= 3 && random01(seed, x, y, 9201) < power / 230) copy[y][x] = TILE.RUBBLE;
    }
  }

  for (let y = 0; y < targetGrid.length; y++) targetGrid[y] = copy[y];
}

function scatterDebrisOutsideLocal(seed: number, targetGrid: TileGrid, power: number, cx: number, cy: number, radius: number): void {
  const copy = targetGrid.map(row => row.slice());
  const minX = Math.max(1, cx - radius);
  const maxX = Math.min(targetGrid[0].length - 2, cx + radius);
  const minY = Math.max(1, cy - radius);
  const maxY = Math.min(targetGrid.length - 2, cy + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx0 = x - cx;
      const dy0 = y - cy;
      if (Math.sqrt(dx0 * dx0 + dy0 * dy0) > radius) continue;
      if (![TILE.BROKEN_WALL, TILE.RUBBLE, TILE.HOLE].includes(targetGrid[y][x])) continue;

      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(targetGrid, nx, ny)) continue;
        if (targetGrid[ny][nx] === TILE.GRASS && random01(seed, nx, ny, 9300) < power / 280) {
          copy[ny][nx] = random01(seed, nx, ny, 9301) < 0.7 ? TILE.RUBBLE : TILE.DIRT;
        }
      }
    }
  }

  for (let y = 0; y < targetGrid.length; y++) targetGrid[y] = copy[y];
}

function carveRoofOpening(seed: number, mask: RoofMask, targetGrid: TileGrid, cx: number, cy: number, radius: number): void {
  for (let y = cy - radius - 1; y <= cy + radius + 1; y++) {
    for (let x = cx - radius - 1; x <= cx + radius + 1; x++) {
      if (!inBounds(targetGrid, x, y)) continue;
      if (!mask[y][x]) continue;

      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const threshold = radius + (random01(seed, x, y, 9400) - 0.5) * 0.9;
      if (distance <= threshold) mask[y][x] = 0;
    }
  }
}

function smoothRoofMask(seed: number, mask: RoofMask, targetGrid: TileGrid): void {
  for (let pass = 0; pass < 2; pass++) {
    const copy = mask.map(row => row.slice());

    for (let y = 1; y < mask.length - 1; y++) {
      for (let x = 1; x < mask[0].length - 1; x++) {
        if (!isBuildingTile(targetGrid[y][x])) continue;

        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (mask[y + dy][x + dx]) neighbors++;
          }
        }

        if (mask[y][x] && neighbors <= 2) copy[y][x] = 0;
        if (!mask[y][x] && neighbors >= 7 && ![TILE.HOLE, TILE.RUBBLE, TILE.BROKEN_WALL].includes(targetGrid[y][x])) copy[y][x] = 1;
      }
    }

    for (let y = 0; y < mask.length; y++) mask[y] = copy[y];
  }
}
```

src/generation/cities.ts
```
import { BIOME, TILE, type BuildingObject, type CityLot, type CityPlan, type DistrictType } from "../world/types";
import { clamp, makeGrid } from "../shared/math";
import { createRng, randInt, random01 } from "./rng";
import { createBuildingGrid } from "./buildings";
import type { World } from "../world/World";

export const REGION_SIZE = 192;
export const CITY_CACHE_LIMIT = 64;

function chooseDistrictType(seed: number, regionX: number, regionY: number, biome: string): DistrictType {
  const roll = random01(seed, regionX, regionY, 5500);
  if (biome === BIOME.TOWN) return "village";
  if (roll > 0.8) return "industrial";
  if (roll < 0.14) return "ruins";
  return "village";
}

export function generateCityPlan(world: World, regionX: number, regionY: number): CityPlan | null {
  const key = `${regionX},${regionY}`;
  const cached = world.cityCache.get(key);
  if (cached !== undefined) return cached;

  const regionWorldX = regionX * REGION_SIZE;
  const regionWorldY = regionY * REGION_SIZE;
  const centerX = regionWorldX + REGION_SIZE / 2;
  const centerY = regionWorldY + REGION_SIZE / 2;
  const biome = world.getBiomeAt(Math.floor(centerX), Math.floor(centerY));
  const cityRoll = random01(world.state.seed, regionX, regionY, 5600);
  const biomeBias = biome === BIOME.MEADOW ? 0.34 : biome === BIOME.FOREST ? 0.2 : biome === BIOME.TOWN ? 0.44 : 0.08;
  const forceStartCity = regionX === 0 && regionY === 0;
  if (!forceStartCity && cityRoll > biomeBias) {
    world.cityCache.set(key, null);
    return null;
  }

  const rng = createRng(`${world.state.seed}:city:${regionX}:${regionY}`);
  const cityRadius = randInt(rng, 26, 42);
  const districtType = chooseDistrictType(world.state.seed, regionX, regionY, biome);
  const centerTileX = Math.round(centerX + randInt(rng, -18, 18));
  const centerTileY = Math.round(centerY + randInt(rng, -18, 18));
  const roadTiles = new Set<string>();
  const lots: CityLot[] = [];

  const blockRadius = cityRadius - 6;
  const lotCount = districtType === "industrial" ? 8 : districtType === "ruins" ? 5 : 10;
  for (let i = 0; i < lotCount; i++) {
    const angle = (i / lotCount) * Math.PI * 2 + randInt(rng, -1, 1) * 0.11;
    const radial = Math.max(8, Math.round(blockRadius * (0.34 + rng() * 0.44)));
    const lotCenterX = Math.round(centerTileX + Math.cos(angle) * radial);
    const lotCenterY = Math.round(centerTileY + Math.sin(angle) * radial);
    const lotW = randInt(rng, districtType === "industrial" ? 10 : 8, districtType === "industrial" ? 16 : 13);
    const lotH = randInt(rng, districtType === "industrial" ? 8 : 7, districtType === "industrial" ? 13 : 11);
    lots.push({
      x: lotCenterX - Math.floor(lotW / 2),
      y: lotCenterY - Math.floor(lotH / 2),
      w: lotW,
      h: lotH,
    });
  }

  const city: CityPlan = {
    key,
    regionX,
    regionY,
    centerX: centerTileX,
    centerY: centerTileY,
    radius: cityRadius,
    districtType,
    roadTiles,
    lots,
  };

  world.cityCache.set(key, city);
  if (world.cityCache.size > CITY_CACHE_LIMIT) {
    const firstKey = world.cityCache.keys().next().value as string | undefined;
    if (firstKey) world.cityCache.delete(firstKey);
  }
  return city;
}

export function generateCityBuildings(world: World, city: CityPlan): BuildingObject[] {
  const buildings: BuildingObject[] = [];
  const rng = createRng(`${world.state.seed}:city-buildings:${city.key}`);

  city.lots.forEach((lot, index) => {
    if (rng() < 0.22 && city.districtType !== "industrial") return;

    const padding = city.districtType === "industrial" ? 3 : 2;
    const footprintW = clamp(lot.w - padding * 2, 7, 15);
    const footprintH = clamp(lot.h - padding * 2, 6, 12);
    const originX = lot.x + padding;
    const originY = lot.y + padding;

    let grassScore = 0;
    for (let y = 0; y < footprintH + 8; y++) {
      for (let x = 0; x < footprintW + 8; x++) {
        const tile = world.getTerrainTile(originX + x, originY + y);
        if (tile === TILE.GRASS || tile === TILE.DIRT) grassScore++;
      }
    }

    if (grassScore < footprintW * footprintH * 0.56) return;

    const built = createBuildingGrid(world, footprintW, footprintH, `${world.state.seed}:city:${city.key}:${index}:${originX}:${originY}`);
    const building: BuildingObject = {
      key: `${city.key}:${index}`,
      sectorX: Math.floor(originX / world.SECTOR_SIZE),
      sectorY: Math.floor(originY / world.SECTOR_SIZE),
      originX,
      originY,
      width: built.grid[0].length,
      height: built.grid.length,
      footprintW,
      footprintH,
      grid: built.grid,
      rooms: built.rooms,
      roofMask: built.roofMask,
      bounds: built.bounds,
      orientation: built.orientation,
      damageCount: 0,
      cityKey: city.key,
    };

    const snapshot = world.state.buildingSnapshots.get(building.key);
    if (snapshot) {
      building.grid = snapshot.grid;
      building.roofMask = snapshot.roofMask;
      building.damageCount = snapshot.damageCount;
    }
    buildings.push(building);
  });

  return buildings;
}
```

src/generation/forest.ts
```
import { TILE, type TreeObject } from "../world/types";
import { clamp, makeGrid } from "../shared/math";
import { createRng, randInt, random01 } from "./rng";
import { fractalNoise } from "./terrain";
import type { World } from "../world/World";

export const FOREST_PATCH_SIZE = 96;
export const MAX_CACHED_FOREST_PATCHES = 96;

function chooseTreeSizeClass(rng: () => number, forest: number, hint: "small" | "medium" | "large" | null = null) {
  if (hint) return hint;
  const roll = rng();
  if (forest > 0.82 || roll > 0.95) return "large" as const;
  if (forest > 0.66 || roll > 0.7) return "medium" as const;
  return "small" as const;
}

function treeSizeSpec(sizeClass: "small" | "medium" | "large", rng: () => number) {
  if (sizeClass === "large") {
    return {
      circleRadii: [4, 5, 5],
      crownLift: randInt(rng, 4, 6),
      crownSpreadX: randInt(rng, 3, 5),
      crownSpreadY: randInt(rng, 1, 3),
    };
  }
  if (sizeClass === "medium") {
    return {
      circleRadii: [2, 3, 4],
      crownLift: randInt(rng, 3, 5),
      crownSpreadX: randInt(rng, 2, 4),
      crownSpreadY: randInt(rng, 1, 2),
    };
  }
  return {
    circleRadii: [1, 2],
    crownLift: randInt(rng, 1, 3),
    crownSpreadX: randInt(rng, 0, 2),
    crownSpreadY: randInt(rng, 0, 1),
  };
}

function createTreeMask(originX: number, originY: number, width: number, height: number, trunkWorldX: number, trunkWorldY: number, circles: { cx: number; cy: number; r: number }[], seed: number) {
  const mask = makeGrid(width, height, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const worldX = originX + x;
      const worldY = originY + y;
      let leaf = false;

      for (const circle of circles) {
        const circleLocalX = circle.cx - originX;
        const circleLocalY = circle.cy - originY;
        const dx = x - circleLocalX;
        const dy = y - circleLocalY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const fuzz = random01(seed, worldX, worldY, 16000 + circle.r * 29);
        if (distance <= circle.r + fuzz * 0.45) {
          leaf = true;
          break;
        }
      }

      if (leaf) mask[y][x] = 1;
    }
  }

  const trunkX = trunkWorldX - originX;
  const trunkY = trunkWorldY - originY;
  if (trunkX >= 0 && trunkY >= 0 && trunkX < width && trunkY < height) mask[trunkY][trunkX] = 2;
  return mask;
}

function softenTreeMask(mask: number[][]): void {
  for (let pass = 0; pass < 2; pass++) {
    const copy = mask.map(row => row.slice());

    for (let y = 1; y < mask.length - 1; y++) {
      for (let x = 1; x < mask[0].length - 1; x++) {
        const self = mask[y][x];
        const orth = [
          mask[y - 1][x],
          mask[y + 1][x],
          mask[y][x - 1],
          mask[y][x + 1],
        ].filter(Boolean).length;
        const diag = [
          mask[y - 1][x - 1],
          mask[y - 1][x + 1],
          mask[y + 1][x - 1],
          mask[y + 1][x + 1],
        ].filter(Boolean).length;

        if (self === 1 && orth <= 1 && diag === 0) {
          copy[y][x] = 0;
          continue;
        }

        if (!self && orth >= 3 && diag >= 1) copy[y][x] = 1;
      }
    }

    for (let y = 0; y < mask.length; y++) mask[y] = copy[y];
  }
}

export function createTreeObject(world: World, trunkWorldX: number, trunkWorldY: number, seedText: string, forest: number, sizeHint: "small" | "medium" | "large" | null = null): TreeObject | null {
  const rng = createRng(seedText);
  if (world.getBuildingAt(trunkWorldX, trunkWorldY)) return null;
  if (world.getTerrainTile(trunkWorldX, trunkWorldY) !== TILE.GRASS) return null;

  const sizeClass = chooseTreeSizeClass(rng, forest, sizeHint);
  const spec = treeSizeSpec(sizeClass, rng);
  const circleRadii = spec.circleRadii;
  const circles: { cx: number; cy: number; r: number }[] = [];
  const crownCenterX = trunkWorldX + randInt(rng, -1, 1);
  const crownCenterY = trunkWorldY - spec.crownLift;

  for (let i = 0; i < circleRadii.length; i++) {
    const radius = circleRadii[i] + randInt(rng, 0, 1);
    let cx: number;
    let cy: number;

    if (sizeClass === "small") {
      cx = crownCenterX + randInt(rng, -1, 1);
      cy = crownCenterY + randInt(rng, -1, 1);
    } else if (i === 0) {
      cx = crownCenterX + randInt(rng, -spec.crownSpreadX, spec.crownSpreadX);
      cy = crownCenterY + randInt(rng, -spec.crownSpreadY - 2, -1);
    } else if (i === 1) {
      cx = crownCenterX + randInt(rng, -spec.crownSpreadX - 2, spec.crownSpreadX + 2);
      cy = crownCenterY + randInt(rng, -1, spec.crownSpreadY + 1);
    } else {
      cx = crownCenterX + randInt(rng, -spec.crownSpreadX - 3, spec.crownSpreadX + 3);
      cy = crownCenterY + randInt(rng, 0, spec.crownSpreadY + 2);
    }

    circles.push({ cx, cy, r: radius });
  }

  let minX = trunkWorldX;
  let minY = trunkWorldY;
  let maxX = trunkWorldX;
  let maxY = trunkWorldY;
  for (const circle of circles) {
    minX = Math.min(minX, Math.floor(circle.cx - circle.r - 2));
    minY = Math.min(minY, Math.floor(circle.cy - circle.r - 2));
    maxX = Math.max(maxX, Math.ceil(circle.cx + circle.r + 2));
    maxY = Math.max(maxY, Math.ceil(circle.cy + circle.r + 2));
  }

  const originX = minX - 1;
  const originY = minY - 1;
  const width = maxX - originX + 1;
  const height = maxY - originY + 1;
  const trunkX = trunkWorldX - originX;
  const trunkY = trunkWorldY - originY;
  const mask = createTreeMask(originX, originY, width, height, trunkWorldX, trunkWorldY, circles, world.state.seed);
  softenTreeMask(mask);
  return {
    originX,
    originY,
    width,
    height,
    trunkX,
    trunkY,
    mask,
    sizeClass,
  };
}

export function generateForestPatch(world: World, patchX: number, patchY: number): TreeObject[] {
  const key = `${patchX},${patchY}`;
  const cached = world.forestCache.get(key);
  if (cached) return cached;

  const rng = createRng(`${world.state.seed}:forest:${patchX}:${patchY}`);
  const patchWorldX = patchX * FOREST_PATCH_SIZE;
  const patchWorldY = patchY * FOREST_PATCH_SIZE;
  const patchCenterNoise = fractalNoise(world.state.seed, patchWorldX + FOREST_PATCH_SIZE * 0.5, patchWorldY + FOREST_PATCH_SIZE * 0.5, 3100);
  const forestStrength = clamp((patchCenterNoise - 0.28) * 1.55, 0, 1);
  const trees: TreeObject[] = [];

  let clusterCount = 0;
  if (forestStrength > 0.2) clusterCount = 1;
  if (forestStrength > 0.45) clusterCount = randInt(rng, 1, 2);
  if (forestStrength > 0.68) clusterCount = randInt(rng, 2, 4);
  if (forestStrength > 0.84) clusterCount = randInt(rng, 3, 5);

  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex++) {
    const clusterCenterX = patchWorldX + randInt(rng, 12, FOREST_PATCH_SIZE - 13);
    const clusterCenterY = patchWorldY + randInt(rng, 12, FOREST_PATCH_SIZE - 13);
    const clusterForest = clamp(forestStrength + random01(world.state.seed, clusterCenterX, clusterCenterY, 3200) * 0.35, 0, 1);
    const treeCount = randInt(rng, 4 + Math.round(clusterForest * 2), 10 + Math.round(clusterForest * 10));
    const clusterRadius = randInt(rng, 8, 18) + Math.round(clusterForest * 10);

    for (let treeIndex = 0; treeIndex < treeCount; treeIndex++) {
      const angle = rng() * Math.PI * 2;
      const radial = Math.pow(rng(), 0.58) * clusterRadius;
      const trunkWorldX = Math.round(clusterCenterX + Math.cos(angle) * radial + randInt(rng, -2, 2));
      const trunkWorldY = Math.round(clusterCenterY + Math.sin(angle) * radial + randInt(rng, -2, 2));

      if (world.getBuildingAt(trunkWorldX, trunkWorldY)) continue;
      if (world.getTerrainTile(trunkWorldX, trunkWorldY) !== TILE.GRASS) continue;
      if (rng() < 0.03 && clusterForest < 0.8) continue;

      const sizeHint = clusterForest > 0.82
        ? (rng() < 0.18 ? "large" : rng() < 0.62 ? "medium" : "small")
        : clusterForest > 0.55
          ? (rng() < 0.08 ? "large" : rng() < 0.56 ? "medium" : "small")
          : (rng() < 0.03 ? "large" : rng() < 0.28 ? "medium" : "small");

      const tree = createTreeObject(
        world,
        trunkWorldX,
        trunkWorldY,
        `${world.state.seed}:forest:${patchX}:${patchY}:${clusterIndex}:${treeIndex}`,
        clusterForest,
        sizeHint,
      );

      if (tree) trees.push(tree);
    }
  }

  if (forestStrength > 0.3 && trees.length === 0) {
    const fallbackX = patchWorldX + randInt(rng, 16, FOREST_PATCH_SIZE - 17);
    const fallbackY = patchWorldY + randInt(rng, 16, FOREST_PATCH_SIZE - 17);
    const fallbackTree = createTreeObject(
      world,
      fallbackX,
      fallbackY,
      `${world.state.seed}:forest:fallback:${patchX}:${patchY}`,
      forestStrength,
      forestStrength > 0.75 ? "medium" : "small",
    );
    if (fallbackTree) trees.push(fallbackTree);
  }

  world.forestCache.set(key, trees);
  if (world.forestCache.size > MAX_CACHED_FOREST_PATCHES) {
    const firstKey = world.forestCache.keys().next().value as string | undefined;
    if (firstKey) world.forestCache.delete(firstKey);
  }

  return trees;
}
```

src/generation/rng.ts
```
export function hashStringToSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seedText: string): () => number {
  let state = hashStringToSeed(String(seedText));
  return function rand() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function hashInt(seed: number, x: number, y: number, salt = 0): number {
  let h = seed ^ salt;
  h = Math.imul(h ^ x, 374761393);
  h = Math.imul(h ^ y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function random01(seed: number, x: number, y: number, salt = 0): number {
  return hashInt(seed, x, y, salt) / 4294967295;
}
```

src/generation/roads.ts
```
import { BIOME, TILE } from "../world/types";
import type { World } from "../world/World";
import { generateCityPlan } from "./cities";

function isRoadKey(world: World, worldX: number, worldY: number): boolean {
  const regionX = Math.floor(worldX / world.REGION_SIZE);
  const regionY = Math.floor(worldY / world.REGION_SIZE);
  const city = generateCityPlan(world, regionX, regionY);
  if (!city) return false;
  return city.roadTiles.has(`${worldX},${worldY}`);
}

export function getRoadTile(world: World, worldX: number, worldY: number) {
  if (isRoadKey(world, worldX, worldY)) {
    return world.getBiomeAt(worldX, worldY) === BIOME.TOWN ? TILE.PAVEMENT : TILE.ROAD;
  }
  return null;
}
```

src/generation/terrain.ts
```
import { BIOME, type BiomeId, TILE, type TileId } from "../world/types";
import { clamp, lerp, smoothstep } from "../shared/math";
import { random01 } from "./rng";

export type TerrainSample = {
  height: number;
  moisture: number;
  temperature: number;
  biomeId: BiomeId;
  baseTile: TileId;
};

export function valueNoise(seed: number, x: number, y: number, scale: number, salt: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = smoothstep(sx - x0);
  const ty = smoothstep(sy - y0);

  const a = random01(seed, x0, y0, salt);
  const b = random01(seed, x1, y0, salt);
  const c = random01(seed, x0, y1, salt);
  const d = random01(seed, x1, y1, salt);

  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

export function fractalNoise(seed: number, x: number, y: number, salt: number): number {
  let total = 0;
  let amplitude = 1;
  let max = 0;
  let scale = 48;

  for (let octave = 0; octave < 4; octave++) {
    total += valueNoise(seed, x, y, scale, salt + octave * 1013) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    scale *= 0.5;
  }

  return total / max;
}

export function getBiomeAt(seed: number, worldX: number, worldY: number): BiomeId {
  const height = fractalNoise(seed, worldX, worldY, 2000);
  const moisture = fractalNoise(seed, worldX, worldY, 1000);
  const townBias = fractalNoise(seed, worldX, worldY, 5000);

  if (height > 0.76) return BIOME.ROCKY;
  if (moisture > 0.72 && height < 0.46) return BIOME.SWAMP;
  if (townBias > 0.69 && moisture > 0.44 && height > 0.35) return BIOME.TOWN;
  if (moisture > 0.55) return BIOME.FOREST;
  return BIOME.MEADOW;
}

export function sampleTerrain(seed: number, worldX: number, worldY: number): TerrainSample {
  const moisture = fractalNoise(seed, worldX, worldY, 1000);
  const height = fractalNoise(seed, worldX, worldY, 2000);
  const temperature = clamp(1 - Math.abs(worldY % 512) / 512, 0, 1);
  const biomeId = getBiomeAt(seed, worldX, worldY);

  let baseTile: TileId = TILE.GRASS;
  if (height > 0.82) baseTile = TILE.ROCK;
  else if (moisture > 0.63 && height < 0.68) baseTile = TILE.WATER;
  else if (biomeId === BIOME.SWAMP) baseTile = TILE.DIRT;
  else if (biomeId === BIOME.ROCKY) baseTile = TILE.ROCK;

  return { height, moisture, temperature, biomeId, baseTile };
}
```

src/render/PixiRenderer.ts
```
import { Application, Container, Sprite, Texture } from "pixi.js";
import { BIOME, TILE, type BiomeId, type TreeObject } from "../world/types";
import type { World } from "../world/World";
import type { Camera } from "../game/Camera";

type RenderItem = {
  x: number;
  y: number;
  width: number;
  height: number;
  texture: Texture;
  tint?: number;
  alpha?: number;
};

const BIOME_TINTS: Record<BiomeId, number> = {
  meadow: 0x5ba246,
  forest: 0x3d7a35,
  rocky: 0x8a8d88,
  swamp: 0x4f7659,
  town: 0x62844f,
};

class LayerPool {
  readonly container = new Container();
  readonly sprites: Sprite[] = [];

  ensure(count: number): void {
    while (this.sprites.length < count) {
      const sprite = new Sprite();
      sprite.visible = false;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
  }
}

export class PixiRenderer {
  private readonly app = new Application();
  private readonly terrain = new LayerPool();
  private readonly buildings = new LayerPool();
  private readonly roofs = new LayerPool();
  private readonly trees = new LayerPool();

  readonly textures: Record<string, Texture> = Object.create(null);

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: parent,
      background: 0x08111d,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    parent.appendChild(this.app.canvas);
    this.buildTextures();
    this.app.stage.addChild(
      this.terrain.container,
      this.buildings.container,
      this.roofs.container,
      this.trees.container,
    );
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  render(world: World, camera: Camera): void {
    const tileSize = camera.tileSize;
    const { startTileX, startTileY, offsetX, offsetY, tilesAcross, tilesDown } = camera.visibleBounds(this.width, this.height);

    const terrainItems: RenderItem[] = [];
    const buildingItems: RenderItem[] = [];
    const roofItems: RenderItem[] = [];
    const treeItems: RenderItem[] = [];

    for (let y = 0; y < tilesDown; y++) {
      for (let x = 0; x < tilesAcross; x++) {
        const worldX = startTileX + x;
        const worldY = startTileY + y;
        const screenX = offsetX + x * tileSize;
        const screenY = offsetY + y * tileSize;
        const building = world.getBuildingAt(worldX, worldY);

        if (building) {
          const localX = worldX - building.originX;
          const localY = worldY - building.originY;
          const tile = building.grid[localY][localX];
          if (tile !== TILE.GRASS) {
            buildingItems.push(this.makeItem(tile, screenX, screenY, tileSize, worldX, worldY));
            if (building.roofMask[localY][localX]) {
              roofItems.push(this.makeRoofItem(worldX, worldY, building, screenX, screenY, tileSize));
            }
            continue;
          }
        }

        const terrain = world.getTerrainSample(worldX, worldY);
        terrainItems.push(this.makeTerrainItem(terrain.baseTile, terrain.biomeId, screenX, screenY, tileSize, worldX, worldY));
      }
    }

    const minForestPatchX = Math.floor(startTileX / 96) - 1;
    const minForestPatchY = Math.floor(startTileY / 96) - 1;
    const maxForestPatchX = Math.floor((startTileX + tilesAcross) / 96) + 1;
    const maxForestPatchY = Math.floor((startTileY + tilesDown) / 96) + 1;
    for (let patchY = minForestPatchY; patchY <= maxForestPatchY; patchY++) {
      for (let patchX = minForestPatchX; patchX <= maxForestPatchX; patchX++) {
        const trees = world.getTreesForPatch(patchX, patchY);
        for (const tree of trees) {
          this.appendTreeItems(treeItems, tree, startTileX, startTileY, offsetX, offsetY, tileSize);
        }
      }
    }

    this.syncLayer(this.terrain, terrainItems);
    this.syncLayer(this.buildings, buildingItems);
    this.syncLayer(this.roofs, roofItems);
    this.syncLayer(this.trees, treeItems);
  }

  private buildTextures(): void {
    const size = 16;
    this.textures.grass = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#4f8f3a";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(4, 5, 2, 6);
      ctx.fillRect(10, 2, 2, 5);
    });
    this.textures.water = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#2c6bdf";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(2, 6, 12, 2);
      ctx.fillRect(4, 10, 8, 1);
    });
    this.textures.rock = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#7f837d";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(4, 3, 5, 2);
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(6, 10, 7, 2);
    });
    this.textures.dirt = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#4f402f";
      ctx.fillRect(0, 0, size, size);
    });
    this.textures.road = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#6f5d47";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(6, 0, 4, size);
    });
    this.textures.pavement = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#5d6874";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(2, 3, 11, 2);
    });
    this.textures.floor = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#2a2f36";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(2, 3, 12, 1);
      ctx.fillRect(2, 8, 12, 1);
    });
    this.textures.wall = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#70766f";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(3, 3, 5, 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(3, 12, 10, 2);
    });
    this.textures.cracked_wall = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#594f48";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#372f2a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, 3);
      ctx.lineTo(8, 6);
      ctx.lineTo(6, 11);
      ctx.lineTo(12, 13);
      ctx.stroke();
    });
    this.textures.broken_wall = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#473b33";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#6f655d";
      ctx.fillRect(2, 3, 3, 3);
      ctx.fillRect(10, 4, 3, 4);
    });
    this.textures.rubble = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#3b322d";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#635248";
      ctx.fillRect(3, 4, 4, 3);
      ctx.fillRect(9, 10, 4, 2);
    });
    this.textures.hole = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#181412";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.strokeRect(2.5, 2.5, 11, 11);
    });
    this.textures.door = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#5a3922";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(4, 4, 2, 8);
    });
    this.textures.wood = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#4b311c";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(3, 3, 2, 10);
    });
    this.textures.tree_leaf = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#1f5f2b";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(4, 3, 3, 4);
    });
    this.textures.tree_trunk = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#7a4a22";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(6, 3, 2, 9);
    });
    this.textures.roofDarkHorizontal = this.makeRoofTexture(size, "horizontal", "dark");
    this.textures.roofLightHorizontal = this.makeRoofTexture(size, "horizontal", "light");
    this.textures.roofRidgeHorizontal = this.makeRoofTexture(size, "horizontal", "ridge");
    this.textures.roofDarkVertical = this.makeRoofTexture(size, "vertical", "dark");
    this.textures.roofLightVertical = this.makeRoofTexture(size, "vertical", "light");
    this.textures.roofRidgeVertical = this.makeRoofTexture(size, "vertical", "ridge");
  }

  private makeTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    draw(ctx);
    return Texture.from(canvas);
  }

  private makeItem(tile: string, x: number, y: number, size: number, worldX: number, worldY: number): RenderItem {
    let texture = this.textures.grass;
    let tint = 0xffffff;

    switch (tile) {
      case TILE.GRASS:
        texture = this.textures.grass;
        break;
      case TILE.WATER:
        texture = this.textures.water;
        break;
      case TILE.ROCK:
        texture = this.textures.rock;
        break;
      case TILE.DIRT:
        texture = this.textures.dirt;
        break;
      case TILE.ROAD:
        texture = this.textures.road;
        break;
      case TILE.PAVEMENT:
        texture = this.textures.pavement;
        break;
      case TILE.FLOOR:
        texture = this.textures.floor;
        break;
      case TILE.WALL:
        texture = this.textures.wall;
        break;
      case TILE.CRACKED_WALL:
        texture = this.textures.cracked_wall;
        break;
      case TILE.BROKEN_WALL:
        texture = this.textures.broken_wall;
        break;
      case TILE.RUBBLE:
        texture = this.textures.rubble;
        break;
      case TILE.HOLE:
        texture = this.textures.hole;
        break;
      case TILE.DOOR:
        texture = this.textures.door;
        break;
      case TILE.WOOD:
        texture = this.textures.wood;
        break;
      case TILE.TREE_LEAF:
        texture = this.textures.tree_leaf;
        break;
      case TILE.TREE_TRUNK:
        texture = this.textures.tree_trunk;
        break;
    }

    if (tile === TILE.GRASS) {
      tint = BIOME_TINTS[BIOME.MEADOW];
    }

    return { x, y, width: size, height: size, texture, tint };
  }

  private makeTerrainItem(tile: string, biome: BiomeId, x: number, y: number, size: number, worldX: number, worldY: number): RenderItem {
    const item = this.makeItem(tile, x, y, size, worldX, worldY);
    if (tile === TILE.GRASS) item.tint = BIOME_TINTS[biome];
    return item;
  }

  private makeRoofItem(worldX: number, worldY: number, building: { orientation: string; bounds: { x: number; y: number; w: number; h: number }; originX: number; originY: number }, x: number, y: number, size: number): RenderItem {
    const localX = worldX - building.originX;
    const localY = worldY - building.originY;
    const { orientation, bounds } = building;
    const ridge = orientation === "horizontal"
      ? Math.abs((localY + 0.5) - (bounds.y + bounds.h / 2)) < 0.8
      : Math.abs((localX + 0.5) - (bounds.x + bounds.w / 2)) < 0.8;
    const firstSide = orientation === "horizontal"
      ? localY + 0.5 < bounds.y + bounds.h / 2
      : localX + 0.5 < bounds.x + bounds.w / 2;

    const texture = this.getRoofTexture(String(orientation), ridge ? "ridge" : firstSide ? "dark" : "light");
    return { x, y, width: size, height: size, texture };
  }

  private appendTreeItems(
    target: RenderItem[],
    tree: TreeObject,
    startTileX: number,
    startTileY: number,
    offsetX: number,
    offsetY: number,
    tileSize: number,
  ): void {
    const endTileX = startTileX + Math.ceil(this.width / tileSize) + 2;
    const endTileY = startTileY + Math.ceil(this.height / tileSize) + 2;

    for (let y = 0; y < tree.height; y++) {
      for (let x = 0; x < tree.width; x++) {
        const cell = tree.mask[y][x];
        if (!cell) continue;
        const worldX = tree.originX + x;
        const worldY = tree.originY + y;
        if (worldX < startTileX - 1 || worldX > endTileX) continue;
        if (worldY < startTileY - 1 || worldY > endTileY) continue;
        const screenX = offsetX + (worldX - startTileX) * tileSize;
        const screenY = offsetY + (worldY - startTileY) * tileSize;
        target.push(this.makeItem(cell === 2 ? TILE.TREE_TRUNK : TILE.TREE_LEAF, screenX, screenY, tileSize, worldX, worldY));
      }
    }
  }

  private syncLayer(pool: LayerPool, items: RenderItem[]): void {
    pool.ensure(items.length);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sprite = pool.sprites[i];
      sprite.visible = true;
      sprite.texture = item.texture;
      sprite.x = item.x;
      sprite.y = item.y;
      sprite.width = item.width;
      sprite.height = item.height;
      sprite.alpha = item.alpha ?? 1;
      sprite.tint = item.tint ?? 0xffffff;
    }
    for (let i = items.length; i < pool.sprites.length; i++) {
      pool.sprites[i].visible = false;
    }
  }

  private makeRoofTexture(size: number, orientation: "horizontal" | "vertical", tone: "dark" | "light" | "ridge"): Texture {
    return this.makeTexture(size, size, ctx => {
      const base = tone === "dark" ? "#5e6871" : "#7a858e";
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);

      if (orientation === "horizontal") {
        if (tone === "ridge") {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(2, 2, size - 4, 2);
        } else if (tone === "dark") {
          ctx.fillStyle = "rgba(0,0,0,0.10)";
          ctx.fillRect(0, size - 4, size, 4);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.10)";
          ctx.fillRect(0, 0, size, 4);
        }
      } else {
        if (tone === "ridge") {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(2, 2, 2, size - 4);
        } else if (tone === "dark") {
          ctx.fillStyle = "rgba(0,0,0,0.10)";
          ctx.fillRect(size - 4, 0, 4, size);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.10)";
          ctx.fillRect(0, 0, 4, size);
        }
      }

      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    });
  }

  private getRoofTexture(orientation: string, tone: "dark" | "light" | "ridge"): Texture {
    if (orientation === "horizontal") {
      if (tone === "ridge") return this.textures.roofRidgeHorizontal;
      return tone === "dark" ? this.textures.roofDarkHorizontal : this.textures.roofLightHorizontal;
    }
    if (tone === "ridge") return this.textures.roofRidgeVertical;
    return tone === "dark" ? this.textures.roofDarkVertical : this.textures.roofLightVertical;
  }
}
```

src/shared/math.ts
```
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function floorDiv(n: number, d: number): number {
  return Math.floor(n / d);
}

export function mod(n: number, d: number): number {
  return ((n % d) + d) % d;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function makeGrid<T>(width: number, height: number, fill: T): T[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

export function cloneGrid<T>(source: T[][]): T[][] {
  return source.map(row => row.slice());
}

export function inBounds<T>(grid: T[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

export function countNeighbors<T>(grid: T[][], x: number, y: number, values: readonly T[]): number {
  let count = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(grid, nx, ny) && values.includes(grid[ny][nx])) count++;
  }
  return count;
}
```

src/world/World.ts
```
import { BIOME, TILE, type BuildingObject, type CityPlan, type TreeObject, type WorldState } from "./types";
import { floorDiv } from "../shared/math";
import { hashStringToSeed, random01 } from "../generation/rng";
import { sampleTerrain, type TerrainSample } from "../generation/terrain";
import { generateBuildingForSector, applyDamageToBuilding } from "../generation/buildings";
import { generateForestPatch } from "../generation/forest";
import { generateCityBuildings, generateCityPlan, REGION_SIZE } from "../generation/cities";

export type FeatureSummary = {
  buildingCount: number;
  cityCount: number;
  treePatchCount: number;
};

export class World {
  readonly SECTOR_SIZE = 64;
  readonly REGION_SIZE = REGION_SIZE;

  readonly state: WorldState;
  readonly buildingCache = new Map<string, BuildingObject | null>();
  readonly forestCache = new Map<string, TreeObject[]>();
  readonly cityCache = new Map<string, CityPlan | null>();
  private readonly terrainSampleCache = new Map<string, TerrainSample>();
  private readonly terrainSampleCacheKeys: string[] = [];
  private readonly TERRAIN_SAMPLE_CACHE_LIMIT = 80_000;
  private cityBuildingCache = new Map<string, BuildingObject[]>();

  constructor(seedText: string) {
    this.state = {
      seedText,
      seed: hashStringToSeed(seedText),
      buildingSnapshots: new Map(),
    };
  }

  setSeed(seedText: string): void {
    this.state.seedText = seedText;
    this.state.seed = hashStringToSeed(seedText);
    this.state.buildingSnapshots.clear();
    this.clearCaches();
  }

  clearCaches(): void {
    this.buildingCache.clear();
    this.forestCache.clear();
    this.cityCache.clear();
    this.cityBuildingCache.clear();
    this.terrainSampleCache.clear();
    this.terrainSampleCacheKeys.length = 0;
  }

  getBiomeAt(worldX: number, worldY: number) {
    return this.getTerrainSample(worldX, worldY).biomeId;
  }

  getTerrainTile(worldX: number, worldY: number) {
    return this.getTerrainSample(worldX, worldY).baseTile;
  }

  getTerrainSample(worldX: number, worldY: number): TerrainSample {
    const key = `${worldX},${worldY}`;
    const cached = this.terrainSampleCache.get(key);
    if (cached) return cached;

    const sample = sampleTerrain(this.state.seed, worldX, worldY);
    this.terrainSampleCache.set(key, sample);
    this.terrainSampleCacheKeys.push(key);

    if (this.terrainSampleCacheKeys.length > this.TERRAIN_SAMPLE_CACHE_LIMIT) {
      const deleteCount = Math.floor(this.TERRAIN_SAMPLE_CACHE_LIMIT * 0.2);
      for (let i = 0; i < deleteCount; i++) {
        const oldKey = this.terrainSampleCacheKeys.shift();
        if (oldKey) this.terrainSampleCache.delete(oldKey);
      }
    }

    return sample;
  }

  getTerrainScoreForSector(sectorX: number, sectorY: number): number {
    const worldX = sectorX * this.SECTOR_SIZE + this.SECTOR_SIZE / 2;
    const worldY = sectorY * this.SECTOR_SIZE + this.SECTOR_SIZE / 2;
    const terrain = sampleTerrain(this.state.seed, worldX, worldY);
    return terrain.biomeId === BIOME.MEADOW ? 0.8 : terrain.biomeId === BIOME.FOREST ? 0.72 : terrain.biomeId === BIOME.TOWN ? 0.9 : 0.22;
  }

  getDistrictBias(sectorX: number, sectorY: number): number {
    return random01(this.state.seed, sectorX, sectorY, 7800);
  }

  getBuildingAt(worldX: number, worldY: number): BuildingObject | null {
    const cityBuilding = this.getCityBuildingAt(worldX, worldY);
    if (cityBuilding) return cityBuilding;
    const sectorX = floorDiv(worldX, this.SECTOR_SIZE);
    const sectorY = floorDiv(worldY, this.SECTOR_SIZE);
    const building = generateBuildingForSector(this, sectorX, sectorY);
    if (!building) return null;
    if (worldX < building.originX || worldY < building.originY) return null;
    if (worldX >= building.originX + building.width || worldY >= building.originY + building.height) return null;
    return building;
  }

  getCityBuildingAt(worldX: number, worldY: number): BuildingObject | null {
    const regionX = floorDiv(worldX, this.REGION_SIZE);
    const regionY = floorDiv(worldY, this.REGION_SIZE);
    const city = generateCityPlan(this, regionX, regionY);
    if (!city) return null;
    const buildings = this.getCityBuildings(city);
    for (const building of buildings) {
      if (worldX < building.originX || worldY < building.originY) continue;
      if (worldX >= building.originX + building.width || worldY >= building.originY + building.height) continue;
      return building;
    }
    return null;
  }

  getCityBuildings(city: CityPlan): BuildingObject[] {
    const cached = this.cityBuildingCache.get(city.key);
    if (cached !== undefined) return cached;
    const buildings = generateCityBuildings(this, city);
    this.cityBuildingCache.set(city.key, buildings);
    return buildings;
  }

  getTreesForPatch(patchX: number, patchY: number): TreeObject[] {
    return generateForestPatch(this, patchX, patchY);
  }

  getTile(worldX: number, worldY: number) {
    const building = this.getBuildingAt(worldX, worldY);
    if (building) {
      const localX = worldX - building.originX;
      const localY = worldY - building.originY;
      const tile = building.grid[localY][localX];
      if (tile !== TILE.GRASS) return tile;
    }

    return this.getTerrainSample(worldX, worldY).baseTile;
  }

  applyDamageAt(worldX: number, worldY: number, power: number): boolean {
    const building = this.getBuildingAt(worldX, worldY);
    if (!building) return false;
    const localX = worldX - building.originX;
    const localY = worldY - building.originY;
    if (building.grid[localY][localX] === TILE.GRASS) return false;
    applyDamageToBuilding(this, building, localX, localY, power);
    return true;
  }

  getFeatureSummary(): FeatureSummary {
    return {
      buildingCount: [...this.buildingCache.values()].filter(Boolean).length,
      cityCount: [...this.cityCache.values()].filter(Boolean).length,
      treePatchCount: this.forestCache.size,
    };
  }
}
```

src/world/types.ts
```
export const TILE = {
  GRASS: "grass",
  WATER: "water",
  ROCK: "rock",
  DIRT: "dirt",
  ROAD: "road",
  PAVEMENT: "pavement",
  FLOOR: "floor",
  WALL: "wall",
  CRACKED_WALL: "cracked_wall",
  BROKEN_WALL: "broken_wall",
  RUBBLE: "rubble",
  HOLE: "hole",
  DOOR: "door",
  WOOD: "wood",
  TREE_LEAF: "tree_leaf",
  TREE_TRUNK: "tree_trunk",
} as const;

export type TileId = typeof TILE[keyof typeof TILE];

export const BIOME = {
  MEADOW: "meadow",
  FOREST: "forest",
  ROCKY: "rocky",
  SWAMP: "swamp",
  TOWN: "town",
} as const;

export type BiomeId = typeof BIOME[keyof typeof BIOME];

export type TileGrid = TileId[][];
export type RoofMask = number[][];

export type Vec2 = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type BuildingOrientation = "horizontal" | "vertical";
export type DistrictType = "village" | "industrial" | "ruins";

export type BuildingSnapshot = {
  grid: TileGrid;
  roofMask: RoofMask;
  damageCount: number;
};

export type BuildingObject = {
  key: string;
  sectorX: number;
  sectorY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  grid: TileGrid;
  rooms: Rect[];
  roofMask: RoofMask;
  bounds: Rect;
  orientation: BuildingOrientation;
  damageCount: number;
  cityKey: string | null;
};

export type TreeObject = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  trunkX: number;
  trunkY: number;
  mask: number[][];
  sizeClass: "small" | "medium" | "large";
};

export type CityLot = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CityPlan = {
  key: string;
  regionX: number;
  regionY: number;
  centerX: number;
  centerY: number;
  radius: number;
  districtType: DistrictType;
  roadTiles: Set<string>;
  lots: CityLot[];
};

export type WorldState = {
  seedText: string;
  seed: number;
  buildingSnapshots: Map<string, BuildingSnapshot>;
};
```

src/tests/world.test.ts
```
import { describe, expect, it } from "vitest";
import { World } from "../world/World";
import { TILE } from "../world/types";
import { generateCityPlan } from "../generation/cities";

describe("world generation", () => {
  it("is deterministic for a seed", () => {
    const world = new World("deterministic-seed");
    expect(world.getTerrainTile(0, 0)).toBe(world.getTerrainTile(0, 0));
    expect(world.getTerrainTile(-11, -9)).toBe(world.getTerrainTile(-11, -9));
  });

  it("handles negative coordinates", () => {
    const world = new World("negative-coords");
    expect(Object.values(TILE)).toContain(world.getTerrainTile(-1, -1));
    expect(Object.values(TILE)).toContain(world.getTile(-16, -16));
  });

  it("keeps roof coverage from increasing after damage", () => {
    const world = new World("damage-seed");
    const building = world.getBuildingAt(64, 64);
    if (!building) return;
    const before = building.roofMask.flat().filter(Boolean).length;
    world.applyDamageAt(building.originX + Math.floor(building.width / 2), building.originY + Math.floor(building.height / 2), 70);
    const after = building.roofMask.flat().filter(Boolean).length;
    expect(after).toBeLessThanOrEqual(before);
  });

  it("creates a city when the origin region is queried", () => {
    const world = new World("city-road-seed");
    const city = generateCityPlan(world, 0, 0);
    expect(city).not.toBeNull();
    expect(city?.lots.length).toBeGreaterThan(0);
  });
});
```

</source_code>