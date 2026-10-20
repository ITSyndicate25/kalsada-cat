import { PROP_WIDTH, TILE, VEHICLE_WIDTH, type PickupKind, type PropKind, type VehicleKind } from '../game/world';
import { drawTinyText } from './tiny-font';

export const COLORS = {
  ink: '#191621',
  inkSoft: '#26212f',
  asphaltDark: '#403c4b',
  sidewalkLine: '#bd9664',
  cream: '#f6e7c9',
  paper: '#fdf3dd',
  sun: '#ffc93f',
  amber: '#f4a52b',
  coral: '#e85a44',
  red: '#cc3c31',
  pink: '#ec7ba5',
  pinkSoft: '#f08fa8',
  magenta: '#c65297',
  teal: '#2fa99b',
  aqua: '#7bd8cc',
  blue: '#3e79c0',
  purple: '#7054bc',
  green: '#4e9b52',
  lime: '#8fbf58',
  skin: '#e6a06a',
  skinDark: '#b97648',
  hair: '#2b2230',
  wood: '#966b4c',
  woodLight: '#b98962',
  woodDark: '#6f4b37',
  metal: '#c2bdc8',
  metalDark: '#777183',
  glass: '#243246',
  glassLight: '#496875',
  cat: '#211c29',
  catShade: '#3a3248',
  catEye: '#ffb02e',
  catGlint: '#fff2cf',
  catNose: '#ff8fa3',
  trash: '#2e2a37',
  trashLight: '#554e61',
  shadow: 'rgba(24,20,32,0.26)',
  wire: 'rgba(25,22,33,0.68)',
} as const;

interface CanvasSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

const cache = new Map<string, HTMLCanvasElement>();

function makeSurface(width: number, height: number): CanvasSurface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function cachedSprite(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const { canvas, ctx } = makeSurface(width, height);
  draw(ctx);
  cache.set(key, canvas);
  return canvas;
}

const CAT_ART = [
  '................',
  '..kk........kk..',
  '.kppk......kppk.',
  '.kppkkkkkkkkppk.',
  '.kkkkkkkkkkkkkk.',
  '.kkeeekkkkeeekk.',
  '.kkewekkkkewekk.',
  '.kkkkkkknnkkkkk.',
  '..kkkkkkkkkkkk..',
  '...kkkkkkkkkk...',
  '...kkkkkkkkkk...',
  '...kk.kk.kk.kk..',
  '...kk.kk.kk.kk..',
  '....k..k..k..k..',
  '................',
  '................',
];

const CAT_PALETTE: Readonly<Record<string, string>> = {
  k: COLORS.cat,
  p: COLORS.pinkSoft,
  e: COLORS.catEye,
  w: COLORS.catGlint,
  n: COLORS.catNose,
};

const TAIL_FRAMES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [13, 10],
    [14, 10],
    [14, 9],
    [14, 8],
  ],
  [
    [13, 11],
    [14, 11],
    [14, 10],
    [14, 9],
  ],
];

export const CAT_SPRITE_SIZE = 16;
export const CAT_DRAW_OFFSET_X = 2;
export const CAT_DRAW_OFFSET_Y = 4;

export function getCatSprite(frame: 0 | 1): HTMLCanvasElement {
  return cachedSprite(`cat-${frame}`, CAT_SPRITE_SIZE, CAT_SPRITE_SIZE, (ctx) => {
    const tail = TAIL_FRAMES[frame] ?? TAIL_FRAMES[0] ?? [];
    for (const [x, y] of tail) rect(ctx, x, y, 2, 2, COLORS.cat);

    for (let y = 0; y < CAT_ART.length; y += 1) {
      const line = CAT_ART[y] ?? '';
      for (let x = 0; x < line.length; x += 1) {
        const color = CAT_PALETTE[line.charAt(x)];
        if (color) rect(ctx, x, y, 1, 1, color);
      }
    }
  });
}

interface VehiclePalette {
  body: string;
  roof: string;
  accent: string;
  trim: string;
}

const VEHICLE_PALETTES: readonly VehiclePalette[] = [
  { body: COLORS.teal, roof: COLORS.cream, accent: COLORS.coral, trim: COLORS.sun },
  { body: COLORS.coral, roof: COLORS.sun, accent: COLORS.teal, trim: COLORS.paper },
  { body: COLORS.magenta, roof: COLORS.pink, accent: COLORS.sun, trim: COLORS.purple },
  { body: COLORS.purple, roof: '#ded4f4', accent: COLORS.pink, trim: COLORS.sun },
  { body: COLORS.blue, roof: COLORS.cream, accent: COLORS.sun, trim: COLORS.coral },
  { body: COLORS.amber, roof: COLORS.cream, accent: COLORS.green, trim: COLORS.paper },
  { body: COLORS.green, roof: COLORS.sun, accent: COLORS.red, trim: COLORS.cream },
  { body: '#d96b2b', roof: COLORS.cream, accent: COLORS.blue, trim: COLORS.sun },
  { body: '#e6dcc8', roof: COLORS.red, accent: COLORS.blue, trim: COLORS.sun },
  { body: COLORS.aqua, roof: '#2f4d5c', accent: COLORS.coral, trim: COLORS.paper },
  { body: '#7a3f5f', roof: COLORS.pink, accent: COLORS.lime, trim: COLORS.cream },
  { body: COLORS.red, roof: COLORS.cream, accent: COLORS.sun, trim: COLORS.teal },
];

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x, y, 8, 5, COLORS.ink);
  rect(ctx, x + 1, y + 1, 6, 3, COLORS.metalDark);
  rect(ctx, x + 2, y + 2, 3, 2, COLORS.metal);
  rect(ctx, x + 2, y + 2, 1, 1, COLORS.paper);
}

function drawJeepney(ctx: CanvasRenderingContext2D, palette: VehiclePalette, style: number): void {
  const w = VEHICLE_WIDTH.jeepney;
  rect(ctx, 3, 18, w - 6, 2, COLORS.shadow);

  rect(ctx, 7, 0, 9, 2, palette.accent);
  rect(ctx, 17, 0, 5, 2, palette.trim);
  rect(ctx, 23, 0, 7, 2, palette.roof);

  rect(ctx, 2, 3, 45, 14, COLORS.ink);
  rect(ctx, 3, 4, 43, 12, palette.body);
  rect(ctx, 42, 7, 14, 10, COLORS.ink);
  rect(ctx, 43, 8, 12, 8, palette.body);
  rect(ctx, 4, 1, 41, 5, COLORS.ink);
  rect(ctx, 5, 2, 39, 3, palette.roof);

  rect(ctx, 7, 4, 35, 6, COLORS.ink);
  rect(ctx, 8, 5, 33, 4, COLORS.glass);
  rect(ctx, 8, 5, 33, 1, COLORS.glassLight);
  rect(ctx, 16, 5, 2, 4, palette.body);
  rect(ctx, 25, 5, 2, 4, palette.body);
  rect(ctx, 34, 5, 2, 4, palette.body);

  rect(ctx, 44, 4, 9, 5, COLORS.ink);
  rect(ctx, 45, 5, 7, 3, COLORS.glassLight);
  rect(ctx, 43, 8, 1, 8, COLORS.ink);

  rect(ctx, 3, 11, 54, 2, palette.accent);
  rect(ctx, 4, 13, 52, 1, COLORS.metalDark);
  rect(ctx, 8, 12, 2, 1, palette.trim);
  rect(ctx, 18, 12, 2, 1, palette.trim);
  rect(ctx, 28, 12, 2, 1, palette.trim);
  rect(ctx, 38, 12, 2, 1, palette.trim);

  rect(ctx, 2, 11, 2, 2, COLORS.red);
  rect(ctx, 53, 9, 2, 2, COLORS.sun);
  rect(ctx, 54, 12, 3, 2, COLORS.metal);
  rect(ctx, 46, 12, 3, 1, COLORS.metalDark);
  rect(ctx, 50, 12, 2, 1, COLORS.metalDark);

  if (style === 1) {
    rect(ctx, 5, 0, 40, 1, COLORS.metalDark);
    rect(ctx, 8, 0, 7, 2, COLORS.amber);
    rect(ctx, 9, 0, 3, 1, COLORS.paper);
    rect(ctx, 30, 0, 8, 2, COLORS.teal);
    rect(ctx, 31, 0, 3, 1, COLORS.aqua);
  } else if (style === 2) {
    for (let x = 7; x < 51; x += 6) {
      rect(ctx, x, 15, 4, 1, x % 12 === 7 ? palette.trim : palette.accent);
    }
    rect(ctx, 43, 8, 1, 8, palette.trim);
  }

  drawWheel(ctx, 10, 13);
  drawWheel(ctx, 41, 13);
}

function drawTricycle(ctx: CanvasRenderingContext2D, palette: VehiclePalette, style: number): void {
  const w = VEHICLE_WIDTH.tricycle;
  rect(ctx, 2, 18, w - 4, 2, COLORS.shadow);

  rect(ctx, 1, 2, 19, 5, COLORS.ink);
  rect(ctx, 2, 3, 17, 3, palette.roof);
  rect(ctx, 2, 5, 17, 1, palette.accent);
  rect(ctx, 3, 6, 2, 1, palette.roof);
  rect(ctx, 9, 6, 2, 1, palette.roof);
  rect(ctx, 15, 6, 2, 1, palette.roof);

  rect(ctx, 2, 6, 17, 10, COLORS.ink);
  rect(ctx, 3, 7, 15, 8, palette.body);
  rect(ctx, 5, 7, 9, 5, COLORS.ink);
  rect(ctx, 6, 8, 7, 3, COLORS.glass);
  rect(ctx, 6, 8, 7, 1, COLORS.glassLight);
  rect(ctx, 3, 12, 15, 2, palette.accent);
  rect(ctx, 4, 13, 13, 1, COLORS.metalDark);
  rect(ctx, 19, 9, 2, 4, COLORS.ink);

  rect(ctx, 19, 2, 6, 6, COLORS.ink);
  rect(ctx, 20, 3, 4, 4, COLORS.skin);
  rect(ctx, 19, 2, 6, 1, COLORS.hair);
  rect(ctx, 20, 8, 6, 4, palette.body);
  rect(ctx, 20, 8, 6, 1, palette.accent);

  rect(ctx, 25, 5, 3, 8, COLORS.ink);
  rect(ctx, 26, 6, 1, 6, COLORS.glassLight);
  rect(ctx, 27, 6, 4, 1, COLORS.metalDark);
  rect(ctx, 29, 9, 2, 2, COLORS.sun);

  if (style === 1) {
    rect(ctx, 4, 0, 12, 2, COLORS.woodDark);
    rect(ctx, 5, 0, 4, 1, COLORS.amber);
    rect(ctx, 11, 0, 4, 1, palette.accent);
  } else if (style === 2) {
    rect(ctx, 1, 0, 1, 4, COLORS.ink);
    rect(ctx, 2, 0, 4, 2, palette.accent);
    rect(ctx, 3, 15, 15, 1, palette.trim);
  }

  drawWheel(ctx, 4, 14);
  drawWheel(ctx, 23, 14);
}

function drawBus(ctx: CanvasRenderingContext2D, palette: VehiclePalette, style: number): void {
  const w = VEHICLE_WIDTH.bus;
  rect(ctx, 3, 18, w - 6, 2, COLORS.shadow);

  rect(ctx, 2, 2, 72, 15, COLORS.ink);
  rect(ctx, 3, 3, 70, 13, palette.body);
  rect(ctx, 4, 0, 67, 4, COLORS.ink);
  rect(ctx, 5, 1, 65, 2, palette.roof);
  rect(ctx, 6, 3, 64, 1, palette.accent);

  for (let pane = 0; pane < 6; pane += 1) {
    const x = 7 + pane * 9;
    rect(ctx, x, 4, 7, 6, COLORS.ink);
    rect(ctx, x + 1, 5, 5, 4, COLORS.glass);
    rect(ctx, x + 1, 5, 5, 1, COLORS.glassLight);
  }

  rect(ctx, 61, 4, 10, 6, COLORS.ink);
  rect(ctx, 62, 5, 8, 4, COLORS.glassLight);
  rect(ctx, 60, 2, 12, 2, COLORS.paper);
  rect(ctx, 62, 2, 2, 1, COLORS.red);
  rect(ctx, 66, 2, 3, 1, COLORS.ink);

  rect(ctx, 3, 11, 68, 2, palette.accent);
  rect(ctx, 4, 13, 66, 1, palette.trim);
  rect(ctx, 4, 15, 66, 1, palette.roof);

  rect(ctx, 2, 10, 2, 3, COLORS.red);
  rect(ctx, 71, 9, 2, 2, COLORS.sun);
  rect(ctx, 71, 12, 2, 2, COLORS.metal);
  rect(ctx, 59, 11, 2, 5, COLORS.ink);

  if (style === 1) {
    rect(ctx, 8, 0, 15, 2, COLORS.woodDark);
    rect(ctx, 9, 0, 4, 1, COLORS.amber);
    rect(ctx, 14, 0, 4, 1, COLORS.aqua);
    rect(ctx, 30, 0, 10, 2, COLORS.woodDark);
    rect(ctx, 31, 0, 3, 1, COLORS.paper);
  } else if (style === 2) {
    for (let x = 6; x < 68; x += 8) {
      rect(ctx, x, 15, 4, 1, x % 16 === 6 ? palette.trim : palette.accent);
    }
    rect(ctx, 60, 1, 12, 1, palette.accent);
  }

  drawWheel(ctx, 12, 13);
  drawWheel(ctx, 57, 13);
}

export function getVehicleSprite(kind: VehicleKind, variant: number): HTMLCanvasElement {
  const paletteIndex = Math.abs(variant) % VEHICLE_PALETTES.length;
  const style = Math.abs(variant) % 3;
  const palette = VEHICLE_PALETTES[paletteIndex] ?? VEHICLE_PALETTES[0];
  if (!palette) throw new Error('Missing vehicle palette');
  return cachedSprite(`vehicle-${kind}-${paletteIndex}-${style}`, VEHICLE_WIDTH[kind], TILE, (ctx) => {
    if (kind === 'jeepney') drawJeepney(ctx, palette, style);
    else if (kind === 'tricycle') drawTricycle(ctx, palette, style);
    else drawBus(ctx, palette, style);
  });
}

interface StorePalette {
  sign: string;
  signText: string;
  awningA: string;
  awningB: string;
  wall: string;
}

const STORE_PALETTES: readonly StorePalette[] = [
  { sign: COLORS.sun, signText: COLORS.red, awningA: COLORS.coral, awningB: COLORS.cream, wall: '#efd8ad' },
  { sign: COLORS.cream, signText: COLORS.red, awningA: COLORS.teal, awningB: COLORS.paper, wall: '#e5d9c0' },
  { sign: COLORS.coral, signText: COLORS.paper, awningA: COLORS.sun, awningB: COLORS.red, wall: '#f2d9b6' },
];

const STORE_SIGNS = ['SARI-SARI', 'TINDAHAN', 'KARINDERYA'];

function drawStore(ctx: CanvasRenderingContext2D, variant: number): void {
  const w = PROP_WIDTH.store * TILE;
  const paletteIndex = Math.abs(variant) % STORE_PALETTES.length;
  const palette = STORE_PALETTES[paletteIndex] ?? STORE_PALETTES[0];
  const sign = STORE_SIGNS[paletteIndex] ?? STORE_SIGNS[0];
  if (!palette || !sign) throw new Error('Missing store palette');

  rect(ctx, 3, 18, w - 6, 2, COLORS.shadow);

  rect(ctx, 3, 0, w - 6, 7, COLORS.ink);
  rect(ctx, 4, 1, w - 8, 5, palette.sign);
  const signWidth = sign.length * 4 - 1;
  drawTinyText(ctx, sign, Math.round((w - signWidth) / 2), 1, palette.signText, 1);
  rect(ctx, 5, 2, 2, 2, COLORS.cream);
  rect(ctx, w - 9, 2, 2, 2, COLORS.cream);

  rect(ctx, 1, 7, w - 2, 4, COLORS.ink);
  for (let index = 0; index < 14; index += 1) {
    const x = 2 + index * 4;
    rect(ctx, x, 8, 4, 2, index % 2 === 0 ? palette.awningA : palette.awningB);
    if (index % 2 === 0) rect(ctx, x, 10, 2, 1, palette.awningA);
    else rect(ctx, x, 10, 2, 1, palette.awningB);
  }

  rect(ctx, 3, 11, w - 6, 7, COLORS.ink);
  rect(ctx, 4, 12, w - 8, 5, palette.wall);

  rect(ctx, 6, 12, 31, 4, '#433235');
  rect(ctx, 7, 13, 29, 1, COLORS.woodLight);
  rect(ctx, 7, 15, 29, 1, COLORS.woodLight);
  const goods = [COLORS.sun, COLORS.red, COLORS.teal, COLORS.pink, COLORS.blue, COLORS.lime, COLORS.amber, COLORS.purple];
  for (let index = 0; index < 14; index += 1) {
    const x = 8 + index * 2;
    const color = goods[index % goods.length] ?? COLORS.sun;
    rect(ctx, x, 12, 1, 1, color);
    rect(ctx, x + (index % 3), 14, 1, 1, color);
    rect(ctx, x, 16, 1, 1, color);
  }
  rect(ctx, 30, 12, 4, 1, COLORS.hair);
  rect(ctx, 30, 13, 4, 2, COLORS.skin);
  rect(ctx, 29, 15, 6, 1, palette.awningA);

  rect(ctx, 40, 12, 12, 5, COLORS.ink);
  rect(ctx, 41, 13, 10, 4, COLORS.woodDark);
  rect(ctx, 46, 13, 4, 2, COLORS.glassLight);
  rect(ctx, 48, 15, 1, 1, COLORS.sun);

  rect(ctx, 4, 16, w - 8, 1, COLORS.wood);
  for (let x = 3; x < w - 3; x += 5) {
    rect(ctx, x, 18, 2, 1, COLORS.sidewalkLine);
  }
}

interface CartPalette {
  canopyA: string;
  canopyB: string;
  body: string;
}

const CART_PALETTES: readonly CartPalette[] = [
  { canopyA: COLORS.coral, canopyB: COLORS.cream, body: COLORS.teal },
  { canopyA: COLORS.teal, canopyB: COLORS.cream, body: COLORS.coral },
  { canopyA: COLORS.sun, canopyB: COLORS.red, body: COLORS.blue },
];

function drawCart(ctx: CanvasRenderingContext2D, variant: number): void {
  const w = PROP_WIDTH.cart * TILE;
  const paletteIndex = Math.abs(variant) % CART_PALETTES.length;
  const palette = CART_PALETTES[paletteIndex] ?? CART_PALETTES[0];
  if (!palette) throw new Error('Missing cart palette');

  rect(ctx, 4, 17, w - 8, 2, COLORS.shadow);

  rect(ctx, 2, 0, w - 4, 6, COLORS.ink);
  rect(ctx, 3, 1, w - 6, 3, palette.canopyB);
  for (let index = 0; index < 9; index += 1) {
    const x = 3 + index * 4;
    if (index % 2 === 0) rect(ctx, x, 1, 4, 3, palette.canopyA);
    rect(ctx, x, 4, index % 2 === 0 ? 2 : 4, 1, index % 2 === 0 ? palette.canopyA : palette.canopyB);
  }
  rect(ctx, 3, 5, w - 6, 1, COLORS.ink);

  rect(ctx, 19, 5, 2, 7, COLORS.ink);
  rect(ctx, 20, 5, 1, 6, COLORS.metal);

  rect(ctx, 22, 5, 7, 5, COLORS.ink);
  rect(ctx, 23, 6, 5, 3, COLORS.skin);
  rect(ctx, 22, 5, 7, 1, COLORS.hair);
  rect(ctx, 24, 9, 4, 2, palette.canopyA);

  rect(ctx, 6, 10, 30, 8, COLORS.ink);
  rect(ctx, 7, 11, 28, 6, palette.body);
  rect(ctx, 9, 11, 18, 4, COLORS.ink);
  rect(ctx, 10, 12, 16, 2, COLORS.glass);
  rect(ctx, 10, 12, 16, 1, COLORS.glassLight);

  for (let index = 0; index < 5; index += 1) {
    const x = 12 + index * 3;
    rect(ctx, x, 12, 2, 2, COLORS.amber);
    rect(ctx, x, 12, 1, 1, COLORS.sun);
  }

  rect(ctx, 28, 11, 2, 3, COLORS.red);
  rect(ctx, 31, 11, 2, 3, COLORS.sun);
  rect(ctx, 7, 15, 28, 2, palette.canopyB);
  rect(ctx, 7, 15, 28, 1, palette.canopyA);
  rect(ctx, 9, 16, 3, 1, COLORS.sidewalkLine);
  rect(ctx, 14, 16, 3, 1, COLORS.sidewalkLine);

  rect(ctx, 11, 16, 6, 3, COLORS.ink);
  rect(ctx, 12, 17, 4, 1, COLORS.metalDark);
  rect(ctx, 25, 16, 6, 3, COLORS.ink);
  rect(ctx, 26, 17, 4, 1, COLORS.metalDark);
}

function drawCrates(ctx: CanvasRenderingContext2D, variant: number): void {
  const produce = [
    [COLORS.sun, COLORS.lime, COLORS.amber],
    [COLORS.coral, COLORS.lime, COLORS.sun],
    [COLORS.green, COLORS.aqua, COLORS.amber],
  ][variant] ?? [COLORS.sun, COLORS.lime, COLORS.amber];

  rect(ctx, 2, 18, 16, 2, COLORS.shadow);

  rect(ctx, 2, 9, 16, 9, COLORS.ink);
  rect(ctx, 3, 10, 14, 7, COLORS.woodDark);
  rect(ctx, 4, 11, 12, 1, COLORS.wood);
  rect(ctx, 4, 14, 12, 1, COLORS.wood);
  rect(ctx, 4, 16, 12, 1, COLORS.woodLight);

  rect(ctx, 4, 4, 13, 7, COLORS.ink);
  rect(ctx, 5, 5, 11, 5, COLORS.woodLight);
  rect(ctx, 6, 6, 9, 1, COLORS.wood);
  rect(ctx, 6, 8, 9, 1, COLORS.wood);

  for (let index = 0; index < 6; index += 1) {
    const x = 5 + ((index * 3 + variant) % 11);
    const y = 2 + (index % 3);
    rect(ctx, x, y, 2, 1, produce[index % produce.length] ?? COLORS.sun);
  }
  rect(ctx, 7, 1, 1, 1, COLORS.paper);
}

function drawBench(ctx: CanvasRenderingContext2D, variant: number): void {
  const w = PROP_WIDTH.bench * TILE;
  const paint = [COLORS.green, COLORS.blue, COLORS.teal][variant] ?? COLORS.green;

  rect(ctx, 3, 18, w - 6, 2, COLORS.shadow);

  rect(ctx, 2, 2, w - 4, 6, COLORS.ink);
  rect(ctx, 3, 3, w - 6, 4, paint);
  rect(ctx, 3, 4, w - 6, 1, COLORS.lime);

  rect(ctx, 1, 8, w - 2, 6, COLORS.ink);
  rect(ctx, 2, 9, w - 4, 4, paint);
  for (let x = 6; x < w - 5; x += 6) rect(ctx, x, 9, 1, 4, COLORS.inkSoft);

  rect(ctx, 1, 7, 2, 7, COLORS.ink);
  rect(ctx, w - 3, 7, 2, 7, COLORS.ink);
  rect(ctx, 4, 14, 3, 5, COLORS.ink);
  rect(ctx, w - 7, 14, 3, 5, COLORS.ink);
  rect(ctx, 4, 14, 1, 4, COLORS.metalDark);
  rect(ctx, w - 7, 14, 1, 4, COLORS.metalDark);
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  rect(ctx, x + 1, y, 8, 2, COLORS.ink);
  rect(ctx, x, y + 2, 10, 6, COLORS.ink);
  rect(ctx, x + 1, y + 1, 8, 6, color);
  rect(ctx, x + 3, y + 3, 1, 4, COLORS.inkSoft);
  rect(ctx, x + 5, y + 3, 1, 4, COLORS.inkSoft);
  rect(ctx, x + 7, y + 3, 1, 4, COLORS.inkSoft);
  rect(ctx, x - 1, y + 5, 1, 4, COLORS.ink);
  rect(ctx, x + 10, y + 5, 1, 4, COLORS.ink);
  rect(ctx, x, y + 8, 10, 2, COLORS.ink);
  rect(ctx, x + 1, y + 8, 8, 1, color);
  rect(ctx, x + 1, y + 10, 2, 6, COLORS.ink);
  rect(ctx, x + 7, y + 10, 2, 6, COLORS.ink);
  rect(ctx, x + 1, y + 10, 1, 5, color);
  rect(ctx, x + 7, y + 10, 1, 5, color);
}

function drawChairs(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 2, 18, 16, 2, COLORS.shadow);
  drawChair(ctx, 9, 1, COLORS.pink);
  drawChair(ctx, 2, 5, COLORS.blue);
}

function drawTrash(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 2, 18, 16, 2, COLORS.shadow);

  rect(ctx, 6, 6, 2, 2, COLORS.ink);
  rect(ctx, 4, 7, 2, 2, COLORS.ink);
  rect(ctx, 3, 9, 8, 2, COLORS.ink);
  rect(ctx, 2, 11, 10, 6, COLORS.ink);
  rect(ctx, 4, 17, 7, 1, COLORS.ink);
  rect(ctx, 4, 10, 6, 1, COLORS.trashLight);
  rect(ctx, 3, 12, 8, 4, COLORS.trash);
  rect(ctx, 4, 12, 2, 1, COLORS.trashLight);
  rect(ctx, 8, 14, 2, 1, COLORS.trashLight);

  rect(ctx, 14, 8, 2, 2, COLORS.ink);
  rect(ctx, 13, 10, 2, 2, COLORS.ink);
  rect(ctx, 11, 12, 8, 5, COLORS.ink);
  rect(ctx, 13, 18, 5, 1, COLORS.ink);
  rect(ctx, 12, 13, 6, 3, COLORS.trash);
  rect(ctx, 12, 13, 2, 1, COLORS.trashLight);
  rect(ctx, 16, 15, 1, 1, COLORS.trashLight);

  rect(ctx, 17, 17, 2, 1, COLORS.metal);
  rect(ctx, 4, 18, 2, 1, COLORS.coral);
  rect(ctx, 9, 17, 1, 1, COLORS.sun);
  rect(ctx, 14, 4, 1, 1, COLORS.paper);
}

function drawPlant(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 3, 18, 14, 2, COLORS.shadow);

  rect(ctx, 9, 7, 1, 7, COLORS.green);
  rect(ctx, 5, 8, 3, 2, COLORS.green);
  rect(ctx, 4, 6, 2, 2, COLORS.lime);
  rect(ctx, 7, 4, 3, 2, COLORS.green);
  rect(ctx, 10, 5, 4, 2, COLORS.lime);
  rect(ctx, 13, 7, 3, 3, COLORS.green);
  rect(ctx, 8, 10, 5, 2, COLORS.lime);
  rect(ctx, 4, 11, 2, 1, COLORS.green);
  rect(ctx, 13, 11, 2, 1, COLORS.green);

  rect(ctx, 5, 13, 10, 2, COLORS.ink);
  rect(ctx, 6, 13, 8, 1, COLORS.coral);
  rect(ctx, 6, 15, 8, 3, COLORS.ink);
  rect(ctx, 7, 15, 6, 3, COLORS.coral);
  rect(ctx, 7, 15, 6, 1, COLORS.sun);
  rect(ctx, 8, 17, 4, 1, COLORS.red);
}

function drawSign(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 4, 18, 12, 2, COLORS.shadow);
  rect(ctx, 9, 8, 2, 12, COLORS.ink);
  rect(ctx, 10, 8, 1, 11, COLORS.metalDark);

  rect(ctx, 6, 1, 8, 1, COLORS.ink);
  rect(ctx, 4, 2, 12, 2, COLORS.ink);
  rect(ctx, 3, 4, 14, 9, COLORS.ink);
  rect(ctx, 5, 13, 10, 1, COLORS.ink);
  rect(ctx, 5, 2, 10, 1, COLORS.red);
  rect(ctx, 4, 3, 12, 8, COLORS.red);
  rect(ctx, 5, 11, 10, 2, COLORS.red);
  rect(ctx, 5, 11, 2, 1, COLORS.ink);
  rect(ctx, 13, 11, 2, 1, COLORS.ink);
  rect(ctx, 4, 7, 12, 2, COLORS.paper);
  rect(ctx, 6, 5, 2, 2, COLORS.ink);
  rect(ctx, 9, 4, 2, 2, COLORS.ink);
  rect(ctx, 11, 6, 2, 1, COLORS.ink);
  rect(ctx, 6, 9, 2, 2, COLORS.ink);
  rect(ctx, 10, 9, 2, 1, COLORS.ink);
  rect(ctx, 12, 10, 1, 1, COLORS.ink);
}

function drawPole(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 3, 45, 14, 3, COLORS.shadow);
  rect(ctx, 8, 4, 5, 43, COLORS.ink);
  rect(ctx, 9, 5, 3, 41, COLORS.wood);
  rect(ctx, 9, 5, 1, 41, COLORS.woodLight);
  rect(ctx, 4, 46, 12, 2, COLORS.metalDark);

  rect(ctx, 1, 8, 18, 3, COLORS.ink);
  rect(ctx, 2, 9, 16, 1, COLORS.woodDark);
  rect(ctx, 3, 6, 2, 2, COLORS.aqua);
  rect(ctx, 15, 6, 2, 2, COLORS.aqua);
  rect(ctx, 3, 6, 1, 1, COLORS.paper);
  rect(ctx, 15, 6, 1, 1, COLORS.paper);

  rect(ctx, 12, 21, 6, 9, COLORS.ink);
  rect(ctx, 13, 22, 4, 7, COLORS.metalDark);
  rect(ctx, 14, 23, 2, 1, COLORS.metal);
  rect(ctx, 14, 26, 2, 1, COLORS.metal);

  rect(ctx, 6, 37, 8, 4, COLORS.ink);
  rect(ctx, 7, 38, 6, 2, COLORS.paper);
  rect(ctx, 8, 38, 3, 1, COLORS.red);
}

export function getPropSprite(kind: PropKind, variant = 0): HTMLCanvasElement {
  const width = PROP_WIDTH[kind] * TILE;
  const height = kind === 'pole' ? 48 : TILE;
  const variantIndex = kind === 'store' || kind === 'cart' || kind === 'crates' || kind === 'bench' ? Math.abs(variant) % 3 : 0;
  return cachedSprite(`prop-${kind}-${variantIndex}`, width, height, (ctx) => {
    if (kind === 'store') drawStore(ctx, variantIndex);
    else if (kind === 'cart') drawCart(ctx, variantIndex);
    else if (kind === 'crates') drawCrates(ctx, variantIndex);
    else if (kind === 'bench') drawBench(ctx, variantIndex);
    else if (kind === 'chairs') drawChairs(ctx);
    else if (kind === 'trash') drawTrash(ctx);
    else if (kind === 'plant') drawPlant(ctx);
    else if (kind === 'sign') drawSign(ctx);
    else drawPole(ctx);
  });
}

function drawBall(ctx: CanvasRenderingContext2D, cx: number, cy: number, body: string, shine: string): void {
  rect(ctx, cx - 1, cy - 2, 3, 5, COLORS.ink);
  rect(ctx, cx - 2, cy - 1, 5, 3, COLORS.ink);
  rect(ctx, cx - 1, cy - 1, 3, 3, body);
  rect(ctx, cx, cy - 1, 1, 1, shine);
}

function drawFishball(ctx: CanvasRenderingContext2D): void {
  for (let index = 0; index < 13; index += 1) {
    rect(ctx, 5 + index, 18 - index, 1, 1, COLORS.woodDark);
  }
  drawBall(ctx, 8, 14, COLORS.amber, COLORS.sun);
  drawBall(ctx, 11, 10, COLORS.amber, COLORS.paper);
  drawBall(ctx, 14, 6, COLORS.amber, COLORS.sun);
  rect(ctx, 3, 18, 2, 1, COLORS.amber);
}

function drawKikiam(ctx: CanvasRenderingContext2D): void {
  for (let index = 0; index < 14; index += 1) {
    rect(ctx, 4 + index, 18 - index, 1, 1, COLORS.woodDark);
  }

  for (let index = 0; index < 10; index += 1) {
    rect(ctx, 4 + index, 14 - index, 5, 5, COLORS.ink);
  }
  for (let index = 0; index < 10; index += 1) {
    rect(ctx, 5 + index, 15 - index, 3, 3, index % 4 === 2 ? COLORS.woodLight : COLORS.amber);
  }
  for (let index = 0; index < 9; index += 1) {
    rect(ctx, 6 + index, 15 - index, 1, 1, COLORS.sun);
  }

  rect(ctx, 7, 13, 2, 1, COLORS.woodDark);
  rect(ctx, 10, 10, 2, 1, COLORS.woodDark);
  rect(ctx, 13, 7, 2, 1, COLORS.woodDark);

  rect(ctx, 15, 5, 2, 2, COLORS.red);
  rect(ctx, 15, 5, 1, 1, COLORS.paper);
  rect(ctx, 3, 16, 2, 1, COLORS.woodLight);
}

function drawAnting(ctx: CanvasRenderingContext2D): void {
  rect(ctx, 9, 0, 2, 5, COLORS.ink);
  rect(ctx, 7, 1, 2, 3, COLORS.red);
  rect(ctx, 11, 1, 2, 3, COLORS.red);
  rect(ctx, 8, 4, 4, 2, COLORS.ink);
  rect(ctx, 9, 4, 2, 1, COLORS.sun);

  rect(ctx, 7, 6, 6, 1, COLORS.ink);
  rect(ctx, 5, 7, 10, 2, COLORS.ink);
  rect(ctx, 5, 9, 10, 7, COLORS.ink);
  rect(ctx, 6, 16, 8, 1, COLORS.ink);
  rect(ctx, 8, 17, 4, 1, COLORS.ink);

  rect(ctx, 6, 7, 8, 1, COLORS.red);
  rect(ctx, 6, 8, 8, 7, COLORS.red);
  rect(ctx, 7, 15, 6, 1, COLORS.red);
  rect(ctx, 9, 8, 2, 1, COLORS.sun);

  rect(ctx, 10, 9, 1, 2, COLORS.sun);
  rect(ctx, 9, 10, 3, 1, COLORS.sun);
  rect(ctx, 8, 11, 5, 1, COLORS.sun);
  rect(ctx, 9, 12, 3, 1, COLORS.sun);
  rect(ctx, 10, 13, 1, 2, COLORS.sun);
  rect(ctx, 11, 12, 1, 1, COLORS.amber);

  rect(ctx, 2, 8, 1, 1, COLORS.paper);
  rect(ctx, 17, 13, 1, 1, COLORS.paper);
  rect(ctx, 7, 15, 2, 1, COLORS.amber);
}

export function getPickupSprite(kind: PickupKind): HTMLCanvasElement {
  return cachedSprite(`pickup-${kind}`, TILE, TILE, (ctx) => {
    if (kind === 'fishball') drawFishball(ctx);
    else if (kind === 'kikiam') drawKikiam(ctx);
    else drawAnting(ctx);
  });
}

/** Draws a source->target sagging power line with crisp 1px steps. */
export function drawWire(ctx: CanvasRenderingContext2D, baseY: number, sag: number, width: number): void {
  for (let x = 0; x < width; x += 3) {
    const t = x / Math.max(1, width - 1);
    const y = baseY + Math.round(Math.sin(Math.PI * t) * sag);
    rect(ctx, x, y, 3, 1, COLORS.wire);
  }
}
