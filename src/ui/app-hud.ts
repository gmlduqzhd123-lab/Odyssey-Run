import {duoModule} from './app-shared';
import {translate} from '../i18n';
import {BOSSES} from '../levels/bosses';
import {GOALS} from '../levels/adventure';
import {ghostDistance} from '../storage/journal';
import {sectionsPassed} from '../levels/endless';
import {button, esc} from './html';
import {C} from '../config';
import {COURSES} from '../levels/courses';
import {courseGhost} from '../storage/save';
import {VARIANT_LABELS} from '../levels/variants';
import {gateStatement} from '../levels/play-extras';
import {FEVER_FULL} from '../levels/play-dynamics';
import {bossPhase} from '../levels/bosses';
import {comboLabel} from './play-extras-view';
import {WEATHERS} from '../levels/weather';
import type {App} from './app';
// The play HUD: its markup, the screen-reader notes for canvas-only text and the per-frame updates. Methods of App (see ui/app),
// kept here to keep that file readable.
export const hudMethods = {
  hud(this: App) {
    return `<div class="play-ui" tabindex="-1" role="group" aria-label="게임 조작" data-one-button="${this.assist().autoSlide}"><div class="hud"><div class="hp-block"><span class="hud-caption"${this.together ? ' translate="no"' : ''}>${this.together ? esc(this.duo!.names[0]) : this.hero().name}</span><strong id="hp" role="img" aria-label="체력 3"></strong></div><div class="route-progress"><span>${this.special === 'boss' ? BOSSES[this.selected].name : this.special === 'daily' ? '오늘의 항해 · ' + this.daily!.name : this.special === 'contest' ? '대회 · ' + esc(this.contest!.title) : this.special === 'endless' ? (this.endless?.shuffle ? '셔플 항로 · ' : '끝없는 항해 · ') + COURSES[this.selected].name : this.special === 'duo' ? (this.together ? '둘이서 동시에 · ' : '둘이서 번갈아 · ') + COURSES[this.selected].name : this.special === 'custom' ? (this.custom?.name === '나만의 코스' ? '나만의 코스' : '나만의 코스 · ' + esc(this.custom?.name ?? '')) : COURSES[this.selected].name + ' · ' + VARIANT_LABELS[this.selected][this.selectedVariant].name}${this.weatherOn() === 'clear' ? '' : ` · ${WEATHERS[this.weatherOn()].icon} ${WEATHERS[this.weatherOn()].name}`}</span><progress id="progress" data-course="${this.selected}/${this.selectedVariant}" max="24000" value="0" aria-label="섬 진행률"></progress><i id="ghost-marker" hidden aria-label="비교 항해 위치"></i><small id="progress-label">0%</small></div><div class="score-block"><span class="hud-caption">SCORE</span><strong id="score">0</strong></div><div class="hud-actions">${button('fullscreen', '⛶', 'fullscreen-button', 'aria-label="전체 화면 전환"')}${button('pause', 'Ⅱ', 'pause-button', 'aria-label="일시정지"')}</div></div><div class="run-chips"><div class="run-details"><span id="stars">✦ 0 / 100</span><span id="maps">지도 0 / 3</span><span id="effects"></span><span id="combo" aria-live="off"></span><p id="play-live" class="sr-only" aria-live="polite" aria-atomic="true"></p><span id="fever" hidden><i></i></span><span id="mission"></span>${this.assistLabel().length ? `<span class="assist-chip">쉬운 항해 · ${this.assistLabel().join(' · ')}</span>` : ''}</div><div class="adventure-hud"><span id="goal-progress"></span><span id="ghost-delta"></span><span id="discovery-progress"></span></div></div><div class="touch-controls"><button data-control="slide" class="control slide" aria-label="슬라이드, 누르고 유지"><span>⇣</span><b>슬라이드</b><small>↓ 누르기</small></button><button data-control="jump" class="control jump" aria-label="점프, 공중에서 다시 누르면 2단 점프"><span>↟</span><b>점프</b><small>Space / ↑</small></button></div>${this.together ? duoModule!.secondHudMarkup(this.duo!.names[1]) : ''}</div>`;
  },
  canvasNotes(this: App) {
    const r = this.run;
    if (!r) return;
    let key = '',
      text = '';
    const step = r.guide.filter(g => r.x >= g.x).at(-1);
    if (step) [key, text] = ['guide:' + step.x, step.text];
    if (r.gate && r.gateSaid === null && r.x >= r.gate.x - 1500) {
      const g = gateStatement(r.gate);
      [key, text] = [
        'gate',
        `O/X 문제: ${translate(g.question)} → ${translate(g.option)}. 맞으면 점프, 틀리면 그대로 달려요`,
      ];
    }
    if (r.course.mode === 'boss') {
      const phase = bossPhase(r.stage, r.x);
      [key, text] = ['boss:' + phase, BOSSES[r.stage].phases[phase]];
    }
    if (key && key !== this.spoken) {
      this.spoken = key;
      this.announcer.say(translate(text));
    }
  },
  setText(this: App, selector: string, text: string) {
    const el = this.ui.querySelector(selector);
    text = translate(text);
    if (el && el.textContent !== text) el.textContent = text;
  },
  updateHud(this: App) {
    const r = this.run;
    if (!r || !this.ui.querySelector('#hp')) return;
    if (this.run2) duoModule!.updateSecondHud(this.ui, this.run2, (sel, text) => this.setText(sel, text));
    // Progress and the ghost move every frame; everything else is rewritten only when its value changes.
    const progress = this.ui.querySelector<HTMLProgressElement>('#progress')!;
    progress.max = r.length;
    progress.value = Math.min(r.length, r.x);
    progress.dataset.distance = String(r.x);
    progress.dataset.air = String(!r.grounded);
    this.setText('#progress-label', Math.min(100, Math.floor((r.x / r.length) * 100)).toString() + '%');
    const rival = this.rivalFor(this.selected, r.variant),
      ghost = this.special
        ? rival
          ? ghostDistance(rival.ghost, r.time)
          : null
        : ghostDistance(rival?.ghost ?? courseGhost(this.store.data, this.selected, r.variant), r.time),
      who = rival ? (this.special === 'contest' ? `1등 ‘${rival.name}’` : `친구 ‘${rival.name}’`) : '나의 비교 항해',
      marker = this.ui.querySelector<HTMLElement>('#ghost-marker')!;
    marker.hidden = ghost === null;
    // Overtaking (or being caught) is called out; the last tenth shows the gap large.
    if (ghost !== null && r.time > 2 && r.state === 'playing') {
      const sign = r.x - ghost > 30 ? 1 : r.x - ghost < -30 ? -1 : this.ghostSign;
      if (this.ghostSign && sign !== this.ghostSign) {
        this.world.feedback('overtake', r.x, 0, sign > 0 ? `추월! ${who}보다 앞서요` : `${who}에게 따라잡혔어요!`);
        this.sound.stinger(sign > 0 ? 'overtake' : '');
      }
      this.ghostSign = sign;
    }
    this.ui.querySelector('#ghost-delta')?.classList.toggle('close-race', ghost !== null && r.x > r.length * 0.9);
    if (ghost !== null) marker.style.left = `${ghost / 240}%`;
    this.setText(
      '#ghost-delta',
      ghost === null
        ? '이 코스의 첫 기록을 남겨 보세요'
        : Math.abs(r.x - ghost) <= C.speed * C.step * 2
          ? `${who} · 나란히`
          : `${who} ${Math.floor(Math.abs(r.x - ghost) / 10)}m ${r.x >= ghost ? '앞' : '뒤'}`,
    );
    const text = [
      r.hp,
      r.points,
      r.maps.size,
      r.stars,
      Math.ceil(r.wings),
      Math.ceil(r.magnet),
      r.shield,
      r.trident,
      Math.ceil(r.lantern),
      r.goalProgress,
      r.constellations.size,
      r.stories.size,
      r.nearMisses.size,
      r.combo,
      r.weakHits.size,
      Math.round(r.feverGauge),
      Math.ceil(r.fever),
      r.mission ? `${r.mission.progress}/${Math.ceil(r.mission.until - r.time)}` : '',
    ].join();
    if (text === this.lastHud) return;
    this.lastHud = text;
    const hp = this.ui.querySelector('#hp')!;
    hp.innerHTML = `<span>${'♥'.repeat(Math.max(0, r.hp))}</span><em>${'♡'.repeat(3 - Math.max(0, r.hp))}</em>`;
    hp.setAttribute('aria-label', `체력 ${Math.max(0, r.hp)}`);
    this.setText('#score', r.points.toLocaleString());
    this.setText('#stars', `✦ ${r.stars} / 100`);
    this.setText(
      '#maps',
      this.special === 'boss'
        ? `⚔ 보스 약점 ${r.weakHits.size}/${r.weakPoints.length}`
        : this.special === 'custom'
          ? '⚒ 나만의 코스'
          : this.special === 'endless'
            ? `∞ ${sectionsPassed(r.maxDistance)}구간`
            : `지도 ${r.maps.size} / 3`,
    );
    const g = GOALS[r.goal];
    this.setText(
      '#goal-progress',
      this.special
        ? this.special === 'boss'
          ? '⚔ 보스 도전 · 예고를 읽어요'
          : this.special === 'contest'
            ? `⚑ 대회 · ${this.contest!.title}`
            : this.special === 'custom'
              ? `⚒ ${this.custom?.name ?? ''}`
              : this.special === 'duo'
                ? this.together
                  ? `👥 ${this.duo!.names[0]} · ${this.duo!.names[1]} 함께`
                  : `👥 ${this.duo?.names[this.duo.scores.length] ?? ''} 차례`
                : this.special === 'endless'
                  ? `${this.endless!.shuffle ? '🔀 셔플 항로' : '∞ 끝없는 항해'} · ${this.endless!.date} 순서`
                  : `◇ 오늘의 항해 · ${this.daily!.name}`
        : `${r.goalComplete ? '✓' : '◇'} ${g.name} ${Math.min(g.target, r.goalProgress)}/${g.target}`,
    );
    this.setText('#combo', comboLabel(r.combo));
    const fever = this.ui.querySelector<HTMLElement>('#fever')!;
    fever.hidden = !r.extras;
    fever.classList.toggle('on', r.fever > 0);
    fever.querySelector('i')!.style.width = `${r.fever > 0 ? (r.fever / 5) * 100 : (r.feverGauge / FEVER_FULL) * 100}%`;
    fever.setAttribute(
      'aria-label',
      r.fever > 0 ? `피버 ${Math.ceil(r.fever)}초` : `피버 ${Math.round(r.feverGauge)}%`,
    );
    fever.setAttribute('role', 'img');
    const m = r.mission;
    this.setText(
      '#mission',
      !m
        ? ''
        : m.kind === 'clean'
          ? `🎯 상처 없이 · ${Math.ceil(m.until - r.time)}초`
          : `🎯 ${m.kind === 'stars' ? '별빛' : '몬스터 밟기'} ${Math.min(m.progress, m.goal)}/${m.goal} · ${Math.ceil(m.until - r.time)}초`,
    );
    this.setText('#discovery-progress', `✧ 별자리 ${r.constellations.size}/3 · 회피 ${r.nearMisses.size}`);
    this.setText(
      '#effects',
      [
        r.shield ? '⬡ 방패' : '',
        r.trident ? '⚒ 삼지창 1회' : '',
        r.rule === 'lantern' ? '신탁의 등불' : r.lantern > 0 ? `등불 ${Math.ceil(r.lantern)}초` : '',
        r.wings > 0 ? `날개 ${Math.ceil(r.wings)}초` : '',
        r.rule === 'magnet' ? '신탁의 자석' : r.magnet > 0 ? `자석 ${Math.ceil(r.magnet)}초` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    );
  },
};
