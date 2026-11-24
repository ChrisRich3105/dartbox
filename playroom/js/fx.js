// On-screen celebrations (180, checkout, bust, wins), confetti and animated numbers.
import { getSettings } from './settings.js';

let hideTimer = null;

/** Big centred message. Returns false if effects are switched off (caller may fall back to a toast). */
export function celebrate(text, kind = 'great', { sub = '', confetti = false, ms = 1900 } = {}) {
  const st = getSettings();
  if (!st.effects) return false;
  let el = document.getElementById('fx');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx';
    document.body.appendChild(el);
  }
  el.className = '';
  el.innerHTML = `<div class="fx-big"></div><div class="fx-sub"></div>`;
  el.querySelector('.fx-big').textContent = text;
  el.querySelector('.fx-sub').textContent = sub;
  void el.offsetWidth;                                  // restart the CSS animation
  el.className = `show ${kind} ${st.animations ? 'anim' : ''}`;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { el.className = ''; }, ms);
  if (confetti && st.confetti && st.animations) burst();
  return true;
}

// ------------------------------------------------------------------ confetti
const COLORS = ['#ffd60a', '#3ea6ff', '#34c759', '#ff453a', '#bf5af2', '#ff9f0a', '#ffffff'];

export function burst(count = 160) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const g = c.getContext('2d');
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 4,
    s: 5 + Math.random() * 7,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const t0 = performance.now();
  (function frame(t) {
    const age = t - t0;
    g.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r);
      g.globalAlpha = Math.max(0, 1 - age / 2800);
      g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    if (age < 2800) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

// ------------------------------------------------------------------ numbers
/** Animate the text of `el` from one integer to another. */
export function tween(el, from, to, ms = 420) {
  if (!getSettings().animations || from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  (function frame(t) {
    const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3;
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(frame);
  })(t0);
}
