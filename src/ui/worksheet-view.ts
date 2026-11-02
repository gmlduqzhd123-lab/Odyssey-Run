import {MAP_STORIES} from '../levels/courses';
import {QUIZ} from '../levels/quiz';
import {PEOPLE} from '../assets/catalog';
import {seeded} from '../levels/endless';
import {button} from './html';
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
];
export interface Blank {
  text: string;
  answer: string;
}
// The first sentence of each story with its first keyword blanked; stories without one are skipped.
export function blanks(): Blank[] {
  const out: Blank[] = [];
  for (const [, story] of MAP_STORIES) {
    const first = story.split(/(?<=[.!?])\s/)[0],
      word = KEYWORDS.find(k => first.includes(k));
    if (word) out.push({text: first.replace(word, '(            )'), answer: word});
  }
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
export function worksheetMarkup(header: string, report: QuestionReport[], date: string) {
  const fill = blanks().slice(0, 8),
    bank = shuffle(
      fill.map(b => b.answer),
      'bank' + date,
    ),
    people = PEOPLE.filter(p => !['navigator', 'counsellor', 'sailor'].includes(p.id)).slice(0, 6),
    roles = shuffle(
      people.map(p => p.role),
      'roles' + date,
    ),
    answered = report.filter(r => r.answered),
    weakest = (answered.length ? [...answered].sort((a, b) => a.right / a.answered - b.right / b.answered) : report)
      .slice(0, 5)
      .map(r => QUIZ.find(q => q.id === r.id)!);
  return `<div class="page worksheet">${header}<div class="no-print button-row">${button('worksheet-print', '🖨 인쇄하기', 'primary')}${button('progress', '진행 현황으로', 'secondary')}</div><article class="sheet"><header class="sheet-head"><h1 tabindex="-1">오디세이 런 활동지</h1><p>이름 ____________ · 날짜 ${date}</p></header><section><h2>1. 빈칸에 알맞은 말을 써 보세요</h2><p class="muted no-print">이야기 빈칸 문제는 한국어 원문으로 만들어요.</p><p class="word-bank" translate="no">보기: ${bank.join(' · ')}</p><ol translate="no">${fill.map(b => `<li>${b.text}</li>`).join('')}</ol></section><section><h2>2. 인물과 알맞은 설명을 선으로 이어 보세요</h2><div class="match"><ol>${people.map(p => `<li>${p.name}</li>`).join('')}</ol><ol type="a">${roles.map(r => `<li>${r}</li>`).join('')}</ol></div></section><section><h2>3. 다시 풀어 보는 신화 퀴즈</h2><ol>${weakest.map(q => `<li>${q.question}<br>${q.options.map((o, i) => `${'ABC'[i]}. ${o}`).join('  ')}</li>`).join('')}</ol></section><section class="answer-key"><h2>정답 (선생님용)</h2><p translate="no">1. ${fill.map((b, i) => `${i + 1}) ${b.answer}`).join('  ')}</p><p>2. ${people.map((p, i) => `${i + 1}) ${'abcdef'[roles.indexOf(p.role)]}`).join('  ')}</p><p>3. ${weakest.map((q, i) => `${i + 1}) ${'ABC'[q.answer]}`).join('  ')}</p></section></article></div>`;
}
