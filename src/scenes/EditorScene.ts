import Phaser from 'phaser';
import { spawnPointForSide } from '../rooms/layouts';
import { LevelStore } from '../levels/store';
import { GRID_COLS, GRID_ROWS, MAX_ENEMIES, TILE } from '../levels/types';
import type { BlockSpec, EnemyType, LevelData } from '../levels/types';
import type { Side } from '../utils/sides';

type Tool =
  | { kind: 'block'; size: number }
  | { kind: 'enemy'; enemy: EnemyType }
  | { kind: 'door'; door: 'entrance' | 'exit' }
  | { kind: 'eraser' };

interface EnemyPlacement {
  type: EnemyType;
  col: number;
  row: number;
}

interface EditorSnapshot {
  pieces: BlockSpec[];
  enemies: EnemyPlacement[];
  entrance: Side;
  exit: Side;
}

interface EditorInitData {
  level?: LevelData;
  isNew?: boolean;
  resume?: boolean;
}

const SIDEBAR_W = 150;
const BOARD_X = 158;
const BOARD_Y = 96;
const ETILE = 40;
const SCALE = ETILE / TILE;
const BOARD_W = GRID_COLS * ETILE;
const BOARD_H = GRID_ROWS * ETILE;
const DRAFT_KEY = 'editor-draft';

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

export class EditorScene extends Phaser.Scene {
  private levelId = '';
  private levelName = '';
  private isNew = false;
  private dirty = false;

  private pieces: BlockSpec[] = [];
  private enemies: EnemyPlacement[] = [];
  private entrance: Side = 'bottom';
  private exitSide: Side = 'top';

  private tool: Tool | null = null;
  private undoStack: EditorSnapshot[] = [];

  private boardObjects: Phaser.GameObjects.GameObject[] = [];
  private paletteObjects: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private ghost: Phaser.GameObjects.Rectangle | null = null;
  private ghostLabel: Phaser.GameObjects.Text | null = null;
  private hoverOutline: Phaser.GameObjects.Rectangle | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('editor-scene');
  }

  init(data: EditorInitData): void {
    if (data.resume) {
      const draft = this.registry.get(DRAFT_KEY) as { level: LevelData; isNew: boolean } | undefined;
      if (draft) {
        this.loadLevel(draft.level, draft.isNew);
        this.dirty = true;
        return;
      }
    }
    if (data.level) {
      this.loadLevel(data.level, Boolean(data.isNew));
      this.dirty = Boolean(data.isNew);
    }
  }

  private loadLevel(level: LevelData, isNew: boolean): void {
    this.levelId = level.id;
    this.levelName = level.name;
    this.isNew = isNew;
    this.entrance = level.entrance;
    this.exitSide = level.exit;
    this.pieces = level.blocks.map((block) => ({ ...block }));
    this.enemies = level.enemies.map((enemy) => ({
      type: enemy.type,
      col: Phaser.Math.Clamp(Math.floor(enemy.x / TILE), 1, GRID_COLS - 2),
      row: Phaser.Math.Clamp(Math.floor(enemy.y / TILE), 1, GRID_ROWS - 2)
    }));
    this.tool = null;
    this.undoStack = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0f14');
    this.input.mouse?.disableContextMenu();

    this.drawChrome();
    this.drawPalette();
    this.redrawBoard();

    this.ghost = this.add.rectangle(0, 0, ETILE, ETILE, 0xffffff, 0.25);
    this.ghost.setStrokeStyle(2, 0x9fe6a8, 1);
    this.ghost.setDepth(30);
    this.ghost.setVisible(false);
    this.ghostLabel = this.add.text(0, 0, '', { fontSize: '12px', color: '#ffffff', fontStyle: '700' });
    this.ghostLabel.setOrigin(0.5);
    this.ghostLabel.setDepth(31);
    this.ghostLabel.setVisible(false);

    this.hoverOutline = this.add.rectangle(0, 0, ETILE, ETILE, 0xffffff, 0);
    this.hoverOutline.setStrokeStyle(2, 0xffb066, 1);
    this.hoverOutline.setDepth(29);
    this.hoverOutline.setVisible(false);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.updateGhost(pointer));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.tool) {
        this.setTool(null);
      } else {
        this.goBack();
      }
    });
    this.input.keyboard?.on('keydown-Z', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        this.undo();
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
      this.input.setDefaultCursor('default');
    });
  }

  // ---------- chrome / palette ----------

  private drawChrome(): void {
    this.add.rectangle(SIDEBAR_W / 2, 320, SIDEBAR_W, 640, 0x141a26, 1).setDepth(5);
    this.add.rectangle(480 + SIDEBAR_W / 2 - 4, BOARD_Y / 2, 960 - SIDEBAR_W, BOARD_Y, 0x10151f, 1).setDepth(5);

    const paletteTitle = this.add.text(SIDEBAR_W / 2, 22, 'PIECES', {
      fontSize: '18px', color: '#8fa3c2', fontStyle: '800'
    });
    paletteTitle.setOrigin(0.5);
    paletteTitle.setDepth(6);

    this.nameText = this.add.text(BOARD_X + 6, 16, '', { fontSize: '22px', color: '#eaf3ff', fontStyle: '700' });
    this.nameText.setDepth(6);
    this.updateNameText();
    this.nameText.setInteractive({ useHandCursor: true });
    this.nameText.on('pointerdown', () => this.renameLevel());

    const renameHint = this.add.text(BOARD_X + 6, 44, 'click name to rename', { fontSize: '12px', color: '#5d6f8c' });
    renameHint.setDepth(6);

    this.makeToolbarButton(620, 30, 'UNDO', () => this.undo());
    this.makeToolbarButton(708, 30, 'TEST', () => this.testPlay(), 0x3d6b3d, 0x9fe6a8);
    this.makeToolbarButton(796, 30, 'SAVE', () => this.save(), 0x2f6db8, 0x8fc6ff);
    this.makeToolbarButton(884, 30, 'BACK', () => this.goBack());

    this.statusText = this.add.text(620, 62, 'Left click: place · Right click: erase · Esc: cancel tool', {
      fontSize: '12px', color: '#5d6f8c'
    });
    this.statusText.setOrigin(0, 0.5);
    this.statusText.setDepth(6);

    this.toastText = this.add.text(480 + SIDEBAR_W / 2, 628, '', { fontSize: '15px', color: '#9fe6a8', fontStyle: '700' });
    this.toastText.setOrigin(0.5);
    this.toastText.setDepth(50);
    this.toastText.setAlpha(0);
  }

  private makeToolbarButton(x: number, y: number, label: string, onClick: () => void, fill = 0x2a3242, stroke = 0x55617a): void {
    const body = this.add.rectangle(x, y, 80, 34, fill, 1);
    body.setStrokeStyle(2, stroke, 0.9);
    body.setDepth(6);
    const text = this.add.text(x, y, label, { fontSize: '15px', color: '#f4fbff', fontStyle: '700' });
    text.setOrigin(0.5);
    text.setDepth(7);
    body.setInteractive({ useHandCursor: true });
    body.on('pointerover', () => body.setAlpha(0.85));
    body.on('pointerout', () => body.setAlpha(1));
    body.on('pointerdown', () => onClick());
  }

  private drawPalette(): void {
    const items: Array<{ key: string; label: string; tool: Tool; draw: (cx: number, cy: number) => void }> = [
      {
        key: 'block1', label: 'Block 1x1', tool: { kind: 'block', size: 1 },
        draw: (cx, cy) => this.drawBlockPreview(cx, cy, 22)
      },
      {
        key: 'block2', label: 'Block 2x2', tool: { kind: 'block', size: 2 },
        draw: (cx, cy) => this.drawBlockPreview(cx, cy, 34)
      },
      {
        key: 'block3', label: 'Block 3x3', tool: { kind: 'block', size: 3 },
        draw: (cx, cy) => this.drawBlockPreview(cx, cy, 44)
      },
      {
        key: 'enemy-green', label: 'Green Cube', tool: { kind: 'enemy', enemy: 'green' },
        draw: (cx, cy) => this.drawEnemyPreview(cx, cy, 0x67d08d)
      },
      {
        key: 'enemy-red', label: 'Red Cube', tool: { kind: 'enemy', enemy: 'red' },
        draw: (cx, cy) => this.drawEnemyPreview(cx, cy, 0xff6e6e)
      },
      {
        key: 'entrance', label: 'Entrance', tool: { kind: 'door', door: 'entrance' },
        draw: (cx, cy) => this.drawDoorPreview(cx, cy, 0xcdb57d)
      },
      {
        key: 'exit', label: 'Exit', tool: { kind: 'door', door: 'exit' },
        draw: (cx, cy) => this.drawDoorPreview(cx, cy, 0x67b8f4)
      },
      {
        key: 'eraser', label: 'Eraser', tool: { kind: 'eraser' },
        draw: (cx, cy) => {
          const g = this.add.rectangle(cx, cy, 30, 22, 0xd66a6a, 1);
          g.setStrokeStyle(2, 0xffffff, 0.6);
          g.setAngle(-18);
          g.setDepth(8);
        }
      }
    ];

    items.forEach((item, i) => {
      const y = 70 + i * 66;
      const slot = this.add.rectangle(SIDEBAR_W / 2, y, SIDEBAR_W - 16, 58, 0x1c2230, 1);
      slot.setStrokeStyle(2, 0x39435c, 0.9);
      slot.setDepth(6);
      slot.setInteractive({ useHandCursor: true });
      slot.on('pointerover', () => {
        if (this.paletteObjects.get('armed') !== slot) {
          slot.setFillStyle(0x232b3d, 1);
        }
      });
      slot.on('pointerout', () => this.refreshPaletteHighlight());
      slot.on('pointerdown', () => this.setTool(item.tool, item.key));
      this.paletteObjects.set(item.key, slot);

      item.draw(SIDEBAR_W / 2 - 38, y);
      const label = this.add.text(SIDEBAR_W / 2 - 12, y, item.label, { fontSize: '13px', color: '#c5d2e8' });
      label.setOrigin(0, 0.5);
      label.setDepth(8);
    });
  }

  private drawBlockPreview(cx: number, cy: number, size: number): void {
    const side = this.add.rectangle(cx + 3, cy + 3, size, size, 0x2f323a, 1);
    side.setDepth(7);
    const top = this.add.rectangle(cx, cy, size, size, 0x525865, 1);
    top.setStrokeStyle(2, 0x9aa2b2, 0.55);
    top.setDepth(8);
  }

  private drawEnemyPreview(cx: number, cy: number, color: number): void {
    const cube = this.add.rectangle(cx, cy, 24, 24, color, 1);
    cube.setStrokeStyle(2, 0xffffff, 0.35);
    cube.setDepth(8);
  }

  private drawDoorPreview(cx: number, cy: number, color: number): void {
    const frame = this.add.rectangle(cx, cy, 34, 22, 0x1e232e, 1);
    frame.setDepth(7);
    const fill = this.add.rectangle(cx, cy, 28, 16, color, 0.85);
    fill.setDepth(8);
  }

  private setTool(tool: Tool | null, key?: string): void {
    this.tool = tool;
    this.refreshPaletteHighlight(key);
    if (!tool) {
      this.ghost?.setVisible(false);
      this.ghostLabel?.setVisible(false);
      this.hoverOutline?.setVisible(false);
    }
  }

  private armedKey: string | null = null;

  private refreshPaletteHighlight(key?: string): void {
    if (key !== undefined) {
      this.armedKey = this.tool ? key : null;
    } else if (!this.tool) {
      this.armedKey = null;
    }
    for (const [slotKey, slot] of this.paletteObjects.entries()) {
      if (slotKey === 'armed') {
        continue;
      }
      const armed = slotKey === this.armedKey;
      slot.setFillStyle(armed ? 0x2f4a6d : 0x1c2230, 1);
      slot.setStrokeStyle(2, armed ? 0x8fc6ff : 0x39435c, 0.9);
    }
  }

  // ---------- board rendering ----------

  private redrawBoard(): void {
    for (const obj of this.boardObjects) {
      obj.destroy();
    }
    this.boardObjects = [];

    const floor = this.add.rectangle(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2, BOARD_W, BOARD_H, 0x1a1f2b, 1);
    floor.setDepth(10);
    this.boardObjects.push(floor);

    const grid = this.add.graphics();
    grid.setDepth(11);
    grid.lineStyle(1, 0xffffff, 0.05);
    for (let c = 0; c <= GRID_COLS; c += 1) {
      grid.lineBetween(BOARD_X + c * ETILE, BOARD_Y, BOARD_X + c * ETILE, BOARD_Y + BOARD_H);
    }
    for (let r = 0; r <= GRID_ROWS; r += 1) {
      grid.lineBetween(BOARD_X, BOARD_Y + r * ETILE, BOARD_X + BOARD_W, BOARD_Y + r * ETILE);
    }
    this.boardObjects.push(grid);

    this.drawWallsAndDoors();
    this.drawSpawnMarker();

    for (const piece of this.pieces) {
      const px = BOARD_X + piece.col * ETILE;
      const py = BOARD_Y + piece.row * ETILE;
      const w = piece.w * ETILE - 6;
      const h = piece.h * ETILE - 6;
      const cx = px + (piece.w * ETILE) / 2;
      const cy = py + (piece.h * ETILE) / 2;
      const side = this.add.rectangle(cx + 4, cy + 4, w, h, 0x2f323a, 1);
      side.setDepth(13);
      const top = this.add.rectangle(cx, cy, w, h, 0x525865, 1);
      top.setStrokeStyle(2, 0x9aa2b2, 0.55);
      top.setDepth(14);
      this.boardObjects.push(side, top);
    }

    for (const enemy of this.enemies) {
      const cx = BOARD_X + enemy.col * ETILE + ETILE / 2;
      const cy = BOARD_Y + enemy.row * ETILE + ETILE / 2;
      const color = enemy.type === 'green' ? 0x67d08d : 0xff6e6e;
      const cube = this.add.rectangle(cx, cy, 26, 26, color, 1);
      cube.setStrokeStyle(2, 0xffffff, 0.35);
      cube.setDepth(15);
      this.boardObjects.push(cube);
    }

    const counts = this.add.text(BOARD_X, BOARD_Y + BOARD_H + 8,
      `${this.pieces.length} blocks · ${this.enemies.length}/${MAX_ENEMIES} cubes · entrance ${this.entrance.toUpperCase()} · exit ${this.exitSide.toUpperCase()}`,
      { fontSize: '13px', color: '#5d6f8c' });
    counts.setDepth(12);
    this.boardObjects.push(counts);
  }

  private drawWallsAndDoors(): void {
    const wallColor = 0x525865;
    const thickness = 10;
    const g = this.add.graphics();
    g.setDepth(12);
    g.fillStyle(wallColor, 1);

    const gapFor = (side: Side): { a: number; b: number } => {
      // Door spans 120 world px centered on the wall.
      if (side === 'top' || side === 'bottom') {
        return { a: BOARD_X + 420 * SCALE, b: BOARD_X + 540 * SCALE };
      }
      return { a: BOARD_Y + 260 * SCALE, b: BOARD_Y + 380 * SCALE };
    };

    const openings = new Map<Side, { a: number; b: number }>();
    openings.set(this.entrance, gapFor(this.entrance));
    openings.set(this.exitSide, gapFor(this.exitSide));

    const drawH = (y: number, side: Side): void => {
      const gap = openings.get(side);
      if (gap) {
        g.fillRect(BOARD_X, y, gap.a - BOARD_X, thickness);
        g.fillRect(gap.b, y, BOARD_X + BOARD_W - gap.b, thickness);
      } else {
        g.fillRect(BOARD_X, y, BOARD_W, thickness);
      }
    };
    const drawV = (x: number, side: Side): void => {
      const gap = openings.get(side);
      if (gap) {
        g.fillRect(x, BOARD_Y, thickness, gap.a - BOARD_Y);
        g.fillRect(x, gap.b, thickness, BOARD_Y + BOARD_H - gap.b);
      } else {
        g.fillRect(x, BOARD_Y, thickness, BOARD_H);
      }
    };

    drawH(BOARD_Y - thickness / 2, 'top');
    drawH(BOARD_Y + BOARD_H - thickness / 2, 'bottom');
    drawV(BOARD_X - thickness / 2, 'left');
    drawV(BOARD_X + BOARD_W - thickness / 2, 'right');
    this.boardObjects.push(g);

    for (const [side, isEntrance] of [[this.entrance, true], [this.exitSide, false]] as Array<[Side, boolean]>) {
      const rect = this.doorEditorRect(side);
      const color = isEntrance ? 0xcdb57d : 0x67b8f4;
      const door = this.add.rectangle(rect.x, rect.y, rect.w, rect.h, color, 0.85);
      door.setDepth(13);
      this.boardObjects.push(door);
      const label = this.add.text(rect.labelX, rect.labelY, isEntrance ? 'IN' : 'OUT', {
        fontSize: '13px', color: isEntrance ? '#ffe9b8' : '#bfe2ff', fontStyle: '800'
      });
      label.setOrigin(0.5);
      label.setDepth(14);
      this.boardObjects.push(label);
    }
  }

  private doorEditorRect(side: Side): { x: number; y: number; w: number; h: number; labelX: number; labelY: number } {
    const doorLen = 120 * SCALE;
    const t = 14;
    switch (side) {
      case 'top':
        return { x: BOARD_X + 480 * SCALE, y: BOARD_Y, w: doorLen, h: t, labelX: BOARD_X + 480 * SCALE, labelY: BOARD_Y + 22 };
      case 'bottom':
        return { x: BOARD_X + 480 * SCALE, y: BOARD_Y + BOARD_H, w: doorLen, h: t, labelX: BOARD_X + 480 * SCALE, labelY: BOARD_Y + BOARD_H - 22 };
      case 'left':
        return { x: BOARD_X, y: BOARD_Y + 320 * SCALE, w: t, h: doorLen, labelX: BOARD_X + 24, labelY: BOARD_Y + 320 * SCALE };
      case 'right':
        return { x: BOARD_X + BOARD_W, y: BOARD_Y + 320 * SCALE, w: t, h: doorLen, labelX: BOARD_X + BOARD_W - 26, labelY: BOARD_Y + 320 * SCALE };
    }
  }

  private drawSpawnMarker(): void {
    const spawn = spawnPointForSide(this.entrance);
    const x = BOARD_X + spawn.x * SCALE;
    const y = BOARD_Y + spawn.y * SCALE;
    const cube = this.add.rectangle(x, y, 26, 26, 0x7ccfff, 0.55);
    cube.setStrokeStyle(2, 0xdff5ff, 0.8);
    cube.setDepth(15);
    this.boardObjects.push(cube);
    const label = this.add.text(x, y - 24, 'spawn', { fontSize: '11px', color: '#9cc8e8' });
    label.setOrigin(0.5);
    label.setDepth(15);
    this.boardObjects.push(label);
  }

  // ---------- occupancy / validation ----------

  private occupiedCells(): Set<string> {
    const cells = new Set<string>();
    for (const piece of this.pieces) {
      for (let y = piece.row; y < piece.row + piece.h; y += 1) {
        for (let x = piece.col; x < piece.col + piece.w; x += 1) {
          cells.add(`${x}:${y}`);
        }
      }
    }
    return cells;
  }

  private enemyCells(): Set<string> {
    return new Set(this.enemies.map((enemy) => `${enemy.col}:${enemy.row}`));
  }

  private reservedCells(): Set<string> {
    const cells = new Set<string>();
    const mark = (side: Side): void => {
      if (side === 'top') {
        for (let c = 8; c <= 11; c += 1) for (let r = 0; r <= 2; r += 1) cells.add(`${c}:${r}`);
      } else if (side === 'bottom') {
        for (let c = 8; c <= 11; c += 1) for (let r = GRID_ROWS - 3; r <= GRID_ROWS - 1; r += 1) cells.add(`${c}:${r}`);
      } else if (side === 'left') {
        for (let c = 0; c <= 2; c += 1) for (let r = 5; r <= 7; r += 1) cells.add(`${c}:${r}`);
      } else {
        for (let c = GRID_COLS - 3; c <= GRID_COLS - 1; c += 1) for (let r = 5; r <= 7; r += 1) cells.add(`${c}:${r}`);
      }
    };
    mark(this.entrance);
    mark(this.exitSide);
    return cells;
  }

  private canPlaceBlock(col: number, row: number, size: number): boolean {
    if (col < 0 || row < 0 || col + size > GRID_COLS || row + size > GRID_ROWS) {
      return false;
    }
    const occupied = this.occupiedCells();
    const enemies = this.enemyCells();
    const reserved = this.reservedCells();
    for (let y = row; y < row + size; y += 1) {
      for (let x = col; x < col + size; x += 1) {
        const key = `${x}:${y}`;
        if (occupied.has(key) || enemies.has(key) || reserved.has(key)) {
          return false;
        }
      }
    }
    return true;
  }

  private canPlaceEnemy(col: number, row: number): boolean {
    if (col < 1 || row < 1 || col > GRID_COLS - 2 || row > GRID_ROWS - 2) {
      return false;
    }
    if (this.enemies.length >= MAX_ENEMIES) {
      return false;
    }
    const key = `${col}:${row}`;
    if (this.occupiedCells().has(key) || this.enemyCells().has(key) || this.reservedCells().has(key)) {
      return false;
    }
    const spawn = spawnPointForSide(this.entrance);
    const worldX = col * TILE + TILE / 2;
    const worldY = row * TILE + TILE / 2;
    return Phaser.Math.Distance.Between(worldX, worldY, spawn.x, spawn.y) >= 150;
  }

  private hasPathToExit(): boolean {
    const occupied = this.occupiedCells();
    const spawn = spawnPointForSide(this.entrance);
    const start = {
      x: Phaser.Math.Clamp(Math.floor(spawn.x / TILE), 1, GRID_COLS - 2),
      y: Phaser.Math.Clamp(Math.floor(spawn.y / TILE), 1, GRID_ROWS - 2)
    };
    const exitPoint = this.exitWorldPoint();
    const end = {
      x: Phaser.Math.Clamp(Math.floor(exitPoint.x / TILE), 1, GRID_COLS - 2),
      y: Phaser.Math.Clamp(Math.floor(exitPoint.y / TILE), 1, GRID_ROWS - 2)
    };

    const queue = [start];
    const visited = new Set([`${start.x}:${start.y}`]);
    while (queue.length > 0) {
      const cur = queue.shift() as { x: number; y: number };
      if (cur.x === end.x && cur.y === end.y) {
        return true;
      }
      for (const next of [
        { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
        { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }
      ]) {
        if (next.x < 1 || next.y < 1 || next.x > GRID_COLS - 2 || next.y > GRID_ROWS - 2) {
          continue;
        }
        const key = `${next.x}:${next.y}`;
        if (occupied.has(key) || visited.has(key)) {
          continue;
        }
        visited.add(key);
        queue.push(next);
      }
    }
    return false;
  }

  private exitWorldPoint(): { x: number; y: number } {
    switch (this.exitSide) {
      case 'top': return { x: 480, y: 36 };
      case 'bottom': return { x: 480, y: 604 };
      case 'left': return { x: 36, y: 320 };
      case 'right': return { x: 924, y: 320 };
    }
  }

  // ---------- input ----------

  private pointerCell(pointer: Phaser.Input.Pointer): { col: number; row: number } | null {
    const col = Math.floor((pointer.x - BOARD_X) / ETILE);
    const row = Math.floor((pointer.y - BOARD_Y) / ETILE);
    if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) {
      return null;
    }
    return { col, row };
  }

  private nearestWall(pointer: Phaser.Input.Pointer): Side {
    const distances: Array<{ side: Side; d: number }> = [
      { side: 'top', d: Math.abs(pointer.y - BOARD_Y) },
      { side: 'bottom', d: Math.abs(pointer.y - (BOARD_Y + BOARD_H)) },
      { side: 'left', d: Math.abs(pointer.x - BOARD_X) },
      { side: 'right', d: Math.abs(pointer.x - (BOARD_X + BOARD_W)) }
    ];
    distances.sort((a, b) => a.d - b.d);
    return distances[0].side;
  }

  private updateGhost(pointer: Phaser.Input.Pointer): void {
    if (!this.ghost || !this.ghostLabel || !this.hoverOutline) {
      return;
    }
    this.hoverOutline.setVisible(false);

    if (!this.tool) {
      this.ghost.setVisible(false);
      this.ghostLabel.setVisible(false);
      return;
    }

    if (this.tool.kind === 'door') {
      const side = this.nearestWall(pointer);
      const other = this.tool.door === 'entrance' ? this.exitSide : this.entrance;
      const valid = side !== other;
      const rect = this.doorEditorRect(side);
      this.ghost.setVisible(true);
      this.ghost.setPosition(rect.x, rect.y);
      this.ghost.setSize(Math.max(rect.w, 14), Math.max(rect.h, 14));
      this.ghost.setFillStyle(this.tool.door === 'entrance' ? 0xcdb57d : 0x67b8f4, 0.4);
      this.ghost.setStrokeStyle(2, valid ? 0x9fe6a8 : 0xff6e6e, 1);
      this.ghostLabel.setVisible(false);
      return;
    }

    const cell = this.pointerCell(pointer);
    if (!cell) {
      this.ghost.setVisible(false);
      this.ghostLabel.setVisible(false);
      return;
    }

    if (this.tool.kind === 'eraser') {
      const target = this.findTargetAt(cell.col, cell.row);
      this.ghost.setVisible(false);
      this.ghostLabel.setVisible(false);
      if (target) {
        this.hoverOutline.setVisible(true);
        if (target.kind === 'piece') {
          const piece = this.pieces[target.index];
          this.hoverOutline.setPosition(
            BOARD_X + piece.col * ETILE + (piece.w * ETILE) / 2,
            BOARD_Y + piece.row * ETILE + (piece.h * ETILE) / 2
          );
          this.hoverOutline.setSize(piece.w * ETILE, piece.h * ETILE);
        } else {
          const enemy = this.enemies[target.index];
          this.hoverOutline.setPosition(BOARD_X + enemy.col * ETILE + ETILE / 2, BOARD_Y + enemy.row * ETILE + ETILE / 2);
          this.hoverOutline.setSize(ETILE, ETILE);
        }
      }
      return;
    }

    const size = this.tool.kind === 'block' ? this.tool.size : 1;
    const valid = this.tool.kind === 'block'
      ? this.canPlaceBlock(cell.col, cell.row, size)
      : this.canPlaceEnemy(cell.col, cell.row);

    this.ghost.setVisible(true);
    this.ghost.setPosition(BOARD_X + cell.col * ETILE + (size * ETILE) / 2, BOARD_Y + cell.row * ETILE + (size * ETILE) / 2);
    this.ghost.setSize(size * ETILE, size * ETILE);
    if (this.tool.kind === 'enemy') {
      this.ghost.setFillStyle(this.tool.enemy === 'green' ? 0x67d08d : 0xff6e6e, 0.4);
    } else {
      this.ghost.setFillStyle(0x525865, 0.4);
    }
    this.ghost.setStrokeStyle(2, valid ? 0x9fe6a8 : 0xff6e6e, 1);
    this.ghostLabel.setVisible(false);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      if (this.tool && this.tool.kind !== 'eraser') {
        this.setTool(null);
      } else {
        const cell = this.pointerCell(pointer);
        if (cell) {
          this.eraseAt(cell.col, cell.row);
        }
      }
      return;
    }

    if (pointer.x < SIDEBAR_W || pointer.y < BOARD_Y - 6) {
      return; // palette/toolbar clicks handled by their own handlers
    }

    if (!this.tool) {
      return;
    }

    if (this.tool.kind === 'door') {
      const side = this.nearestWall(pointer);
      const other = this.tool.door === 'entrance' ? this.exitSide : this.entrance;
      if (side === other) {
        this.showToast('Entrance and exit can\'t share a wall', true);
        return;
      }
      this.pushUndo();
      if (this.tool.door === 'entrance') {
        this.entrance = side;
      } else {
        this.exitSide = side;
      }
      this.dirty = true;
      this.redrawBoard();
      this.updateGhost(pointer);
      return;
    }

    const cell = this.pointerCell(pointer);
    if (!cell) {
      return;
    }

    if (this.tool.kind === 'eraser') {
      this.eraseAt(cell.col, cell.row);
      this.updateGhost(pointer);
      return;
    }

    if (this.tool.kind === 'block') {
      if (!this.canPlaceBlock(cell.col, cell.row, this.tool.size)) {
        return;
      }
      this.pushUndo();
      this.pieces.push({ col: cell.col, row: cell.row, w: this.tool.size, h: this.tool.size });
      this.dirty = true;
      this.redrawBoard();
      this.updateGhost(pointer);
      return;
    }

    if (this.tool.kind === 'enemy') {
      if (this.enemies.length >= MAX_ENEMIES) {
        this.showToast(`Max ${MAX_ENEMIES} cubes per level`, true);
        return;
      }
      if (!this.canPlaceEnemy(cell.col, cell.row)) {
        return;
      }
      this.pushUndo();
      this.enemies.push({ type: this.tool.enemy, col: cell.col, row: cell.row });
      this.dirty = true;
      this.redrawBoard();
      this.updateGhost(pointer);
    }
  }

  private findTargetAt(col: number, row: number): { kind: 'piece' | 'enemy'; index: number } | null {
    const enemyIndex = this.enemies.findIndex((enemy) => enemy.col === col && enemy.row === row);
    if (enemyIndex >= 0) {
      return { kind: 'enemy', index: enemyIndex };
    }
    const pieceIndex = this.pieces.findIndex((piece) =>
      col >= piece.col && col < piece.col + piece.w && row >= piece.row && row < piece.row + piece.h);
    if (pieceIndex >= 0) {
      return { kind: 'piece', index: pieceIndex };
    }
    return null;
  }

  private eraseAt(col: number, row: number): void {
    const target = this.findTargetAt(col, row);
    if (!target) {
      return;
    }
    this.pushUndo();
    if (target.kind === 'enemy') {
      this.enemies.splice(target.index, 1);
    } else {
      this.pieces.splice(target.index, 1);
    }
    this.dirty = true;
    this.redrawBoard();
  }

  // ---------- undo / save / navigation ----------

  private snapshot(): EditorSnapshot {
    return {
      pieces: this.pieces.map((piece) => ({ ...piece })),
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      entrance: this.entrance,
      exit: this.exitSide
    };
  }

  private pushUndo(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 30) {
      this.undoStack.shift();
    }
  }

  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) {
      this.showToast('Nothing to undo', true);
      return;
    }
    this.pieces = previous.pieces;
    this.enemies = previous.enemies;
    this.entrance = previous.entrance;
    this.exitSide = previous.exit;
    this.dirty = true;
    this.redrawBoard();
  }

  private buildLevelData(): LevelData {
    return {
      id: this.levelId,
      name: this.levelName,
      entrance: this.entrance,
      exit: this.exitSide,
      blocks: this.pieces.map((piece) => ({ ...piece })),
      enemies: this.enemies.map((enemy) => ({
        type: enemy.type,
        x: enemy.col * TILE + TILE / 2,
        y: enemy.row * TILE + TILE / 2
      }))
    };
  }

  private validate(): string | null {
    if (!SIDES.includes(this.entrance) || !SIDES.includes(this.exitSide)) {
      return 'Level needs an entrance and an exit';
    }
    if (this.entrance === this.exitSide) {
      return 'Entrance and exit can\'t share a wall';
    }
    if (!this.hasPathToExit()) {
      return 'No clear path from entrance to exit';
    }
    return null;
  }

  private save(): void {
    const error = this.validate();
    if (error) {
      this.showToast(error, true);
      return;
    }
    LevelStore.saveCustomLevel(this.buildLevelData());
    this.dirty = false;
    this.isNew = false;
    this.showToast('Saved ✓');
  }

  private testPlay(): void {
    const error = this.validate();
    if (error) {
      this.showToast(error, true);
      return;
    }
    this.registry.set(DRAFT_KEY, { level: this.buildLevelData(), isNew: this.isNew });
    this.scene.start('game-scene', { testLevel: this.buildLevelData() });
  }

  private renameLevel(): void {
    const name = window.prompt('Level name:', this.levelName);
    if (name && name.trim().length > 0) {
      this.levelName = name.trim().slice(0, 32);
      this.dirty = true;
      this.updateNameText();
    }
  }

  private updateNameText(): void {
    this.nameText?.setText(this.levelName + (this.dirty ? ' *' : ''));
  }

  private goBack(): void {
    if (this.dirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    this.registry.remove(DRAFT_KEY);
    this.scene.start('edit-hub-scene');
  }

  private showToast(message: string, warning = false): void {
    if (!this.toastText) {
      return;
    }
    this.toastText.setText(message);
    this.toastText.setColor(warning ? '#ffb066' : '#9fe6a8');
    this.toastText.setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1600, duration: 400 });
    this.updateNameText();
  }
}
