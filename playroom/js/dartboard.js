// SVG dartboard: shows the darts of a visit, what to aim for, or a heat map.
//
//   boardSVG({ hits: [{n,m}…], targets: [{n,m}|{any:'D'|'T'}…], heat: {'T20': 12, …}, animate, small })
//
// Geometry follows the real board (mm): bull 6.35, 25-ring 15.9, treble 99–107, double 162–170.
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const R = { bull: 6.35, ob: 15.9, t1: 99, t2: 107, d1: 162, d2: 170, num: 192 };
const BEDS = {                     // [inner, outer] radius per bed
  si: [R.ob, R.t1], t: [R.t1, R.t2], so: [R.t2, R.d1], d: [R.d1, R.d2],
};

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [+(r * Math.cos(rad(deg))).toFixed(2), +(r * Math.sin(rad(deg))).toFixed(2)];
const segAngle = (n) => -90 + ORDER.indexOf(n) * 18;

function sector(r1, r2, a1, a2) {
  const [x1, y1] = pt(r1, a1), [x2, y2] = pt(r2, a1), [x3, y3] = pt(r2, a2), [x4, y4] = pt(r1, a2);
  return `M${x1} ${y1}L${x2} ${y2}A${r2} ${r2} 0 0 1 ${x3} ${y3}L${x4} ${y4}A${r1} ${r1} 0 0 0 ${x1} ${y1}Z`;
}

/** list of [bed, n] areas a target spec covers */
function areas(t) {
  if (t.any === 'D') return [...ORDER.map((n) => ['d', n]), ['bull', 25]];
  if (t.any === 'T') return ORDER.map((n) => ['t', n]);
  if (t.n === 25) return t.m === 1 ? [['ob', 25]] : t.m === 2 ? [['bull', 25]] : [['ob', 25], ['bull', 25]];
  if (!t.n) return [];
  return { 1: [['si', t.n], ['so', t.n]], 2: [['d', t.n]], 3: [['t', t.n]] }[t.m] || [['si', t.n], ['t', t.n], ['so', t.n], ['d', t.n]];
}

function areaPath(bed, n) {
  if (bed === 'bull') return `M${R.bull} 0A${R.bull} ${R.bull} 0 1 1 ${-R.bull} 0A${R.bull} ${R.bull} 0 1 1 ${R.bull} 0Z`;
  if (bed === 'ob') return `M${R.ob} 0A${R.ob} ${R.ob} 0 1 1 ${-R.ob} 0A${R.ob} ${R.ob} 0 1 1 ${R.ob} 0Z`
    + `M${R.bull} 0A${R.bull} ${R.bull} 0 1 0 ${-R.bull} 0A${R.bull} ${R.bull} 0 1 0 ${R.bull} 0Z`;
  const a = segAngle(n), [r1, r2] = BEDS[bed];
  return sector(r1, r2, a - 9, a + 9);
}

/** where to draw a dart marker for dart d (k = 0..2 spreads darts in the same bed) */
function markerPos(d, k) {
  const jitter = [-4.5, 0, 4.5][k % 3];
  if (!d || !d.m) return pt(R.d2 + 12, 100 + k * 25);                  // misses: just outside the board, bottom left
  if (d.n === 25) return d.m === 2 ? pt(3 + k * 1.5, k * 120) : pt(11, 30 + k * 120);
  const a = segAngle(d.n) + jitter;
  const r = d.m === 2 ? (R.d1 + R.d2) / 2 : d.m === 3 ? (R.t1 + R.t2) / 2 : (k % 2 ? 60 : 134);
  return pt(r, a);
}

const heatKey = (bed, n) => (bed === 'bull' ? 'Bull' : bed === 'ob' ? '25' : (bed === 'd' ? 'D' : bed === 't' ? 'T' : 'S') + n);

export function boardSVG({ hits = [], targets = [], heat = null, animate = false, small = false } = {}) {
  const parts = [];
  // base board
  parts.push(`<circle r="${R.num + 18}" class="b-frame"/>`);
  ORDER.forEach((n, k) => {
    const dark = k % 2 === 0;
    for (const bed of ['si', 't', 'so', 'd']) {
      const cls = bed === 'si' || bed === 'so' ? (dark ? 'b-dark' : 'b-light') : (dark ? 'b-red' : 'b-green');
      parts.push(`<path d="${areaPath(bed, n)}" class="${cls}"/>`);
    }
    const [x, y] = pt(R.num, segAngle(n));
    if (!small) parts.push(`<text x="${x}" y="${y}" class="b-num" dominant-baseline="central" text-anchor="middle">${n}</text>`);
  });
  parts.push(`<path d="${areaPath('ob')}" class="b-green"/><path d="${areaPath('bull')}" class="b-red"/>`);
  parts.push(`<circle r="${R.d2}" class="b-wire"/>`);

  // heat map
  if (heat) {
    const singles = {};
    for (const [k, v] of Object.entries(heat)) singles[k] = v;
    const max = Math.max(1, ...Object.entries(singles).filter(([k]) => k !== 'Miss').map(([, v]) => v));
    const cells = [];
    ORDER.forEach((n) => ['si', 't', 'so', 'd'].forEach((bed) => cells.push([bed, n])));
    cells.push(['ob', 25], ['bull', 25]);
    for (const [bed, n] of cells) {
      let v = singles[heatKey(bed, n)] || 0;
      if (bed === 'si' || bed === 'so') v /= 2;                            // singles counted once for both areas
      if (!v) continue;
      const a = Math.min(0.85, 0.15 + 0.75 * (v / max));
      parts.push(`<path d="${areaPath(bed, n)}" class="b-heat" style="fill-opacity:${a.toFixed(2)}"><title>${heatKey(bed, n)}: ${Math.round(bed === 'si' || bed === 'so' ? v * 2 : v)}</title></path>`);
    }
  }

  // targets
  for (const t of targets) for (const [bed, n] of areas(t)) parts.push(`<path d="${areaPath(bed, n)}" class="b-target"/>`);

  // darts of the visit
  hits.forEach((d, k) => {
    const [x, y] = markerPos(d, k);
    const last = animate && k === hits.length - 1;
    parts.push(`<g class="b-dart ${last ? 'pop' : ''}" transform="translate(${x} ${y})"><circle r="9"/><text dominant-baseline="central" text-anchor="middle">${k + 1}</text></g>`);
  });

  const vb = R.num + 20;
  return `<svg class="dartboard ${small ? 'small' : ''}" viewBox="${-vb} ${-vb} ${2 * vb} ${2 * vb}" role="img" aria-label="Dartboard">${parts.join('')}</svg>`;
}
