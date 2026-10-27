import {sailColor} from '../systems/cosmetics';
import {ADVENTURE_PLANS, GOALS, COMBOS} from '../levels/adventure';
import type {Journal} from '../storage/journal';
export function constellationIcon(shape: string) {
  const path =
    shape === 'ship'
      ? '<path d="M14 39h52L56 55H25zM39 10v28M42 13l18 22H42z"/>'
      : shape === 'owl'
        ? '<path d="M18 16l12 7h20l12-7v27L50 59H30L18 43z"/><circle cx="31" cy="35" r="8"/><circle cx="49" cy="35" r="8"/><path d="M36 46l4 5 4-5"/>'
        : '<path d="M14 23l14 12 12-20 12 20 14-12-8 34H22zM23 48h34"/>';
  return `<svg viewBox="0 0 80 70" aria-hidden="true" class="constellation-icon"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">${path}</g></svg>`;
}
export function harborUnlocks(j: Journal, completed: number, maps: number) {
  return [
    completed > 0,
    maps >= 3,
    j.stories.length >= 2,
    j.constellations.length >= 3,
    completed === 3 && j.stamps.length >= 3,
  ];
}
export function harborArt(unlocks: boolean[], sail = 'plain') {
  const visible = (index: number) => (unlocks[index] ? 'built' : 'planned');
  return `<svg class="harbor-art" viewBox="0 0 960 370" role="img" aria-label="이타카 항구. ${unlocks.filter(Boolean).length}개 시설 완성"><defs><linearGradient id="harbor-sky" x2="0" y2="1"><stop stop-color="#bad9d5"/><stop offset="1" stop-color="#f8e8bc"/></linearGradient></defs><rect width="960" height="370" rx="18" fill="url(#harbor-sky)"/><circle cx="750" cy="80" r="47" fill="#fff3c7"/><path d="M0 240L170 110l155 116 150-140 183 154 180-127 122 115v142H0" fill="#8aa9a0"/><path d="M0 280l270-83 273 66 417-57v164H0" fill="#cab897"/><path d="M0 310q250-35 480 0t480 0v60H0" fill="#377e90"/><path d="M0 345h145m90 0h100m170 0h160m110 0h120" stroke="#b9d6ce" stroke-width="3" opacity=".5"/>
 <g class="${visible(0)}"><path d="M100 310h170l-30 36H133z" fill="#9d6948"/><path d="M181 212v98m5-91 60 75h-60z" fill="${sailColor(sail)}" stroke="#795d46" stroke-width="4"/><path d="M190 216h41l-13 12 13 12h-41" fill="#bb6c4e"/></g>
 <g class="${visible(1)}"><path d="M730 277l16-135h39l16 135z" fill="#f1e5c7"/><path d="M739 142h52v-30h-52z" fill="#c77950"/><path d="M730 112l35-30 35 30z" fill="#785b52"/><path d="M748 230h38M752 190h28" stroke="#c77950" stroke-width="13"/><path d="M746 127L578 72v105z" fill="#fff4b4" opacity=".4"/></g>
 <g class="${visible(2)}"><path d="M415 283v-54l44-35 44 35v54" fill="#eee2c2"/><path d="M403 232l56-43 56 43" fill="none" stroke="#b77252" stroke-width="9"/><circle cx="442" cy="262" r="9" fill="#8d684e"/><circle cx="478" cy="262" r="9" fill="#997257"/><path d="M432 282v-11h20v11m16 0v-11h20v11" fill="#28667b"/></g>
 <g class="${visible(3)}"><path d="M300 207v86m310-86v86M300 212q155 58 310 0" fill="none" stroke="#735d49" stroke-width="4"/><path d="M320 219l12 25 14-18m33 9 12 25 14-20m34 23 14-26 14 26m34-24 12 23 14-26m32-13 12 22 14-29" fill="#e5b45d" stroke="#b97d4e" stroke-width="2"/></g>
 <g class="${visible(4)}"><path d="M550 290v-55l65-40 65 40v55" fill="#f0deae"/><path d="M542 236l73-46 73 46" fill="none" stroke="#b86c51" stroke-width="10"/><path d="M569 290v-41h27v41m23 0v-41h27v41" fill="#497e7c"/><path d="M589 182l8-12 8 12-8 12zm44-17 8-12 8 12-8 12z" fill="#efd283"/></g></svg>`;
}
export const harborRequirements = [
  '첫 섬 완주 · 귀환의 배',
  '지도 3개 · 등대',
  '이야기 2개 · 동료의 집',
  '별자리 3개 · 별빛 깃발',
  '세 섬 완주 + 도장 3개 · 귀환 축제',
];
export function journalCards(j: Journal) {
  return `<section class="journal-section"><h2>선택한 도전의 도장 · ${j.stamps.length}/12</h2><div class="stamp-grid">${Object.entries(
    ADVENTURE_PLANS,
  )
    .flatMap(([id], index) =>
      Object.entries(GOALS).map(
        ([goal, g]) =>
          `<div class="stamp ${j.stamps.includes(id + '-' + goal) ? 'earned' : ''}"><b>${j.stamps.includes(id + '-' + goal) ? '✓' : '○'} ${g.name}</b><small>섬 ${index + 1} · ${g.description}</small></div>`,
      ),
    )
    .join(
      '',
    )}</div></section><section class="journal-section"><h2>완성한 별자리 · ${j.constellations.length}/9</h2><div class="stamp-grid">${Object.values(
    ADVENTURE_PLANS,
  )
    .flatMap(p =>
      p.constellations.map(
        c =>
          `<div class="stamp ${j.constellations.includes(c.id) ? 'earned' : ''}">${constellationIcon(c.shape)}<b>${c.name}</b><small>${j.constellations.includes(c.id) ? '완성' : '별빛 다섯 개를 이어 보세요'}</small></div>`,
      ),
    )
    .join(
      '',
    )}</div></section><section class="journal-section"><h2>숨은 이야기 · ${j.stories.length}/6</h2><div class="stamp-grid">${Object.values(
    ADVENTURE_PLANS,
  )
    .flatMap(p =>
      p.stories.map(
        s =>
          `<button class="stamp ${j.stories.includes(s.id) ? 'earned' : ''}" data-action="discovery:${s.id}" ${j.stories.includes(s.id) ? '' : 'disabled'}><b>${j.stories.includes(s.id) ? s.title : '아직 발견하지 못한 글귀'}</b><small>${s.pose === 'upper' ? '높은 유적길에서' : '낮은 돌 앞에서 숙이기'}</small></button>`,
      ),
    )
    .join(
      '',
    )}</div></section><section class="journal-section"><h2>발견한 아이템 조합 · ${j.combos.length}/2</h2><div class="stamp-grid">${Object.entries(
    COMBOS,
  )
    .map(
      ([id, c]) =>
        `<div class="stamp ${j.combos.includes(id as keyof typeof COMBOS) ? 'earned' : ''}"><b>${j.combos.includes(id as keyof typeof COMBOS) ? '✓' : '○'} ${c.name}</b><small>${c.description}</small></div>`,
    )
    .join('')}</div></section>`;
}
