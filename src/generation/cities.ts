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

function makeRoadPath(seed: number, startX: number, startY: number, endX: number, endY: number): Set<string> {
  const points = new Set<string>();
  let x = startX;
  let y = startY;
  points.add(`${x},${y}`);

  const totalSteps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) + 10;
  for (let i = 0; i < totalSteps; i++) {
    const dx = endX - x;
    const dy = endY - y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) break;

    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const wiggle = random01(seed, x, y, 6000 + i);

    if (wiggle < 0.18) x += stepY === 0 ? stepX : 0;
    else if (wiggle < 0.36) y += stepX === 0 ? stepY : 0;
    else {
      if (Math.abs(dx) > Math.abs(dy)) x += stepX;
      else y += stepY;
    }

    if (wiggle > 0.82) {
      if (Math.abs(dx) > Math.abs(dy)) y += stepY;
      else x += stepX;
    }

    points.add(`${x},${y}`);
    if (x === endX && y === endY) break;
  }

  points.add(`${endX},${endY}`);
  return points;
}

function addRoadBand(roadTiles: Set<string>, path: Set<string>, thickness = 1): void {
  for (const entry of path) {
    const [sx, sy] = entry.split(",").map(Number);
    for (let dy = -thickness; dy <= thickness; dy++) {
      for (let dx = -thickness; dx <= thickness; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > thickness + 1) continue;
        roadTiles.add(`${sx + dx},${sy + dy}`);
      }
    }
  }
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

  const roadHalfWidth = districtType === "industrial" ? 2 : 1;
  const northExitY = regionWorldY + 6;
  const southExitY = regionWorldY + REGION_SIZE - 7;
  const westExitX = regionWorldX + 6;
  const eastExitX = regionWorldX + REGION_SIZE - 7;

  addRoadBand(roadTiles, makeRoadPath(world.state.seed, centerTileX, centerTileY, centerTileX, northExitY), roadHalfWidth);
  addRoadBand(roadTiles, makeRoadPath(world.state.seed, centerTileX, centerTileY, centerTileX, southExitY), roadHalfWidth);
  addRoadBand(roadTiles, makeRoadPath(world.state.seed, centerTileX, centerTileY, westExitX, centerTileY), roadHalfWidth);
  addRoadBand(roadTiles, makeRoadPath(world.state.seed, centerTileX, centerTileY, eastExitX, centerTileY), roadHalfWidth);

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
