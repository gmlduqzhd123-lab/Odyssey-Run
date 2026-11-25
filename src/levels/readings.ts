import type {StageId} from './courses';
// A short reading for each island, opened after the island is complete: four sentences of the
// story and two questions about what they say. For reading lessons; never needed to play.
export interface Reading {
  id: StageId;
  title: string;
  lines: readonly string[];
  questions: readonly {question: string; options: readonly [string, string, string]; answer: 0 | 1 | 2}[];
}
export const READINGS: readonly Reading[] = [
  {
    id: 'beach',
    title: '트로이를 떠나는 배',
    lines: [
      '십 년 동안의 트로이 전쟁이 끝나자, 오디세우스는 동료들과 함께 배에 올랐어요.',
      '그의 마음속에는 고향 이타카와 아내 페넬로페, 어린 아들 텔레마코스가 있었어요.',
      '바다는 넓고 바람은 거셌지만, 오디세우스는 지혜를 믿고 노를 저었어요.',
      '그렇게 고향으로 돌아가는 길고 긴 여행이 시작되었어요.',
    ],
    questions: [
      {question: '오디세우스가 돌아가고 싶은 고향은 어디일까요?', options: ['트로이', '이타카', '크레타'], answer: 1},
      {
        question: '오디세우스가 여행에서 가장 믿은 것은 무엇일까요?',
        options: ['자신의 지혜', '커다란 배', '황금 보물'],
        answer: 0,
      },
    ],
  },
  {
    id: 'cave',
    title: '아무도 아닌 사람',
    lines: [
      '오디세우스 일행은 외눈박이 거인 폴리페모스의 동굴에 갇히고 말았어요.',
      '거인이 이름을 묻자, 오디세우스는 “내 이름은 아무도 아닌 사람이오.”라고 대답했어요.',
      '나중에 거인이 “아무도 아닌 사람이 나를 괴롭힌다!”라고 외쳤지만, 아무도 도우러 오지 않았어요.',
      '일행은 양의 배 아래에 매달려 몰래 동굴을 빠져나왔어요.',
    ],
    questions: [
      {
        question: '오디세우스는 거인에게 자기 이름을 뭐라고 했나요?',
        options: ['오디세우스', '아무도 아닌 사람', '용감한 선장'],
        answer: 1,
      },
      {
        question: '일행은 어떻게 동굴을 빠져나왔나요?',
        options: ['양의 배 아래에 매달려서', '하늘을 날아서', '거인과 싸워 이겨서'],
        answer: 0,
      },
    ],
  },
  {
    id: 'wind',
    title: '바람 자루의 비밀',
    lines: [
      '바람의 왕 아이올로스는 거친 바람을 모두 가죽 자루에 담아 오디세우스에게 주었어요.',
      '순한 서풍만 남아 배를 이타카 가까이까지 밀어 주었지요.',
      '그런데 동료들은 자루 안에 보물이 들어 있다고 생각하고 몰래 열어 버렸어요.',
      '거센 바람이 한꺼번에 쏟아져 나와, 배는 다시 먼 바다로 밀려났어요.',
    ],
    questions: [
      {question: '아이올로스가 자루에 담아 준 것은 무엇일까요?', options: ['보물', '거친 바람', '음식'], answer: 1},
      {
        question: '동료들이 자루를 연 까닭은 무엇일까요?',
        options: ['바람이 필요해서', '보물이 들었다고 생각해서', '자루가 찢어져서'],
        answer: 1,
      },
    ],
  },
  {
    id: 'circe',
    title: '몰리 약초',
    lines: [
      '마법사 키르케는 오디세우스의 동료들을 돼지로 바꾸어 버렸어요.',
      '전령의 신 헤르메스가 나타나 마법을 막아 주는 몰리 약초를 건네주었어요.',
      '약초를 먹은 오디세우스에게는 키르케의 마법이 통하지 않았어요.',
      '키르케는 동료들을 다시 사람으로 돌려놓고 다음 길을 알려 주었어요.',
    ],
    questions: [
      {question: '키르케는 동료들을 무엇으로 바꾸었나요?', options: ['돼지', '새', '돌'], answer: 0},
      {question: '몰리 약초를 준 신은 누구인가요?', options: ['포세이돈', '헤르메스', '아이올로스'], answer: 1},
    ],
  },
  {
    id: 'sea',
    title: '세이렌의 노래',
    lines: [
      '세이렌은 아름다운 노래로 뱃사람들을 바위섬으로 끌어들였어요.',
      '오디세우스는 동료들의 귀를 밀랍으로 막게 했어요.',
      '자신은 노래를 듣고 싶어서 돛대에 몸을 단단히 묶게 했지요.',
      '노래가 아무리 달콤해도 배는 멈추지 않고 바위섬을 지나갔어요.',
    ],
    questions: [
      {question: '동료들은 귀를 무엇으로 막았나요?', options: ['천', '밀랍', '나뭇잎'], answer: 1},
      {
        question: '오디세우스가 돛대에 몸을 묶은 까닭은 무엇일까요?',
        options: ['노래를 듣되 끌려가지 않으려고', '잠을 자려고', '바람을 피하려고'],
        answer: 0,
      },
    ],
  },
  {
    id: 'strait',
    title: '두 괴물 사이의 해협',
    lines: [
      '좁은 해협의 한쪽 절벽에는 머리가 여럿인 괴물 스킬라가 살았어요.',
      '다른 쪽 물속에는 바닷물을 빨아들이는 소용돌이 괴물 카리브디스가 있었지요.',
      '오디세우스는 배 전체가 삼켜지지 않도록 스킬라 쪽 가까이로 배를 몰았어요.',
      '어려운 선택이었지만, 배는 마침내 해협을 빠져나왔어요.',
    ],
    questions: [
      {
        question: '바닷물을 빨아들이는 소용돌이 괴물은 누구인가요?',
        options: ['스킬라', '카리브디스', '폴리페모스'],
        answer: 1,
      },
      {
        question: '오디세우스가 스킬라 쪽으로 배를 몬 까닭은 무엇일까요?',
        options: ['배 전체가 삼켜지지 않으려고', '스킬라와 싸우려고', '길을 잃어서'],
        answer: 0,
      },
    ],
  },
  {
    id: 'palace',
    title: '활 시위의 시험',
    lines: [
      '이십 년 만에 이타카에 돌아온 오디세우스는 거지로 변장하고 궁전에 들어갔어요.',
      '페넬로페는 남편의 큰 활에 시위를 걸고 열두 개의 도끼 구멍을 꿰뚫는 사람과 결혼하겠다고 했어요.',
      '구혼자들은 아무도 시위조차 걸지 못했지만, 변장한 오디세우스는 단번에 해냈어요.',
      '마침내 가족은 다시 만나고, 긴 여행은 고향에서 끝이 났어요.',
    ],
    questions: [
      {question: '오디세우스는 무엇으로 변장하고 궁전에 들어갔나요?', options: ['상인', '거지', '병사'], answer: 1},
      {
        question: '페넬로페가 낸 시험은 무엇이었나요?',
        options: ['달리기 시합', '활에 시위를 걸고 쏘기', '노래 부르기'],
        answer: 1,
      },
    ],
  },
];
export const READING_IDS: readonly string[] = READINGS.map(r => r.id);
export const readingFor = (id: string) => READINGS.find(r => r.id === id) ?? null;
