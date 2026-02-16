import Phaser from 'phaser';
import { animKey } from '../utils/slimeSheets';

export type BossState = 'idle' | 'telegraph' | 'charge' | 'stunned' | 'dead';

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  hp = 5;
  state: BossState = 'idle';

  private telegraphUntil = 0;
  private stunUntil = 0;
  private nextTelegraphAt = Number.MAX_SAFE_INTEGER;
  private chargeStartedAt = 0;
  private chargeDirection = new Phaser.Math.Vector2(0, 0);
  private telegraphTarget = new Phaser.Math.Vector2(0, 0);
  private chargeEnd = new Phaser.Math.Vector2(0, 0);

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'red-idle', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(3);
    this.setDepth(26);
    this.setVisible(true);
    this.setAlpha(1);

    this.body = this.body as Phaser.Physics.Arcade.Body;
    const displayW = this.width * this.scaleX;
    const displayH = this.height * this.scaleY;
    const r = displayW * 0.22;
    this.body.setCircle(r, displayW / 2 - r, displayH * 0.74 - r);
    this.body.setCollideWorldBounds(true);
    this.body.setImmovable(false);

    this.play(animKey('red', 'idle'));
  }

  startTelegraph(now: number, target: Phaser.Math.Vector2): void {
    this.state = 'telegraph';
    this.telegraphUntil = now + 2000;
    this.telegraphTarget = target.clone();
    this.chargeDirection = target.clone().subtract(new Phaser.Math.Vector2(this.x, this.y));
    if (this.chargeDirection.lengthSq() < 0.0001) {
      this.chargeDirection.set(0, 1);
    } else {
      this.chargeDirection.normalize();
    }
    this.chargeEnd = this.computeChargeEnd(this.chargeDirection);
    this.setFlipX(target.x < this.x);
    this.body.setVelocity(0, 0);
    this.play(animKey('red', 'idle'), true);
  }

  startEncounter(now: number): void {
    this.state = 'idle';
    this.nextTelegraphAt = now + 5000;
    this.body.setVelocity(0, 0);
    this.play(animKey('red', 'idle'), true);
  }

  update(now: number, target: Phaser.Math.Vector2): void {
    if (this.state === 'dead') {
      this.body.setVelocity(0, 0);
      return;
    }

    if (this.state === 'idle') {
      this.setFlipX(target.x < this.x);
      if (now >= this.nextTelegraphAt) {
        this.startTelegraph(now, target);
      } else {
        this.body.setVelocity(0, 0);
      }
      return;
    }

    if (this.state === 'telegraph') {
      this.setFlipX(this.telegraphTarget.x < this.x);
      if (now >= this.telegraphUntil) {
        this.state = 'charge';
        this.chargeStartedAt = now;
        const speed = 1475;
        this.body.setVelocity(this.chargeDirection.x * speed, this.chargeDirection.y * speed);
        this.play(animKey('red', 'run'), true);
      }
      return;
    }

    if (this.state === 'charge') {
      const justStarted = now - this.chargeStartedAt < 120;
      if (!justStarted && (this.body.blocked.left || this.body.blocked.right || this.body.blocked.up || this.body.blocked.down)) {
        this.hp = Math.max(0, this.hp - 1);
        if (this.hp <= 0) {
          this.state = 'dead';
          this.body.setVelocity(0, 0);
          this.play(animKey('red', 'idle'), true);
          this.setTint(0x777777);
          return;
        }
        this.state = 'stunned';
        this.stunUntil = now + 3000;
        this.body.setVelocity(0, 0);
        this.play(animKey('red', 'idle'), true);
        this.scene.tweens.add({
          targets: this,
          angle: { from: -6, to: 6 },
          yoyo: true,
          duration: 90,
          repeat: 5
        });
      }
      return;
    }

    if (this.state === 'stunned' && now >= this.stunUntil) {
      this.clearTint();
      this.state = 'idle';
      this.nextTelegraphAt = now + 5000;
      this.angle = 0;
      this.body.setVelocity(0, 0);
    }
  }

  isDangerous(): boolean {
    return this.state === 'charge';
  }

  isStunned(now: number): boolean {
    return this.state === 'stunned' && now < this.stunUntil;
  }

  getChargeDirection(): Phaser.Math.Vector2 {
    return this.chargeDirection.clone();
  }

  getTelegraphTarget(): Phaser.Math.Vector2 {
    return this.telegraphTarget.clone();
  }

  getChargeEnd(): Phaser.Math.Vector2 {
    return this.chargeEnd.clone();
  }

  private computeChargeEnd(direction: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const bounds = this.scene.physics.world.bounds;
    const r = this.body.radius;
    const xMin = bounds.x + r;
    const xMax = bounds.right - r;
    const yMin = bounds.y + r;
    const yMax = bounds.bottom - r;

    let t = Number.POSITIVE_INFINITY;

    if (direction.x > 0.0001) {
      t = Math.min(t, (xMax - this.x) / direction.x);
    } else if (direction.x < -0.0001) {
      t = Math.min(t, (xMin - this.x) / direction.x);
    }
    if (direction.y > 0.0001) {
      t = Math.min(t, (yMax - this.y) / direction.y);
    } else if (direction.y < -0.0001) {
      t = Math.min(t, (yMin - this.y) / direction.y);
    }

    const safeT = Number.isFinite(t) ? Math.max(0, t) : 0;
    return new Phaser.Math.Vector2(this.x + direction.x * safeT, this.y + direction.y * safeT);
  }
}
