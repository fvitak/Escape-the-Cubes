import './style.css';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

function boot(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: 960,
    height: 640,
    backgroundColor: '#0d0f14',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 640
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [new GameScene()]
  });

  void game;
}

boot();
