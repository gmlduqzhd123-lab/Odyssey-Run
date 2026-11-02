// Reads a story aloud with the device's own voices (Web Speech API; nothing is sent anywhere by
// this game) and underlines the sentence being read, so the text doubles as subtitles.
export const canNarrate = () =>
  typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
// Sentence ends in Korean, English, Vietnamese, Russian and Chinese text.
export function sentences(text: string) {
  return (text.match(/[^.!?。！？…]+[.!?。！？…]*["”’」』)]*\s*/g) ?? [])
    .map(s => s.trim())
    .filter(s => /[\p{L}\p{N}]/u.test(s));
}
export class Narrator {
  private queue: HTMLElement[] = [];
  private originals = new Map<HTMLElement, string>();
  private run = 0;
  constructor(private onChange: (reading: boolean) => void = () => {}) {}
  get reading() {
    return this.queue.length > 0;
  }
  // Splits each block into sentence spans and reads them in order.
  read(blocks: HTMLElement[]) {
    this.stop();
    if (!canNarrate() || !blocks.length) return false;
    const id = ++this.run,
      lang = document.documentElement.lang || 'ko',
      voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    for (const block of blocks) {
      const text = block.textContent ?? '';
      this.originals.set(block, block.innerHTML);
      block.innerHTML = '';
      for (const s of sentences(text)) {
        const span = document.createElement('span');
        span.className = 'say';
        span.textContent = s + ' ';
        block.append(span);
        this.queue.push(span);
      }
    }
    const next = () => {
      if (id !== this.run) return;
      const span = this.queue.shift();
      document.querySelectorAll('.say.speaking').forEach(e => e.classList.remove('speaking'));
      if (!span) {
        this.stop();
        return;
      }
      span.classList.add('speaking');
      const u = new SpeechSynthesisUtterance(span.textContent ?? '');
      u.lang = lang;
      u.rate = 0.95;
      if (voice) u.voice = voice;
      u.onend = next;
      u.onerror = next;
      speechSynthesis.speak(u);
    };
    this.onChange(true);
    next();
    return true;
  }
  stop() {
    const was = this.queue.length > 0 || this.originals.size > 0;
    this.run++;
    this.queue = [];
    if (canNarrate()) speechSynthesis.cancel();
    for (const [block, html] of this.originals) if (block.isConnected) block.innerHTML = html;
    this.originals.clear();
    if (was) this.onChange(false);
  }
}
