import {SAVE_KEY} from './save';
import {STAGES, type StageId} from '../levels/courses';
import {isBlocks} from '../levels/maker';
import {cleanName} from './profiles';
// The class course gallery on the teacher's device: courses students sent by link or QR, with a
// simple show-of-hands vote count. Kept apart from every sailor's save.
export const GALLERY_KEY = SAVE_KEY + ':gallery';
export const MAX_GALLERY = 40;
export interface GalleryCourse {
  stage: StageId;
  blocks: string;
  title: string;
  votes: number;
}
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export function readGallery(raw: string | null): GalleryCourse[] {
  const out: GalleryCourse[] = [];
  try {
    const v = JSON.parse(raw ?? '[]');
    for (const c of Array.isArray(v) ? v.slice(0, MAX_GALLERY) : [])
      if (
        c &&
        STAGES.includes(c.stage) &&
        typeof c.blocks === 'string' &&
        isBlocks(c.blocks) &&
        !out.some(o => o.stage === c.stage && o.blocks === c.blocks)
      )
        out.push({
          stage: c.stage,
          blocks: c.blocks,
          title: (typeof c.title === 'string' && cleanName(c.title).slice(0, 12)) || '나만의 코스',
          votes: Number.isSafeInteger(c.votes) && c.votes >= 0 && c.votes <= 999 ? c.votes : 0,
        });
  } catch {}
  return out;
}
export class Gallery {
  list: GalleryCourse[];
  constructor(private storage: Store | null) {
    let raw: string | null = null;
    try {
      raw = storage?.getItem(GALLERY_KEY) ?? null;
    } catch {}
    this.list = readGallery(raw);
  }
  private save() {
    try {
      this.storage?.setItem(GALLERY_KEY, JSON.stringify(this.list));
    } catch {}
  }
  // The same course sent twice is kept once. Returns false when the gallery is full.
  add(c: Omit<GalleryCourse, 'votes'>) {
    if (this.list.some(o => o.stage === c.stage && o.blocks === c.blocks)) return true;
    if (this.list.length >= MAX_GALLERY) return false;
    this.list.push({...c, title: cleanName(c.title).slice(0, 12) || '나만의 코스', votes: 0});
    this.save();
    return true;
  }
  vote(i: number, delta: 1 | -1) {
    const c = this.list[i];
    if (!c) return;
    c.votes = Math.max(0, Math.min(999, c.votes + delta));
    this.save();
  }
  remove(i: number) {
    this.list.splice(i, 1);
    this.save();
  }
  ranked() {
    return this.list.map((c, i) => ({...c, index: i})).sort((a, b) => b.votes - a.votes || a.index - b.index);
  }
}
