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
