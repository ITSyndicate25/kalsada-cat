const BEST_KEY = 'kalsada-cat.best.v1';
const MUTED_KEY = 'kalsada-cat.muted.v1';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be blocked in private contexts. The game still runs without records.
    return null;
  }
}

export function loadBest(): number {
  const value = Number.parseInt(read(BEST_KEY) ?? '', 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 999999) : 0;
}

export function saveBest(score: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(score))));
  } catch {
    // Best effort: a full or disabled localStorage must not stop gameplay.
  }
}

export function loadMuted(): boolean {
  return read(MUTED_KEY) === '1';
}

export function saveMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Sound preference is non-critical.
  }
}
