export type EnemyArchetype = 'green' | 'red';

export const ROOM_ENEMY_WAVES: EnemyArchetype[][] = [
  [],
  ['green'],
  ['green', 'red'],
  ['green', 'green', 'red'],
  ['green', 'green', 'red', 'red'],
  ['green', 'green', 'red', 'red', 'red'],
  []
];
