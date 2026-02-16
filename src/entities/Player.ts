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
    this.maxSpeed = roomIndex === 0 ? 220 : 684;
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

    const speed = this.body.velocity.length();
    const speedRatio = Phaser.Math.Clamp(speed / Math.max(1, effectiveSpeed), 0, 1);
    const targetAngle = Phaser.Math.Clamp(this.body.velocity.x * 0.055, -16, 16);
    const targetScaleX = 1 + speedRatio * 0.2;
    const targetScaleY = 1 - speedRatio * 0.1;
    this.setAngle(Phaser.Math.Linear(this.angle, targetAngle, 0.28));
    this.setScale(
      Phaser.Math.Linear(this.scaleX, targetScaleX, moving ? 0.24 : 0.18),
      Phaser.Math.Linear(this.scaleY, targetScaleY, moving ? 0.24 : 0.18)
    );
  }

  playDead(): void {
    if (this.isDead) {
      return;
    }

    this.isDead = true;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setAngle(0);
    this.setTint(0xffd0d0);

    const flashRing = this.scene.add.circle(this.x, this.y, 10, 0xffffff, 0.7);
    flashRing.setDepth(this.depth + 2);
    this.scene.tweens.add({
      targets: flashRing,
      radius: 68,
      alpha: 0,
      duration: 170,
      ease: 'Quad.Out',
      onComplete: () => flashRing.destroy()
    });

    this.scene.tweens.add({
      targets: this,
      scaleX: 1.9,
      scaleY: 1.9,
      alpha: 0,
      duration: 180,
      ease: 'Quad.Out'
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
