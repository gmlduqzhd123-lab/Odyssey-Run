import {STAGES} from '../levels/courses';
import {validateSave, type CourseRecord, type RecordData, type Save} from './save';
import type {Ghost} from './journal';
import type {TrialRecord} from './expeditions';
// Two tabs (or two copies of one sailor) can both play. Progress only ever grows, so merging
// keeps the best of both: completion OR, best values max, discovered ids union. Settings and
// cosmetics come from whichever copy was saved last.
const union = <T>(a: readonly T[], b: readonly T[]) => [...new Set([...a, ...b])];
function record<T extends RecordData>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a || !b) return a ?? b;
  return {
    ...a,
    complete: a.complete || b.complete,
    bestScore: Math.max(a.bestScore, b.bestScore),
    bestRating: Math.max(a.bestRating, b.bestRating),
    bestStars: Math.max(a.bestStars, b.bestStars),
    maps: union(a.maps, b.maps),
  };
}
const betterGhost = (a?: Ghost, b?: Ghost) =>
  !a ? b : !b ? a : b.score > a.score || (b.score === a.score && b.duration < a.duration) ? b : a;
function trial<T extends TrialRecord>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a || !b) return a ?? b;
  return {
    ...a,
    complete: a.complete || b.complete,
    bestScore: Math.max(a.bestScore, b.bestScore),
    bestStars: Math.max(a.bestStars, b.bestStars),
    bestRating: Math.max(a.bestRating, b.bestRating),
  };
}
export function mergeSaves(a: Save, b: Save): Save {
  const newer = Date.parse(b.savedAt) >= Date.parse(a.savedAt) ? b : a,
    out = structuredClone(newer);
  for (const id of STAGES) out.stages[id] = record(a.stages[id], b.stages[id])!;
  out.courses = {};
  for (const key of union(Object.keys(a.courses), Object.keys(b.courses)) as (keyof Save['courses'])[]) {
    const x = a.courses[key],
      y = b.courses[key],
      merged = record<CourseRecord>(x, y)!,
      ghost = betterGhost(x?.ghost, y?.ghost);
    out.courses[key] = ghost ? {...merged, ghost} : (({ghost: _, ...rest}) => rest)(merged);
  }
  const j = out.journal;
  for (const key of ['stamps', 'stories', 'constellations', 'combos', 'routes'] as const)
    (j[key] as string[]) = union(a.journal[key] as string[], b.journal[key] as string[]);
  j.ghosts = {};
  for (const id of STAGES) {
    const g = betterGhost(a.journal.ghosts[id], b.journal.ghosts[id]);
    if (g) j.ghosts[id] = g;
  }
  out.expeditions.bosses = {};
  for (const id of STAGES) {
    const t = trial(a.expeditions.bosses[id], b.expeditions.bosses[id]);
    if (t) out.expeditions.bosses[id] = t;
  }
  const days = union(
    a.expeditions.daily.map(d => d.date),
    b.expeditions.daily.map(d => d.date),
  );
  out.expeditions.daily = days
    .map(date =>
      trial(
        a.expeditions.daily.find(d => d.date === date),
        b.expeditions.daily.find(d => d.date === date),
      )!,
    )
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 14);
  out.quiz = union(a.quiz, b.quiz);
  out.endless = {};
  for (const id of STAGES) {
    const x = a.endless[id],
      y = b.endless[id];
    if (x || y)
      out.endless[id] = {
        bestScore: Math.max(x?.bestScore ?? 0, y?.bestScore ?? 0),
        bestDistance: Math.max(x?.bestDistance ?? 0, y?.bestDistance ?? 0),
      };
  }
  out.tutorialSeen = a.tutorialSeen || b.tutorialSeen;
  // Re-validate: the union must still satisfy every save rule (e.g. unlock order).
  return validateSave(out);
}
