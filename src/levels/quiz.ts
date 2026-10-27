// Optional myth questions, offered only after a run or from the codex, never during play.
export interface QuizQuestion {
  id: string;
  question: string;
  options: readonly [string, string, string];
  answer: 0 | 1 | 2;
  explain: string;
}
export const QUIZ: readonly QuizQuestion[] = [
  {
    id: 'home',
    question: '오디세우스의 고향 섬은 어디일까요?',
    options: ['이타카', '크레타', '로도스'],
    answer: 0,
    explain: '오디세우스는 이타카의 왕이에요. 이 게임의 마지막 항구도 이타카예요.',
  },
  {
    id: 'horse',
    question: '트로이 전쟁에서 오디세우스가 낸 꾀는 무엇일까요?',
    options: ['하늘을 나는 배', '커다란 나무 목마', '황금 방패'],
    answer: 1,
    explain: '병사들이 숨은 나무 목마를 성 안으로 들여보내는 꾀로 전쟁이 끝났다고 전해져요.',
  },
  {
    id: 'nobody',
    question: '오디세우스는 키클롭스에게 자기 이름을 뭐라고 했을까요?',
    options: ['헤라클레스', '아킬레우스', '아무도 아닌 사람'],
    answer: 2,
    explain: '거인이 “아무도 아닌 사람이 나를 괴롭힌다!”라고 외쳐서 다른 거인들이 도우러 오지 않았어요.',
  },
  {
    id: 'polyphemus',
    question: '오디세우스 일행을 동굴에 가둔 키클롭스의 이름은?',
    options: ['폴리페모스', '미노타우로스', '메두사'],
    answer: 0,
    explain: '폴리페모스는 바다의 신 포세이돈의 아들이에요.',
  },
  {
    id: 'sheep',
    question: '일행은 키클롭스의 동굴에서 어떻게 빠져나왔을까요?',
    options: ['큰 항아리 속에 숨어서', '양의 배 아래에 매달려서', '땅굴을 파서'],
    answer: 1,
    explain: '거인이 양을 내보낼 때 손으로 등을 더듬었지만 배 아래에 매달린 사람은 찾지 못했어요.',
  },
  {
    id: 'bag',
    question: '바람의 주인 아이올로스가 준 선물은 무엇일까요?',
    options: ['바람을 담은 자루', '황금 사과', '마법 지팡이'],
    answer: 0,
    explain: '거센 바람을 자루에 가두고 순풍만 남겨 주었어요.',
  },
  {
    id: 'opened',
    question: '이타카가 보일 만큼 가까워졌을 때, 바람 자루를 연 사람은?',
    options: ['페넬로페', '키클롭스', '호기심 많은 선원들'],
    answer: 2,
    explain: '보물이 든 줄 안 선원들이 자루를 열자 바람이 쏟아져 배가 멀리 밀려났어요.',
  },
  {
    id: 'weaving',
    question: '페넬로페는 구혼자들에게 대답을 미루려고 어떻게 했을까요?',
    options: ['높은 탑에 숨었어요', '낮에 짠 천을 밤에 몰래 풀었어요', '수수께끼를 냈어요'],
    answer: 1,
    explain: '“이 천을 다 짜면 대답할게요”라고 말하고, 밤마다 천을 다시 풀었어요.',
  },
  {
    id: 'owl',
    question: '지혜의 여신 아테나를 상징하는 동물은?',
    options: ['사자', '독수리', '부엉이'],
    answer: 2,
    explain: '부엉이는 지혜의 상징이에요. 게임 속 방패에도 부엉이 문양이 있어요.',
  },
  {
    id: 'hermes',
    question: '날개 달린 신 헤르메스는 어떤 일을 했을까요?',
    options: ['신들의 소식을 전했어요', '바다를 다스렸어요', '불을 만들었어요'],
    answer: 0,
    explain: '헤르메스는 신들의 전령이에요. 오디세우스에게 마법을 막는 약초를 건네기도 했어요.',
  },
  {
    id: 'nausicaa',
    question: '낯선 해변에 떠밀려 온 오디세우스를 도와준 공주는?',
    options: ['칼립소', '나우시카', '키르케'],
    answer: 1,
    explain: '빨래하러 나온 나우시카가 오디세우스를 도왔고, 그 나라 사람들이 그를 이타카까지 데려다주었어요.',
  },
  {
    id: 'son',
    question: '아버지의 소식을 찾아 길을 떠난 오디세우스의 아들은?',
    options: ['텔레마코스', '헥토르', '아이올로스'],
    answer: 0,
    explain: '텔레마코스는 아버지의 옛 친구들을 찾아가 소식을 물었어요.',
  },
  {
    id: 'book',
    question: '오디세우스의 귀환 이야기를 담은 옛 이야기책의 이름은?',
    options: ['일리아스', '아이네이스', '오디세이아'],
    answer: 2,
    explain: '『오디세이아』예요. 트로이 전쟁 이야기는 『일리아스』에 담겨 있어요.',
  },
  {
    id: 'homer',
    question: '『오디세이아』를 지었다고 전해지는 시인은?',
    options: ['호메로스', '플라톤', '소크라테스'],
    answer: 0,
    explain: '아주 오래전 그리스의 시인 호메로스가 지었다고 전해져요.',
  },
  {
    id: 'years',
    question: '전쟁이 끝난 뒤 오디세우스가 고향에 돌아오기까지 얼마나 걸렸을까요?',
    options: ['한 달', '약 10년', '100년'],
    answer: 1,
    explain: '트로이 전쟁 10년, 돌아오는 항해 약 10년. 정말 긴 여정이었어요.',
  },
];
export const quizIds = QUIZ.map(q => q.id);
// Real figures get one line from the Odyssey; the game's own guides have none.
export const PERSON_MYTHS: Partial<Record<string, string>> = {
  odysseus: '『오디세이아』의 주인공이에요. 트로이 전쟁에서 나무 목마 꾀를 냈고, 약 10년을 항해해 고향으로 돌아왔어요.',
  penelope: '구혼자들이 몰려오자 “시아버지의 수의를 다 짜면 대답하겠다”며 낮에 짠 천을 밤마다 풀었어요.',
  telemachus: '아버지의 소식을 찾아 필로스와 스파르타로 떠났고, 돌아온 아버지와 함께 집을 지켰어요.',
  athena: '지혜의 여신으로, 신들 앞에서 오디세우스의 귀환을 도와 달라고 부탁했어요. 상징 동물은 부엉이예요.',
  hermes: '신들의 전령이에요. 마녀 키르케의 마법을 막는 약초 ‘몰리’를 오디세우스에게 주었어요.',
  aeolus: '바람의 주인이에요. 거센 바람을 자루에 담아 주었지만, 선원들이 자루를 열어 배가 되돌아갔어요.',
  nausicaa: '파이아케스족의 공주예요. 해변에서 오디세우스를 도왔고, 그 나라 배가 그를 이타카에 데려다주었어요.',
};
