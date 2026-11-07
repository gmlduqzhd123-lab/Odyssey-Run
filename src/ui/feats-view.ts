import {ACHIEVEMENTS, WEEKLY_TASKS, badgeEarned, streaks, weekKey, weeklyTasks} from '../storage/feats';
import type {Save} from '../storage/save';
import {button} from './html';
import {SEASON_GOALS, monthKey, seasonCount, seasonGoals, seasonMet, titleFor} from '../storage/season';
// Achievements, this week's three challenges and the voyage calendar for the current month.
export function featsMarkup(header: string, save: Save, today: string) {
  const week = weekKey(today),
    counts = save.weekly.week === week ? save.weekly.counts : {},
    tasks = weeklyTasks(week),
    claimed = save.weekly.week === week && save.weekly.claimed,
    done = ACHIEVEMENTS.filter(a => badgeEarned(save, a)),
    streak = streaks(save.days, today);
  const weekly = tasks
    .map(id => {
      const t = WEEKLY_TASKS[id],
        n = Math.min(t.target, counts[id] ?? 0);
      return `<article class="weekly-task ${n >= t.target ? 'complete' : ''}"><b>${n >= t.target ? '✓' : '◇'} ${t.name}</b><small>${t.description}</small><progress max="${t.target}" value="${n}" aria-label="${t.name} ${n}/${t.target}"></progress><span>${n} / ${t.target}</span></article>`;
    })
    .join('');
  const month = monthKey(today),
    met = seasonMet(save, month),
    season = seasonGoals(month)
      .map(id => {
        const g = SEASON_GOALS[id],
          n = Math.min(g.target, seasonCount(save, id, month));
        return `<article class="weekly-task ${n >= g.target ? 'complete' : ''}"><b>${n >= g.target ? '✓' : '◇'} ${g.name}</b><small>${g.description}</small><progress max="${g.target}" value="${n}" aria-label="${g.name} ${n}/${g.target}"></progress><span>${n.toLocaleString()} / ${g.target.toLocaleString()}</span></article>`;
      })
      .join(''),
    titles = save.season.won
      .map(m => `<span class="season-title">👑 ${titleFor(m)} <small>${m}</small></span>`)
      .join('');
  const seasonMarkup = `<section class="feats-section season"><h2>이번 달 시즌 도전 <small>${month}</small></h2><p class="muted"><span>네 가지를 모두 해내면 칭호 「${titleFor(month)}」를 받아요. 한 달 동안 이어지고, 매달 1일에 바뀌어요.</span>${met ? ' <b>✓ 이번 달 칭호를 받았어요!</b>' : ''}</p><div class="weekly-grid">${season}</div>${titles ? `<div class="season-titles">${titles}</div>` : ''}</section>`;
  const [year, monthNo] = today.split('-').map(Number),
    first = new Date(Date.UTC(year, monthNo - 1, 1)),
    lead = (first.getUTCDay() + 6) % 7,
    length = new Date(Date.UTC(year, monthNo, 0)).getUTCDate(),
    sailed = new Set(save.days),
    cells = [
      ...['월', '화', '수', '목', '금', '토', '일'].map(d => `<span class="cal-head">${d}</span>`),
      ...Array.from({length: lead}, () => '<span></span>'),
      ...Array.from({length}, (_, i) => {
        const date = `${year}-${String(monthNo).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
          on = sailed.has(date);
        return `<span class="cal-day ${on ? 'sailed' : ''} ${date === today ? 'today' : ''}" ${on ? 'aria-label="' + (i + 1) + '일 항해함"' : ''}>${on ? '⚓' : i + 1}</span>`;
      }),
    ].join('');
  return `<div class="page feats">${header}<div class="page-heading"><span class="eyebrow">BADGES · WEEKLY · SEASON</span><h1 tabindex="-1">업적과 주간 도전</h1><p>항해할수록 배지가 쌓여요. 점수를 쓰지 않고, 기록은 이 기기에만 남아요.</p></div><section class="feats-section"><h2>이번 주 도전 <small>${week}</small></h2><p class="muted"><span>같은 반 친구 모두 같은 도전이에요. 월요일마다 바뀌어요.</span>${claimed ? ' <b>✓ 이번 주 도전을 모두 해냈어요!</b>' : ''} <span>지금까지 ${save.weekly.done}주 완수.</span></p><div class="weekly-grid">${weekly}</div></section>${seasonMarkup}<section class="feats-section"><h2>항해 달력 <small>${year}년 ${monthNo}월</small></h2><p class="muted">연속 ${streak.current}일 · 최고 연속 ${streak.best}일 · 모두 ${save.days.length}일 항해했어요.</p><div class="calendar" role="grid" aria-label="${monthNo}월 항해 달력">${cells}</div></section><section class="feats-section"><h2>배지 <small>${done.length} / ${ACHIEVEMENTS.length}</small></h2><div class="badge-grid">${ACHIEVEMENTS.map(
    a =>
      `<article class="badge ${badgeEarned(save, a) ? 'earned' : ''}"><span class="badge-icon" aria-hidden="true">${badgeEarned(save, a) ? a.icon : '🔒'}</span><b>${a.name}</b><small>${a.description}</small></article>`,
  ).join(
    '',
  )}</div></section><div class="page-foot">${button('journal', '모험 수첩', 'secondary')}${button('islands', '항해하러 가기 →', 'primary')}</div></div>`;
}
