import './style.css';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

function boot(): void {
  document.body.classList.add('booting');

  const hideBootLoading = (): void => {
    document.body.classList.remove('booting');
    const loader = document.getElementById('boot-loading');
    loader?.remove();
  };

  window.addEventListener('dungeon-ready', hideBootLoading, { once: true });
  window.setTimeout(hideBootLoading, 8000);

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
