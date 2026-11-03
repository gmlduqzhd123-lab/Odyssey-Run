import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave, mergeResult, validateSave, type Save} from '../src/storage/save';
import {STAGES} from '../src/levels/courses';
import {VARIANTS} from '../src/levels/course-ids';
import {quizIds} from '../src/levels/quiz';
import {ADVENTURE_PLANS} from '../src/levels/adventure';
import {recordQuiz, recordRun, MAX_DAYS} from '../src/storage/feats';
import {classBackup, CLASS_BACKUP_LIMIT, readClassBackup} from '../src/storage/backup';
import {Profiles, MAX_PROFILES, profileKey, PROFILES_KEY} from '../src/storage/profiles';
import {Contests, MAX_CONTESTS, MAX_ENTRIES, CONTESTS_KEY} from '../src/storage/contests';
import {Gallery, MAX_GALLERY, GALLERY_KEY} from '../src/storage/gallery';
import {C} from '../src/config';
import {GHOST_SECONDS} from '../src/storage/journal';

// The largest save one sailor can reach: every course, variant, ghost, stamp, story, quiz answer,
// 400 days sailed and a full week of counters.
function fullSave(): Save {
  let s = emptySave();
  for (const stage of STAGES)
    for (const v of VARIANTS)
      s = mergeResult(s, {
        stage,
        variant: v,
        complete: true,
        score: 4200,
        rating: 3,
        stars: 100,
        maps: [1, 2, 3].map(i => `${stage}-map-${i}`),
        hpLoss: 0,
        distance: C.length,
        adventure: {
          stamps: ['maps', 'dodge', 'sky', 'story'].map(g => `${stage}-${g}`),
          stories: ADVENTURE_PLANS[stage].stories.map(x => x.id),
          constellations: ADVENTURE_PLANS[stage].constellations.map(x => x.id),
          combos: ['glide', 'guardian'],
          routes: [`${stage}-upper`, `${stage}-lower`],
          nearMisses: 9,
          evaded: 9,
          tricked: 9,
          ghost: {
            score: 4200,
            duration: GHOST_SECONDS,
            samples: Array.from({length: GHOST_SECONDS + 1}, (_, i) => Math.min(24000, i * 320)),
          },
        },
      });
  for (const stage of STAGES) {
    s.expeditions.bosses[stage] = {complete: true, bestScore: 1460, bestRating: 2, bestStars: 0};
    s.endless[stage] = {bestScore: 50000, bestDistance: 190000};
  }
  s.expeditions.daily = Array.from({length: 14}, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    complete: true,
    bestScore: 4200,
    bestRating: 3,
    bestStars: 100,
  }));
  s.quiz = [...quizIds];
  for (let i = 0; i < MAX_DAYS; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
    s = recordRun(
      s,
      {stage: 'beach', complete: true, score: 4200, rating: 3, stars: 100, maps: [], hpLoss: 0, distance: 24000},
      d,
      {special: true, weather: true},
    );
  }
  for (const id of quizIds) for (let k = 0; k < 3; k++) s = recordQuiz(s, id, k, '2026-12-31');
  return validateSave(s);
}

test('a class backup of a full device (every sailor, contest and gallery slot at their maximum) fits the 4MB limit', () => {
  const m = new Map<string, string>(),
    storage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  const one = JSON.stringify(fullSave());
  assert.ok(Buffer.byteLength(one, 'utf8') < 131072, `one save is ${Buffer.byteLength(one, 'utf8')} bytes`);
  const profiles = new Profiles(storage);
  profiles.addNumbered(MAX_PROFILES, n => `${n}번`);
  assert.equal(profiles.book.list.length, MAX_PROFILES);
  for (const p of profiles.book.list) storage.setItem(profileKey(p.id), one);
  const contests = new Contests(storage);
  for (let i = 0; i < MAX_CONTESTS; i++) {
    const id = String(i)
      .padStart(6, 'a')
      .replace(/[^a-z0-9]/g, 'a')
      .slice(-6);
    contests.host({
      id,
      title: '우리 반 대회 열두자',
      stage: 'strait',
      variant: 'remix-b',
      assist: true,
      blocks: 'fpskhgobwl',
    });
    for (let e = 0; e < MAX_ENTRIES; e++)
      contests.add({
        kind: 'result',
        contest: id,
        name: `항해사${e}`,
        score: 4200 - e,
        complete: true,
        stars: 100,
        maps: 3,
        hpLoss: 0,
        time: 75,
        // Every result carries a ghost; the board keeps only the top three.
        ghost: {
          score: 4200 - e,
          duration: GHOST_SECONDS,
          samples: Array.from({length: GHOST_SECONDS + 1}, (_, i) => Math.min(24000, i * 47)),
        },
      });
  }
  const gallery = new Gallery(storage);
  for (let i = 0; i < MAX_GALLERY; i++)
    gallery.add({
      stage: 'sea',
      blocks: 'ffffffff' + 'cgpsokhbwl'[i % 10] + 'cgpsokhbwl'[Math.floor(i / 10) % 10],
      title: '열두 글자 코스 이름',
    });
  const backup = JSON.stringify(classBackup(storage)),
    bytes = Buffer.byteLength(backup, 'utf8');
  assert.ok(bytes < CLASS_BACKUP_LIMIT, `backup is ${bytes} bytes`);
  // It reads back whole, and the stored keys are what the backup covers.
  const back = readClassBackup(JSON.parse(backup));
  assert.equal(back.profiles.list.length, MAX_PROFILES);
  assert.equal(back.contests.hosted.length, MAX_CONTESTS);
  assert.equal(back.gallery?.length, MAX_GALLERY);
  assert.ok(m.has(PROFILES_KEY) && m.has(CONTESTS_KEY) && m.has(GALLERY_KEY));
  console.log(`class backup at maximum: ${(bytes / 1048576).toFixed(2)}MB of ${CLASS_BACKUP_LIMIT / 1048576}MB`);
});
