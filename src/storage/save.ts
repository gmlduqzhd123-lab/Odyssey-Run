import {cosmeticUnlocked} from '../systems/cosmetics';
import {emptyExpeditions, readExpeditions, type Expeditions} from './expeditions';
import {defaultPreferences, readPreferences, type Preferences} from './preferences';
import {emptyJournal, validateJournal, validateGhost, type Ghost, type Journal, type AdventureResult} from './journal';
import {MAX_SCORE} from '../config';
import {quizIds} from '../levels/quiz';
import {endlessLength, ENDLESS_SECTIONS} from '../levels/endless';
import {STAGES, type StageId} from '../levels/courses';
import {VARIANTS, courseKey, isVariant, type CourseKey, type VariantId} from '../levels/course-ids';
export interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
}
export interface RecordData {
  complete: boolean;
  bestScore: number;
  bestRating: number;
  bestStars: number;
  maps: string[];
}
export interface CourseRecord extends RecordData {
  ghost?: Ghost;
}
export interface Save {
  schemaVersion: 1;
  contentVersion: 1;
  settings: Settings;
  preferences: Preferences;
  expeditions: Expeditions;
  tutorialSeen: boolean;
  lastStage: StageId;
  stages: Record<StageId, RecordData>;
  savedAt: string;
  journal: Journal;
  courses: Partial<Record<CourseKey, CourseRecord>>;
  // Myth questions answered correctly at least once.
  quiz: string[];
  // Endless voyage bests, kept apart from course records and unlocks.
  endless: Partial<Record<StageId, EndlessRecord>>;
}
export interface EndlessRecord {
  bestScore: number;
  bestDistance: number;
}
export const SAVE_KEY = `odyssey-run:${new URL(import.meta.env?.BASE_URL || './', typeof location === 'undefined' ? 'http://local/' : location.href).pathname}:save`;
export const BACKUP_KEY = SAVE_KEY + ':backup';
const LATER_STAGES: readonly StageId[] = ['sea'];
const emptyRecord = (): RecordData => ({complete: false, bestScore: 0, bestRating: 0, bestStars: 0, maps: []});
export const emptySave = (): Save => ({
  schemaVersion: 1,
  contentVersion: 1,
  settings: {music: true, sfx: true, reducedMotion: false},
  preferences: defaultPreferences(),
  expeditions: emptyExpeditions(),
  tutorialSeen: false,
  lastStage: 'beach',
  stages: {beach: emptyRecord(), cave: emptyRecord(), wind: emptyRecord(), sea: emptyRecord()},
  savedAt: new Date().toISOString(),
  journal: emptyJournal(),
  courses: {},
  quiz: [],
  endless: {},
});
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('기록 형식을 확인해 주세요.');
  return v as Record<string, unknown>;
};
const bool = (v: unknown) => {
  if (typeof v !== 'boolean') throw Error('설정과 완료 여부가 올바르지 않아요.');
  return v;
};
const integer = (v: unknown, max: number) => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max)
    throw Error('점수·별빛·평점 범위를 확인해 주세요.');
  return v;
};
function readRecord(raw: unknown, id: StageId): RecordData {
  const r = obj(raw),
    complete = bool(r.complete);
  if (
    !Array.isArray(r.maps) ||
    r.maps.length > 3 ||
    new Set(r.maps).size !== r.maps.length ||
    r.maps.some(m => typeof m !== 'string' || ![1, 2, 3].map(n => `${id}-map-${n}`).includes(m))
  )
    throw Error('지도 조각 ID 또는 중복을 확인해 주세요.');
  const record = {
    complete,
    bestScore: integer(r.bestScore, MAX_SCORE),
    bestRating: integer(r.bestRating, 3),
    bestStars: integer(r.bestStars, 100),
    maps: [...r.maps] as string[],
  };
  if (
    (complete && record.bestRating < 1) ||
    (!complete && record.bestRating !== 0) ||
    (complete && record.bestScore < 2900) ||
    (!complete && record.bestScore > MAX_SCORE - 500)
  )
    throw Error('완주 기록과 점수가 맞지 않아요.');
  if (record.bestRating === 3 && record.bestStars < 70) throw Error('최고 평점과 별빛 기록이 맞지 않아요.');
  return record;
}
export function validateSave(raw: unknown): Save {
  const v = obj(raw);
  if (v.schemaVersion !== 1 || v.contentVersion !== 1)
    throw Error('지원하지 않는 기록 버전이에요. 원본 파일을 보관해 주세요.');
  const s = obj(v.settings);
  const stages = obj(v.stages);
  const out = emptySave();
  if (Object.keys(stages).some(id => !STAGES.includes(id as StageId))) throw Error('알 수 없는 섬이 포함돼 있어요.');
  out.settings = {music: bool(s.music), sfx: bool(s.sfx), reducedMotion: bool(s.reducedMotion)};
  out.preferences = readPreferences(v.preferences);
  out.expeditions = readExpeditions(v.expeditions);
  out.tutorialSeen = bool(v.tutorialSeen);
  if (!STAGES.includes(v.lastStage as StageId)) throw Error('최근 섬 정보가 올바르지 않아요.');
  out.lastStage = v.lastStage as StageId;
  if (typeof v.savedAt !== 'string' || v.savedAt.length > 40 || !Number.isFinite(Date.parse(v.savedAt)))
    throw Error('저장 시각이 올바르지 않아요.');
  out.savedAt = v.savedAt;
  STAGES.forEach((id, i) => {
    // Islands added after a save was written start empty instead of rejecting the save.
    const record = stages[id] === undefined && LATER_STAGES.includes(id) ? emptyRecord() : readRecord(stages[id], id);
    if (
      i > 0 &&
      (record.complete || record.bestScore > 0 || record.bestStars > 0 || record.maps.length > 0) &&
      !out.stages[STAGES[i - 1]].complete
    )
      throw Error('앞선 섬을 먼저 완주한 기록이 필요해요.');
    out.stages[id] = record;
  });
  for (const id of STAGES)
    if (out.expeditions.bosses[id] && !out.stages[id].complete)
      throw Error('보스 도전은 해당 섬 완주 후 기록할 수 있어요.');
  const index = STAGES.indexOf(out.lastStage);
  if (index > 0 && !out.stages[STAGES[index - 1]].complete) throw Error('최근 섬이 아직 잠겨 있어요.');
  out.journal = validateJournal(v.journal, Object.fromEntries(STAGES.map(id => [id, out.stages[id].bestScore])));
  for (const id of [
    ...out.journal.stamps,
    ...out.journal.stories,
    ...out.journal.constellations,
    ...out.journal.routes,
    ...Object.keys(out.journal.ghosts),
  ]) {
    const stage = id.split('-')[0] as StageId;
    if (!unlocked(out, stage)) throw Error('모험 수첩에 아직 잠긴 섬의 발견이 있어요.');
  }
  if (v.courses === undefined) {
    // Older v1 files only contained the original course. Preserve that attribution.
    for (const id of STAGES) {
      const r = out.stages[id],
        ghost = out.journal.ghosts[id];
      if (r.bestScore || r.complete || r.maps.length || ghost)
        out.courses[courseKey(id, 'classic')] = {
          ...structuredClone(r),
          ...(ghost ? {ghost: structuredClone(ghost)} : {}),
        };
    }
  } else {
    const courses = obj(v.courses);
    if (Object.keys(courses).length > STAGES.length * VARIANTS.length) throw Error('코스 기록이 너무 많아요.');
    for (const [key, raw] of Object.entries(courses)) {
      const [stage, variant, ...extra] = key.split('/');
      if (extra.length || !STAGES.includes(stage as StageId) || !isVariant(variant))
        throw Error('코스 ID를 확인해 주세요.');
      const id = stage as StageId,
        r = readRecord(raw, id),
        all = out.stages[id];
      if (
        !unlocked(out, id) ||
        (r.complete && !all.complete) ||
        r.bestScore > all.bestScore ||
        r.bestRating > all.bestRating ||
        r.bestStars > all.bestStars ||
        r.maps.some(m => !all.maps.includes(m))
      )
        throw Error('코스 기록과 섬 전체 기록이 맞지 않아요.');
      const value = obj(raw);
      out.courses[courseKey(id, variant)] = {
        ...r,
        ...(value.ghost === undefined ? {} : {ghost: validateGhost(value.ghost, r.bestScore)}),
      };
    }
  }
  for (const id of [out.preferences.cape, out.preferences.emblem, out.preferences.sail])
    if (!cosmeticUnlocked(out, id)) throw Error('아직 열리지 않은 외형이 선택돼 있어요.');
  if (v.quiz !== undefined) {
    if (
      !Array.isArray(v.quiz) ||
      new Set(v.quiz).size !== v.quiz.length ||
      v.quiz.some(id => typeof id !== 'string' || !quizIds.includes(id))
    )
      throw Error('신화 퀴즈 기록을 확인해 주세요.');
    out.quiz = [...v.quiz];
  }
  if (v.endless !== undefined) {
    const e = obj(v.endless);
    for (const [id, raw] of Object.entries(e)) {
      if (!STAGES.includes(id as StageId) || !out.stages[id as StageId].complete)
        throw Error('끝없는 항해는 해당 섬을 완주한 뒤에 기록할 수 있어요.');
      const r = obj(raw),
        bestDistance = integer(r.bestDistance, endlessLength()),
        bestScore = integer(r.bestScore, Math.floor(endlessLength() / 10) + 100 * 10 * ENDLESS_SECTIONS);
      if (bestScore < Math.floor(bestDistance / 10)) throw Error('끝없는 항해의 점수와 거리가 맞지 않아요.');
      out.endless[id as StageId] = {bestScore, bestDistance};
    }
  }
  return out;
}
export interface RunResult {
  stage: StageId;
  variant?: VariantId;
  complete: boolean;
  score: number;
  rating: number;
  stars: number;
  maps: string[];
  hpLoss: number;
  distance: number;
  adventure?: AdventureResult;
}
export function courseRecord(save: Save, stage: StageId, variant: VariantId): CourseRecord {
  return (
    save.courses[courseKey(stage, variant)] ??
    (variant === 'classic' && !Object.keys(save.courses).some(key => key.startsWith(stage + '/'))
      ? save.stages[stage]
      : emptyRecord())
  );
}
export const courseGhost = (save: Save, stage: StageId, variant: VariantId) =>
  save.courses[courseKey(stage, variant)]?.ghost ?? (variant === 'classic' ? save.journal.ghosts[stage] : undefined);
export function mergeResult(save: Save, r: RunResult): Save {
  const out = structuredClone(save);
  const s = out.stages[r.stage];
  s.complete ||= r.complete;
  s.bestScore = Math.max(s.bestScore, r.score);
  s.bestRating = Math.max(s.bestRating, r.rating);
  s.bestStars = Math.max(s.bestStars, r.stars);
  s.maps = [...new Set([...s.maps, ...r.maps])];
  out.savedAt = new Date().toISOString();
  const variant = r.variant ?? 'classic',
    key = courseKey(r.stage, variant),
    record = {...structuredClone(courseRecord(save, r.stage, variant))};
  record.complete ||= r.complete;
  record.bestScore = Math.max(record.bestScore, r.score);
  record.bestRating = Math.max(record.bestRating, r.rating);
  record.bestStars = Math.max(record.bestStars, r.stars);
  record.maps = [...new Set([...record.maps, ...r.maps])];
  out.courses[key] = record;
  if (r.adventure) {
    const a = r.adventure,
      j = out.journal;
    for (const key of ['stamps', 'stories', 'constellations', 'combos', 'routes'] as const)
      (j[key] as string[]) = [...new Set([...j[key], ...a[key]])];
    const prior = record.ghost ?? courseGhost(save, r.stage, variant);
    if (!prior || a.ghost.score > prior.score || (a.ghost.score === prior.score && a.ghost.duration < prior.duration))
      record.ghost = structuredClone(a.ghost);
    if (variant === 'classic' && record.ghost) j.ghosts[r.stage] = structuredClone(record.ghost);
  }
  return out;
}
export const unlocked = (save: Save, id: StageId) =>
  STAGES.indexOf(id) === 0 || save.stages[STAGES[STAGES.indexOf(id) - 1]].complete;
export class SaveStore {
  data = emptySave();
  blocked = false;
  warning = '';
  readonly backupKey: string;
  constructor(
    private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
    readonly key = SAVE_KEY,
  ) {
    this.backupKey = key + ':backup';
    try {
      const raw = storage?.getItem(key);
      if (raw !== null && raw !== undefined) this.data = validateSave(JSON.parse(raw));
    } catch {
      this.blocked = true;
      this.warning = '기존 기록을 읽지 못했어요. 원본을 보존했어요. 설정에서 복원하거나 초기화해 주세요.';
    }
  }
  persist() {
    if (this.blocked) {
      this.warning = '기존 원본은 보존돼 있어요. 이번 기록을 저장하지 못했어요. 기록 파일로 내보낼 수 있어요.';
      return false;
    }
    try {
      if (!this.storage) throw Error();
      this.data.savedAt = new Date().toISOString();
      this.storage.setItem(this.key, JSON.stringify(this.data));
      this.warning = '';
      return true;
    } catch {
      this.warning = '이번 기록을 저장하지 못했어요. 기록 파일로 내보낼 수 있어요.';
      return false;
    }
  }
  replace(candidate: Save) {
    const clean = validateSave(candidate);
    try {
      if (!this.storage) throw Error();
      const old = this.storage.getItem(this.key);
      // Preserve the exact original, including damaged or unsupported data.
      this.storage.setItem(this.backupKey, old ?? JSON.stringify(this.data));
      this.storage.setItem(this.key, JSON.stringify(clean));
      this.data = clean;
      this.blocked = false;
      this.warning = '';
      return true;
    } catch {
      this.warning = '기록을 교체하지 못했어요. 기존 기록을 유지했어요.';
      return false;
    }
  }
  reset() {
    try {
      if (!this.storage) throw Error();
      this.storage.removeItem(this.key);
      this.storage.removeItem(this.backupKey);
      this.data = emptySave();
      this.blocked = false;
      this.warning = '';
      return true;
    } catch {
      this.warning = '기록을 초기화하지 못했어요. 브라우저 저장 권한을 확인해 주세요.';
      return false;
    }
  }
}
