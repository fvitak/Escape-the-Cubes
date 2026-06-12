import { sideUnitVector, type Side } from '../utils/sides';
import type { DoorSpec, RectSpec, RoomSetup } from './types';

export const ROOM_WIDTH = 960;
export const ROOM_HEIGHT = 640;
const WALL = 24;
const DOOR_SIZE = 120;

export function buildDoor(side: Side): DoorSpec {
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

export function spawnPointForSide(side: Side): { x: number; y: number } {
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

export function buildOuterWalls(openings: Side[]): RectSpec[] {
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

/** Room 0: empty antechamber where the player learns the controls. Exit is always TOP. */
export function buildStartRoomSetup(): RoomSetup {
  const exit = buildDoor('top');
  return {
    roomIndex: 0,
    roomName: 'Escape Antechamber',
    entrance: null,
    exit,
    spawn: { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 },
    spawnFacing: { x: 0, y: -1 },
    entrySide: null,
    walls: buildOuterWalls([exit.side]),
    obstacles: [],
    enemyArchetypes: []
  };
}

/** Final room: the boss arena. No exit until the boss falls. */
export function buildBossRoomSetup(roomIndex: number): RoomSetup {
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
    enemyArchetypes: []
  };
}

export { sideUnitVector };
