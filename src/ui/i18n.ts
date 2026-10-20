export type Language = 'en' | 'fil';

export interface Copy {
  documentTitle: string;
  metaDescription: string;
  canvasLabel: string;
  score: string;
  best: string;
  power: string;
  shieldPopup: string;
  startEyebrow: string;
  startTaglineA: string;
  startTaglineB: string;
  startButton: string;
  moveLabel: string;
  moveKeys: string;
  hopLabel: string;
  hopKeys: string;
  pauseEyebrow: string;
  pauseTitle: string;
  resume: string;
  restart: string;
  quit: string;
  overEyebrow: string;
  overTitle: string;
  overTagline: string;
  record: string;
  retry: string;
  home: string;
  footerMove: string;
  footerPause: string;
  footerSound: string;
  pauseAria: string;
  pauseTitleAttr: string;
  soundAria: string;
  soundTitleOn: string;
  soundTitleOff: string;
  languageLabel: string;
  languageGroup: string;
  languageEnglish: string;
  languageFilipino: string;
  announceReady: string;
  announcePaused: string;
}

export const COPY: Readonly<Record<Language, Copy>> = {
  en: {
    documentTitle: 'Kalsada-Cat · a Filipino street crossing arcade',
    metaDescription:
      'Kalsada-Cat is a pixel arcade game about a black cat crossing a Filipino street full of jeepneys, fishballs, and sari-sari stores.',
    canvasLabel:
      'Kalsada-Cat. Move the cat with swipe gestures or arrow keys. Avoid jeepneys and collect fishballs.',
    score: 'SCORE',
    best: 'BEST',
    power: 'SHIELD',
    shieldPopup: 'SHIELD',
    startEyebrow: 'WELCOME, MINGMING',
    startTaglineA: 'Cross the street. Dodge the jeepneys.',
    startTaglineB: 'Find the fishballs.',
    startButton: 'START',
    moveLabel: 'MOVE',
    moveKeys: 'SWIPE / ARROWS',
    hopLabel: 'HOP',
    hopKeys: 'TAP / UP',
    pauseEyebrow: 'HOLD ON',
    pauseTitle: 'PAUSED',
    resume: 'RESUME',
    restart: 'RESTART',
    quit: 'QUIT',
    overEyebrow: 'OUCH',
    overTitle: 'CRASH!',
    overTagline: 'The jeepney always wins.',
    record: 'NEW RECORD!',
    retry: 'RETRY',
    home: 'START SCREEN',
    footerMove: 'move',
    footerPause: 'pause',
    footerSound: 'sound',
    pauseAria: 'Pause game',
    pauseTitleAttr: 'Pause (P)',
    soundAria: 'Toggle sound',
    soundTitleOn: 'Mute (M)',
    soundTitleOff: 'Unmute (M)',
    languageLabel: 'LANGUAGE',
    languageGroup: 'Language',
    languageEnglish: 'English',
    languageFilipino: 'Filipino',
    announceReady: 'Kalsada-Cat. Help the cat cross the street.',
    announcePaused: 'Game paused.',
  },
  fil: {
    documentTitle: 'Kalsada-Cat · arcade ng pagtawid sa kalsada ng Pilipinas',
    metaDescription:
      'Ang Kalsada-Cat ay isang pixel arcade game tungkol sa itim na pusa na tumatawid sa kalsada ng Pilipinas na puno ng jeepney, fishball, at sari-sari store.',
    canvasLabel:
      'Kalsada-Cat. Galawin ang pusa gamit ang swipe o arrow keys. Iwasan ang jeepney at hanapin ang fishball.',
    score: 'ISKOR',
    best: 'REKORD',
    power: 'SWERTE',
    shieldPopup: 'SWERTE',
    startEyebrow: 'MABUHAY, MINGMING',
    startTaglineA: 'Tumawid ka. Iwasan ang jeepney.',
    startTaglineB: 'Hanapin ang fishball.',
    startButton: 'SIMULA',
    moveLabel: 'GALAW',
    moveKeys: 'SWIPE / ARROWS',
    hopLabel: 'LUNDAG',
    hopKeys: 'TAP / PAITAAS',
    pauseEyebrow: 'HINTO MUNA',
    pauseTitle: 'HINTO',
    resume: 'ITULOY',
    restart: 'ULITIN',
    quit: 'UMALIS',
    overEyebrow: 'SAKIT AH',
    overTitle: 'BANGGA!',
    overTagline: 'Laging panalo ang jeepney.',
    record: 'BAGONG REKORD!',
    retry: 'ULIT',
    home: 'SIMULA',
    footerMove: 'gumalaw',
    footerPause: 'i-pause',
    footerSound: 'tunog',
    pauseAria: 'I-pause ang laro',
    pauseTitleAttr: 'I-pause (P)',
    soundAria: 'I-toggle ang tunog',
    soundTitleOn: 'I-mute (M)',
    soundTitleOff: 'I-unmute (M)',
    languageLabel: 'WIKA',
    languageGroup: 'Wika',
    languageEnglish: 'Ingles',
    languageFilipino: 'Filipino',
    announceReady: 'Kalsada-Cat. Tulungan ang pusa na tumawid sa kalsada.',
    announcePaused: 'Nakahinto ang laro.',
  },
};

export function detectLanguage(): Language {
  const codes = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  return codes.some((code) => /^(fil|tl)(-|$)/i.test(code)) ? 'fil' : 'en';
}

export function formatGameOver(language: Language, score: number, best: number): string {
  return language === 'fil' ? `Tapos ang laro. Iskor ${score}. Rekord ${best}.` : `Game over. Score ${score}. Best ${best}.`;
}
