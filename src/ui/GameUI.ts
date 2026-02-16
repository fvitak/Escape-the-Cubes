import Phaser from 'phaser';
import type { Side } from '../utils/sides';

export class GameUI {
  private readonly debugText: Phaser.GameObjects.Text;
  private readonly overlayBackdrop: Phaser.GameObjects.Rectangle;
  private readonly overlayText: Phaser.GameObjects.Text;
  private readonly openingTitle: Phaser.GameObjects.Text;
  private readonly openingHint: Phaser.GameObjects.Text;
  private readonly bossBarBg: Phaser.GameObjects.Rectangle;
  private readonly bossChunks: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene) {
    this.debugText = scene.add.text(14, 12, '', {
      fontSize: '16px',
      color: '#e7edf7',
      backgroundColor: '#00000044',
      padding: { x: 6, y: 4 }
    });
    this.debugText.setDepth(40);

    this.overlayBackdrop = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0.72);
    this.overlayBackdrop.setDepth(50);
    this.overlayBackdrop.setVisible(false);

    this.overlayText = scene.add.text(480, 320, '', {
      fontSize: '72px',
      color: '#ffffff',
      align: 'center'
    });
    this.overlayText.setOrigin(0.5, 0.5);
    this.overlayText.setDepth(51);
    this.overlayText.setVisible(false);

    this.openingTitle = scene.add.text(480, 292, 'You must escape!', {
      fontSize: '68px',
      color: '#eaf3ff',
      fontStyle: '700',
      stroke: '#0a1421',
      strokeThickness: 8,
      align: 'center'
    });
    this.openingTitle.setOrigin(0.5, 0.5);
    this.openingTitle.setDepth(44);
    this.openingTitle.setShadow(0, 6, '#00000088', 10, false, true);
    this.openingTitle.setVisible(false);

    this.openingHint = scene.add.text(480, 598, 'Press spacebar to dash', {
      fontSize: '34px',
      color: '#d2e5ff',
      fontStyle: '600',
      stroke: '#0a1421',
      strokeThickness: 6,
      align: 'center'
    });
    this.openingHint.setOrigin(0.5, 0.5);
    this.openingHint.setDepth(44);
    this.openingHint.setShadow(0, 4, '#00000077', 8, false, true);
    this.openingHint.setVisible(false);

    this.bossBarBg = scene.add.rectangle(480, 616, 520, 18, 0x2a0f0f, 0.85);
    this.bossBarBg.setDepth(45);
    this.bossBarBg.setVisible(false);

    const startX = 480 - 250 + 10;
    const chunkW = 92;
    const gap = 8;
    for (let i = 0; i < 5; i += 1) {
      const chunk = scene.add.rectangle(startX + i * (chunkW + gap), 616, chunkW, 14, 0xd53333, 0.95);
      chunk.setOrigin(0, 0.5);
      chunk.setDepth(46);
      chunk.setVisible(false);
      this.bossChunks.push(chunk);
    }
  }

  setDebug(
    roomIndex: number,
    entrance: Side | null,
    exit: Side | null,
    enemyCount: number,
    shockState: string,
    musicOn: boolean
  ): void {
    this.debugText.setText(
      `Room ${roomIndex} | Entrance: ${(entrance ?? 'none').toUpperCase()} | Exit: ${(exit ?? 'none').toUpperCase()} | Enemies: ${enemyCount} | Shock: ${shockState} | Music: ${musicOn ? 'ON' : 'OFF'}`
    );
  }

  showResult(win: boolean): void {
    this.overlayBackdrop.setVisible(true);
    this.overlayText.setVisible(true);
    this.overlayText.setText(win ? 'YOU WIN\nPress Enter or Click to Restart' : 'YOU LOSE\nPress Enter or Click to Restart');
  }

  hideResult(): void {
    this.overlayBackdrop.setVisible(false);
    this.overlayText.setVisible(false);
  }

  setOpeningPromptVisible(visible: boolean): void {
    this.openingTitle.setVisible(visible);
    this.openingHint.setVisible(visible);
  }

  setBossHp(current: number, max: number, visible: boolean): void {
    this.bossBarBg.setVisible(visible);
    for (const chunk of this.bossChunks) {
      chunk.setVisible(visible);
    }
    if (!visible) {
      return;
    }
    const clamped = Phaser.Math.Clamp(current, 0, max);
    for (let i = 0; i < this.bossChunks.length; i += 1) {
      this.bossChunks[i].setFillStyle(i < clamped ? 0xd53333 : 0x4a2424, i < clamped ? 0.95 : 0.8);
    }
  }
}
