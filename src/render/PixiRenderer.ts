import { Application, Container, Sprite, Texture } from "pixi.js";
import { BIOME, TILE, type BiomeId, type TreeObject } from "../world/types";
import type { World } from "../world/World";
import { VIEW_BASE_TILE_SIZE, type Camera } from "../game/Camera";

type RenderItem = {
  x: number;
  y: number;
  width: number;
  height: number;
  texture: Texture;
  tint?: number;
  alpha?: number;
};

const BIOME_TINTS: Record<BiomeId, number> = {
  meadow: 0x5ba246,
  forest: 0x3d7a35,
  rocky: 0x8a8d88,
  swamp: 0x4f7659,
  town: 0x62844f,
};

class LayerPool {
  readonly container = new Container();
  readonly sprites: Sprite[] = [];

  ensure(count: number): void {
    while (this.sprites.length < count) {
      const sprite = new Sprite();
      sprite.visible = false;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
  }
}

export class PixiRenderer {
  private readonly app = new Application();
  private readonly terrain = new LayerPool();
  private readonly buildings = new LayerPool();
  private readonly roofs = new LayerPool();
  private readonly trees = new LayerPool();

  readonly textures: Record<string, Texture> = Object.create(null);

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: parent,
      background: 0x08111d,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    parent.appendChild(this.app.canvas);
    this.buildTextures();
    this.app.stage.addChild(
      this.terrain.container,
      this.buildings.container,
      this.roofs.container,
      this.trees.container,
    );
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  render(world: World, camera: Camera): void {
    const tileSize = camera.tileSize;
    const { startTileX, startTileY, offsetX, offsetY, tilesAcross, tilesDown } = camera.visibleBounds(this.width, this.height);
    const terrainStep = this.getTerrainStep(tileSize);

    const terrainItems: RenderItem[] = [];
    const buildingItems: RenderItem[] = [];
    const roofItems: RenderItem[] = [];
    const treeItems: RenderItem[] = [];

    for (let y = 0; y < tilesDown; y++) {
      for (let x = 0; x < tilesAcross; x++) {
        const worldX = startTileX + x;
        const worldY = startTileY + y;
        const screenX = offsetX + x * tileSize;
        const screenY = offsetY + y * tileSize;
        const building = world.peekBuildingAt(worldX, worldY);

        if (building) {
          const localX = worldX - building.originX;
          const localY = worldY - building.originY;
          const tile = building.grid[localY][localX];
          if (tile !== TILE.GRASS) {
            buildingItems.push(this.makeItem(tile, screenX, screenY, tileSize, worldX, worldY));
            if (building.roofMask[localY][localX]) {
              roofItems.push(this.makeRoofItem(worldX, worldY, building, screenX, screenY, tileSize));
            }
            continue;
          }
        }
      }
    }

    for (let y = 0; y < tilesDown; y += terrainStep) {
      for (let x = 0; x < tilesAcross; x += terrainStep) {
        const worldX = startTileX + x;
        const worldY = startTileY + y;
        const screenX = offsetX + x * tileSize;
        const screenY = offsetY + y * tileSize;
        const terrain = world.getTerrainSample(worldX, worldY);
        terrainItems.push(this.makeTerrainItem(
          terrain.baseTile,
          terrain.biomeId,
          screenX,
          screenY,
          tileSize * terrainStep,
          worldX,
          worldY,
        ));
      }
    }

    const minForestPatchX = Math.floor(startTileX / 96) - 1;
    const minForestPatchY = Math.floor(startTileY / 96) - 1;
    const maxForestPatchX = Math.floor((startTileX + tilesAcross) / 96) + 1;
    const maxForestPatchY = Math.floor((startTileY + tilesDown) / 96) + 1;
    for (let patchY = minForestPatchY; patchY <= maxForestPatchY; patchY++) {
      for (let patchX = minForestPatchX; patchX <= maxForestPatchX; patchX++) {
        const trees = world.peekTreesForPatch(patchX, patchY);
        if (!trees) continue;
        for (const tree of trees) {
          this.appendTreeItems(treeItems, tree, startTileX, startTileY, offsetX, offsetY, tileSize);
        }
      }
    }

    this.syncLayer(this.terrain, terrainItems);
    this.syncLayer(this.buildings, buildingItems);
    this.syncLayer(this.roofs, roofItems);
    this.syncLayer(this.trees, treeItems);
  }

  private getTerrainStep(tileSize: number): number {
    if (tileSize < 1.5) return 8;
    if (tileSize < 3) return 4;
    return 1;
  }

  private buildTextures(): void {
    const size = 16;
    this.textures.grass = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#4f8f3a";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(4, 5, 2, 6);
      ctx.fillRect(10, 2, 2, 5);
    });
    this.textures.water = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#2c6bdf";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(2, 6, 12, 2);
      ctx.fillRect(4, 10, 8, 1);
    });
    this.textures.rock = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#7f837d";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(4, 3, 5, 2);
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(6, 10, 7, 2);
    });
    this.textures.dirt = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#4f402f";
      ctx.fillRect(0, 0, size, size);
    });
    this.textures.road = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#6f5d47";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(6, 0, 4, size);
    });
    this.textures.pavement = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#5d6874";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(2, 3, 11, 2);
    });
    this.textures.floor = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#2a2f36";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(2, 3, 12, 1);
      ctx.fillRect(2, 8, 12, 1);
    });
    this.textures.wall = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#70766f";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(3, 3, 5, 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(3, 12, 10, 2);
    });
    this.textures.cracked_wall = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#594f48";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#372f2a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, 3);
      ctx.lineTo(8, 6);
      ctx.lineTo(6, 11);
      ctx.lineTo(12, 13);
      ctx.stroke();
    });
    this.textures.broken_wall = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#473b33";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#6f655d";
      ctx.fillRect(2, 3, 3, 3);
      ctx.fillRect(10, 4, 3, 4);
    });
    this.textures.rubble = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#3b322d";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#635248";
      ctx.fillRect(3, 4, 4, 3);
      ctx.fillRect(9, 10, 4, 2);
    });
    this.textures.hole = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#181412";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.strokeRect(2.5, 2.5, 11, 11);
    });
    this.textures.door = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#5a3922";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(4, 4, 2, 8);
    });
    this.textures.wood = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#4b311c";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(3, 3, 2, 10);
    });
    this.textures.tree_leaf = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#1f5f2b";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(4, 3, 3, 4);
    });
    this.textures.tree_trunk = this.makeTexture(size, size, ctx => {
      ctx.fillStyle = "#7a4a22";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(6, 3, 2, 9);
    });
    this.textures.roofDarkHorizontal = this.makeRoofTexture(size, "horizontal", "dark");
    this.textures.roofLightHorizontal = this.makeRoofTexture(size, "horizontal", "light");
    this.textures.roofRidgeHorizontal = this.makeRoofTexture(size, "horizontal", "ridge");
    this.textures.roofDarkVertical = this.makeRoofTexture(size, "vertical", "dark");
    this.textures.roofLightVertical = this.makeRoofTexture(size, "vertical", "light");
    this.textures.roofRidgeVertical = this.makeRoofTexture(size, "vertical", "ridge");
  }

  private makeTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    draw(ctx);
    return Texture.from(canvas);
  }

  private makeItem(tile: string, x: number, y: number, size: number, worldX: number, worldY: number): RenderItem {
    let texture = this.textures.grass;
    let tint = 0xffffff;

    switch (tile) {
      case TILE.GRASS:
        texture = this.textures.grass;
        break;
      case TILE.WATER:
        texture = this.textures.water;
        break;
      case TILE.ROCK:
        texture = this.textures.rock;
        break;
      case TILE.DIRT:
        texture = this.textures.dirt;
        break;
      case TILE.ROAD:
        texture = this.textures.road;
        break;
      case TILE.PAVEMENT:
        texture = this.textures.pavement;
        break;
      case TILE.FLOOR:
        texture = this.textures.floor;
        break;
      case TILE.WALL:
        texture = this.textures.wall;
        break;
      case TILE.CRACKED_WALL:
        texture = this.textures.cracked_wall;
        break;
      case TILE.BROKEN_WALL:
        texture = this.textures.broken_wall;
        break;
      case TILE.RUBBLE:
        texture = this.textures.rubble;
        break;
      case TILE.HOLE:
        texture = this.textures.hole;
        break;
      case TILE.DOOR:
        texture = this.textures.door;
        break;
      case TILE.WOOD:
        texture = this.textures.wood;
        break;
      case TILE.TREE_LEAF:
        texture = this.textures.tree_leaf;
        break;
      case TILE.TREE_TRUNK:
        texture = this.textures.tree_trunk;
        break;
    }

    if (tile === TILE.GRASS) {
      tint = BIOME_TINTS[BIOME.MEADOW];
    }

    return { x, y, width: size, height: size, texture, tint };
  }

  private makeTerrainItem(tile: string, biome: BiomeId, x: number, y: number, size: number, worldX: number, worldY: number): RenderItem {
    const item = this.makeItem(tile, x, y, size, worldX, worldY);
    if (tile === TILE.GRASS) item.tint = BIOME_TINTS[biome];
    return item;
  }

  private makeRoofItem(worldX: number, worldY: number, building: { orientation: string; bounds: { x: number; y: number; w: number; h: number }; originX: number; originY: number }, x: number, y: number, size: number): RenderItem {
    const localX = worldX - building.originX;
    const localY = worldY - building.originY;
    const { orientation, bounds } = building;
    const ridge = orientation === "horizontal"
      ? Math.abs((localY + 0.5) - (bounds.y + bounds.h / 2)) < 0.8
      : Math.abs((localX + 0.5) - (bounds.x + bounds.w / 2)) < 0.8;
    const firstSide = orientation === "horizontal"
      ? localY + 0.5 < bounds.y + bounds.h / 2
      : localX + 0.5 < bounds.x + bounds.w / 2;

    const texture = this.getRoofTexture(String(orientation), ridge ? "ridge" : firstSide ? "dark" : "light");
    return { x, y, width: size, height: size, texture };
  }

  private appendTreeItems(
    target: RenderItem[],
    tree: TreeObject,
    startTileX: number,
    startTileY: number,
    offsetX: number,
    offsetY: number,
    tileSize: number,
  ): void {
    const endTileX = startTileX + Math.ceil(this.width / tileSize) + 2;
    const endTileY = startTileY + Math.ceil(this.height / tileSize) + 2;

    for (let y = 0; y < tree.height; y++) {
      for (let x = 0; x < tree.width; x++) {
        const cell = tree.mask[y][x];
        if (!cell) continue;
        const worldX = tree.originX + x;
        const worldY = tree.originY + y;
        if (worldX < startTileX - 1 || worldX > endTileX) continue;
        if (worldY < startTileY - 1 || worldY > endTileY) continue;
        const screenX = offsetX + (worldX - startTileX) * tileSize;
        const screenY = offsetY + (worldY - startTileY) * tileSize;
        target.push(this.makeItem(cell === 2 ? TILE.TREE_TRUNK : TILE.TREE_LEAF, screenX, screenY, tileSize, worldX, worldY));
      }
    }
  }

  private syncLayer(pool: LayerPool, items: RenderItem[]): void {
    pool.ensure(items.length);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sprite = pool.sprites[i];
      sprite.visible = true;
      sprite.texture = item.texture;
      sprite.x = item.x;
      sprite.y = item.y;
      sprite.scale.set(item.width / VIEW_BASE_TILE_SIZE, item.height / VIEW_BASE_TILE_SIZE);
      sprite.alpha = item.alpha ?? 1;
      sprite.tint = item.tint ?? 0xffffff;
    }
    for (let i = items.length; i < pool.sprites.length; i++) {
      pool.sprites[i].visible = false;
    }
  }

  private makeRoofTexture(size: number, orientation: "horizontal" | "vertical", tone: "dark" | "light" | "ridge"): Texture {
    return this.makeTexture(size, size, ctx => {
      const base = tone === "dark" ? "#5e6871" : "#7a858e";
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);

      if (orientation === "horizontal") {
        if (tone === "ridge") {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(2, 2, size - 4, 2);
        } else if (tone === "dark") {
          ctx.fillStyle = "rgba(0,0,0,0.10)";
          ctx.fillRect(0, size - 4, size, 4);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.10)";
          ctx.fillRect(0, 0, size, 4);
        }
      } else {
        if (tone === "ridge") {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(2, 2, 2, size - 4);
        } else if (tone === "dark") {
          ctx.fillStyle = "rgba(0,0,0,0.10)";
          ctx.fillRect(size - 4, 0, 4, size);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.10)";
          ctx.fillRect(0, 0, 4, size);
        }
      }

      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    });
  }

  private getRoofTexture(orientation: string, tone: "dark" | "light" | "ridge"): Texture {
    if (orientation === "horizontal") {
      if (tone === "ridge") return this.textures.roofRidgeHorizontal;
      return tone === "dark" ? this.textures.roofDarkHorizontal : this.textures.roofLightHorizontal;
    }
    if (tone === "ridge") return this.textures.roofRidgeVertical;
    return tone === "dark" ? this.textures.roofDarkVertical : this.textures.roofLightVertical;
  }
}
