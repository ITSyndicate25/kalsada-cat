import { describe, expect, it } from 'vitest';
import { Engine } from '../src/game/engine';
import { mulberry32 } from '../src/game/rng';
import {
  COLS,
  PICKUP_BONUS,
  POWER_KINDS,
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

  it('covers all six districts as the world grows', () => {
    const world = new World(mulberry32(31337));
    world.ensure(400);
    const seen = new Set(world.themes);
    for (const theme of SCENE_ORDER) expect(seen.has(theme)).toBe(true);
    expect(SCENE_ORDER).toHaveLength(6);
  });

  it('spawns every power-up kind across a long run', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 24 && kinds.size < POWER_KINDS.length + 3; seed += 1) {
      const world = new World(mulberry32(seed * 7919));
      world.ensure(600);
      for (const pickup of world.pickups) kinds.add(pickup.kind);
    }

    for (const kind of ['fishball', 'kikiam', 'anting'] as const) expect(kinds.has(kind)).toBe(true);
    for (const kind of POWER_KINDS) expect(kinds.has(kind)).toBe(true);
  });

  it('never spawns power-ups in the first 20 rows', () => {
    const world = new World(mulberry32(6060));
    world.ensure(300);
    for (const pickup of world.pickups) {
      if (pickup.kind === 'fishball' || pickup.kind === 'kikiam' || pickup.kind === 'anting') continue;
      expect(pickup.row).toBeGreaterThanOrEqual(20);
    }
  });

  it('keeps dogs inside their patrol run', () => {
    const world = new World(mulberry32(7171));
    world.ensure(400);
    expect(world.dogs.length).toBeGreaterThan(0);

    for (let tick = 0; tick < 600; tick += 1) world.update(1 / 30, false, false);

    for (const dog of world.dogs) {
      expect(dog.pos).toBeGreaterThanOrEqual(dog.minCol - 0.001);
      expect(dog.pos).toBeLessThanOrEqual(dog.maxCol + 0.001);
    }
  });

  it('freezes dogs and vendors while time is frozen', () => {
    const world = new World(mulberry32(8282));
    world.ensure(400);
    expect(world.dogs.length + world.vendors.length).toBeGreaterThan(0);

    const before = world.dogs.map((dog) => dog.pos);
    const vendorBefore = world.vendors.map((vendor) => vendor.x);
    for (let tick = 0; tick < 60; tick += 1) world.update(1 / 30, true, false);

    world.dogs.forEach((dog, index) => {
      expect(dog.pos).toBe(before[index]);
    });
    world.vendors.forEach((vendor, index) => {
      expect(vendor.x).toBe(vendorBefore[index]);
    });
  });

  it('clears barricades after their timer and frees the tile', () => {
    const world = new World(mulberry32(9090));
    world.ensure(600);
    const barricades = world.props.filter((prop) => prop.kind === 'barricade');
    expect(barricades.length).toBeGreaterThan(0);
    const first = barricades[0];
    if (!first) return;

    // Off-screen barricades hold their timer: nothing burns down while it waits.
    world.update(1, false, false, 0, 3);
    expect(world.blockedAt(first.col, first.row)).toBe(true);

    for (let tick = 0; tick < 60 * 12; tick += 1) world.update(1 / 60, false, false, first.row, first.row);

    expect(world.blockedAt(first.col, first.row)).toBe(false);
    expect(world.props.includes(first)).toBe(false);
  });

  it('marks lubak only on road rows', () => {
    const world = new World(mulberry32(12321));
    world.ensure(400);
    expect(world.lubak.size).toBeGreaterThan(0);
    for (const key of world.lubak) {
      const [colText, rowText] = key.split(',');
      const col = Number(colText);
      const row = Number(rowText);
      expect(world.rows[row]).toBe('road');
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(COLS);
    }
  });

  it('pulls fishballs to the cat with the magnet active', () => {
    const world = new World(mulberry32(55));
    world.ensure(400);

    // Clear a 5x5 room around the cat and drop a fishball two tiles away.
    for (const prop of [...world.props].filter((prop) => Math.abs(prop.col - 6) <= 3 && Math.abs(prop.row - 30) <= 3)) {
      world['removeProp'](prop);
    }
    for (let row = 27; row <= 33; row += 1) {
      for (let col = 3; col <= 9; col += 1) {
        const key = `${col},${row}`;
        world['pickupTiles'].delete(key);
        const index = world.pickups.findIndex((pickup) => pickup.col === col && pickup.row === row);
        if (index >= 0) world.pickups.splice(index, 1);
      }
    }

    const fishball = { kind: 'fishball' as const, col: 8, row: 30 };
    world.pickups.push(fishball);
    world['pickupTiles'].set('8,30', fishball);

    expect(world.pullFishballs(6, 30, 2)).toHaveLength(0);
    expect(fishball.col).toBe(7);

    const collected = world.pullFishballs(6, 30, 2);
    expect(collected).toHaveLength(1);
    expect(collected[0]?.kind).toBe('fishball');
    expect(world.pickups.includes(fishball)).toBe(false);
  });
});

describe('Kalsada-Cat powers', () => {
  it('freezes traffic and dogs while the enforcer whistle runs', () => {
    const engine = new Engine({ rng: mulberry32(31) });
    engine.start();
    emptyLanes(engine);

    engine.applyPowerForTest('enforcer');
    const lane = engine.world.laneAt(3);
    expect(lane).toBeDefined();
    if (!lane) return;
    lane.speed = 30;
    lane.dir = 1;
    lane.vehicles = [{ kind: 'jeepney', variant: 0, x: 60, width: VEHICLE_WIDTH.jeepney }];
    const x = lane.vehicles[0]?.x ?? 0;

    run(engine, 0.5);
    expect(lane.vehicles[0]?.x).toBe(x);
    expect(engine.freezeTimer).toBeGreaterThan(0);

    run(engine, 4);
    expect(engine.freezeTimer).toBe(0);
    const after = lane.vehicles[0]?.x ?? 0;
    run(engine, 0.25);
    expect(lane.vehicles[0]?.x).not.toBe(after);
  });

  it('halves hop duration with tsinelas and restores it after', () => {
    const engine = new Engine({ rng: mulberry32(32) });
    engine.start();
    emptyLanes(engine);

    engine.applyPowerForTest('tsinelas');
    const startRow = engine.player.row;
    engine.move('up');
    run(engine, 0.06);
    expect(engine.player.row).toBe(startRow + 1);

    run(engine, 6);
    expect(engine.speedTimer).toBe(0);
    engine.move('up');
    run(engine, 0.06);
    expect(engine.player.hop).toBeLessThan(1);
  });

  it('doubles pickup points while halo-halo is active', () => {
    const engine = new Engine({ rng: mulberry32(33) });
    engine.start();
    emptyLanes(engine);

    engine.applyPowerForTest('halohalo');
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
    expect(engine.score).toBe(previousScore + PICKUP_BONUS.fishball * 2);
  });

  it('absorbs one hit with payong before shields are touched', () => {
    const engine = new Engine({ rng: mulberry32(34) });
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
    lane.vehicles.push({ kind: 'jeepney', variant: 2, x: engine.player.col * TILE - 20, width: 58 });
    engine.applyPowerForTest('payong');
    engine.shields = 1;

    engine.update(1 / 60);
    expect(engine.phase).toBe('playing');
    expect(engine.payong).toBe(false);
    expect(engine.shields).toBe(1);
    expect(engine.drainEvents().some((event) => event.type === 'payong-break')).toBe(true);
  });

  it('revives once with balut, then dies on the next hit', () => {
    const engine = new Engine({ rng: mulberry32(35) });
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
    lane.vehicles.push({ kind: 'jeepney', variant: 3, x: engine.player.col * TILE - 20, width: 58 });
    engine.applyPowerForTest('balut');

    engine.update(1 / 60);
    expect(engine.phase).toBe('playing');
    expect(engine.drainEvents().some((event) => event.type === 'revive')).toBe(true);

    run(engine, 2.1);
    engine.update(1 / 60);
    expect(engine.phase).toBe('dying');
  });

  it('stumbles on lubak without taking damage', () => {
    const engine = new Engine({ rng: mulberry32(36) });
    engine.start();
    emptyLanes(engine);

    engine.world.ensure(400);
    emptyLanes(engine);
    const pothole = [...engine.world.lubak][0];
    expect(pothole).toBeDefined();
    if (!pothole) return;
    const [potholeColText = '6', potholeRowText = '2'] = pothole.split(',');
    const potholeCol = Number(potholeColText);
    const potholeRow = Number(potholeRowText);
    engine.player.col = potholeCol;
    engine.player.fromCol = potholeCol;
    engine.player.row = potholeRow;
    engine.player.fromRow = potholeRow;
    engine.player.hop = 0.99;

    engine.update(0.02);
    expect(engine.stumble).toBeGreaterThan(0);
    expect(engine.phase).toBe('playing');
    expect(engine.drainEvents().some((event) => event.type === 'stumble')).toBe(true);
  });

  it('holds the cat on a pothole and keeps the buffered hop', () => {
    const engine = new Engine({ rng: mulberry32(36) });
    engine.start();
    emptyLanes(engine);
    engine.world.ensure(400);
    emptyLanes(engine);

    const pothole = [...engine.world.lubak][0];
    expect(pothole).toBeDefined();
    if (!pothole) return;
    const [colText = '6', rowText = '2'] = pothole.split(',');
    const col = Number(colText);
    const row = Number(rowText);
    engine.player.col = col;
    engine.player.fromCol = col;
    engine.player.row = row;
    engine.player.fromRow = row;
    engine.player.hop = 0.99;

    engine.update(1 / 60);
    expect(engine.stumble).toBeGreaterThan(0);

    // Input during the hold is buffered, never executed on the spot.
    engine.move('up');
    expect(engine.player.row).toBe(row);

    run(engine, 0.1);
    expect(engine.player.row).toBe(row);

    run(engine, 0.1);
    expect(engine.player.row).toBe(row + 1);
  });

  it('calms dogs with sampaguita so they stop moving', () => {
    const world = new World(mulberry32(37));
    world.ensure(400);
    expect(world.dogs.length).toBeGreaterThan(0);

    const before = world.dogs.map((dog) => dog.pos);
    for (let tick = 0; tick < 60; tick += 1) world.update(1 / 60, false, true);

    world.dogs.forEach((dog, index) => {
      expect(dog.pos).toBe(before[index]);
    });
  });

  it('lets the cat walk through a calm dog without damage', () => {
    const engine = new Engine({ rng: mulberry32(39) });
    engine.start();
    emptyLanes(engine);

    engine.world.ensure(400);
    emptyLanes(engine);
    const dog = engine.world.dogs[0];
    expect(dog).toBeDefined();
    if (!dog) return;

    engine.applyPowerForTest('sampaguita');
    engine.player.col = Math.round(dog.pos);
    engine.player.fromCol = engine.player.col;
    engine.player.row = dog.row;
    engine.player.fromRow = dog.row;
    engine.player.hop = 1;

    run(engine, 0.2);
    expect(engine.phase).toBe('playing');

    engine.calmTimer = 0;
    run(engine, 0.2);
    expect(engine.phase).toBe('dying');
  });

  it('shows held payong and balut charges as chips', () => {
    const engine = new Engine({ rng: mulberry32(40) });
    engine.start();

    expect(engine.effectChips()).toHaveLength(0);

    engine.applyPowerForTest('payong');
    const withUmbrella = engine.effectChips();
    expect(withUmbrella).toHaveLength(1);
    expect(withUmbrella[0]).toMatchObject({ kind: 'payong', seconds: 0 });

    engine.applyPowerForTest('balut');
    const both = engine.effectChips();
    expect(both.map((chip) => chip.kind).sort()).toEqual(['balut', 'payong']);
    for (const chip of both) expect(chip.seconds).toBe(0);
  });

  it('keeps props and pickups off spark tiles', () => {
    let sparks = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const world = new World(mulberry32(seed * 104729));
      world.ensure(900);
      for (const spark of world.sparks.values()) {
        sparks += 1;
        expect(world.blockedAt(spark.col, spark.row)).toBe(false);
        expect(world.pickups.some((pickup) => pickup.col === spark.col && pickup.row === spark.row)).toBe(false);
      }
    }
    expect(sparks).toBeGreaterThan(0);
  });

  it('warns before a spark turns lethal and never while it is lethal', () => {
    const engine = new Engine({ rng: mulberry32(41) });
    engine.start();

    for (let clock = 0; clock < 1; clock += 0.01) {
      engine.time = clock;
      const charging = engine.isSparkCharging(0);
      const active = engine.isSparkActive(0);
      expect(charging && active).toBe(false);
      if (clock >= 0.98) expect(charging).toBe(true);
    }
  });

  it('attracts fishballs with turon for its timer window', () => {
    const engine = new Engine({ rng: mulberry32(38) });
    engine.start();
    emptyLanes(engine);

    engine.applyPowerForTest('turon');
    expect(engine.magnetTimer).toBeGreaterThan(0);
    expect(engine.effectChips().some((chip) => chip.kind === 'turon')).toBe(true);

    run(engine, 8.2);
    expect(engine.magnetTimer).toBe(0);
    expect(engine.effectChips().some((chip) => chip.kind === 'turon')).toBe(false);
  });
});
