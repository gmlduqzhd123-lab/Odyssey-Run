import {translate} from '../i18n';
import {button, esc} from './html';
// The device check (settings → 🩺 기기 점검): the real-device checklist as buttons a teacher can
// press on each classroom device. Results stay on screen and can be copied as one block of text.
export type CheckId = 'fps' | 'sound' | 'vibrate' | 'wake' | 'screen' | 'storage' | 'offline';
export const CHECKS: {id: CheckId; name: string; how: string}[] = [
  {id: 'fps', name: '화면 부드러움', how: '5초 동안 화면 그리기 속도를 재요'},
  {id: 'sound', name: '소리', how: '짧은 소리 세 개가 들리면 성공이에요'},
  {id: 'vibrate', name: '진동', how: '휴대폰이 두 번 떨리면 성공이에요'},
  {id: 'wake', name: '화면 켜짐 유지', how: '달리는 동안 화면이 꺼지지 않게 할 수 있는지 봐요'},
  {id: 'screen', name: '전체 화면·가로 고정', how: '이 브라우저가 지원하는지 봐요'},
  {id: 'storage', name: '기록 저장', how: '이 기기에 기록을 저장할 수 있는지 봐요'},
  {id: 'offline', name: '오프라인 준비', how: '인터넷 없이 열 수 있게 설치됐는지 봐요'},
];
export type Results = Partial<Record<CheckId, {ok: boolean; text: string}>>;
export function deviceCheckMarkup(header: string, results: Results) {
  return `<div class="page device-check">${header}<div class="page-heading"><span class="eyebrow">DEVICE CHECK</span><h1 tabindex="-1">🩺 기기 점검</h1><p>교실 기기마다 한 번씩 눌러 보세요. 결과는 이 화면에만 보여요.</p></div><ol class="check-list">${CHECKS.map(
    c => {
      const r = results[c.id];
      return `<li class="${r ? (r.ok ? 'ok' : 'bad') : ''}"><div><b>${c.name}</b><small>${c.how}</small></div><span class="check-result" id="check-${c.id}" role="status">${r ? (r.ok ? '✓ ' : '! ') + esc(r.text) : '아직 안 했어요'}</span>${button('check:' + c.id, '점검', 'secondary')}</li>`;
    },
  ).join(
    '',
  )}</ol><div class="button-row">${button('check:all', '모두 점검', 'primary')}${button('check:copy', '결과 복사', 'secondary')}</div><p role="status" id="check-status"></p></div>`;
}
// Average frames per second over a few seconds of animation frames.
export function measureFps(seconds = 5) {
  return new Promise<number>(resolve => {
    let frames = 0;
    const start = performance.now(),
      step = (t: number) => {
        frames++;
        if (t - start >= seconds * 1000) resolve((frames * 1000) / (t - start));
        else requestAnimationFrame(step);
      };
    requestAnimationFrame(step);
  });
}
type Wake = Navigator & {wakeLock?: {request(t: 'screen'): Promise<{release(): Promise<void>}>}};
// Runs one check; sound is played by the caller (it owns the audio context).
export async function runCheck(id: CheckId, playSound: () => boolean): Promise<{ok: boolean; text: string}> {
  if (id === 'fps') {
    const fps = await measureFps();
    return {
      ok: fps >= 40,
      text: `평균 ${Math.round(fps)}fps${fps < 40 ? ' · 그래픽 품질을 「가볍게」로 두세요' : ''}`,
    };
  }
  if (id === 'sound')
    return playSound()
      ? {ok: true, text: '소리를 냈어요. 들리지 않으면 기기 소리 크기를 확인해 주세요'}
      : {ok: false, text: '효과음이 꺼져 있거나 소리를 낼 수 없어요'};
  if (id === 'vibrate') {
    const ok = typeof navigator.vibrate === 'function' && navigator.vibrate([90, 60, 90]);
    return ok ? {ok: true, text: '진동을 보냈어요'} : {ok: false, text: '이 기기·브라우저는 진동을 지원하지 않아요'};
  }
  if (id === 'wake') {
    const w = (navigator as Wake).wakeLock;
    if (!w) return {ok: false, text: '지원하지 않아요. 기기의 화면 자동 꺼짐 시간을 길게 해 주세요'};
    try {
      const lock = await w.request('screen');
      await lock.release();
      return {ok: true, text: '달리는 동안 화면을 켜 둘 수 있어요'};
    } catch {
      return {ok: false, text: '요청이 거절됐어요. 화면을 한 번 누른 뒤 다시 해 보세요'};
    }
  }
  if (id === 'screen') {
    const full = !!document.fullscreenEnabled,
      lock = 'lock' in (screen.orientation ?? {});
    return {
      ok: full,
      text: `전체 화면 ${full ? '가능' : '불가'} · 가로 고정 ${lock ? '가능' : '불가(직접 돌려야 해요)'}`,
    };
  }
  if (id === 'storage') {
    try {
      localStorage.setItem('odyssey-run:check', '1');
      localStorage.removeItem('odyssey-run:check');
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      return {
        ok: true,
        text: `저장 가능${est?.quota ? ` · 남은 공간 약 ${Math.round((est.quota - (est.usage ?? 0)) / 1048576)}MB` : ''}${persisted ? ' · 보호됨' : ''}`,
      };
    } catch {
      return {ok: false, text: '저장할 수 없어요. 시크릿 모드인지 확인해 주세요'};
    }
  }
  const ready = !!navigator.serviceWorker?.controller;
  return ready
    ? {ok: true, text: '설치됐어요. 섬 다운로드까지 하면 인터넷 없이 달려요'}
    : {ok: false, text: '아직이에요. 한 번 새로 고침하거나 설정 → 섬 다운로드를 눌러 주세요'};
}
export const resultsText = (results: Results, device: string) =>
  [
    translate('오디세이 런 기기 점검'),
    device,
    ...CHECKS.map(c => {
      const r = results[c.id];
      return `${translate(c.name)}: ${r ? (r.ok ? '✓ ' : '! ') + translate(r.text) : translate('아직 안 했어요')}`;
    }),
  ].join('\n');
