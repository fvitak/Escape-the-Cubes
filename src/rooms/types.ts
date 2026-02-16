import type { Side } from '../utils/sides';
import type { EnemyArchetype } from '../entities/EnemyArchetypes';

export interface RectSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DoorSpec {
  side: Side;
  trigger: RectSpec;
}

export interface RoomSetup {
  roomIndex: number;
  roomName: string;
  entrance: DoorSpec | null;
  exit: DoorSpec | null;
  isBossRoom?: boolean;
  spawn: { x: number; y: number };
  spawnFacing: { x: number; y: number };
  entrySide: Side | null;
  walls: RectSpec[];
  obstacles: RectSpec[];
  enemyArchetypes: EnemyArchetype[];
  enemySpawns?: Array<{ x: number; y: number }>;
}
