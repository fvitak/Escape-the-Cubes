import type { Side } from '../utils/sides';

export type EnemyType = 'green' | 'red';

export interface BlockSpec {
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface EnemySpec {
  type: EnemyType;
  x: number;
  y: number;
}

export interface LevelData {
  id: string;
  name: string;
  builtin?: boolean;
  entrance: Side;
  exit: Side;
  blocks: BlockSpec[];
  enemies: EnemySpec[];
}

export const GRID_COLS = 20;
export const GRID_ROWS = 13;
export const TILE = 48;
export const MAX_ENEMIES = 8;
