// Shared game engine: players, turn order, visits (3 darts), legs/sets, rounds,
// undo and single-dart correction. Concrete games subclass Game and implement:
//
//   initStats()            -> per-player stats object (kept for the whole match)
//   initLeg()              reset per-leg state
//   onVisitStart(i)        optional
//   onDart(d, i)           apply one dart for player i (may call closeVisit(msg) / winLeg(i))
//   onVisitEnd(i)          optional: commit the visit (stats, halve-it rule, ...)
//   onRoundEnd()           optional
//   maxRounds()            0 = unlimited
//   decideByRounds()       winner index when the round limit is reached
//   standing(i)            number used to rank players (higher = better)
//   view()                 scoreboard model for the UI
//   summary(i)             stats saved to history for player i
//   targets()              optional: segments to highlight on the board for the current player
//                          [{n, m}] (m = 0: whole number), [{any: 'D'|'T'}]
//   traceValue(i)          optional: number charted after every visit (remaining, score, …)
//   callTurn(i)            optional: what the caller says when player i steps up
//
// Events: every action appends {type, …} to game.events (not part of the saved state). The UI
// turns them into sounds, effects and caller lines: dart, turn, hit, bust, score, 180, checkout,
// leg, match, plus game specific ones (shanghai, whitehorse, killer, out, halved, gotcha, fail).
import { MISS } from './darts.js';

export function defaultsOf(settings) {
  const o = {};
  for (const s of settings) o[s.key] = s.default;
  return o;
}

export class Game {
  static id = 'base';
  static title = 'Game';
  static settings = [];
  static minPlayers = 1;
  static maxPlayers = 8;
  static training = false;

  constructor(cfg = {}, players = [], restore = null) {
    this.cfg = { ...defaultsOf(this.constructor.settings), ...cfg };
    this.undoStack = [];
    this.events = [];
    if (restore) {
      this.s = restore.s;
      this.undoStack = restore.undo || [];
      const n = this.s.players.length;
      this.s.hist = this.s.hist || Array.from({ length: n }, () => ({}));
      this.s.trace = this.s.trace || Array.from({ length: n }, () => []);
      return;
    }
    const n = players.length;
    this.s = {
      players: players.map((p) => ({ id: p.id, name: p.name })),
      cur: 0, legStarter: 0,
      visit: [], visitClosed: false, visitCommitted: false, visitNo: 0, visitOwner: 0,
      leg: 1, set: 1, legsWon: Array(n).fill(0), setsWon: Array(n).fill(0),
      round: 1, legWinner: null, matchOver: false, winner: null, ranking: null,
      out: Array(n).fill(false),
      msg: null,
      g: {},                                     // game specific state
      ps: players.map(() => this.initStats()),
      hist: players.map(() => ({})),             // where the darts landed: {'T20': 5, '1': 2, …}
      trace: players.map(() => []),              // traceValue after every visit (this leg)
    };
    this.initMatch();
    this.initLeg();
    this.resetTrace();
    this.beginVisit();
  }

  // ------------------------------------------------------------ hooks (defaults)
  initMatch() {}
  initStats() { return { darts: 0 }; }
  initLeg() {}
  onVisitStart() {}
  onDart() {}
  onVisitEnd() {}
  onRoundEnd() {}
  maxRounds() { return 0; }
  decideByRounds() { return this.bestBy((i) => this.standing(i)); }
  standing() { return 0; }
  summary(i) { return { ...this.s.ps[i] }; }
  hint() { return ''; }
  targets() { return []; }
  traceValue() { return null; }
  callTurn() { return ''; }
  get dartsPerVisit() { return 3; }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  static histKey(d) {
    if (!d || !d.m) return 'Miss';
    if (d.n === 25) return d.m === 2 ? 'Bull' : '25';
    return (d.m === 3 ? 'T' : d.m === 2 ? 'D' : 'S') + d.n;
  }

  resetTrace() {
    this.s.trace = this.s.players.map((_, i) => {
      const v = this.traceValue(i);
      return v === null || v === undefined ? [] : [v];
    });
  }

  /** darts to count for the visit being committed: actual darts if it won the leg, else 3 */
  visitDarts() {
    const s = this.s;
    return s.legWinner === s.visitOwner ? s.visit.length : this.dartsPerVisit;
  }

  /** standard scoreboard column */
  col(i, big, sub = [], extra = {}) {
    const s = this.s;
    return {
      name: this.name(i), big, sub,
      active: i === s.cur && !s.matchOver && s.legWinner === null,
      out: s.out[i], legs: s.legsWon[i], sets: s.setsWon[i],
      winner: s.legWinner === i, ...extra,
    };
  }

  // ------------------------------------------------------------ helpers
  get n() { return this.s.players.length; }
  get cur() { return this.s.cur; }
  get g() { return this.s.g; }
  name(i) { return this.s.players[i].name; }
  legsToWin() { return +this.cfg.legs || 1; }
  setsToWin() { return +this.cfg.sets || 1; }
  msg(text, kind = 'info') { this.s.msg = { text, kind, t: Date.now() }; }

  /** index with the best value of f (ties -> earlier in turn order of this leg) */
  bestBy(f, lowest = false) {
    let best = -1, bv = null;
    for (let k = 0; k < this.n; k++) {
      const i = (this.s.legStarter + k) % this.n;
      const v = f(i);
      if (best < 0 || (lowest ? v < bv : v > bv)) { best = i; bv = v; }
    }
    return best;
  }

  /** order position of i in the current leg (legStarter = 0) */
  pos(i) { return (i - this.s.legStarter + this.n) % this.n; }

  nextActive(i) {
    for (let k = 1; k <= this.n; k++) {
      const j = (i + k) % this.n;
      if (!this.s.out[j]) return j;
    }
    return i;
  }

  aliveCount() { return this.s.out.filter((o) => !o).length; }

  // ------------------------------------------------------------ public actions
  canThrow() {
    const s = this.s;
    return !s.matchOver && !s.visitClosed && s.legWinner === null;
  }

  /** Throw one dart. Returns false if the visit is closed (waiting for next()). */
  dart(d) {
    if (!this.canThrow()) return false;
    this.pushUndo();
    const s = this.s;
    s.msg = null;
    d = d && d.m ? { n: d.n, m: d.m } : { ...MISS };
    s.visit.push(d);
    const h = s.hist[s.cur], key = Game.histKey(d);
    h[key] = (h[key] || 0) + 1;
    this.emit('dart', { d, i: s.cur, k: s.visit.length });
    this.onDart(d, s.cur);
    if (s.legWinner === null && !s.visitClosed && s.visit.length >= this.dartsPerVisit) s.visitClosed = true;
    return true;
  }

  /** Next player (button or darts pulled). Starts the next leg if one was just won. */
  next() {
    const s = this.s;
    if (s.matchOver) return false;
    this.pushUndo();
    if (s.legWinner !== null) { this.startNextLeg(); return true; }
    // darts not thrown / not detected count as misses
    while (!s.visitClosed && s.legWinner === null && s.visit.length < this.dartsPerVisit) {
      s.visit.push({ ...MISS });
      this.onDart({ ...MISS }, s.cur);
    }
    if (s.legWinner === null) this.endVisit();
    return true;
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.s = JSON.parse(this.undoStack.pop());
    return true;
  }

  /** Replace dart `idx` of the current visit with `d` (re-plays the darts after it). */
  correct(idx, d) {
    const s = this.s;
    if (idx < 0 || idx >= s.visit.length || s.visitOwner !== s.cur && s.legWinner === null) return false;
    const saved = { s: JSON.stringify(s), undo: [...this.undoStack] };
    const later = s.visit.slice(idx + 1);
    const vn = s.visitNo;
    for (;;) {
      if (!this.undoStack.length) return this.restoreSaved(saved);
      const st = JSON.parse(this.undoStack.pop());
      if (st.visitNo !== vn) return this.restoreSaved(saved);
      this.s = st;
      if (st.visit.length === idx) break;
    }
    this.dart(d);
    for (const x of later) this.dart(x);
    return true;
  }

  restoreSaved(saved) {
    this.s = JSON.parse(saved.s);
    this.undoStack = saved.undo;
    return false;
  }

  // ------------------------------------------------------------ flow
  pushUndo() {
    this.undoStack.push(JSON.stringify(this.s));
    if (this.undoStack.length > 400) this.undoStack.shift();
  }

  beginVisit() {
    const s = this.s;
    s.visit = [];
    s.visitClosed = false;
    s.visitCommitted = false;
    s.visitOwner = s.cur;
    this.onVisitStart(s.cur);
    this.emit('turn', { i: s.cur, call: this.callTurn(s.cur) });
  }

  /** Game logic ends the visit early (bust, player eliminated, ...) */
  closeVisit(text, kind = 'bad') {
    this.s.visitClosed = true;
    if (text) this.msg(text, kind);
  }

  commitVisit() {
    if (this.s.visitCommitted) return;
    this.s.visitCommitted = true;
    this.onVisitEnd(this.s.visitOwner);
    const v = this.traceValue(this.s.visitOwner);
    if (v !== null && v !== undefined) this.s.trace[this.s.visitOwner].push(v);
  }

  endVisit() {
    const s = this.s;
    this.commitVisit();
    s.visitNo++;
    const prev = s.cur;
    s.cur = this.nextActive(prev);
    if (this.pos(s.cur) <= this.pos(prev)) {
      s.round++;
      this.onRoundEnd();
      const mr = this.maxRounds();
      if (s.legWinner === null && mr && s.round > mr) {
        this.winLeg(this.decideByRounds(), 'Round limit reached');
        return;
      }
    }
    if (s.legWinner === null && !s.matchOver) this.beginVisit();
  }

  winLeg(i, text) {
    const s = this.s;
    if (s.legWinner !== null) return;
    s.legWinner = i;                 // set first: onVisitEnd may look at it
    this.commitVisit();
    s.visitClosed = true;
    s.legsWon[i]++;
    this.onLegWon(i);
    let matchWon = false;
    if (this.setsToWin() > 1) {
      if (s.legsWon[i] >= this.legsToWin()) {
        s.setsWon[i]++;
        s.setJustWon = true;
        matchWon = s.setsWon[i] >= this.setsToWin();
      }
    } else {
      matchWon = s.legsWon[i] >= this.legsToWin();
    }
    this.emit(matchWon ? 'match' : 'leg', { i });
    if (matchWon) {
      s.matchOver = true;
      s.winner = i;
      s.ranking = this.ranking();
      this.msg(`${this.name(i)} wins!`, 'win');
    } else {
      this.msg(text ? `${text} – ${this.name(i)} wins the leg` : `${this.name(i)} wins the leg`, 'win');
    }
  }

  onLegWon() {}

  startNextLeg() {
    const s = this.s;
    if (s.setJustWon) {
      s.legsWon.fill(0);
      s.set++;
      s.leg = 1;
      s.setJustWon = false;
    } else {
      s.leg++;
    }
    s.legWinner = null;
    s.legStarter = (s.legStarter + 1) % this.n;
    s.cur = s.legStarter;
    s.round = 1;
    s.out.fill(false);
    s.msg = null;
    this.initLeg();
    this.resetTrace();
    this.beginVisit();
  }

  ranking() {
    const idx = [...Array(this.n).keys()];
    const w = this.s.winner;
    return [w, ...idx.filter((i) => i !== w).sort((a, b) =>
      (this.s.setsWon[b] - this.s.setsWon[a]) || (this.s.legsWon[b] - this.s.legsWon[a]) || (this.standing(b) - this.standing(a)))];
  }

  /** "Leg 2/3 · Set 1 · Round 4/20" */
  infoLine() {
    const s = this.s, parts = [];
    if (this.setsToWin() > 1) parts.push(`Set ${s.set} (first to ${this.setsToWin()})`);
    if (this.legsToWin() > 1 || this.setsToWin() > 1) parts.push(`Leg ${s.leg} (first to ${this.legsToWin()})`);
    const mr = this.maxRounds();
    parts.push(mr ? `Round ${Math.min(s.round, mr)}/${mr}` : `Round ${s.round}`);
    return parts.join(' · ');
  }

  toJSON() {
    return { type: this.constructor.id, cfg: this.cfg, s: this.s, undo: this.undoStack.slice(-60) };
  }
}
