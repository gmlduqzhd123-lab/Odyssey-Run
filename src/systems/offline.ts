import type {StageId} from '../levels/courses';
export class Offline {
  registration: ServiceWorkerRegistration | null = null;
  ready: Partial<Record<StageId, boolean>> = {};
  bytes: Partial<Record<StageId, number>> = {};
  progress = 0;
  downloading: StageId | null = null;
  message = '';
  version = '';
  available = false;
  waiting = false;
  private abort = new AbortController();
  private applying = false;
  private disposed = false;
  constructor(
    private busy: () => boolean,
    private changed: () => void,
  ) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener(
      'message',
      e => {
        if (e.data?.type === 'ODYSSEY_CAN_UPDATE') e.ports[0]?.postMessage({idle: !this.busy()});
      },
      {signal: this.abort.signal},
    );
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        if (this.applying) location.reload();
        else void this.refresh();
      },
      {signal: this.abort.signal},
    );
    window.addEventListener(
      'online',
      () => {
        void this.refresh();
      },
      {signal: this.abort.signal},
    );
    window.addEventListener('offline', () => this.changed(), {signal: this.abort.signal});
    void this.init();
  }
  private async init() {
    if (!import.meta.env.PROD) return;
    try {
      this.registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        updateViaCache: 'none',
      });
      if (this.disposed) return;
      const reg = this.registration;
      const watch = () => {
        this.waiting = !!reg.waiting;
        this.changed();
      };
      reg.addEventListener(
        'updatefound',
        () => {
          reg.installing?.addEventListener('statechange', watch, {signal: this.abort.signal});
          watch();
        },
        {signal: this.abort.signal},
      );
      watch();
      await navigator.serviceWorker.ready;
      if (this.disposed) return;
      await this.refresh();
    } catch {
      this.message = '오프라인 준비를 사용할 수 없어요. 온라인으로 플레이할 수 있어요.';
      this.changed();
    }
  }
  private request(worker: ServiceWorker, data: object, progress?: (n: number) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      let timer: ReturnType<typeof setTimeout>;
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(
          () => {
            channel.port1.close();
            reject(Error('응답이 늦어요. 연결을 확인한 뒤 다시 시도해 주세요.'));
          },
          (data as {type?: string}).type === 'STATUS' ? 5000 : 45000,
        );
      };
      reset();
      channel.port1.onmessage = e => {
        reset();
        if (e.data.type === 'PROGRESS') {
          progress?.(e.data.progress);
          return;
        }
        clearTimeout(timer);
        channel.port1.close();
        if (e.data.type === 'ERROR') reject(Error(e.data.message));
        else resolve(e.data);
      };
      worker.postMessage(data, [channel.port2]);
    });
  }
  async refresh() {
    const worker = this.registration?.active;
    if (!worker) return;
    try {
      const r = await this.request(worker, {type: 'STATUS'});
      this.ready = r.ready;
      this.bytes = r.bytes;
      this.version = r.version;
      this.available = true;
      this.waiting = !!this.registration?.waiting;
      this.changed();
    } catch {
      this.available = false;
      this.message = '오프라인 준비 중이에요. 잠시 후 다시 확인해 주세요.';
      this.changed();
    }
  }
  async download(stage: StageId) {
    if (this.downloading || !this.registration?.active) return;
    this.downloading = stage;
    this.progress = 0;
    this.message = '';
    this.changed();
    try {
      await this.request(this.registration.active, {type: 'DOWNLOAD_STAGE', stage}, n => {
        this.progress = n;
        this.changed();
      });
      this.message = '섬 다운로드를 완료했어요. 오프라인에서도 시작할 수 있어요.';
    } catch (e) {
      this.message = (e as Error).message;
    } finally {
      this.downloading = null;
      await this.refresh();
    }
  }
  async update() {
    if (this.busy() || this.downloading) {
      this.message = '항해와 다운로드를 끝낸 뒤 업데이트할 수 있어요.';
      this.changed();
      return;
    }
    const worker = this.registration?.waiting;
    if (!worker) {
      try {
        await this.registration?.update();
        await this.refresh();
      } catch {
        this.message = '연결 후 다시 업데이트를 확인해 주세요.';
        this.changed();
      }
      return;
    }
    try {
      this.applying = true;
      await this.request(worker, {type: 'APPLY_UPDATE'});
    } catch (e) {
      this.applying = false;
      this.message = (e as Error).message;
      this.changed();
    }
  }
  destroy() {
    this.disposed = true;
    this.abort.abort();
  }
}
