import {STAGES} from '../levels/courses';
import {MAIN_PROFILE, MAX_NAME, MAX_PROFILES, type Profiles} from '../storage/profiles';
import {button, esc} from './html';
// The sailors page: add, rename, numbered sailors at once, and the on-device class board.
export const profilesMarkup = (
  header: string,
  board: ReturnType<Profiles['board']>,
  active: string,
  sailors: number,
  message: string,
) =>
  `<div class="page profiles">${header}<div class="page-heading"><span class="eyebrow">ONE DEVICE, MANY SAILORS</span><h1 tabindex="-1">누가 항해할까요?</h1><p>항해사마다 기록·설정·옷장을 따로 저장해요. 이 기기 안에서만 보여요.</p></div><section class="profile-form"><label>항해사 이름 <input id="profile-name" maxlength="${MAX_NAME}" autocomplete="off" placeholder="예: 지우"></label><div class="button-row">${button('profile-add', '새 항해사로 시작', 'primary')}${button('profile-rename', '지금 항해사 이름 바꾸기', 'secondary')}</div><details class="numbered"><summary>번호로 한 번에 만들기</summary><div class="numbered-body"><label>만들 항해사 수 <input id="profile-count" type="number" inputmode="numeric" min="1" max="${MAX_PROFILES}" value="${Math.min(30, MAX_PROFILES - sailors) || 1}"></label>${button('profile-numbered', '만들기', 'secondary')}<small>1번, 2번…처럼 번호 이름을 만들어요. 학생은 자기 번호를 골라 시작해요. 최대 ${MAX_PROFILES}명.</small></div></details><p role="status" id="profile-message">${esc(message)}</p></section><section class="class-board"><h2>우리 반 항해 순위 <small>이 기기에 저장된 기록</small></h2><ol>${board.map((p, i) => `<li class="${p.id === active ? 'active' : ''}"><span class="rank">${i + 1}</span><b translate="no">${esc(p.name)}</b><span>${p.total.toLocaleString()}점</span><span>완주 ${p.islands}/${STAGES.length}</span><span>지도 ${p.maps}</span><span>퀴즈 ${p.quiz}</span>${p.id === active ? '<em>✓ 항해 중</em>' : button('profile-use:' + p.id, '이 항해사로', 'secondary')}${p.id === active || p.id === MAIN_PROFILE ? '' : button('profile-delete:' + p.id, '지우기', 'text-button danger', `aria-label="‘${esc(p.name)}’ 지우기"`)}</li>`).join('')}</ol><small>점수는 섬별 최고 점수의 합이에요. 온라인으로 보내지 않아요.</small>${button('progress', '📋 학생별 진행 현황', 'secondary')}</section></div>`;
export const deleteSailorMarkup = (name: string) =>
  `<div class="veil"><section class="panel"><h1 tabindex="-1">‘${esc(name)}’ 항해사를 지울까요?</h1><p>이 항해사의 기록·설정·백업을 이 기기에서 지워요. 되돌릴 수 없어요.</p><div class="button-row">${button('profiles', '취소', 'secondary')}${button('profile-delete-confirm', '지우기', 'danger-button')}</div></section></div>`;
