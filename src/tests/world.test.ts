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

  it("evicts terrain samples without shifting the entire cache array", () => {
    const world = new World("cache-eviction-seed") as any;
    world.TERRAIN_SAMPLE_CACHE_LIMIT = 5;

    for (let i = 0; i < 7; i++) {
      world.getTerrainSample(i, 0);
    }

    expect(world.terrainSampleCache.size).toBe(5);
    expect(world.terrainSampleCacheCursor).toBe(2);
    expect(world.terrainSampleCache.has("0,0")).toBe(false);
    expect(world.terrainSampleCache.has("1,0")).toBe(false);
    expect(world.terrainSampleCache.has("2,0")).toBe(true);
    expect(world.terrainSampleCacheKeys.slice(0, 2)).toEqual(["0,0", "1,0"]);
  });
});
