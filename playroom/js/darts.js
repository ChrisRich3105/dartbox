// Dart representation: {n, m}
//   n = 1..20, 25 = bull, 0 = miss
//   m = 1 single, 2 double, 3 treble, 0 miss   (outer bull = {25,1}, bull's eye = {25,2})

export const MISS = Object.freeze({ n: 0, m: 0 });

export const dart = (n, m) => (n === 0 || m === 0 ? { n: 0, m: 0 } : { n, m });
export const score = (d) => d.n * d.m;
export const isDouble = (d) => d.m === 2;          // includes bull's eye
export const isTreble = (d) => d.m === 3;
export const isMiss = (d) => !d.m;

export function label(d) {
  if (!d || !d.m) return 'Miss';
  if (d.n === 25) return d.m === 2 ? 'Bull' : '25';
  return (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.n;
}

/** Parse "T20", "D16", "S5", "5", "25", "Bull", "BULL", "50", "Miss", "0" -> dart */
export function parse(s) {
  s = String(s).trim().toUpperCase();
  if (s === 'MISS' || s === '0' || s === 'M') return { ...MISS };
  if (s === 'BULL' || s === 'DB' || s === '50' || s === 'BE') return { n: 25, m: 2 };
  if (s === '25' || s === 'SB' || s === 'OB') return { n: 25, m: 1 };
  const m = { S: 1, D: 2, T: 3 }[s[0]];
  const n = parseInt(m ? s.slice(1) : s, 10);
  if (!(n >= 1 && n <= 20)) throw new Error('bad dart ' + s);
  return { n, m: m || 1 };
}

// ------------------------------------------------------------ checkout suggestions
// Preference order for set-up darts and finishing darts.
const SETUP = [
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10].map((n) => ({ n, m: 3 })),
  { n: 25, m: 1 }, { n: 25, m: 2 },
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => ({ n, m: 1 })),
  ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => ({ n, m: 3 })),
  ...[20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1].map((n) => ({ n, m: 2 })),
];
const DOUBLE_PREF = [20, 16, 18, 12, 10, 8, 19, 17, 15, 14, 13, 11, 9, 7, 6, 5, 4, 3, 2, 1, 25];
const FINISH = {
  double: DOUBLE_PREF.map((n) => ({ n, m: 2 })),
  master: [...DOUBLE_PREF.map((n) => ({ n, m: 2 })), ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => ({ n, m: 3 }))],
  straight: [...SETUP],
};

const cache = new Map();

/**
 * Best finishing route for `rem` with at most `darts` darts.
 * outMode: 'double' | 'master' | 'straight'. Returns array of darts or null.
 */
export function checkout(rem, darts = 3, outMode = 'double') {
  const key = `${rem}|${darts}|${outMode}`;
  if (cache.has(key)) return cache.get(key);
  const finals = FINISH[outMode] || FINISH.double;
  let best = null, cost = Infinity;
  const consider = (route, c) => { if (c < cost) { cost = c; best = route; } };
  // fewest darts first, then preferred set-up / finishing darts
  finals.forEach((f, fi) => { if (score(f) === rem) consider([f], fi); });
  if (!best && darts >= 2) {
    SETUP.forEach((a, ai) => finals.forEach((f, fi) => {
      if (score(a) + score(f) === rem) consider([a, f], ai * 3 + fi);
    }));
  }
  if (!best && darts >= 3) {
    SETUP.forEach((a, ai) => {
      const r = rem - score(a);
      if (r <= 0) return;
      SETUP.forEach((b, bi) => {
        const r2 = r - score(b);
        if (r2 <= 0) return;
        finals.forEach((f, fi) => { if (score(f) === r2) consider([a, b, f], ai * 50 + bi * 3 + fi); });
      });
    });
  }
  cache.set(key, best);
  return best;
}

/** True if `rem` can be finished with one dart under outMode. */
export function oneDartFinish(rem, outMode = 'double') {
  if (outMode === 'straight') return (rem >= 1 && rem <= 20) || rem === 25 || rem === 50 || (rem <= 60 && (rem % 3 === 0 || (rem % 2 === 0 && rem <= 40)));
  if (outMode === 'master') return (rem <= 40 && rem % 2 === 0) || rem === 50 || (rem <= 60 && rem % 3 === 0);
  return (rem >= 2 && rem <= 40 && rem % 2 === 0) || rem === 50;
}

/** Checkout values that are possible with 3 darts and double out (2..170, excl. bogeys). */
export function finishable(rem, outMode = 'double') {
  return checkout(rem, 3, outMode) !== null;
}

export function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
