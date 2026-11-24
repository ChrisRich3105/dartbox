// Sounds are synthesised with the Web Audio API (no audio files, nothing to license)
// and the caller uses the browser's speech synthesis.
import { getSettings } from './settings.js';
import { getLang } from './i18n.js';

let ctx = null, master = null, noiseBuf = null;

function audio() {
  const st = getSettings();
  if (!st.sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  master.gain.value = Math.max(0, Math.min(1, +st.volume)) * 0.9;
  return ctx;
}

/** Browsers only allow audio after a user gesture: call on the first tap/click/key. */
export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function tone(freq, at, dur, { type = 'sine', gain = 0.3, to = null, attack = 0.005 } = {}) {
  const c = ctx, t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(at, dur, { freq = 1200, q = 1, gain = 0.3, type = 'bandpass' } = {}) {
  const c = ctx, t0 = c.currentTime + at;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

const arp = (notes, step, opts) => notes.forEach((f, k) => tone(f, k * step, opts.dur || 0.25, opts));

const SOUNDS = {
  // dart landing: a woody thud, brighter for doubles/trebles
  dart(d) {
    if (!d || !d.m) { noise(0, 0.12, { freq: 300, gain: 0.25, type: 'lowpass' }); return; }
    noise(0, 0.07, { freq: 2200, q: 0.7, gain: 0.35 });
    tone(140, 0, 0.12, { type: 'triangle', gain: 0.35, to: 70 });
    if (d.m === 2) tone(990, 0.02, 0.18, { gain: 0.12 });
    if (d.m === 3) { tone(1320, 0.02, 0.16, { gain: 0.12 }); tone(1760, 0.08, 0.18, { gain: 0.1 }); }
    if (d.n === 25 && d.m === 2) tone(2093, 0.03, 0.3, { gain: 0.12 });
  },
  hit() { tone(880, 0, 0.12, { gain: 0.22 }); tone(1320, 0.07, 0.22, { gain: 0.2 }); },
  bust() { tone(220, 0, 0.45, { type: 'sawtooth', gain: 0.18, to: 110 }); tone(233, 0, 0.45, { type: 'sawtooth', gain: 0.12, to: 116 }); },
  fail() { tone(392, 0, 0.18, { type: 'triangle', gain: 0.22 }); tone(294, 0.18, 0.35, { type: 'triangle', gain: 0.22, to: 262 }); },
  score() { tone(660, 0, 0.12, { type: 'triangle', gain: 0.18 }); tone(990, 0.08, 0.2, { type: 'triangle', gain: 0.16 }); },
  big() { arp([523, 659, 784], 0.08, { type: 'triangle', gain: 0.2, dur: 0.3 }); },
  oneEighty() {
    arp([523, 659, 784, 1047, 1319], 0.09, { type: 'square', gain: 0.09, dur: 0.35 });
    arp([262, 330, 392, 523], 0.11, { type: 'triangle', gain: 0.18, dur: 0.5 });
    noise(0.1, 1.4, { freq: 1500, q: 0.4, gain: 0.12 });            // crowd-ish swell
  },
  checkout() { arp([784, 988, 1175, 1568], 0.08, { type: 'triangle', gain: 0.2, dur: 0.4 }); },
  leg() { arp([523, 659, 784, 1047], 0.12, { type: 'triangle', gain: 0.22, dur: 0.45 }); },
  match() {
    arp([523, 523, 523, 659, 784, 1047], 0.13, { type: 'square', gain: 0.08, dur: 0.4 });
    arp([262, 330, 392, 523], 0.2, { type: 'triangle', gain: 0.2, dur: 0.7 });
    noise(0.2, 2, { freq: 1500, q: 0.4, gain: 0.1 });
  },
  special() { arp([660, 880, 1100, 1320, 1760], 0.06, { type: 'triangle', gain: 0.18, dur: 0.3 }); },
  out() { tone(330, 0, 0.6, { type: 'sawtooth', gain: 0.12, to: 82 }); },
};

/** play('dart', d) | play('bust') | … ; respects the settings */
export function play(name, arg) {
  const st = getSettings();
  if (!st.sound) return;
  if (name === 'dart' ? !st.dartSounds : !st.eventSounds) return;
  if (!audio() || !SOUNDS[name]) return;
  try { SOUNDS[name](arg); } catch { /* audio glitches must never break the game */ }
}

// ------------------------------------------------------------------ caller
// 1st choice: the box's natural neural voice (Piper, served by the playroom: /api/say),
//             played through an "arena" chain – compressor, a bit louder/faster when hyped, hall reverb.
// fallback:   the browser's own speech synthesis.
let serverVoices = {};
export async function loadServerVoices() {
  try { serverVoices = await (await fetch('/api/voices', { cache: 'no-store' })).json(); } catch { serverVoices = {}; }
  return serverVoices;
}
export const hasNaturalVoice = (lang = getLang()) => !!serverVoices[lang];

export function voices() {
  return 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
}

function pickVoice() {
  const st = getSettings(), all = voices(), lang = getLang();
  const re = lang === 'de' ? /^de/i : /^en[-_]GB/i;
  const chosen = all.find((v) => v.name === st.voice);
  return (chosen && chosen.lang.toLowerCase().startsWith(lang) ? chosen : null)
    || all.find((v) => re.test(v.lang))
    || all.find((v) => v.lang.toLowerCase().startsWith(lang))
    || chosen || all[0] || null;
}

function browserSay(text, interrupt) {
  if (!('speechSynthesis' in window)) return;
  const st = getSettings();
  try {
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = getLang() === 'de' ? 'de-DE' : 'en-GB';
    u.rate = 1.05; u.pitch = 1.05;
    u.volume = Math.max(0, Math.min(1, +st.volume));
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

// --- natural voice playback
const clipCache = new Map();          // 'lang|style|text' -> Promise<AudioBuffer>
let voiceBus = null, reverbSend = null, queue = Promise.resolve(), generation = 0, playing = [];

function bus() {
  if (voiceBus) return voiceBus;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  voiceBus = ctx.createGain();
  voiceBus.gain.value = 1.15;
  voiceBus.connect(comp); comp.connect(master);
  // hall: decaying noise impulse
  const len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  const conv = ctx.createConvolver(); conv.buffer = ir;
  reverbSend = ctx.createGain(); reverbSend.gain.value = 0.18;
  reverbSend.connect(conv); conv.connect(comp);
  return voiceBus;
}

function clip(lang, part) {
  const key = `${lang}|${part.s}|${part.t}`;
  if (!clipCache.has(key)) {
    const url = `/api/say?lang=${lang}&style=${part.s}&text=${encodeURIComponent(part.t)}`;
    clipCache.set(key, fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => ctx.decodeAudioData(b)).catch((e) => { clipCache.delete(key); throw e; }));
    if (clipCache.size > 300) clipCache.delete(clipCache.keys().next().value);
  }
  return clipCache.get(key);
}

function playClip(buf, style) {
  return new Promise((resolve) => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = style === 'hype' ? 1.05 : 1.0;      // a touch faster and brighter when hyped
    g.gain.value = style === 'hype' ? 1.35 : 1.0;
    src.connect(g); g.connect(bus());
    if (style === 'hype') g.connect(reverbSend); else { const w = ctx.createGain(); w.gain.value = 0.4; g.connect(w); w.connect(reverbSend); }
    src.onended = () => { playing = playing.filter((x) => x !== src); resolve(); };
    playing.push(src);
    src.start();
  });
}

/** Speak caller parts [{t, s}]; interrupt = drop whatever is still queued. */
export function call(parts, { interrupt = true } = {}) {
  const st = getSettings();
  if (!st.sound || !st.caller || !parts || !parts.length) return;
  const lang = getLang();
  if (!st.naturalVoice || !hasNaturalVoice(lang) || !audio()) {
    browserSay(parts.map((p) => p.t).join(' '), interrupt);
    return;
  }
  if (interrupt) {
    generation++;
    playing.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    playing = [];
    queue = Promise.resolve();
  }
  const my = generation;
  const clips = parts.map((p) => clip(lang, p).catch(() => null));        // fetch in parallel
  queue = queue.then(async () => {
    for (let k = 0; k < parts.length; k++) {
      if (my !== generation) return;
      const buf = await clips[k];
      if (buf && my === generation) await playClip(buf, parts[k].s);
    }
  });
}

/** plain text (tests, fallback) */
export function say(text, opts) { call([{ t: text, s: 'hype' }], opts); }
