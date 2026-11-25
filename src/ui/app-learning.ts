import {getLang, translate} from '../i18n';
import {koreanDay} from '../levels/daily';
import {ADVENTURE_PLANS} from '../levels/adventure';
import {loadQuizText, quizIds, quizReady, quizText} from '../levels/quiz';
import {button, downloadFile, icon, readButton} from './html';
import {bookNav} from './book-nav';
import {harborArt, harborUnlocks, harborRequirements, journalCards} from './adventure-view';
import {COURSES, STAGES, MAP_STORIES, type StageId} from '../levels/courses';
import {SAVE_KEY} from '../storage/save';
import {PRESETS, PRESET_IDS, readPreset} from '../storage/lesson-preset';
import {addNote, noteBanner, noteModeAvailable, readNotes, tappedText} from './translation-report';
import type {CheckId} from './device-check';
import {recordQuiz} from '../storage/feats';
import {CHAPTERS, chapter, chapterOpen} from '../levels/chronicle';
import type {App} from './app';
import {pageViews, bookPages, deviceCheck, readingView, wordCards} from './app-shared';
// The learning pages: the myth book, the journal, the lesson notes and presets, the device check, readings, word cards, the quiz and the chronicle. Methods of App (see ui/app),
// kept here to keep that file readable.
export const learningMethods = {
  bookPage(this: App, show: (pages: Awaited<ReturnType<typeof bookPages>>) => void) {
    return this.later(bookPages, show);
  },
  codex(this: App) {
    const found = new Set(STAGES.flatMap(id => this.store.data.stages[id].maps));
    void this.bookPage(b => this.set(b.codexPage(this.header('귀환의 지도'), found), 'codex'));
  },
  landscapes(this: App) {
    void this.bookPage(b => this.set(b.landscapesPage(this.header('항해 도감')), 'landscapes'));
  },
  sheet(this: App, id: string) {
    void this.bookPage(b => {
      const html = b.sheetPage(this.header('풍경과 원화', 'landscapes'), id);
      if (html) this.set(html, 'sheet');
    });
  },
  people(this: App) {
    void this.bookPage(b => this.set(b.peoplePage(this.header('항해 도감')), 'people'));
  },
  person(this: App, id: string) {
    void this.bookPage(b => {
      const html = b.personPage(id);
      if (html) this.set(html, 'person');
    });
  },
  relics(this: App) {
    void this.bookPage(b => this.set(b.relicsPage(this.header('항해 도감')), 'relics'));
  },
  bestiary(this: App) {
    void this.bookPage(b => this.set(b.bestiaryPage(this.header('항해 도감')), 'bestiary'));
  },
  journal(this: App) {
    this.abandon();
    this.world.showHome();
    const j = this.store.data.journal;
    this.set(
      `<div class="page journal">${this.header('모험 수첩')}<div class="page-heading"><span class="eyebrow">YOUR OWN ODYSSEY</span><h1 tabindex="-1">나만의 모험을 채워요</h1><p>도전 도장과 발견은 결과 화면에서 기록돼요. 점수와 별빛을 소비하지 않아요.</p></div>${bookNav('journal')}${journalCards(j)}<section class="journal-section"><h2>다시 달릴 항로</h2><p>${STAGES.map(id => `${COURSES[id].name}: ${j.routes.includes(id + '-upper') ? '✓ 높은 길' : '○ 높은 길'} · ${j.routes.includes(id + '-lower') ? '✓ 아래 길' : '○ 아래 길'}`).join('<br>')}</p></section><section class="journal-section"><h2>신화 퀴즈</h2><p>맞힌 문제 ${this.store.data.quiz.length} / ${quizIds.length}</p>${button('quiz', '한 문제 풀기', 'secondary')}<p>📒 오답 노트 ${this.store.data.play.missed.length}문제 · 다시 맞힌 문제 ${this.store.data.play.mastered}</p>${this.store.data.play.missed.length ? button('retry', '오답 노트 풀기', 'secondary') : ''}</section><section class="journal-section"><h2>읽기와 낱말</h2><p>완주한 섬의 짧은 글을 읽고 답해요. 다 읽은 섬 ${this.store.data.play.readings.length}/${STAGES.length}</p><div class="button-row">${button('readings', '📖 섬 이야기 읽기', 'secondary')}${button('cards', '📇 인물 낱말 카드', 'secondary')}</div></section><section class="journal-section"><h2>오디세이아 연대기</h2><p>트로이에서 이타카까지, 완주한 섬의 그림 이야기를 다시 봐요.</p>${button('chronicle', '연대기 보기', 'secondary')}</section><section class="journal-section"><h2>업적과 주간 도전</h2><p>배지·이번 주 도전·항해 달력을 한눈에 봐요.</p>${button('feats', '업적 보기', 'secondary')}</section><div class="page-foot">${button('islands', '다음 모험으로 →', 'primary')}</div></div>`,
      'journal',
    );
  },
  harbor(this: App) {
    this.abandon();
    this.world.showHome();
    const save = this.store.data,
      done = STAGES.filter(id => save.stages[id].complete).length,
      maps = STAGES.reduce((n, id) => n + save.stages[id].maps.length, 0),
      unlocks = harborUnlocks(save.journal, done, maps);
    this.set(
      `<div class="page harbor">${this.header('이타카 항구')}<div class="page-heading"><span class="eyebrow">A HOME WORTH RETURNING TO</span><h1 tabindex="-1">모험이 쌓이는 우리 항구</h1><p>배·등대·동료의 집·별빛 깃발·축제를 하나씩 완성해요. ${unlocks.filter(Boolean).length}/5 완성</p></div><div class="harbor-picture">${harborArt(unlocks, save.preferences.sail)}</div><div class="harbor-checklist">${harborRequirements.map((text, i) => `<span class="${unlocks[i] ? 'complete' : ''}">${unlocks[i] ? '✓' : '○'} ${text}</span>`).join('')}</div><div class="page-foot">${button('islands', '항구를 위한 모험 →', 'primary')}${button('journal', '모험 수첩', 'secondary')}</div></div>`,
      'harbor',
    );
  },
  discovery(this: App, id: string) {
    const story = Object.values(ADVENTURE_PLANS)
      .flatMap(p => p.stories)
      .find(s => s.id === id);
    if (!story || !this.store.data.journal.stories.includes(id)) return;
    this.set(
      `<div class="veil"><section class="panel story"><span class="eyebrow">HIDDEN WORDS</span><h1 tabindex="-1">${story.title}</h1><p class="read-text">${story.story}</p>${readButton()}${button('journal', '모험 수첩으로', 'primary')}</section></div>`,
      'discovery',
    );
  },
  blessingAllowed(this: App) {
    const preset = readPreset(this.storage);
    return !preset || PRESETS[preset].blessing;
  },
  // Lesson presets (see storage/lesson-preset), changed behind the teacher's lock.
  presetMarkup(this: App) {
    const on = readPreset(this.storage);
    return `<section class="lesson-presets"><h2>수업 프리셋</h2><p class="muted">한 번 고르면 이 기기의 모든 항해사에게 쉬운 항해·날씨·축복 설정이 함께 적용돼요.${on ? ` 지금: <b>${PRESETS[on].name}</b>` : ' 지금은 꺼져 있어요.'}</p><div class="preset-grid">${PRESET_IDS.map(id => `<div><b>${PRESETS[id].name}</b><small>${PRESETS[id].description}</small>${button('preset:' + id, on === id ? '✓ 적용 중' : '적용', on === id ? 'secondary' : 'primary', on === id ? 'aria-pressed="true"' : '')}</div>`).join('')}</div>${on ? button('preset:off', '프리셋 끄기', 'text-button') : ''}</section>`;
  },
  notesMarkup(this: App) {
    if (!noteModeAvailable()) return '';
    const n = readNotes(this.storage).length;
    return `<section class="translation-notes"><h2>번역 고치기 도움</h2><p class="muted">이상한 번역을 눌러서 메모를 남기고, 파일로 내보내 선생님께 전달해요. 지금 메모 ${n}개.</p><div class="button-row">${button('note-mode', '✏️ 번역 신고 모드 켜기', 'secondary')}${n ? button('note-export', '메모 내보내기', 'secondary') + button('note-clear', '메모 모두 지우기', 'text-button') : ''}</div></section>`;
  },
  setNoteMode(this: App, on: boolean) {
    this.noteMode = on && noteModeAvailable();
    document.querySelector('.note-banner')?.remove();
    const app = document.querySelector<HTMLElement>('#app')!;
    app.toggleAttribute('data-note-mode', this.noteMode);
    if (this.noteMode) document.body.insertAdjacentHTML('beforeend', noteBanner());
  },
  // With the note mode on, a tap on text asks for a note instead of pressing the button.
  noteTap(this: App, e: MouseEvent) {
    const target = e.target as Element;
    if (target.closest('[data-note-off]')) {
      this.setNoteMode(false);
      return;
    }
    if (!this.noteMode || !target.closest('#ui')) return;
    e.preventDefault();
    e.stopPropagation();
    const text = tappedText(target);
    if (!text) return;
    const note = window.prompt(translate('“{x}” — 어떤 점이 이상한가요?').replace('{x}', text.slice(0, 80)));
    if (note === null || !note.trim()) return;
    const n = addNote(this.storage, {lang: getLang(), text, note: note.trim(), screen: this.screen});
    this.notice(translate('번역 메모를 남겼어요. 지금 {n}개예요.').replace('{n}', String(n)));
  },
  deviceCheckPage(this: App) {
    void this.later(deviceCheck, m =>
      this.set(m.deviceCheckMarkup(this.header('기기 점검', 'settings'), this.checks), 'device-check'),
    );
  },
  async runChecks(this: App, arg: string) {
    if (this.screen !== 'device-check') return;
    const m = await deviceCheck();
    if (arg === 'copy') {
      const d = this.deviceStatus(),
        text = m.resultsText(this.checks, `${navigator.userAgent} · ${d.screen.join('×')} · DPR ${d.ratio}`);
      try {
        await navigator.clipboard.writeText(text);
        this.setText('#check-status', '결과를 복사했어요. 메모나 메신저에 붙여 넣어 주세요.');
      } catch {
        this.setText('#check-status', '복사하지 못했어요. 화면을 찍어 두셔도 돼요.');
      }
      return;
    }
    const ids = (arg === 'all' ? m.CHECKS.map(c => c.id) : [arg]) as CheckId[];
    for (const id of ids) {
      if (!m.CHECKS.some(c => c.id === id)) continue;
      this.setText(`#check-${id}`, '점검 중…');
      this.checks[id] = await m.runCheck(id, () => {
        this.sound.unlock();
        this.sound.stinger('mission');
        return this.store.data.settings.sfx;
      });
      if (this.screen !== 'device-check') return;
    }
    this.set(m.deviceCheckMarkup(this.header('기기 점검', 'settings'), this.checks), 'device-check');
  },
  // An island's reading (open once the island is complete); both answers right records it.
  reading(this: App, id: string) {
    if (!STAGES.includes(id as StageId) || !this.store.data.stages[id as StageId].complete) return;
    this.abandon();
    this.world.showHome();
    void this.later(readingView, m => {
      const r = m.readingFor(id);
      if (r) this.set(m.readingMarkup(this.header('섬 이야기 읽기', 'readings'), r), 'reading');
    });
  },
  async readingCheck(this: App, id: string) {
    if (this.screen !== 'reading') return;
    const m = await readingView(),
      r = m.readingFor(id);
    if (!r) return;
    const chosen = r.questions.map((_, i) => {
      const v = this.ui.querySelector<HTMLInputElement>(`input[name="reading-${i}"]:checked`)?.value;
      return v === undefined ? null : Number(v);
    });
    if (chosen.some(c => c === null)) return this.setText('#reading-status', '두 질문에 모두 답해 주세요.');
    if (r.questions.every((q, i) => chosen[i] === q.answer) && !this.store.data.play.readings.includes(id)) {
      this.store.data.play.readings = STAGES.filter(s => s === id || this.store.data.play.readings.includes(s));
      this.store.persist();
    }
    this.set(m.readingMarkup(this.header('섬 이야기 읽기', 'readings'), r, chosen, true), 'reading');
  },
  async turnCard(this: App, i: number) {
    const g = this.cardGame;
    if (!g || this.screen !== 'cards') return;
    const m = await wordCards(),
      how = m.turnCard(g, i),
      show = () =>
        this.screen === 'cards' &&
        this.set(m.cardsMarkup(this.header('인물 낱말 카드', 'journal'), g, this.store.data.play.cards), 'cards');
    clearTimeout(this.cardTimer);
    if (m.cardsDone(g) && (!this.store.data.play.cards || g.turns < this.store.data.play.cards)) {
      this.store.data.play.cards = g.turns;
      this.store.persist();
    }
    show();
    this.ui.querySelector<HTMLElement>(`[data-action="card:${i}"]`)?.focus();
    if (how === 'miss')
      this.cardTimer = window.setTimeout(() => {
        g.open = [];
        show();
      }, 900);
  },
  quiz(this: App) {
    if (this.screen !== 'quiz' && this.screen !== 'quiz-answer')
      this.quizReturn = ['people', 'journal'].includes(this.screen) ? this.screen : 'islands';
    // The questions' text loads after the home screen; a very early quiz waits for it.
    if (!quizReady()) {
      void this.later(loadQuizText, () => this.quiz());
      return;
    }
    this.abandon();
    const done = this.store.data.quiz,
      missed = this.store.data.play.missed,
      // The wrong-answer notebook asks only its own questions (and ends when it is empty).
      notebook = this.quizRetry ? quizText().filter(q => missed.includes(q.id)) : [],
      open = quizText().filter(q => !done.includes(q.id) && q.id !== this.question?.id),
      pool = notebook.length ? notebook : open.length ? open : quizText().filter(q => q.id !== this.question?.id);
    if (this.quizRetry && !notebook.length) this.quizRetry = false;
    this.question = pool[Math.floor(Math.random() * pool.length)];
    const q = this.question;
    this.set(
      `<div class="veil"><section class="panel quiz-panel"><span class="eyebrow">${this.quizRetry ? `📒 오답 노트 · 남은 문제 ${missed.length}` : `MYTH QUIZ · 맞힌 문제 ${done.length}/${quizIds.length}`}</span><h1 tabindex="-1">${q.question}</h1><div class="quiz-options">${q.options.map((o, i) => button('quiz-answer:' + i, `<b>${'ABC'[i]}</b> ${o}`, 'secondary')).join('')}</div>${readButton()}${button(this.quizReturn, '그만 풀기', 'text-button')}<small>점수·해금과 상관없이 언제든 풀 수 있어요.</small></section></div>`,
      'quiz',
    );
  },
  quizAnswer(this: App, choice: number) {
    const q = this.question;
    if (!q || this.screen !== 'quiz') return;
    const right = choice === q.answer;
    this.store.data = recordQuiz(this.store.data, q.id, choice, koreanDay());
    if (right && !this.store.data.quiz.includes(q.id)) this.store.data.quiz.push(q.id);
    this.store.persist();
    this.set(
      `<div class="veil"><section class="panel quiz-panel" data-correct="${right}"><span class="eyebrow">MYTH QUIZ · 맞힌 문제 ${this.store.data.quiz.length}/${quizIds.length}</span><h1 tabindex="-1">${right ? '정답이에요!' : '아쉬워요, 다음엔 맞힐 수 있어요'}</h1><p><b>정답: ${q.options[q.answer]}</b></p><p class="read-text">${q.explain}</p>${readButton()}<div class="button-row">${this.quizRetry && this.store.data.play.missed.length ? button('retry', `오답 노트 계속 (${this.store.data.play.missed.length})`, 'primary') : button('quiz', '한 문제 더', 'primary')}${button(this.quizReturn, '돌아가기', 'secondary')}</div></section></div>`,
      'quiz-answer',
    );
  },
  quit(this: App) {
    const unfinished = !!this.run && !this.result;
    this.abandon();
    this.world.showHome();
    this.set(
      `<div class="veil"><section class="panel quit-panel"><span class="eyebrow">UNTIL OUR NEXT VOYAGE</span><h1 tabindex="-1">오늘의 항해를 마쳤어요</h1><p>게임과 소리는 멈췄어요.<br>확정된 기록과 설정은 그대로 보관해요.${unfinished ? '<br>진행 중이던 판의 임시 점수와 발견은 반영하지 않아요.' : ''}</p><div class="button-row">${button('home', '시작 화면으로', 'primary')}${button('close-tab', '탭 닫기', 'secondary')}</div><small>탭 닫기가 지원되지 않으면 브라우저의 닫기 버튼을 사용해 주세요.</small></section></div>`,
      'quit',
    );
  },
  chronicle(this: App) {
    this.abandon();
    this.world.showHome();
    void this.later(pageViews, ([, c]) =>
      this.set(c.chronicleMarkup(this.header('오디세이아 연대기'), this.store.data), 'chronicle'),
    );
  },
  scene(this: App, arg: string) {
    const [id, n] = arg.split(':'),
      c = chapter(id);
    if (!c || !chapterOpen(this.store.data, c.id)) return;
    if (!['scene', 'chronicle'].includes(this.screen))
      this.sceneBack = this.screen === 'result' ? 'islands' : 'chronicle';
    else if (this.screen === 'chronicle') this.sceneBack = 'chronicle';
    const line = Math.max(0, Math.min(c.lines.length - 1, Number(n) || 0)),
      later = CHAPTERS.slice(CHAPTERS.indexOf(c) + 1).find(x => chapterOpen(this.store.data, x.id)) ?? null;
    void this.later(pageViews, ([, v]) =>
      this.set(v.sceneMarkup(c, line, this.sceneBack === 'chronicle' ? later : null, this.sceneBack), 'scene'),
    );
  },
  async poster(this: App) {
    const status = this.ui.querySelector('#poster-status');
    try {
      const [, {posterBlob}] = await pageViews(),
        blob = await posterBlob(this.store.data, this.profiles.active.name);
      downloadFile(blob, 'odyssey-run-chronicle.png', 'image/png');
      if (status) status.textContent = translate('연표 포스터를 저장했어요.');
    } catch {
      if (status) status.textContent = translate('포스터를 만들지 못했어요.');
    }
  },
  story(this: App, index: number) {
    const id = `${STAGES[Math.floor(index / 3)]}-map-${(index % 3) + 1}`;
    if (!STAGES.some(s => this.store.data.stages[s].maps.includes(id))) return;
    const [title, text] = MAP_STORIES[index];
    this.set(
      `<div class="veil"><section class="panel story">${icon('map')}<span class="eyebrow">FRAGMENT ${String(index + 1).padStart(2, '0')}</span><h1 tabindex="-1">${title}</h1><p class="read-text">${text}</p>${readButton()}${button('codex', '도감으로 돌아가기', 'primary')}</section></div>`,
      'story',
    );
  },
  // True at most once a week per hint, so tips do not repeat every visit.
  weekly(this: App, name: string) {
    try {
      const key = SAVE_KEY + ':' + name,
        last = Number(this.storage?.getItem(key) ?? 0);
      if (Date.now() - last < 7 * 86_400_000) return false;
      this.storage?.setItem(key, String(Date.now()));
    } catch {}
    return true;
  },
  sheetZoom(this: App) {
    if (this.screen !== 'sheet') return;
    const expanded = this.ui.querySelector('.sheet-viewer')!.classList.toggle('expanded'),
      b = this.ui.querySelector('[data-action="sheet-zoom"]')!;
    b.setAttribute('aria-pressed', String(expanded));
    b.textContent = translate(expanded ? '화면에 맞추기' : '원본 크기로 확대');
  },
};
