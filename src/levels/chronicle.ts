import {STAGES, type StageId} from './courses';
import type {REGIONS} from '../assets/terrain';
import type {Save} from '../storage/save';
// The chronicle follows the Odyssey from Troy to Ithaca. Each chapter is a short picture story
// (a painting, three lines read in turn) that opens when its island is complete; the whole
// chronicle can be watched as a story on its own and saved as a timeline poster.
export interface Chapter {
  id: 'troy' | StageId | 'ithaca';
  title: string;
  view: keyof typeof REGIONS;
  lines: readonly [string, string, string];
}
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'troy',
    title: '트로이를 떠나며',
    view: 'view-ruins',
    lines: [
      '십 년의 전쟁이 끝났어요. 나무 목마의 꾀로 트로이는 무너졌지요.',
      '오디세우스와 선원들은 배에 올라 고향 이타카를 향해 돛을 올렸어요.',
      '하지만 신들은 이 귀환이 아주 긴 여정이 될 줄 알고 있었어요.',
    ],
  },
  {
    id: 'beach',
    title: '낯선 해변에서',
    view: 'view-beach',
    lines: [
      '거센 파도에 밀려 배는 낯선 해변에 닿았어요.',
      '친절한 사람들은 지친 선원들에게 물과 빵을 나누어 주었어요.',
      '오디세우스는 고마움을 마음에 새기고 다시 노를 저었어요.',
    ],
  },
  {
    id: 'cave',
    title: '외눈박이 거인의 동굴',
    view: 'view-cave',
    lines: [
      '어느 섬의 동굴에서 일행은 외눈박이 거인 폴리페모스에게 갇혔어요.',
      '오디세우스는 자신을 ‘아무도 아닌 사람’이라 부르며 꾀를 냈어요.',
      '양의 배에 매달린 선원들은 마침내 동굴을 빠져나왔지요.',
    ],
  },
  {
    id: 'wind',
    title: '바람의 자루',
    view: 'view-wind',
    lines: [
      '바람의 주인 아이올로스는 거센 바람을 자루에 담아 선물했어요.',
      '순풍을 타고 고향이 보일 즈음, 선원들이 자루를 열고 말았어요.',
      '쏟아진 바람은 배를 다시 먼 바다로 밀어냈어요.',
    ],
  },
  {
    id: 'circe',
    title: '마녀 키르케의 섬',
    view: 'view-circe',
    lines: [
      '숲속 궁전의 마녀 키르케는 선원들을 돼지로 바꾸어 버렸어요.',
      '헤르메스가 준 하얀 꽃 몰리 덕분에 오디세우스는 마법에 걸리지 않았어요.',
      '키르케는 선원들을 사람으로 돌려놓고 앞으로의 길을 알려 주었어요.',
    ],
  },
  {
    id: 'sea',
    title: '세이렌의 노래',
    view: 'view-sea',
    lines: [
      '바위섬의 세이렌은 아름다운 노래로 뱃사람을 불렀어요.',
      '선원들은 밀랍으로 귀를 막고, 오디세우스는 자신을 돛대에 묶었어요.',
      '약속을 지킨 덕분에 배는 노래를 무사히 지나갔어요.',
    ],
  },
  {
    id: 'strait',
    title: '두 괴물 사이의 해협',
    view: 'view-strait',
    lines: [
      '한쪽 절벽에는 머리 여섯의 스킬라, 다른 쪽에는 소용돌이 카리브디스가 있었어요.',
      '오디세우스는 키르케의 조언대로 소용돌이를 피해 절벽 쪽으로 배를 몰았어요.',
      '모두가 힘을 다해 노를 저어 마침내 해협을 빠져나왔지요.',
    ],
  },
  {
    id: 'palace',
    title: '궁전으로 돌아온 왕',
    view: 'view-ruins',
    lines: [
      '아테나는 오디세우스를 늙은 거지로 변장시켜 궁전으로 보냈어요.',
      '페넬로페는 남편의 활에 시위를 걸어 열두 도끼 구멍을 꿰뚫으라는 시험을 냈어요.',
      '아무도 못 한 일을 거지가 해내자, 모두가 마침내 왕을 알아보았지요.',
    ],
  },
  {
    id: 'ithaca',
    title: '마침내 이타카',
    view: 'view-ithaca',
    lines: [
      '긴 세월이 흐른 뒤, 오디세우스는 마침내 이타카의 해변에 닿았어요.',
      '페넬로페와 텔레마코스는 지혜와 용기로 그를 기다려 왔어요.',
      '모험은 끝났지만, 귀환의 이야기는 지금까지 전해지고 있어요.',
    ],
  },
];
export const chapter = (id: string) => CHAPTERS.find(c => c.id === id);
export function chapterOpen(save: Save, id: Chapter['id']) {
  if (id === 'troy') return true;
  if (id === 'ithaca') return STAGES.every(s => save.stages[s].complete);
  return save.stages[id].complete;
}
