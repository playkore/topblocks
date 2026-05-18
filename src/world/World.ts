import { BIOME, TILE, type BuildingObject, type CityPlan, type TreeObject, type WorldState } from "./types";
import { floorDiv } from "../shared/math";
import { hashStringToSeed, random01 } from "../generation/rng";
import { sampleTerrain, type TerrainSample } from "../generation/terrain";
import { generateBuildingForSector, applyDamageToBuilding } from "../generation/buildings";
import { FOREST_PATCH_SIZE, generateForestPatch } from "../generation/forest";
import { generateCityBuildings, generateCityPlan, REGION_SIZE } from "../generation/cities";

export type FeatureSummary = {
  buildingCount: number;
  cityCount: number;
  treePatchCount: number;
};

type WarmupBounds = {
  startTileX: number;
  startTileY: number;
  tilesAcross: number;
  tilesDown: number;
};

type WarmupState = {
  bounds: WarmupBounds | null;
  signature: string;
  terrainCursor: number;
  regionCursor: number;
  sectorCursor: number;
  forestCursor: number;
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
  private terrainSampleCacheCursor = 0;
  private readonly TERRAIN_SAMPLE_CACHE_LIMIT = 80_000;
  private cityBuildingCache = new Map<string, BuildingObject[]>();
  private readonly warmup: WarmupState = {
    bounds: null,
    signature: "",
    terrainCursor: 0,
    regionCursor: 0,
    sectorCursor: 0,
    forestCursor: 0,
  };

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
    this.terrainSampleCacheCursor = 0;
    this.resetWarmup();
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

    if (this.terrainSampleCacheKeys.length - this.terrainSampleCacheCursor > this.TERRAIN_SAMPLE_CACHE_LIMIT) {
      const deleteCount = Math.floor(this.TERRAIN_SAMPLE_CACHE_LIMIT * 0.2);
      for (let i = 0; i < deleteCount; i++) {
        const oldKey = this.terrainSampleCacheKeys[this.terrainSampleCacheCursor++];
        if (oldKey) this.terrainSampleCache.delete(oldKey);
      }

      if (this.terrainSampleCacheCursor > this.TERRAIN_SAMPLE_CACHE_LIMIT) {
        this.terrainSampleCacheKeys.splice(0, this.terrainSampleCacheCursor);
        this.terrainSampleCacheCursor = 0;
      }
    }

    return sample;
  }

  peekTerrainSample(worldX: number, worldY: number): TerrainSample | null {
    return this.terrainSampleCache.get(`${worldX},${worldY}`) ?? null;
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

  peekCityBuildingAt(worldX: number, worldY: number): BuildingObject | null {
    const regionX = floorDiv(worldX, this.REGION_SIZE);
    const regionY = floorDiv(worldY, this.REGION_SIZE);
    const city = this.cityCache.get(`${regionX},${regionY}`);
    if (city === undefined || city === null) return null;

    const buildings = this.cityBuildingCache.get(city.key);
    if (!buildings) return null;

    for (const building of buildings) {
      if (worldX < building.originX || worldY < building.originY) continue;
      if (worldX >= building.originX + building.width || worldY >= building.originY + building.height) continue;
      return building;
    }

    return null;
  }

  peekBuildingAt(worldX: number, worldY: number): BuildingObject | null {
    const cityBuilding = this.peekCityBuildingAt(worldX, worldY);
    if (cityBuilding) return cityBuilding;

    const sectorX = floorDiv(worldX, this.SECTOR_SIZE);
    const sectorY = floorDiv(worldY, this.SECTOR_SIZE);
    const building = this.buildingCache.get(`${sectorX},${sectorY}`);
    if (building === undefined || building === null) return null;
    if (worldX < building.originX || worldY < building.originY) return null;
    if (worldX >= building.originX + building.width || worldY >= building.originY + building.height) return null;
    return building;
  }

  getCityBuildings(city: CityPlan): BuildingObject[] {
    const cached = this.cityBuildingCache.get(city.key);
    if (cached !== undefined) return cached;
    const buildings = generateCityBuildings(this, city);
    this.cityBuildingCache.set(city.key, buildings);
    return buildings;
  }

  peekTreesForPatch(patchX: number, patchY: number): TreeObject[] | null {
    return this.forestCache.get(`${patchX},${patchY}`) ?? null;
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

  warmVisibleArea(startTileX: number, startTileY: number, tilesAcross: number, tilesDown: number, budgetMs = 4): boolean {
    if (tilesAcross <= 0 || tilesDown <= 0 || budgetMs <= 0) return true;

    const signature = `${startTileX}:${startTileY}:${tilesAcross}:${tilesDown}`;
    if (this.warmup.signature !== signature) {
      this.warmup.signature = signature;
      this.warmup.bounds = { startTileX, startTileY, tilesAcross, tilesDown };
      this.warmup.terrainCursor = 0;
      this.warmup.regionCursor = 0;
      this.warmup.sectorCursor = 0;
      this.warmup.forestCursor = 0;
    }

    const bounds = this.warmup.bounds;
    if (!bounds) return true;

    const minRegionX = floorDiv(bounds.startTileX, this.REGION_SIZE);
    const maxRegionX = floorDiv(bounds.startTileX + bounds.tilesAcross - 1, this.REGION_SIZE);
    const minRegionY = floorDiv(bounds.startTileY, this.REGION_SIZE);
    const maxRegionY = floorDiv(bounds.startTileY + bounds.tilesDown - 1, this.REGION_SIZE);
    const regionCols = maxRegionX - minRegionX + 1;
    const regionRows = maxRegionY - minRegionY + 1;

    const minSectorX = floorDiv(bounds.startTileX, this.SECTOR_SIZE);
    const maxSectorX = floorDiv(bounds.startTileX + bounds.tilesAcross - 1, this.SECTOR_SIZE);
    const minSectorY = floorDiv(bounds.startTileY, this.SECTOR_SIZE);
    const maxSectorY = floorDiv(bounds.startTileY + bounds.tilesDown - 1, this.SECTOR_SIZE);
    const sectorCols = maxSectorX - minSectorX + 1;
    const sectorRows = maxSectorY - minSectorY + 1;

    const minForestPatchX = floorDiv(bounds.startTileX, FOREST_PATCH_SIZE);
    const maxForestPatchX = floorDiv(bounds.startTileX + bounds.tilesAcross - 1, FOREST_PATCH_SIZE);
    const minForestPatchY = floorDiv(bounds.startTileY, FOREST_PATCH_SIZE);
    const maxForestPatchY = floorDiv(bounds.startTileY + bounds.tilesDown - 1, FOREST_PATCH_SIZE);
    const forestCols = maxForestPatchX - minForestPatchX + 1;
    const forestRows = maxForestPatchY - minForestPatchY + 1;

    const totalTerrain = bounds.tilesAcross * bounds.tilesDown;
    const totalRegions = regionCols * regionRows;
    const totalSectors = sectorCols * sectorRows;
    const totalForest = forestCols * forestRows;
    const shouldWarmTerrainTiles = totalTerrain <= this.TERRAIN_SAMPLE_CACHE_LIMIT * 0.75;

    if (!shouldWarmTerrainTiles) {
      this.warmup.terrainCursor = totalTerrain;
    }

    const deadline = performance.now() + budgetMs;
    while (performance.now() < deadline) {
      // Важно: сначала регионы/здания/леса, потом terrain. Иначе при zoom out
      // прогрев terrain может занять весь бюджет до того, как дойдет до объектов.
      if (this.warmup.regionCursor < totalRegions) {
        const index = this.warmup.regionCursor++;
        const regionX = minRegionX + (index % regionCols);
        const regionY = minRegionY + Math.floor(index / regionCols);
        const centerX = regionX * this.REGION_SIZE + this.REGION_SIZE / 2;
        const centerY = regionY * this.REGION_SIZE + this.REGION_SIZE / 2;
        this.getCityBuildingAt(Math.floor(centerX), Math.floor(centerY));
        continue;
      }

      if (this.warmup.sectorCursor < totalSectors) {
        const index = this.warmup.sectorCursor++;
        const sectorX = minSectorX + (index % sectorCols);
        const sectorY = minSectorY + Math.floor(index / sectorCols);
        const centerX = sectorX * this.SECTOR_SIZE + Math.floor(this.SECTOR_SIZE / 2);
        const centerY = sectorY * this.SECTOR_SIZE + Math.floor(this.SECTOR_SIZE / 2);
        this.getBuildingAt(centerX, centerY);
        continue;
      }

      if (this.warmup.forestCursor < totalForest) {
        const index = this.warmup.forestCursor++;
        const patchX = minForestPatchX + (index % forestCols);
        const patchY = minForestPatchY + Math.floor(index / forestCols);
        this.getTreesForPatch(patchX, patchY);
        continue;
      }

      if (shouldWarmTerrainTiles && this.warmup.terrainCursor < totalTerrain) {
        const index = this.warmup.terrainCursor++;
        const tileX = bounds.startTileX + (index % bounds.tilesAcross);
        const tileY = bounds.startTileY + Math.floor(index / bounds.tilesAcross);
        this.getTerrainSample(tileX, tileY);
        continue;
      }

      break;
    }

    return (
      this.warmup.regionCursor >= totalRegions &&
      this.warmup.sectorCursor >= totalSectors &&
      this.warmup.forestCursor >= totalForest &&
      this.warmup.terrainCursor >= totalTerrain
    );
  }

  private resetWarmup(): void {
    this.warmup.bounds = null;
    this.warmup.signature = "";
    this.warmup.terrainCursor = 0;
    this.warmup.regionCursor = 0;
    this.warmup.sectorCursor = 0;
    this.warmup.forestCursor = 0;
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
