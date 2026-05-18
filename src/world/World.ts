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
