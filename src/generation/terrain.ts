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

function sampleTerrainFields(seed: number, worldX: number, worldY: number) {
  const height = fractalNoise(seed, worldX, worldY, 2000);
  const moisture = fractalNoise(seed, worldX, worldY, 1000);
  const townBias = fractalNoise(seed, worldX, worldY, 5000);

  return { height, moisture, townBias };
}

export function getBiomeAt(seed: number, worldX: number, worldY: number): BiomeId {
  const { height, moisture, townBias } = sampleTerrainFields(seed, worldX, worldY);

  if (height > 0.76) return BIOME.ROCKY;
  if (moisture > 0.72 && height < 0.46) return BIOME.SWAMP;
  if (townBias > 0.69 && moisture > 0.44 && height > 0.35) return BIOME.TOWN;
  if (moisture > 0.55) return BIOME.FOREST;
  return BIOME.MEADOW;
}

export function sampleTerrain(seed: number, worldX: number, worldY: number): TerrainSample {
  const { height, moisture, townBias } = sampleTerrainFields(seed, worldX, worldY);
  const temperature = clamp(1 - Math.abs(worldY % 512) / 512, 0, 1);
  let biomeId: BiomeId;
  if (height > 0.76) biomeId = BIOME.ROCKY;
  else if (moisture > 0.72 && height < 0.46) biomeId = BIOME.SWAMP;
  else if (townBias > 0.69 && moisture > 0.44 && height > 0.35) biomeId = BIOME.TOWN;
  else if (moisture > 0.55) biomeId = BIOME.FOREST;
  else biomeId = BIOME.MEADOW;

  let baseTile: TileId = TILE.GRASS;
  if (height > 0.82) baseTile = TILE.ROCK;
  else if (moisture > 0.63 && height < 0.68) baseTile = TILE.WATER;
  else if (biomeId === BIOME.SWAMP) baseTile = TILE.DIRT;
  else if (biomeId === BIOME.ROCKY) baseTile = TILE.ROCK;

  return { height, moisture, temperature, biomeId, baseTile };
}
