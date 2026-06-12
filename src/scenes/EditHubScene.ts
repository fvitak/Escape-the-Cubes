import Phaser from 'phaser';
import { LevelStore } from '../levels/store';
import type { LevelData } from '../levels/types';

const LIST_TOP = 150;
const ROW_HEIGHT = 46;
const VISIBLE_ROWS = 9;

export class EditHubScene extends Phaser.Scene {
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private scrollOffset = 0;
  private confirmingDeleteId: string | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('edit-hub-scene');
  }

  create(): void {
    this.scrollOffset = 0;
    this.confirmingDeleteId = null;
    this.cameras.main.setBackgroundColor('#0d0f14');

    const title = this.add.text(480, 48, 'EDIT LEVELS', {
      fontSize: '40px',
      color: '#eaf3ff',
      fontStyle: '800',
      stroke: '#0a1421',
      strokeThickness: 7
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(480, 92, 'Checked levels are part of the run, played top to bottom.', {
      fontSize: '16px',
      color: '#8fa3c2'
    });
    subtitle.setOrigin(0.5);

    this.makeSmallButton(80, 48, '< BACK', () => this.scene.start('menu-scene'));
    this.makeSmallButton(856, 48, '+ NEW LEVEL', () => this.createNewLevel(), 0x2f6db8, 0x8fc6ff);

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const maxOffset = Math.max(0, LevelStore.getPlaylist().length - VISIBLE_ROWS);
      this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + Math.sign(dy), 0, maxOffset);
      this.renderRows();
    });

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('menu-scene'));

    this.toastText = this.add.text(480, 614, '', { fontSize: '16px', color: '#9fe6a8' });
    this.toastText.setOrigin(0.5);
    this.toastText.setDepth(50);
    this.toastText.setAlpha(0);

    this.renderRows();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
      this.input.setDefaultCursor('default');
    });
  }

  private createNewLevel(): void {
    const level: LevelData = {
      id: LevelStore.newCustomId(),
      name: LevelStore.nextCustomName(),
      entrance: 'bottom',
      exit: 'top',
      blocks: [],
      enemies: []
    };
    this.scene.start('editor-scene', { level, isNew: true });
  }

  private renderRows(): void {
    for (const obj of this.rowObjects) {
      obj.destroy();
    }
    this.rowObjects = [];

    const playlist = LevelStore.getPlaylist();
    const byId = new Map(LevelStore.getAllLevels().map((level) => [level.id, level]));
    const includedIds = playlist.filter((entry) => entry.included).map((entry) => entry.id);

    if (playlist.length > VISIBLE_ROWS) {
      const note = this.add.text(900, LIST_TOP - 18, 'scroll for more', { fontSize: '13px', color: '#5d6f8c' });
      note.setOrigin(1, 0.5);
      this.rowObjects.push(note);
    }

    const visible = playlist.slice(this.scrollOffset, this.scrollOffset + VISIBLE_ROWS);
    visible.forEach((entry, i) => {
      const level = byId.get(entry.id);
      if (!level) {
        return;
      }
      const globalIndex = this.scrollOffset + i;
      const y = LIST_TOP + i * ROW_HEIGHT;
      this.renderRow(level, entry.included, globalIndex, playlist.length, includedIds, y);
    });

    if (includedIds.length === 0) {
      const warn = this.add.text(480, LIST_TOP + VISIBLE_ROWS * ROW_HEIGHT + 24,
        'No levels included - the run will go straight to the boss!', {
          fontSize: '16px',
          color: '#ffb066'
        });
      warn.setOrigin(0.5);
      this.rowObjects.push(warn);
    }
  }

  private renderRow(
    level: LevelData,
    included: boolean,
    index: number,
    total: number,
    includedIds: string[],
    y: number
  ): void {
    const rowAlpha = included ? 1 : 0.45;

    const bg = this.add.rectangle(480, y, 880, ROW_HEIGHT - 6, 0x1c2230, included ? 0.9 : 0.55);
    bg.setStrokeStyle(1, 0x39435c, 0.8);
    this.rowObjects.push(bg);

    if (this.confirmingDeleteId === level.id) {
      const ask = this.add.text(300, y, `Delete "${level.name}"?`, {
        fontSize: '18px', color: '#ffb0b0', fontStyle: '700'
      });
      ask.setOrigin(0, 0.5);
      this.rowObjects.push(ask);
      this.addRowButton(720, y, 'YES, DELETE', 0xa83232, () => {
        LevelStore.deleteCustomLevel(level.id);
        this.confirmingDeleteId = null;
        this.showToast('Level deleted');
        this.renderRows();
      });
      this.addRowButton(840, y, 'CANCEL', 0x2a3242, () => {
        this.confirmingDeleteId = null;
        this.renderRows();
      });
      return;
    }

    // Include checkbox
    const box = this.add.rectangle(78, y, 24, 24, included ? 0x2f6db8 : 0x141a26, 1);
    box.setStrokeStyle(2, included ? 0x8fc6ff : 0x55617a, 1);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => {
      LevelStore.toggleIncluded(level.id);
      this.renderRows();
    });
    this.rowObjects.push(box);
    if (included) {
      const check = this.add.text(78, y, '✓', { fontSize: '18px', color: '#eaf3ff', fontStyle: '700' });
      check.setOrigin(0.5);
      this.rowObjects.push(check);
    }

    // Playlist position
    if (included) {
      const pos = this.add.text(116, y, `${includedIds.indexOf(level.id) + 1}.`, {
        fontSize: '18px', color: '#8fc6ff', fontStyle: '700'
      });
      pos.setOrigin(0.5);
      pos.setAlpha(rowAlpha);
      this.rowObjects.push(pos);
    }

    const name = this.add.text(150, y, level.name, { fontSize: '20px', color: '#eaf3ff' });
    name.setOrigin(0, 0.5);
    name.setAlpha(rowAlpha);
    this.rowObjects.push(name);

    if (level.builtin) {
      const badge = this.add.text(150 + name.width + 14, y, 'BUILT-IN', {
        fontSize: '12px', color: '#7d8fb0', backgroundColor: '#232b3d', padding: { x: 6, y: 3 }
      });
      badge.setOrigin(0, 0.5);
      badge.setAlpha(rowAlpha);
      this.rowObjects.push(badge);
    }

    const counts = this.add.text(686, y, `${level.blocks.length} blk · ${level.enemies.length} enemy`, {
      fontSize: '13px', color: '#5d6f8c'
    });
    counts.setOrigin(1, 0.5);
    counts.setAlpha(rowAlpha);
    this.rowObjects.push(counts);

    this.addRowButton(712, y, '▲', 0x2a3242, () => {
      LevelStore.moveEntry(level.id, -1);
      this.renderRows();
    }, index === 0, 34);
    this.addRowButton(750, y, '▼', 0x2a3242, () => {
      LevelStore.moveEntry(level.id, 1);
      this.renderRows();
    }, index === total - 1, 34);

    if (!level.builtin) {
      this.addRowButton(812, y, 'EDIT', 0x2f6db8, () => {
        this.scene.start('editor-scene', { level });
      });
      this.addRowButton(884, y, 'DEL', 0x5c2b2b, () => {
        this.confirmingDeleteId = level.id;
        this.renderRows();
      });
    }
  }

  private addRowButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
    disabled = false,
    width = 60
  ): void {
    const body = this.add.rectangle(x, y, width, 30, color, disabled ? 0.3 : 1);
    body.setStrokeStyle(1, 0x55617a, disabled ? 0.3 : 0.9);
    const text = this.add.text(x, y, label, {
      fontSize: '14px',
      color: disabled ? '#5d6f8c' : '#eaf3ff',
      fontStyle: '700'
    });
    text.setOrigin(0.5);
    this.rowObjects.push(body, text);
    if (disabled) {
      return;
    }
    body.setInteractive({ useHandCursor: true });
    body.on('pointerover', () => body.setAlpha(0.8));
    body.on('pointerout', () => body.setAlpha(1));
    body.on('pointerdown', () => onClick());
  }

  private makeSmallButton(x: number, y: number, label: string, onClick: () => void, fill = 0x2a3242, stroke = 0x55617a): void {
    const body = this.add.rectangle(x, y, label.length * 11 + 36, 40, fill, 1);
    body.setStrokeStyle(2, stroke, 0.9);
    const text = this.add.text(x, y, label, { fontSize: '17px', color: '#f4fbff', fontStyle: '700' });
    text.setOrigin(0.5);
    body.setInteractive({ useHandCursor: true });
    body.on('pointerover', () => body.setAlpha(0.85));
    body.on('pointerout', () => body.setAlpha(1));
    body.on('pointerdown', () => onClick());
  }

  private showToast(message: string): void {
    if (!this.toastText) {
      return;
    }
    this.toastText.setText(message);
    this.toastText.setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1400, duration: 400 });
  }
}
