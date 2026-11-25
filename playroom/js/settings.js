// Per-device presentation settings (sounds, effects, board view). Stored in localStorage,
// so the box's screen and a phone can be set up differently.
const KEY = 'pr.settings';
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const DEFAULTS = {
  lang: 'auto',         // 'auto' (box setting / browser), 'de', 'en'
  sound: true,          // master switch for all sounds
  volume: 0.7,
  dartSounds: true,     // a "thud" for every dart
  eventSounds: true,    // bust, 180, checkout, win, target hit
  caller: false,        // spoken caller
  callerVoice: {},      // per language: 'auto' | 'box:<piper voice>' | 'dev:<speechSynthesis voice name>'
  effects: true,        // big on-screen celebrations
  confetti: true,       // confetti for 180 / wins
  animations: !reducedMotion,  // animated scores and dart markers
  boardView: true,      // dartboard next to the scoreboard (wide screens)
  boardOnSmall: false,  // also on narrow screens (phones)
  showTargets: true,    // highlight what to aim for on the board
};

export const DESCRIPTIONS = [
  ['Language', [
    ['lang', 'Language', 'Language of the playroom and the caller.', 'lang'],
  ]],
  ['Sound', [
    ['sound', 'Sounds', 'Master switch for all sounds on this device.'],
    ['volume', 'Volume', null, 'range'],
    ['dartSounds', 'Dart sounds', 'A short sound for every dart – higher for doubles and trebles.'],
    ['eventSounds', 'Event sounds', 'Bust, target hit, 180, checkout, leg and match won.'],
  ]],
  ['Caller', [
    ['caller', 'Caller', 'Announces scores, what\'s left and checkouts – like on TV.'],
    ['callerVoice', 'Voice', null, 'callervoice'],
  ]],
  ['Visuals', [
    ['effects', 'Celebrations', 'Big on-screen messages for 180, high scores, checkouts, busts and wins.'],
    ['confetti', 'Confetti', 'Confetti for 180s and won matches.'],
    ['animations', 'Animations', 'Scores count down, darts pop onto the board. Switch off on slow devices.'],
    ['boardView', 'Dartboard view', 'A dartboard next to the scoreboard showing this turn\'s darts.'],
    ['boardOnSmall', 'Dartboard on phones', 'Also show the dartboard on narrow screens.'],
    ['showTargets', 'Show targets', 'Highlight what to aim for: checkout route, cricket numbers, training target.'],
  ]],
];

let cache = null;
const listeners = new Set();

export function getSettings() {
  if (!cache) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* private mode */ }
    // up to 1.3: separate "natural voice" switch + one device voice name
    if (!saved.callerVoice && (saved.voice || saved.naturalVoice === false)) {
      const v = saved.naturalVoice === false && saved.voice ? 'dev:' + saved.voice : 'auto';
      saved.callerVoice = { de: v, en: v };
    }
    delete saved.voice; delete saved.naturalVoice;
    cache = { ...DEFAULTS, ...saved };
  }
  return cache;
}

export function setSetting(key, value) {
  getSettings();
  cache = { ...cache, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  listeners.forEach((f) => f(cache));
}

export function resetSettings() {
  cache = { ...DEFAULTS };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((f) => f(cache));
}

export function onSettings(f) { listeners.add(f); }
