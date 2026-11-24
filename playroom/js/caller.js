// What the caller says. Every call is a list of parts {t: text, s: 'calm' | 'hype', name?: true};
// parts are spoken one after another (names are separate parts so everything else can be cached).
import { getLang } from './i18n.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const P = (t, s = 'calm') => ({ t, s });
const N = (name, s = 'calm') => ({ t: name, s, name: true });

// variants (also rendered in advance on the box)
const V = {
  en: { great: ['Great darts!', 'Superb!', 'Lovely darts!'], bust: ['No score!', 'Bust!'], checkout: ['Checkout!', 'What a finish!'] },
  de: { great: ['Stark!', 'Klasse Darts!', 'Wahnsinn!'], bust: ['Überworfen!', 'Leider überworfen!'], checkout: ['Ausgecheckt!', 'Was für ein Finish!'] },
};

const PHRASES = {
  en: {
    score(n) {
      if (n === 0) return [P('No score!')];
      if (n === 26) return [P('Twenty six – bed and breakfast!')];
      if (n >= 100) {
        const parts = [P(`${n}!`, 'hype')];
        if (n >= 140 && Math.random() < 0.5) parts.push(P(pick(V.en.great), 'hype'));
        return parts;
      }
      return [P(String(n))];
    },
    oneEighty: () => [P('One hundred and eighty!', 'hype')],
    bust: () => [P(pick(V.en.bust))],
    require: (name, n) => [N(name), P(`You require ${n}.`)],
    checkout: () => [P(pick(V.en.checkout), 'hype')],
    leg: (name, x01) => (x01 ? [P('Game shot, and the leg!', 'hype')] : [P('Leg to', 'hype'), N(name, 'hype')]),
    match: (name, x01, training) => (training ? [P('Well done!', 'hype')]
      : x01 ? [P('Game shot, and the match!', 'hype'), N(name, 'hype')] : [N(name, 'hype'), P('wins the match!', 'hype')]),
    shanghai: () => [P('Shanghai!', 'hype')],
    killer: (name) => [N(name, 'hype'), P('is a killer!', 'hype')],
    whitehorse: () => [P('White horse!', 'hype')],
    out: (name) => [N(name), P('is out.')],
  },
  de: {
    score(n) {
      if (n === 0) return [P('Keine Punkte!')];
      if (n >= 100) {
        const parts = [P(`${n}!`, 'hype')];
        if (n >= 140 && Math.random() < 0.5) parts.push(P(pick(V.de.great), 'hype'));
        return parts;
      }
      return [P(String(n))];
    },
    oneEighty: () => [P('Hundertachtzig!', 'hype')],
    bust: () => [P(pick(V.de.bust))],
    require: (name, n) => [N(name), P(`Du brauchst ${n}.`)],
    checkout: () => [P(pick(V.de.checkout), 'hype')],
    leg: (name) => [N(name, 'hype'), P('gewinnt das Leg!', 'hype')],
    match: (name, x01, training) => (training ? [P('Gut gemacht!', 'hype')]
      : [N(name, 'hype'), P('gewinnt das Match! Glückwunsch!', 'hype')]),
    shanghai: () => [P('Shanghai!', 'hype')],
    killer: (name) => [N(name, 'hype'), P('ist ein Killer!', 'hype')],
    whitehorse: () => [P('White Horse!', 'hype')],
    out: (name) => [N(name), P('ist raus.')],
  },
};

/** callerParts('score', 140) / callerParts('require', 'Anna', 32) … in the current language */
export function callerParts(kind, ...args) {
  const table = PHRASES[getLang()] || PHRASES.en;
  return table[kind] ? table[kind](...args) : [];
}

/** every fixed phrase (no names) – the box renders these once in the background so calls are instant */
export function prewarmList(lang) {
  const T = PHRASES[lang] || PHRASES.en, out = [], seen = new Set();
  const add = (parts) => parts.filter((p) => !p.name).forEach((p) => {
    const k = p.s + '|' + p.t;
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  });
  const real = Math.random;
  try {
    Math.random = () => 0.99;                                  // score() without the random extra
    for (let n = 0; n <= 180; n++) add(T.score(n));
  } finally { Math.random = real; }
  const v = V[lang] || V.en;
  add(v.great.map((t) => P(t, 'hype'))); add(v.bust.map((t) => P(t))); add(v.checkout.map((t) => P(t, 'hype')));
  for (let n = 2; n <= 170; n++) add(T.require('x', n));
  ['oneEighty', 'shanghai', 'whitehorse'].forEach((k) => add(T[k]()));
  add(T.leg('x', true)); add(T.leg('x', false)); add(T.match('x', true, false)); add(T.match('x', false, false)); add(T.match('x', false, true));
  add(T.killer('x')); add(T.out('x'));
  return out;
}
