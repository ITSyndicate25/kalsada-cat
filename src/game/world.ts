import { choose, randInt, type Rng } from './rng';

export const TILE = 20;
export const COLS = 13;
export const VIEW_ROWS = 21;
export const STAGE_WIDTH = COLS * TILE;
export const STAGE_HEIGHT = VIEW_ROWS * TILE;
export const START_COL = 6;
export const START_ROW = 1;

export type RowKind = 'road' | 'sidewalk';
export type VehicleKind = 'jeepney' | 'tricycle' | 'bus';
export type SceneTheme = 'barangay' | 'palengke' | 'provinciya' | 'city' | 'tiangge' | 'baywalk';
export type PropKind =
  | 'store'
  | 'cart'
  | 'chairs'
  | 'trash'
  | 'plant'
  | 'sign'
  | 'pole'
  | 'crates'
  | 'bench'
  | 'stall'
  | 'sacks'
  | 'trikePark'
  | 'barricade';
export type PickupKind =
  | 'fishball'
  | 'kikiam'
  | 'anting'
  | 'enforcer'
  | 'payong'
  | 'tsinelas'
  | 'halohalo'
  | 'balut'
  | 'turon'
  | 'sampaguita';
export type PowerKind = Exclude<PickupKind, 'fishball' | 'kikiam' | 'anting'>;

export const VEHICLE_WIDTH: Record<VehicleKind, number> = {
  jeepney: 58,
  tricycle: 32,
  bus: 76,
};

export const VEHICLE_VARIANTS = 12;

export const PROP_WIDTH: Record<PropKind, number> = {
  store: 3,
  cart: 2,
  chairs: 1,
  trash: 1,
  plant: 1,
  sign: 1,
  pole: 1,
  crates: 1,
  bench: 2,
  stall: 2,
  sacks: 1,
  trikePark: 2,
  barricade: 1,
};

export const SCENE_ORDER: readonly SceneTheme[] = ['barangay', 'palengke', 'provinciya', 'city', 'tiangge', 'baywalk'];

const THEME_PROPS: Readonly<Record<SceneTheme, readonly PropKind[]>> = {
  barangay: ['chairs', 'trash', 'plant', 'sign', 'trikePark'],
  // Duplicate entries weight the mix; the palengke leans on produce crates and rice sacks.
  palengke: ['crates', 'crates', 'chairs', 'trash', 'sign', 'sacks'],
  provinciya: ['sacks', 'sacks', 'plant', 'plant', 'sign', 'chairs'],
  city: ['sign', 'plant', 'trash', 'chairs', 'trikePark'],
  tiangge: ['stall', 'stall', 'chairs', 'trash'],
  baywalk: ['bench', 'plant', 'trash', 'chairs'],
};

export const PICKUP_BONUS: Record<PickupKind, number> = {
  fishball: 5,
  kikiam: 10,
  anting: 0,
  enforcer: 0,
  payong: 0,
  tsinelas: 0,
  halohalo: 0,
  balut: 0,
  turon: 0,
  sampaguita: 0,
};

const POWER_POOL: readonly PowerKind[] = ['tsinelas', 'tsinelas', 'halohalo', 'halohalo', 'turon', 'turon', 'sampaguita', 'sampaguita', 'balut'];
// Traffic enforcer and payong are the strong ones: they only join the pool after row 40.
const RARE_POWER_POOL: readonly PowerKind[] = [...POWER_POOL, 'payong', 'enforcer', 'payong', 'enforcer'];

export const POWER_KINDS: readonly PowerKind[] = ['enforcer', 'payong', 'tsinelas', 'halohalo', 'balut', 'turon', 'sampaguita'];

const DOG_SPEED = 1.15;
const VENDOR_WIDTH = 32;
const BARRICADE_TIME_MIN = 4;
const BARRICADE_TIME_MAX = 8;

export interface Vehicle {
  kind: VehicleKind;
  variant: number;
  x: number;
  width: number;
}

export interface Lane {
  row: number;
  dir: 1 | -1;
  speed: number;
  vehicles: Vehicle[];
}

export interface Prop {
  kind: PropKind;
  col: number;
  row: number;
  width: number;
  variant: number;
}

export interface Pickup {
  kind: PickupKind;
  col: number;
  row: number;
}

export interface Dog {
  row: number;
  minCol: number;
  maxCol: number;
  pos: number;
  dir: 1 | -1;
}

export interface Vendor {
  row: number;
  x: number;
  dir: 1 | -1;
  speed: number;
}

export interface Spark {
  col: number;
  row: number;
  phase: number;
}

const tileKey = (col: number, row: number): string => `${col},${row}`;

export class World {
  readonly rows: RowKind[] = [];
  readonly themes: SceneTheme[] = [];
  readonly lanes = new Map<number, Lane>();
  readonly props: Prop[] = [];
  readonly pickups: Pickup[] = [];
  readonly wireRows = new Set<number>();
  readonly dogs: Dog[] = [];
  readonly vendors: Vendor[] = [];
  readonly sparks = new Map<number, Spark>();
  readonly lubak = new Set<string>();

  private readonly blocked = new Map<string, Prop>();
  private readonly pickupTiles = new Map<string, Pickup>();
  private readonly barricadeTimers = new Map<string, number>();
  private readonly rng: Rng;
  private scene: SceneTheme = 'barangay';
  private roadBlocks = 0;

  constructor(rng: Rng) {
    this.rng = rng;
    this.ensure(VIEW_ROWS + 12);
  }

  kindAt(row: number): RowKind | undefined {
    return this.rows[row];
  }

  laneAt(row: number): Lane | undefined {
    return this.lanes.get(row);
  }

  themeAt(row: number): SceneTheme {
    return this.themes[row] ?? 'barangay';
  }

  blockedAt(col: number, row: number): boolean {
    return this.blocked.has(tileKey(col, row));
  }

  isLubak(col: number, row: number): boolean {
    return this.lubak.has(tileKey(col, row));
  }

  collectPickup(col: number, row: number): Pickup | undefined {
    const key = tileKey(col, row);
    const pickup = this.pickupTiles.get(key);
    if (!pickup) return undefined;
    this.takePickup(pickup);
    return pickup;
  }

  /**
   * Moves fishballs one tile toward the cat. Fishballs that step onto the
   * cat's tile are collected and returned so the engine can score them.
   */
  pullFishballs(col: number, row: number, radius: number): Pickup[] {
    const collected: Pickup[] = [];

    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      if (!pickup || pickup.kind !== 'fishball') continue;

      const dc = pickup.col - col;
      const dr = pickup.row - row;
      const dist = Math.abs(dc) + Math.abs(dr);
      if (dist === 0 || dist > radius) continue;

      if (dist === 1) {
        this.takePickup(pickup);
        collected.push(pickup);
        continue;
      }

      const preferRow = Math.abs(dr) >= Math.abs(dc);
      // dc/dr point from the cat to the fishball; steps must run the other way.
      const steps: Array<{ c: number; r: number }> = preferRow
        ? [
            { c: 0, r: -Math.sign(dr) },
            { c: -Math.sign(dc), r: 0 },
          ]
        : [
            { c: -Math.sign(dc), r: 0 },
            { c: 0, r: -Math.sign(dr) },
          ];

      for (const step of steps) {
        if (step.c === 0 && step.r === 0) continue;
        const nextCol = pickup.col + step.c;
        const nextRow = pickup.row + step.r;
        const key = tileKey(nextCol, nextRow);
        if (this.blocked.has(key) || this.pickupTiles.has(key)) continue;
        if (this.sparks.get(nextRow)?.col === nextCol) continue;
        this.pickupTiles.delete(tileKey(pickup.col, pickup.row));
        pickup.col = nextCol;
        pickup.row = nextRow;
        this.pickupTiles.set(key, pickup);
        break;
      }
    }

    return collected;
  }

  /** Clears one prop near the cat; poles stay so the skyline stays coherent. */
  removeRandomPropNear(col: number, row: number, radius: number): boolean {
    const candidates = this.props.filter(
      (prop) => prop.kind !== 'pole' && Math.abs(prop.col - col) <= radius && Math.abs(prop.row - row) <= radius,
    );
    const prop = choose(this.rng, candidates);
    if (!prop) return false;
    this.removeProp(prop);
    return true;
  }

  ensure(minRows: number): void {
    if (this.rows.length === 0) {
      this.addSidewalkBlock(3, true);
    }

    let guard = 0;
    while (this.rows.length < minRows && guard < 2000) {
      guard += 1;
      this.addRoadBlock();
      this.addSidewalkBlock(3, false);
    }
  }

  updateTraffic(dt: number, minRow: number, maxRow: number): void {
    const from = Math.max(0, minRow);
    const to = Math.min(this.rows.length - 1, maxRow);

    for (let row = from; row <= to; row += 1) {
      const lane = this.lanes.get(row);
      if (!lane) continue;

      for (const vehicle of lane.vehicles) {
        vehicle.x += lane.dir * lane.speed * dt;
        const buffer = 60;

        if (lane.dir > 0 && vehicle.x > STAGE_WIDTH + buffer) {
          let rear = Number.POSITIVE_INFINITY;
          for (const other of lane.vehicles) {
            if (other !== vehicle) rear = Math.min(rear, other.x);
          }
          const gap = randInt(this.rng, 42, 120);
          const entry = -vehicle.width - gap;
          vehicle.x = Math.min(entry, rear - vehicle.width - gap);
        } else if (lane.dir < 0 && vehicle.x + vehicle.width < -buffer) {
          let front = Number.NEGATIVE_INFINITY;
          for (const other of lane.vehicles) {
            if (other !== vehicle) front = Math.max(front, other.x + other.width);
          }
          const gap = randInt(this.rng, 42, 120);
          const entry = STAGE_WIDTH + gap;
          vehicle.x = Math.max(entry, front + gap);
        }
      }
    }
  }

  /** Moves dogs, taho vendors, and ticking barricades. Frozen stops everything. */
  update(dt: number, frozen: boolean, calm: boolean, minRow = 0, maxRow = Number.POSITIVE_INFINITY): void {
    if (!frozen) {
      for (const vendor of this.vendors) {
        if (vendor.row < minRow || vendor.row > maxRow) continue;
        vendor.x += vendor.dir * vendor.speed * dt;
        if (vendor.dir > 0 && vendor.x > STAGE_WIDTH + 48) vendor.x = -VENDOR_WIDTH - 16;
        else if (vendor.dir < 0 && vendor.x < -VENDOR_WIDTH - 16) vendor.x = STAGE_WIDTH + 48;
      }

      // A barricade only counts down while the camera can see it: rows generate
      // far above the cat, and a timer that runs from generation would expire
      // before the player ever reaches the tile.
      for (const [key, remaining] of [...this.barricadeTimers]) {
        const row = Number(key.split(',')[1]);
        if (row < minRow || row > maxRow) continue;
        const left = remaining - dt;
        if (left <= 0) {
          this.barricadeTimers.delete(key);
          const prop = this.blocked.get(key);
          if (prop) this.removeProp(prop);
        } else {
          this.barricadeTimers.set(key, left);
        }
      }
    }

    if (frozen || calm) return;

    for (const dog of this.dogs) {
      if (dog.row < minRow || dog.row > maxRow) continue;
      dog.pos += dog.dir * DOG_SPEED * dt;
      if (dog.pos >= dog.maxCol) {
        dog.pos = dog.maxCol;
        dog.dir = -1;
      } else if (dog.pos <= dog.minCol) {
        dog.pos = dog.minCol;
        dog.dir = 1;
      }
    }
  }

  private addRoadBlock(): void {
    if (this.roadBlocks > 0 && this.roadBlocks % 3 === 0) {
      const index = SCENE_ORDER.indexOf(this.scene);
      this.scene = SCENE_ORDER[(index + 1) % SCENE_ORDER.length] ?? 'barangay';
    }
    this.roadBlocks += 1;

    const scene = this.scene;
    const progress = this.rows.length;
    const difficulty = Math.min(1, progress / 280);

    const laneCount =
      progress < 20 ? 2 : progress < 70 ? randInt(this.rng, 2, 3) : progress < 150 ? randInt(this.rng, 3, 4) : randInt(this.rng, 3, 5);

    let previousDir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;

    for (let index = 0; index < laneCount; index += 1) {
      const row = this.rows.length;
      const dir: 1 | -1 = index === 0 ? previousDir : this.rng() < 0.62 ? (previousDir === 1 ? -1 : 1) : previousDir;
      previousDir = dir;
      this.rows.push('road');
      this.themes.push(scene);

      const kind = this.pickVehicle(progress);
      const pace = kind === 'tricycle' ? 1.24 : kind === 'bus' ? 0.88 : 1;
      const speed = (27 + this.rng() * 20 + difficulty * 34) * pace;

      const gapMin = Math.max(48, Math.round(96 - difficulty * 38));
      const gapMax = gapMin + 64;
      const lane: Lane = { row, dir, speed, vehicles: [] };
      this.fillLane(lane, kind, gapMin, gapMax);
      this.lanes.set(row, lane);
    }

    if (this.rng() < 0.36) {
      const row = this.rows.length - 1 - randInt(this.rng, 0, laneCount - 1);
      const col = randInt(this.rng, 0, COLS - 1);
      this.addPickup(this.rng() < 0.22 && progress > 55 ? 'kikiam' : 'fishball', col, row);
    }

    if (progress > 8 && this.rng() < 0.4) this.addLubak(laneCount);
  }

  private addLubak(laneCount: number): void {
    const count = randInt(this.rng, 1, 2);
    for (let index = 0; index < count; index += 1) {
      const offset = randInt(this.rng, 1, laneCount);
      const row = this.rows.length - offset;
      if (this.rows[row] !== 'road') continue;
      const col = randInt(this.rng, 0, COLS - 1);
      this.lubak.add(tileKey(col, row));
    }
  }

  private pickVehicle(progress: number): VehicleKind {
    const roll = this.rng();
    if (progress > 55 && roll < 0.14) return 'bus';
    if (progress > 16 && roll < 0.4) return 'tricycle';
    return 'jeepney';
  }

  private fillLane(lane: Lane, kind: VehicleKind, gapMin: number, gapMax: number): void {
    const width = VEHICLE_WIDTH[kind];
    let x = -width - this.rng() * gapMax;

    while (x < STAGE_WIDTH + width) {
      lane.vehicles.push({
        kind,
        variant: randInt(this.rng, 0, VEHICLE_VARIANTS - 1),
        x,
        width,
      });
      x += width + randInt(this.rng, gapMin, gapMax);
    }
  }

  private addSidewalkBlock(size: number, initial: boolean): void {
    const start = this.rows.length;
    const scene = this.scene;
    for (let index = 0; index < size; index += 1) {
      this.rows.push('sidewalk');
      this.themes.push(scene);
    }
    const top = start + size - 1;
    const middle = start + 1;
    const safeCol = initial ? START_COL : randInt(this.rng, 3, 9);

    if (!initial && this.rng() < 0.5) {
      const left = this.placeProp('pole', 0, top, safeCol);
      const right = this.placeProp('pole', COLS - 1, top, safeCol);
      if (left && right) {
        this.wireRows.add(top);
        if (this.rng() < 0.35) this.addSpark(top, safeCol);
      }
    }

    const storeChance =
      initial ? 0.9 : scene === 'palengke' ? 0.82 : scene === 'city' ? 0.55 : scene === 'tiangge' ? 0.35 : scene === 'baywalk' ? 0.48 : 0.55;
    if (this.rng() < storeChance) {
      this.pickAndPlace('store', top, [0, 1, 2, 8, 9, 10], safeCol);
    }

    const cartChance = scene === 'palengke' ? 0.86 : scene === 'tiangge' ? 0.5 : scene === 'city' ? 0.4 : scene === 'baywalk' ? 0.55 : 0.45;
    if (this.rng() < cartChance) {
      this.pickAndPlace('cart', middle, [0, 1, 2, 3, 8, 9, 10, 11], safeCol);
    }

    const decorativeRows = initial ? [start, top] : [start, middle, top];
    const smallProps = THEME_PROPS[scene];
    const propCount = randInt(this.rng, initial ? 1 : 2, initial ? 2 : 4);
    const sideColumns = [0, 1, 2, 3, 4, 8, 9, 10, 11, 12];

    for (let index = 0; index < propCount; index += 1) {
      const kind = choose(this.rng, smallProps);
      const row = choose(this.rng, decorativeRows);
      if (!kind || row === undefined) continue;
      this.pickAndPlace(kind, row, sideColumns, safeCol);
    }

    if (!initial && start > 30 && this.rng() < 0.3) {
      const prop = this.pickAndPlace('barricade', middle, sideColumns, safeCol);
      if (prop) this.barricadeTimers.set(tileKey(prop.col, prop.row), randInt(this.rng, BARRICADE_TIME_MIN, BARRICADE_TIME_MAX));
    }

    if (!initial && start > 10 && this.rng() < 0.4) this.spawnDog(middle, safeCol);
    if (!initial && start > 18 && this.rng() < 0.22) this.spawnVendor(middle);

    this.addSidewalkPickups(start, size, initial);
  }

  private addSpark(top: number, safeCol: number): void {
    const candidates: number[] = [];
    for (let col = 1; col <= COLS - 2; col += 1) {
      if (col === safeCol) continue;
      if (this.blocked.has(tileKey(col, top))) continue;
      candidates.push(col);
    }
    const col = choose(this.rng, candidates);
    if (col === undefined) return;
    this.sparks.set(top, { col, row: top, phase: this.rng() });
  }

  private spawnDog(row: number, safeCol: number): void {
    const runs: Array<{ start: number; end: number }> = [];
    let runStart = -1;
    for (let col = 0; col <= COLS; col += 1) {
      const open = col < COLS && !this.blocked.has(tileKey(col, row));
      if (open && runStart < 0) runStart = col;
      else if (!open && runStart >= 0) {
        runs.push({ start: runStart, end: col - 1 });
        runStart = -1;
      }
    }

    const usable = runs.filter((run) => run.end > run.start);
    if (usable.length === 0) return;
    const away = usable.filter((run) => safeCol < run.start || safeCol > run.end);
    const pool = away.length > 0 ? away : usable;
    const run = choose(this.rng, pool);
    if (!run) return;

    const span = Math.min(run.end - run.start + 1, randInt(this.rng, 2, 4));
    const start = run.start + randInt(this.rng, 0, run.end - run.start + 1 - span);
    this.dogs.push({
      row,
      minCol: start,
      maxCol: start + span - 1,
      pos: start + this.rng() * (span - 1),
      dir: this.rng() < 0.5 ? 1 : -1,
    });
  }

  private spawnVendor(row: number): void {
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    this.vendors.push({
      row,
      x: dir > 0 ? -VENDOR_WIDTH - 16 : STAGE_WIDTH + 16,
      dir,
      speed: 22 + this.rng() * 12,
    });
  }

  private addSidewalkPickups(start: number, size: number, initial: boolean): void {
    const free: Array<{ col: number; row: number }> = [];
    for (let row = start; row < start + size; row += 1) {
      const spark = this.sparks.get(row);
      for (let col = 0; col < COLS; col += 1) {
        if (initial && col === START_COL && row === START_ROW) continue;
        if (spark && spark.col === col) continue;
        if (this.blocked.has(tileKey(col, row))) continue;
        if (this.pickupTiles.has(tileKey(col, row))) continue;
        free.push({ col, row });
      }
    }

    if (free.length === 0) return;

    if (this.rng() < 0.82) {
      const spot = choose(this.rng, free);
      if (spot) this.addPickup('fishball', spot.col, spot.row);
    }

    if (this.rng() < 0.24) {
      const spot = choose(this.rng, free);
      if (spot) this.addPickup('kikiam', spot.col, spot.row);
    }

    if (start > 24 && this.rng() < 0.075) {
      const spot = choose(this.rng, free);
      if (spot) this.addPickup('anting', spot.col, spot.row);
    }

    if (start > 20 && this.rng() < 0.12) {
      const kind = choose(this.rng, start > 40 ? RARE_POWER_POOL : POWER_POOL);
      const spot = choose(this.rng, free);
      if (kind && spot) this.addPickup(kind, spot.col, spot.row);
    }
  }

  private pickAndPlace(kind: PropKind, row: number, columns: readonly number[], safeCol: number): Prop | undefined {
    const candidates = columns.filter((col) => this.canPlace(kind, col, row, safeCol));
    const col = choose(this.rng, candidates);
    if (col === undefined) return undefined;
    if (!this.placeProp(kind, col, row, safeCol)) return undefined;
    return this.blocked.get(tileKey(col, row));
  }

  private canPlace(kind: PropKind, col: number, row: number, safeCol: number): boolean {
    const width = PROP_WIDTH[kind];
    if (col < 0 || col + width > COLS) return false;
    if (safeCol >= col && safeCol < col + width) return false;
    // A spark tile stays open: a prop drawn over it would hide the bolt, and
    // the sampaguita clearing that prop would reveal a hazard nobody saw.
    const spark = this.sparks.get(row);
    if (spark && spark.col >= col && spark.col < col + width) return false;

    for (let x = col; x < col + width; x += 1) {
      if (this.blocked.has(tileKey(x, row))) return false;
    }
    return true;
  }

  private placeProp(kind: PropKind, col: number, row: number, safeCol: number): boolean {
    if (!this.canPlace(kind, col, row, safeCol)) return false;
    const prop: Prop = { kind, col, row, width: PROP_WIDTH[kind], variant: randInt(this.rng, 0, 2) };
    this.props.push(prop);
    for (let x = col; x < col + prop.width; x += 1) {
      this.blocked.set(tileKey(x, row), prop);
    }
    return true;
  }

  private removeProp(prop: Prop): void {
    const index = this.props.indexOf(prop);
    if (index >= 0) this.props.splice(index, 1);
    for (let x = prop.col; x < prop.col + prop.width; x += 1) {
      const key = tileKey(x, prop.row);
      if (this.blocked.get(key) === prop) this.blocked.delete(key);
      this.barricadeTimers.delete(key);
    }
  }

  private addPickup(kind: PickupKind, col: number, row: number): void {
    const key = tileKey(col, row);
    if (this.blocked.has(key) || this.pickupTiles.has(key)) return;
    const pickup: Pickup = { kind, col, row };
    this.pickupTiles.set(key, pickup);
    this.pickups.push(pickup);
  }

  private takePickup(pickup: Pickup): void {
    this.pickupTiles.delete(tileKey(pickup.col, pickup.row));
    const index = this.pickups.indexOf(pickup);
    if (index >= 0) this.pickups.splice(index, 1);
  }
}
