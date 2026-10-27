// Continuous QR scanning for the contest board. The browser's BarcodeDetector is used when it
// exists; otherwise jsQR is loaded on demand, so the game itself never pays for it.
type Detect = (source: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>;
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{rawValue: string}[]>;
}
async function detector(): Promise<Detect> {
  const Native = (globalThis as unknown as {BarcodeDetector?: new (o: object) => BarcodeDetectorLike}).BarcodeDetector;
  if (Native) {
    try {
      const d = new Native({formats: ['qr_code']});
      return async video => (await d.detect(video))[0]?.rawValue ?? null;
    } catch {}
  }
  const {default: jsQR} = await import('jsqr');
  return async (video, canvas) => {
    const w = video.videoWidth,
      h = video.videoHeight;
    if (!w || !h) return null;
    // Scan a downscaled frame; QR codes on a phone screen stay readable at 480px.
    const scale = Math.min(1, 480 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, {inversionAttempts: 'dontInvert'})?.data ?? null;
  };
}
export class Scanner {
  private stream: MediaStream | null = null;
  private timer = 0;
  private stopped = false;
  private recent = new Map<string, number>();
  constructor(
    private video: HTMLVideoElement,
    private onCode: (text: string) => void,
  ) {}
  async start() {
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error('이 브라우저에서는 카메라를 쓸 수 없어요. 결과 코드를 붙여 넣어 주세요.');
    const detect = await detector();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}, audio: false});
    } catch {
      throw Error('카메라를 켜지 못했어요. 브라우저의 카메라 권한을 확인해 주세요.');
    }
    if (this.stopped) return this.stop();
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    await this.video.play().catch(() => {});
    const canvas = document.createElement('canvas');
    const tick = async () => {
      if (this.stopped) return;
      try {
        const text = await detect(this.video, canvas);
        const now = Date.now();
        // The same code stays in view for a while; report it once every few seconds at most.
        if (text && now - (this.recent.get(text) ?? 0) > 4000) {
          this.recent.set(text, now);
          this.onCode(text);
        }
      } catch {}
      if (!this.stopped) this.timer = window.setTimeout(tick, 250);
    };
    void tick();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
// Excel opens UTF-8 with a BOM correctly; cells that start like a formula are neutralized.
export function toCsv(rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
