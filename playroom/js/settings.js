// Per-device presentation settings (sounds, effects, board view). Stored in localStorage,
// so the box's screen and a phone can be set up differently.
const KEY = 'pr.settings';
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const DEFAULTS = {
  sound: true,          // master switch for all sounds
  volume: 0.7,
  dartSounds: true,     // a "thud" for every dart
  eventSounds: true,    // bust, 180, checkout, win, target hit
  caller: false,        // spoken caller (needs voices on the device)
  voice: '',            // speechSynthesis voice name ('' = automatic English)
  effects: true,        // big on-screen celebrations
  confetti: true,       // confetti for 180 / wins
  animations: !reducedMotion,  // animated scores and dart markers
  boardView: true,      // dartboard next to the scoreboard (wide screens)
  boardOnSmall: false,  // also on narrow screens (phones)
  showTargets: true,    // highlight what to aim for on the board
};

export const DESCRIPTIONS = [
  ['Sound', [
    ['sound', 'Sounds', 'Master switch for all sounds on this device.'],
    ['volume', 'Volume', null, 'range'],
    ['dartSounds', 'Dart sounds', 'A short sound for every dart – higher for doubles and trebles.'],
    ['eventSounds', 'Event sounds', 'Bust, target hit, 180, checkout, leg and match won.'],
    ['caller', 'Caller (voice)', 'Calls scores and "you require …" like on TV. Needs a voice on this device.'],
    ['voice', 'Voice', null, 'voice'],
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
