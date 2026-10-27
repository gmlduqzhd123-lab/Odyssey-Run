import {COURSES, MAP_STORIES, STAGES} from '../levels/courses';
import {ART_SHEETS, sheetUrl} from '../assets/terrain';
import {assetUrl as asset, PEOPLE, RELICS} from '../assets/catalog';
import {PERSON_MYTHS} from '../levels/quiz';
import {ENEMY_TYPES, type EnemyKind} from '../levels/enemies';
import {MONSTER_ART} from '../assets/expansion-art';
import {button, icon} from './html';
// The read-only book pages (maps, people, relics, monsters, artwork). Each takes the page header.
export const TOTAL_MAPS = STAGES.length * 3;
export function bookNav(active: string) {
  return `<nav class="book-nav" aria-label="도감 종류">${[
    ['codex', '지도 조각'],
    ['journal', '모험 수첩'],
    ['harbor', '이타카 항구'],
    ['people', '여정의 인물'],
    ['relics', '아이템과 상징'],
    ['bestiary', '몬스터'],
    ['landscapes', '풍경과 원화'],
  ]
    .map(([id, label]) => button(id, label, 'book-tab', active === id ? 'aria-current="page"' : ''))
    .join('')}</nav>`;
}

export function codexPage(header: string, found: Set<string>) {
  return `<div class="page codex">${header}<div class="page-heading"><span class="eyebrow">FRAGMENTS OF THE ODYSSEY</span><h1 tabindex="-1">이야기를 모아, 이타카로</h1><p>${found.size ? `${TOTAL_MAPS}조각 중 ${found.size}개를 찾았어요. 조각을 눌러 이야기를 읽어 보세요.` : '아직 지도가 비어 있어요. 첫 섬으로 탐험을 떠나 보세요!'}</p></div>${bookNav('codex')}<div class="fragment-grid">${STAGES.flatMap(
    (id, i) =>
      [1, 2, 3].map((n, j) => {
        const idx = i * 3 + j,
          yes = found.has(`${id}-map-${n}`);
        return `<button class="fragment ${yes ? 'found' : ''}" data-action="story:${idx}" ${yes ? '' : 'disabled'}>${yes ? icon('map') : '<span class="unknown">?</span>'}<span class="fragment-number">0${idx + 1}</span><b>${yes ? MAP_STORIES[idx][0] : '아직 발견하지 못했어요'}</b><small>${COURSES[id].name} · ${n}번 조각</small></button>`;
      }),
  ).join(
    '',
  )}</div><div class="page-foot"><span>${found.size === TOTAL_MAPS ? '모든 지도가 모였어요. 당신만의 오디세이가 완성됐네요.' : '지도는 기본 경로, 2단 점프 경로, 슬라이드 경로에서 찾을 수 있어요.'}</span>${button('islands', '탐험하기 →', 'text-button')}</div></div>`;
}

export function landscapesPage(header: string) {
  return `<div class="page landscapes">${header}<div class="page-heading"><span class="eyebrow">ISLANDS & LEGENDS</span><h1 tabindex="-1">바다 너머의 풍경과 전설</h1><p>원화를 누르면 크게 볼 수 있어요. 그림 속 다른 섬과 몬스터는 이야기로 만나요.</p></div>${bookNav('landscapes')}<div class="sheet-grid">${ART_SHEETS.map(s => `<button class="sheet-card" data-action="sheet:${s.id}"><img src="${sheetUrl(s.id)}" alt="${s.name} 원화 미리보기" loading="lazy" decoding="async"><span><strong>${s.name}</strong><small>${s.description}</small><b>원화 펼치기 ↗</b></span></button>`).join('')}</div><p class="gallery-note">달리는 항로는 해변·동굴·바람 섬·세이렌의 바다예요. 원화에 적힌 추가 공격과 효과는 이번 항해에 등장하지 않아요.</p></div>`;
}

export function sheetPage(header: string, id: string) {
  const s = ART_SHEETS.find(s => s.id === id);
  if (!s) return null;
  return `<div class="page art-detail">${header}<div class="page-heading"><span class="eyebrow">ODYSSEY ARTBOOK</span><h1 tabindex="-1">${s.name}</h1><p>${s.description}</p><div class="sheet-tools">${button('sheet-zoom', '원본 크기로 확대', 'secondary', 'aria-pressed="false"')}<small>확대 후 그림을 좌우·위아래로 움직여 볼 수 있어요.</small></div></div><div class="sheet-viewer" tabindex="0" role="region" aria-label="${s.name} 확대 그림, 방향키로 이동"><img src="${sheetUrl(s.id)}" alt="${s.name}. 확대해서 원화의 그림과 설명을 살펴보세요."></div><p class="gallery-note">그림 속 추가 공격과 효과는 이번 항해에 등장하지 않아요.</p></div>`;
}

export function peoplePage(header: string) {
  return `<div class="page people">${header}<div class="page-heading"><span class="eyebrow">FACES OF THE ODYSSEY</span><h1 tabindex="-1">귀환의 길에서 만난 사람들</h1><p>인물을 누르면 짧은 이야기를 읽을 수 있어요.</p></div>${bookNav('people')}<div class="cast-grid">${PEOPLE.map(p => `<button class="person-card" data-action="person:${p.id}"><img src="${asset(p.id)}" alt="" loading="lazy" decoding="async"><strong>${p.name}</strong><small>${p.role}</small></button>`).join('')}</div><div class="page-foot"><span>이 모험은 오디세우스의 귀환을 따라가요.</span>${button('quiz', '신화 퀴즈 풀기', 'text-button')}${button('islands', '항해 시작 →', 'text-button')}</div></div>`;
}

export function personPage(id: string) {
  const p = PEOPLE.find(person => person.id === id);
  if (!p) return null;
  return `<div class="veil"><section class="panel character-story"><img class="character-portrait" src="${asset(p.id)}" alt="${p.name}"><span class="eyebrow">${p.role}</span><h1 tabindex="-1">${p.name}</h1><p>${p.story}</p>${PERSON_MYTHS[p.id] ? `<p class="myth-line"><b>『오디세이아』 속 이야기</b>${PERSON_MYTHS[p.id]}</p>` : ''}${button('people', '인물 도감으로 돌아가기', 'primary')}</section></div>`;
}

export function relicsPage(header: string) {
  return `<div class="page relics">${header}<div class="page-heading"><span class="eyebrow">TREASURES OF THE JOURNEY</span><h1 tabindex="-1">모험을 비추는 보물들</h1><p>달리기 아이템 여덟 가지와 항해를 안내하는 상징을 만나 보세요.</p></div>${bookNav('relics')}<div class="relic-grid">${RELICS.map(r => `<article class="relic-card"><img src="${asset(r.id)}" alt="" loading="lazy" decoding="async"><div><span class="relic-kind">${r.kind}</span><h2>${r.name}</h2><p>${r.description}</p></div></article>`).join('')}</div></div>`;
}

export function bestiaryPage(header: string) {
  const cards = (Object.keys(ENEMY_TYPES) as EnemyKind[])
    .map(id => {
      const e = ENEMY_TYPES[id],
        f = MONSTER_ART.frames[id];
      const places = STAGES.map(stage => {
        const count = COURSES[stage].enemies.filter(m => m.kind === id).length;
        return count ? `${COURSES[stage].name} ${count}마리` : '';
      })
        .filter(Boolean)
        .join(' · ');
      return `<article class="relic-card monster-card"><svg viewBox="${f.x} ${f.y} ${f.w} ${f.h}" role="img" aria-label="${e.name}"><image href="${import.meta.env.BASE_URL}${MONSTER_ART.file}" width="1536" height="1024"/></svg><div><span class="relic-kind">${e.hint}로 피하기</span><h2>${e.name}</h2><p>${e.behavior}</p><small>${places}</small></div></article>`;
    })
    .join('');
  return `<div class="page bestiary">${header}<div class="page-heading"><span class="eyebrow">CREATURES ON THE ROAD</span><h1 tabindex="-1">항로에서 만나는 여섯 몬스터</h1><p>머리 위 삼각형과 안내를 살펴보세요. 공격을 미리 알면 안전하게 피할 수 있어요.</p></div>${bookNav('bestiary')}<div class="relic-grid">${cards}</div></div>`;
}
