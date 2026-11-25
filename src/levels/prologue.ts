import {buildCustom, BLOCK_W} from './maker';
// The prologue, "Escape from Troy": a short practice run on the beach before the first island.
// Built from course-maker blocks, with a caption for each new thing to try.
export const PROLOGUE_BLOCKS = 'fcgkpjresf';
export const PROLOGUE_TITLE = '프롤로그: 트로이 탈출';
const INTRO = 1200;
export const PROLOGUE_GUIDE = [
  '트로이를 떠나요! 앞으로 저절로 달려요',
  '상자는 닿아도 괜찮아요 · 점프로 넘어 봐요',
  '낮은 문 · ↓ 꾹 눌러 숙이기',
  '집게게 · 점프해서 위에서 밟아 봐요!',
  '낭떠러지 · 점프! 공중에서 한 번 더',
  '스프링 발판 · 그냥 밟고 지나가요',
  '밧줄 · 점프해서 고리를 잡아요',
  '추격 구간 · 안 맞고 빠져나가면 보너스!',
  '가시 함정 · 점프로 넘어요',
  '잘했어요! 이제 진짜 항해를 떠나요',
];
export const prologueCourse = () => buildCustom('beach', PROLOGUE_BLOCKS, PROLOGUE_TITLE);
export const prologueGuide = () => PROLOGUE_GUIDE.map((text, i) => ({x: i ? INTRO + i * BLOCK_W - 350 : 0, text}));
