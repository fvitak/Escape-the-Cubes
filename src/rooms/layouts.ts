import Phaser from 'phaser';
import { ROOM_ENEMY_WAVES } from '../entities/EnemyArchetypes';
import { sideUnitVector, type Side } from '../utils/sides';
import type { DoorSpec, RectSpec, RoomSetup } from './types';

const ROOM_WIDTH = 960;
const ROOM_HEIGHT = 640;
const WALL = 24;
const DOOR_SIZE = 120;

const TILE = 48;
const COLS = 20;
const ROWS = 13;

const sideValues: Side[] = ['top', 'right', 'bottom', 'left'];
const DENSITY_BY_ROOM = [0, 0.2, 0.26, 0.32, 0.38, 0.44, 0];

export function randomExitSide(rngPick: () => Side, entrance: Side): Side {
  const candidates = sideValues.filter((side) => side !== entrance);
  return rngPickFrom(candidates, rngPick);
}

export function sideOptions(): Side[] {
  return sideValues;
}

export function buildRoomSetup(roomIndex: number, exitSide: Side, entrySide: Side | null, layoutVariant = 0): RoomSetup {
  if (roomIndex === 0) {
    const exit = buildDoor('top');
    return {
      roomIndex,
      roomName: 'Escape Antechamber',
      entrance: null,
      exit,
      spawn: { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 },
      spawnFacing: { x: 0, y: -1 },
      entrySide: null,
      walls: buildOuterWalls([exit.side]),
      obstacles: [],
      enemyArchetypes: ROOM_ENEMY_WAVES[0]
    };
  }

  if (roomIndex >= 6) {
    return {
      roomIndex,
      roomName: 'Abyssal Arena',
      entrance: null,
      exit: null,
      isBossRoom: true,
      spawn: { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - 120 },
      spawnFacing: { x: 0, y: -1 },
      entrySide: null,
      walls: buildOuterWalls([]),
      obstacles: [],
      enemyArchetypes: ROOM_ENEMY_WAVES[roomIndex] ?? []
    };
  }

  const entranceSide = entrySide as Side;
  const entrance = buildDoor(entranceSide);
  const exit = buildDoor(exitSide);

  const spawn = spawnPointForSide(entranceSide);
  const inward = sideUnitVector(entranceSide);
  const spawnFacing = { x: -inward.x, y: -inward.y };

  const walls = buildOuterWalls([entrance.side, exit.side]);
  const obstacles = generateRoomObstacles(roomIndex, spawn, entrance, exit, layoutVariant);

  return {
    roomIndex,
    roomName: `Dungeon Room ${roomIndex}`,
    entrance,
    exit,
    spawn,
    spawnFacing,
    entrySide,
    walls,
    obstacles,
    enemyArchetypes: ROOM_ENEMY_WAVES[roomIndex]
  };
}

function generateRoomObstacles(
  roomIndex: number,
  spawn: { x: number; y: number },
  entrance: DoorSpec,
  exit: DoorSpec,
  layoutVariant: number
): RectSpec[] {
  const density = DENSITY_BY_ROOM[roomIndex] ?? 0.3;
  const rand = mulberry32((roomIndex * 1000003 + layoutVariant * 97 + 73) >>> 0);

  const spawnCell = worldToCell(spawn.x, spawn.y);
  const exitCell = worldToCell(exit.trigger.x, exit.trigger.y);

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const blocked: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const protectedCells = new Set<string>();

    protectRect(protectedCells, { x: spawn.x, y: spawn.y, width: 200, height: 200 });
    protectDoorZone(protectedCells, entrance, 120);
    protectDoorZone(protectedCells, exit, 120);

    const eligible = collectEligibleCells(protectedCells);
    const targetBlocks = Math.max(1, Math.floor(eligible.length * density));
    let placed = 0;
    let guards = 0;

    while (placed < targetBlocks && guards < 7000) {
      guards += 1;
      const pick = eligible[Math.floor(rand() * eligible.length)];
      if (!pick) {
        break;
      }

      const sizeRoll = rand();
      const size = sizeRoll < 0.72 ? 1 : sizeRoll < 0.93 ? 2 : 3;
      if (!canPlaceCluster(blocked, protectedCells, pick.col, pick.row, size)) {
        continue;
      }

      placed += placeCluster(blocked, pick.col, pick.row, size);
    }

    if (!hasPath(blocked, spawnCell, exitCell)) {
      continue;
    }

    if (hasDirectCorridor(blocked, spawn, exit.trigger, 38)) {
      const broken = breakDirectCorridor(blocked, protectedCells, spawn, exit.trigger, spawnCell, exitCell, rand);
      if (!broken) {
        continue;
      }
    }

    if (!hasPath(blocked, spawnCell, exitCell)) {
      continue;
    }
    if (hasDirectCorridor(blocked, spawn, exit.trigger, 38)) {
      continue;
    }

    return blockedToRects(blocked);
  }

  const fallbackBlocked: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const fallbackProtected = new Set<string>();
  protectRect(fallbackProtected, { x: spawn.x, y: spawn.y, width: 200, height: 200 });
  protectDoorZone(fallbackProtected, entrance, 120);
  protectDoorZone(fallbackProtected, exit, 120);
  const eligible = collectEligibleCells(fallbackProtected);
  const minTarget = Math.max(1, Math.floor(eligible.length * 0.2));
  let placed = 0;
  for (let i = 0; i < eligible.length && placed < minTarget; i += 1) {
    const pick = eligible[i];
    if (canPlaceIsolated(fallbackBlocked, pick.col, pick.row)) {
      fallbackBlocked[pick.row][pick.col] = true;
      placed += 1;
    }
  }
  if (!hasPath(fallbackBlocked, spawnCell, exitCell)) {
    return [];
  }
  return blockedToRects(fallbackBlocked);
}

function buildOuterWalls(openings: Side[]): RectSpec[] {
  const openSet = new Set<Side>(openings);
  const walls: RectSpec[] = [];

  if (openSet.has('top')) {
    walls.push({ x: 220, y: WALL / 2, width: 440, height: WALL });
    walls.push({ x: 740, y: WALL / 2, width: 440, height: WALL });
  } else {
    walls.push({ x: ROOM_WIDTH / 2, y: WALL / 2, width: ROOM_WIDTH, height: WALL });
  }

  if (openSet.has('bottom')) {
    walls.push({ x: 220, y: ROOM_HEIGHT - WALL / 2, width: 440, height: WALL });
    walls.push({ x: 740, y: ROOM_HEIGHT - WALL / 2, width: 440, height: WALL });
  } else {
    walls.push({ x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - WALL / 2, width: ROOM_WIDTH, height: WALL });
  }

  if (openSet.has('left')) {
    walls.push({ x: WALL / 2, y: 150, width: WALL, height: 300 });
    walls.push({ x: WALL / 2, y: 510, width: WALL, height: 260 });
  } else {
    walls.push({ x: WALL / 2, y: ROOM_HEIGHT / 2, width: WALL, height: ROOM_HEIGHT });
  }

  if (openSet.has('right')) {
    walls.push({ x: ROOM_WIDTH - WALL / 2, y: 150, width: WALL, height: 300 });
    walls.push({ x: ROOM_WIDTH - WALL / 2, y: 510, width: WALL, height: 260 });
  } else {
    walls.push({ x: ROOM_WIDTH - WALL / 2, y: ROOM_HEIGHT / 2, width: WALL, height: ROOM_HEIGHT });
  }

  return walls;
}

function spawnPointForSide(side: Side): { x: number; y: number } {
  const margin = 88;

  switch (side) {
    case 'top':
      return { x: ROOM_WIDTH / 2, y: margin };
    case 'bottom':
      return { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - margin };
    case 'left':
      return { x: margin, y: ROOM_HEIGHT / 2 };
    case 'right':
      return { x: ROOM_WIDTH - margin, y: ROOM_HEIGHT / 2 };
  }
}

function buildDoor(side: Side): DoorSpec {
  switch (side) {
    case 'top':
      return { side, trigger: { x: ROOM_WIDTH / 2, y: 36, width: DOOR_SIZE, height: 36 } };
    case 'bottom':
      return { side, trigger: { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - 36, width: DOOR_SIZE, height: 36 } };
    case 'left':
      return { side, trigger: { x: 36, y: ROOM_HEIGHT / 2, width: 36, height: DOOR_SIZE } };
    case 'right':
      return { side, trigger: { x: ROOM_WIDTH - 36, y: ROOM_HEIGHT / 2, width: 36, height: DOOR_SIZE } };
  }
}

function protectDoorZone(set: Set<string>, door: DoorSpec, buffer: number): void {
  const outward = sideUnitVector(door.side);
  const inward = { x: -outward.x, y: -outward.y };

  protectRect(set, {
    x: door.trigger.x,
    y: door.trigger.y,
    width: door.trigger.width + buffer,
    height: door.trigger.height + buffer
  });

  protectRect(set, {
    x: door.trigger.x + inward.x * 90,
    y: door.trigger.y + inward.y * 90,
    width: door.side === 'left' || door.side === 'right' ? 220 : 300,
    height: door.side === 'left' || door.side === 'right' ? 300 : 220
  });
}

function protectRect(set: Set<string>, rect: RectSpec): void {
  const x0 = Math.floor((rect.x - rect.width / 2) / TILE);
  const x1 = Math.floor((rect.x + rect.width / 2) / TILE);
  const y0 = Math.floor((rect.y - rect.height / 2) / TILE);
  const y1 = Math.floor((rect.y + rect.height / 2) / TILE);

  for (let row = y0; row <= y1; row += 1) {
    for (let col = x0; col <= x1; col += 1) {
      if (col < 1 || row < 1 || col >= COLS - 1 || row >= ROWS - 1) {
        continue;
      }
      set.add(cellKey(col, row));
    }
  }
}

function hasPath(blocked: boolean[][], start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  const queue: Array<{ x: number; y: number }> = [start];
  const visited = new Set<string>([cellKey(start.x, start.y)]);

  while (queue.length > 0) {
    const cur = queue.shift() as { x: number; y: number };
    if (cur.x === end.x && cur.y === end.y) {
      return true;
    }

    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 }
    ];

    for (const next of neighbors) {
      if (next.x < 1 || next.y < 1 || next.x >= COLS - 1 || next.y >= ROWS - 1) {
        continue;
      }
      if (blocked[next.y][next.x]) {
        continue;
      }

      const key = cellKey(next.x, next.y);
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(next);
    }
  }

  return false;
}

function hasDirectCorridor(
  blocked: boolean[][],
  start: { x: number; y: number },
  door: RectSpec,
  thicknessPx: number
): boolean {
  const end = { x: door.x, y: door.y };
  const dir = new Phaser.Math.Vector2(end.x - start.x, end.y - start.y);
  const length = Math.max(1, dir.length());
  dir.normalize();
  const perp = new Phaser.Math.Vector2(-dir.y, dir.x);

  const offsets = [-thicknessPx / 2, 0, thicknessPx / 2];
  const steps = Math.max(8, Math.floor(length / 8));

  for (const off of offsets) {
    let rayBlocked = false;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const px = start.x + dir.x * length * t + perp.x * off;
      const py = start.y + dir.y * length * t + perp.y * off;
      const cell = worldToCell(px, py);
      if (blocked[cell.y][cell.x]) {
        rayBlocked = true;
        break;
      }
    }
    if (!rayBlocked) {
      return true;
    }
  }

  return false;
}

function breakDirectCorridor(
  blocked: boolean[][],
  protectedCells: Set<string>,
  start: { x: number; y: number },
  door: RectSpec,
  spawnCell: { x: number; y: number },
  exitCell: { x: number; y: number },
  rand: () => number
): boolean {
  const points: Array<{ col: number; row: number }> = [];
  const steps = 36;

  for (let i = 2; i < steps - 2; i += 1) {
    const t = i / steps;
    const px = Phaser.Math.Linear(start.x, door.x, t);
    const py = Phaser.Math.Linear(start.y, door.y, t);
    const cell = worldToCell(px, py);
    const key = cellKey(cell.x, cell.y);
    if (protectedCells.has(key)) {
      continue;
    }
    if (!points.some((p) => p.col === cell.x && p.row === cell.y)) {
      points.push({ col: cell.x, row: cell.y });
    }
  }

  for (let i = points.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }

  let added = 0;
  for (const p of points) {
    if (added >= 3) {
      break;
    }
    if (blocked[p.row][p.col]) {
      continue;
    }
    if (!canPlaceIsolated(blocked, p.col, p.row)) {
      continue;
    }

    blocked[p.row][p.col] = true;
    if (!hasPath(blocked, spawnCell, exitCell)) {
      blocked[p.row][p.col] = false;
      continue;
    }

    added += 1;
    if (!hasDirectCorridor(blocked, start, door, 38)) {
      return true;
    }
  }

  return !hasDirectCorridor(blocked, start, door, 38);
}

function blockedToRects(blocked: boolean[][]): RectSpec[] {
  const obstacles: RectSpec[] = [];
  const visited: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  for (let row = 1; row < ROWS - 1; row += 1) {
    for (let col = 1; col < COLS - 1; col += 1) {
      if (!blocked[row][col] || visited[row][col]) {
        continue;
      }

      let width = 1;
      while (col + width < COLS - 1 && blocked[row][col + width] && !visited[row][col + width]) {
        width += 1;
      }

      let height = 1;
      while (row + height < ROWS - 1) {
        let canGrow = true;
        for (let x = col; x < col + width; x += 1) {
          if (!blocked[row + height][x] || visited[row + height][x]) {
            canGrow = false;
            break;
          }
        }
        if (!canGrow) {
          break;
        }
        height += 1;
      }

      for (let y = row; y < row + height; y += 1) {
        for (let x = col; x < col + width; x += 1) {
          visited[y][x] = true;
        }
      }

      const min = cellCenter(col, row);
      const max = cellCenter(col + width - 1, row + height - 1);
      obstacles.push({
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        width: width * TILE - 12,
        height: height * TILE - 12
      });
    }
  }

  return obstacles;
}

function worldToCell(x: number, y: number): { x: number; y: number } {
  return {
    x: Phaser.Math.Clamp(Math.floor(x / TILE), 1, COLS - 2),
    y: Phaser.Math.Clamp(Math.floor(y / TILE), 1, ROWS - 2)
  };
}

function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function cellKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function canPlaceIsolated(blocked: boolean[][], col: number, row: number): boolean {
  for (let y = row - 1; y <= row + 1; y += 1) {
    for (let x = col - 1; x <= col + 1; x += 1) {
      if (x === col && y === row) {
        continue;
      }
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) {
        continue;
      }
      if (blocked[y][x]) {
        return false;
      }
    }
  }
  return true;
}

function canPlaceCluster(
  blocked: boolean[][],
  protectedCells: Set<string>,
  col: number,
  row: number,
  size: number
): boolean {
  const c1 = col + size - 1;
  const r1 = row + size - 1;
  if (col < 1 || row < 1 || c1 >= COLS - 1 || r1 >= ROWS - 1) {
    return false;
  }

  for (let y = row - 1; y <= r1 + 1; y += 1) {
    for (let x = col - 1; x <= c1 + 1; x += 1) {
      if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) {
        continue;
      }
      if (blocked[y][x]) {
        return false;
      }
      if (x >= col && x <= c1 && y >= row && y <= r1 && protectedCells.has(cellKey(x, y))) {
        return false;
      }
    }
  }
  return true;
}

function placeCluster(blocked: boolean[][], col: number, row: number, size: number): number {
  let count = 0;
  for (let y = row; y < row + size; y += 1) {
    for (let x = col; x < col + size; x += 1) {
      blocked[y][x] = true;
      count += 1;
    }
  }
  return count;
}

function collectEligibleCells(protectedCells: Set<string>): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number }> = [];
  for (let row = 1; row < ROWS - 1; row += 1) {
    for (let col = 1; col < COLS - 1; col += 1) {
      if (protectedCells.has(cellKey(col, row))) {
        continue;
      }
      cells.push({ col, row });
    }
  }
  return cells;
}

function rngPickFrom(candidates: Side[], rngPick: () => Side): Side {
  while (true) {
    const pick = rngPick();
    if (candidates.includes(pick)) {
      return pick;
    }
  }
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
