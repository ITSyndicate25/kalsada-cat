import { describe, expect, it } from 'vitest';
import { Engine } from '../src/game/engine';
import { mulberry32 } from '../src/game/rng';
import {
  PICKUP_BONUS,
  SCENE_ORDER,
  START_COL,
  START_ROW,
  STAGE_WIDTH,
  TILE,
  VEHICLE_VARIANTS,
  VEHICLE_WIDTH,
  VIEW_ROWS,
  World,
} from '../src/game/world';

function run(engine: Engine, seconds: number): void {
  const step = 1 / 60;
  const frames = Math.ceil(seconds / step);
  for (let frame = 0; frame < frames; frame += 1) {
    engine.update(step);
  }
}

function emptyLanes(engine: Engine): void {
  for (const lane of engine.world.lanes.values()) {
    lane.vehicles.length = 0;
  }
}

describe('Kalsada-Cat world', () => {
  it('builds endless sidewalk blocks with at least one clear crossing column', () => {
    const world = new World(mulberry32(20261020));
    world.ensure(VIEW_ROWS * 12);

    expect(world.rows.length).toBeGreaterThanOrEqual(VIEW_ROWS * 12);
    expect(world.rows.slice(0, 3)).toEqual(['sidewalk', 'sidewalk', 'sidewalk']);
    expect(world.lanes.size).toBeGreaterThan(8);
    expect(world.themes).toHaveLength(world.rows.length);
    expect(new Set(world.themes).size).toBe(SCENE_ORDER.length);
    expect(world.themeAt(0)).toBe('barangay');

    for (let row = 0; row < world.rows.length; row += 1) {
      const kind = world.rows[row];
      if (kind === 'road') {
        const lane = world.laneAt(row);
        expect(lane).toBeDefined();
        expect(lane?.vehicles.length).toBeGreaterThan(0);
      }
    }

    let cursor = 0;
    while (cursor < world.rows.length) {
      if (world.rows[cursor] !== 'sidewalk') {
        cursor += 1;
        continue;
      }
      const start = cursor;
      while (cursor < world.rows.length && world.rows[cursor] === 'sidewalk') cursor += 1;
      const end = cursor;
      let clearColumn = false;
      for (let col = 0; col < 13; col += 1) {
        let open = true;
        for (let row = start; row < end; row += 1) {
          if (world.blockedAt(col, row)) {
            open = false;
            break;
          }
        }
        if (open) clearColumn = true;
      }
      expect(clearColumn).toBe(true);
    }

    for (const lane of world.lanes.values()) {
      const ordered = [...lane.vehicles].sort((a, b) => a.x - b.x);
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        if (!previous || !current) continue;
        expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width);
      }
    }

    for (const pickup of world.pickups) {
      expect(world.blockedAt(pickup.col, pickup.row)).toBe(false);
    }
  });

  it('wraps vehicles without letting same-lane vehicles overlap', () => {
    const world = new World(mulberry32(777));
    world.ensure(90);

    for (let tick = 0; tick < 500; tick += 1) {
      world.updateTraffic(1 / 30, 0, world.rows.length - 1);
    }

    for (const lane of world.lanes.values()) {
      const ordered = [...lane.vehicles].sort((a, b) => a.x - b.x);
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        if (!previous || !current) continue;
        expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width - 0.001);
      }
    }
  });

  it('re-enters wrapped traffic only from outside the stage', () => {
    const world = new World(mulberry32(808));
    world.ensure(60);
    const row = world.rows.findIndex((kind) => kind === 'road');
    const lane = world.laneAt(row);
    expect(lane).toBeDefined();
    if (!lane) return;

    lane.speed = 0;
    lane.dir = 1;
    lane.vehicles = [
      { kind: 'jeepney', variant: 0, x: STAGE_WIDTH + 61, width: VEHICLE_WIDTH.jeepney },
      { kind: 'jeepney', variant: 1, x: 120, width: VEHICLE_WIDTH.jeepney },
    ];
    world.updateTraffic(0, row, row);
    const wrappedRight = lane.vehicles[0];
    expect(wrappedRight).toBeDefined();
    expect(wrappedRight?.x).toBeLessThanOrEqual(-VEHICLE_WIDTH.jeepney);

    lane.dir = -1;
    lane.vehicles = [
      { kind: 'bus', variant: 2, x: -VEHICLE_WIDTH.bus - 61, width: VEHICLE_WIDTH.bus },
      { kind: 'bus', variant: 3, x: 120, width: VEHICLE_WIDTH.bus },
    ];
    world.updateTraffic(0, row, row);
    const wrappedLeft = lane.vehicles[0];
    expect(wrappedLeft).toBeDefined();
    expect(wrappedLeft?.x).toBeGreaterThanOrEqual(STAGE_WIDTH);
  });

  it('uses the full vehicle variant range', () => {
    const world = new World(mulberry32(4242));
    world.ensure(120);
    const variants = new Set<number>();

    for (const lane of world.lanes.values()) {
      for (const vehicle of lane.vehicles) variants.add(vehicle.variant);
    }

    expect(variants.size).toBe(VEHICLE_VARIANTS);
    expect(Math.max(...variants)).toBe(VEHICLE_VARIANTS - 1);
    for (const variant of variants) {
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThan(VEHICLE_VARIANTS);
    }
  });
});

describe('Kalsada-Cat engine', () => {
  it('scores forward distance, updates the best, and freezes while paused', () => {
    const engine = new Engine({ best: 2, rng: mulberry32(9) });
    engine.start();
    emptyLanes(engine);

    const pathBonus = engine.world.pickups
      .filter((pickup) => pickup.col === START_COL && pickup.row > START_ROW && pickup.row <= START_ROW + 2)
      .reduce((sum, pickup) => sum + (pickup.kind === 'anting' ? 0 : PICKUP_BONUS[pickup.kind]), 0);

    for (let step = 0; step < 2; step += 1) {
      engine.move('up');
      run(engine, 0.13);
    }

    expect(engine.player.row).toBe(START_ROW + 2);
    expect(engine.score).toBe(2 + pathBonus);
    expect(engine.best).toBe(Math.max(2, engine.score));

    engine.pause();
    const pausedRow = engine.player.row;
    engine.move('up');
    run(engine, 0.5);
    expect(engine.player.row).toBe(pausedRow);

    engine.resume();
    expect(engine.phase).toBe('playing');
  });

  it('collects a fishball when the hop lands on its tile', () => {
    const engine = new Engine({ rng: mulberry32(4) });
    engine.start();
    emptyLanes(engine);

    const fishball = engine.world.pickups.find((pickup) => pickup.kind === 'fishball');
    expect(fishball).toBeDefined();
    if (!fishball) return;

    engine.player.col = fishball.col;
    engine.player.fromCol = fishball.col;
    engine.player.row = fishball.row;
    engine.player.fromRow = fishball.row;
    engine.player.hop = 0.99;
    const previousScore = engine.score;

    engine.update(0.02);

    expect(engine.score).toBe(previousScore + PICKUP_BONUS.fishball);
    expect(engine.world.pickups.includes(fishball)).toBe(false);
    const pickupEvent = engine.drainEvents().find((event) => event.type === 'pickup');
    expect(pickupEvent).toEqual({ type: 'pickup', kind: 'fishball', bonus: PICKUP_BONUS.fishball });
  });

  it('turns a jeepney collision into a game over with a recorded best', () => {
    const engine = new Engine({ rng: mulberry32(99) });
    engine.start();
    emptyLanes(engine);

    engine.move('up');
    run(engine, 0.13);
    engine.move('up');
    run(engine, 0.13);

    const lane = engine.world.laneAt(3);
    expect(lane).toBeDefined();
    if (!lane) return;

    lane.speed = 0;
    lane.vehicles.push({
      kind: 'jeepney',
      variant: 0,
      x: engine.player.col * TILE - 20,
      width: 58,
    });

    engine.update(1 / 60);
    expect(engine.phase).toBe('dying');
    expect(engine.drainEvents().some((event) => event.type === 'crash')).toBe(true);

    run(engine, 1);
    expect(engine.phase).toBe('over');
    const gameOver = engine.drainEvents().find((event) => event.type === 'gameover');
    expect(gameOver).toBeDefined();
    if (gameOver?.type !== 'gameover') return;
    expect(gameOver.score).toBe(engine.score);
    expect(gameOver.best).toBe(engine.best);
    expect(gameOver.record).toBe(true);
  });

  it('moves traffic in rows that have not entered the camera yet', () => {
    const engine = new Engine({ rng: mulberry32(2026) });
    engine.start();
    emptyLanes(engine);

    const farRow = engine.world.rows.findIndex((kind, row) => kind === 'road' && row > VIEW_ROWS + 4);
    const lane = engine.world.laneAt(farRow);
    expect(farRow).toBeGreaterThan(VIEW_ROWS + 4);
    expect(lane).toBeDefined();
    if (!lane) return;

    lane.speed = 40;
    lane.dir = 1;
    lane.vehicles = [{ kind: 'jeepney', variant: 0, x: 60, width: VEHICLE_WIDTH.jeepney }];
    const before = lane.vehicles[0]?.x ?? 0;

    engine.update(1 / 60);

    expect(lane.vehicles[0]?.x).toBeGreaterThan(before);
  });

  it('stacks anting shields from pickups', () => {
    const engine = new Engine({ rng: mulberry32(7) });
    engine.start();
    emptyLanes(engine);
    engine.world.ensure(500);
    emptyLanes(engine);

    const antings = engine.world.pickups.filter((pickup) => pickup.kind === 'anting');
    expect(antings.length).toBeGreaterThanOrEqual(4);

    for (let index = 0; index < 4; index += 1) {
      const pickup = antings[index];
      if (!pickup) return;
      engine.player.col = pickup.col;
      engine.player.fromCol = pickup.col;
      engine.player.row = pickup.row;
      engine.player.fromRow = pickup.row;
      engine.player.hop = 0.99;
      engine.update(0.02);
    }

    expect(engine.shields).toBe(4);
    expect(engine.score).toBe(0);
  });

  it('stacks anting shields and consumes one per hit', () => {
    const engine = new Engine({ rng: mulberry32(1234) });
    engine.start();
    emptyLanes(engine);

    engine.move('up');
    run(engine, 0.13);
    engine.move('up');
    run(engine, 0.13);

    const lane = engine.world.laneAt(3);
    expect(lane).toBeDefined();
    if (!lane) return;

    lane.speed = 0;
    lane.vehicles.push({
      kind: 'jeepney',
      variant: 1,
      x: engine.player.col * TILE - 20,
      width: 58,
    });
    engine.shields = 2;

    engine.update(1 / 60);
    expect(engine.phase).toBe('playing');
    expect(engine.shields).toBe(1);
    expect(engine.invuln).toBeGreaterThan(0);
    expect(engine.drainEvents().some((event) => event.type === 'shield-break')).toBe(true);

    run(engine, 1.7);
    expect(engine.phase).toBe('playing');
    expect(engine.shields).toBe(0);

    run(engine, 1.7);
    expect(engine.phase).toBe('dying');
  });
});
