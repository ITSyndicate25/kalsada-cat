import type { Engine } from '../game/engine';
import { COLS, STAGE_HEIGHT, STAGE_WIDTH, TILE, VIEW_ROWS, type SceneTheme, type World } from '../game/world';
import {
  CAT_DRAW_OFFSET_X,
  CAT_DRAW_OFFSET_Y,
  COLORS,
  drawWire,
  getCatSprite,
  getPickupSprite,
  getPropSprite,
  getVehicleSprite,
} from './sprites';
import { drawTinyText } from './tiny-font';

function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface ScenePalette {
  road: string;
  roadLight: string;
  roadDark: string;
  sidewalk: string;
  sidewalkAlt: string;
  sidewalkLine: string;
  curb: string;
  curbDark: string;
  marking: string;
  markingAlt: string;
  accent: string;
}

const SCENE_PALETTES: Readonly<Record<SceneTheme, ScenePalette>> = {
  barangay: {
    road: '#46434f',
    roadLight: '#504c59',
    roadDark: '#3a3743',
    sidewalk: '#c9cbc7',
    sidewalkAlt: '#d2d4d0',
    sidewalkLine: '#9fa39d',
    curb: '#e3b85c',
    curbDark: '#ae8742',
    marking: '#e7dfcc',
    markingAlt: '#f0bd45',
    accent: '#7f9c62',
  },
  palengke: {
    road: '#565150',
    roadLight: '#615b59',
    roadDark: '#484443',
    sidewalk: '#c88d67',
    sidewalkAlt: '#d39a74',
    sidewalkLine: '#a56f52',
    curb: '#e8c05a',
    curbDark: '#b08a3e',
    marking: '#f2e6cf',
    markingAlt: '#e26045',
    accent: '#7aa35b',
  },
  city: {
    road: '#3f4654',
    roadLight: '#495162',
    roadDark: '#343a47',
    sidewalk: '#adb6c0',
    sidewalkAlt: '#b9c2cb',
    sidewalkLine: '#87929f',
    curb: '#d9d4c3',
    curbDark: '#a29d8c',
    marking: '#f2efe4',
    markingAlt: '#f1c84c',
    accent: '#6fb0c7',
  },
  baywalk: {
    road: '#4a5151',
    roadLight: '#555d5c',
    roadDark: '#3e4545',
    sidewalk: '#b9c8bf',
    sidewalkAlt: '#c5d1c9',
    sidewalkLine: '#92a79d',
    curb: '#e4d3a4',
    curbDark: '#ab9a6f',
    marking: '#eaf1e8',
    markingAlt: '#e0b856',
    accent: '#4f9e96',
  },
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  draw(engine: Engine): void {
    const ctx = this.ctx;
    const camPx = Math.round(engine.camera * TILE);
    const first = Math.max(0, Math.floor(engine.camera) - 1);
    const last = Math.ceil(engine.camera) + VIEW_ROWS + 2;

    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    ctx.fillStyle = COLORS.asphaltDark;
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    ctx.save();
    if (engine.shake > 0) {
      const magnitude = engine.shake * 10;
      const shakeX = Math.round(Math.sin(engine.time * 93) * magnitude);
      const shakeY = Math.round(Math.cos(engine.time * 71) * magnitude);
      ctx.translate(shakeX, shakeY);
    }

    this.drawRows(engine.world, camPx, first, last);
    this.drawProps(engine.world, camPx, first, last);
    this.drawTraffic(engine, camPx, first, last);
    this.drawWires(engine.world, camPx);
    this.drawPickups(engine, camPx, first, last);
    this.drawPlayer(engine, camPx);
    this.drawParticles(engine, camPx);
    this.drawPopups(engine, camPx);

    ctx.restore();

    if (engine.flash > 0) {
      ctx.fillStyle = `rgba(255, 226, 158, ${Math.min(0.45, engine.flash * 1.8).toFixed(3)})`;
      ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    }
  }

  private screenY(row: number, camPx: number): number {
    return STAGE_HEIGHT + camPx - (row + 1) * TILE;
  }

  private drawRows(world: World, camPx: number, first: number, last: number): void {
    const ctx = this.ctx;

    for (let row = first; row <= last; row += 1) {
      const kind = world.kindAt(row);
      if (!kind) continue;
      const top = this.screenY(row, camPx);
      if (top >= STAGE_HEIGHT || top + TILE <= 0) continue;

      const theme = world.themeAt(row);
      const palette = SCENE_PALETTES[theme];
      if (kind === 'sidewalk') this.drawSidewalkRow(theme, row, top, palette);
      else this.drawRoadRow(theme, row, top, palette);
    }

    for (let row = first; row <= last; row += 1) {
      const kind = world.kindAt(row);
      if (!kind) continue;
      const top = this.screenY(row, camPx);
      if (top >= STAGE_HEIGHT || top + TILE <= 0) continue;
      const palette = SCENE_PALETTES[world.themeAt(row)];

      if (kind === 'sidewalk') {
        if (world.kindAt(row - 1) === 'road') {
          ctx.fillStyle = palette.curbDark;
          ctx.fillRect(0, top + TILE - 3, STAGE_WIDTH, 1);
          ctx.fillStyle = palette.curb;
          ctx.fillRect(0, top + TILE - 2, STAGE_WIDTH, 2);
        }
        if (world.kindAt(row + 1) === 'road') {
          ctx.fillStyle = palette.curb;
          ctx.fillRect(0, top, STAGE_WIDTH, 2);
          ctx.fillStyle = palette.curbDark;
          ctx.fillRect(0, top + 2, STAGE_WIDTH, 1);
        }
      }

      if (kind === 'road' && world.kindAt(row + 1) === 'road') {
        const lane = world.laneAt(row);
        const above = world.laneAt(row + 1);
        if (!lane || !above) continue;
        if (lane.dir !== above.dir) {
          ctx.fillStyle = palette.markingAlt;
          for (let x = 6; x < STAGE_WIDTH; x += 26) {
            ctx.fillRect(x, top - 1, 14, 1);
            ctx.fillRect(x + 5, top + 1, 14, 1);
          }
        } else {
          ctx.fillStyle = palette.marking;
          for (let x = 4; x < STAGE_WIDTH; x += 22) {
            ctx.fillRect(x, top, 11, 1);
          }
        }
      }
    }
  }

  private drawSidewalkRow(theme: SceneTheme, row: number, top: number, palette: ScenePalette): void {
    const ctx = this.ctx;

    for (let col = 0; col < COLS; col += 1) {
      const tone = (row + col) % 2 === 0 ? palette.sidewalk : palette.sidewalkAlt;
      ctx.fillStyle = tone;
      ctx.fillRect(col * TILE, top, TILE, TILE);
    }

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = palette.sidewalkLine;
    ctx.fillRect(0, top + TILE - 1, STAGE_WIDTH, 1);
    for (let col = 0; col <= COLS; col += 1) ctx.fillRect(col * TILE, top, 1, TILE);
    ctx.globalAlpha = 1;

    if (theme === 'barangay') {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = palette.sidewalkLine;
      for (let x = 20; x < STAGE_WIDTH; x += 40) ctx.fillRect(x, top + 2, 1, TILE - 4);
      ctx.globalAlpha = 1;

      if (hash2(row, 14) > 0.58) {
        const x = 12 + Math.floor(hash2(row, 15) * (STAGE_WIDTH - 30));
        ctx.fillStyle = palette.sidewalkLine;
        ctx.fillRect(x, top + 4, 1, 5);
        ctx.fillRect(x + 1, top + 8, 2, 1);
      }
      for (let index = 0; index < 3; index += 1) {
        if (hash2(row + index, 16) < 0.62) continue;
        const x = Math.floor(hash2(row, index + 17) * STAGE_WIDTH);
        const y = top + 4 + Math.floor(hash2(row + 9, index) * (TILE - 8));
        ctx.fillStyle = palette.accent;
        ctx.fillRect(x, y, 1, 2);
      }
    } else if (theme === 'palengke') {
      ctx.globalAlpha = 0.16;
      for (let x = 0; x < STAGE_WIDTH; x += 10) ctx.fillRect(x, top, 1, TILE);
      for (let y = top; y < top + TILE; y += 10) ctx.fillRect(0, y, STAGE_WIDTH, 1);
      ctx.globalAlpha = 1;

      const produce = [COLORS.coral, COLORS.amber, COLORS.lime];
      for (let index = 0; index < 3; index += 1) {
        if (hash2(row, index + 24) < 0.5) continue;
        const x = 4 + Math.floor(hash2(row, index + 25) * (STAGE_WIDTH - 12));
        const y = top + 4 + Math.floor(hash2(row + 7, index) * (TILE - 8));
        ctx.fillStyle = produce[index] ?? COLORS.amber;
        ctx.fillRect(x, y, 2, 1);
      }
    } else if (theme === 'city') {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = palette.sidewalkLine;
      for (let x = 0; x < STAGE_WIDTH; x += 40) ctx.fillRect(x, top, 1, TILE);
      ctx.fillRect(0, top + 9, STAGE_WIDTH, 1);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = palette.sidewalkLine;
      for (let y = top + 4; y < top + TILE; y += 5) ctx.fillRect(0, y, STAGE_WIDTH, 1);
      for (let x = 10; x < STAGE_WIDTH; x += 40) ctx.fillRect(x, top, 1, TILE);
      ctx.globalAlpha = 1;

      if (hash2(row, 32) > 0.62) {
        const x = Math.floor(hash2(row, 33) * STAGE_WIDTH);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(x, top + 3, 2, 1);
      }
    }

    if ((theme === 'barangay' || theme === 'city') && hash2(row, 12) > 0.82) {
      const x = 8 + Math.floor(hash2(row, 13) * (STAGE_WIDTH - 40));
      ctx.fillStyle = COLORS.metalDark;
      ctx.fillRect(x, top + 8, 12, 5);
      ctx.fillStyle = palette.sidewalkLine;
      ctx.fillRect(x + 1, top + 9, 10, 1);
      ctx.fillRect(x + 1, top + 11, 10, 1);
    }
  }

  private drawRoadRow(theme: SceneTheme, row: number, top: number, palette: ScenePalette): void {
    const ctx = this.ctx;

    ctx.fillStyle = palette.road;
    ctx.fillRect(0, top, STAGE_WIDTH, TILE);
    ctx.fillStyle = palette.roadLight;
    ctx.fillRect(0, top + 3, STAGE_WIDTH, 1);
    ctx.fillStyle = palette.roadDark;
    for (let index = 0; index < 5; index += 1) {
      const x = Math.floor(hash2(row, index + 20) * STAGE_WIDTH);
      const y = top + 3 + Math.floor(hash2(row + 31, index) * (TILE - 6));
      ctx.fillRect(x, y, index % 2 === 0 ? 2 : 1, 1);
    }

    if (theme === 'barangay') {
      if (hash2(row, 40) > 0.54) {
        const x = 10 + Math.floor(hash2(row, 41) * (STAGE_WIDTH - 30));
        ctx.fillStyle = palette.roadDark;
        ctx.fillRect(x, top + 7, 8, 3);
        ctx.fillRect(x + 2, top + 10, 5, 1);
        ctx.fillStyle = palette.roadLight;
        ctx.fillRect(x + 1, top + 7, 6, 1);
      }
      if (hash2(row, 42) > 0.7) {
        const x = 20 + Math.floor(hash2(row, 43) * (STAGE_WIDTH - 50));
        ctx.fillStyle = palette.roadDark;
        ctx.fillRect(x, top + 13, 14, 2);
      }
    } else if (theme === 'palengke') {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = palette.markingAlt;
      const stainX = 8 + Math.floor(hash2(row, 50) * (STAGE_WIDTH - 30));
      ctx.fillRect(stainX, top + 6, 10, 2);
      ctx.fillRect((stainX + 90) % STAGE_WIDTH, top + 13, 8, 2);
      ctx.globalAlpha = 1;
      if (hash2(row, 44) > 0.64) {
        const x = 24 + Math.floor(hash2(row, 45) * (STAGE_WIDTH - 50));
        ctx.fillStyle = COLORS.woodLight;
        ctx.fillRect(x, top + 12, 7, 2);
      }
    } else if (theme === 'city') {
      ctx.fillStyle = palette.roadDark;
      ctx.fillRect(0, top + 5, STAGE_WIDTH, 1);
      ctx.fillRect(0, top + 16, STAGE_WIDTH, 1);
      if (hash2(row, 46) > 0.68) {
        const x = 16 + Math.floor(hash2(row, 47) * (STAGE_WIDTH - 40));
        ctx.fillStyle = COLORS.metalDark;
        ctx.fillRect(x, top + 9, 10, 5);
        ctx.fillStyle = COLORS.metal;
        ctx.fillRect(x + 1, top + 10, 8, 1);
        ctx.fillRect(x + 1, top + 12, 8, 1);
      }
    } else {
      if (hash2(row, 48) > 0.55) {
        const x = 18 + Math.floor(hash2(row, 49) * (STAGE_WIDTH - 40));
        ctx.fillStyle = palette.marking;
        ctx.fillRect(x, top + 6, 9, 1);
        ctx.fillRect(x + 3, top + 13, 6, 1);
      }
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, top + 18, STAGE_WIDTH, 1);
      ctx.globalAlpha = 1;
    }
  }

  private drawProps(world: World, camPx: number, first: number, last: number): void {
    for (const prop of world.props) {
      if (prop.row < first - 1 || prop.row > last + 1) continue;
      const sprite = getPropSprite(prop.kind, prop.variant);
      const x = prop.col * TILE;
      const rowTop = this.screenY(prop.row, camPx);
      const y = rowTop + TILE - sprite.height;
      if (y > STAGE_HEIGHT || y + sprite.height < 0) continue;
      this.ctx.drawImage(sprite, x, y);
    }
  }

  private drawTraffic(engine: Engine, camPx: number, first: number, last: number): void {
    const ctx = this.ctx;
    const world = engine.world;

    for (let row = first; row <= last; row += 1) {
      const lane = world.laneAt(row);
      if (!lane) continue;
      const top = this.screenY(row, camPx);

      for (const vehicle of lane.vehicles) {
        const x = Math.round(vehicle.x);
        if (x > STAGE_WIDTH || x + vehicle.width < 0) continue;
        const sprite = getVehicleSprite(vehicle.kind, vehicle.variant);
        if (lane.dir > 0) {
          ctx.drawImage(sprite, x, top);
        } else {
          ctx.save();
          ctx.translate(x + vehicle.width, top);
          ctx.scale(-1, 1);
          ctx.drawImage(sprite, 0, 0);
          ctx.restore();
        }
      }
    }
  }

  private drawPickups(engine: Engine, camPx: number, first: number, last: number): void {
    const ctx = this.ctx;
    for (const pickup of engine.world.pickups) {
      if (pickup.row < first || pickup.row > last) continue;
      const top = this.screenY(pickup.row, camPx);
      const bob = Math.round(Math.sin(engine.time * 3.4 + pickup.col * 0.8) * 1.5);
      const x = pickup.col * TILE;
      const y = top + bob;

      if (pickup.kind === 'anting') {
        const pulse = 0.45 + Math.sin(engine.time * 5) * 0.25;
        ctx.globalAlpha = Math.max(0.15, pulse);
        ctx.fillStyle = COLORS.sun;
        ctx.fillRect(x - 1, y + 7, 2, 2);
        ctx.fillRect(x + 19, y + 10, 2, 2);
        ctx.fillRect(x + 8, y - 2, 2, 2);
        ctx.globalAlpha = 1;
      }

      ctx.drawImage(getPickupSprite(pickup.kind), x, y);

      if (Math.floor(engine.time * 3 + pickup.col) % 3 === 0) {
        ctx.fillStyle = COLORS.paper;
        ctx.fillRect(x + 15, y + 1, 1, 1);
      }
      if (pickup.kind !== 'anting') {
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(x + 4, top + TILE - 2, 8, 1);
      }
    }
  }

  private drawPlayer(engine: Engine, camPx: number): void {
    const ctx = this.ctx;
    const player = engine.player;
    const visualRow = engine.visualRow();
    const visualCol = engine.visualCol();
    const top = this.screenY(visualRow, camPx);
    const hopLift = player.hop < 1 ? Math.sin(Math.PI * player.hop) * 6 : 0;
    const bumpOffset = player.bump > 0 ? Math.round(Math.sin(engine.time * 80)) : 0;
    const x = Math.round(visualCol * TILE + CAT_DRAW_OFFSET_X) + bumpOffset;
    const y = Math.round(top - hopLift + CAT_DRAW_OFFSET_Y);
    const centerX = Math.round(visualCol * TILE + TILE / 2);
    const groundY = Math.round(top + TILE - 2);

    ctx.globalAlpha = hopLift > 0 ? 0.18 : 0.28;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(centerX - 4, groundY, 8, 1);
    ctx.fillRect(centerX - 5, groundY - 1, 10, 1);
    ctx.globalAlpha = 1;

    if (engine.shields > 0) {
      const sparkle = 0.55 + Math.sin(engine.time * 6) * 0.35;
      ctx.globalAlpha = Math.max(0.2, sparkle);
      ctx.fillStyle = COLORS.sun;
      ctx.fillRect(x + 1, y + 3, 1, 2);
      ctx.fillRect(x + 14, y + 7, 1, 2);
      ctx.fillRect(x + 3, y + 14, 2, 1);
      ctx.fillRect(x + 12, y + 14, 2, 1);
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(x + 14, y + 5, 1, 1);
      ctx.globalAlpha = 1;
    }

    if (engine.invuln > 0 && Math.floor(engine.time * 18) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const frame: 0 | 1 = Math.floor(engine.time * (engine.phase === 'playing' ? 4.5 : 3)) % 2 === 0 ? 0 : 1;
    ctx.drawImage(getCatSprite(frame), x, y);

    if (engine.phase === 'dying') {
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(x + 3, y + 5, 3, 1);
      ctx.fillRect(x + 4, y + 4, 1, 3);
      ctx.fillRect(x + 10, y + 5, 3, 1);
      ctx.fillRect(x + 11, y + 4, 1, 3);
    }

    ctx.globalAlpha = 1;
  }

  private drawParticles(engine: Engine, camPx: number): void {
    const ctx = this.ctx;
    for (const particle of engine.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      ctx.fillStyle = particle.color;
      const x = Math.round(particle.x * TILE);
      const y = Math.round(this.screenY(particle.y, camPx));
      ctx.fillRect(x, y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawWires(world: World, camPx: number): void {
    const ctx = this.ctx;
    for (const row of world.wireRows) {
      const top = this.screenY(row, camPx);
      if (top < -40 || top > STAGE_HEIGHT + 40) continue;
      drawWire(ctx, top - 24, 5, STAGE_WIDTH);
      drawWire(ctx, top - 21, 7, STAGE_WIDTH);
      drawWire(ctx, top - 18, 9, STAGE_WIDTH);
      ctx.fillStyle = COLORS.ink;
      for (let x = 10; x < STAGE_WIDTH; x += 64) {
        ctx.fillRect(x, top - 23 + Math.round(Math.sin((x / STAGE_WIDTH) * Math.PI) * 5), 1, 2);
      }
    }
  }

  private drawPopups(engine: Engine, camPx: number): void {
    const ctx = this.ctx;
    for (const popup of engine.popups) {
      const width = Math.max(0, popup.text.length * 8 - 2);
      const x = Math.round(popup.x * TILE - width / 2);
      const y = Math.round(this.screenY(popup.y, camPx) - 8);
      ctx.globalAlpha = Math.min(1, popup.life / 0.25);
      drawTinyText(ctx, popup.text, x, y, COLORS.sun, 2, COLORS.ink);
    }
    ctx.globalAlpha = 1;
  }
}
