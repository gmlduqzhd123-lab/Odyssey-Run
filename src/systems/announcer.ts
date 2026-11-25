// Short spoken notes for screen readers while a run plays: the moments that matter (a hit, a map,
// fever, a mission, the chase, the finish), at most one every 1.2 seconds so the reader keeps up.
// The latest note wins; the rest of the run is told by the score and hearts on the HUD.
export const ANNOUNCED: Record<string, string> = {
  hurt: '체력 −1',
  fall: '떨어졌어요. 안전지점으로!',
  map: '지도 조각 발견!',
  fever: '피버 타임!',
  'mission-start': '돌발 미션!',
  mission: '미션 성공!',
  'mission-fail': '미션 실패',
  'chase-start': '추격이 시작됐어요!',
  chase: '추격을 따돌렸어요!',
  gate: 'O/X 문을 지났어요',
  treasure: '숨은 보물 발견!',
  revive: '친구가 일으켜 줬어요!',
  finish: '완주!',
  weak: '보스 약점 타격!',
};
export const ANNOUNCE_GAP = 1.2;
export class Announcer {
  private next = '';
  private last = -Infinity;
  // Words the screen only draws on the canvas (an O/X question, a prologue step, a boss phase).
  say(text: string) {
    if (text) this.next = text;
  }
  push(kind: string, text?: string) {
    const base = ANNOUNCED[kind];
    if (base === undefined) return;
    this.next = text || base;
  }
  // The note to speak now, if any (time in seconds).
  take(now: number) {
    if (!this.next || now - this.last < ANNOUNCE_GAP) return '';
    const note = this.next;
    this.next = '';
    this.last = now;
    return note;
  }
  reset() {
    this.next = '';
    this.last = -Infinity;
  }
}
