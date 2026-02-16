import Phaser from 'phaser';
import { animKey } from '../utils/slimeSheets';

export class Minion extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private speed = 145;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'green-idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body = this.body as Phaser.Physics.Arcade.Body;
    const r = this.width * 0.14;
    this.body.setCircle(r, this.width / 2 - r, this.height * 0.84 - r);
    this.body.setCollideWorldBounds(true);

    this.play(animKey('green', 'idle'));
  }

  updateChase(target: Phaser.Math.Vector2): void {
    const dir = target.clone().subtract(new Phaser.Math.Vector2(this.x, this.y));
    if (dir.lengthSq() < 4) {
      this.body.setVelocity(0, 0);
      this.play(animKey('green', 'idle'), true);
      return;
    }

    dir.normalize().scale(this.speed);
    this.body.setVelocity(dir.x, dir.y);
    this.flipX = dir.x < -1;
    this.play(animKey('green', 'run'), true);
  }

  squashToObstacle(): Phaser.GameObjects.Ellipse {
    const blob = this.scene.add.ellipse(this.x, this.y + 8, 44, 20, 0x5c1a1a, 0.85);
    blob.setDepth(4);
    this.destroy();
    return blob;
  }
}
