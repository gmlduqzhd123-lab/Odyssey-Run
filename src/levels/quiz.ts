// Optional myth questions, offered only after a run or from the codex, never during play.
// Their text (levels/quiz-text) loads after the home screen; the ids and right answers stay here,
// in the same order (checked in tests), for records and O/X gates.
export interface QuizQuestion {
  id: string;
  question: string;
  options: readonly [string, string, string];
  answer: 0 | 1 | 2;
  explain: string;
}
export const QUIZ_ANSWERS: Readonly<Record<string, 0 | 1 | 2>> = {
  home: 0,
  horse: 1,
  nobody: 2,
  polyphemus: 0,
  sheep: 1,
  bag: 0,
  opened: 2,
  weaving: 1,
  owl: 2,
  hermes: 0,
  nausicaa: 1,
  son: 0,
  book: 2,
  homer: 0,
  years: 1,
  wax: 1,
  mast: 1,
  pigs: 0,
  moly: 1,
  friends: 1,
  charybdis: 0,
  'six-heads': 2,
  stars: 2,
  wisdom: 1,
  poseidon: 2,
  wine: 0,
  'one-eye': 1,
  'blown-back': 1,
  floating: 0,
  'circe-who': 1,
  'moly-flower': 0,
  'circe-advice': 1,
  'sirens-song': 0,
  promise: 2,
  'cliff-side': 1,
  calypso: 1,
  disguise: 0,
  argos: 2,
  bow: 1,
  suitors: 2,
};
export const quizIds: readonly string[] = Object.keys(QUIZ_ANSWERS);
let text: readonly QuizQuestion[] | null = null;
export const quizReady = () => text !== null;
export function useQuizText(q: readonly QuizQuestion[]) {
  text = q;
}
export const loadQuizText = () =>
  text ? Promise.resolve(text) : import('./quiz-text').then(m => (useQuizText(m.QUIZ), m.QUIZ));
// The questions' text, once loaded (a run and the quiz page wait for it).
export function quizText() {
  if (!text) throw Error('quiz text is not loaded');
  return text;
}
