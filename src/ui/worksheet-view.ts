import {COURSES, MAP_STORIES, STAGES, type StageId} from '../levels/courses';
import {QUIZ, QUIZ_READ} from '../levels/quiz';
import {PEOPLE} from '../assets/catalog';
import {seeded} from '../levels/endless';
import {button} from './html';
import {getLang, translateTo, type Lang} from '../i18n';
import {sentences} from '../systems/narrator';
import type {QuestionReport} from './class-view';
// A printable class worksheet: fill-in-the-blank lines from the map stories, people to match with
// their roles, and review questions (the ones this class misses most), with an answer key.
const KEYWORDS = [
  '키클롭스',
  '아이올로스',
  '세이렌',
  '키르케',
  '헤르메스',
  '몰리',
  '밀랍',
  '돛대',
  '스킬라',
  '카리브디스',
  '이타카',
  '트로이',
  '돼지',
  '소용돌이',
  '자루',
  '별',
  '동료',
  // Later in the list, so the earlier stories keep their blanks: the strait's last story and the palace's.
  '아테나',
  '페넬로페',
  '해협',
  '고향',
];
// The same keywords in the other languages, as the translated stories spell them.
const KEYWORD_I18N: Record<Exclude<Lang, 'ko'>, Record<string, string>> = {
  en: {
    키클롭스: 'Cyclops',
    아이올로스: 'Aeolus',
    세이렌: 'Sirens',
    키르케: 'Circe',
    헤르메스: 'Hermes',
    몰리: 'moly',
    밀랍: 'wax',
    돛대: 'mast',
    스킬라: 'Scylla',
    카리브디스: 'Charybdis',
    이타카: 'Ithaca',
    트로이: 'Troy',
    돼지: 'pigs',
    소용돌이: 'whirlpool',
    자루: 'bag',
    별: 'stars',
    동료: 'shipmates',
    아테나: 'Athena',
    페넬로페: 'Penelope',
    해협: 'strait',
    고향: 'Home',
  },
  vi: {
    키클롭스: 'Cyclops',
    아이올로스: 'Aeolus',
    세이렌: 'Siren',
    키르케: 'Circe',
    헤르메스: 'Hermes',
    몰리: 'moly',
    밀랍: 'sáp',
    돛대: 'cột buồm',
    스킬라: 'Scylla',
    카리브디스: 'Charybdis',
    이타카: 'Ithaca',
    트로이: 'Troy',
    돼지: 'lợn',
    소용돌이: 'xoáy nước',
    자루: 'túi',
    별: 'sao',
    동료: 'bạn',
    아테나: 'Athena',
    페넬로페: 'Penelope',
    해협: 'eo biển',
    고향: 'Quê nhà',
  },
  zh: {
    키클롭스: '独眼巨人',
    아이올로스: '埃俄罗斯',
    세이렌: '塞壬',
    키르케: '喀耳刻',
    헤르메스: '赫尔墨斯',
    몰리: '摩吕',
    밀랍: '蜡',
    돛대: '桅杆',
    스킬라: '斯库拉',
    카리브디스: '卡律布狄斯',
    이타카: '伊萨卡',
    트로이: '特洛伊',
    돼지: '猪',
    소용돌이: '漩涡',
    자루: '袋子',
    별: '星星',
    동료: '伙伴',
    아테나: '雅典娜',
    페넬로페: '珀涅罗珀',
    해협: '海峡',
    고향: '家乡',
  },
  ru: {
    키클롭스: 'Циклоп',
    아이올로스: 'Эол',
    세이렌: 'сирен',
    키르케: 'Цирце',
    헤르메스: 'Гермес',
    몰리: 'моли',
    밀랍: 'воск',
    돛대: 'мачт',
    스킬라: 'Сцилл',
    카리브디스: 'Харибд',
    이타카: 'Итак',
    트로이: 'Тро',
    돼지: 'свин',
    소용돌이: 'водоворот',
    자루: 'мешок',
    별: 'звёзд',
    동료: 'товарищ',
    아테나: 'Афин',
    페넬로페: 'Пенелоп',
    해협: 'пролив',
    고향: 'Дом',
  },
};
export interface Blank {
  text: string;
  answer: string;
  // The island whose map story the line comes from.
  stage?: StageId;
}
// The first sentence of each story, in the chosen language, with its first keyword blanked;
// stories whose translated sentence does not carry a keyword are skipped. Russian keywords are
// stems, so the blank covers the whole inflected word.
export function blankFrom(text: string, lang: Lang): Blank | null {
  const first = sentences(text)[0] ?? text;
  for (const k of KEYWORDS) {
    const word = lang === 'ko' ? k : KEYWORD_I18N[lang][k],
      at = word ? first.indexOf(word) : -1;
    if (at < 0) continue;
    let end = at + word.length;
    if (lang === 'ru') while (end < first.length && /[\p{L}]/u.test(first[end])) end++;
    return {text: first.slice(0, at) + '(            )' + first.slice(end), answer: first.slice(at, end)};
  }
  return null;
}
export function blanks(lang: Lang = getLang()): Blank[] {
  const out: Blank[] = [];
  MAP_STORIES.forEach(([, story], i) => {
    const b = blankFrom(lang === 'ko' ? story : translateTo(lang, story), lang);
    if (b) out.push({...b, stage: STAGES[Math.floor(i / 3)]});
  });
  return out;
}
const shuffle = <T>(list: T[], seed: string) => {
  const random = seeded(seed),
    out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
// How much a sheet asks: lower grades get fewer lines and a word bank; upper grades fill the
// blanks without one and add two questions to answer in their own words.
export const LEVELS = {
  low: {name: '저학년', blanks: 5, people: 4, quiz: 3, bank: true, write: 0},
  mid: {name: '중학년', blanks: 8, people: 6, quiz: 5, bank: true, write: 0},
  high: {name: '고학년', blanks: 8, people: 6, quiz: 5, bank: false, write: 2},
} as const;
export type Level = keyof typeof LEVELS;
const WRITE = [
  '내가 오디세우스였다면 가장 어려웠을 순간은 언제였을지, 그 까닭과 함께 써 보세요.',
  '이야기에 나온 인물 한 명에게 편지를 써 보세요. 무엇을 묻거나 고맙다고 말하고 싶나요?',
];
// The island a question belongs to, from the map story it sends a class back to.
export const quizStage = (id: string): StageId | null => {
  const read = QUIZ_READ[id];
  return read && 'story' in read ? STAGES[Math.floor(read.story / 3)] : null;
};
export interface WorksheetOptions {
  level: Level;
  // One island's stories and questions first, or every island.
  stage: StageId | null;
}
export function worksheetMarkup(
  header: string,
  report: QuestionReport[],
  date: string,
  opts: WorksheetOptions = {level: 'mid', stage: null},
) {
  const L = LEVELS[opts.level],
    all = blanks(),
    // The island's own lines first; the rest of the voyage fills any space left.
    fill = (
      opts.stage ? [...all.filter(b => b.stage === opts.stage), ...all.filter(b => b.stage !== opts.stage)] : all
    ).slice(0, L.blanks),
    bank = shuffle(
      fill.map(b => b.answer),
      'bank' + date,
    ),
    people = PEOPLE.filter(p => !['navigator', 'counsellor', 'sailor'].includes(p.id)).slice(0, L.people),
    roles = shuffle(
      people.map(p => p.role),
      'roles' + date,
    ),
    answered = report.filter(r => r.answered),
    ranked = answered.length ? [...answered].sort((a, b) => a.right / a.answered - b.right / b.answered) : report,
    own = opts.stage ? ranked.filter(r => quizStage(r.id) === opts.stage) : [],
    weakest = [...own, ...ranked.filter(r => !own.includes(r))]
      .slice(0, L.quiz)
      .map(r => QUIZ.find(q => q.id === r.id)!),
    title = opts.stage ? `오디세이 런 활동지 · ${COURSES[opts.stage].name}` : '오디세이 런 활동지';
  const controls = `<div class="no-print worksheet-options"><label>학년 <select id="ws-level">${(Object.keys(LEVELS) as Level[]).map(l => `<option value="${l}" ${l === opts.level ? 'selected' : ''}>${LEVELS[l].name}</option>`).join('')}</select></label><label>섬 <select id="ws-island"><option value="">모든 섬</option>${STAGES.map(id => `<option value="${id}" ${id === opts.stage ? 'selected' : ''}>${COURSES[id].name}</option>`).join('')}</select></label>${button('worksheet', '다시 만들기', 'secondary')}</div>`;
  return `<div class="page worksheet">${header}<div class="no-print button-row">${button('worksheet-print', '🖨 인쇄하기', 'primary')}${button('progress', '진행 현황으로', 'secondary')}</div>${controls}<article class="sheet"><header class="sheet-head"><h1 tabindex="-1">${title}</h1><p>이름 ____________ · 날짜 ${date} · ${L.name}</p></header><section><h2>1. 빈칸에 알맞은 말을 써 보세요</h2>${L.bank ? `<p class="word-bank" translate="no"><span translate="yes">보기:</span> ${bank.join(' · ')}</p>` : ''}<ol translate="no">${fill.map(b => `<li>${b.text}</li>`).join('')}</ol></section><section><h2>2. 인물과 알맞은 설명을 선으로 이어 보세요</h2><div class="match"><ol>${people.map(p => `<li>${p.name}</li>`).join('')}</ol><ol type="a">${roles.map(r => `<li>${r}</li>`).join('')}</ol></div></section><section><h2>3. 다시 풀어 보는 신화 퀴즈</h2><ol>${weakest.map(q => `<li>${q.question}<br>${q.options.map((o, i) => `${'ABC'[i]}. <span>${o}</span>`).join('  ')}</li>`).join('')}</ol></section>${
    L.write
      ? `<section><h2>4. 생각을 써 보세요</h2><ol>${WRITE.slice(0, L.write)
          .map(w => `<li>${w}<p class="note-lines">&nbsp;</p></li>`)
          .join('')}</ol></section>`
      : ''
  }<section class="answer-key"><h2>정답 (선생님용)</h2><p translate="no">1. ${fill.map((b, i) => `${i + 1}) ${b.answer}`).join('  ')}</p><p>2. ${people.map((p, i) => `${i + 1}) ${'abcdef'[roles.indexOf(p.role)]}`).join('  ')}</p><p>3. ${weakest.map((q, i) => `${i + 1}) ${'ABC'[q.answer]}`).join('  ')}</p></section></article></div>`;
}
