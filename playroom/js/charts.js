// Small SVG charts for results and statistics.
export const PLAYER_COLORS = ['#3ea6ff', '#ff9f0a', '#34c759', '#ff453a', '#bf5af2', '#64d2ff', '#ffd60a', '#ff375f'];

const escx = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Line chart: series = [{ name, values:[numbers], color }]. x = visit number.
 * Returns '' if there is nothing to draw.
 */
export function lineChart(series, { height = 180, label = '', xLabel = 'visits →' } = {}) {
  series = series.filter((s) => s.values && s.values.length > 1);
  if (!series.length) return '';
  const W = 640, H = height, L = 40, B = 22, T = 10, Rr = 10;
  const all = series.flatMap((s) => s.values);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (k) => L + (k * (W - L - Rr)) / Math.max(1, n - 1);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v));
  const grid = ticks.map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" class="c-grid"/><text x="${L - 6}" y="${y(v)}" class="c-tick" text-anchor="end" dominant-baseline="central">${v}</text>`).join('');
  const lines = series.map((s) => {
    const pts = s.values.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const last = s.values.length - 1;
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
      + `<circle cx="${x(last)}" cy="${y(s.values[last])}" r="4" fill="${s.color}"/>`;
  }).join('');
  const legend = series.map((s) => `<span><i style="background:${s.color}"></i>${escx(s.name)}</span>`).join('');
  return `<div class="chart"><div class="c-legend">${label ? `<b>${escx(label)}</b>` : ''}${legend}</div>
    <svg viewBox="0 0 ${W} ${H}" class="c-svg">${grid}
    <text x="${W - Rr}" y="${H - 4}" class="c-tick" text-anchor="end">${escx(xLabel)}</text>${lines}</svg></div>`;
}
