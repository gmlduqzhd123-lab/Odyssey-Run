import type {DamageEvent, DamageKind} from '../systems/damage';
import {ADVENTURE_PLANS, ADVENTURE_BALANCE, GOALS, type GoalId, type ComboId} from '../levels/adventure';
import {GHOST_SECONDS} from '../storage/journal';
import {C} from '../config';
import {
  CRUMBLE_DELAY,
  CURRENT_PULL,
  MOLY_TIME,
  LIFT,
  SEESAW,
  isCeiling,
  type StageId,
  type Rect,
  type Platform,
  type Collectible,
} from '../levels/courses';
import {score, rating} from '../systems/score';
import type {RunResult} from '../storage/save';
import {createEnemyState, updateEnemyState, type EnemyState} from '../levels/enemies';
import {heroPose, collectibleContact, enemyContact, projectileContact, obstacleContact} from '../systems/contact';
import {obstaclePose} from '../rendering/poses';
import {getCourse} from '../levels/variants';
import {sceneryView, type ViewId} from '../levels/scenery';
import type {VariantId} from '../levels/course-ids';
import type {WeatherId} from '../levels/weather';
import {
  COMBO_POINTS,
  GATE_O,
  GATE_X,
  HERMES_JUMP,
  MAX_COMBO,
  MAX_COMBO_POINTS,
  comboMultiplier,
  type BlessingId,
  type ComboKind,
  type Gate,
  type Treasure,
} from '../levels/play-extras';
import {
  CHASERS,
  CHASE_BONUS,
  FEVER_FULL,
  FEVER_STEP,
  FEVER_TIME,
  MISSION_REWARD,
  MISSION_TEXT,
  ROPE_END,
  ROPE_LAUNCH,
  SPRING_LAUNCH,
  STOMPABLE,
  TELEMACHUS_JUMP,
  STOMP_BOUNCE,
  type Mission,
} from '../levels/play-dynamics';
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
    | 'moly'
    | 'charm'
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
    | 'route'
    | 'gate'
    | 'treasure'
    | 'rescue'
    | 'stomp'
    | 'fever'
    | 'spring'
    | 'swing'
    | 'mission'
    | 'mission-start'
    | 'mission-fail'
    | 'chase-start'
    | 'chase'
    | 'revive'
    | 'weak';
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
  // Where the hero was one step ago: the screen draws between that and now (see World.drawRun),
  // so a 90 or 120 Hz display scrolls smoothly although the rules run 60 times a second.
  prevX = 0;
  prevY: number = C.ground;
  prevTime = 0;
  grounded = true;
  sliding = false;
  jumps = 0;
  coyote: number = C.coyote;
  buffer = 0;
  slideHeld = false;
  // One-button voyages duck automatically just before a low ceiling on the ground.
  autoSlide = false;
  invincible = 0;
  // Seconds of shelter after the device froze for a moment (see rendering/frame-watch Pacer):
  // contact cannot hurt, falls still count, and nothing is drawn differently.
  grace = 0;
  shield = false;
  wings = 0;
  magnet = 0;
  trident = false;
  lantern = 0;
  // Seconds left of moly's protection against Circe's spell.
  moly = 0;
  // Inside a spell stretch without moly: the air jump is sealed.
  charmed = false;
  // Running speed; a storm's headwind lowers it (see weather.ts).
  speed: number = C.speed;
  weather: WeatherId = 'clear';
  defeated = new Set<string>();
  readonly enemyStates: EnemyState[];
  // Ordinary island runs only (see levels/play-extras): the app sets these before the start.
  blessing: BlessingId = 'none';
  gate: Gate | null = null;
  treasure: Treasure | null = null;
  // The O/X gate's answer once passed (true = said O), and the chest once found.
  gateSaid: boolean | null = null;
  treasureFound = false;
  // Poseidon's one free fall.
  private rescues = 0;
  // The combo chain now, its best this run, and the combo points earned.
  combo = 0;
  bestCombo = 0;
  comboPoints = 0;
  // The dynamic extras of an ordinary run (see levels/play-dynamics); the app turns them on.
  extras = false;
  feverGauge = 0;
  fever = 0;
  fevers = 0;
  // Spring pads and swing ropes (from the course, or placed by the app on ordinary runs).
  springs: number[] = [];
  ropes: number[] = [];
  ropesUsed = new Set<number>();
  // Seconds the rope is still drawn taut after the throw.
  ropeSwing = 0;
  missions: Mission[] = [];
  mission: (Mission & {until: number; progress: number; base: {stars: number; hpLoss: number; stomps: number}}) | null =
    null;
  private missionIndex = 0;
  missionsDone = 0;
  chase: {start: number; end: number} | null = null;
  chasing = false;
  chaseHits = 0;
  chaseEscaped = false;
  // Monsters landed on (in every mode).
  stomps = 0;
  // Boss runs: the boss's three weak points (jump into them) and which were hit.
  weakPoints: {x: number; y: number}[] = [];
  weakHits = new Set<number>();
  // The hero who runs (see systems/heroes): a small ability on ordinary runs only.
  hero = 'odysseus';
  // Athena's second block with one shield.
  private aegis = 0;
  // The prologue's step-by-step captions (see levels/prologue).
  guide: {x: number; text: string}[] = [];
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
  // The painted landscape behind this voyage (the app sets the daily one).
  scenery: ViewId;
  // When each crumbling plank was first stood on (run time); a fall back to safety restores them.
  crumbling = new Map<string, number>();
  trace: number[] = [0];
  damageLog: DamageEvent[] = [];
  // Every HP loss of the run (the log above keeps the latest few), for the course balance.
  hits: DamageEvent[] = [];
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
    // The daily voyage's rule: no shield, or an oracle's gift held all run (see levels/daily).
    readonly rule: 'none' | 'no-shield' | 'magnet' | 'lantern' = 'none',
  ) {
    this.goal = goal;
    this.course = course;
    this.scenery = sceneryView(course);
    this.adventure = course.adventure ?? ADVENTURE_PLANS[stage];
    this.enemyStates = this.course.enemies.map(createEnemyState);
    this.springs = [...(course.springs ?? [])];
    this.ropes = [...(course.ropes ?? [])];
    if (course.chase) this.chase = {...course.chase};
    if (rule === 'magnet') this.magnet = C.step * 2;
    if (rule === 'lantern') this.lantern = C.step * 2;
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
  // The time and hero position default to now; the screen passes the in-between ones it draws.
  platformY(p: Platform, x = this.x, time = this.time, heroX = this.x) {
    if (p.lift) return p.y - (LIFT.rise * (1 - Math.cos((time * 2 * Math.PI) / LIFT.period))) / 2;
    if (p.seesaw) return this.seesawY(p, x, heroX);
    return p.y + (p.moving ? Math.sin(time * 1.6) * 22 : 0);
  }
  // The seesaw tilts toward the hero: the end nearer the hero dips to the ground line and the
  // far end rises, so the plank surface under the hero runs from the ground up to the middle.
  seesawSlope(p: Platform, heroX = this.x) {
    const half = p.w / 2,
      t = Math.max(-1, Math.min(1, (heroX - (p.x + half)) / half));
    return (t * SEESAW.rise) / half;
  }
  seesawY(p: Platform, x = this.x, heroX = this.x) {
    const half = p.w / 2;
    return p.y - SEESAW.rise + (x - (p.x + half)) * this.seesawSlope(p, heroX);
  }
  // Seconds since a crumbling plank was first stood on, or -1 while it is untouched.
  crumbleAge(p: Platform) {
    const at = this.crumbling.get(p.id);
    return at === undefined ? -1 : this.time - at;
  }
  private solid(p: Platform) {
    return !p.crumble || this.crumbleAge(p) < CRUMBLE_DELAY;
  }
  private wantsSlide() {
    if (this.slideHeld) return true;
    if (!this.autoSlide || this.y !== C.ground) return false;
    return this.course.obstacles.some(
      o =>
        isCeiling(o.kind) && o.x - (this.x + C.bodyWidth / 2) < AUTO_SLIDE_LEAD && this.x - C.bodyWidth / 2 < o.x + o.w,
    );
  }
  private canStand(x = this.x, y = this.y) {
    return !this.course.obstacles.some(
      o => isCeiling(o.kind) && overlap({x: x - 21, y: y - C.stand, w: 42, h: C.stand}, o),
    );
  }
  private emit(kind: RunnerEvent['kind']) {
    if (Object.hasOwn(COMBO_POINTS, kind)) {
      this.combo = Math.min(MAX_COMBO, this.combo + 1);
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.comboPoints = Math.min(
        MAX_COMBO_POINTS,
        this.comboPoints +
          Math.round(
            COMBO_POINTS[kind as ComboKind] *
              comboMultiplier(this.combo) *
              (this.fever > 0 ? 2 : 1) *
              // Odysseus's ability: a little more combo points (it never changes how a run goes).
              (this.ability('odysseus') ? 1.1 : 1),
          ),
      );
      if (this.extras && this.fever <= 0) this.fill(FEVER_STEP);
    } else if (kind === 'hurt' || kind === 'fall') {
      this.combo = 0;
      this.feverGauge = 0;
    }
    this.events.push({kind, x: this.x, y: this.y - 45, text: this.message});
  }
  private say(kind: RunnerEvent['kind'], message: string) {
    this.message = message;
    this.emit(kind);
  }
  // The fever gauge: full, it turns into five seconds of fever (shelter, pull and double combo points).
  private fill(n: number) {
    this.feverGauge = Math.min(FEVER_FULL, this.feverGauge + n);
    if (this.feverGauge < FEVER_FULL || this.fever > 0) return;
    this.feverGauge = 0;
    this.fever = FEVER_TIME;
    this.fevers++;
    this.say('fever', '피버 타임! 5초 동안 무적 질주');
  }
  // Two sailors at once: a partner's combo brings a fallen sailor back with one heart.
  revive() {
    if (this.state !== 'failure') return;
    this.state = 'playing';
    this.hp = 1;
    this.x = this.prevX = this.safeX;
    this.y = this.prevY = C.ground;
    this.vy = 0;
    this.grounded = true;
    this.invincible = C.invincible;
    this.recovering = 0.35;
    this.finalized = null;
    this.say('revive', '친구가 일으켜 줬어요! 체력 1');
  }
  // A hero's ability holds on ordinary runs only (records elsewhere stay comparable).
  ability(id: string) {
    return this.extras && this.hero === id;
  }
  // Called once before the start: Athena's shield is held from the first step.
  bless(id: BlessingId) {
    this.blessing = id;
    if (id === 'athena' && this.rule !== 'no-shield') {
      this.shield = true;
      this.aegis = 1;
    }
    this.rescues = id === 'poseidon' ? 1 : 0;
  }
  private tryJump() {
    if (this.buffer <= 0 || !this.canStand()) return;
    const groundJump = this.grounded || this.coyote > 0;
    if (!groundJump && (this.jumps >= 2 || this.charmed)) return;
    this.jumps = groundJump ? 1 : 2;
    this.grounded = false;
    this.coyote = 0;
    this.vy =
      C.jump *
      (!groundJump && this.blessing === 'hermes' ? HERMES_JUMP : 1) *
      (!groundJump && this.ability('telemachus') ? TELEMACHUS_JUMP : 1);
    this.sliding = false;
    this.buffer = 0;
    this.emit('jump');
  }
  collect(item: Collectible) {
    if (this.collected.has(item.id)) return;
    this.collected.add(item.id);
    if (item.kind === 'star') this.stars++;
    if (item.kind === 'map') this.maps.add(item.id);
    if (item.kind === 'shield' && this.rule !== 'no-shield') {
      this.shield = true;
      this.aegis = 1;
    }
    if (item.kind === 'wings') this.wings = C.effect;
    if (item.kind === 'magnet') this.magnet = C.effect;
    if (item.kind === 'apple') this.hp = Math.min(3, this.hp + 1);
    if (item.kind === 'trident') this.trident = true;
    if (item.kind === 'lantern') this.lantern = C.effect;
    if (item.kind === 'moly') this.moly = MOLY_TIME;
    if (item.kind === 'compass' && item.checkpoint !== undefined && this.x >= item.checkpoint)
      this.safeX = Math.max(this.safeX, item.checkpoint);
    if (item.kind === 'shield' && this.rule === 'no-shield') return;
    this.emit(item.kind);
  }
  // A moment of shelter after the device froze (the app calls this; it never stacks up).
  shelter(seconds: number) {
    this.grace = Math.max(this.grace, seconds);
  }
  hurt(fall = false, kind: DamageKind = fall ? 'fall' : 'contact') {
    if (this.state !== 'playing' || (!fall && (this.invincible > 0 || this.grace > 0 || this.fever > 0))) return;
    if (this.chasing) this.chaseHits++;
    if (!fall && this.shield) {
      // Athena's ability: the first block of each shield keeps it for one more.
      if (this.ability('athena') && this.aegis > 0) this.aegis--;
      else this.shield = false;
      this.emit('block');
    } else if (fall && this.rescues > 0) {
      this.rescues--;
      this.message = '포세이돈이 건져 줬어요! 체력 그대로';
      this.emit('rescue');
    } else {
      this.hp--;
      this.hpLoss++;
      this.damageLog.push({kind, x: this.x, time: this.time});
      if (this.damageLog.length > 12) this.damageLog.shift();
      if (this.hits.length < 300) this.hits.push({kind, x: this.x, time: this.time});
      this.emit(fall ? 'fall' : 'hurt');
    }
    this.invincible = C.invincible;
  }
  tick(dt: number = C.step) {
    if (this.state !== 'playing') return;
    this.events.length = 0;
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevTime = this.time;
    this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.grace = Math.max(0, this.grace - dt);
    this.fever = Math.max(0, this.fever - dt);
    this.ropeSwing = Math.max(0, this.ropeSwing - dt);
    if (this.fever > 0) this.magnet = Math.max(this.magnet, dt * 2);
    this.wings = Math.max(0, this.wings - dt);
    this.magnet = Math.max(0, this.magnet - dt);
    this.lantern = Math.max(0, this.lantern - dt);
    this.moly = Math.max(0, this.moly - dt);
    if (this.rule === 'magnet') this.magnet = Math.max(this.magnet, dt * 2);
    if (this.rule === 'lantern') this.lantern = Math.max(this.lantern, dt * 2);
    const spelled = !!this.course.spells?.some(z => this.x >= z.x && this.x < z.x + z.w) && this.moly <= 0;
    if (spelled && !this.charmed) {
      this.charmed = true;
      this.message = '키르케의 마법! 2단 점프 봉인';
      this.emit('charm');
    } else if (!spelled) this.charmed = false;
    this.recovering = Math.max(0, this.recovering - dt);
    if (this.grounded) this.coyote = C.coyote;
    else this.coyote = Math.max(0, this.coyote - dt);
    this.tryJump();
    this.buffer = Math.max(0, this.buffer - dt);
    const oldY = this.y,
      oldTop = this.body.y;
    // Charybdis's current holds the feet back; a jump carries the hero over it at full speed.
    const held =
      this.grounded &&
      this.blessing !== 'poseidon' &&
      !!this.course.currents?.some(z => this.x >= z.x && this.x < z.x + z.w);
    this.x += this.speed * (held ? CURRENT_PULL : 1) * dt;
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
      if (isCeiling(o.kind) && this.vy < 0 && overlap(this.body, o)) {
        if (oldTop >= o.y + o.h) this.y = o.y + o.h + (this.sliding ? C.slide : C.stand);
        this.vy = 0;
      }
    }
    let floor = Infinity;
    if (!this.course.gaps.some(g => this.x > g.x && this.x < g.x + g.w) && oldY <= C.ground + 1) floor = C.ground;
    let standing: Platform | null = null;
    for (const p of this.course.platforms) {
      if (!this.solid(p)) continue;
      const py = this.platformY(p);
      if (
        this.x + 18 > p.x &&
        this.x - 18 < p.x + p.w &&
        // A seesaw's surface climbs under the hero by up to about 3px a step.
        oldY <= py + (p.seesaw ? 8 : 3) &&
        this.y >= py &&
        this.vy >= 0 &&
        py < floor
      ) {
        floor = py;
        standing = p;
      }
    }
    this.grounded = false;
    if (this.vy >= 0 && this.y >= floor) {
      this.y = floor;
      this.vy = 0;
      this.grounded = true;
      this.jumps = 0;
      this.coyote = C.coyote;
      if (standing?.crumble && !this.crumbling.has(standing.id)) this.crumbling.set(standing.id, this.time);
      this.sliding = this.wantsSlide() || (this.sliding && !this.canStand());
      this.tryJump();
    }
    this.updateMoves();
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
    this.updateExtras(body);
    this.updateWeak(body);
    this.updatePacing();
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
      if (this.stomp(enemy)) continue;
      if (enemyContact(pose, body, enemy) || projectileContact(pose, body, enemy.projectile)) {
        this.contacts.add(enemy.id);
        this.hurt(false, projectileContact(pose, body, enemy.projectile) ? 'projectile' : enemy.kind);
      }
      if (!enemy.defeated && !enemy.repelled) this.observePass(enemy.id, enemy, true);
    }
    if (this.y > C.fallBoundary && this.recovering <= 0) {
      this.hurt(true);
      if (this.hp > 0) {
        this.x = this.prevX = this.safeX;
        this.y = this.prevY = C.ground;
        this.vy = 0;
        this.grounded = true;
        this.jumps = 0;
        this.sliding = false;
        this.recovering = 0.35;
        this.crumbling.clear();
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
  // Landing on a monster from above defeats it and bounces the hero up (every mode).
  private stomp(e: EnemyState) {
    if (e.defeated || !e.active || e.repelled || !STOMPABLE.includes(e.kind) || this.vy <= 0) return false;
    const b = this.body;
    if (b.x + b.w <= e.x + 6 || b.x >= e.x + e.w - 6 || this.prevY > e.y + 14 || this.y < e.y - 2) return false;
    this.defeated.add(e.id);
    e.defeated = true;
    e.active = false;
    e.projectile.active = false;
    this.contacts.add(e.id + ':stomp');
    this.vy = STOMP_BOUNCE;
    this.y = e.y;
    this.grounded = false;
    this.jumps = 1;
    this.stomps++;
    this.say('stomp', '몬스터를 밟았어요!');
    return true;
  }
  // Spring pads and swing ropes: a spring launches a hero who runs onto it; a rope throws up a
  // hero who jumps into its ring (once each).
  private updateMoves() {
    if (this.grounded && this.y === C.ground && !this.sliding && this.springs.some(x => Math.abs(this.x - x) < 24)) {
      this.vy = SPRING_LAUNCH;
      this.grounded = false;
      this.coyote = 0;
      this.jumps = 1;
      this.say('spring', '스프링 발판! 하늘 높이');
    }
    if (this.grounded) return;
    const rope = this.ropes.find(
      x => !this.ropesUsed.has(x) && Math.hypot(this.x - x, this.y - 32 - ROPE_END.y) < ROPE_END.r,
    );
    if (rope !== undefined) {
      this.ropesUsed.add(rope);
      this.ropeSwing = 0.4;
      this.vy = ROPE_LAUNCH;
      this.jumps = 1;
      this.say('swing', '밧줄을 잡고 휙!');
    }
  }
  // Boss runs: jumping into a weak point strikes the boss (three for a full defeat).
  private updateWeak(body: Rect) {
    this.weakPoints.forEach((w, i) => {
      if (this.weakHits.has(i) || !overlap(body, {x: w.x - 24, y: w.y - 24, w: 48, h: 48})) return;
      this.weakHits.add(i);
      this.say(
        'weak',
        this.weakHits.size >= this.weakPoints.length
          ? '마지막 약점! 보스를 완전히 물리쳤어요'
          : `보스 약점 타격! ${this.weakHits.size}/${this.weakPoints.length}`,
      );
    });
  }
  get bossHp() {
    return this.weakPoints.length - this.weakHits.size;
  }
  // Surprise missions and the chase.
  private updatePacing() {
    this.updateChase();
    if (!this.extras) return;
    const next = this.missions[this.missionIndex];
    if (!this.mission && next && this.x >= next.at) {
      this.missionIndex++;
      this.mission = {
        ...next,
        until: this.time + next.seconds,
        progress: 0,
        base: {stars: this.stars, hpLoss: this.hpLoss, stomps: this.stomps},
      };
      // Penelope's ability: two more seconds for every mission.
      const seconds = next.seconds + (this.ability('penelope') ? 2 : 0);
      this.mission.until = this.time + seconds;
      this.mission.seconds = seconds;
      this.say(
        'mission-start',
        MISSION_TEXT[next.kind].replace('{s}', String(seconds)).replace('{n}', String(next.goal)),
      );
    }
    const m = this.mission;
    if (m) {
      m.progress =
        m.kind === 'stars'
          ? this.stars - m.base.stars
          : m.kind === 'stomp'
            ? this.stomps - m.base.stomps
            : Math.min(m.seconds, m.seconds - Math.max(0, m.until - this.time));
      const hurt = this.hpLoss > m.base.hpLoss,
        won = m.kind === 'clean' ? !hurt && this.time >= m.until : m.progress >= m.goal;
      if (won) {
        this.mission = null;
        this.missionsDone++;
        this.comboPoints = Math.min(MAX_COMBO_POINTS, this.comboPoints + MISSION_REWARD);
        this.say('mission', '미션 성공! 콤보 점수 +200');
        this.fill(FEVER_FULL / 2);
      } else if (this.time >= m.until || (m.kind === 'clean' && hurt)) {
        this.mission = null;
        this.say('mission-fail', '아쉬워요! 다음 미션을 노려요');
      }
    }
  }
  // The chase (ordinary runs and student courses): a clean escape earns combo points.
  private updateChase() {
    const c = this.chase;
    if (c && !this.chasing && !this.chaseEscaped && this.x >= c.start && this.x < c.end && this.chaseHits === 0) {
      this.chasing = true;
      this.say('chase-start', `${CHASERS[this.stage].name}! 달려요!`);
    } else if (c && this.chasing && this.x >= c.end) {
      this.chasing = false;
      if (this.chaseHits === 0) {
        this.chaseEscaped = true;
        this.comboPoints = Math.min(MAX_COMBO_POINTS, this.comboPoints + CHASE_BONUS);
        this.say('chase', '추격을 따돌렸어요! 콤보 점수 +300');
      }
    }
  }
  private updateExtras(body: Rect) {
    const t = this.treasure;
    if (t && !this.treasureFound && overlap(body, t)) {
      this.treasureFound = true;
      this.message = '숨은 보물 상자 발견!';
      this.emit('treasure');
    }
    const g = this.gate;
    if (g && this.gateSaid === null && this.x >= g.x) {
      const o = {...GATE_O, x: g.x + GATE_O.x},
        said = overlap(body, o) || this.y < GATE_X.y - 8;
      this.gateSaid = said;
      const right = said === g.truth;
      if (right && this.rule !== 'no-shield') this.shield = true;
      this.message = right ? '정답! 아테나의 방패를 받았어요' : '아쉬워요! 수첩에서 다시 알아봐요';
      if (right) this.emit('gate');
      else this.events.push({kind: 'gate', x: this.x, y: this.y - 45, text: this.message});
    }
  }
  get gateRight() {
    return this.gate && this.gateSaid !== null ? this.gateSaid === this.gate.truth : null;
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
    return score(this.maxDistance, this.stars, this.maps.size, this.state === 'success', this.length);
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
      extras: {
        combo: this.bestCombo,
        comboPoints: this.comboPoints,
        blessing: this.blessing,
        ...(this.treasureFound && this.treasure ? {treasure: this.treasure.id} : {}),
        ...(this.gate && this.gateRight !== null ? {gate: {quiz: this.gate.quiz, right: this.gateRight}} : {}),
        ...(this.extras
          ? {missions: this.missionsDone, fevers: this.fevers, chase: this.chaseEscaped, stomps: this.stomps}
          : {}),
      },
    };
    return this.finalized;
  }
}
