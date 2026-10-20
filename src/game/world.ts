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
export type PropKind = 'store' | 'cart' | 'chairs' | 'trash' | 'plant' | 'sign' | 'pole';
export type PickupKind = 'fishball' | 'kikiam' | 'anting';

export const VEHICLE_WIDTH: Record<VehicleKind, number> = {
  jeepney: 58,
  tricycle: 32,
  bus: 76,
};

export const PROP_WIDTH: Record<PropKind, number> = {
  store: 3,
  cart: 2,
  chairs: 1,
  trash: 1,
  plant: 1,
  sign: 1,
  pole: 1,
};

export const PICKUP_BONUS: Record<PickupKind, number> = {
  fishball: 5,
  kikiam: 10,
  anting: 0,
};

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

const tileKey = (col: number, row: number): string => `${col},${row}`;

export class World {
  readonly rows: RowKind[] = [];
  readonly lanes = new Map<number, Lane>();
  readonly props: Prop[] = [];
  readonly pickups: Pickup[] = [];
  readonly wireRows = new Set<number>();

  private readonly blocked = new Map<string, Prop>();
  private readonly pickupTiles = new Map<string, Pickup>();
  private readonly rng: Rng;

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

  blockedAt(col: number, row: number): boolean {
    return this.blocked.has(tileKey(col, row));
  }

  collectPickup(col: number, row: number): Pickup | undefined {
    const key = tileKey(col, row);
    const pickup = this.pickupTiles.get(key);
    if (!pickup) return undefined;
    this.pickupTiles.delete(key);
    const index = this.pickups.indexOf(pickup);
    if (index >= 0) this.pickups.splice(index, 1);
    return pickup;
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
          vehicle.x = (Number.isFinite(rear) ? rear : STAGE_WIDTH) - vehicle.width - gap;
        } else if (lane.dir < 0 && vehicle.x + vehicle.width < -buffer) {
          let front = Number.NEGATIVE_INFINITY;
          for (const other of lane.vehicles) {
            if (other !== vehicle) front = Math.max(front, other.x + other.width);
          }
          const gap = randInt(this.rng, 42, 120);
          vehicle.x = (Number.isFinite(front) ? front : -buffer) + gap;
        }
      }
    }
  }

  private addRoadBlock(): void {
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
        variant: randInt(this.rng, 0, 4),
        x,
        width,
      });
      x += width + randInt(this.rng, gapMin, gapMax);
    }
  }

  private addSidewalkBlock(size: number, initial: boolean): void {
    const start = this.rows.length;
    for (let index = 0; index < size; index += 1) this.rows.push('sidewalk');
    const top = start + size - 1;
    const safeCol = initial ? START_COL : randInt(this.rng, 3, 9);

    if (!initial && this.rng() < 0.5) {
      const left = this.placeProp('pole', 0, top, safeCol);
      const right = this.placeProp('pole', COLS - 1, top, safeCol);
      if (left && right) this.wireRows.add(top);
    }

    if (this.rng() < (initial ? 0.9 : 0.78)) {
      this.pickAndPlace('store', top, [0, 1, 2, 8, 9, 10], safeCol);
    }

    const middle = start + 1;
    if (this.rng() < 0.62) {
      this.pickAndPlace('cart', middle, [0, 1, 2, 3, 8, 9, 10, 11], safeCol);
    }

    const decorativeRows = initial ? [start, top] : [start, middle, top];
    const smallProps: PropKind[] = ['chairs', 'trash', 'plant', 'sign'];
    const propCount = randInt(this.rng, initial ? 1 : 2, initial ? 2 : 4);
    const sideColumns = [0, 1, 2, 3, 4, 8, 9, 10, 11, 12];

    for (let index = 0; index < propCount; index += 1) {
      const kind = choose(this.rng, smallProps);
      const row = choose(this.rng, decorativeRows);
      if (!kind || row === undefined) continue;
      this.pickAndPlace(kind, row, sideColumns, safeCol);
    }

    this.addSidewalkPickups(start, size, initial);
  }

  private addSidewalkPickups(start: number, size: number, initial: boolean): void {
    const free: Array<{ col: number; row: number }> = [];
    for (let row = start; row < start + size; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (initial && col === START_COL && row === START_ROW) continue;
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
  }

  private pickAndPlace(kind: PropKind, row: number, columns: readonly number[], safeCol: number): boolean {
    const candidates = columns.filter((col) => this.canPlace(kind, col, row, safeCol));
    const col = choose(this.rng, candidates);
    if (col === undefined) return false;
    return this.placeProp(kind, col, row, safeCol);
  }

  private canPlace(kind: PropKind, col: number, row: number, safeCol: number): boolean {
    const width = PROP_WIDTH[kind];
    if (col < 0 || col + width > COLS) return false;
    if (safeCol >= col && safeCol < col + width) return false;

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

  private addPickup(kind: PickupKind, col: number, row: number): void {
    const key = tileKey(col, row);
    if (this.blocked.has(key) || this.pickupTiles.has(key)) return;
    const pickup: Pickup = { kind, col, row };
    this.pickupTiles.set(key, pickup);
    this.pickups.push(pickup);
  }
}
