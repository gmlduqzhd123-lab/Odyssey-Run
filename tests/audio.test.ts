import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as flush} from 'node:timers/promises';
import {Sound} from '../src/systems/audio';
import {MUSIC} from '../src/assets/music';
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return {promise, resolve};
};
class Source {
  buffer: any;
  loop = false;
  onended: (() => void) | null = null;
  stopped = false;
  offset = -1;
  connect() {}
  disconnect() {}
  start(_time: number, offset: number) {
    this.offset = offset;
  }
  stop() {
    this.stopped = true;
    this.onended?.();
  }
}
class Context {
  static instances: Context[] = [];
  state = 'running';
  currentTime = 0;
  destination = {};
  sources: Source[] = [];
  effects = 0;
  decode: (b: ArrayBuffer) => Promise<any> = async b => ({duration: 100, tag: new Uint8Array(b)[0]});
  constructor() {
    Context.instances.push(this);
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  decodeAudioData(b: ArrayBuffer) {
    return this.decode(b);
  }
  createBufferSource() {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
  createGain() {
    return {gain: {value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}}, connect() {}, disconnect() {}};
  }
  createOscillator() {
    this.effects++;
    return {
      type: 'sine',
      frequency: {setValueAtTime() {}, exponentialRampToValueAtTime() {}},
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
      onended: null,
    };
  }
}
async function setup(
  run: (
    s: Sound,
    c: Context,
    settings: {music: boolean; sfx: boolean; reducedMotion: boolean},
    requests: string[],
  ) => Promise<void>,
  fetcher?: (url: string) => Promise<Response>,
) {
  const originalCtx = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext'),
    originalFetch = globalThis.fetch;
  Context.instances = [];
  const requests: string[] = [];
  Object.defineProperty(globalThis, 'AudioContext', {value: Context, configurable: true});
  globalThis.fetch = (async u => {
    const url = String(u);
    requests.push(url);
    return fetcher
      ? fetcher(url)
      : new Response(new Uint8Array([url.includes('beach') ? 1 : url.includes('cave') ? 2 : 3]));
  }) as typeof fetch;
  const settings = {music: true, sfx: true, reducedMotion: false},
    sound = new Sound(() => settings);
  sound.unlock();
  try {
    await run(sound, Context.instances[0], settings, requests);
  } finally {
    sound.destroy();
    globalThis.fetch = originalFetch;
    if (originalCtx) Object.defineProperty(globalThis, 'AudioContext', originalCtx);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
}
const settle = async () => {
  await flush();
  await flush();
};
test('three user tracks are selected by island, with only one active source', async () => {
  await setup(async (s, c, _, requests) => {
    for (const [stage, tag] of [
      ['beach', 1],
      ['cave', 2],
      ['wind', 3],
    ] as const) {
      s.setStage(stage);
      s.setPlaying(true);
      await settle();
      assert.equal(c.sources.at(-1)!.buffer.tag, tag);
      assert.ok(c.sources.at(-1)!.loop);
      assert.equal(c.sources.filter(x => !x.stopped).length, 1);
      assert.ok(requests.at(-1)!.endsWith(MUSIC[stage].file));
    }
    assert.equal(requests.length, 3);
  });
});
test('pause and mute preserve position; restart resets and reuses the selected buffer', async () => {
  await setup(async (s, c, settings, requests) => {
    s.setStage('beach');
    s.setPlaying(true);
    await settle();
    c.currentTime = 3;
    s.setPlaying(false);
    c.currentTime = 30;
    s.setPlaying(true);
    assert.equal(c.sources.at(-1)!.offset, 3);
    c.currentTime = 32;
    settings.music = false;
    s.changed();
    s.effect('jump');
    assert.equal(c.effects, 1);
    assert.ok(c.sources.at(-1)!.stopped);
    c.currentTime = 60;
    settings.music = true;
    s.changed();
    assert.equal(c.sources.at(-1)!.offset, 5);
    s.setPlaying(false);
    s.setStage('beach', true);
    s.setPlaying(true);
    assert.equal(c.sources.at(-1)!.offset, 0);
    assert.equal(requests.length, 1);
  });
});
test('late fetch cannot start a previously selected island', async () => {
  const wait = deferred<Response>();
  await setup(
    async (s, c) => {
      s.setStage('beach');
      s.setPlaying(true);
      s.setStage('cave');
      await settle();
      wait.resolve(new Response(new Uint8Array([1])));
      await settle();
      assert.deepEqual(
        c.sources.map(x => x.buffer.tag),
        [2],
      );
    },
    async url => (url.includes('beach') ? wait.promise : new Response(new Uint8Array([2]))),
  );
});
test('stale decode is serialized and discarded during rapid stage changes', async () => {
  await setup(async (s, c) => {
    const wait = deferred<any>();
    const seen: number[] = [];
    c.decode = async b => {
      const tag = new Uint8Array(b)[0];
      seen.push(tag);
      return tag === 1 ? wait.promise : {duration: 100, tag};
    };
    s.setStage('beach');
    s.setPlaying(true);
    await settle();
    s.setStage('cave');
    await settle();
    assert.deepEqual(seen, [1]);
    wait.resolve({duration: 100, tag: 1});
    await settle();
    assert.deepEqual(
      c.sources.map(x => x.buffer.tag),
      [2],
    );
  });
});
test('failed audio stays silent without retrying every frame; next run retries', async () => {
  let failed = true;
  await setup(
    async (s, c, _, requests) => {
      s.setStage('beach');
      s.setPlaying(true);
      await settle();
      for (let i = 0; i < 20; i++) s.update();
      assert.equal(requests.length, 1);
      assert.equal(c.sources.length, 0);
      failed = false;
      s.setPlaying(false);
      s.setStage('beach', true);
      s.setPlaying(true);
      await settle();
      assert.equal(c.sources.length, 1);
    },
    async () => (failed ? new Response('', {status: 404}) : new Response(new Uint8Array([1]))),
  );
});
test('muted music never downloads, and destruction cancels late activation', async () => {
  const wait = deferred<Response>();
  await setup(
    async (s, c, settings, requests) => {
      settings.music = false;
      s.setStage('wind');
      s.setPlaying(true);
      await settle();
      assert.equal(requests.length, 0);
      settings.music = true;
      s.changed();
      assert.equal(requests.length, 1);
      s.destroy();
      wait.resolve(new Response(new Uint8Array([3])));
      await settle();
      assert.equal(c.sources.length, 0);
      assert.equal(c.state, 'closed');
    },
    async () => wait.promise,
  );
});
