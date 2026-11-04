import Phaser from 'phaser';
import {World, type SceneHost} from '../scenes/World';
import type {DisplayViewport} from './display';
// The lower half of the screen when two sailors run at once: its own Phaser game and World
// scene in #game2, made the first time it is needed and put to sleep when the split ends.
export class SplitScreen {
  private game: Phaser.Game | null = null;
  private scene: World | null = null;
  private ready: Promise<World> | null = null;
  constructor(
    private host: Omit<SceneHost, 'frame' | 'loaded' | 'loadError' | 'ghost'>,
    private size: () => {view: DisplayViewport; density: number},
  ) {}
  get world() {
    return this.scene;
  }
  // Resolves once the second scene has booted (it then still has to prepare the island).
  open(): Promise<World> {
    if (this.ready) return this.ready;
    // The canvas box must be visible before Phaser measures it.
    this.show(true);
    this.ready = new Promise<World>((resolve, reject) => {
      const world = new World({
        ...this.host,
        frame: () => {},
        loaded: () => resolve(world),
        loadError: () => reject(Error('두 번째 화면을 준비하지 못했어요.')),
        ghost: () => null,
      });
      this.scene = world;
      const {view, density} = this.size();
      this.game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: 'game2',
        width: Math.round(view.width * density),
        height: Math.round(view.height * density),
        backgroundColor: '#102f46',
        scene: world,
        scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
        render: {antialias: true, roundPixels: false, clearBeforeRender: false},
        audio: {noAudio: true},
        fps: {smoothStep: false, target: 60},
        banner: false,
      });
    });
    // A failed boot can be tried again.
    this.ready.catch(() => (this.ready = null));
    return this.ready;
  }
  // Shows or hides the split; the idle second canvas stops drawing.
  show(on: boolean) {
    const app = document.querySelector<HTMLElement>('#app');
    if (app) {
      if (on) app.dataset.duo = 'true';
      else delete app.dataset.duo;
    }
    if (!this.game?.isBooted) return;
    if (on) this.game.loop.wake();
    else {
      this.scene?.showHome();
      this.game.loop.sleep();
    }
  }
  resize() {
    if (!this.game?.isBooted) return;
    const {view, density} = this.size();
    this.game.scale.setGameSize(Math.round(view.width * density), Math.round(view.height * density));
    this.game.scale.refresh();
    this.scene?.syncDisplay();
  }
  destroy() {
    this.game?.destroy(true);
  }
}
