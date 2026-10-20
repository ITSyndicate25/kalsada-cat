import './styles.css';
import { Engine, type Direction, type Phase } from './game/engine';
import { Renderer } from './render/renderer';
import { AudioBus } from './ui/audio';
import { COPY, detectLanguage, formatGameOver, type Copy, type Language } from './ui/i18n';
import { loadBest, loadLanguage, loadMuted, saveBest, saveLanguage, saveMuted } from './ui/storage';

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

const stage = element<HTMLElement>('stage');
const canvas = element<HTMLCanvasElement>('game');
const startScreen = element<HTMLElement>('startScreen');
const pauseScreen = element<HTMLElement>('pauseScreen');
const overScreen = element<HTMLElement>('overScreen');
const scoreValue = element<HTMLElement>('score');
const bestValue = element<HTMLElement>('best');
const startBest = element<HTMLElement>('startBest');
const finalScore = element<HTMLElement>('finalScore');
const finalBest = element<HTMLElement>('finalBest');
const recordLine = element<HTMLElement>('recordLine');
const powerBadge = element<HTMLElement>('powerBadge');
const powerCount = element<HTMLElement>('powerCount');
const announcer = element<HTMLElement>('announcer');
const startBtn = element<HTMLButtonElement>('startBtn');
const pauseBtn = element<HTMLButtonElement>('pauseBtn');
const soundBtn = element<HTMLButtonElement>('soundBtn');
const resumeBtn = element<HTMLButtonElement>('resumeBtn');
const restartBtn = element<HTMLButtonElement>('restartBtn');
const quitBtn = element<HTMLButtonElement>('quitBtn');
const retryBtn = element<HTMLButtonElement>('retryBtn');
const homeBtn = element<HTMLButtonElement>('homeBtn');
const languageGroups = Array.from(document.querySelectorAll<HTMLElement>('[data-lang-group]'));
const languageButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-lang]'));
const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');

const formatScore = (value: number): string => String(Math.max(0, Math.floor(value))).padStart(3, '0');

let storedBest = loadBest();
const engine = new Engine({ best: storedBest });
const renderer = new Renderer(canvas);
const audio = new AudioBus(loadMuted());

let phase: Phase | null = null;
let phaseChangedAt = 0;
let shownScore = '';
let shownBest = '';
let shownShields: number | null = null;
let shownPauseDisabled: boolean | null = null;
let pointerStart: { id: number; x: number; y: number } | null = null;
let language: Language = loadLanguage() ?? detectLanguage();
let copy: Copy = COPY[language];

const KEY_TO_DIRECTION: Readonly<Record<string, Direction | undefined>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
};

function announcePhase(): void {
  if (engine.phase === 'ready') announcer.textContent = copy.announceReady;
  else if (engine.phase === 'over') announcer.textContent = formatGameOver(language, engine.score, engine.best);
  else if (engine.phase === 'paused') announcer.textContent = copy.announcePaused;
  else announcer.textContent = '';
}

function syncSoundButton(): void {
  soundBtn.setAttribute('aria-pressed', String(!audio.muted));
  soundBtn.setAttribute('aria-label', copy.soundAria);
  soundBtn.title = audio.muted ? copy.soundTitleOff : copy.soundTitleOn;
}

function applyLanguage(next: Language, persist = true): void {
  language = next;
  copy = COPY[language];

  document.documentElement.lang = language;
  document.title = copy.documentTitle;
  if (descriptionMeta) descriptionMeta.content = copy.metaDescription;

  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n;
    if (!key || !Object.hasOwn(copy, key)) continue;
    node.textContent = copy[key as keyof Copy];
  }

  canvas.setAttribute('aria-label', copy.canvasLabel);
  pauseBtn.setAttribute('aria-label', copy.pauseAria);
  pauseBtn.title = copy.pauseTitleAttr;

  for (const group of languageGroups) group.setAttribute('aria-label', copy.languageGroup);
  for (const button of languageButtons) {
    const active = button.dataset.lang === language;
    const label = button.dataset.lang === 'fil' ? copy.languageFilipino : copy.languageEnglish;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  announcer.lang = language;
  engine.shieldPopup = copy.shieldPopup;
  syncSoundButton();
  syncHud(true);
  announcePhase();
  if (persist) saveLanguage(language);
}

function syncPhase(force = false): void {
  if (!force && phase === engine.phase) return;
  const previous = phase;
  phase = engine.phase;
  phaseChangedAt = performance.now();
  stage.dataset.phase = phase;
  startScreen.hidden = phase !== 'ready';
  pauseScreen.hidden = phase !== 'paused';
  overScreen.hidden = phase !== 'over';

  if (phase === 'ready') {
    startBest.textContent = formatScore(engine.best);
    announcer.textContent = copy.announceReady;
    startBtn.focus({ preventScroll: true });
  } else if (phase === 'over') {
    finalScore.textContent = formatScore(engine.score);
    finalBest.textContent = formatScore(engine.best);
    recordLine.hidden = !engine.lastRunRecord;
    announcer.textContent = formatGameOver(language, engine.score, engine.best);
    retryBtn.focus({ preventScroll: true });
    persistBest();
  } else if (phase === 'paused') {
    announcer.textContent = copy.announcePaused;
    resumeBtn.focus({ preventScroll: true });
  } else if (phase === 'playing') {
    announcer.textContent = '';
    if (previous !== 'paused') canvas.focus({ preventScroll: true });
  }
}

function syncHud(force = false): void {
  const scoreText = formatScore(engine.score);
  if (force || scoreText !== shownScore) {
    scoreValue.textContent = scoreText;
    shownScore = scoreText;
  }

  const bestText = formatScore(engine.best);
  if (force || bestText !== shownBest) {
    bestValue.textContent = bestText;
    shownBest = bestText;
  }

  if (force || engine.shields !== shownShields) {
    const stacks = engine.shields;
    powerBadge.hidden = stacks === 0;
    powerBadge.title = stacks > 0 ? `${copy.power}${stacks > 1 ? ` x${stacks}` : ''}` : '';
    powerCount.hidden = stacks < 2;
    powerCount.textContent = stacks > 1 ? `x${stacks}` : '';
    shownShields = stacks;
  }

  const pauseDisabled = engine.phase !== 'playing';
  if (force || pauseDisabled !== shownPauseDisabled) {
    pauseBtn.disabled = pauseDisabled;
    shownPauseDisabled = pauseDisabled;
  }

  persistBest();
}

function persistBest(): void {
  if (engine.best <= storedBest) return;
  storedBest = engine.best;
  saveBest(storedBest);
  startBest.textContent = formatScore(storedBest);
}

function beginRun(): void {
  audio.unlock();
  engine.start();
  syncPhase(true);
  syncHud(true);
}

function goHome(): void {
  audio.unlock();
  audio.play('click');
  engine.goHome();
  syncPhase(true);
  syncHud(true);
}

function pauseGame(): void {
  if (engine.phase !== 'playing') return;
  audio.unlock();
  audio.play('click');
  engine.pause();
  syncPhase(true);
}

function resumeGame(): void {
  if (engine.phase !== 'paused') return;
  audio.unlock();
  audio.play('click');
  engine.resume();
  syncPhase(true);
}

function toggleSound(): void {
  audio.unlock();
  const muted = audio.toggle();
  saveMuted(muted);
  syncSoundButton();
  if (!muted) audio.play('click');
}

function processEvents(): void {
  for (const event of engine.drainEvents()) {
    if (event.type === 'hop') audio.play('hop');
    else if (event.type === 'bump') audio.play('bump');
    else if (event.type === 'pickup') audio.play(event.kind === 'anting' ? 'power' : 'coin');
    else if (event.type === 'shield-break') audio.play('shield-break');
    else if (event.type === 'crash') audio.play('crash');
    else if (event.type === 'start') audio.play('start');
    else if (event.type === 'gameover') {
      audio.play('gameover');
      saveBest(event.best);
      storedBest = Math.max(storedBest, event.best);
    }
  }
}

startBtn.addEventListener('click', beginRun);
retryBtn.addEventListener('click', beginRun);
restartBtn.addEventListener('click', beginRun);
homeBtn.addEventListener('click', goHome);
quitBtn.addEventListener('click', goHome);
pauseBtn.addEventListener('click', pauseGame);
resumeBtn.addEventListener('click', resumeGame);
soundBtn.addEventListener('click', toggleSound);

for (const button of languageButtons) {
  button.addEventListener('click', () => {
    const next: Language = button.dataset.lang === 'fil' ? 'fil' : 'en';
    if (next === language) return;
    audio.unlock();
    audio.play('click');
    applyLanguage(next);

    if (engine.phase === 'ready') startBtn.focus({ preventScroll: true });
    else if (engine.phase === 'paused') resumeBtn.focus({ preventScroll: true });
    else if (engine.phase === 'over') retryBtn.focus({ preventScroll: true });
    else canvas.focus({ preventScroll: true });
  });
}

canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (engine.phase !== 'playing') return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  event.preventDefault();
  if (engine.phase !== 'playing') return;

  if (Math.hypot(dx, dy) < 14) {
    engine.move('up');
  } else if (Math.abs(dx) > Math.abs(dy)) {
    engine.move(dx > 0 ? 'right' : 'left');
  } else {
    engine.move(dy > 0 ? 'down' : 'up');
  }
});

canvas.addEventListener('pointercancel', () => {
  pointerStart = null;
});

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.defaultPrevented) return;

  const buttonFocused = document.activeElement instanceof HTMLButtonElement;
  if (buttonFocused && (event.key === ' ' || event.key === 'Enter')) return;

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    if (engine.phase === 'ready') {
      beginRun();
    } else if (engine.phase === 'over' && performance.now() - phaseChangedAt > 300) {
      beginRun();
    } else if (engine.phase === 'paused') {
      resumeGame();
    }
    return;
  }

  if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && !event.repeat) {
    if (engine.phase === 'playing') {
      event.preventDefault();
      pauseGame();
    } else if (engine.phase === 'paused') {
      event.preventDefault();
      resumeGame();
    }
    return;
  }

  if ((event.key === 'm' || event.key === 'M') && !event.repeat) {
    event.preventDefault();
    toggleSound();
    return;
  }

  const direction = KEY_TO_DIRECTION[event.key] ?? KEY_TO_DIRECTION[event.key.toLowerCase()];
  if (!direction) return;
  event.preventDefault();
  engine.move(direction);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden || engine.phase !== 'playing') return;
  engine.pause();
  syncPhase(true);
  syncHud(true);
});

renderer.draw(engine);
applyLanguage(language, false);
syncPhase(true);
syncHud(true);

let lastTime = performance.now();
function frame(now: number): void {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  engine.update(dt);
  processEvents();
  renderer.draw(engine);
  syncPhase();
  syncHud();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
