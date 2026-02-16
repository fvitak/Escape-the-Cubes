import Phaser from 'phaser';
import { moveTowards } from '../utils/math';

export interface MoveInput {
  x: number;
  y: number;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  facing = new Phaser.Math.Vector2(0, -1);

  private maxSpeed = 190;
  private readonly acceleration = 1700;
  private readonly deceleration = 2200;
  private isDead = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-cube', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body = this.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(this.width, this.height, true);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(this.maxSpeed, this.maxSpeed);

    this.setDepth(8);
  }

  setRoomMovement(roomIndex: number): void {
    this.maxSpeed = roomIndex === 0 ? 220 : 360;
    this.body.setMaxVelocity(this.maxSpeed, this.maxSpeed);
  }

  updateMovement(input: MoveInput, deltaMs: number, speedScale = 1): void {
    if (this.isDead) {
      this.body.setVelocity(0, 0);
      return;
    }

    const dt = deltaMs / 1000;
    const effectiveSpeed = this.maxSpeed * speedScale;
    this.body.setMaxVelocity(effectiveSpeed, effectiveSpeed);
    const targetX = input.x * effectiveSpeed;
    const targetY = input.y * effectiveSpeed;

    this.body.velocity.x = moveTowards(
      this.body.velocity.x,
      targetX,
      (input.x === 0 ? this.deceleration : this.acceleration) * dt
    );
    this.body.velocity.y = moveTowards(
      this.body.velocity.y,
      targetY,
      (input.y === 0 ? this.deceleration : this.acceleration) * dt
    );

    const moving = this.body.velocity.length() > 12;
    if (moving) {
      this.facing.set(this.body.velocity.x, this.body.velocity.y).normalize();
    }
  }

  playDead(): void {
    if (this.isDead) {
      return;
    }

    this.isDead = true;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setAngle(0);
    this.setTint(0xff9b9b);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 0.8,
      angle: 7,
      duration: 90,
      yoyo: true
    });
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.35,
      scaleY: 0.2,
      alpha: 0.92,
      angle: -10,
      duration: 210,
      delay: 90
    });
  }

  resetAt(x: number, y: number, facing: { x: number; y: number }): void {
    this.isDead = false;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);
    this.facing.set(facing.x, facing.y).normalize();
    this.clearTint();
    this.setScale(1, 1);
    this.setAngle(0);
    this.setAlpha(1);
  }
}
