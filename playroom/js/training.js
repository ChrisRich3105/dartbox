// Training modes. They use the same engine as the games (so 1–4 players can
// practise taking turns) and store detailed stats for the statistics page.
import { Game } from './engine.js';
import { X01, AroundTheClock } from './games.js';
import { score, label, parse, checkout, shuffle } from './darts.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const opts = (vals) => vals.map((v) => [v, String(v)]);
const fill = (n, v) => Array.from({ length: n }, () => (typeof v === 'function' ? v() : v));
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const dlabel = (t) => (t === 25 ? 'Bull' : 'D' + t);

/** shared: mark player i as finished; end the session when everybody is done */
function finish(game, i, text) {
  game.s.out[i] = true;
  if (i === game.cur) game.closeVisit(text, 'info');
  if (game.aliveCount() === 0) game.winLeg(game.bestBy((j) => game.standing(j)), 'Session complete');
}

// ======================================================================= Bob's 27
export class Bobs27 extends Game {
  static id = 'bobs27';
  static title = "Bob's 27";
  static desc = 'Start with 27. Three darts at each double: every hit adds the double, no hit subtracts it.';
  static stype = 'bobs27';
  static training = true;
  static maxPlayers = 4;
  static settings = [
    { key: 'bull', label: 'Include bull at the end', options: [[true, 'Yes'], [false, 'No']], default: true },
    { key: 'stop', label: 'Below zero', options: [[true, 'Game over'], [false, 'Keep playing']], default: true },
  ];

  initStats() { return { darts: 0, hits: 0, per: {} }; }
  get targetList() { return [...range(1, 20), ...(String(this.cfg.bull) === 'true' ? [25] : [])]; }
  initLeg() { this.g.score = fill(this.n, 27); this.g.reached = fill(this.n, 0); }
  target() { return this.targetList[Math.min(this.s.round, this.targetList.length) - 1]; }
  onVisitStart() { this.g.vhits = 0; }

  onDart(d, i) {
    const t = this.target();
    if (d.n === t && d.m === 2) { this.g.vhits++; this.g.score[i] += 2 * t; this.emit('hit', { i }); }
  }

  onVisitEnd(i) {
    const g = this.g, p = this.s.ps[i], t = this.target();
    p.darts += 3; p.hits += g.vhits;
    const e = p.per[t] || (p.per[t] = [0, 0]);
    e[0] += g.vhits; e[1] += 3;
    g.reached[i] = t;
    if (!g.vhits) {
      g.score[i] -= 2 * t;
      this.emit('fail', { i });
      if (g.score[i] < 0 && String(this.cfg.stop) === 'true') { this.msg(`${this.name(i)} drops below zero – game over`, 'bad'); this.emit('out', { i }); finish(this, i); }
    }
  }

  maxRounds() { return this.targetList.length; }
  standing(i) { return this.g.score[i]; }
  traceValue(i) { return this.g.score[i]; }
  targets() { return this.s.legWinner === null ? [{ n: this.target(), m: 2 }] : []; }
  hint() { return this.s.legWinner === null ? `Target: ${dlabel(this.target())}` : ''; }
  view() {
    return {
      info: this.infoLine(), hint: this.hint(),
      cols: this.s.players.map((_, i) => this.col(i, this.g.score[i],
        [`Hits ${this.s.ps[i].hits}/${this.s.ps[i].darts}`, this.s.out[i] ? 'game over' : ''])),
    };
  }
  summary(i) {
    const p = this.s.ps[i];
    return { score: this.g.score[i], darts: p.darts, hits: p.hits, hitPct: pct(p.hits, p.darts), per: p.per,
      completed: !this.s.out[i], reached: this.g.reached[i] };
  }
}

// ======================================================================= Doubles practice
export class Doubles extends Game {
  static id = 'doubles';
  static title = 'Doubles practice';
  static desc = 'Work through the doubles and see which ones are your strong and weak ones.';
  static stype = 'doubles';
  static training = true;
  static maxPlayers = 4;
  static settings = [
    { key: 'order', label: 'Order', options: [['asc', 'D1 → D20'], ['random', 'Random'], ['favs', 'Favourites: D20 D16 D8 D10 D12 D18 Bull']], default: 'asc' },
    { key: 'bull', label: 'Include bull', options: [[true, 'Yes'], [false, 'No']], default: true },
    { key: 'per', label: 'Darts per double', options: [[3, '3 darts'], [6, '6 darts'], [9, '9 darts'], ['hit', 'Until hit (max 9)']], default: 3 },
  ];

  initStats() { return { darts: 0, hits: 0, per: {} }; }

  initLeg() {
    const g = this.g;
    let seq = this.cfg.order === 'favs' ? [20, 16, 8, 10, 12, 18] : range(1, 20);
    if (this.cfg.order === 'random') seq = shuffle(seq);
    if (String(this.cfg.bull) === 'true') seq.push(25);
    g.seq = seq;
    g.pos = fill(this.n, 0);
    g.tDarts = fill(this.n, 0);
  }

  target(i) { return this.g.seq[this.g.pos[i]]; }

  onDart(d, i) {
    const g = this.g, p = this.s.ps[i], t = this.target(i);
    const hit = d.n === t && d.m === 2;
    p.darts++; if (hit) { p.hits++; this.emit('hit', { i }); }
    const e = p.per[t] || (p.per[t] = [0, 0]);
    e[1]++; if (hit) e[0]++;
    g.tDarts[i]++;
    const limit = this.cfg.per === 'hit' ? 9 : +this.cfg.per;
    if ((this.cfg.per === 'hit' && hit) || g.tDarts[i] >= limit) {
      g.pos[i]++; g.tDarts[i] = 0;
      if (g.pos[i] >= g.seq.length) finish(this, i, 'All doubles done');
    }
  }

  standing(i) { return this.s.ps[i].hits * 1000 - this.s.ps[i].darts; }
  traceValue(i) { const p = this.s.ps[i]; return p.darts ? Math.round((p.hits / p.darts) * 100) : null; }
  targets() { const t = this.target(this.cur); return t !== undefined && this.s.legWinner === null ? [{ n: t, m: 2 }] : []; }
  hint() { const t = this.target(this.cur); return t !== undefined && this.s.legWinner === null ? `Target: ${dlabel(t)}` : ''; }
  view() {
    return {
      info: `${this.cfg.per === 'hit' ? 'until hit' : this.cfg.per + ' darts'} per double`, hint: this.hint(),
      cols: this.s.players.map((_, i) => {
        const p = this.s.ps[i], t = this.target(i);
        return this.col(i, t === undefined ? '✓' : dlabel(t), [`${p.hits}/${p.darts} · ${pct(p.hits, p.darts)}%`]);
      }),
    };
  }
  summary(i) { const p = this.s.ps[i]; return { darts: p.darts, hits: p.hits, hitPct: pct(p.hits, p.darts), per: p.per }; }
}

// ======================================================================= Checkout practice
const CO_RANGES = { '2-40': [2, 40], '41-80': [41, 80], '61-100': [61, 100], '81-120': [81, 120], '101-170': [101, 170], '2-170': [2, 170] };

export class CheckoutPractice extends Game {
  static id = 'checkout';
  static title = 'Checkout practice';
  static desc = 'Random finishes from a range you choose – check out within the dart limit.';
  static stype = 'checkout';
  static training = true;
  static maxPlayers = 4;
  static settings = [
    { key: 'range', label: 'Finishes', options: Object.keys(CO_RANGES).map((k) => [k, k]), default: '41-80' },
    { key: 'attempts', label: 'Number of finishes', options: opts([5, 10, 15, 20, 30]), default: 10 },
    { key: 'limit', label: 'Darts per finish', options: [[3, '3 (one visit)'], [6, '6 (two visits)'], [9, '9 (three visits)']], default: 3 },
    { key: 'outMode', label: 'Check-out', options: [['double', 'Double out'], ['master', 'Master out'], ['straight', 'Straight out']], default: 'double' },
  ];

  initStats() { return { attempts: 0, success: 0, darts: 0, successDarts: 0, results: [] }; }

  initLeg() {
    const g = this.g, [a, b] = CO_RANGES[this.cfg.range] || [41, 80];
    const pool = range(a, b).filter((v) => checkout(v, 3, this.cfg.outMode));
    g.seq = Array.from({ length: +this.cfg.attempts }, () => pool[Math.floor(Math.random() * pool.length)]);
    g.idx = fill(this.n, 0);
    g.rem = g.seq.length ? fill(this.n, g.seq[0]) : fill(this.n, 0);
    g.used = fill(this.n, 0);
  }

  onVisitStart(i) { this.g.vs = this.g.rem[i]; }
  outOk(d) { return this.cfg.outMode === 'straight' || (this.cfg.outMode === 'double' ? d.m === 2 : d.m >= 2); }

  advance(i, ok) {
    const g = this.g, p = this.s.ps[i];
    p.attempts++; p.darts += g.used[i];
    if (ok) { p.success++; p.successDarts += g.used[i]; }
    p.results.push([g.seq[g.idx[i]], ok ? g.used[i] : 0]);
    this.emit(ok ? 'checkout' : 'fail', { i, value: g.seq[g.idx[i]] });
    g.idx[i]++; g.used[i] = 0;
    if (g.idx[i] >= g.seq.length) { finish(this, i, ok ? 'Checked out – session complete' : 'Session complete'); return; }
    g.rem[i] = g.seq[g.idx[i]];
    this.closeVisit(ok ? 'Checked out!' : 'Not this time', ok ? 'great' : 'bad');
  }

  onDart(d, i) {
    const g = this.g, limit = +this.cfg.limit;
    g.used[i]++;
    const r = g.rem[i] - score(d);
    if (r < 0 || (r === 0 && !this.outOk(d)) || (r === 1 && this.cfg.outMode !== 'straight')) {
      g.used[i] += 3 - this.s.visit.length;                   // bust burns the visit
      g.rem[i] = g.vs;
      this.emit('bust', { i });
      if (g.used[i] >= limit) this.advance(i, false); else this.closeVisit('Bust!');
      return;
    }
    g.rem[i] = r;
    if (r === 0) this.advance(i, true);
    else if (g.used[i] >= limit) { g.rem[i] = g.seq[g.idx[i]]; this.advance(i, false); }
  }

  standing(i) { return this.s.ps[i].success * 1000 - this.s.ps[i].darts; }
  traceValue(i) { return this.s.ps[i].success; }

  targets() {
    const g = this.g, i = this.cur;
    if (this.s.legWinner !== null || g.idx[i] >= g.seq.length) return [];
    const left = Math.min(3 - this.s.visit.length, +this.cfg.limit - g.used[i]);
    const r = left > 0 ? checkout(g.rem[i], left, this.cfg.outMode) : null;
    return r ? r.map((d) => ({ n: d.n, m: d.m })) : [];
  }

  hint() {
    const g = this.g, i = this.cur;
    if (this.s.legWinner !== null || g.idx[i] >= g.seq.length) return '';
    const left = Math.min(3 - this.s.visit.length, +this.cfg.limit - g.used[i]);
    const route = left > 0 ? checkout(g.rem[i], left, this.cfg.outMode) : null;
    return route ? route.map(label).join(' · ') : '';
  }

  view() {
    const g = this.g;
    return {
      info: `${this.cfg.range} · ${this.cfg.limit} darts each`, hint: this.hint(),
      cols: this.s.players.map((_, i) => {
        const p = this.s.ps[i];
        return this.col(i, g.idx[i] >= g.seq.length ? '✓' : g.rem[i],
          [`Finish ${Math.min(g.idx[i] + 1, g.seq.length)}/${g.seq.length}`, `Success ${p.success}/${p.attempts}`, `Darts left ${+this.cfg.limit - g.used[i]}`]);
      }),
    };
  }

  summary(i) {
    const p = this.s.ps[i];
    return { ...p, successPct: pct(p.success, p.attempts), avgDarts: p.success ? Math.round((p.successDarts / p.success) * 10) / 10 : 0, range: this.cfg.range };
  }
}

// ======================================================================= Target / scoring practice
export class TargetPractice extends Game {
  static id = 'target';
  static title = 'Target practice';
  static desc = 'A fixed number of darts at one target (T20, T19, bull, …) – accuracy and scoring power.';
  static stype = 'target';
  static training = true;
  static maxPlayers = 4;
  static settings = [
    { key: 'target', label: 'Target', options: ['T20', 'T19', 'T18', 'T17', 'T16', 'T15', 'Bull', '25', 'D20', 'D16', 'D8', 'S20', 'S19'].map((v) => [v, v]), default: 'T20' },
    { key: 'darts', label: 'Darts', options: opts([30, 45, 60, 90, 99, 150]), default: 60 },
  ];

  initStats() { return { darts: 0, exact: 0, number: 0, points: 0 }; }
  initLeg() { this.g.t = parse(this.cfg.target); }

  onDart(d, i) {
    const p = this.s.ps[i], t = this.g.t;
    p.darts++; p.points += score(d);
    if (d.n === t.n && d.m === t.m) { p.exact++; this.emit('hit', { i }); }
    if (d.n === t.n && d.m) p.number++;
    if (p.darts >= +this.cfg.darts) finish(this, i, 'Done');
  }

  standing(i) { return this.s.ps[i].exact * 10000 + this.s.ps[i].points; }
  traceValue(i) { const p = this.s.ps[i]; return p.darts ? Math.round((p.exact / p.darts) * 100) : null; }
  targets() { return this.s.legWinner === null ? [{ n: this.g.t.n, m: this.g.t.m }] : []; }
  hint() { return this.s.legWinner === null ? `Target: ${this.cfg.target}` : ''; }
  view() {
    return {
      info: `${this.cfg.darts} darts at ${this.cfg.target}`, hint: this.hint(),
      cols: this.s.players.map((_, i) => {
        const p = this.s.ps[i];
        return this.col(i, `${pct(p.exact, p.darts)}%`, [`${p.exact}/${p.darts} ${this.cfg.target}`, `${p.darts}/${this.cfg.darts} darts`, `⌀ ${p.darts ? (p.points / p.darts * 3).toFixed(1) : '0.0'} / visit`]);
      }),
    };
  }
  summary(i) {
    const p = this.s.ps[i];
    return { ...p, exactPct: pct(p.exact, p.darts), numberPct: pct(p.number, p.darts),
      ppv: p.darts ? Math.round((p.points / p.darts) * 300) / 100 : 0, target: this.cfg.target };
  }
}

// ======================================================================= re-used games as training
export class AtcTraining extends AroundTheClock {
  static id = 'atc-training';
  static title = 'Around the Clock';
  static desc = 'Go round the board as fast as you can – fewer darts is better.';
  static training = true;
  static maxPlayers = 4;
  static settings = AroundTheClock.settings.filter((s) => s.key !== 'legs');
  // In training every player plays until done instead of first-past-the-post
  onDart(d, i) {
    const g = this.g, t = this.target(i);
    if (!this.matches(d, t)) return;
    this.s.ps[i].hits++;
    this.emit('hit', { i });
    const adv = String(this.cfg.skip) === 'true' && this.cfg.hit === 'any' && t !== 25 ? d.m : 1;
    let np = g.pos[i] + adv;
    const last = g.seq.length - 1;
    if (g.seq[last] === 25 && t !== 25 && np > last) np = last;
    g.pos[i] = Math.min(np, g.seq.length);
    if (g.pos[i] >= g.seq.length) {
      const p = this.s.ps[i];
      p.finishDarts = g.legDarts[i] + this.s.visit.length;
      finish(this, i, `Done in ${p.finishDarts} darts`);
    }
  }
  onVisitEnd(i) {
    const n = this.s.out[i] ? this.s.visit.length : 3;
    this.s.ps[i].darts += n; this.g.legDarts[i] += n;
  }
  standing(i) { return this.g.pos[i] * 1000 - this.g.legDarts[i]; }
}

export class X01Training extends X01 {
  static id = 'x01-training';
  static title = 'Solo X01';
  static desc = 'Practise legs of 501 (or 301 …) on your own – averages, first 9, checkout %.';
  static training = true;
  static maxPlayers = 4;
  static settings = X01.settings.map((s) => (s.key === 'legs' ? { ...s, default: 5 } : s)).filter((s) => s.key !== 'sets' && s.key !== 'maxRounds');
}

export const TRAININGS = [X01Training, Bobs27, Doubles, CheckoutPractice, TargetPractice, AtcTraining];
