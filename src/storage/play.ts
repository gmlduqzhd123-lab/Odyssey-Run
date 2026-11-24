import {STAGES, type StageId} from '../levels/courses';
import {VARIANTS, courseKey} from '../levels/course-ids';
import {MAX_COMBO, MAX_COMBO_POINTS, type BlessingId} from '../levels/play-extras';
// What the playful extras leave behind in a sailor's record: the best combo and combo points on
// each island, the hidden chests found (one per course) and how many O/X gates were answered right.
export interface ComboRecord {
  best: number;
  points: number;
}
export interface PlayRecord {
  combos: Partial<Record<StageId, ComboRecord>>;
  // Course keys (island/course) whose chest was found, in course order.
  treasures: string[];
  gates: number;
}
export interface RunExtras {
  combo: number;
  comboPoints: number;
  blessing: BlessingId;
  treasure?: string;
  gate?: {quiz: string; right: boolean};
}
export const MAX_GATES = 100_000;
export const TREASURE_KEYS: readonly string[] = STAGES.flatMap(s => VARIANTS.map(v => courseKey(s, v)));
export const emptyPlay = (): PlayRecord => ({combos: {}, treasures: [], gates: 0});
const whole = (v: unknown, max: number) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
export function readPlay(v: unknown): PlayRecord {
  if (v === undefined) return emptyPlay();
  const p = v as Record<string, unknown>;
  const fail = () => {
    throw Error('콤보·보물 기록을 확인해 주세요.');
  };
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail();
  const combos = p.combos as Record<string, unknown>;
  if (!combos || typeof combos !== 'object' || Array.isArray(combos)) fail();
  const out = emptyPlay();
  for (const [id, raw] of Object.entries(combos)) {
    const c = raw as Record<string, unknown>;
    if (!STAGES.includes(id as StageId) || !c || typeof c !== 'object') fail();
    if (!whole(c.best, MAX_COMBO) || !whole(c.points, MAX_COMBO_POINTS)) fail();
    out.combos[id as StageId] = {best: c.best as number, points: c.points as number};
  }
  if (
    !Array.isArray(p.treasures) ||
    p.treasures.some(k => !TREASURE_KEYS.includes(k as string)) ||
    new Set(p.treasures).size !== p.treasures.length
  )
    fail();
  out.treasures = TREASURE_KEYS.filter(k => (p.treasures as string[]).includes(k));
  if (!whole(p.gates, MAX_GATES)) fail();
  out.gates = p.gates as number;
  return out;
}
// A finished run's extras folded into the record.
export function playRun(play: PlayRecord, stage: StageId, x: RunExtras | undefined) {
  if (!x) return;
  const now = play.combos[stage] ?? {best: 0, points: 0};
  if (x.combo || x.comboPoints)
    play.combos[stage] = {best: Math.max(now.best, x.combo), points: Math.max(now.points, x.comboPoints)};
  if (x.treasure && TREASURE_KEYS.includes(x.treasure) && !play.treasures.includes(x.treasure))
    play.treasures = TREASURE_KEYS.filter(k => k === x.treasure || play.treasures.includes(k));
  if (x.gate?.right) play.gates = Math.min(MAX_GATES, play.gates + 1);
}
export function mergePlay(a: PlayRecord, b: PlayRecord): PlayRecord {
  const out = emptyPlay();
  for (const id of STAGES) {
    const x = a.combos[id],
      y = b.combos[id];
    if (x || y)
      out.combos[id] = {best: Math.max(x?.best ?? 0, y?.best ?? 0), points: Math.max(x?.points ?? 0, y?.points ?? 0)};
  }
  out.treasures = TREASURE_KEYS.filter(k => a.treasures.includes(k) || b.treasures.includes(k));
  out.gates = Math.max(a.gates, b.gates);
  return out;
}
