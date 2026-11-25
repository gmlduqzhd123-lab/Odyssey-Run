import {C} from '../config';
import type {Runner} from '../player/runner';
import type {DisplayViewport} from '../rendering/display';
import {CHASERS, ROPE_END, ROPE_TOP} from '../levels/play-dynamics';
import {seeded} from '../levels/endless';
import {FOG} from '../levels/weather';
import type {StageId} from '../levels/courses';
// Drawing for the dynamic parts of a run (see levels/play-dynamics): the wind streaks of a long
// clean run, the spring and the rope, the chase and the harmless scenery moments. Each draws into
// the scene's graphics layers: fx in front of the course, w (weather) behind the hero.
export interface FxLayers {
  fx: Phaser.GameObjects.Graphics;
  w: Phaser.GameObjects.Graphics;
  view: DisplayViewport;
  stage: StageId;
}
// A long run without losing HP draws a light wind streaming past (only the picture changes).
export function drawSpeed(g: FxLayers, r: Runner, rt: number, reduced: boolean) {
  // The chase draws its own motion at the edge; no speed lines over it.
  if (reduced || r.state !== 'playing' || r.chasing) return;
  const calm = rt - (r.damageLog.at(-1)?.time ?? 0),
    power = Math.max(0, Math.min(1, (calm - 10) / 30));
  if (!power) return;
  const w = g.w,
    width = g.view.width,
    lines = Math.round(3 + 9 * power);
  w.lineStyle(2, 0xffffff, 0.12 + 0.18 * power);
  for (let i = 0; i < lines; i++) {
    const y = 70 + ((i * 89) % 330),
      len = 40 + 50 * power + (i % 3) * 18,
      x = width - ((rt * (700 + 400 * power) + i * 173) % (width + 200)) + 100;
    w.lineBetween(x, y, x + len, y);
  }
}

// Spring pads and swing ropes (ordinary runs and student courses), and a boss's weak points.
export function drawMoves(g: FxLayers, r: Runner, cam: number, rt: number, ry: number) {
  const fx = g.fx;
  for (const sx of r.springs) {
    const x = sx - cam;
    if (x < -60 || x > g.view.width + 60) continue;
    fx.lineStyle(3, 0x9aa4ad, 1);
    for (let k = 0; k < 4; k++) fx.lineBetween(x - 14, C.ground - 4 - k * 5, x + 14, C.ground - 6 - k * 5);
    fx.fillStyle(0xe8b04d, 1).fillRoundedRect(x - 22, C.ground - 26, 44, 7, 3);
    fx.fillStyle(0xfff0b0, 0.9).fillTriangle(x, C.ground - 52, x - 9, C.ground - 38, x + 9, C.ground - 38);
  }
  for (const rx of r.ropes) {
    const x = rx - cam;
    if (x < -80 || x > g.view.width + 80) continue;
    fx.fillStyle(0x6e5236, 1).fillRect(x - 30, ROPE_TOP - 8, 60, 8);
    // Drawn taut to the hero just after the throw.
    if (r.ropeSwing > 0 && r.ropesUsed.has(rx) && Math.abs(r.x - rx) < 300)
      fx.lineStyle(3, 0xc9a26a, 1).lineBetween(x, ROPE_TOP, g.view.heroX, ry - 40);
    else {
      const sway = Math.sin(rt * 2) * 8,
        end = {x: x + sway, y: ROPE_END.y};
      fx.lineStyle(3, 0xc9a26a, 1).lineBetween(x, ROPE_TOP, end.x, end.y);
      if (!r.ropesUsed.has(rx)) fx.lineStyle(3, 0xffe3a2, 0.9).strokeCircle(end.x, end.y, 10);
    }
  }
  r.weakPoints.forEach((w, i) => {
    const x = w.x - cam;
    if (r.weakHits.has(i) || x < -40 || x > g.view.width + 40) return;
    const pulse = 0.5 + 0.5 * Math.sin(rt * 6 + i);
    fx.fillStyle(0xffd76a, 0.35 + 0.25 * pulse).fillCircle(x, w.y, 22 + pulse * 4);
    fx.lineStyle(3, 0xfff1b8, 0.95).strokeCircle(x, w.y, 16);
    fx.fillStyle(0xfff6dc, 1).fillTriangle(x, w.y - 8, x - 7, w.y + 6, x + 7, w.y + 6);
  });
}

// Something comes up behind the hero during the chase, closer with each hit.
export function drawChase(g: FxLayers, r: Runner, rt: number, ry: number, reduced: boolean) {
  if (!r.chasing || r.state !== 'playing') return;
  const fx = g.fx,
    top = -g.view.extraHeight,
    near = Math.min(2, r.chaseHits),
    edge = g.view.heroX - 170 + near * 50 + (reduced ? 0 : Math.sin(rt * 5) * 8);
  // A red glow along the left edge.
  for (let i = 0; i < 6; i++) fx.fillStyle(0xd0443a, 0.05 * (6 - i)).fillRect(i * 10, top, 10, g.view.height);
  const kind = CHASERS[r.stage].texture;
  if (kind === 'wave' || kind === 'whirl') {
    fx.fillStyle(0x2f7f9a, 0.85).fillEllipse(edge - 90, C.ground - 40, 240, 200);
    fx.fillStyle(0xe6f4f8, 0.8).fillEllipse(edge - 20, C.ground - 120, 90, 40);
  } else if (kind === 'giant' || kind === 'suitors') {
    const n = kind === 'giant' ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const x = edge - 60 - i * 55,
        h = kind === 'giant' ? 200 : 110;
      fx.fillStyle(0x2a2a33, 0.85).fillRoundedRect(x - 30, C.ground - h, 60, h, 16);
      fx.fillCircle(x, C.ground - h - 18, kind === 'giant' ? 34 : 18);
      fx.fillStyle(0xffd76a, 0.9).fillCircle(x + 8, C.ground - h - 20, kind === 'giant' ? 8 : 3);
    }
  } else {
    // Gust, mist or song: rolling shapes in the island's colour.
    const color = kind === 'mist' ? 0xb48ad8 : kind === 'song' ? 0xf6e2a8 : 0xe8f1f4;
    for (let i = 0; i < 5; i++)
      fx.fillStyle(color, 0.55).fillCircle(edge - 40 - i * 34, ry - 30 - ((i * 47 + rt * 90) % 160), 26 - i * 3);
  }
}

// Harmless scenery moments every few seconds: gulls, a wave's spray, drifting leaves.
export function drawScenery(g: FxLayers, r: Runner, rt: number, reduced: boolean) {
  if (reduced || r.state !== 'playing') return;
  const period = 14,
    i = Math.floor(rt / period),
    t = rt - i * period;
  if (t > 4) return;
  const kind = Math.floor(seeded(`${r.stage}:${i}`)() * 3),
    w = g.w,
    width = g.view.width;
  if (kind === 0)
    for (let k = 0; k < 5; k++) {
      const x = width - t * 330 + k * 34,
        y = 90 + (k % 2) * 18 + Math.sin(rt * 6 + k) * 4;
      w.lineStyle(2, 0x34495a, 0.7)
        .lineBetween(x - 8, y - 4, x, y)
        .lineBetween(x, y, x + 8, y - 4);
    }
  else if (kind === 1)
    for (let k = 0; k < 8; k++)
      w.fillStyle(0xe6f4f8, 0.7 * (1 - t / 4)).fillCircle(
        width * 0.85 + k * 9,
        C.ground - 10 - t * 60 - (k % 3) * 14,
        4,
      );
  else
    for (let k = 0; k < 6; k++)
      w.fillStyle(0x8fbf6a, 0.75).fillEllipse(width - t * 260 + k * 47, 120 + k * 40 + Math.sin(rt * 4 + k) * 12, 9, 5);
}

export function drawWeather(g: FxLayers, r: Runner, reduced: boolean) {
  const w = g.w,
    top = -g.view.extraHeight,
    height = g.view.height,
    width = g.view.width;
  w.clear();
  if (r.weather === 'clear') return;
  if (r.weather === 'fog') {
    // Thin near the hero, thick toward the right edge; warnings are drawn above it.
    const from = g.view.heroX + FOG.clear,
      to = g.view.heroX + FOG.hidden;
    // Thin slices with a smooth ramp, so the haze has no visible bands.
    for (let x = from; x < width; x += 4) {
      const t = Math.min(1, (x - from) / (to - from));
      w.fillStyle(0xe8ecef, 0.88 * t * t * (3 - 2 * t)).fillRect(x, top, 4, height);
    }
    w.fillStyle(0xdfe5e8, 0.12).fillRect(0, top, width, height);
    return;
  }
  const storm = r.weather === 'storm';
  w.fillStyle(0x24364a, storm ? 0.22 : 0.12).fillRect(0, top, width, height);
  w.lineStyle(storm ? 2 : 1.5, 0xd8e6f2, storm ? 0.55 : 0.45);
  // Half the rain while the chase or fever time has the screen busy already (lighter on slow devices).
  const busy = r.chasing || r.fever > 0,
    drops = reduced ? 30 : Math.round((storm ? 90 : 60) / (busy ? 2 : 1)),
    slant = storm ? 18 : 6,
    fall = reduced ? 0 : r.time * (storm ? 900 : 650);
  for (let i = 0; i < drops; i++) {
    const x = (i * 97 + (reduced ? 0 : r.time * 60)) % (width + 40),
      y = top + ((i * 61 + fall) % (height + 40)) - 20;
    w.lineBetween(x, y, x - slant, y + (storm ? 26 : 18));
  }
  // A short lightning flash every few seconds; never with reduced motion.
  if (storm && !reduced && r.time % 7 < 0.1) w.fillStyle(0xffffff, 0.22).fillRect(0, top, width, height);
}

export function drawAdventure(g: FxLayers, r: Runner, cam: number, reduced: boolean) {
  const fx = g.fx,
    branch = r.adventure.branch;
  if (branch.start - cam < g.view.width + 40 && branch.end - cam > 0) {
    fx.lineStyle(2, 0xf1cf7b, 0.7).lineBetween(branch.start - cam, 330, branch.end - cam, 330);
    const x = branch.start - cam - 65;
    fx.fillStyle(0xf1cf7b, 0.8).fillTriangle(x, 350, x - 10, 370, x + 10, 370);
  }
  for (const group of r.adventure.constellations) {
    const points = group.stars.map(id => r.course.items.find(s => s.id === id)!);
    if (points.every(s => s.x - cam < 0 || s.x - cam > g.view.width + 40)) continue;
    fx.lineStyle(r.constellations.has(group.id) ? 3 : 1, 0xf5d88d, r.constellations.has(group.id) ? 0.85 : 0.35);
    const order = group.shape === 'ship' ? [0, 1, 3, 4, 0, 2, 3] : [0, 1, 2, 3, 4];
    for (let i = 1; i < order.length; i++) {
      const a = points[order[i - 1]],
        b = points[order[i]];
      fx.lineBetween(a.x - cam, a.y, b.x - cam, b.y);
    }
    if (r.constellations.has(group.id)) {
      const mid = points[2];
      fx.lineStyle(2, 0xffe9ae, 0.8).strokeCircle(mid.x - cam, mid.y, 22);
    }
  }
  for (const story of r.adventure.stories) {
    if (r.stories.has(story.id) || story.x - cam < -40 || story.x - cam > g.view.width + 40) continue;
    const x = story.x - cam,
      y = story.y - 20;
    fx.fillStyle(0xeee2ba, 0.95).fillRoundedRect(x - 12, y - 20, 24, 24, 4);
    fx.lineStyle(2, 0x8d795e, 0.8)
      .lineBetween(x - 7, y - 13, x + 7, y - 13)
      .lineBetween(x - 7, y - 7, x + 4, y - 7);
    if (story.pose === 'duck') {
      fx.lineStyle(2, 0xf6d694, 0.9)
        .lineBetween(x, y - 43, x, y - 29)
        .lineBetween(x, y - 29, x - 5, y - 35)
        .lineBetween(x, y - 29, x + 5, y - 35);
    }
  }
  const h = r.adventure.highlight;
  if (g.stage === 'beach' && r.x > h.start && r.x < h.end && r.course.gaps.length) {
    const gap = r.course.gaps.find(g => g.x >= h.start && g.x <= h.end)!;
    for (let i = 0; i < 4; i++) {
      const fall = reduced ? 70 : Math.max(0, Math.min(110, (r.x - (gap.x - 260)) * 0.5));
      fx.fillStyle(0x947354, 0.85).fillRoundedRect(gap.x + i * 38 - cam, 440 + fall, 31, 8, 2);
    }
    fx.lineStyle(2, 0xe2bd72, 0.8).lineBetween(gap.x - cam - 15, 433, gap.x - cam - 2, 420);
  }
  // The Sirens' song: notes drift over the open water; reduced motion keeps them still.
  if (g.stage === 'sea' && r.x > h.start - 500 && r.x < h.end) {
    const gap = r.course.gaps.find(g => g.x >= h.start && g.x <= h.end);
    if (gap)
      for (let i = 0; i < 5; i++) {
        const drift = reduced ? 0 : r.time * 40 + i * 37,
          x = gap.x - cam - 120 + i * 70 + (reduced ? 0 : Math.sin(drift / 30) * 10),
          y = 300 - (drift % 90);
        fx.fillStyle(0xf6e2a8, 0.75).fillEllipse(x, y, 11, 8);
        fx.lineStyle(2, 0xf6e2a8, 0.75).lineBetween(x + 5, y, x + 5, y - 20);
      }
  }
  if (g.stage === 'wind' && r.x > h.start - 700 && r.x < h.end) {
    for (const p of r.course.platforms.filter(p => p.id.startsWith('wind-cloud-') || p.id === 'wind-floating-3')) {
      const x = p.x - cam,
        y = r.platformY(p);
      fx.fillStyle(0xe8f1dc, 0.65).fillEllipse(x + p.w / 2, y + 10, p.w + 18, 26);
    }
  }
  if (r.wings > 0 && r.magnet > 0) {
    fx.lineStyle(2, 0xd8eddd, 0.6).strokeEllipse(g.view.heroX, r.y - 35, 98, 110);
  }
  if (r.lantern > 0 && r.trident) {
    fx.lineStyle(2, 0xffe3a2, 0.75).strokeCircle(g.view.heroX, r.y - 32, 54);
  }
}
