import {BLESSINGS, BLESSING_IDS, comboMultiplier, type BlessingId} from '../levels/play-extras';
import {TREASURE_KEYS, type PlayRecord, type RunExtras} from '../storage/play';
import type {StageId} from '../levels/courses';
import type {Quality} from '../storage/preferences';
import {gateStatement, type Gate} from '../levels/play-extras';
// Markup for the playful extras: the blessing picker on the island's start screen, the combo,
// chest and gate lines on the result, and the device status in the settings.
export const blessingPicker = (selected: BlessingId) =>
  `<fieldset class="course-picker blessing-picker"><legend>신의 축복 · 한 판에 하나</legend>${BLESSING_IDS.map(id => {
    const b = BLESSINGS[id];
    return `<label><input type="radio" name="blessing" value="${id}" ${id === selected ? 'checked' : ''}><span><b><i aria-hidden="true">${b.icon}</i> ${b.name}</b><small>${b.description}</small></span></label>`;
  }).join('')}</fieldset>`;
export const comboLabel = (n: number) => {
  const m = comboMultiplier(n);
  return n ? `콤보 ${n}${m > 1 ? ' ×' + m : ''}` : '';
};
export function resultExtrasMarkup(stage: StageId, x: RunExtras | undefined, play: PlayRecord, gate: Gate | null) {
  if (!x) return '';
  const best = play.combos[stage],
    g = gate && x.gate ? gateStatement(gate) : null;
  const newBest = !!best && !!x.comboPoints && x.comboPoints >= best.points;
  return `<div class="extras-result"><span>⛓ 최고 콤보 ${x.combo} · 콤보 점수 ${x.comboPoints.toLocaleString()}${newBest ? ' · NEW BEST' : ''}</span>${x.blessing !== 'none' ? `<span>신의 축복 · ${BLESSINGS[x.blessing].name}</span>` : ''}<span>${x.treasure ? '🗝 숨은 보물 발견!' : '🗝 숨은 보물은 이번엔 못 찾았어요'} · ${play.treasures.length}/${TREASURE_KEYS.length}</span>${g ? `<span>${x.gate!.right ? '⭕ O/X 문 정답' : '❌ O/X 문 오답'} · ${g.question} → 정답 「${g.answer}」</span>` : ''}${x.missions !== undefined ? `<span>🎯 돌발 미션 ${x.missions}/2</span><span>🔥 피버 ${x.fevers ?? 0}번</span><span>👟 몬스터 밟기 ${x.stomps ?? 0}</span><span>${x.chase ? '🏃 추격을 따돌렸어요' : '🏃 추격에 붙잡혔어요'}</span>` : ''}</div>`;
}
export interface DeviceStatus {
  quality: Quality;
  step: number;
  density: number;
  pixels: [number, number];
  screen: [number, number];
  ratio: number;
  memory: number | null;
  fps: number;
  awake: boolean;
}
export function deviceStatusMarkup(d: DeviceStatus) {
  const level =
    d.quality === 'auto'
      ? (['자동 · 선명하게', '자동 · 한 단계 가볍게', '자동 · 가볍게'][d.step] ?? '자동')
      : d.quality === 'high'
        ? '선명하게'
        : '가볍게';
  return `<details class="device-status"><summary>📟 이 기기 상태</summary><dl><dt>그래픽</dt><dd>${level}</dd><dt>그리는 크기</dt><dd translate="no">${d.pixels[0]}×${d.pixels[1]} (×${d.density.toFixed(2)})</dd><dt>게임 화면</dt><dd translate="no">${d.screen[0]}×${d.screen[1]} · DPR ${d.ratio.toFixed(2)}</dd><dt>메모리</dt><dd>${d.memory ? `약 ${d.memory}GB` : '알 수 없음'}</dd><dt>지난 항해</dt><dd>${d.fps ? `평균 ${Math.round(d.fps)}fps${d.fps < 40 ? ' · 끊김이 있었어요' : ''}` : '아직 기록 없음'}</dd><dt>화면 켜짐 유지</dt><dd>${d.awake ? '달리는 동안 켜 둬요' : '이 브라우저는 지원하지 않아요'}</dd></dl><small>이 기기 안에서만 보여요. 평균 40fps보다 낮으면 그래픽 품질을 「가볍게」로 두세요.</small></details>`;
}
