export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function floorDiv(n: number, d: number): number {
  return Math.floor(n / d);
}

export function mod(n: number, d: number): number {
  return ((n % d) + d) % d;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function makeGrid<T>(width: number, height: number, fill: T): T[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

export function cloneGrid<T>(source: T[][]): T[][] {
  return source.map(row => row.slice());
}

export function inBounds<T>(grid: T[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

export function countNeighbors<T>(grid: T[][], x: number, y: number, values: readonly T[]): number {
  let count = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(grid, nx, ny) && values.includes(grid[ny][nx])) count++;
  }
  return count;
}
