import type { Language } from './i18n';

const BEST_KEY = 'kalsada-cat.best.v1';
const MUTED_KEY = 'kalsada-cat.muted.v1';
const LANGUAGE_KEY = 'kalsada-cat.lang.v1';
const SKIN_KEY = 'kalsada-cat.skin.v1';
const MUSIC_KEY = 'kalsada-cat.music.v1';

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

export function loadLanguage(): Language | null {
  const value = read(LANGUAGE_KEY);
  return value === 'en' || value === 'fil' ? value : null;
}

export function saveLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Language is resettable; blocked storage must not stop the game.
  }
}

export function loadSkin(skins: readonly string[]): string | null {
  const value = read(SKIN_KEY);
  return value !== null && skins.includes(value) ? value : null;
}

export function saveSkin(skin: string): void {
  try {
    window.localStorage.setItem(SKIN_KEY, skin);
  } catch {
    // Cosmetic choice; blocked storage must not stop the game.
  }
}

export function loadMusic(): boolean {
  // No stored value means a first visit: music starts on by default.
  return read(MUSIC_KEY) !== '0';
}

export function saveMusic(on: boolean): void {
  try {
    window.localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  } catch {
    // Sound preference is non-critical.
  }
}
