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
