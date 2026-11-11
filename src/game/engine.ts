import { choose, type Rng } from './rng';
import {
  COLS,
  PICKUP_BONUS,
  START_COL,
  START_ROW,
  TILE,
  VIEW_ROWS,
  World,
  type PickupKind,
  type PowerKind,
} from './world';

export type Phase = 'ready' | 'playing' | 'paused' | 'dying' | 'over';
export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameEvent =
  | { type: 'start' }
  | { type: 'hop' }
  | { type: 'bump' }
  | { type: 'pickup'; kind: PickupKind; bonus: number }
  | { type: 'stumble' }
  | { type: 'shield-break' }
  | { type: 'payong-break' }
  | { type: 'revive' }
  | { type: 'crash' }
  | { type: 'gameover'; score: number; best: number; record: boolean };

export interface PlayerState {
  col: number;
  row: number;
  fromCol: number;
  fromRow: number;
  hop: number;
  bump: number;
  facing: Direction;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const HOP_TIME = 0.115;
const DEATH_TIME = 0.85;
const CAMERA_ANCHOR = 5;
const CAT_HITBOX: Rect = { x: -4.5, y: -3.5, w: 9, h: 7 };
const STUMBLE_TIME = 0.15;
const FREEZE_TIME = 4;
const SPEED_TIME = 6;
const POINTS_TIME = 10;
const MAGNET_TIME = 8;
const CALM_TIME = 8;
const MAGNET_RADIUS = 2;
const SPARK_CYCLE = 1;
const SPARK_ACTIVE = 0.3;
/** The bolt crackles this long before it strikes, so the hit is readable. */
const SPARK_WARN = 0.18;

const DELTAS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Counts a timer down; a step past zero lands exactly at zero so chips disappear on time. */
const decay = (value: number, dt: number): number => (value <= dt ? 0 : value - dt);

export interface EngineOptions {
  best?: number;
  rng?: Rng;
}

export class Engine {
  phase: Phase = 'ready';
  world: World;
  player: PlayerState;
  camera = 0;
  score = 0;
  best = 0;
  shields = 0;
  /** Player-facing labels for popups; the shell localizes them. */
  shieldPopup = 'SHIELD';
  powerLabels: Record<PowerKind, string>;
  invuln = 0;
  time = 0;
  shake = 0;
  flash = 0;
  lastRunRecord = false;
  readonly popups: Popup[] = [];
  readonly particles: Particle[] = [];

  // Timed effects; several may run at once, never twice of the same kind.
  freezeTimer = 0;
  speedTimer = 0;
  pointsTimer = 0;
  magnetTimer = 0;
  calmTimer = 0;
  payong = false;
  stumble = 0;

  private readonly rng: Rng;
  private readonly events: GameEvent[] = [];
  private maxRow = START_ROW;
  private queued: Direction | null = null;
  private bestAtRunStart = 0;
  private deathTimer = 0;

  constructor(options: EngineOptions = {}) {
    this.rng = options.rng ?? Math.random;
    this.best = Math.max(0, options.best ?? 0);
    this.bestAtRunStart = this.best;
    this.world = new World(this.rng);
    this.player = this.makePlayer();
    this.powerLabels = {
      enforcer: 'WHISTLE',
      payong: 'UMBRELLA',
      tsinelas: 'SLIPPERS',
      halohalo: 'HALO-HALO',
      balut: 'BALUT',
      turon: 'TURON',
      sampaguita: 'SAMPAGUITA',
    };
  }

  start(): void {
    this.world = new World(this.rng);
    this.player = this.makePlayer();
    this.phase = 'playing';
    this.score = 0;
    this.maxRow = START_ROW;
    this.camera = 0;
    this.shields = 0;
    this.invuln = 0;
    this.queued = null;
    this.deathTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.lastRunRecord = false;
    this.bestAtRunStart = this.best;
    this.clearPowers();
    this.popups.length = 0;
    this.particles.length = 0;
    this.events.push({ type: 'start' });
  }

  goHome(): void {
    this.world = new World(this.rng);
    this.player = this.makePlayer();
    this.phase = 'ready';
    this.score = 0;
    this.maxRow = START_ROW;
    this.camera = 0;
    this.shields = 0;
    this.invuln = 0;
    this.queued = null;
    this.deathTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.lastRunRecord = false;
    this.clearPowers();
    this.popups.length = 0;
    this.particles.length = 0;
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.queued = null;
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
  }

  move(direction: Direction): void {
    if (this.phase !== 'playing') return;
    this.player.facing = direction;
    this.queued = direction;
    this.stepQueued();
  }

  /** Starts the buffered hop once the cat is grounded and clear of a pothole. */
  private stepQueued(): void {
    if (this.phase !== 'playing' || this.player.hop < 1 || this.stumble > 0) return;
    const queued = this.queued;
    this.queued = null;
    if (queued) this.step(queued);
  }

  /** Live effect chips for the HUD: timed effects first, then held charges. */
  effectChips(): Array<{ kind: PowerKind; label: string; seconds: number }> {
    const chips: Array<{ kind: PowerKind; label: string; seconds: number }> = [];
    const push = (kind: PowerKind, seconds: number) => {
      if (seconds <= 0) return;
      chips.push({ kind, label: this.powerLabels[kind] ?? kind, seconds: Math.ceil(seconds) });
    };
    push('enforcer', this.freezeTimer);
    push('tsinelas', this.speedTimer);
    push('halohalo', this.pointsTimer);
    push('turon', this.magnetTimer);
    push('sampaguita', this.calmTimer);
    // Held charges do not expire: seconds 0 tells the HUD to show a held marker.
    if (this.payong) chips.push({ kind: 'payong', label: this.powerLabels.payong ?? 'PAYONG', seconds: 0 });
    if (this.holdingBalut) chips.push({ kind: 'balut', label: this.powerLabels.balut ?? 'BALUT', seconds: 0 });
    return chips;
  }

  /** Test seam: grants a power without hunting a spawn. */
  applyPowerForTest(kind: PowerKind): void {
    this.applyPower(kind, this.player.col, this.player.row);
  }

  update(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    // A paused game freezes its clock too, so the spark beat and the cat
    // animation resume exactly where they stopped.
    if (this.phase === 'paused') return;
    this.time += dt;

    if (this.phase === 'playing') {
      this.invuln = Math.max(0, this.invuln - dt);
      this.stumble = Math.max(0, this.stumble - dt);
      this.freezeTimer = decay(this.freezeTimer, dt);
      this.speedTimer = decay(this.speedTimer, dt);
      this.pointsTimer = decay(this.pointsTimer, dt);
      this.magnetTimer = decay(this.magnetTimer, dt);
      this.calmTimer = decay(this.calmTimer, dt);
      this.advanceHop(dt);
    }

    const frozen = this.freezeTimer > 0 || this.phase === 'dying';
    if (this.phase !== 'dying') {
      const from = Math.max(0, Math.floor(this.camera) - 12);
      const to = this.world.rows.length - 1;
      if (!frozen) this.world.updateTraffic(dt, from, to);
      // Actors and barricade timers only advance in the camera's window plus a
      // margin, so nothing burns down while it waits off screen.
      this.world.update(dt, frozen, this.calmTimer > 0, Math.floor(this.camera) - 2, Math.ceil(this.camera) + VIEW_ROWS + 2);
    }

    if (this.phase === 'playing') {
      if (this.magnetTimer > 0) this.collectMagnet();
      this.checkVehicleHits();
      this.checkHazards();
    }

    if (this.phase === 'playing') {
      const target = Math.max(0, this.visualRow() - CAMERA_ANCHOR);
      const smoothing = 1 - Math.exp(-dt * 9);
      this.camera += (target - this.camera) * smoothing;
    }

    if (this.phase === 'dying') {
      this.deathTimer += dt;
      if (this.deathTimer >= DEATH_TIME) {
        this.phase = 'over';
        this.lastRunRecord = this.score > this.bestAtRunStart;
        this.events.push({
          type: 'gameover',
          score: this.score,
          best: this.best,
          record: this.lastRunRecord,
        });
      }
    }

    this.world.ensure(Math.ceil(this.camera) + VIEW_ROWS + 12);
    this.updateEffects(dt);
  }

  drainEvents(): GameEvent[] {
    const drained = [...this.events];
    this.events.length = 0;
    return drained;
  }

  visualCol(): number {
    const t = 1 - (1 - this.player.hop) ** 3;
    return this.player.fromCol + (this.player.col - this.player.fromCol) * t;
  }

  visualRow(): number {
    const t = 1 - (1 - this.player.hop) ** 3;
    return this.player.fromRow + (this.player.row - this.player.fromRow) * t;
  }

  private makePlayer(): PlayerState {
    return {
      col: START_COL,
      row: START_ROW,
      fromCol: START_COL,
      fromRow: START_ROW,
      hop: 1,
      bump: 0,
      facing: 'up',
    };
  }

  private clearPowers(): void {
    this.freezeTimer = 0;
    this.speedTimer = 0;
    this.pointsTimer = 0;
    this.magnetTimer = 0;
    this.calmTimer = 0;
    this.payong = false;
    this.stumble = 0;
    this.holdingBalut = false;
  }

  private step(direction: Direction): void {
    const delta = DELTAS[direction];
    if (!delta) return;
    const col = this.player.col + delta.x;
    const row = this.player.row + delta.y;

    if (col < 0 || col >= COLS || row < 0) return;

    if (this.world.blockedAt(col, row)) {
      this.player.bump = 0.16;
      this.events.push({ type: 'bump' });
      return;
    }

    const previousRow = this.player.row;
    this.player.fromCol = this.player.col;
    this.player.fromRow = previousRow;
    this.player.col = col;
    this.player.row = row;
    this.player.hop = 0;
    this.player.bump = 0;

    this.spawnBurst(previousRow, 0.34, ['#e8d4b0', '#c2a06d'], 2, 0.28);
    this.events.push({ type: 'hop' });

    if (row > this.maxRow) {
      this.award(row - this.maxRow);
      this.maxRow = row;
    }
  }

  private advanceHop(dt: number): void {
    // A pothole never freezes a hop in flight; it only holds the next one.
    if (this.player.hop < 1) {
      // Slippers halve the hop time.
      const duration = this.speedTimer > 0 ? HOP_TIME / 2 : HOP_TIME;
      this.player.hop = Math.min(1, this.player.hop + dt / duration);
      if (this.player.hop < 1) return;
      this.collectAtCurrentTile();
      this.checkLubak();
    }

    this.stepQueued();
  }

  private checkLubak(): void {
    if (!this.world.isLubak(this.player.col, this.player.row)) return;
    this.stumble = STUMBLE_TIME;
    this.spawnBurst(this.player.row + 0.5, 0.4, ['#6b5a45', '#8a7458', '#4e4132'], 6, 0.4);
    this.events.push({ type: 'stumble' });
  }

  private collectMagnet(): void {
    const collected = this.world.pullFishballs(this.player.col, this.player.row, MAGNET_RADIUS);
    for (const pickup of collected) {
      const bonus = PICKUP_BONUS[pickup.kind];
      this.award(bonus);
      this.popups.push({ x: pickup.col + 0.5, y: pickup.row + 0.75, text: `+${bonus}`, life: 0.7, maxLife: 0.7 });
      this.events.push({ type: 'pickup', kind: pickup.kind, bonus });
    }
  }

  private collectAtCurrentTile(): void {
    const pickup = this.world.collectPickup(this.player.col, this.player.row);
    if (!pickup) return;

    if (pickup.kind === 'anting') {
      this.shields += 1;
      this.popups.push({
        x: pickup.col + 0.5,
        y: pickup.row + 0.75,
        text: this.shieldPopup,
        life: 0.8,
        maxLife: 0.8,
      });
      this.spawnBurst(pickup.row + 0.5, 0.55, ['#ffd23f', '#fff3c4', '#e8553e'], 8, 0.5);
      this.events.push({ type: 'pickup', kind: pickup.kind, bonus: 0 });
      return;
    }

    if (pickup.kind === 'fishball' || pickup.kind === 'kikiam') {
      const bonus = PICKUP_BONUS[pickup.kind];
      this.award(bonus);
      this.popups.push({
        x: pickup.col + 0.5,
        y: pickup.row + 0.75,
        text: `+${bonus}`,
        life: 0.8,
        maxLife: 0.8,
      });
      this.spawnBurst(pickup.row + 0.5, 0.5, ['#ffd23f', '#ff9f1c', '#fff3c4'], 6, 0.4);
      this.events.push({ type: 'pickup', kind: pickup.kind, bonus });
      return;
    }

    this.applyPower(pickup.kind, pickup.col, pickup.row);
  }

  private applyPower(kind: PowerKind, col: number, row: number): void {
    const label = this.powerLabels[kind] ?? kind;
    this.popups.push({ x: col + 0.5, y: row + 0.75, text: label, life: 0.9, maxLife: 0.9 });
    this.spawnBurst(row + 0.5, 0.55, ['#ffd23f', '#7bd8cc', '#fff3c4', '#8fbf58'], 10, 0.55);
    this.events.push({ type: 'pickup', kind, bonus: 0 });

    switch (kind) {
      case 'enforcer':
        this.freezeTimer = FREEZE_TIME;
        break;
      case 'payong':
        this.payong = true;
        break;
      case 'tsinelas':
        this.speedTimer = SPEED_TIME;
        break;
      case 'halohalo':
        this.pointsTimer = POINTS_TIME;
        break;
      case 'turon':
        this.magnetTimer = MAGNET_TIME;
        break;
      case 'sampaguita':
        this.calmTimer = CALM_TIME;
        this.world.removeRandomPropNear(col, row, 4);
        break;
      case 'balut':
        // Held until the crash; die() consumes it for a one-time revive.
        this.holdingBalut = true;
        break;
    }
  }

  private catRect(): Rect {
    const visualCol = this.visualCol();
    const visualRow = this.visualRow();
    return {
      x: visualCol * TILE + TILE / 2 + CAT_HITBOX.x,
      y: visualRow * TILE + TILE / 2 + CAT_HITBOX.y,
      w: CAT_HITBOX.w,
      h: CAT_HITBOX.h,
    };
  }

  /** Shared hit response: umbrella first, then one shield, then death. */
  private absorbHit(): boolean {
    if (this.invuln > 0) return true;

    if (this.payong) {
      this.payong = false;
      this.invuln = 1.5;
      this.flash = 0.22;
      this.shake = 0.18;
      this.spawnBurst(this.visualRow(), 0.5, ['#7bd8cc', '#fff3c4', '#3e79c0'], 10, 0.55);
      this.events.push({ type: 'payong-break' });
      return true;
    }

    if (this.shields > 0) {
      this.shields -= 1;
      this.invuln = 1.5;
      this.flash = 0.22;
      this.shake = 0.18;
      this.spawnBurst(this.visualRow(), 0.5, ['#ffd23f', '#fff3c4', '#ff8a5c'], 10, 0.55);
      this.events.push({ type: 'shield-break' });
      return true;
    }

    return false;
  }

  private checkVehicleHits(): void {
    const visualRow = this.visualRow();
    const fromRow = Math.max(0, Math.floor(visualRow) - 1);
    const toRow = Math.floor(visualRow) + 1;
    const cat = this.catRect();

    for (let row = fromRow; row <= toRow; row += 1) {
      const lane = this.world.laneAt(row);
      if (!lane) continue;

      for (const vehicle of lane.vehicles) {
        const car: Rect = {
          x: vehicle.x + 4,
          y: row * TILE + 3,
          w: vehicle.width - 8,
          h: 14,
        };
        if (!overlaps(cat, car)) continue;
        if (this.absorbHit()) return;
        this.die();
        return;
      }
    }
  }

  private checkHazards(): void {
    const cat = this.catRect();

    if (this.calmTimer <= 0) {
      for (const dog of this.world.dogs) {
        const rect: Rect = { x: dog.pos * TILE + 3, y: dog.row * TILE + 4, w: TILE - 6, h: TILE - 8 };
        if (!overlaps(cat, rect)) continue;
        if (this.absorbHit()) return;
        this.die();
        return;
      }
    }

    for (const vendor of this.world.vendors) {
      const rect: Rect = { x: vendor.x + 3, y: vendor.row * TILE + 3, w: 26, h: 14 };
      if (!overlaps(cat, rect)) continue;
      if (this.absorbHit()) return;
      this.die();
      return;
    }

    for (const spark of this.world.sparks.values()) {
      if (!this.sparkActive(spark.phase)) continue;
      const rect: Rect = { x: spark.col * TILE + 4, y: spark.row * TILE + 4, w: TILE - 8, h: TILE - 8 };
      if (!overlaps(cat, rect)) continue;
      if (this.absorbHit()) return;
      this.die();
      return;
    }
  }

  private sparkClock(phase: number): number {
    return (this.time + phase) % SPARK_CYCLE;
  }

  private sparkActive(phase: number): boolean {
    return this.sparkClock(phase) < SPARK_ACTIVE;
  }

  isSparkActive(phase: number): boolean {
    return this.sparkActive(phase);
  }

  /** True while the bolt is drawing itself together, just before it strikes. */
  isSparkCharging(phase: number): boolean {
    return this.sparkClock(phase) >= SPARK_CYCLE - SPARK_WARN;
  }

  private die(): void {
    if (this.holdingBalut) {
      this.revive();
      return;
    }
    this.phase = 'dying';
    this.deathTimer = 0;
    this.shake = 0.4;
    this.flash = 0.16;
    this.queued = null;
    this.spawnBurst(this.visualRow() + 0.3, 0.7, ['#ffd23f', '#e8553e', '#f6efdf'], 12, 0.7);
    this.events.push({ type: 'crash' });
  }

  private holdingBalut = false;

  private revive(): void {
    this.holdingBalut = false;
    this.invuln = 2;
    this.flash = 0.25;
    this.shake = 0.2;
    this.stumble = 0;
    const row = this.visualRow();
    this.spawnBurst(row + 0.3, 0.6, ['#ffd23f', '#f6efdf', '#e8553e'], 12, 0.7);
    this.popups.push({
      x: this.player.col + 0.5,
      y: this.player.row + 0.75,
      text: this.powerLabels.balut ?? 'BALUT',
      life: 1.1,
      maxLife: 1.1,
    });
    this.events.push({ type: 'revive' });
  }

  private award(points: number): void {
    if (points <= 0) return;
    const value = this.pointsTimer > 0 ? points * 2 : points;
    this.score += value;
    if (this.score > this.best) this.best = this.score;
  }

  private spawnBurst(row: number, spread: number, colors: readonly string[], count: number, life: number): void {
    const color = choose(this.rng, colors) ?? '#f6efdf';
    for (let index = 0; index < count; index += 1) {
      const angle = this.rng() * Math.PI * 2;
      const speed = 0.4 + this.rng() * 1.8;
      this.particles.push({
        x: this.visualCol() + 0.5 + (this.rng() - 0.5) * spread,
        y: row,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7,
        life,
        maxLife: life,
        size: this.rng() < 0.5 ? 1 : 2,
        color,
      });
    }
  }

  private updateEffects(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      if (!particle) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) this.particles.splice(index, 1);
    }

    for (let index = this.popups.length - 1; index >= 0; index -= 1) {
      const popup = this.popups[index];
      if (!popup) continue;
      popup.life -= dt;
      popup.y += dt * 0.8;
      if (popup.life <= 0) this.popups.splice(index, 1);
    }

    this.player.bump = Math.max(0, this.player.bump - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
  }
}
