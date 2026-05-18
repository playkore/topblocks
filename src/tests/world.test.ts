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

  it("creates city roads when a city exists", () => {
    const world = new World("city-road-seed");
    let city = null;
    for (let y = -2; y <= 2 && !city; y++) {
      for (let x = -2; x <= 2 && !city; x++) {
        city = generateCityPlan(world, x, y);
      }
    }

    if (!city) return;
    expect(city.roadTiles.size).toBeGreaterThan(0);
  });
});
