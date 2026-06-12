import Phaser from 'phaser';

interface MenuButtonOptions {
  primary?: boolean;
  width?: number;
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu-scene');
  }

  create(): void {
    window.dispatchEvent(new Event('dungeon-ready'));
    this.cameras.main.setBackgroundColor('#0d0f14');
    this.drawBackdrop();

    const title = this.add.text(480, 168, 'ESCAPE THE CUBES', {
      fontSize: '64px',
      color: '#eaf3ff',
      fontStyle: '800',
      stroke: '#0a1421',
      strokeThickness: 10,
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setShadow(0, 6, '#00000088', 12, false, true);

    const subtitle = this.add.text(480, 226, 'A tiny dungeon of very hostile geometry', {
      fontSize: '20px',
      color: '#8fa3c2',
      align: 'center'
    });
    subtitle.setOrigin(0.5);

    this.makeButton(480, 330, 'PLAY', () => this.startGame(), { primary: true });
    this.makeButton(480, 412, 'EDIT LEVELS', () => this.scene.start('edit-hub-scene'));

    const hint = this.add.text(480, 560, 'Enter to play  ·  WASD / Arrows to move once inside', {
      fontSize: '16px',
      color: '#5d6f8c'
    });
    hint.setOrigin(0.5);

    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.input.setDefaultCursor('default');
    });
  }

  private startGame(): void {
    this.scene.start('game-scene');
  }

  private drawBackdrop(): void {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.035);
    for (let x = 0; x <= 960; x += 40) {
      grid.lineBetween(x, 0, x, 640);
    }
    for (let y = 0; y <= 640; y += 40) {
      grid.lineBetween(0, y, 960, y);
    }

    // A few drifting cubes for ambience.
    for (let i = 0; i < 7; i += 1) {
      const size = Phaser.Math.Between(16, 34);
      const colors = [0x67d08d, 0xff6e6e, 0x7ccfff];
      const cube = this.add.rectangle(
        Phaser.Math.Between(60, 900),
        Phaser.Math.Between(60, 580),
        size,
        size,
        colors[i % colors.length],
        0.16
      );
      cube.setAngle(Phaser.Math.Between(0, 90));
      this.tweens.add({
        targets: cube,
        y: cube.y + Phaser.Math.Between(-46, 46),
        angle: cube.angle + Phaser.Math.Between(-70, 70),
        duration: Phaser.Math.Between(4200, 8200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    options: MenuButtonOptions = {}
  ): void {
    const width = options.width ?? 320;
    const height = 60;
    const fill = options.primary ? 0x2f6db8 : 0x2a3242;
    const stroke = options.primary ? 0x8fc6ff : 0x55617a;

    const container = this.add.container(x, y);
    const shadow = this.add.rectangle(4, 6, width, height, 0x000000, 0.35);
    const body = this.add.rectangle(0, 0, width, height, fill, 1);
    body.setStrokeStyle(2, stroke, 0.9);
    const text = this.add.text(0, 0, label, {
      fontSize: options.primary ? '30px' : '26px',
      color: '#f4fbff',
      fontStyle: '700'
    });
    text.setOrigin(0.5);
    container.add([shadow, body, text]);

    body.setInteractive({ useHandCursor: true });
    body.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 90 });
      body.setFillStyle(options.primary ? 0x3b82d6 : 0x36405a, 1);
    });
    body.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 90 });
      body.setFillStyle(fill, 1);
    });
    body.on('pointerdown', () => onClick());
  }
}
