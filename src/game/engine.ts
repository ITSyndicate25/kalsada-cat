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
} from './world';

export type Phase = 'ready' | 'playing' | 'paused' | 'dying' | 'over';
export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameEvent =
  | { type: 'start' }
  | { type: 'hop' }
  | { type: 'bump' }
  | { type: 'pickup'; kind: PickupKind; bonus: number }
  | { type: 'shield-break' }
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

const DELTAS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

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
  shield = false;
  invuln = 0;
  time = 0;
  shake = 0;
  flash = 0;
  lastRunRecord = false;
  readonly popups: Popup[] = [];
  readonly particles: Particle[] = [];

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
  }

  start(): void {
    this.world = new World(this.rng);
    this.player = this.makePlayer();
    this.phase = 'playing';
    this.score = 0;
    this.maxRow = START_ROW;
    this.camera = 0;
    this.shield = false;
    this.invuln = 0;
    this.queued = null;
    this.deathTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.lastRunRecord = false;
    this.bestAtRunStart = this.best;
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
    this.shield = false;
    this.invuln = 0;
    this.queued = null;
    this.deathTimer = 0;
    this.lastRunRecord = false;
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
    if (this.player.hop < 1) {
      this.queued = direction;
      return;
    }
    this.step(direction);
  }

  update(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    this.time += dt;
    if (this.phase === 'paused') return;

    if (this.phase === 'playing') {
      this.invuln = Math.max(0, this.invuln - dt);
      this.advanceHop(dt);
    }

    if (this.phase !== 'dying') {
      const from = Math.max(0, Math.floor(this.camera) - 3);
      const to = Math.floor(this.camera) + VIEW_ROWS + 3;
      this.world.updateTraffic(dt, from, to);
    }

    if (this.phase === 'playing') {
      this.checkVehicleHits();
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

  private step(direction: Direction): void {
    const delta = DELTAS[direction];
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
    if (this.player.hop >= 1) return;

    this.player.hop = Math.min(1, this.player.hop + dt / HOP_TIME);
    if (this.player.hop < 1) return;

    this.collectAtCurrentTile();

    const queued = this.queued;
    this.queued = null;
    if (queued && this.phase === 'playing') this.step(queued);
  }

  private collectAtCurrentTile(): void {
    const pickup = this.world.collectPickup(this.player.col, this.player.row);
    if (!pickup) return;

    if (pickup.kind === 'anting') {
      if (this.shield) {
        this.award(15);
        this.popups.push({
          x: pickup.col + 0.5,
          y: pickup.row + 0.75,
          text: '+15',
          life: 0.8,
          maxLife: 0.8,
        });
        this.events.push({ type: 'pickup', kind: pickup.kind, bonus: 15 });
      } else {
        this.shield = true;
        this.spawnBurst(pickup.row + 0.5, 0.55, ['#ffd23f', '#fff3c4', '#e8553e'], 8, 0.5);
        this.events.push({ type: 'pickup', kind: pickup.kind, bonus: 0 });
      }
      return;
    }

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
  }

  private checkVehicleHits(): void {
    const visualRow = this.visualRow();
    const visualCol = this.visualCol();
    const fromRow = Math.max(0, Math.floor(visualRow) - 1);
    const toRow = Math.floor(visualRow) + 1;

    const cat: Rect = {
      x: visualCol * TILE + TILE / 2 + CAT_HITBOX.x,
      y: visualRow * TILE + TILE / 2 + CAT_HITBOX.y,
      w: CAT_HITBOX.w,
      h: CAT_HITBOX.h,
    };

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

        if (this.invuln > 0) return;
        if (this.shield) {
          this.shield = false;
          this.invuln = 1.5;
          this.flash = 0.22;
          this.shake = 0.18;
          this.spawnBurst(visualRow, 0.5, ['#ffd23f', '#fff3c4', '#ff8a5c'], 10, 0.55);
          this.events.push({ type: 'shield-break' });
          return;
        }

        this.die();
        return;
      }
    }
  }

  private die(): void {
    this.phase = 'dying';
    this.deathTimer = 0;
    this.shake = 0.4;
    this.flash = 0.16;
    this.queued = null;
    this.spawnBurst(this.visualRow() + 0.3, 0.7, ['#ffd23f', '#e8553e', '#f6efdf'], 12, 0.7);
    this.events.push({ type: 'crash' });
  }

  private award(points: number): void {
    if (points <= 0) return;
    this.score += points;
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
