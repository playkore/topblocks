import { clamp, mod } from "../shared/math";

export const VIEW_BASE_TILE_SIZE = 16;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  get tileSize(): number {
    return VIEW_BASE_TILE_SIZE * this.zoom;
  }

  centerOnTile(tileX: number, tileY: number, screenWidth: number, screenHeight: number): void {
    this.x = tileX * this.tileSize - screenWidth / 2;
    this.y = tileY * this.tileSize - screenHeight / 2;
  }

  setZoomAround(screenX: number, screenY: number, nextZoom: number): void {
    const oldTileSize = this.tileSize;
    const worldTileX = (this.x + screenX) / oldTileSize;
    const worldTileY = (this.y + screenY) / oldTileSize;
    this.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const newTileSize = this.tileSize;
    this.x = worldTileX * newTileSize - screenX;
    this.y = worldTileY * newTileSize - screenY;
  }

  panBy(deltaX: number, deltaY: number): void {
    this.x += deltaX;
    this.y += deltaY;
  }

  screenToTile(screenX: number, screenY: number): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor((this.x + screenX) / this.tileSize),
      tileY: Math.floor((this.y + screenY) / this.tileSize),
    };
  }

  visibleBounds(screenWidth: number, screenHeight: number) {
    const startTileX = Math.floor(this.x / this.tileSize);
    const startTileY = Math.floor(this.y / this.tileSize);
    const offsetX = -mod(this.x, this.tileSize);
    const offsetY = -mod(this.y, this.tileSize);
    const tilesAcross = Math.ceil(screenWidth / this.tileSize) + 2;
    const tilesDown = Math.ceil(screenHeight / this.tileSize) + 2;

    return { startTileX, startTileY, offsetX, offsetY, tilesAcross, tilesDown };
  }
}
