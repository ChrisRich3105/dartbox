// Line charts for results and statistics.
//
// lineChart() returns a placeholder; the chart is drawn at the real pixel width of its
// container (no stretched SVG, crisp text, round dots), redrawn on resize, and gets a
// crosshair tooltip (pointer + arrow keys) and a table view.
import { t, getLang } from './i18n.js';

// Categorical hues for dark surfaces, fixed order (validated: adjacent CVD ΔE >= 8).
// Slot = player position; colours are never cycled – a chart shows at most 8 series.
export const PLAYER_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
const MAX_SERIES = PLAYER_COLORS.length;

const H = 180;                       // plot + x-axis band, px
const PAD = { top: 12, bottom: 24, right: 14 };
const specs = new Map();
let nextId = 1;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmt(v, decimals, fixed = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return v.toLocaleString(getLang() === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: fixed ? decimals : 0 });
}

/** "nice" axis: round step (1, 2, 2.5, 5 × 10^k) and a domain that contains all values */
function niceScale(lo, hi, target = 4) {
  if (lo === hi) { const d = Math.abs(lo) * 0.1 || 1; lo -= d; hi += d; }
  if (lo >= 0 && lo < hi * 0.35) lo = 0;                 // close to zero: start honestly at zero
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { min, max, ticks, step };
}

/**
 * series:  [{ name, values: [number|null], color }]   (index = x position)
 * options: label    – chart title (also names a single series, so no legend then)
 *          xLabels  – label per x index (e.g. dates); default 1, 2, 3 …
 *          xTitle   – short axis title shown bottom right (e.g. "Aufnahmen")
 *          decimals – digits for values (default 1)
 * Returns '' if there is nothing to draw.
 */
export function lineChart(series, { label = '', xLabels = null, xTitle = '', decimals = 1 } = {}) {
  series = series.slice(0, MAX_SERIES).filter((s) => s.values && s.values.some((v) => v !== null && v !== undefined));
  if (!series.length) return '';
  const n = Math.max(...series.map((s) => s.values.length));
  const id = 'c' + nextId++;
  specs.set(id, { series, label, xLabels: xLabels || Array.from({ length: n }, (_, k) => String(k + 1)), xTitle, decimals, n });
  const legend = series.length > 1
    ? `<div class="c-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  const table = `<details class="c-table"><summary>${t('Show values')}</summary><div class="c-tablewrap"><table>
    <tr><th></th>${series.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr>
    ${Array.from({ length: n }, (_, k) => `<tr><td>${esc(specs.get(id).xLabels[k])}</td>${series.map((s) => `<td>${fmt(s.values[k], decimals)}</td>`).join('')}</tr>`).join('')}
  </table></div></details>`;
  return `<div class="chart" data-cid="${id}">
    ${label ? `<div class="c-title">${esc(label)}</div>` : ''}${legend}
    <div class="c-plot" style="height:${H}px"></div>
    <div class="c-foot">${table}${xTitle ? `<span class="c-axis-title">${esc(xTitle)} →</span>` : ''}</div></div>`;
}

function draw(el) {
  const spec = specs.get(el.dataset.cid);
  const plot = el.querySelector('.c-plot');
  if (!spec || !plot) return;
  const W = Math.round(plot.clientWidth);
  if (W < 50) return;
  const { series, xLabels, decimals, n } = spec;
  const all = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
  const sc = niceScale(Math.min(...all), Math.max(...all));
  const tickDec = sc.step >= 1 ? 0 : sc.step >= 0.1 && Number.isInteger(+(sc.step * 10).toFixed(6)) ? 1 : 2;
  const tickText = sc.ticks.map((v) => fmt(v, tickDec, true));   // same digits on every tick
  const left = 10 + Math.max(...tickText.map((s) => s.length)) * 7;
  const single = series.length === 1;
  const endLabelW = single ? 8 + fmt(series[0].values.filter((v) => v != null).at(-1), decimals).length * 7.5 : 0;
  const L = left, R = W - PAD.right - endLabelW, T = PAD.top, B = H - PAD.bottom;
  const x = (k) => (n === 1 ? (L + R) / 2 : L + (k * (R - L)) / (n - 1));
  const y = (v) => B - ((v - sc.min) / (sc.max - sc.min)) * (B - T);

  // y grid + ticks (solid hairlines), x labels: first, last and evenly spaced ones that fit
  let svg = sc.ticks.map((v, i) => `<line x1="${L}" x2="${R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="${i === 0 ? 'c-base' : 'c-grid'}"/>`
    + `<text x="${L - 8}" y="${y(v).toFixed(1)}" class="c-tick" text-anchor="end" dominant-baseline="central">${tickText[i]}</text>`).join('');
  const maxLabels = Math.max(2, Math.floor((R - L) / 64));
  const every = Math.max(1, Math.ceil(n / maxLabels));
  const shown = new Set([0, n - 1]);
  for (let k = 0; k < n; k += every) if (n - 1 - k >= every || k === 0) shown.add(k);
  for (const k of shown) {
    const anchor = n === 1 ? 'middle' : k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle';
    svg += `<text x="${x(k).toFixed(1)}" y="${B + 17}" class="c-tick" text-anchor="${anchor}">${esc(xLabels[k])}</text>`;
  }

  const dots = n <= 24;
  for (const s of series) {
    // break the line at missing values
    let seg = [];
    const segs = [];
    s.values.forEach((v, k) => { if (v === null || v === undefined) { if (seg.length) segs.push(seg); seg = []; } else seg.push([x(k), y(v)]); });
    if (seg.length) segs.push(seg);
    for (const p of segs) {
      if (p.length > 1) svg += `<polyline points="${p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    const lastK = s.values.map((v, k) => (v === null || v === undefined ? -1 : k)).filter((k) => k >= 0).at(-1);
    s.values.forEach((v, k) => {
      if (v === null || v === undefined || (!dots && k !== lastK)) return;
      svg += `<circle cx="${x(k).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${k === lastK ? 4.5 : 3.5}" fill="${s.color}" class="c-dot"/>`;
    });
    if (single) {
      svg += `<text x="${(x(lastK) + 9).toFixed(1)}" y="${y(s.values[lastK]).toFixed(1)}" class="c-end" dominant-baseline="central">${fmt(s.values[lastK], decimals)}</text>`;
    }
  }
  svg += `<line class="c-cross" x1="0" x2="0" y1="${T}" y2="${B}" visibility="hidden"/>`;

  plot.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="c-svg" tabindex="0" role="img"
    aria-label="${esc(spec.label || t('Chart'))}">${svg}</svg><div class="c-tip" hidden></div>`;

  // ---- hover / keyboard readout
  const svgEl = plot.querySelector('svg'), cross = svgEl.querySelector('.c-cross'), tip = plot.querySelector('.c-tip');
  let cur = -1;
  const show = (k) => {
    cur = Math.max(0, Math.min(n - 1, k));
    const cx = x(cur);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    tip.replaceChildren();
    const head = document.createElement('div'); head.className = 'c-tip-h'; head.textContent = xLabels[cur]; tip.append(head);
    for (const s of series) {
      const row = document.createElement('div'); row.className = 'c-tip-r';
      const key = document.createElement('i'); key.style.background = s.color;
      const val = document.createElement('b'); val.textContent = fmt(s.values[cur], decimals);
      row.append(key, val);
      if (!single) { const nm = document.createElement('span'); nm.textContent = s.name; row.append(nm); }
      tip.append(row);
    }
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(W - tw, cx + (cx + 12 + tw > W ? -12 - tw : 12)))}px`;
  };
  const hide = () => { cur = -1; cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  svgEl.addEventListener('pointermove', (e) => {
    const r = svgEl.getBoundingClientRect();
    const px = ((e.clientX - r.left) * W) / r.width;
    show(n === 1 ? 0 : Math.round(((px - L) / (R - L)) * (n - 1)));
  });
  svgEl.addEventListener('pointerleave', hide);
  svgEl.addEventListener('blur', hide);
  svgEl.addEventListener('focus', () => show(n - 1));
  svgEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show((cur < 0 ? n - 1 : cur) + (e.key === 'ArrowLeft' ? -1 : 1)); }
    if (e.key === 'Escape') hide();
  });
}

// Charts are inserted via innerHTML anywhere in the app: draw them when they appear,
// redraw when their width changes.
const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
  for (const e of entries) { const el = e.target.closest('.chart'); if (el) draw(el); }
}) : null;
function hydrate(root) {
  root.querySelectorAll?.('.chart[data-cid]:not([data-drawn])').forEach((el) => {
    el.dataset.drawn = '1';
    draw(el);
    if (ro) ro.observe(el.querySelector('.c-plot'));
  });
}
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver((muts) => { for (const m of muts) for (const nd of m.addedNodes) if (nd.nodeType === 1) hydrate(nd.matches?.('.chart') ? nd.parentNode : nd); })
    .observe(document.documentElement, { childList: true, subtree: true });
}
