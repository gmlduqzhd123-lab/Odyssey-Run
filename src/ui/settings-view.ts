import {STAGES, COURSES} from '../levels/courses';
import {VARIANTS} from '../levels/variants';
import {stampIds, constellationIds, storyIds} from '../levels/adventure';
import {PACES, type Assist} from '../storage/preferences';
import type {Save, Settings} from '../storage/save';
import type {ClassBackup} from '../storage/backup';
import {TOTAL_MAPS} from './book-view';
import {button, esc, icon} from './html';
import {getLang} from '../i18n';
// Settings and the screens that change stored records: restore previews and the reset question.
export const settingToggle = (save: Save, key: keyof Settings, label: string) =>
  `<label class="toggle"><span>${label}</span><input type="checkbox" data-setting="${key}" ${save.settings[key] ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
const assistMarkup = (a: Assist) =>
  `<section class="assist-settings"><h2>쉬운 항해</h2><label>게임 속도 <select data-assist="pace">${PACES.map(p => `<option value="${p}" ${a.pace === p ? 'selected' : ''}>${p === 1 ? '보통 (1배)' : p + '배'}</option>`).join('')}</select></label><label class="toggle"><span>슬라이드 한 번 눌러 유지</span><input type="checkbox" data-assist="slideToggle" ${a.slideToggle ? 'checked' : ''}><i aria-hidden="true"></i></label><label class="toggle"><span>버튼 하나로 항해 (자동 슬라이드)</span><input type="checkbox" data-assist="autoSlide" ${a.autoSlide ? 'checked' : ''}><i aria-hidden="true"></i></label><small>느리게 하면 시간 전체가 함께 느려져 점프 거리와 판정은 그대로예요. 점수 계산도 같아요. 슬라이드 토글은 다시 누르거나 점프하면 일어서요. 버튼 하나 모드는 낮은 문 앞에서 저절로 숙여요.</small></section>`;
export interface SettingsView {
  header: string;
  save: Save;
  assist: Assist;
  blocked: boolean;
  protection: string;
  canAskProtection: boolean;
  // Superseded copies kept from before a record file was restored, and whether a whole-class
  // backup was exported today (tidying them is only offered after one).
  spare: number;
  backedUpToday: boolean;
  // The device asks for reduced motion, which applies whatever the toggle says.
  deviceMotion: boolean;
}
export function settingsMarkup({
  header,
  save,
  assist,
  blocked,
  protection,
  canAskProtection,
  spare,
  backedUpToday,
  deviceMotion,
}: SettingsView) {
  return `<div class="page settings">${header}<div class="settings-layout"><div class="page-heading"><span class="eyebrow">MAKE IT YOUR JOURNEY</span><h1 tabindex="-1">나의 항해 설정</h1><p>기록은 이 기기와 브라우저에 저장돼요.<br>기록 파일로 옮길 수 있어요.</p><div class="save-note">계정 없이, 이 브라우저에만 저장해요.<br>다른 기기와 자동으로 동기화되지는 않아요.</div></div><div class="settings-body"><section><h2>소리와 움직임</h2>${settingToggle(save, 'music', '배경음')}${settingToggle(save, 'sfx', '효과음')}${settingToggle(save, 'reducedMotion', '움직임 줄이기')}<small>기본 배경은 고정돼 있어요. 켜면 장식 무늬와 바람 표시를 더 줄여요. 달리기·점프와 위험 신호는 유지돼요.</small>${deviceMotion ? '<small class="device-note">지금은 기기 설정의 ‘동작 줄이기’를 따라 줄이고 있어요.</small>' : ''}<label class="toggle"><span>진동 (지원하는 휴대폰)</span><input type="checkbox" data-haptics ${save.preferences.haptics ? 'checked' : ''}><i aria-hidden="true"></i></label><small>피격·추락·지도 획득·완주 때 짧게 진동해요. 아이폰 사파리는 진동을 지원하지 않아요.</small><label class="toggle"><span>출발할 때 전체 화면 (휴대폰·태블릿)</span><input type="checkbox" data-autofs ${save.preferences.autoFullscreen ? 'checked' : ''}><i aria-hidden="true"></i></label><small>주소창을 숨기고 화면을 꽉 채워요. 안드로이드는 가로로 고정해요. 아이폰은 공유 → 홈 화면에 추가로 설치하면 꽉 차요.</small></section>${assistMarkup(assist)}<section><h2>화질과 조작</h2><label>그래픽 품질 <select id="quality"><option value="auto" ${save.preferences.quality === 'auto' ? 'selected' : ''}>자동</option><option value="high" ${save.preferences.quality === 'high' ? 'selected' : ''}>선명하게</option><option value="low" ${save.preferences.quality === 'low' ? 'selected' : ''}>가볍게</option></select></label><p class="muted">가볍게는 그림 해상도만 줄여요. 시야·달리기·점프·판정은 같아요.</p>${button('touch-layout', '터치 버튼 맞춤', 'secondary')}</section><section><h2>오프라인과 업데이트</h2>${button('offline', '섬 다운로드·업데이트', 'secondary')}<p class="muted">다운로드한 섬은 오프라인에서도 시작할 수 있어요. 새 버전은 항해를 끝낸 뒤 적용해요.</p><a class="button text-button" href="./${getLang() === 'ko' ? 'school-setup.html' : `school-setup.${getLang()}.html`}" target="_blank" rel="noopener">🏫 학교 기기에 한꺼번에 설치하기</a></section><section><h2>기록 보관함</h2><div class="backup-row">${button('export', icon('map') + ' 기록 내보내기', 'secondary')}<label class="button secondary file-button">기록 가져오기<input id="import-file" type="file" accept="application/json,.json" aria-label="JSON 기록 파일 가져오기"></label></div><p class="muted">UTF-8 JSON · 최대 64KiB · 복원 전 내용을 확인해요.</p>${blocked ? button('original', '보존된 원본 내려받기', 'text-button') : ''}${button('reset-confirm', '이 게임의 기록 초기화', 'danger text-button')}</section><section class="class-backup"><h2>반 전체 백업</h2><div class="backup-row">${button('class-export', '반 전체 내보내기', 'secondary')}<label class="button secondary file-button">반 전체 가져오기<input id="class-import" type="file" accept="application/json,.json" aria-label="반 전체 백업 파일 가져오기"></label></div><p class="muted">모든 항해사의 기록과 대회 순위를 한 파일로 저장해요. 가져오면 이 기기의 기록과 합쳐요. 지우지 않아요.</p><p class="muted" id="protection">${protection}</p>${canAskProtection ? button('protect', '기록 보호 요청', 'text-button') : ''}${spare ? (backedUpToday ? button('storage-tidy', `복원 전 사본 ${spare}개 정리`, 'text-button') : `<p class="muted">복원 전 사본 ${spare}개가 있어요. 오늘 반 전체 내보내기를 하면 정리할 수 있어요.</p>`) : ''}</section><div id="import-error" role="alert"></div><p class="settings-credit">© 2026 엽쌤. All rights reserved. · <a href="https://gmlduqzhd123-lab.github.io/YScode/" target="_blank" rel="noopener">엽쌤의 다른 앱 보기 →</a></p></div></div></div>`;
}
export function importPreviewMarkup(s: Save) {
  return `<div class="veil"><section class="panel"><span class="eyebrow">RESTORE YOUR JOURNEY</span><h1 tabindex="-1">이 기록으로 바꿀까요?</h1><p>완주한 섬 ${STAGES.filter(id => s.stages[id].complete).length}/${STAGES.length} · 지도 ${STAGES.reduce((a, id) => a + s.stages[id].maps.length, 0)}/${TOTAL_MAPS}</p><p class="muted">모험 도장 ${s.journal.stamps.length}/${stampIds.length} · 별자리 ${s.journal.constellations.length}/${constellationIds.length} · 이야기 ${s.journal.stories.length}/${storyIds.length}<br>완주한 코스 ${Object.values(s.courses).filter(r => r?.complete).length}/${STAGES.length * VARIANTS.length}</p><div class="import-list">${STAGES.map(id => `<p><b>${COURSES[id].name}</b><span>${s.stages[id].bestScore}점 / ${s.stages[id].bestRating}★ / 별빛 ${s.stages[id].bestStars}</span></p>`).join('')}</div><p class="muted">현재 진행과 설정을 교체해요.<br>교체 전 원본은 이 게임 전용 백업에 보관해요.</p><div class="button-row">${button('settings', '취소', 'secondary')}${button('import-confirm', '이 기록으로 복원', 'primary')}</div></section></div>`;
}
export function classPreviewMarkup(b: ClassBackup, known: Set<string>) {
  return `<div class="veil"><section class="panel"><span class="eyebrow">RESTORE YOUR CLASS</span><h1 tabindex="-1">반 전체 기록을 합칠까요?</h1><p>항해사 ${b.profiles.list.length}명 · 대회 ${b.contests.hosted.length}개</p><div class="import-list">${b.profiles.list.map(p => `<p><b translate="no">${esc(p.name)}</b><span>${known.has(p.id) ? '합치기' : '새로 추가'}</span></p>`).join('')}</div><p class="muted">같은 항해사는 더 좋은 기록을 남기고, 대회 순위는 이름별 최고 기록을 남겨요. 이 기기의 기록은 지우지 않아요.</p><div class="button-row">${button('settings', '취소', 'secondary')}${button('class-import-confirm', '합쳐서 가져오기', 'primary')}</div></section></div>`;
}
