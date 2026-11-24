// Aggregates history records into per-player statistics.
// History record: { id, ts, type, stype, title, training, cfg, players:[{id,name}], winner, ranking, stats:{pid: summary} }

const sum = (rs, k) => rs.reduce((a, r) => a + (+r[k] || 0), 0);
const max = (rs, k) => rs.reduce((a, r) => Math.max(a, +r[k] || 0), 0);
const minPos = (rs, k) => rs.reduce((a, r) => (+r[k] > 0 && (a === 0 || +r[k] < a) ? +r[k] : a), 0);
const ratio = (a, b, mul = 1, dec = 2) => (b ? Math.round((a / b) * mul * 10 ** dec) / 10 ** dec : 0);

/** Definitions per stat type: summary cards + one series to chart */
export const STAT_TYPES = {
  x01: {
    title: 'X01',
    cards: (rs) => [
      ['3-dart average', ratio(sum(rs, 'points'), sum(rs, 'darts'), 3)],
      ['First 9 average', ratio(sum(rs, 'f9points'), sum(rs, 'f9darts'), 3)],
      ['Checkout %', ratio(sum(rs, 'coHits'), sum(rs, 'coAttempts'), 100, 1)],
      ['Highest checkout', max(rs, 'highCo') || '–'],
      ['Best leg (darts)', minPos(rs, 'bestLeg') || '–'],
      ['Highest visit', max(rs, 'highVisit')],
      ['180s', sum(rs, 't180')], ['140+', sum(rs, 't140')], ['100+', sum(rs, 't100')],
      ['Legs won', `${sum(rs, 'legsWon')}/${sum(rs, 'legsPlayed')}`],
    ],
    series: { label: '3-dart average', get: (r) => r.avg },
  },
  cricket: {
    title: 'Cricket',
    cards: (rs) => [['Marks per round', ratio(sum(rs, 'marks'), sum(rs, 'darts'), 3)], ['Legs won', `${sum(rs, 'legsWon')}/${sum(rs, 'legsPlayed')}`]],
    series: { label: 'MPR', get: (r) => r.mpr },
  },
  bobs27: {
    title: "Bob's 27",
    cards: (rs) => [
      ['Best score', rs.length ? Math.max(...rs.map((r) => r.score)) : '–'],
      ['Average score', rs.length ? Math.round(sum(rs, 'score') / rs.length) : '–'],
      ['Double hit %', ratio(sum(rs, 'hits'), sum(rs, 'darts'), 100, 1)],
      ['Completed', `${rs.filter((r) => r.completed).length}/${rs.length}`],
    ],
    series: { label: 'Score', get: (r) => r.score },
    doubles: true,
  },
  doubles: {
    title: 'Doubles practice',
    cards: (rs) => [['Double hit %', ratio(sum(rs, 'hits'), sum(rs, 'darts'), 100, 1)], ['Darts thrown', sum(rs, 'darts')]],
    series: { label: 'Hit %', get: (r) => r.hitPct },
    doubles: true,
  },
  checkout: {
    title: 'Checkout practice',
    cards: (rs) => [
      ['Success %', ratio(sum(rs, 'success'), sum(rs, 'attempts'), 100, 1)],
      ['Finishes', `${sum(rs, 'success')}/${sum(rs, 'attempts')}`],
      ['Darts per success', ratio(sum(rs, 'successDarts'), sum(rs, 'success'), 1, 1) || '–'],
    ],
    series: { label: 'Success %', get: (r) => r.successPct },
  },
  target: {
    title: 'Target practice',
    groupBy: 'target',
    cards: (rs) => [
      ['Hit %', ratio(sum(rs, 'exact'), sum(rs, 'darts'), 100, 1)],
      ['Number hit %', ratio(sum(rs, 'number'), sum(rs, 'darts'), 100, 1)],
      ['Points per visit', ratio(sum(rs, 'points'), sum(rs, 'darts'), 3, 1)],
      ['Darts', sum(rs, 'darts')],
    ],
    series: { label: 'Hit %', get: (r) => r.exactPct },
  },
  atc: {
    title: 'Around the Clock',
    groupBy: 'mode',
    cards: (rs) => [
      ['Best (darts)', minPos(rs.filter((r) => r.finished), 'finishDarts') || '–'],
      ['Average (darts)', (() => { const f = rs.filter((r) => r.finished); return f.length ? Math.round(sum(f, 'finishDarts') / f.length) : '–'; })()],
      ['Hit %', ratio(sum(rs, 'hits'), sum(rs, 'darts'), 100, 1)],
    ],
    series: { label: 'Darts needed', get: (r) => (r.finished ? r.finishDarts : null) },
  },
  countup: {
    title: 'Count Up',
    cards: (rs) => [['Best total', max(rs, 'total')], ['Average per visit', ratio(sum(rs, 'points'), sum(rs, 'darts'), 3, 1)]],
    series: { label: 'Total', get: (r) => r.total },
  },
};

const GROUP_LABEL = { any: 'any segment', single: 'singles', double: 'doubles', treble: 'trebles' };

/** Statistics for one player: [{stype, title, count, wins, cards, series:[{ts, v}], doubles}] */
export function playerStats(history, pid) {
  const groups = new Map();
  for (const rec of history) {
    const st = rec.stats && rec.stats[pid];
    if (!st) continue;
    const def = STAT_TYPES[rec.stype];
    const sub = def && def.groupBy ? st[def.groupBy] : '';
    const key = rec.stype + (sub ? ':' + sub : '');
    if (!groups.has(key)) {
      const t = def ? def.title : rec.title;
      groups.set(key, { key, stype: rec.stype, title: sub ? `${t} – ${GROUP_LABEL[sub] || sub}` : t, recs: [], entries: [], wins: 0 });
    }
    const g = groups.get(key);
    g.recs.push(st);
    g.entries.push(rec);
    if (rec.winner === pid && rec.players.length > 1) g.wins++;
  }
  return [...groups.values()].map((g) => {
    const def = STAT_TYPES[g.stype];
    const out = { key: g.key, stype: g.stype, title: g.title, count: g.recs.length, wins: g.wins, multi: g.entries.filter((e) => e.players.length > 1).length };
    out.cards = def ? def.cards(g.recs) : [];
    out.last = g.entries[g.entries.length - 1].ts;
    if (def && def.series) {
      out.seriesLabel = def.series.label;
      out.series = g.entries.map((e, k) => ({ ts: e.ts, v: def.series.get(g.recs[k]) })).filter((p) => p.v !== null && p.v !== undefined);
    }
    if (def && def.doubles) {
      const per = {};
      for (const r of g.recs) for (const [t, [h, a]] of Object.entries(r.per || {})) {
        per[t] = per[t] || [0, 0]; per[t][0] += h; per[t][1] += a;
      }
      out.doubles = per;
    }
    return out;
  }).sort((a, b) => b.last - a.last);
}
