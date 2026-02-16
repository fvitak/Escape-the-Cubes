import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { buildRoomSetup, randomExitSide, sideOptions } from '../rooms/layouts';
import type { RoomSetup } from '../rooms/types';
import { RoomManager } from '../systems/RoomManager';
import { GameUI } from '../ui/GameUI';
import { intersectsRect } from '../utils/math';
import { createRunSeed, Rng } from '../utils/rng';
import { oppositeSide, type Side } from '../utils/sides';

interface KeyBindings {
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  r: Phaser.Input.Keyboard.Key;
  m: Phaser.Input.Keyboard.Key;
  h: Phaser.Input.Keyboard.Key;
}

type PlayState = 'playing' | 'won' | 'lost';

export class GameScene extends Phaser.Scene {
  private readonly roomSize = { width: 960, height: 640 };
  private readonly totalRooms = 7;

  private keys!: KeyBindings;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private roomManager!: RoomManager;
  private ui!: GameUI;
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private squishedObstacles!: Phaser.Physics.Arcade.StaticGroup;
  private puddles!: Phaser.Physics.Arcade.StaticGroup;

  private bossBlob: Phaser.Physics.Arcade.Sprite | null = null;
  private bossShard: Phaser.Physics.Arcade.Image | null = null;
  private bossArrow: Phaser.GameObjects.Graphics | null = null;
  private bossPhase: 'patrol' | 'telegraph' | 'charge' | 'stunned' = 'patrol';
  private bossPhaseUntil = 0;
  private bossPatrolDir = 1;
  private bossHp = 0;
  private readonly bossMaxHp = 5;
  private bossTelegraphTarget = new Phaser.Math.Vector2(480, 320);
  private bossTelegraphDir = new Phaser.Math.Vector2(0, 1);
  private bossShardLaunched = false;

  private state: PlayState = 'playing';
  private transitionCooldownUntil = 0;
  private shockStatus = 'none';

  private currentRoom = 0;
  private roomEntrances: Array<Side | null> = [];
  private roomExits: Side[] = [];
  private roomVariants: number[] = [];
  private setup!: RoomSetup;

  private rng!: Rng;

  private music: Phaser.Sound.BaseSound | null = null;
  private musicEnabled = true;
  private musicLoading = false;

  private wallColliders: Phaser.Physics.Arcade.Collider[] = [];
  private doorOverlap: Phaser.Physics.Arcade.Collider | null = null;
  private touchOverlap: Phaser.Physics.Arcade.Collider | null = null;
  private bossExitOverlap: Phaser.Physics.Arcade.Collider | null = null;
  private level2PortalOverlap: Phaser.Physics.Arcade.Collider | null = null;
  private testPortalOverlap: Phaser.Physics.Arcade.Collider | null = null;
  private testPortalTrigger: Phaser.GameObjects.Rectangle | null = null;
  private testPortalVisual: Phaser.GameObjects.Rectangle | null = null;
  private testPortalLabel: Phaser.GameObjects.Text | null = null;
  private bossExitTrigger: Phaser.GameObjects.Rectangle | null = null;
  private bossExitVisual: Phaser.GameObjects.Rectangle | null = null;
  private level2PortalTrigger: Phaser.GameObjects.Rectangle | null = null;
  private level2PortalVisual: Phaser.GameObjects.Rectangle | null = null;
  private level2PortalLabel: Phaser.GameObjects.Text | null = null;
  private bossExitOpen = false;
  private level2Started = false;
  private level2TemplateLoaded = false;
  private dashUntil = 0;
  private dashFxUntil = 0;
  private nextDashFxAt = 0;

  private debugBodiesEnabled = false;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('game-scene');
  }

  create(): void {
    this.createShapeTextures();
    this.resetRunState();

    this.physics.world.setBounds(0, 0, this.roomSize.width, this.roomSize.height);
    this.cameras.main.setBounds(0, 0, this.roomSize.width, this.roomSize.height);
    this.cameras.main.setScroll(0, 0);

    this.roomManager = new RoomManager(this);
    this.ui = new GameUI(this);
    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(100);

    this.setup = buildRoomSetup(0, this.roomExits[0], this.roomEntrances[0], this.roomVariants[0]);
    this.roomManager.loadRoom(this.setup);

    this.player = new Player(this, this.setup.spawn.x, this.setup.spawn.y);
    this.player.resetAt(this.setup.spawn.x, this.setup.spawn.y, this.setup.spawnFacing);
    this.player.setRoomMovement(0);

    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.squishedObstacles = this.physics.add.staticGroup();
    this.puddles = this.physics.add.staticGroup();

    this.configureInput();
    this.input.keyboard?.on('keydown-R', this.forceRestart, this);
    this.input.keyboard?.on('keydown-ENTER', this.forceRestart, this);
    this.input.on('pointerdown', this.handleOverlayRestartClick, this);
    this.rebuildPhysics();
    this.spawnEnemiesForCurrentRoom();
    this.ui.hideResult();
    this.ui.setBossHp(0, 5, false);
    this.updateDebug();
    window.dispatchEvent(new Event('dungeon-ready'));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyPhysicsLinks();
      this.roomManager.destroy();
      this.stopMusic();
      this.bossArrow?.destroy();
      this.input.keyboard?.off('keydown-R', this.forceRestart, this);
      this.input.keyboard?.off('keydown-ENTER', this.forceRestart, this);
      this.input.off('pointerdown', this.handleOverlayRestartClick, this);
      this.input.keyboard?.removeAllKeys(true);
    });
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.r)) {
      this.forceRestart();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.m)) {
      this.toggleMusic();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.h)) {
      this.debugBodiesEnabled = !this.debugBodiesEnabled;
      if (!this.debugBodiesEnabled) {
        this.debugGraphics?.clear();
      }
    }

    if (this.state !== 'playing') {
      this.renderDebugBodies();
      this.updateDebug();
      return;
    }

    const movement = this.collectMovement();
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      this.dashUntil = this.time.now + 220;
      this.dashFxUntil = this.time.now + 260;
      this.nextDashFxAt = this.time.now;
      this.cameras.main.shake(80, 0.002);
    }
    const dashScale = this.time.now < this.dashUntil ? 1.9 : 1;
    this.player.updateMovement(movement, delta, dashScale);
    if (this.time.now < this.dashFxUntil) {
      this.spawnDashFx();
    }
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.bossBlob) {
      this.player.setFlipX(this.bossBlob.x < this.player.x);
    } else if (Math.abs(playerBody.velocity.x) > 4) {
      this.player.setFlipX(playerBody.velocity.x < 0);
    }

    const playerPos = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const enemies = this.enemies.getChildren() as Enemy[];
    for (const enemy of enemies) {
      enemy.updateSteering(playerPos, enemies, delta, this.time.now);
    }

    this.updateBoss();

    if (enemies.length === 0) {
      this.shockStatus = 'none';
    } else {
      const hasShocked = enemies.some((enemy) => enemy.isShocked(this.time.now));
      this.shockStatus = hasShocked ? 'briefly shocked' : 'active';
    }

    this.updateDebug();
    this.renderDebugBodies();
  }

  private createShapeTextures(): void {
    this.createSquishyCubeTexture('player-cube', 40);
    this.createCubeTexture('enemy-cube-green', 34, 0x7ae06a, 0x459f52, 0x2d6d3e);
    this.createCubeTexture('enemy-cube-red', 34, 0xff8d86, 0xc3555f, 0x8d3343);
    this.createCubeTexture('boss-cube', 64, 0xff7a7a, 0xd44a4a, 0x8e2424);
    this.createShardTexture('boss-shard', 22);
  }

  private createShardTexture(key: string, size: number): void {
    if (this.textures.exists(key)) {
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(0xffb4b4, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 1);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(size * 0.35, size * 0.35, size * 0.18);
    g.lineStyle(2, 0xb43f3f, 0.9);
    g.strokeCircle(size / 2, size / 2, size / 2 - 2);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private createSquishyCubeTexture(key: string, size: number): void {
    if (this.textures.exists(key)) {
      return;
    }
    const g = this.add.graphics();
    const r = Math.max(6, Math.floor(size * 0.22));

    g.fillStyle(0x7ccfff, 1);
    g.fillRoundedRect(0, 2, size, size - 2, r);
    g.fillStyle(0x4e9de2, 0.96);
    g.fillRoundedRect(3, 5, size - 6, size - 9, r - 2);
    g.fillStyle(0xdff5ff, 0.22);
    g.fillRoundedRect(6, 7, Math.floor(size * 0.55), Math.floor(size * 0.2), r - 3);
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(5, size - 11, size - 10, 7, 4);

    // Faceted core and streaks for a cleaner, faceless look.
    g.fillStyle(0x9de0ff, 0.8);
    g.fillPoints(
      [
        { x: size * 0.5, y: size * 0.2 },
        { x: size * 0.69, y: size * 0.5 },
        { x: size * 0.5, y: size * 0.8 },
        { x: size * 0.31, y: size * 0.5 }
      ],
      true
    );
    g.lineStyle(2, 0x14395b, 0.85);
    g.beginPath();
    g.moveTo(size * 0.2, size * 0.5);
    g.lineTo(size * 0.8, size * 0.5);
    g.moveTo(size * 0.5, size * 0.24);
    g.lineTo(size * 0.5, size * 0.76);
    g.strokePath();

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private createCubeTexture(key: string, size: number, top: number, left: number, right: number): void {
    if (this.textures.exists(key)) {
      return;
    }
    const g = this.add.graphics();
    const h = size / 2;
    const q = size / 4;

    g.fillStyle(top, 1);
    g.fillRect(0, 0, size, size - q);
    g.fillStyle(left, 1);
    g.fillPoints(
      [
        { x: 0, y: 0 },
        { x: q, y: q },
        { x: q, y: size },
        { x: 0, y: size - q }
      ],
      true
    );
    g.fillStyle(right, 1);
    g.fillPoints(
      [
        { x: size, y: 0 },
        { x: size - q, y: q },
        { x: size - q, y: size },
        { x: size, y: size - q }
      ],
      true
    );
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(4, 4, h, q);
    g.fillStyle(0x000000, 0.22);
    g.fillRect(0, size - q, size, q);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private resetRunState(): void {
    this.state = 'playing';
    this.transitionCooldownUntil = 0;
    this.currentRoom = 0;
    this.shockStatus = 'none';
    this.bossExitOpen = false;
    this.level2Started = false;
    this.level2TemplateLoaded = false;

    this.rng = new Rng(createRunSeed());
    this.roomEntrances = new Array(this.totalRooms).fill(null);
    this.roomExits = new Array(this.totalRooms).fill('top') as Side[];
    this.roomVariants = new Array(this.totalRooms).fill(0);

    this.roomExits[0] = 'top';
    for (let i = 1; i < this.totalRooms; i += 1) {
      this.roomEntrances[i] = oppositeSide(this.roomExits[i - 1]);
      this.roomExits[i] = randomExitSide(() => this.rng.pick(sideOptions()), this.roomEntrances[i] as Side);
      this.roomVariants[i] = this.rng.int(0, 10000);
    }
  }

  private configureInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable');
    }

    this.cursors = keyboard.createCursorKeys();
    const mapped = keyboard.addKeys('W,A,S,D,SPACE,R,M,H') as Record<string, Phaser.Input.Keyboard.Key>;

    this.keys = {
      w: mapped.W,
      a: mapped.A,
      s: mapped.S,
      d: mapped.D,
      space: mapped.SPACE,
      r: mapped.R,
      m: mapped.M,
      h: mapped.H
    };
  }

  private collectMovement(): Phaser.Math.Vector2 {
    let x = 0;
    let y = 0;

    if (this.keys.a.isDown || this.cursors.left.isDown) {
      x -= 1;
    }
    if (this.keys.d.isDown || this.cursors.right.isDown) {
      x += 1;
    }
    if (this.keys.w.isDown || this.cursors.up.isDown) {
      y -= 1;
    }
    if (this.keys.s.isDown || this.cursors.down.isDown) {
      y += 1;
    }

    const vector = new Phaser.Math.Vector2(x, y);
    if (vector.lengthSq() > 1) {
      vector.normalize();
    }
    return vector;
  }

  private rebuildPhysics(): void {
    this.destroyPhysicsLinks();

    this.wallColliders.push(this.physics.add.collider(this.player, this.roomManager.getWallColliders()));
    this.wallColliders.push(this.physics.add.collider(this.player, this.squishedObstacles));
    this.wallColliders.push(this.physics.add.overlap(this.player, this.puddles, () => this.triggerLose()));

    this.wallColliders.push(this.physics.add.collider(this.enemies, this.roomManager.getWallColliders()));
    this.wallColliders.push(this.physics.add.collider(this.enemies, this.roomManager.getEnemyDoorBlockers()));
    this.wallColliders.push(this.physics.add.collider(this.enemies, this.squishedObstacles));
    this.wallColliders.push(this.physics.add.collider(this.enemies, this.enemies));

    if (this.bossBlob) {
      this.wallColliders.push(this.physics.add.collider(this.bossBlob, this.roomManager.getWallColliders()));
      this.wallColliders.push(this.physics.add.collider(this.bossBlob, this.roomManager.getEnemyDoorBlockers()));
      this.wallColliders.push(this.physics.add.overlap(this.player, this.bossBlob, () => {
        this.triggerLose();
      }));
    }

    if (this.bossShard) {
      this.wallColliders.push(this.physics.add.collider(this.bossShard, this.roomManager.getWallColliders()));
      this.wallColliders.push(this.physics.add.collider(this.bossShard, this.roomManager.getEnemyDoorBlockers()));
      this.wallColliders.push(this.physics.add.overlap(this.player, this.bossShard, () => {
        this.kickBossShard();
      }));
      this.wallColliders.push(this.physics.add.overlap(this.bossShard, this.enemies, (_shard, enemyObj) => {
        const enemy = enemyObj as Enemy;
        if (enemy.active) {
          enemy.destroy();
        }
        this.explodeBossShard();
      }));
      if (this.bossBlob) {
        this.wallColliders.push(this.physics.add.overlap(this.bossShard, this.bossBlob, () => {
          this.hitBossWithShard();
        }));
      }
    }

    this.touchOverlap = this.physics.add.overlap(this.player, this.enemies, (_player, enemyObj) => {
      const enemy = enemyObj as Enemy;
      if (enemy.isShocked(this.time.now)) {
        return;
      }
      this.triggerLose();
    });

    if (this.currentRoom < this.totalRooms - 1) {
      const trigger = this.roomManager.getDoorTrigger();
      if (trigger) {
        this.doorOverlap = this.physics.add.overlap(this.player, trigger, () => {
          if (this.time.now < this.transitionCooldownUntil || this.state !== 'playing') {
            return;
          }
          this.advanceRoom();
        });
      }
    }

    if (this.bossExitOpen && this.bossExitTrigger) {
      this.bossExitOverlap = this.physics.add.overlap(this.player, this.bossExitTrigger, () => {
        if (this.state !== 'playing' || this.time.now < this.transitionCooldownUntil) {
          return;
        }
        this.enterLevel2Room1();
      });
    }

    if (this.level2PortalTrigger) {
      this.level2PortalOverlap = this.physics.add.overlap(this.player, this.level2PortalTrigger, () => {
        if (this.state !== 'playing' || this.time.now < this.transitionCooldownUntil) {
          return;
        }
        this.enterLevel2StartRoom();
      });
    }

    this.setupTestPortal();
  }

  private destroyPhysicsLinks(): void {
    for (const collider of this.wallColliders) {
      collider.destroy();
    }
    this.wallColliders = [];

    if (this.doorOverlap) {
      this.doorOverlap.destroy();
      this.doorOverlap = null;
    }

    if (this.touchOverlap) {
      this.touchOverlap.destroy();
      this.touchOverlap = null;
    }
    if (this.bossExitOverlap) {
      this.bossExitOverlap.destroy();
      this.bossExitOverlap = null;
    }
    if (this.level2PortalOverlap) {
      this.level2PortalOverlap.destroy();
      this.level2PortalOverlap = null;
    }

    if (this.testPortalOverlap) {
      this.testPortalOverlap.destroy();
      this.testPortalOverlap = null;
    }
    if (this.testPortalTrigger) {
      this.testPortalTrigger.destroy();
      this.testPortalTrigger = null;
    }
    if (this.testPortalVisual) {
      this.testPortalVisual.destroy();
      this.testPortalVisual = null;
    }
    if (this.testPortalLabel) {
      this.testPortalLabel.destroy();
      this.testPortalLabel = null;
    }
    if (this.bossExitTrigger) {
      this.bossExitTrigger.destroy();
      this.bossExitTrigger = null;
    }
    if (this.bossExitVisual) {
      this.bossExitVisual.destroy();
      this.bossExitVisual = null;
    }
    if (this.level2PortalTrigger) {
      this.level2PortalTrigger.destroy();
      this.level2PortalTrigger = null;
    }
    if (this.level2PortalVisual) {
      this.level2PortalVisual.destroy();
      this.level2PortalVisual = null;
    }
    if (this.level2PortalLabel) {
      this.level2PortalLabel.destroy();
      this.level2PortalLabel = null;
    }
  }

  private advanceRoom(): void {
    if (this.level2Started && !this.level2TemplateLoaded) {
      this.enterLevel2Room1();
      return;
    }

    if (this.currentRoom >= this.totalRooms - 1) {
      return;
    }

    const previousExit = this.setup.exit?.side ?? this.roomExits[this.currentRoom];
    this.currentRoom += 1;

    const isBossRoom = this.currentRoom >= this.totalRooms - 1;
    this.setup = buildRoomSetup(
      this.currentRoom,
      this.roomExits[this.currentRoom],
      isBossRoom ? null : oppositeSide(previousExit),
      this.roomVariants[this.currentRoom]
    );
    this.roomManager.loadRoom(this.setup);

    this.player.resetAt(this.setup.spawn.x, this.setup.spawn.y, this.setup.spawnFacing);
    this.player.setRoomMovement(this.currentRoom);

    this.clearEnemies();
    this.spawnEnemiesForCurrentRoom();
    this.setupBossRoom();

    if (this.currentRoom === 1 && !this.music) {
      this.startMusic();
    }

    this.rebuildPhysics();
    this.transitionCooldownUntil = this.time.now + 300;

    this.updateDebug();
  }

  private clearEnemies(): void {
    this.enemies.clear(true, true);
    this.squishedObstacles.clear(true, true);
    this.puddles.clear(true, true);

    this.bossBlob?.destroy();
    this.bossBlob = null;
    this.bossShard?.destroy();
    this.bossShard = null;
    this.bossShardLaunched = false;
    this.bossArrow?.destroy();
    this.bossArrow = null;
    this.bossExitOpen = false;
    this.bossHp = 0;
    this.ui.setBossHp(0, 5, false);
  }

  private spawnEnemiesForCurrentRoom(): void {
    const spawns = this.setup.enemySpawns ?? this.createEnemySpawnsForRoom(this.setup);
    for (let i = 0; i < this.setup.enemyArchetypes.length; i += 1) {
      const archetype = this.setup.enemyArchetypes[i];
      const spawn = spawns[i];
      if (!spawn) {
        continue;
      }

      const enemy = new Enemy(this, spawn.x, spawn.y, archetype);
      enemy.startShock(this.time.now, this.rng.int(350, 600));
      this.enemies.add(enemy);
    }

    this.shockStatus = this.setup.enemyArchetypes.length > 0 ? 'briefly shocked' : 'none';
    this.updateDebug();
  }

  private setupBossRoom(): void {
    if (!this.setup.isBossRoom) {
      return;
    }

    this.bossBlob = this.physics.add.sprite(this.roomSize.width / 2, 72, 'boss-cube', 0);
    this.bossBlob.setScale(3);
    this.bossBlob.setDepth(36);
    this.bossBlob.setCollideWorldBounds(true);
    const body = this.bossBlob.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.bossBlob.width, this.bossBlob.height, true);
    body.setImmovable(true);
    body.moves = true;
    body.allowGravity = false;
    this.bossBlob.setX(this.roomSize.width / 2);
    this.bossBlob.setY(24);
    this.bossBlob.clearTint();
    this.bossArrow = this.add.graphics();
    this.bossArrow.setDepth(37);

    this.bossPatrolDir = 1;
    this.bossPhase = 'patrol';
    this.bossPhaseUntil = this.time.now + this.rng.int(2000, 7000);
    this.bossHp = this.bossMaxHp;
    this.bossShard = null;
    this.bossShardLaunched = false;
    this.ui.setBossHp(this.bossHp, this.bossMaxHp, true);
  }

  private spawnBossShard(): void {
    if (!this.bossBlob) {
      return;
    }

    this.bossShard?.destroy();
    const minRadius = this.bossBlob.displayWidth * 0.9 + 36;
    const maxRadius = this.bossBlob.displayWidth * 1.15 + 72;
    let x = this.bossBlob.x;
    let y = this.bossBlob.y;
    for (let i = 0; i < 24; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.FloatBetween(minRadius, maxRadius);
      const tx = this.bossBlob.x + Math.cos(angle) * radius;
      const ty = this.bossBlob.y + Math.sin(angle) * radius;
      if (tx > 34 && tx < this.roomSize.width - 34 && ty > 34 && ty < this.roomSize.height - 34) {
        x = tx;
        y = ty;
        break;
      }
    }
    x = Phaser.Math.Clamp(x, 34, this.roomSize.width - 34);
    y = Phaser.Math.Clamp(y, 34, this.roomSize.height - 34);
    this.bossShard = this.physics.add.image(x, y, 'boss-shard');
    this.bossShard.setDepth(38);
    this.bossShard.setCircle(10);
    this.bossShard.setBounce(0.2);
    this.bossShard.setDamping(true);
    this.bossShard.setDrag(220);
    this.bossShard.setCollideWorldBounds(true);
    this.bossShard.setVelocity(0, 0);
    this.bossShardLaunched = false;
    this.rebuildPhysics();
  }

  private setupTestPortal(): void {
    if (this.currentRoom !== 0 || this.level2Started || this.state !== 'playing') {
      return;
    }

    const px = 840;
    const py = 584;
    const pw = 180;
    const ph = 56;

    this.testPortalVisual = this.add.rectangle(px, py, pw, ph, 0xb13dff, 0.6);
    this.testPortalVisual.setDepth(34);
    this.testPortalVisual.setStrokeStyle(2, 0xf1d1ff, 0.8);
    this.testPortalLabel = this.add.text(px, py, 'BOSS TEST PORTAL', {
      fontSize: '14px',
      color: '#ffffff'
    });
    this.testPortalLabel.setOrigin(0.5);
    this.testPortalLabel.setDepth(35);

    this.testPortalTrigger = this.add.rectangle(px, py, pw, ph, 0xffffff, 0.001);
    this.physics.add.existing(this.testPortalTrigger, true);

    this.testPortalOverlap = this.physics.add.overlap(this.player, this.testPortalTrigger, () => {
      if (this.state !== 'playing' || this.time.now < this.transitionCooldownUntil) {
        return;
      }
      this.warpToBossRoom();
    });
  }

  private warpToBossRoom(): void {
    this.currentRoom = this.totalRooms - 1;
    this.setup = buildRoomSetup(
      this.currentRoom,
      this.roomExits[this.currentRoom],
      null,
      this.roomVariants[this.currentRoom]
    );
    this.roomManager.loadRoom(this.setup);
    this.player.resetAt(this.setup.spawn.x, this.setup.spawn.y, this.setup.spawnFacing);
    this.player.setRoomMovement(this.currentRoom);
    this.clearEnemies();
    this.spawnEnemiesForCurrentRoom();
    this.setupBossRoom();
    this.rebuildPhysics();
    this.transitionCooldownUntil = this.time.now + 300;
    this.updateDebug();
  }

  private kickBossShard(): void {
    if (!this.bossShard || !this.bossBlob || this.bossShardLaunched || this.state !== 'playing') {
      return;
    }
    const dir = new Phaser.Math.Vector2(this.bossBlob.x - this.bossShard.x, this.bossBlob.y - this.bossShard.y);
    if (dir.lengthSq() < 0.001) {
      dir.set(0, 1);
    } else {
      dir.normalize();
    }
    this.bossShard.setVelocity(dir.x * 620, dir.y * 620);
    this.bossShardLaunched = true;
    this.cameras.main.shake(90, 0.003);
  }

  private explodeBossShard(): void {
    if (!this.bossShard) {
      return;
    }
    this.spawnGeomBurst(this.bossShard.x, this.bossShard.y, 7, [0xffd2d2, 0xffaaaa, 0xd86a6a]);
    this.bossShard.destroy();
    this.bossShard = null;
    this.bossShardLaunched = false;
  }

  private spawnDashFx(): void {
    if (this.time.now < this.nextDashFxAt) {
      return;
    }
    this.nextDashFxAt = this.time.now + 34;
    const puff = this.add.circle(this.player.x, this.player.y + 8, 12, 0xd8f4ff, 0.42);
    puff.setDepth(9);
    this.tweens.add({
      targets: puff,
      alpha: 0,
      scaleX: 1.7,
      scaleY: 1.25,
      duration: 180,
      onComplete: () => puff.destroy()
    });
  }

  private hitBossWithShard(): void {
    if (!this.bossShard || !this.bossBlob || this.state !== 'playing' || !this.bossShardLaunched) {
      return;
    }
    this.spawnGeomBurst(this.bossShard.x, this.bossShard.y, 8, [0xffbdbd, 0xff8e8e, 0xd65a5a]);
    this.bossShard.destroy();
    this.bossShard = null;
    this.bossShardLaunched = false;

    this.bossHp = Math.max(0, this.bossHp - 1);
    this.ui.setBossHp(this.bossHp, this.bossMaxHp, true);
    this.bossBlob.setTint(0xffb1b1);
    this.time.delayedCall(120, () => this.bossBlob?.clearTint());
    if (this.bossHp <= 0) {
      this.runBossDefeatSequence();
    }
  }

  private enterLevel2StartRoom(): void {
    if (this.level2Started) {
      return;
    }
    this.level2Started = true;
    this.level2TemplateLoaded = false;
    this.currentRoom = 0;
    this.clearEnemies();
    this.setup = this.buildLevel2StartRoomTemplate();
    this.roomManager.loadRoom(this.setup);
    this.player.resetAt(this.setup.spawn.x, this.setup.spawn.y, this.setup.spawnFacing);
    this.player.setRoomMovement(this.currentRoom);
    this.spawnEnemiesForCurrentRoom();
    this.rebuildPhysics();
    this.transitionCooldownUntil = this.time.now + 350;
    this.updateDebug();
  }

  private enterLevel2Room1(): void {
    if (this.level2TemplateLoaded) {
      return;
    }
    this.level2Started = true;
    this.level2TemplateLoaded = true;
    this.currentRoom = 1;
    this.clearEnemies();
    this.setup = this.buildLevel2Room1Template();
    this.roomManager.loadRoom(this.setup);
    this.player.resetAt(this.setup.spawn.x, this.setup.spawn.y, this.setup.spawnFacing);
    this.player.setRoomMovement(this.currentRoom);
    this.spawnEnemiesForCurrentRoom();
    this.rebuildPhysics();
    this.transitionCooldownUntil = this.time.now + 350;
    this.updateDebug();
  }

  private buildLevel2StartRoomTemplate(): RoomSetup {
    const w = this.roomSize.width;
    const h = this.roomSize.height;
    const wall = 24;
    const doorW = 120;
    const sideWallW = (w - doorW) / 2;

    return {
      roomIndex: 0,
      roomName: 'Floor 2 - Entry',
      entrance: {
        side: 'bottom',
        trigger: { x: w * 0.5, y: h - 36, width: doorW, height: 36 }
      },
      exit: {
        side: 'top',
        trigger: { x: w * 0.5, y: 36, width: doorW, height: 36 }
      },
      spawn: { x: w * 0.5, y: h * 0.9 },
      spawnFacing: { x: 0, y: -1 },
      entrySide: 'bottom',
      walls: [
        { x: sideWallW / 2, y: wall / 2, width: sideWallW, height: wall },
        { x: w - sideWallW / 2, y: wall / 2, width: sideWallW, height: wall },
        { x: sideWallW / 2, y: h - wall / 2, width: sideWallW, height: wall },
        { x: w - sideWallW / 2, y: h - wall / 2, width: sideWallW, height: wall },
        { x: wall / 2, y: h / 2, width: wall, height: h },
        { x: w - wall / 2, y: h / 2, width: wall, height: h }
      ],
      obstacles: [],
      enemyArchetypes: []
    };
  }

  private buildLevel2Room1Template(): RoomSetup {
    const w = this.roomSize.width;
    const h = this.roomSize.height;
    const wall = 24;
    const doorW = 120;
    const doorH = 36;

    const topGapCenter = w * 0.5;
    const bottomGapCenter = w * 0.5;
    const sideWallW = (w - doorW) / 2;

    return {
      roomIndex: 1,
      roomName: 'Floor 2 - Template Room 1',
      entrance: {
        side: 'bottom',
        trigger: { x: w * 0.5, y: h - 36, width: doorW, height: doorH }
      },
      exit: {
        side: 'top',
        trigger: { x: w * 0.5, y: 36, width: doorW, height: doorH }
      },
      spawn: { x: w * 0.5, y: h * 0.92 },
      spawnFacing: { x: 0, y: -1 },
      entrySide: 'bottom',
      walls: [
        { x: sideWallW / 2, y: wall / 2, width: sideWallW, height: wall },
        { x: topGapCenter + doorW / 2 + sideWallW / 2, y: wall / 2, width: sideWallW, height: wall },
        { x: sideWallW / 2, y: h - wall / 2, width: sideWallW, height: wall },
        { x: bottomGapCenter + doorW / 2 + sideWallW / 2, y: h - wall / 2, width: sideWallW, height: wall },
        { x: wall / 2, y: h / 2, width: wall, height: h },
        { x: w - wall / 2, y: h / 2, width: wall, height: h }
      ],
      obstacles: [
        { x: w * 0.32, y: h * 0.52, width: w * 0.38, height: h * 0.10 },
        { x: w * 0.18, y: h * 0.27, width: w * 0.28, height: h * 0.10 },
        { x: w * 0.58, y: h * 0.27, width: w * 0.30, height: h * 0.12 }
      ],
      enemyArchetypes: ['green'],
      enemySpawns: [{ x: w * 0.40, y: h * 0.14 }]
    };
  }

  private createEnemySpawnsForRoom(setup: RoomSetup): Array<{ x: number; y: number }> {
    const count = setup.enemyArchetypes.length;
    if (count === 0 || !setup.entrance) {
      return [];
    }

    const points: Array<{ x: number; y: number }> = [];
    const blockers = [...setup.walls, ...setup.obstacles];
    const minFromEntrance = 0.5 * Math.min(this.roomSize.width, this.roomSize.height);
    const minFromPlayer = 150;
    const margin = 42;

    let attempts = 0;
    while (points.length < count && attempts < 600) {
      attempts += 1;
      const candidate = {
        x: this.rng.int(margin, this.roomSize.width - margin),
        y: this.rng.int(margin, this.roomSize.height - margin)
      };

      if (Phaser.Math.Distance.Between(candidate.x, candidate.y, setup.entrance.trigger.x, setup.entrance.trigger.y) < minFromEntrance) {
        continue;
      }

      if (Phaser.Math.Distance.Between(candidate.x, candidate.y, setup.spawn.x, setup.spawn.y) < minFromPlayer) {
        continue;
      }

      const bodyRect = { x: candidate.x, y: candidate.y, width: 30, height: 30 };
      if (blockers.some((blocker) => intersectsRect(bodyRect, blocker))) {
        continue;
      }

      if (points.some((point) => Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) < 58)) {
        continue;
      }

      points.push(candidate);
    }

    while (points.length < count) {
      points.push({
        x: this.rng.int(70, this.roomSize.width - 70),
        y: this.rng.int(70, this.roomSize.height - 70)
      });
    }

    return points;
  }

  private updateBoss(): void {
    if (!this.bossBlob || this.state !== 'playing') {
      return;
    }

    const body = this.bossBlob.body as Phaser.Physics.Arcade.Body;
    const now = this.time.now;
    const wobble = Math.sin(now / 140) * 0.08;
    this.bossBlob.setScale(3 + wobble, 3 - wobble);
    this.bossBlob.setFlipX(this.player.x < this.bossBlob.x);

    if (this.bossPhase === 'patrol') {
      const speed = 58;
      body.setVelocityX(this.bossPatrolDir * speed);
      body.setVelocityY(0);
      if (this.bossBlob.x > this.roomSize.width - 40) {
        this.bossPatrolDir = -1;
      } else if (this.bossBlob.x < 40) {
        this.bossPatrolDir = 1;
      }
      this.bossArrow?.clear();

      if (now >= this.bossPhaseUntil) {
        this.bossPhase = 'telegraph';
        this.bossPhaseUntil = now + 500;
        this.startBossTelegraph();
        body.setVelocity(0, 0);
      }
      return;
    }

    if (this.bossPhase === 'telegraph') {
      body.setVelocity(0, 0);
      this.drawBossArrow();
      if (now >= this.bossPhaseUntil) {
        this.bossPhase = 'charge';
        const speed = 640;
        body.setVelocity(this.bossTelegraphDir.x * speed, this.bossTelegraphDir.y * speed);
      }
      return;
    }

    if (this.bossPhase === 'charge') {
      if (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down) {
        body.setVelocity(0, 0);
        this.bossPhase = 'stunned';
        this.bossPhaseUntil = now + 3000;
        this.bossArrow?.clear();
        this.spawnBossChunks(2);
        this.spawnBossShard();
        this.cameras.main.shake(2000, 0.004);
        this.bossBlob.setTint(0xff9d9d);
        this.tweens.add({
          targets: this.bossBlob,
          angle: { from: -7, to: 7 },
          duration: 110,
          yoyo: true,
          repeat: 17
        });
      }
      return;
    }

    if (this.bossPhase === 'stunned') {
      body.setVelocity(0, 0);
      if (now >= this.bossPhaseUntil) {
        this.bossBlob.clearTint();
        this.bossBlob.setAngle(0);
        this.bossPatrolDir = this.rng.pick([-1, 1] as const);
        this.bossPhase = 'patrol';
        this.bossPhaseUntil = now + this.rng.int(2000, 7000);
      }
    }
  }

  private runBossDefeatSequence(): void {
    if (!this.bossBlob) {
      this.enterLevel2StartRoom();
      return;
    }

    this.bossPhase = 'stunned';
    this.bossPhaseUntil = this.time.now + 999999;
    this.bossArrow?.clear();
    this.bossShard?.destroy();
    this.bossShard = null;
    this.bossShardLaunched = false;

    const boss = this.bossBlob;
    const bossBody = boss.body as Phaser.Physics.Arcade.Body;
    bossBody.setVelocity(0, 0);
    bossBody.enable = false;
    this.spawnGeomBurst(boss.x, boss.y, 30, [0xff9a9a, 0xff6b6b, 0xd33a3a]);
    this.tweens.add({
      targets: boss,
      alpha: 0,
      scaleX: boss.scaleX * 1.2,
      scaleY: boss.scaleY * 0.6,
      duration: 950,
      onComplete: () => {
        if (boss.active) {
          boss.destroy();
        }
        this.bossBlob = null;
      }
    });

    const living = this.enemies.getChildren() as Enemy[];
    for (const enemy of living) {
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.enable = false;
      this.spawnGeomBurst(enemy.x, enemy.y, 8, [0xffb0b0, 0xff8f8f, 0xd45a5a]);
      this.tweens.add({
        targets: enemy,
        alpha: 0,
        duration: Phaser.Math.Between(500, 900),
        onComplete: () => {
          if (enemy.active) {
            enemy.destroy();
          }
        }
      });
    }

    const puddles = this.puddles.getChildren() as Phaser.GameObjects.Ellipse[];
    for (const puddle of puddles) {
      this.tweens.add({
        targets: puddle,
        alpha: 0,
        duration: 350,
        onComplete: () => puddle.destroy()
      });
    }

    this.time.delayedCall(1000, () => {
      if (this.state !== 'playing') {
        return;
      }
      this.enterLevel2StartRoom();
    });
  }

  private spawnGeomBurst(x: number, y: number, count: number, colors: number[]): void {
    for (let i = 0; i < count; i += 1) {
      const size = Phaser.Math.Between(4, 11);
      const piece = this.add.rectangle(x, y, size, size, colors[i % colors.length], 0.95);
      piece.setDepth(62);
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.24, 0.24);
      const speed = Phaser.Math.Between(70, 240);
      this.tweens.add({
        targets: piece,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        angle: Phaser.Math.Between(-260, 260),
        alpha: 0,
        duration: Phaser.Math.Between(420, 980),
        onComplete: () => piece.destroy()
      });
    }
  }

  private spawnBossChunks(count: number): void {
    if (!this.bossBlob) {
      return;
    }

    const blockers = [...this.setup.walls, ...this.setup.obstacles];
    const center = new Phaser.Math.Vector2(this.bossBlob.x, this.bossBlob.y);
    const baseAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const step = (Math.PI * 2) / Math.max(1, count);

    for (let i = 0; i < count; i += 1) {
      const launchAngle = baseAngle + step * i + Phaser.Math.FloatBetween(-0.38, 0.38);
      let placed = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const angle = launchAngle + Phaser.Math.FloatBetween(-0.12, 0.12);
        const dist = Phaser.Math.Between(46, 96);
        const x = Phaser.Math.Clamp(center.x + Math.cos(angle) * dist, 40, this.roomSize.width - 40);
        const y = Phaser.Math.Clamp(center.y + Math.sin(angle) * dist, 40, this.roomSize.height - 40);

        const rect = { x, y, width: 22, height: 22 };
        if (blockers.some((blocker) => intersectsRect(rect, blocker))) {
          continue;
        }

        const chunk = new Enemy(this, x, y, 'red');
        chunk.setScale(0.72);
        chunk.startBallistic(new Phaser.Math.Vector2(Math.cos(launchAngle), Math.sin(launchAngle)), 130);
        const chunkBody = chunk.body as Phaser.Physics.Arcade.Body;
        chunkBody.setSize(chunk.width * 0.72, chunk.height * 0.72, true);
        chunk.startShock(this.time.now, 180);
        this.enemies.add(chunk);
        placed = true;
        break;
      }

      if (!placed) {
        const chunk = new Enemy(this, center.x, center.y, 'red');
        chunk.setScale(0.72);
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        chunk.startBallistic(new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)), 130);
        const chunkBody = chunk.body as Phaser.Physics.Arcade.Body;
        chunkBody.setSize(chunk.width * 0.72, chunk.height * 0.72, true);
        chunk.startShock(this.time.now, 180);
        this.enemies.add(chunk);
      }
    }
  }

  private startBossTelegraph(): void {
    if (!this.bossBlob) {
      return;
    }
    const bossBody = this.bossBlob.body as Phaser.Physics.Arcade.Body;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const start = bossBody.center.clone();
    this.bossTelegraphTarget = playerBody.center.clone();
    const dir = this.bossTelegraphTarget.clone().subtract(start);
    if (dir.lengthSq() < 0.0001) {
      dir.set(0, 1);
    } else {
      dir.normalize();
    }
    this.bossTelegraphDir = dir;
  }

  private drawBossArrow(): void {
    if (!this.bossBlob || !this.bossArrow) {
      return;
    }
    const bossBody = this.bossBlob.body as Phaser.Physics.Arcade.Body;
    const start = bossBody.center.clone();
    const target = this.bossTelegraphTarget.clone();
    const dir = this.bossTelegraphDir.clone().normalize();
    const pulse = Math.sin(this.time.now / 90) * 0.25 + 0.75;

    this.bossArrow.clear();
    this.bossArrow.lineStyle(5, 0xff2c2c, pulse);
    this.bossArrow.lineBetween(start.x, start.y, target.x, target.y);
    this.bossArrow.fillStyle(0xff2c2c, pulse);
    this.bossArrow.fillCircle(target.x, target.y, 11);
    this.bossArrow.lineStyle(2, 0xff9a9a, pulse);
    this.bossArrow.strokeCircle(target.x, target.y, 14);

    const perp = new Phaser.Math.Vector2(-dir.y, dir.x).scale(10);
    const tip = target.clone();
    this.bossArrow.fillPoints([
      { x: tip.x, y: tip.y },
      { x: tip.x - dir.x * 24 + perp.x, y: tip.y - dir.y * 24 + perp.y },
      { x: tip.x - dir.x * 24 - perp.x, y: tip.y - dir.y * 24 - perp.y }
    ]);
  }

  private startMusic(): void {
    this.stopMusic();
    this.sound.mute = !this.musicEnabled;
    if (this.cache.audio.exists('dungeon-theme')) {
      this.music = this.sound.add('dungeon-theme', { loop: true, volume: 0.25 });
      if (this.musicEnabled) {
        this.music.play();
      }
      return;
    }

    if (this.musicLoading) {
      return;
    }

    this.musicLoading = true;
    this.load.audio('dungeon-theme', 'audio/dungeon_theme.mp3');
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.musicLoading = false;
      if (!this.scene.isActive()) {
        return;
      }
      this.music = this.sound.add('dungeon-theme', { loop: true, volume: 0.25 });
      if (this.musicEnabled) {
        this.music.play();
      }
    });
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      this.musicLoading = false;
    });
    this.load.start();
  }

  private stopMusic(): void {
    if (!this.music) {
      return;
    }

    this.music.stop();
    this.music.destroy();
    this.music = null;
  }

  private toggleMusic(): void {
    this.musicEnabled = !this.musicEnabled;
    this.sound.mute = !this.musicEnabled;
    this.updateDebug();
  }

  private triggerLose(): void {
    if (this.state !== 'playing') {
      return;
    }

    this.state = 'lost';
    this.stopMusic();

    const enemies = this.enemies.getChildren() as Enemy[];
    for (const enemy of enemies) {
      enemy.freeze();
    }
    const bossBody = this.bossBlob?.body as Phaser.Physics.Arcade.Body | undefined;
    bossBody?.setVelocity(0, 0);
    this.bossArrow?.clear();

    this.player.playDead();
    this.playDeathExplosion(this.player.x, this.player.y);
    this.time.delayedCall(520, () => {
      this.ui.showResult(false);
    });
    this.updateDebug();
  }

  private updateDebug(): void {
    const count = (this.enemies?.getLength?.() ?? 0) + (this.bossBlob ? 1 : 0);
    this.ui.setOpeningPromptVisible(!this.level2Started && this.currentRoom === 0 && this.state === 'playing');
    this.ui.setDebug(
      this.currentRoom,
      this.setup?.entrance?.side ?? null,
      this.setup?.exit?.side ?? null,
      count,
      this.bossBlob ? `boss-${this.bossPhase}` : this.shockStatus,
      this.musicEnabled && this.music !== null
    );
  }

  private renderDebugBodies(): void {
    if (!this.debugGraphics || !this.debugBodiesEnabled) {
      return;
    }

    this.debugGraphics.clear();
    this.debugGraphics.lineStyle(1, 0xff3b3b, 1);

    const playerBody = this.player.body;
    this.debugGraphics.strokeRect(playerBody.x, playerBody.y, playerBody.width, playerBody.height);

    const enemies = this.enemies.getChildren() as Enemy[];
    this.debugGraphics.lineStyle(1, 0xff3b3b, 1);
    for (const enemy of enemies) {
      const body = enemy.body;
      this.debugGraphics.strokeRect(body.x, body.y, body.width, body.height);
    }

    if (this.bossBlob) {
      const body = this.bossBlob.body as Phaser.Physics.Arcade.Body;
      this.debugGraphics.lineStyle(1, 0xff2c2c, 1);
      this.debugGraphics.strokeRect(body.x, body.y, body.width, body.height);
    }
  }

  private playDeathExplosion(x: number, y: number): void {
    this.cameras.main.shake(280, 0.015);
    this.tweens.add({
      targets: this.player,
      angle: { from: -16, to: 16 },
      duration: 70,
      yoyo: true,
      repeat: 3
    });

    for (let i = 0; i < 22; i += 1) {
      const shard = this.add.rectangle(x, y, 8, 8, i % 2 === 0 ? 0xff8c8c : 0xffd0d0, 0.95);
      shard.setDepth(60);
      const angle = (Math.PI * 2 * i) / 22 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const speed = Phaser.Math.Between(110, 250);
      const tx = x + Math.cos(angle) * speed;
      const ty = y + Math.sin(angle) * speed;
      this.tweens.add({
        targets: shard,
        x: tx,
        y: ty,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(260, 420),
        onComplete: () => shard.destroy()
      });
    }

    const flash = this.add.circle(x, y, 12, 0xffffff, 0.75);
    flash.setDepth(61);
    this.tweens.add({
      targets: flash,
      radius: 110,
      alpha: 0,
      duration: 240,
      onComplete: () => flash.destroy()
    });
  }

  private forceRestart(): void {
    window.location.reload();
  }

  private handleOverlayRestartClick(): void {
    if (this.state === 'playing') {
      return;
    }
    this.forceRestart();
  }
}
