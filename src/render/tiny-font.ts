const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'],
  '.': ['000', '000', '000', '000', '010'],
  ' ': ['000', '000', '000', '000', '000'],
};

function paint(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale: number,
): void {
  ctx.fillStyle = color;
  for (let index = 0; index < text.length; index += 1) {
    const glyph = GLYPHS[text.charAt(index).toUpperCase()];
    if (!glyph) continue;
    const originX = x + index * 4 * scale;
    for (let row = 0; row < glyph.length; row += 1) {
      const pattern = glyph[row] ?? '';
      for (let col = 0; col < pattern.length; col += 1) {
        if (pattern.charAt(col) !== '1') continue;
        ctx.fillRect(originX + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}

/** Draws the compact 3x5 bitmap font. Returns the advance width in pixels. */
export function drawTinyText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  outline?: string,
): number {
  const upper = text.toUpperCase();
  if (outline) {
    paint(ctx, upper, x - 1, y, outline, scale);
    paint(ctx, upper, x + 1, y, outline, scale);
    paint(ctx, upper, x, y - 1, outline, scale);
    paint(ctx, upper, x, y + 1, outline, scale);
  }
  paint(ctx, upper, x, y, color, scale);
  return Math.max(0, upper.length * 4 * scale - scale);
}
