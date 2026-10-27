import type {DamageEvent, DamageKind} from '../systems/damage';
import {ADVENTURE_PLANS, ADVENTURE_BALANCE, GOALS, type GoalId, type ComboId} from '../levels/adventure';
import {GHOST_SECONDS} from '../storage/journal';
import {C} from '../config';
import {type StageId, type Rect, type Platform, type Collectible} from '../levels/courses';
import {score, rating} from '../systems/score';
import type {RunResult} from '../storage/save';
import {createEnemyState, updateEnemyState, type EnemyState} from '../levels/enemies';
import {heroPose, collectibleContact, enemyContact, projectileContact, obstacleContact} from '../systems/contact';
import {obstaclePose} from '../rendering/poses';
import {getCourse} from '../levels/variants';
import type {VariantId} from '../levels/course-ids';
export type RunState = 'ready' | 'playing' | 'paused' | 'success' | 'failure';
export interface RunnerEvent {
  kind:
    | 'jump'
    | 'star'
    | 'map'
    | 'shield'
    | 'wings'
    | 'magnet'
    | 'apple'
    | 'trident'
    | 'lantern'
    | 'compass'
    | 'strike'
    | 'hurt'
    | 'fall'
    | 'block'
    | 'finish'
    | 'constellation'
    | 'near'
    | 'discovery'
    | 'highlight'
    | 'combo'
    | 'trick'
    | 'route';
  x: number;
  y: number;
  text?: string;
}
export const AUTO_SLIDE_LEAD = 70;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export class Runner {
  readonly course;
  state: RunState = 'ready';
  x = 0;
  y: number = C.ground;
  vy = 0;
  hp = 3;
  hpLoss = 0;
  maxDistance = 0;
  time = 0;
  grounded = true;
  sliding = false;
  jumps = 0;
  coyote: number = C.coyote;
  buffer = 0;
  slideHeld = false;
  // One-button voyages duck automatically just before a low ceiling on the ground.
  autoSlide = false;
  invincible = 0;
  shield = false;
  wings = 0;
  magnet = 0;
  trident = false;
  lantern = 0;
  defeated = new Set<string>();
  readonly enemyStates: EnemyState[];
  readonly adventure;
  goal: GoalId;
  constellations = new Set<string>();
  stories = new Set<string>();
  combos = new Set<ComboId>();
  routes = new Set<string>();
  nearMisses = new Set<string>();
  evaded = new Set<string>();
  tricked = new Set<string>();
  highlightSeen = false;
  message = '';
  private activeCombos = new Set<ComboId>();
  private contacts = new Set<string>();
  private closePasses = new Set<string>();
  private passed = new Set<string>();
  private spentShots = new Set<string>();
  private shotHeights = new Map<string, number>();
  trace: number[] = [0];
  damageLog: DamageEvent[] = [];
  safeX = 0;
  recovering = 0;
  stars = 0;
  maps = new Set<string>();
  collected = new Set<string>();
  events: RunnerEvent[] = [];
  private finalized: RunResult | null = null;
  private hitbox: Rect = {x: -21, y: 376, w: 42, h: 64};
  constructor(
    readonly stage: StageId,
    goal: GoalId = 'maps',
    readonly variant: VariantId = 'classic',
    course = getCourse(stage, variant),
    readonly rule: 'none' | 'no-shield' = 'none',
  ) {
    this.goal = goal;
    this.course = course;
    this.adventure = course.adventure ?? ADVENTURE_PLANS[stage];
    this.enemyStates = this.course.enemies.map(createEnemyState);
    this.updateEnemies();
  }
  private updateEnemies() {
    this.enemyStates.forEach((s, i) => {
      updateEnemyState(s, this.course.enemies[i], this.x, this.time, this.lantern > 0, this.defeated.has(s.id));
      if (s.kind === 'cyclops' && s.projectile.active) {
        if (!this.shotHeights.has(s.id)) this.shotHeights.set(s.id, Math.max(140, Math.min(372, this.y - 68)));
        s.projectile.y = this.shotHeights.get(s.id)!;
        if (this.spentShots.has(s.id)) s.projectile.active = false;
      }
    });
  }
  get body(): Rect {
    const b = this.hitbox;
    b.x = this.x - C.bodyWidth / 2;
    b.h = this.sliding ? C.slide : C.stand;
    b.y = this.y - b.h;
    return b;
  }
  clearInput() {
    this.slideHeld = false;
    this.buffer = 0;
  }
  jump() {
    if (this.state === 'playing') this.buffer = C.buffer;
  }
  slide(held: boolean) {
    this.slideHeld = held;
  }
  platformY(p: Platform) {
    return p.y + (p.moving ? Math.sin(this.time * 1.6) * 22 : 0);
  }
  private wantsSlide() {
    if (this.slideHeld) return true;
    if (!this.autoSlide || this.y !== C.ground) return false;
    return this.course.obstacles.some(
      o =>
        (o.kind === 'gate' || o.kind === 'hand') &&
        o.x - (this.x + C.bodyWidth / 2) < AUTO_SLIDE_LEAD &&
        this.x - C.bodyWidth / 2 < o.x + o.w,
    );
  }
  private canStand(x = this.x, y = this.y) {
    return !this.course.obstacles.some(
      o => (o.kind === 'gate' || o.kind === 'hand') && overlap({x: x - 21, y: y - C.stand, w: 42, h: C.stand}, o),
    );
  }
  private emit(kind: RunnerEvent['kind']) {
    this.events.push({kind, x: this.x, y: this.y - 45, text: this.message});
  }
  private tryJump() {
    if (this.buffer <= 0 || !this.canStand()) return;
    const groundJump = this.grounded || this.coyote > 0;
    if (!groundJump && this.jumps >= 2) return;
    this.jumps = groundJump ? 1 : 2;
    this.grounded = false;
    this.coyote = 0;
    this.vy = C.jump;
    this.sliding = false;
    this.buffer = 0;
    this.emit('jump');
  }
  collect(item: Collectible) {
    if (this.collected.has(item.id)) return;
    this.collected.add(item.id);
    if (item.kind === 'star') this.stars++;
    if (item.kind === 'map') this.maps.add(item.id);
    if (item.kind === 'shield' && this.rule !== 'no-shield') this.shield = true;
    if (item.kind === 'wings') this.wings = C.effect;
    if (item.kind === 'magnet') this.magnet = C.effect;
    if (item.kind === 'apple') this.hp = Math.min(3, this.hp + 1);
    if (item.kind === 'trident') this.trident = true;
    if (item.kind === 'lantern') this.lantern = C.effect;
    if (item.kind === 'compass' && item.checkpoint !== undefined && this.x >= item.checkpoint)
      this.safeX = Math.max(this.safeX, item.checkpoint);
    if (item.kind === 'shield' && this.rule === 'no-shield') return;
    this.emit(item.kind);
  }
  hurt(fall = false, kind: DamageKind = fall ? 'fall' : 'contact') {
    if (this.state !== 'playing' || (!fall && this.invincible > 0)) return;
    if (!fall && this.shield) {
      this.shield = false;
      this.emit('block');
    } else {
      this.hp--;
      this.hpLoss++;
      this.damageLog.push({kind, x: this.x, time: this.time});
      if (this.damageLog.length > 12) this.damageLog.shift();
      this.emit(fall ? 'fall' : 'hurt');
    }
    this.invincible = C.invincible;
  }
  tick(dt: number = C.step) {
    if (this.state !== 'playing') return;
    this.events.length = 0;
    this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.wings = Math.max(0, this.wings - dt);
    this.magnet = Math.max(0, this.magnet - dt);
    this.lantern = Math.max(0, this.lantern - dt);
    this.recovering = Math.max(0, this.recovering - dt);
    if (this.grounded) this.coyote = C.coyote;
    else this.coyote = Math.max(0, this.coyote - dt);
    this.tryJump();
    this.buffer = Math.max(0, this.buffer - dt);
    const oldY = this.y,
      oldTop = this.body.y;
    this.x += C.speed * dt;
    this.sliding = this.grounded && (this.wantsSlide() || (this.sliding && !this.canStand()));
    this.vy += C.gravity * dt;
    const inWind = this.course.winds.some(w => overlap(this.body, w));
    if (inWind) {
      this.vy = Math.max(-C.windCap, Math.min(C.windCap, this.vy - C.windForce * dt));
    }
    if (this.wings > 0 && this.vy > C.glide) this.vy = C.glide;
    this.y += this.vy * dt;
    // Solid ceiling undersides do not spend jumps or allow clipping through the gate.
    // Rising into the side only stops the climb; snapping below would teleport the hero.
    for (const o of this.course.obstacles) {
      if ((o.kind === 'gate' || o.kind === 'hand') && this.vy < 0 && overlap(this.body, o)) {
        if (oldTop >= o.y + o.h) this.y = o.y + o.h + (this.sliding ? C.slide : C.stand);
        this.vy = 0;
      }
    }
    let floor = Infinity;
    if (!this.course.gaps.some(g => this.x > g.x && this.x < g.x + g.w) && oldY <= C.ground + 1) floor = C.ground;
    for (const p of this.course.platforms) {
      const py = this.platformY(p);
      if (this.x + 18 > p.x && this.x - 18 < p.x + p.w && oldY <= py + 3 && this.y >= py && this.vy >= 0)
        floor = Math.min(floor, py);
    }
    this.grounded = false;
    if (this.vy >= 0 && this.y >= floor) {
      this.y = floor;
      this.vy = 0;
      this.grounded = true;
      this.jumps = 0;
      this.coyote = C.coyote;
      this.sliding = this.wantsSlide() || (this.sliding && !this.canStand());
      this.tryJump();
    }
    if (!this.grounded && this.coyote === 0 && this.jumps === 0) this.jumps = 1;
    this.maxDistance = Math.min(this.length, Math.max(this.maxDistance, this.x));
    if (this.grounded && !this.sliding && this.y === C.ground) {
      for (const x of this.course.safe) if (this.x >= x && x > this.safeX) this.safeX = x;
    }
    const pose = heroPose(this),
      body = this.body;
    for (const item of this.course.items) {
      if (
        this.collected.has(item.id) ||
        Math.abs(item.x - this.x) > (this.wings > 0 && this.magnet > 0 ? ADVENTURE_BALANCE.glideMagnet : C.magnet) + 40
      )
        continue;
      if (
        (item.kind === 'star' &&
          this.magnet > 0 &&
          Math.hypot(item.x - this.x, item.y - (this.y - 32)) <=
            (this.wings > 0 ? ADVENTURE_BALANCE.glideMagnet : C.magnet)) ||
        collectibleContact(pose, body, item)
      )
        this.collect(item);
    }
    this.updateAdventure();
    this.updateEnemies();
    for (const source of this.enemyStates) {
      if (!source.projectile.active) continue;
      for (const target of this.enemyStates) {
        if (target.id === source.id || !target.active || target.kind !== 'stone' || !overlap(source.projectile, target))
          continue;
        this.defeated.add(target.id);
        target.defeated = true;
        target.active = false;
        source.projectile.active = false;
        this.spentShots.add(source.id);
        this.tricked.add(target.id);
        this.message = '거인의 바위로 석상병 격파!';
        this.emit('trick');
        break;
      }
    }
    if (this.trident) {
      const target = this.enemyStates.find(
        s =>
          !s.defeated &&
          (s.active || s.projectile.active) &&
          Math.hypot(s.x + s.w / 2 - this.x, s.y + s.h / 2 - (this.y - 32)) <
            (this.lantern > 0 ? ADVENTURE_BALANCE.guardianRange : 200),
      );
      if (target) {
        this.defeated.add(target.id);
        target.defeated = true;
        target.active = false;
        target.projectile.active = false;
        this.trident = false;
        this.message = this.lantern > 0 ? '빛의 삼지창으로 격퇴!' : '삼지창으로 격퇴!';
        this.emit('strike');
      }
    }
    for (const o of this.course.obstacles) {
      if (o.role !== 'hazard') continue;
      if (obstacleContact(pose, body, o, this.x)) {
        this.contacts.add(o.id);
        this.hurt(false, o.kind);
      }
      this.observePass(o.id, obstaclePose(o, this.x), false);
    }
    for (const enemy of this.enemyStates) {
      if (enemyContact(pose, body, enemy) || projectileContact(pose, body, enemy.projectile)) {
        this.contacts.add(enemy.id);
        this.hurt(false, projectileContact(pose, body, enemy.projectile) ? 'projectile' : enemy.kind);
      }
      if (!enemy.defeated && !enemy.repelled) this.observePass(enemy.id, enemy, true);
    }
    if (this.y > C.fallBoundary && this.recovering <= 0) {
      this.hurt(true);
      if (this.hp > 0) {
        this.x = this.safeX;
        this.y = C.ground;
        this.vy = 0;
        this.grounded = true;
        this.jumps = 0;
        this.sliding = false;
        this.recovering = 0.35;
        this.clearInput();
        this.updateEnemies();
      }
    }
    while (this.trace.length <= Math.floor(Math.min(GHOST_SECONDS, this.time)))
      this.trace.push(Math.floor(this.maxDistance));
    if (this.hp <= 0) {
      this.state = 'failure';
      this.clearInput();
    } else if (this.x >= this.length && this.y <= C.fallBoundary && this.recovering <= 0) {
      this.state = 'success';
      this.clearInput();
      this.emit('finish');
    }
  }
  private observePass(id: string, rect: Rect, enemy: boolean) {
    const body = this.body;
    if (Math.abs(this.x - (rect.x + rect.w / 2)) < rect.w / 2 + 24 && !overlap(body, rect)) {
      const gap = Math.max(rect.y - (body.y + body.h), body.y - (rect.y + rect.h));
      if (gap >= 0 && gap <= ADVENTURE_BALANCE.nearDistance) this.closePasses.add(id);
    }
    if (this.x > rect.x + rect.w + 24 && !this.passed.has(id)) {
      this.passed.add(id);
      if (!this.contacts.has(id)) {
        if (enemy) this.evaded.add(id);
        if (this.closePasses.has(id)) {
          this.nearMisses.add(id);
          this.message = '멋진 회피!';
          this.emit('near');
        }
      }
    }
  }
  private updateAdventure() {
    for (const [id, active] of [
      ['glide', this.wings > 0 && this.magnet > 0],
      ['guardian', this.lantern > 0 && this.trident],
    ] as [ComboId, boolean][]) {
      if (active && !this.activeCombos.has(id)) {
        this.activeCombos.add(id);
        this.combos.add(id);
        this.message = id === 'glide' ? '별빛 활공! 수집 범위 240' : '빛의 삼지창! 격퇴 범위 300';
        this.emit('combo');
      } else if (!active) this.activeCombos.delete(id);
    }
    for (const group of this.adventure.constellations)
      if (!this.constellations.has(group.id) && group.stars.every(id => this.collected.has(id))) {
        this.constellations.add(group.id);
        this.message = group.name + ' 별자리 완성!';
        this.emit('constellation');
      }
    for (const story of this.adventure.stories)
      if (
        !this.stories.has(story.id) &&
        Math.abs(this.x - story.x) < 65 &&
        (story.pose === 'upper'
          ? this.y <= 335 && this.y >= story.y - 85
          : this.sliding && this.grounded && this.y === C.ground)
      ) {
        this.stories.add(story.id);
        this.message = story.quote;
        this.emit('discovery');
      }
    const branch = this.adventure.branch;
    if (
      ![...this.routes].some(id => id.startsWith(this.stage + '-')) &&
      this.x > branch.start + 180 &&
      this.x < branch.end &&
      this.grounded &&
      this.y <= 335
    ) {
      this.routes.add(this.stage + '-upper');
      this.message = '높은 유적길 · 별빛과 이야기!';
      this.emit('route');
    }
    if (this.x > branch.end && !this.routes.size) this.routes.add(this.stage + '-lower');
    if (!this.highlightSeen && this.x >= this.adventure.highlight.start) {
      this.highlightSeen = true;
      this.message = this.adventure.highlight.name;
      this.emit('highlight');
    }
  }
  get goalProgress() {
    return this.goal === 'maps'
      ? this.maps.size
      : this.goal === 'dodge'
        ? this.evaded.size
        : this.goal === 'sky'
          ? this.constellations.size
          : this.stories.size;
  }
  get goalComplete() {
    return this.goalProgress >= GOALS[this.goal].target;
  }
  get length() {
    return this.course.length ?? C.length;
  }
  get points() {
    return score(this.maxDistance, this.stars, this.maps.size, this.state === 'success');
  }
  result(): RunResult {
    if (this.finalized) return this.finalized;
    if (this.state !== 'success' && this.state !== 'failure') throw Error('Run is not finished');
    this.finalized = {
      stage: this.stage,
      variant: this.variant,
      complete: this.state === 'success',
      score: this.points,
      rating: rating(this.state === 'success', this.stars, this.hpLoss),
      stars: this.stars,
      maps: [...this.maps],
      hpLoss: this.hpLoss,
      distance: this.maxDistance,
      adventure: {
        stamps: this.goalComplete ? [`${this.stage}-${this.goal}`] : [],
        stories: [...this.stories],
        constellations: [...this.constellations],
        combos: [...this.combos],
        routes: [...this.routes],
        nearMisses: this.nearMisses.size,
        evaded: this.evaded.size,
        tricked: this.tricked.size,
        ghost: {score: this.points, duration: Math.min(GHOST_SECONDS, this.time), samples: [...this.trace]},
      },
    };
    return this.finalized;
  }
}
