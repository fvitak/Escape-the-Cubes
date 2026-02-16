import Phaser from 'phaser';
import type { RoomSetup } from '../rooms/types';

export class RoomManager {
  private readonly scene: Phaser.Scene;

  private decorObjects: Phaser.GameObjects.GameObject[] = [];
  private wallColliders: Phaser.GameObjects.Rectangle[] = [];
  private enemyDoorBlockers: Phaser.GameObjects.Rectangle[] = [];
  private doorTrigger: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  loadRoom(setup: RoomSetup): void {
    this.clearRoom();

    this.drawFloor(setup.roomIndex);

    for (const wall of setup.walls) {
      this.createExtrudedBlock(wall.x, wall.y, wall.width, wall.height);
    }

    for (const obstacle of setup.obstacles) {
      this.createExtrudedBlock(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    this.drawDoor(setup);
    this.createEnemyDoorBlockers(setup);
    this.drawVignette();
  }

  getWallColliders(): Phaser.GameObjects.Rectangle[] {
    return this.wallColliders;
  }

  getDoorTrigger(): Phaser.GameObjects.Rectangle | null {
    return this.doorTrigger;
  }

  getEnemyDoorBlockers(): Phaser.GameObjects.Rectangle[] {
    return this.enemyDoorBlockers;
  }

  destroy(): void {
    this.clearRoom();
  }

  private clearRoom(): void {
    for (const collider of this.wallColliders) {
      collider.destroy();
    }
    this.wallColliders = [];

    for (const blocker of this.enemyDoorBlockers) {
      blocker.destroy();
    }
    this.enemyDoorBlockers = [];

    if (this.doorTrigger) {
      this.doorTrigger.destroy();
      this.doorTrigger = null;
    }

    for (const object of this.decorObjects) {
      object.destroy();
    }
    this.decorObjects = [];
  }

  private drawFloor(roomIndex: number): void {
    const baseColors = [0x1a1f2b, 0x1f2329, 0x202426, 0x242224];
    const floor = this.scene.add.rectangle(480, 320, 960, 640, baseColors[roomIndex] ?? 0x1f1f1f);
    floor.setDepth(-120);
    this.decorObjects.push(floor);

    const grid = this.scene.add.graphics();
    grid.setDepth(-118);
    grid.lineStyle(1, 0xffffff, 0.04);

    for (let x = 0; x <= 960; x += 40) {
      grid.lineBetween(x, 0, x, 640);
    }
    for (let y = 0; y <= 640; y += 40) {
      grid.lineBetween(0, y, 960, y);
    }

    for (let x = 20; x < 960; x += 80) {
      for (let y = 20; y < 640; y += 80) {
        const tint = ((x + y + roomIndex * 13) % 5) * 0.006 + 0.02;
        grid.fillStyle(0xffffff, tint);
        grid.fillRect(x - 18, y - 18, 36, 36);
      }
    }

    this.decorObjects.push(grid);

    const bevel = this.scene.add.graphics();
    bevel.setDepth(-117);
    bevel.fillStyle(0xffffff, 0.05);
    bevel.fillRect(0, 0, 960, 14);
    bevel.fillRect(0, 0, 14, 640);
    bevel.fillStyle(0x000000, 0.18);
    bevel.fillRect(0, 626, 960, 14);
    bevel.fillRect(946, 0, 14, 640);
    this.decorObjects.push(bevel);
  }

  private createExtrudedBlock(x: number, y: number, width: number, height: number): void {
    const shadow = this.scene.add.ellipse(x + 10, y + 12, width + 10, height + 10, 0x000000, 0.28);
    shadow.setDepth(-8);
    this.decorObjects.push(shadow);

    const sideFace = this.scene.add.rectangle(x + 7, y + 7, width, height, 0x2f323a);
    sideFace.setDepth(-6);
    this.decorObjects.push(sideFace);

    const topFace = this.scene.add.rectangle(x, y, width, height, 0x525865);
    topFace.setDepth(-5);
    topFace.setStrokeStyle(2, 0x9aa2b2, 0.55);
    this.decorObjects.push(topFace);

    this.scene.physics.add.existing(topFace, true);
    this.wallColliders.push(topFace);
  }

  private drawDoor(setup: RoomSetup): void {
    if (setup.entrance) {
      this.drawDoorVisual(setup.entrance.trigger, 0xa79062, 0xcdb57d, 0.72);
    }

    if (!setup.exit) {
      return;
    }

    const exitFill = setup.roomIndex >= 5 ? 0x7be38f : 0x67b8f4;
    this.drawDoorVisual(setup.exit.trigger, 0x1e232e, exitFill, 0.74);

    this.doorTrigger = this.scene.add.rectangle(
      setup.exit.trigger.x,
      setup.exit.trigger.y,
      setup.exit.trigger.width,
      setup.exit.trigger.height,
      0xffffff,
      0.001
    );
    this.scene.physics.add.existing(this.doorTrigger, true);
  }

  private createEnemyDoorBlockers(setup: RoomSetup): void {
    const doors = [setup.exit, setup.entrance].filter((door): door is NonNullable<typeof door> => Boolean(door));
    for (const door of doors) {
      const blocker = this.makeDoorBlocker(door.trigger);
      this.scene.physics.add.existing(blocker, true);
      this.enemyDoorBlockers.push(blocker);
    }
  }

  private makeDoorBlocker(trigger: { x: number; y: number; width: number; height: number }): Phaser.GameObjects.Rectangle {
    const isHorizontalDoor = trigger.width > trigger.height;
    const blocker = this.scene.add.rectangle(
      trigger.x,
      trigger.y,
      isHorizontalDoor ? trigger.width + 6 : 10,
      isHorizontalDoor ? 10 : trigger.height + 6,
      0x000000,
      0.001
    );
    blocker.setDepth(-1);
    return blocker;
  }

  private drawDoorVisual(
    trigger: { x: number; y: number; width: number; height: number },
    frameColor: number,
    fillColor: number,
    fillAlpha: number
  ): void {
    const frameShadow = this.scene.add.rectangle(trigger.x + 6, trigger.y + 6, trigger.width, trigger.height, 0x000000, 0.28);
    frameShadow.setDepth(-3);
    this.decorObjects.push(frameShadow);

    const frame = this.scene.add.rectangle(trigger.x, trigger.y, trigger.width + 10, trigger.height + 10, frameColor);
    frame.setDepth(-2);
    this.decorObjects.push(frame);

    const fill = this.scene.add.rectangle(trigger.x, trigger.y, trigger.width, trigger.height, fillColor, fillAlpha);
    fill.setDepth(-1);
    this.decorObjects.push(fill);
  }

  private drawVignette(): void {
    const top = this.scene.add.rectangle(480, 32, 960, 64, 0x000000, 0.18);
    const bottom = this.scene.add.rectangle(480, 608, 960, 64, 0x000000, 0.2);
    const left = this.scene.add.rectangle(32, 320, 64, 640, 0x000000, 0.16);
    const right = this.scene.add.rectangle(928, 320, 64, 640, 0x000000, 0.16);

    top.setDepth(20);
    bottom.setDepth(20);
    left.setDepth(20);
    right.setDepth(20);

    this.decorObjects.push(top, bottom, left, right);
  }
}
