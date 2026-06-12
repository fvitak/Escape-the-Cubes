import { buildDoor, buildOuterWalls, spawnPointForSide } from '../rooms/layouts';
import type { RoomSetup } from '../rooms/types';
import { sideUnitVector } from '../utils/sides';
import { TILE } from './types';
import type { LevelData } from './types';

export function levelToRoomSetup(level: LevelData, roomIndex: number, finalExit = false): RoomSetup {
  const entrance = buildDoor(level.entrance);
  const exit = buildDoor(level.exit);
  const spawn = spawnPointForSide(level.entrance);
  const inward = sideUnitVector(level.entrance);

  const obstacles = level.blocks.map((block) => {
    const minX = block.col * TILE + TILE / 2;
    const minY = block.row * TILE + TILE / 2;
    const maxX = (block.col + block.w - 1) * TILE + TILE / 2;
    const maxY = (block.row + block.h - 1) * TILE + TILE / 2;
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      width: block.w * TILE - 12,
      height: block.h * TILE - 12
    };
  });

  return {
    roomIndex,
    roomName: level.name,
    entrance,
    exit,
    spawn,
    spawnFacing: { x: -inward.x, y: -inward.y },
    entrySide: level.entrance,
    walls: buildOuterWalls([level.entrance, level.exit]),
    obstacles,
    enemyArchetypes: level.enemies.map((enemy) => enemy.type),
    enemySpawns: level.enemies.map((enemy) => ({ x: enemy.x, y: enemy.y })),
    finalExit
  };
}
