// Engine tests – run in a browser: import('/test/engine.test.js').then(m => m.run())
import { parse, checkout, label } from '../js/darts.js';
import { X01, Cricket, AroundTheClock, Shanghai, Killer, HalveIt, CountUp, Baseball, Gotcha } from '../js/games.js';
import { Bobs27, Doubles, CheckoutPractice, TargetPractice, AtcTraining, X01Training } from '../js/training.js';
import { playerStats } from '../js/stats.js';

const P = (...names) => names.map((n, i) => ({ id: 'p' + i, name: n }));
const results = [];
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push({ name, ok, got, want });
}
function throwAll(g, darts) { for (const d of darts.split(/\s+/).filter(Boolean)) { if (d === '|') g.next(); else g.dart(parse(d)); } }
const route = (r, n = 3, o = 'double') => { const c = checkout(r, n, o); return c ? c.map(label).join(' ') : null; };

export function run() {
  results.length = 0;

  // ---------------- checkout calculator
  eq('co 170', route(170), 'T20 T20 Bull');
  eq('co 167', route(167), 'T20 T19 Bull');
  eq('co 100', route(100), 'T20 D20');
  eq('co 40', route(40), 'D20');
  eq('co 50 1 dart', route(50, 1), 'Bull');
  eq('co 169 none', route(169), null);
  eq('co 159 none', route(159), null);
  eq('co 3', route(3), '1 D1');
  eq('co 61 2 darts', route(61, 2) !== null, true);
  eq('co 60 straight', route(60, 1, 'straight'), 'T20');
  eq('co 2..170 coverage', Array.from({ length: 169 }, (_, k) => k + 2).filter((v) => !checkout(v)).join(','), '159,162,163,165,166,168,169');

  // ---------------- X01 basic double out, 2 players
  let g = new X01({ start: 101, outMode: 'double' }, P('A', 'B'));
  throwAll(g, 'T20 S1 S1');                        // A 101-62 = 39
  eq('x01 rem after visit', g.g.rem[0], 39);
  eq('x01 visit closed after 3', g.s.visitClosed, true);
  eq('x01 dart rejected when closed', g.dart(parse('T20')), false);
  g.next();
  eq('x01 player B now', g.cur, 1);
  throwAll(g, 'T20 T20');                          // B 101-120 bust
  eq('x01 bust restores', g.g.rem[1], 101);
  eq('x01 bust closes visit', g.s.visitClosed, true);
  g.next();
  throwAll(g, 'S7 D16');                           // A 39 -> 32 -> 0 win
  eq('x01 leg won', g.s.legWinner, 0);
  eq('x01 match over', g.s.matchOver, true);
  eq('x01 stats darts', g.s.ps[0].darts, 5);
  eq('x01 stats points', g.s.ps[0].points, 101);
  eq('x01 high checkout', g.s.ps[0].highCo, 39);
  eq('x01 checkout attempts (at 40 and at 32)', g.s.ps[0].coAttempts, 2);
  eq('x01 B bust darts counted', g.s.ps[1].darts, 3);
  eq('x01 B points 0', g.s.ps[1].points, 0);
  eq('x01 summary avg', g.summary(0).avg, 60.6);

  // finishing on a single with double out = bust; leaving 1 = bust
  g = new X01({ start: 101 }, P('A'));
  throwAll(g, 'T20 S1 S20 |');                     // 101-81 = 20
  throwAll(g, 'S20');
  eq('x01 single finish busts', g.g.rem[0], 20);
  g = new X01({ start: 101 }, P('A'));
  throwAll(g, 'T20 S20 S20');                      // 1 left
  eq('x01 leaving 1 busts', g.g.rem[0], 101);
  g = new X01({ start: 101, outMode: 'straight' }, P('A'));
  throwAll(g, 'T20 S20 S20');                      // 1 left ok in straight out
  eq('x01 straight out leaves 1', g.g.rem[0], 1);
  g = new X01({ start: 101, outMode: 'master' }, P('A'));
  throwAll(g, 'T20 S20 |'); throwAll(g, 'T7');
  eq('x01 master out treble finish', g.s.matchOver, true);

  // double in
  g = new X01({ start: 301, inMode: 'double' }, P('A'));
  throwAll(g, 'T20 D10 T20');
  eq('x01 double in counts from opening dart', g.g.rem[0], 301 - 20 - 60);
  g = new X01({ start: 301, inMode: 'double' }, P('A'));
  throwAll(g, 'T20 T20 T20 |');
  eq('x01 not opened', g.g.rem[0], 301);

  // legs / sets / starter rotation
  g = new X01({ start: 101, legs: 2 }, P('A', 'B'));
  throwAll(g, 'T20 S1 D20');
  eq('x01 leg 1 won by A', [g.s.legWinner, g.s.matchOver], [0, false]);
  g.next();
  eq('x01 leg 2 starts with B', [g.s.leg, g.cur], [2, 1]);
  throwAll(g, 'T20 S1 D20');
  eq('x01 B wins leg 2', g.s.legsWon, [1, 1]);
  g.next();
  throwAll(g, 'T20 S1 D20');                       // leg 3 starts with A
  eq('x01 A wins match 2-1', [g.s.matchOver, g.s.winner], [true, 0]);
  g = new X01({ start: 101, legs: 1, sets: 2 }, P('A', 'B'));
  throwAll(g, 'T20 S1 D20'); g.next();
  eq('x01 set won', [g.s.set, g.s.setsWon], [2, [1, 0]]);

  // round limit
  g = new X01({ start: 501, maxRounds: 2 }, P('A', 'B'));
  throwAll(g, 'T20 T20 T20 | S1 S1 S1 | T20 | S5 |');
  eq('x01 round limit lowest wins', [g.s.matchOver, g.s.winner], [true, 0]);

  // undo + correction
  g = new X01({ start: 501 }, P('A', 'B'));
  throwAll(g, 'T20 T20 S5');
  g.correct(2, parse('T20'));
  eq('x01 correct last dart -> 180', g.g.rem[0], 321);
  g.correct(0, parse('S20'));
  eq('x01 correct first dart', g.g.rem[0], 501 - 20 - 120);
  g.undo();
  eq('x01 undo', g.s.visit.length, 2);
  g = new X01({ start: 501 }, P('A', 'B'));
  throwAll(g, 'T20 T20 T20');
  g.next();
  eq('x01 180 counted', g.s.ps[0].t180, 1);
  eq('x01 first9 after one visit', g.summary(0).first9, 180);
  g.undo();
  eq('x01 undo next', [g.cur, g.s.visit.length], [0, 3]);
  // next() pads misses
  g = new X01({ start: 501 }, P('A', 'B'));
  throwAll(g, 'T20 |');
  eq('x01 next pads misses', [g.s.ps[0].darts, g.cur], [3, 1]);

  // ---------------- Cricket
  g = new Cricket({ variant: 'standard', maxRounds: 0 }, P('A', 'B'));
  throwAll(g, 'T20 T20 S20');                      // A closes 20 and scores 80
  eq('cricket marks', g.g.marks[0][20], 3);
  eq('cricket scoring', g.g.score[0], 80);
  eq('cricket MPR marks', g.s.ps[0].marks, 7);
  g.next();
  throwAll(g, 'T20 S1 S1');                        // B closes 20
  eq('cricket 20 dead', g.dead(20), true);
  g.next();
  throwAll(g, 'T20');                              // dead number: nothing
  eq('cricket dead no score', [g.g.score[0], g.s.ps[0].marks], [80, 7]);
  g = new Cricket({ variant: 'cutthroat', maxRounds: 0 }, P('A', 'B'));
  throwAll(g, 'T19 T19');
  eq('cricket cutthroat points to opponent', g.g.score, [0, 57]);
  // win: A closes everything with more points
  g = new Cricket({ variant: 'standard', maxRounds: 0 }, P('A', 'B'));
  throwAll(g, 'T20 T19 T18 | S1 | T17 T16 T15 | S1 | Bull Bull');
  eq('cricket win after closing all', [g.s.matchOver, g.s.winner], [true, 0]);
  g = new Cricket({ variant: 'noscore', numbers: 'tactics', maxRounds: 0 }, P('A'));
  eq('cricket tactics targets', g.g.targets.length, 12);
  g = new Cricket({ numbers: 'random' }, P('A'));
  eq('cricket random targets', [g.g.targets.length, g.g.targets[6]], [7, 25]);
  g = new Cricket({ variant: 'standard', maxRounds: 1 }, P('A', 'B'));
  throwAll(g, 'T20 S20 | S19 |');
  eq('cricket round limit winner by points', g.s.winner, 0);

  // ---------------- Around the clock
  g = new AroundTheClock({ order: 'asc', bull: true, hit: 'any', skip: false }, P('A'));
  throwAll(g, 'S1 D2 T3 | S4');
  eq('atc progress', g.g.pos[0], 4);
  g = new AroundTheClock({ order: 'asc', bull: true, hit: 'any', skip: true }, P('A'));
  throwAll(g, 'T1');
  eq('atc skip treble', g.g.pos[0], 3);
  g = new AroundTheClock({ order: 'asc', bull: true, hit: 'double', skip: false }, P('A'));
  throwAll(g, 'S1 T1 D1');
  eq('atc doubles only', g.g.pos[0], 1);
  g = new AroundTheClock({ order: 'desc', bull: false }, P('A'));
  eq('atc desc first target', g.target(0), 20);
  g = new AroundTheClock({ order: 'asc', bull: true, skip: true }, P('A'));
  g.g.pos[0] = 19;                                 // on 20
  throwAll(g, 'T20');
  eq('atc never skips bull', g.target(0), 25);
  throwAll(g, '25');
  eq('atc bull finishes', g.s.matchOver, true);

  // ---------------- Shanghai
  g = new Shanghai({ rounds: 7, instant: true }, P('A', 'B'));
  throwAll(g, 'S1 D1 S5 | S1 | S2 T2 |');
  eq('shanghai score per round', [g.g.score[0], g.g.score[1]], [11, 1]);
  throwAll(g, 'S2 D2 T2');
  eq('shanghai instant win', [g.s.matchOver, g.s.winner], [true, 1]);

  // ---------------- Killer
  g = new Killer({ lives: 1, zone: 'double', selfKill: true }, P('A', 'B', 'C'));
  g.g.num = [1, 2, 3];
  throwAll(g, 'D2');
  eq('killer not yet killer', g.g.lives[1], 1);
  throwAll(g, 'D1 D2');
  eq('killer takes life + out', [g.g.killer[0], g.s.out[1]], [true, true]);
  g.next();
  eq('killer skips eliminated', g.cur, 2);
  throwAll(g, 'D3 S1 |');                          // C becomes killer
  throwAll(g, 'D3');                               // A: kill C -> A wins
  eq('killer last standing wins', [g.s.matchOver, g.s.winner], [true, 0]);

  // ---------------- Halve-it
  g = new HalveIt({ preset: 'classic', startScore: 40 }, P('A'));
  throwAll(g, 'S15 T15 S1 |');                     // 40+15+45 = 100
  eq('halveit hit', g.g.score[0], 100);
  throwAll(g, 'S1 S1 S1 |');                       // target 16 missed -> 50
  eq('halveit halved', g.g.score[0], 50);
  throwAll(g, 'D5 |');                             // any double
  eq('halveit any double', g.g.score[0], 60);

  // ---------------- Count up / Baseball / Gotcha
  g = new CountUp({ rounds: 2 }, P('A'));
  throwAll(g, 'T20 T20 T20 | S1 |');
  eq('countup total + end', [g.g.score[0], g.s.matchOver], [181, true]);
  g = new Baseball({ extra: true }, P('A', 'B'));
  throwAll(g, 'T1 |');
  eq('baseball runs', g.g.score[0], 3);
  for (let k = 0; k < 17; k++) g.next();         // rest of 9 innings: A=3, B=0
  eq('baseball over after 9', [g.s.matchOver, g.s.winner], [true, 0]);
  g = new Baseball({ extra: true }, P('A', 'B'));
  for (let k = 0; k < 18; k++) g.next();         // 0:0 after 9 -> extra innings
  eq('baseball extra inning', [g.s.matchOver, g.s.round], [false, 10]);
  g = new Baseball({ extra: false }, P('A', 'B'));
  for (let k = 0; k < 18; k++) g.next();         // 0:0 after 9, no extra innings -> draw
  eq('baseball draw', [g.s.matchOver, g.s.winner, g.s.legsWon], [true, null, [0, 0]]);
  eq('baseball draw ranking', g.s.ranking.length, 2);
  g = new Baseball({ extra: false }, P('A', 'B'));
  throwAll(g, 'T1 |');
  for (let k = 0; k < 17; k++) g.next();
  eq('baseball no draw when ahead', [g.s.matchOver, g.s.winner], [true, 0]);
  g = new Gotcha({ target: 301 }, P('A', 'B'));
  throwAll(g, 'T20 |  T20 |');
  eq('gotcha reset opponent', g.g.score, [0, 60]);
  g = new Gotcha({ target: 201 }, P('A', 'B'));
  g.g.score[0] = 190; g.g.vs = 190;
  throwAll(g, 'S20');
  eq('gotcha bust', [g.g.score[0], g.s.visitClosed], [190, true]);

  // ---------------- Training
  g = new Bobs27({ bull: true, stop: true }, P('A'));
  throwAll(g, 'D1 S1 S1 |');                       // 27+2 = 29
  eq('bobs27 hit', g.g.score[0], 29);
  throwAll(g, 'S2 S2 S2 |');                       // 29-4 = 25
  eq('bobs27 miss', g.g.score[0], 25);
  for (let k = 0; k < 5; k++) g.next();             // D3..D7 missed: 25-6-8-10-12 = <0
  eq('bobs27 game over below zero', g.s.matchOver, true);
  eq('bobs27 per-double stats', g.summary(0).per[1], [1, 3]);

  g = new Doubles({ order: 'asc', bull: false, per: 'hit' }, P('A'));
  throwAll(g, 'S1 D1 D2');
  eq('doubles until hit', [g.g.pos[0], g.s.ps[0].hits, g.s.ps[0].darts], [2, 2, 3]);
  g = new Doubles({ order: 'asc', bull: false, per: 3 }, P('A'));
  for (let k = 0; k < 20; k++) g.next();
  eq('doubles session ends', [g.s.matchOver, g.s.ps[0].darts], [true, 60]);

  g = new CheckoutPractice({ range: '41-80', attempts: 2, limit: 3, outMode: 'double' }, P('A'));
  g.g.seq = [60, 41]; g.g.rem = [60];
  throwAll(g, 'S20 D20');
  eq('checkout success', [g.s.ps[0].success, g.g.rem[0], g.s.visitClosed], [1, 41, true]);
  g.next();
  throwAll(g, 'S1 S1 S1');
  eq('checkout fail + session end', [g.s.ps[0].attempts, g.s.ps[0].success, g.s.matchOver], [2, 1, true]);
  g = new CheckoutPractice({ range: '41-80', attempts: 1, limit: 6 }, P('A'));
  g.g.seq = [50]; g.g.rem = [50]; g.g.vs = 50;
  throwAll(g, 'T20');                              // bust -> visit burnt, 3 darts used
  eq('checkout bust burns visit', [g.g.used[0], g.g.rem[0], g.s.visitClosed], [3, 50, true]);
  g.next();
  throwAll(g, 'Bull');
  eq('checkout second visit success', [g.s.ps[0].success, g.s.ps[0].successDarts], [1, 4]);

  g = new TargetPractice({ target: 'T20', darts: 30 }, P('A'));
  for (let k = 0; k < 10; k++) throwAll(g, 'T20 S20 S5 |');
  eq('target practice stats', [g.s.matchOver, g.summary(0).exactPct, g.summary(0).numberPct, g.summary(0).ppv], [true, 33.3, 66.7, 85]);

  g = new AtcTraining({ order: 'asc', bull: false, hit: 'any', skip: true }, P('A'));
  throwAll(g, 'T1 T4 T7 | T10 T13 T16 | T19 S20');
  eq('atc training finish darts (T19 skips past 20)', [g.s.matchOver, g.s.ps[0].finishDarts], [true, 7]);

  g = new X01Training({ start: 101 }, P('A'));
  eq('x01 training legs default', g.legsToWin(), 5);

  // ---------------- serialisation round trip
  g = new Cricket({}, P('A', 'B'));
  throwAll(g, 'T20 T19');
  const g2 = new Cricket(g.cfg, [], JSON.parse(JSON.stringify(g.toJSON())));
  throwAll(g2, 'T18');
  eq('restore + continue', [g2.g.marks[0][18], g2.s.visit.length], [3, 3]);
  g2.undo();
  eq('restored undo', g2.s.visit.length, 2);

  // ---------------- events, hit map, score trace, board targets, caller
  g = new X01({ start: 101 }, P('A', 'B'));
  g.events = [];
  throwAll(g, 'T20 T20');                          // bust
  eq('events: darts + bust', g.events.map((e) => e.type), ['dart', 'dart', 'bust']);
  eq('hit map counts', g.s.hist[0], { T20: 2 });
  g.next();
  eq('trace after a bust visit', g.s.trace[0], [101, 101]);
  g = new X01({ start: 501 }, P('A'));
  throwAll(g, 'T20 T20 T20');
  g.events = []; g.next();
  eq('180 event on visit end', g.events.some((e) => e.type === '180'), true);
  g = new X01({ start: 101 }, P('A', 'B'));
  g.events = [];
  throwAll(g, 'T20 S1 D20');
  eq('checkout + match events', g.events.filter((e) => e.type !== 'dart').map((e) => e.type), ['checkout', 'match']);
  g = new X01({ start: 101 }, P('A'));
  throwAll(g, 'T20 S1');                           // 40 left, 1 dart
  eq('x01 board target = checkout route', g.targets(), [{ n: 20, m: 2 }]);
  eq('caller line', new X01({ start: 100 }, P('Anna')).callTurn(0), 'Anna, you require 100');
  eq('no caller line above 170', new X01({ start: 501 }, P('Anna')).callTurn(0), '');
  eq('cricket targets = open numbers', new Cricket({ maxRounds: 0 }, P('A', 'B')).targets().length, 7);
  eq('bobs27 target', new Bobs27({}, P('A')).targets(), [{ n: 1, m: 2 }]);
  g = new HalveIt({ preset: 'classic' }, P('A'));
  g.events = [];
  throwAll(g, 'S1 S1 S1 | S1 S1 S1 |');
  eq('halve-it: halved events', g.events.filter((e) => e.type === 'halved').length, 2);
  eq('halve-it target "any double"', g.targets(), [{ any: 'D' }]);
  g = new Killer({ lives: 3 }, P('A', 'B'));
  g.g.num = [1, 2];
  eq('killer target before becoming killer', g.targets(), [{ n: 1, m: 2 }]);
  const r1 = new Cricket({}, P('A', 'B'));
  throwAll(r1, 'T20');
  const r2 = new Cricket(r1.cfg, [], JSON.parse(JSON.stringify(r1.toJSON())));
  eq('hit map survives save/restore', r2.s.hist[0], { T20: 1 });

  // ---------------- stats aggregation
  const a = new X01({ start: 101 }, P('A', 'B'));
  throwAll(a, 'T20 S1 D20');
  const rec = { ts: 1, type: 'x01', stype: 'x01', title: 'X01', players: a.s.players, winner: 'p0',
    stats: { p0: a.summary(0), p1: a.summary(1) } };
  const st = playerStats([rec, { ...rec, ts: 2 }], 'p0');
  eq('stats groups', st.map((x) => [x.stype, x.count, x.wins]), [['x01', 2, 2]]);
  eq('stats avg card', st[0].cards[0], ['3-dart average', 101]);

  const failed = results.filter((r) => !r.ok);
  return { total: results.length, failed: failed.length, failures: failed };
}
