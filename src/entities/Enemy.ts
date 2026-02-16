import Phaser from 'phaser';
import type { EnemyArchetype } from './EnemyArchetypes';
import { steerVelocity, type SteeringParams } from '../systems/SteeringSystem';

const ARCHETYPE_STATS: Record<EnemyArchetype, SteeringParams & { color: number; texture: string }> = {
  green: {
    maxSpeed: 240,
    maxAcceleration: 560,
    maxTurnRate: 4.8,
    color: 0x67d08d,
    texture: 'enemy-cube-green'
  },
  red: {
    maxSpeed: 320,
    maxAcceleration: 380,
    maxTurnRate: 2.0,
    color: 0xff6e6e,
    texture: 'enemy-cube-red'
  }
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly archetype: EnemyArchetype;

  private velocity = new Phaser.Math.Vector2(0, 0);
  private shockUntil = 0;
  private shockText: Phaser.GameObjects.Text;
  private stuckMs = 0;
  private avoidSign = 1;
  private speedOverride: number | null = null;
  private ballistic = false;
  private ballisticSpeed = 0;
  private ballisticDir = new Phaser.Math.Vector2(1, 0);

  constructor(scene: Phaser.Scene, x: number, y: number, archetype: EnemyArchetype) {
    const spec = ARCHETYPE_STATS[archetype];
    super(scene, x, y, spec.texture, 0);

    this.archetype = archetype;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body = this.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(this.width, this.height, true);
    this.body.setCollideWorldBounds(true);

    this.shockText = scene.add.text(x, y - 22, '!', {
      fontSize: '18px',
      color: '#fff3b0'
    });
    this.shockText.setOrigin(0.5, 0.5);
    this.shockText.setDepth(10);
    this.shockText.setVisible(false);

    this.setDepth(7);
    this.setTint(spec.color);
  }

  updateSteering(player: Phaser.Math.Vector2, allEnemies: Enemy[], deltaMs: number, now: number): void {
    if (this.isShocked(now)) {
      this.body.setVelocity(0, 0);
      this.syncShockText();
      return;
    }

    if (this.ballistic) {
      let reflected = false;
      if (this.body.blocked.left || this.body.blocked.right) {
        this.ballisticDir.x *= -1;
        reflected = true;
      }
      if (this.body.blocked.up || this.body.blocked.down) {
        this.ballisticDir.y *= -1;
        reflected = true;
      }

      if (reflected || this.body.velocity.lengthSq() < 1) {
        if (this.ballisticDir.lengthSq() < 0.0001) {
          this.ballisticDir.set(1, 0);
        } else {
          this.ballisticDir.normalize();
        }
      }
      this.body.setVelocity(this.ballisticDir.x * this.ballisticSpeed, this.ballisticDir.y * this.ballisticSpeed);
      const moving = this.body.velocity.length() > 8;
      this.setScale(moving ? 1.05 : 1);
      this.syncShockText();
      return;
    }

    const dt = deltaMs / 1000;
    const base = ARCHETYPE_STATS[this.archetype];
    const stats: SteeringParams = this.speedOverride == null
      ? base
      : {
          maxSpeed: this.speedOverride,
          maxAcceleration: base.maxAcceleration,
          maxTurnRate: base.maxTurnRate
        };

    const target = player.clone();
    const separation = new Phaser.Math.Vector2(0, 0);
    const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    for (const other of allEnemies) {
      if (other === this || !other.active) {
        continue;
      }
      const away = new Phaser.Math.Vector2(this.x - other.x, this.y - other.y);
      const distanceSq = away.lengthSq();
      if (distanceSq > 0 && distanceSq < 44 * 44) {
        away.normalize().scale(40);
        separation.add(away);
      }
    }

    target.add(separation.scale(0.45));

    if (this.body.blocked.left || this.body.blocked.right || this.body.blocked.up || this.body.blocked.down) {
      const sidestep = new Phaser.Math.Vector2(0, 0);
      if (this.body.blocked.left || this.body.blocked.right) {
        sidestep.y = this.avoidSign * 120;
      }
      if (this.body.blocked.up || this.body.blocked.down) {
        sidestep.x = -this.avoidSign * 120;
      }
      target.add(sidestep);
    }

    this.velocity = steerVelocity(this.velocity, new Phaser.Math.Vector2(this.x, this.y), target, stats, dt);
    this.body.setVelocity(this.velocity.x, this.velocity.y);

    const speed = this.body.velocity.length();
    if (distanceToPlayer > 48 && speed < 28) {
      this.stuckMs += deltaMs;
    } else {
      this.stuckMs = 0;
    }

    if (this.stuckMs > 260) {
      this.stuckMs = 0;
      this.avoidSign *= -1;
      this.velocity.rotate(this.avoidSign * 0.9).setLength(stats.maxSpeed * 0.75);
      this.body.setVelocity(this.velocity.x, this.velocity.y);
    }

    const moving = speed > 8;
    this.setScale(moving ? 1.05 : 1);
    this.syncShockText();
  }

  teleport(x: number, y: number): void {
    this.setPosition(x, y);
    this.velocity.set(0, 0);
    this.body.setVelocity(0, 0);
    this.syncShockText();
  }

  freeze(): void {
    this.velocity.set(0, 0);
    this.body.setVelocity(0, 0);
    this.syncShockText();
  }

  setSpeedOverride(speed: number | null): void {
    this.speedOverride = speed;
  }

  startBallistic(direction: Phaser.Math.Vector2, speed: number): void {
    const dir = direction.clone();
    if (dir.lengthSq() < 0.0001) {
      dir.set(1, 0);
    } else {
      dir.normalize();
    }
    this.ballistic = true;
    this.ballisticSpeed = speed;
    this.ballisticDir.copy(dir);
    this.body.setBounce(1, 1);
    this.body.setDrag(0, 0);
    this.body.setMaxVelocity(speed, speed);
    this.body.setVelocity(dir.x * speed, dir.y * speed);
  }

  startShock(now: number, durationMs: number): void {
    this.shockUntil = now + durationMs;
    this.body.setVelocity(0, 0);
    this.velocity.set(0, 0);

    this.shockText.setVisible(true);
    this.setScale(0.8);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 120,
      yoyo: true,
      repeat: 1
    });
    this.scene.tweens.add({
      targets: this.shockText,
      angle: { from: -15, to: 15 },
      duration: 80,
      yoyo: true,
      repeat: Math.ceil(durationMs / 160)
    });

    this.scene.time.delayedCall(durationMs, () => {
      if (!this.active) {
        return;
      }
      this.shockText.setVisible(false);
      this.setScale(1);
      this.shockText.angle = 0;
    });
  }

  isShocked(now: number): boolean {
    return now < this.shockUntil;
  }

  override destroy(fromScene?: boolean): void {
    this.shockText.destroy();
    super.destroy(fromScene);
  }

  private syncShockText(): void {
    this.shockText.setPosition(this.x, this.y - 22);
  }
}
