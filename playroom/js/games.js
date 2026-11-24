// All match games. Training modes live in training.js.
import { Game } from './engine.js';
import { score, label, checkout, oneDartFinish, shuffle } from './darts.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const opts = (vals) => vals.map((v) => [v, String(v)]);
const fill = (n, v) => Array.from({ length: n }, () => (typeof v === 'function' ? v() : v));
const LEGS = { key: 'legs', label: 'Legs (first to)', options: opts(range(1, 11)), default: 1 };
const SETS = { key: 'sets', label: 'Sets (first to)', options: opts(range(1, 7)), default: 1 };
const avg3 = (points, darts) => (darts ? Math.round((points / darts) * 300) / 100 : 0);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// ======================================================================= X01
export class X01 extends Game {
  static id = 'x01';
  static title = 'X01';
  static desc = 'Count down from 301, 501, … to exactly zero.';
  static stype = 'x01';
  static settings = [
    { key: 'start', label: 'Start score', options: opts([101, 170, 201, 301, 401, 501, 601, 701, 801, 901, 1001]), default: 501 },
    { key: 'inMode', label: 'Check-in', options: [['straight', 'Straight in'], ['double', 'Double in'], ['master', 'Master in (D/T)']], default: 'straight' },
    { key: 'outMode', label: 'Check-out', options: [['double', 'Double out'], ['straight', 'Straight out'], ['master', 'Master out (D/T)']], default: 'double' },
    LEGS, SETS,
    { key: 'maxRounds', label: 'Round limit', options: [[0, 'none'], ...opts([10, 15, 20, 25, 30, 40, 50])], default: 0 },
  ];

  initStats() {
    return { darts: 0, points: 0, f9darts: 0, f9points: 0, legsPlayed: 0, legsWon: 0, coAttempts: 0, coHits: 0,
      highCo: 0, bestLeg: 0, t180: 0, t140: 0, t100: 0, t60: 0, busts: 0, highVisit: 0 };
  }

  initLeg() {
    const g = this.g, n = this.n;
    g.rem = fill(n, +this.cfg.start);
    g.opened = fill(n, this.cfg.inMode === 'straight');
    g.legDarts = fill(n, 0);
    g.visits = fill(n, () => []);
  }

  onVisitStart(i) {
    const g = this.g;
    g.vsRem = g.rem[i];
    g.vsOpened = g.opened[i];
    g.bust = false;
    g.coAtt = 0;
  }

  inOk(d) { return this.cfg.inMode === 'straight' ? d.m > 0 : this.cfg.inMode === 'double' ? d.m === 2 : d.m >= 2; }
  outOk(d) { return this.cfg.outMode === 'straight' ? true : this.cfg.outMode === 'double' ? d.m === 2 : d.m >= 2; }

  onDart(d, i) {
    const g = this.g, out = this.cfg.outMode;
    if (g.opened[i] && oneDartFinish(g.rem[i], out)) g.coAtt++;
    if (!g.opened[i]) {
      if (!this.inOk(d)) return;
      g.opened[i] = true;
    }
    const r = g.rem[i] - score(d);
    if (r < 0 || (r === 0 && !this.outOk(d)) || (r === 1 && out !== 'straight')) {
      g.rem[i] = g.vsRem;
      g.opened[i] = g.vsOpened;
      g.bust = true;
      this.emit('bust', { i });
      this.closeVisit('Bust!');
      return;
    }
    g.rem[i] = r;
    if (r === 0) {
      this.emit('checkout', { i, value: g.vsRem });
      this.winLeg(i, `Checkout ${g.vsRem}`);
    }
  }

  onVisitEnd(i) {
    const g = this.g, p = this.s.ps[i];
    const darts = this.visitDarts();
    const pts = g.bust ? 0 : g.vsRem - g.rem[i];
    if (g.legDarts[i] < 9) {
      const f9 = Math.min(darts, 9 - g.legDarts[i]);
      p.f9darts += f9;
      p.f9points += pts * (f9 / darts);
    }
    p.darts += darts; p.points += pts; g.legDarts[i] += darts;
    if (g.bust) p.busts++;
    if (!g.bust && g.rem[i] !== 0) this.emit('score', { i, points: pts });
    if (pts === 180) { p.t180++; this.msg('180!', 'great'); this.emit('180', { i }); } else if (pts >= 140) p.t140++; else if (pts >= 100) p.t100++; else if (pts >= 60) p.t60++;
    p.highVisit = Math.max(p.highVisit, pts);
    p.coAttempts += g.coAtt;
    if (g.rem[i] === 0) {
      p.coHits++;
      p.highCo = Math.max(p.highCo, g.vsRem);
      p.bestLeg = p.bestLeg ? Math.min(p.bestLeg, g.legDarts[i]) : g.legDarts[i];
    }
    g.visits[i].push(g.bust ? 'Bust' : pts);
    if (g.visits[i].length > 5) g.visits[i].shift();
  }

  onLegWon(w) {
    this.s.ps.forEach((p, i) => { p.legsPlayed++; if (i === w) p.legsWon++; });
  }

  maxRounds() { return +this.cfg.maxRounds || 0; }
  standing(i) { return -this.g.rem[i]; }
  traceValue(i) { return this.g.rem[i]; }

  callTurn(i) {
    const rem = this.g.rem[i];
    return this.g.opened[i] && rem <= 170 && checkout(rem, 3, this.cfg.outMode) ? `${this.name(i)}, you require ${rem}` : '';
  }

  targets() {
    const g = this.g, i = this.cur, s = this.s;
    if (s.legWinner !== null || s.matchOver) return [];
    if (!g.opened[i]) return this.cfg.inMode === 'double' ? [{ any: 'D' }] : [{ any: 'D' }, { any: 'T' }];
    const left = this.dartsPerVisit - s.visit.length;
    if (left <= 0) return [];
    if (g.rem[i] <= 170) {
      const r = checkout(g.rem[i], left, this.cfg.outMode);
      if (r) return r.map((d) => ({ n: d.n, m: d.m }));
    }
    return g.rem[i] > 60 ? [{ n: 20, m: 3 }] : [];
  }

  hint() {
    const g = this.g, i = this.cur, s = this.s;
    if (s.legWinner !== null || s.matchOver) return '';
    if (!g.opened[i]) return this.cfg.inMode === 'double' ? 'Double in' : 'Double or treble in';
    const left = this.dartsPerVisit - s.visit.length;
    if (g.rem[i] > 170 || left <= 0) return '';
    const route = checkout(g.rem[i], left, this.cfg.outMode);
    return route ? route.map(label).join(' · ') : (g.rem[i] <= 170 ? 'no checkout' : '');
  }

  view() {
    const g = this.g;
    return {
      info: `${this.cfg.start} · ${this.cfg.inMode !== 'straight' ? this.cfg.inMode + ' in · ' : ''}${this.cfg.outMode} out · ${this.infoLine()}`,
      hint: this.hint(),
      cols: this.s.players.map((_, i) => {
        const p = this.s.ps[i];
        return this.col(i, g.rem[i], [
          `⌀ ${avg3(p.points, p.darts).toFixed(2)}`,
          g.visits[i].length ? 'Last: ' + g.visits[i].slice(-3).join(', ') : '',
          `Darts: ${g.legDarts[i]}`,
        ]);
      }),
    };
  }

  summary(i) {
    const p = this.s.ps[i];
    return {
      ...p, avg: avg3(p.points, p.darts), first9: avg3(p.f9points, p.f9darts),
      coPct: pct(p.coHits, p.coAttempts), start: +this.cfg.start,
    };
  }
}

// ======================================================================= Cricket
const CRICKET_SYMBOLS = ['', '/', 'X', 'Ⓧ'];

export class Cricket extends Game {
  static id = 'cricket';
  static title = 'Cricket';
  static desc = 'Close 15–20 and bull with three marks each; score on numbers your opponents have not closed.';
  static stype = 'cricket';
  static settings = [
    { key: 'variant', label: 'Scoring', options: [['standard', 'Standard (points for you)'], ['cutthroat', 'Cut-throat (points to opponents)'], ['noscore', 'No score (just close)']], default: 'standard' },
    { key: 'numbers', label: 'Numbers', options: [['classic', '15–20 + Bull'], ['tactics', 'Tactics: 10–20 + Bull'], ['random', 'Random: 6 numbers + Bull']], default: 'classic' },
    LEGS, SETS,
    { key: 'maxRounds', label: 'Round limit', options: [[0, 'none'], ...opts([10, 15, 20, 25, 30])], default: 20 },
  ];

  initStats() { return { darts: 0, marks: 0, legsPlayed: 0, legsWon: 0 }; }

  initLeg() {
    const g = this.g, n = this.n;
    if (this.cfg.numbers === 'tactics') g.targets = [...range(10, 20).reverse(), 25];
    else if (this.cfg.numbers === 'random') g.targets = [...shuffle(range(1, 20)).slice(0, 6).sort((a, b) => b - a), 25];
    else g.targets = [20, 19, 18, 17, 16, 15, 25];
    g.marks = fill(n, () => Object.fromEntries(g.targets.map((t) => [t, 0])));
    g.score = fill(n, 0);
    g.visitMarks = 0;
  }

  onVisitStart() { this.g.visitMarks = 0; }

  closed(i, t) { return this.g.marks[i][t] >= 3; }
  dead(t) { return this.s.players.every((_, j) => this.closed(j, t)); }
  allClosed(i) { return this.g.targets.every((t) => this.closed(i, t)); }
  totalMarks(i) { return this.g.targets.reduce((a, t) => a + this.g.marks[i][t], 0); }

  onDart(d, i) {
    const g = this.g, t = d.n;
    if (!d.m || !g.targets.includes(t) || this.dead(t)) return;
    const old = g.marks[i][t];
    const now = old + d.m;
    g.marks[i][t] = Math.min(3, now);
    const extra = now > 3 ? now - Math.max(3, old) : 0;
    const open = this.s.players.map((_, j) => j).filter((j) => j !== i && !this.closed(j, t));
    let counted = Math.min(d.m, Math.max(0, 3 - old));
    if (extra && open.length && this.cfg.variant !== 'noscore') {
      counted += extra;
      const pts = extra * t;
      if (this.cfg.variant === 'cutthroat') open.forEach((j) => { g.score[j] += pts; });
      else g.score[i] += pts;
    }
    g.visitMarks += counted;
    this.s.ps[i].marks += counted;
    if (counted) this.emit('hit', { i });
    if (this.allClosed(i)) {
      const others = this.s.players.map((_, j) => j).filter((j) => j !== i);
      const v = this.cfg.variant;
      const ok = v === 'noscore' || !others.length
        || (v === 'standard' && others.every((j) => g.score[i] >= g.score[j]))
        || (v === 'cutthroat' && others.every((j) => g.score[i] <= g.score[j]));
      if (ok) this.winLeg(i);
    }
  }

  onVisitEnd(i) {
    this.s.ps[i].darts += this.visitDarts();
    const m = this.g.visitMarks;
    if (m >= 9) { this.msg('White horse! 9 marks', 'great'); this.emit('whitehorse', { i, marks: m }); }
    else if (m >= 5) { this.msg(`${m} marks`, 'good'); this.emit('marks', { i, marks: m }); }
  }

  onLegWon(w) { this.s.ps.forEach((p, i) => { p.legsPlayed++; if (i === w) p.legsWon++; }); }
  maxRounds() { return +this.cfg.maxRounds || 0; }
  traceValue(i) { return this.cfg.variant === 'noscore' ? this.totalMarks(i) : this.g.score[i]; }

  targets() {
    const g = this.g, i = this.cur;
    if (this.s.legWinner !== null) return [];
    const others = this.s.players.map((_, j) => j).filter((j) => j !== i);
    return g.targets.filter((t) => !this.dead(t) && (!this.closed(i, t)
      || (this.cfg.variant !== 'noscore' && others.some((j) => !this.closed(j, t)))))
      .map((t) => ({ n: t, m: 0 }));
  }

  standing(i) {
    const g = this.g;
    if (this.cfg.variant === 'noscore') return this.totalMarks(i);
    const sc = this.cfg.variant === 'cutthroat' ? -g.score[i] : g.score[i];
    return sc * 100 + this.totalMarks(i);
  }

  view() {
    const g = this.g;
    return {
      info: `${{ standard: 'Standard', cutthroat: 'Cut-throat', noscore: 'No score' }[this.cfg.variant]} · ${this.infoLine()}`,
      hint: '',
      cols: this.s.players.map((_, i) => {
        const p = this.s.ps[i];
        return this.col(i, this.cfg.variant === 'noscore' ? this.totalMarks(i) : g.score[i],
          [`MPR ${p.darts ? (p.marks / p.darts * 3).toFixed(2) : '0.00'}`]);
      }),
      grid: {
        rows: g.targets.map((t) => ({
          label: t === 25 ? 'Bull' : String(t),
          dead: this.dead(t),
          cells: this.s.players.map((_, i) => CRICKET_SYMBOLS[g.marks[i][t]]),
        })),
      },
    };
  }

  summary(i) {
    const p = this.s.ps[i];
    return { ...p, mpr: p.darts ? Math.round((p.marks / p.darts) * 300) / 100 : 0, variant: this.cfg.variant };
  }
}

// ======================================================================= Around the clock
export class AroundTheClock extends Game {
  static id = 'atc';
  static title = 'Around the Clock';
  static desc = 'Hit 1 to 20 (and bull) in order. First one through wins.';
  static stype = 'atc';
  static settings = [
    { key: 'order', label: 'Order', options: [['asc', '1 → 20'], ['desc', '20 → 1'], ['random', 'Random order']], default: 'asc' },
    { key: 'hit', label: 'Segment to hit', options: [['any', 'Any (S/D/T)'], ['single', 'Singles only'], ['double', 'Doubles only'], ['treble', 'Trebles only']], default: 'any' },
    { key: 'skip', label: 'Double/treble skips ahead', options: [[false, 'No'], [true, 'Yes (D = +2, T = +3)']], default: false },
    { key: 'bull', label: 'Finish on bull', options: [[true, 'Yes'], [false, 'No']], default: true },
    LEGS,
  ];

  initStats() { return { darts: 0, hits: 0, finishDarts: 0 }; }

  initLeg() {
    const g = this.g;
    let seq = range(1, 20);
    if (this.cfg.order === 'desc') seq.reverse();
    if (this.cfg.order === 'random') seq = shuffle(seq);
    if (String(this.cfg.bull) === 'true') seq.push(25);
    g.seq = seq;
    g.pos = fill(this.n, 0);
    g.legDarts = fill(this.n, 0);
  }

  target(i) { return this.g.seq[this.g.pos[i]]; }

  matches(d, t) {
    if (d.n !== t || !d.m) return false;
    switch (this.cfg.hit) {
      case 'single': return d.m === 1;
      case 'double': return d.m === 2;
      case 'treble': return t === 25 ? true : d.m === 3;
      default: return true;
    }
  }

  onDart(d, i) {
    const g = this.g, t = this.target(i);
    if (!this.matches(d, t)) return;
    this.s.ps[i].hits++;
    this.emit('hit', { i });
    let adv = String(this.cfg.skip) === 'true' && this.cfg.hit === 'any' && t !== 25 ? d.m : 1;
    let np = g.pos[i] + adv;
    const last = g.seq.length - 1;
    if (g.seq[last] === 25 && t !== 25 && np > last) np = last;      // never skip the bull
    g.pos[i] = Math.min(np, g.seq.length);
    if (g.pos[i] >= g.seq.length) this.winLeg(i);
  }

  onVisitEnd(i) {
    const d = this.visitDarts();
    this.s.ps[i].darts += d;
    this.g.legDarts[i] += d;
    if (this.g.pos[i] >= this.g.seq.length) {
      const p = this.s.ps[i];
      p.finishDarts = p.finishDarts ? Math.min(p.finishDarts, this.g.legDarts[i]) : this.g.legDarts[i];
    }
  }

  standing(i) { return this.g.pos[i] * 1000 - this.g.legDarts[i]; }
  traceValue(i) { return this.g.pos[i]; }

  targets() {
    const t = this.target(this.cur);
    if (t === undefined || this.s.legWinner !== null) return [];
    if (t === 25) return [{ n: 25, m: this.cfg.hit === 'double' ? 2 : this.cfg.hit === 'single' ? 1 : 0 }];
    return [{ n: t, m: { single: 1, double: 2, treble: 3 }[this.cfg.hit] || 0 }];
  }

  targetLabel(t) {
    if (t === undefined) return '✓';
    const pre = { double: 'D', treble: t === 25 ? '' : 'T', single: t === 25 ? '' : 'S' }[this.cfg.hit] || '';
    return t === 25 ? (this.cfg.hit === 'double' ? 'Bull' : this.cfg.hit === 'single' ? '25' : 'Bull') : pre + t;
  }

  hint() { return this.s.legWinner === null ? `Target: ${this.targetLabel(this.target(this.cur))}` : ''; }

  view() {
    const g = this.g;
    return {
      info: this.infoLine(),
      hint: this.hint(),
      cols: this.s.players.map((_, i) => this.col(i, this.targetLabel(this.target(i)),
        [`${g.pos[i]}/${g.seq.length} done`, `Darts: ${g.legDarts[i]}`])),
    };
  }

  summary(i) {
    const p = this.s.ps[i];
    return { ...p, hitPct: pct(p.hits, p.darts), finished: this.g.pos[i] >= this.g.seq.length, mode: this.cfg.hit };
  }
}

// ======================================================================= Shanghai
export class Shanghai extends Game {
  static id = 'shanghai';
  static title = 'Shanghai';
  static desc = 'Round n: only number n scores. Single, double and treble of the number in one visit = Shanghai, instant win.';
  static stype = 'shanghai';
  static settings = [
    { key: 'rounds', label: 'Rounds', options: [[7, '7 (1–7)'], [10, '10 (1–10)'], [20, '20 (1–20)']], default: 7 },
    { key: 'instant', label: 'Shanghai wins instantly', options: [[true, 'Yes'], [false, 'No (scores only)']], default: true },
  ];

  initStats() { return { darts: 0, points: 0, hits: 0, shanghais: 0 }; }
  initLeg() { this.g.score = fill(this.n, 0); }
  target() { return this.s.round; }

  onDart(d, i) {
    const t = this.target();
    if (d.n !== t || !d.m) return;
    this.g.score[i] += score(d);
    this.s.ps[i].points += score(d);
    this.s.ps[i].hits++;
    this.emit('hit', { i });
    const ms = new Set(this.s.visit.filter((x) => x.n === t).map((x) => x.m));
    if (ms.has(1) && ms.has(2) && ms.has(3)) {
      this.s.ps[i].shanghais++;
      this.emit('shanghai', { i });
      if (String(this.cfg.instant) === 'true') this.winLeg(i, 'SHANGHAI!');
      else this.msg('Shanghai!', 'great');
    }
  }

  onVisitEnd(i) { this.s.ps[i].darts += this.visitDarts(); }
  maxRounds() { return +this.cfg.rounds; }
  standing(i) { return this.g.score[i]; }
  traceValue(i) { return this.g.score[i]; }
  targets() { return this.s.legWinner === null ? [{ n: this.target(), m: 0 }] : []; }
  hint() { return this.s.legWinner === null ? `Target: ${this.target()}` : ''; }

  view() {
    return {
      info: this.infoLine(), hint: this.hint(),
      cols: this.s.players.map((_, i) => this.col(i, this.g.score[i], [])),
    };
  }
}

// ======================================================================= Killer
export class Killer extends Game {
  static id = 'killer';
  static title = 'Killer';
  static desc = 'Everyone gets a number. Hit your own double to become a killer, then take lives with your opponents\' doubles.';
  static stype = 'killer';
  static minPlayers = 2;
  static settings = [
    { key: 'lives', label: 'Lives', options: opts([1, 3, 5, 7]), default: 3 },
    { key: 'zone', label: 'Counts', options: [['double', 'Doubles only'], ['number', 'Whole number (S=1, D=2, T=3)']], default: 'double' },
    { key: 'selfKill', label: 'Killer hitting own number', options: [[true, 'Loses a life'], [false, 'Nothing happens']], default: true },
  ];

  initStats() { return { darts: 0, kills: 0, livesTaken: 0 }; }

  initLeg() {
    const g = this.g;
    g.num = shuffle(range(1, 20)).slice(0, this.n);
    g.lives = fill(this.n, +this.cfg.lives);
    g.killer = fill(this.n, false);
    g.outOrder = [];
  }

  hurt(j, k, by) {
    const g = this.g;
    g.lives[j] = Math.max(0, g.lives[j] - k);
    this.s.ps[by].livesTaken += by === j ? 0 : k;
    if (g.lives[j] === 0 && !this.s.out[j]) {
      this.s.out[j] = true;
      g.outOrder.push(j);
      if (by !== j) this.s.ps[by].kills++;
      this.msg(`${this.name(j)} is out!`, 'bad');
      this.emit('out', { i: j });
      if (j === this.cur) this.closeVisit(`${this.name(j)} is out!`);
    }
    if (this.aliveCount() === 1) this.winLeg(this.s.out.findIndex((o) => !o));
  }

  onDart(d, i) {
    const g = this.g;
    if (!d.m) return;
    const owner = g.num.indexOf(d.n);
    if (owner < 0) return;
    const k = this.cfg.zone === 'double' ? (d.m === 2 ? 1 : 0) : d.m;
    if (!k) return;
    if (owner === i) {
      if (!g.killer[i]) { g.killer[i] = true; this.msg(`${this.name(i)} is a KILLER`, 'great'); this.emit('killer', { i }); }
      else if (String(this.cfg.selfKill) === 'true') this.hurt(i, k, i);
    } else if (g.killer[i] && !this.s.out[owner]) {
      this.hurt(owner, k, i);
    }
  }

  onVisitEnd(i) { this.s.ps[i].darts += this.visitDarts(); }
  standing(i) { return this.s.out[i] ? this.g.outOrder.indexOf(i) : 100 + this.g.lives[i]; }
  traceValue(i) { return this.g.lives[i]; }

  targets() {
    const g = this.g, i = this.cur, m = this.cfg.zone === 'double' ? 2 : 0;
    if (this.s.legWinner !== null) return [];
    if (!g.killer[i]) return [{ n: g.num[i], m }];
    return g.num.filter((_, j) => j !== i && !this.s.out[j]).map((n) => ({ n, m }));
  }

  hint() {
    const g = this.g, i = this.cur;
    if (this.s.legWinner !== null) return '';
    const z = this.cfg.zone === 'double' ? 'D' : '';
    return g.killer[i] ? 'Killer – go after the others!' : `Become a killer: hit ${z}${g.num[i]}`;
  }

  view() {
    const g = this.g, z = this.cfg.zone === 'double' ? 'D' : '';
    return {
      info: `${this.cfg.lives} lives · ${this.infoLine()}`, hint: this.hint(),
      cols: this.s.players.map((_, i) => this.col(i, z + g.num[i],
        ['❤'.repeat(g.lives[i]) || '—', g.killer[i] ? 'KILLER' : ''], { tag: g.killer[i] ? 'killer' : '' })),
    };
  }
}

// ======================================================================= Halve-it / Bermuda
const HALVE_PRESETS = {
  classic: [15, 16, 'D', 17, 18, 'T', 19, 20, 'B'],
  bermuda: [12, 13, 14, 'D', 15, 16, 17, 'T', 18, 19, 20, 'SB', 'DB'],
  long: [20, 'D', 19, 'T', 18, 17, 'D', 16, 'T', 15, 14, 'B'],
};
const HALVE_LABEL = { D: 'Any double', T: 'Any treble', B: 'Bull (25/50)', SB: '25 (outer bull)', DB: 'Bull (50)' };

export class HalveIt extends Game {
  static id = 'halveit';
  static title = 'Halve-It';
  static desc = 'A target every round. Miss it with all three darts and your score is halved.';
  static stype = 'halveit';
  static settings = [
    { key: 'preset', label: 'Targets', options: [['classic', 'Classic: 15 16 D 17 18 T 19 20 Bull'], ['bermuda', 'Bermuda Triangle: 12–20, D, T, 25, Bull'], ['long', 'Long: 12 rounds']], default: 'classic' },
    { key: 'startScore', label: 'Start score', options: opts([0, 40]), default: 0 },
  ];

  initStats() { return { darts: 0, hits: 0, halved: 0 }; }
  get targetList() { return HALVE_PRESETS[this.cfg.preset] || HALVE_PRESETS.classic; }
  target() { return this.targetList[Math.min(this.s.round, this.targetList.length) - 1]; }
  initLeg() { this.g.score = fill(this.n, +this.cfg.startScore); }
  onVisitStart() { this.g.hit = false; }

  hits(d, t) {
    if (!d.m) return false;
    switch (t) {
      case 'D': return d.m === 2;
      case 'T': return d.m === 3;
      case 'B': return d.n === 25;
      case 'SB': return d.n === 25 && d.m === 1;
      case 'DB': return d.n === 25 && d.m === 2;
      default: return d.n === t;
    }
  }

  onDart(d, i) {
    if (!this.hits(d, this.target())) return;
    this.g.hit = true;
    this.g.score[i] += score(d);
    this.s.ps[i].hits++;
    this.emit('hit', { i });
  }

  onVisitEnd(i) {
    this.s.ps[i].darts += this.visitDarts();
    if (!this.g.hit) {
      this.g.score[i] = Math.floor(this.g.score[i] / 2);
      this.s.ps[i].halved++;
      this.emit('halved', { i });
      this.msg(`${this.name(i)}: halved!`, 'bad');
    }
  }

  maxRounds() { return this.targetList.length; }
  standing(i) { return this.g.score[i]; }
  traceValue(i) { return this.g.score[i]; }

  targets() {
    if (this.s.legWinner !== null) return [];
    const t = this.target();
    return [{ D: { any: 'D' }, T: { any: 'T' }, B: { n: 25, m: 0 }, SB: { n: 25, m: 1 }, DB: { n: 25, m: 2 } }[t] || { n: t, m: 0 }];
  }

  tLabel(t) { return HALVE_LABEL[t] || String(t); }
  hint() { return this.s.legWinner === null ? `Target: ${this.tLabel(this.target())}` : ''; }

  view() {
    return {
      info: this.infoLine(), hint: this.hint(),
      cols: this.s.players.map((_, i) => this.col(i, this.g.score[i], [])),
    };
  }
}

// ======================================================================= Count up
export class CountUp extends Game {
  static id = 'countup';
  static title = 'Count Up';
  static desc = 'Score as many points as possible in a fixed number of rounds.';
  static stype = 'countup';
  static settings = [
    { key: 'rounds', label: 'Rounds', options: opts([5, 7, 8, 10, 15, 20]), default: 8 },
  ];

  initStats() { return { darts: 0, points: 0, highVisit: 0 }; }
  initLeg() { this.g.score = fill(this.n, 0); this.g.vs = 0; }
  onVisitStart() { this.g.vs = 0; }
  onDart(d, i) { this.g.score[i] += score(d); this.g.vs += score(d); }
  onVisitEnd(i) {
    const p = this.s.ps[i];
    p.darts += this.visitDarts(); p.points += this.g.vs; p.highVisit = Math.max(p.highVisit, this.g.vs);
    this.emit('score', { i, points: this.g.vs });
    if (this.g.vs === 180) this.emit('180', { i });
  }
  maxRounds() { return +this.cfg.rounds; }
  standing(i) { return this.g.score[i]; }
  traceValue(i) { return this.g.score[i]; }
  targets() { return this.s.legWinner === null ? [{ n: 20, m: 3 }] : []; }
  view() {
    return {
      info: this.infoLine(), hint: '',
      cols: this.s.players.map((_, i) => this.col(i, this.g.score[i], [`⌀ ${avg3(this.s.ps[i].points, this.s.ps[i].darts).toFixed(1)}`])),
    };
  }
  summary(i) { const p = this.s.ps[i]; return { ...p, avg: avg3(p.points, p.darts), total: this.g.score[i] }; }
}

// ======================================================================= Baseball
export class Baseball extends Game {
  static id = 'baseball';
  static title = 'Baseball';
  static desc = '9 innings. Inning n: hit number n. Single = 1 run, double = 2, treble = 3.';
  static stype = 'baseball';
  static settings = [
    { key: 'extra', label: 'Tie after 9 innings', options: [[true, 'Extra innings'], [false, 'Ends in a tie']], default: true },
    { key: 'bullRun', label: 'Bull in any inning', options: [[false, 'Nothing'], [true, '25 = 1 run, Bull = 2 runs']], default: false },
  ];

  initStats() { return { darts: 0, runs: 0, hits: 0 }; }
  initLeg() { this.g.score = fill(this.n, 0); }
  target() { return this.s.round; }

  onDart(d, i) {
    let r = 0;
    if (d.n === this.target() && d.m) r = d.m;
    else if (d.n === 25 && String(this.cfg.bullRun) === 'true') r = d.m;
    if (!r) return;
    this.g.score[i] += r; this.s.ps[i].runs += r; this.s.ps[i].hits++;
    this.emit('hit', { i });
  }

  onVisitEnd(i) { this.s.ps[i].darts += this.visitDarts(); }

  tieAtTop() {
    const best = Math.max(...this.g.score);
    return this.g.score.filter((v) => v === best).length > 1;
  }

  maxRounds() {
    if (String(this.cfg.extra) === 'true' && this.s.round > 9 && this.s.round <= 20 && this.tieAtTop()) return this.s.round;
    return 9;
  }

  standing(i) { return this.g.score[i]; }
  traceValue(i) { return this.g.score[i]; }
  targets() { return this.s.legWinner === null ? [{ n: Math.min(this.target(), 20), m: 0 }] : []; }
  hint() { return this.s.legWinner === null ? `Inning ${this.target()}: hit ${this.target()}` : ''; }
  view() {
    return { info: this.infoLine(), hint: this.hint(), cols: this.s.players.map((_, i) => this.col(i, this.g.score[i], [])) };
  }
}

// ======================================================================= Gotcha
export class Gotcha extends Game {
  static id = 'gotcha';
  static title = 'Gotcha';
  static desc = 'Count up to exactly the target. Match an opponent\'s score and they go back to zero.';
  static stype = 'gotcha';
  static minPlayers = 2;
  static settings = [
    { key: 'target', label: 'Target', options: opts([201, 301, 501]), default: 301 },
    LEGS,
  ];

  initStats() { return { darts: 0, gotchas: 0 }; }
  initLeg() { this.g.score = fill(this.n, 0); }
  onVisitStart(i) { this.g.vs = this.g.score[i]; }

  onDart(d, i) {
    const g = this.g, t = +this.cfg.target;
    const ns = g.score[i] + score(d);
    if (ns > t) { g.score[i] = g.vs; this.emit('bust', { i }); this.closeVisit('Bust!'); return; }
    g.score[i] = ns;
    if (ns > 0 && score(d) > 0) {
      g.score.forEach((v, j) => {
        if (j !== i && v === ns) { g.score[j] = 0; this.s.ps[i].gotchas++; this.msg(`Gotcha! ${this.name(j)} back to 0`, 'great'); this.emit('gotcha', { i, victim: j }); }
      });
    }
    if (ns === t) this.winLeg(i);
  }

  onVisitEnd(i) { this.s.ps[i].darts += this.visitDarts(); }
  standing(i) { return this.g.score[i]; }
  traceValue(i) { return this.g.score[i]; }
  hint() {
    if (this.s.legWinner !== null) return '';
    const need = +this.cfg.target - this.g.score[this.cur];
    return `Needs ${need}`;
  }
  view() {
    return { info: `${this.cfg.target} · ${this.infoLine()}`, hint: this.hint(), cols: this.s.players.map((_, i) => this.col(i, this.g.score[i], [`needs ${+this.cfg.target - this.g.score[i]}`])) };
  }
}

export const GAMES = [X01, Cricket, AroundTheClock, Shanghai, Killer, HalveIt, CountUp, Baseball, Gotcha];
