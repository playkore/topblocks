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
