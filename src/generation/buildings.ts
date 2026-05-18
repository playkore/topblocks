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
