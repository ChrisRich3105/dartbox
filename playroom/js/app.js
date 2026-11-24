// Dartbox Playroom – UI, game hosting, Autodarts board input, phone remote.
import { GAMES } from './games.js';
import { TRAININGS } from './training.js';
import { label, score } from './darts.js';
import { playerStats } from './stats.js';

const ALL = [...GAMES, ...TRAININGS];
const BY_ID = Object.fromEntries(ALL.map((G) => [G.id, G]));
const $app = document.getElementById('app');
// Identity of this browser tab; survives reloads and navigating away and back (sessionStorage)
const TAB = (() => {
  const fresh = Math.random().toString(36).slice(2);
  try {
    let t = sessionStorage.getItem('pr.tab');
    if (!t) { t = fresh; sessionStorage.setItem('pr.tab', t); }
    return t;
  } catch { return fresh; }
})();
const isKiosk = ['localhost', '127.0.0.1'].includes(location.hostname);

// ------------------------------------------------------------------ utils
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('pr.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pr.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const api = {
  async get(p) { const r = await fetch('/api/' + p, { cache: 'no-store' }); return r.json(); },
  async send(method, p, body) {
    const r = await fetch('/api/' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return r.json().catch(() => ({}));
  },
};
const fmtDate = (ts) => new Date(ts * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

let toastTimer = null;
function toast(text, kind = 'info', ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = text; t.className = kind; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

document.getElementById('hublink').href = `http://${location.hostname}/`;

// ------------------------------------------------------------------ hosting state
let game = null;            // Game instance hosted in this tab
let sel = null;             // dart slot selected for correction
let mod = 1;                // keypad multiplier for the next number
let lastMsgT = 0;
let lastHistoryId = null;
let page = 'home';

function keyOf() { const s = game.s; return `${s.set}.${s.leg}.${s.visitNo}`; }

function restoreGame(data) {
  const G = BY_ID[data.type];
  if (!G) return null;
  return new G(data.cfg, [], data);
}

function hostGame(g) {
  game = g; sel = null; mod = 1; lastMsgT = Date.now(); lastHistoryId = null;
  board.seen = null; board.key = null; remoteIn.since = null;
  saveActive();
}

let saveTimer = null;
function saveActive() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!game) return;
    const G = game.constructor;
    await api.send('PUT', 'active', {
      hostId: TAB, beat: Date.now(), title: G.title, game: game.toJSON(), view: game.view(),
      visit: game.s.visit, cur: game.name(game.cur), visitClosed: game.s.visitClosed,
      legWinner: game.s.legWinner, matchOver: game.s.matchOver,
    }).catch(() => {});
  }, 80);
}
setInterval(() => { if (game) saveActive(); }, 3000);   // heartbeat for remotes

/** run a game action, then persist / render / save history */
function act(fn) {
  if (!game) return false;
  const r = fn();
  const s = game.s;
  if (s.msg && s.msg.t > lastMsgT) { lastMsgT = s.msg.t; toast(s.msg.text, s.msg.kind); }
  if (s.matchOver && !s.saved) { s.saved = true; saveHistory(false); }
  saveActive();
  if (page === 'game') renderGame();
  return r;
}

async function saveHistory(partial) {
  const G = game.constructor, s = game.s;
  if (lastHistoryId) { await api.send('DELETE', 'history/' + lastHistoryId); lastHistoryId = null; }
  const rec = {
    type: G.id, stype: G.stype, title: G.title, training: !!G.training, partial, cfg: game.cfg,
    players: s.players,
    winner: s.winner !== null && s.winner !== undefined ? s.players[s.winner].id : null,
    ranking: (s.ranking || []).map((i) => s.players[i].id),
    stats: Object.fromEntries(s.players.map((p, i) => [p.id, game.summary(i)])),
  };
  const r = await api.send('POST', 'history', rec);
  lastHistoryId = r.id || null;
}

function inputDart(d) {
  if (sel !== null) { const i = sel; sel = null; act(() => game.correct(i, d)); }
  else act(() => game.dart(d));
}

// ------------------------------------------------------------------ Autodarts board input
const board = { on: store.get('board', isKiosk), seen: null, key: null, st: null };

function boardChip() {
  const c = document.getElementById('boardchip');
  if (!board.on) { c.className = 'chip'; c.textContent = 'Board off'; return; }
  const st = board.st;
  if (!st) { c.className = 'chip wait'; c.textContent = 'Board …'; return; }
  if (!st.ok) { c.className = 'chip err'; c.textContent = 'Board offline'; return; }
  const takeout = st.status && st.status.startsWith('takeout');
  c.className = 'chip ' + (takeout ? 'wait' : 'on');
  c.textContent = takeout ? 'Board: takeout' : `Board on · ${st.throws.length} in board`;
}

document.getElementById('boardchip').onclick = async () => {
  if (board.on && board.st && board.st.ok && board.st.status && board.st.status.startsWith('takeout')
      && confirm('Board seems stuck in takeout. Reset the board manager?')) {
    await api.send('POST', 'board/reset'); return;
  }
  board.on = !board.on; board.seen = null; board.st = null;
  store.set('board', board.on); boardChip();
  toast(board.on ? 'Automatic detection on' : 'Automatic detection off – enter darts manually', 'info');
};

async function pollBoard() {
  try {
    if (!board.on) return;
    let st;
    try { st = await api.get('board'); } catch { st = { ok: false, throws: [] }; }
    board.st = st;
    if (!st.ok || !game) { board.seen = null; return; }
    const t = st.throws || [];
    if (board.seen === null) { board.seen = t.length; return; }      // ignore darts already in the board
    if (t.length < board.seen) {                                      // darts pulled -> takeout finished
      if (board.key && board.key === keyOf()) act(() => game.next());
      board.key = null;
      board.seen = t.length;
    }
    while (board.seen < t.length) {
      const d = t[board.seen++];
      if (!board.key) board.key = keyOf();
      if (game.canThrow()) act(() => game.dart({ n: d.n, m: d.m }));
    }
  } finally {
    boardChip();
    setTimeout(pollBoard, 350);
  }
}

// ------------------------------------------------------------------ phone remote: host side
const remoteIn = { since: null };
async function pollRemote() {
  try {
    if (!game) return;
    const r = await api.get('input?since=' + (remoteIn.since ?? 0));
    if (remoteIn.since === null) { remoteIn.since = r.seq; return; }
    for (const it of r.items) {
      remoteIn.since = Math.max(remoteIn.since, it.seq);
      if (it.action === 'dart' && it.dart) act(() => game.dart(it.dart));
      else if (it.action === 'correct' && it.dart) act(() => game.correct(it.index, it.dart));
      else if (it.action === 'undo') act(() => game.undo());
      else if (it.action === 'next') act(() => game.next());
    }
  } catch { /* server restarting */ } finally {
    setTimeout(pollRemote, 600);
  }
}

// ------------------------------------------------------------------ router
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  page = parts[0] || 'home';
  remoteLast = ''; lastGameHTML = '';
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active',
    a.dataset.nav === page || (a.dataset.nav === 'home' && ['home', 'setup', 'game', 'remote'].includes(page))));
  $app.className = page === 'game' || page === 'remote' ? 'full' : '';
  ({ home: renderHome, setup: () => renderSetup(parts[1]), game: renderGame, remote: renderRemote,
     stats: () => renderStats(parts[1]), players: renderPlayers }[page] || renderHome)();
}
window.addEventListener('hashchange', route);

// ------------------------------------------------------------------ home
async function renderHome() {
  let active = null;
  if (!game) { try { active = await api.get('active'); } catch { /* ignore */ } }
  const fresh = active && active.hostId !== TAB && Date.now() - active.beat < 8000;
  let banner = '';
  if (game) {
    banner = `<div class="card resume"><div class="grow"><b>${esc(game.constructor.title)}</b> is running here<br><span class="mut">${esc(game.view().info)}</span></div>
      <a href="#/game"><button class="primary">Back to game</button></a></div>`;
  } else if (active && active.game && !active.matchOver) {
    banner = `<div class="card resume"><div class="grow"><b>${esc(active.title)}</b> ${fresh ? 'is running on another screen' : 'was not finished'}<br>
      <span class="mut">${esc(active.view && active.view.info)}</span></div>
      ${fresh ? '<a href="#/remote"><button class="primary">Remote keypad</button></a>' : ''}
      <button id="takeover" class="${fresh ? '' : 'primary'}">${fresh ? 'Take over here' : 'Resume'}</button>
      ${fresh ? '' : '<button id="discard" class="ghost">Discard</button>'}</div>`;
  }
  const tiles = (list) => list.map((G) => `<a class="tile" href="#/setup/${G.id}"><b>${esc(G.title)}</b><span>${esc(G.desc)}</span></a>`).join('');
  $app.innerHTML = `${banner}
    <h2>Games</h2><div class="grid">${tiles(GAMES)}</div>
    <h2>Training</h2><div class="grid">${tiles(TRAININGS)}</div>
    <footer class="about" id="about"></footer>`;
  renderAbout();
  const tk = document.getElementById('takeover');
  if (tk) tk.onclick = () => { const g = restoreGame(active.game); if (g) { hostGame(g); location.hash = '#/game'; } };
  const dc = document.getElementById('discard');
  if (dc) dc.onclick = async () => { if (confirm('Discard the unfinished game?')) { await api.send('DELETE', 'active'); renderHome(); } };
}

async function renderAbout() {
  let a;
  try { a = await api.get('about'); } catch { return; }
  const el = document.getElementById('about');
  if (!el) return;
  const hub = `http://${location.hostname}/#system`;
  el.innerHTML = [
    a.version ? `Dartbox ${esc(a.version)}` : '',
    a.update_available ? `<a href="${hub}">⬆️ Update ${esc(a.update_tag)} available</a>` : '',
    a.support_url ? `<a class="coffee" href="${esc(a.support_url)}" target="_blank" rel="noopener">☕ Buy me a coffee</a>` : '',
  ].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------------ setup
async function renderSetup(id) {
  const G = BY_ID[id];
  if (!G) { location.hash = '#/'; return; }
  let players = [];
  try { players = await api.get('players'); } catch { /* offline */ }
  const known = new Map(players.map((p) => [p.id, p]));
  let chosen = store.get('lastPlayers.' + id, store.get('lastPlayers', [])).filter((pid) => known.has(pid));
  const cfg = { ...Object.fromEntries(G.settings.map((s) => [s.key, s.default])), ...store.get('cfg.' + id, {}) };

  const draw = () => {
    const pool = players.filter((p) => !chosen.includes(p.id));
    const count = chosen.length;
    const okCount = count >= G.minPlayers && count <= G.maxPlayers;
    $app.innerHTML = `
      <h1>${esc(G.title)} ${G.training ? '<span class="chip">Training</span>' : ''}</h1>
      <p class="mut" style="margin-top:-8px">${esc(G.desc)}</p>
      <div class="setup">
        <div class="card">
          <h3>Players <span class="mut">(${G.minPlayers === G.maxPlayers ? G.minPlayers : `${G.minPlayers}–${G.maxPlayers}`})</span></h3>
          <ul class="plist">${chosen.map((pid, k) => `<li><span class="mut">${k + 1}.</span><span class="nm">${esc(known.get(pid).name)}</span>
            <button data-up="${k}" ${k ? '' : 'disabled'}>↑</button><button data-dn="${k}" ${k < count - 1 ? '' : 'disabled'}>↓</button><button data-rm="${k}">✕</button></li>`).join('')
            || '<li class="mut">Tap names below to add players</li>'}</ul>
          <div class="row" style="margin-top:8px"><button id="shuffle" ${count > 1 ? '' : 'disabled'}>🔀 Shuffle order</button></div>
          <div class="pchips">${pool.map((p) => `<button class="pchip" data-add="${p.id}">+ ${esc(p.name)}</button>`).join('')}</div>
          <form id="newp" class="row"><input type="text" id="newname" placeholder="New player name" maxlength="24" autocomplete="off" style="flex:1"><button>Add</button></form>
        </div>
        <div class="card">
          <h3>Settings</h3>
          ${G.settings.map((s) => `<div class="setting"><label>${esc(s.label)}</label><select data-set="${s.key}">${
            s.options.map(([v, l], k) => `<option value="${k}" ${String(v) === String(cfg[s.key]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`).join('')
            || '<p class="mut">No settings.</p>'}
          <button id="start" class="primary" style="width:100%;margin-top:6px" ${okCount ? '' : 'disabled'}>Start ${esc(G.title)}</button>
          ${okCount ? '' : `<p class="mut">Choose ${G.minPlayers}${G.maxPlayers > G.minPlayers ? `–${G.maxPlayers}` : ''} player(s).</p>`}
        </div>
      </div>`;
    $app.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => { if (chosen.length < G.maxPlayers) { chosen.push(b.dataset.add); draw(); } });
    $app.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { chosen.splice(+b.dataset.rm, 1); draw(); });
    $app.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { const k = +b.dataset.up; [chosen[k - 1], chosen[k]] = [chosen[k], chosen[k - 1]]; draw(); });
    $app.querySelectorAll('[data-dn]').forEach((b) => b.onclick = () => { const k = +b.dataset.dn; [chosen[k + 1], chosen[k]] = [chosen[k], chosen[k + 1]]; draw(); });
    $app.querySelectorAll('[data-set]').forEach((el) => el.onchange = () => {
      const s = G.settings.find((x) => x.key === el.dataset.set);
      cfg[s.key] = s.options[+el.value][0];
    });
    document.getElementById('shuffle').onclick = () => { chosen.sort(() => Math.random() - 0.5); draw(); };
    document.getElementById('newp').onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('newname').value.trim();
      if (!name) return;
      const p = await api.send('POST', 'players', { name });
      if (!p.id) { toast(p.error || 'Could not add player', 'bad'); return; }
      if (!known.has(p.id)) { players.unshift(p); known.set(p.id, p); }
      if (!chosen.includes(p.id) && chosen.length < G.maxPlayers) chosen.push(p.id);
      draw();
      document.getElementById('newname').focus();
    };
    document.getElementById('start').onclick = async () => {
      store.set('cfg.' + id, cfg);
      store.set('lastPlayers.' + id, chosen);
      store.set('lastPlayers', chosen);
      api.send('POST', 'players/touch', { ids: chosen });
      if (game && !game.s.matchOver && !confirm('A game is running here. Replace it?')) return;
      hostGame(new G({ ...cfg }, chosen.map((pid) => known.get(pid))));
      location.hash = '#/game';
    };
  };
  draw();
}

// ------------------------------------------------------------------ scoreboard (shared by host and remote)
function scoreboardHTML(v, visit, opts = {}) {
  const cols = v.cols.map((c) => `<div class="pcol ${c.active ? 'active' : ''} ${c.out ? 'out' : ''} ${c.winner ? 'winner' : ''}">
      ${c.legs || c.sets ? `<div class="legs">${c.sets ? `S ${c.sets} · ` : ''}L ${c.legs}</div>` : ''}
      <div class="nm">${esc(c.name)}</div><div class="big">${esc(c.big)}</div>
      ${c.sub.filter(Boolean).map((x) => `<div class="sub ${x === 'KILLER' ? 'tag' : ''}">${esc(x)}</div>`).join('')}</div>`).join('');
  let grid = '';
  if (v.grid) {
    const act = v.cols.findIndex((c) => c.active);
    grid = `<table class="cgrid"><tr><th></th>${v.cols.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr>
      ${v.grid.rows.map((r) => `<tr class="${r.dead ? 'dead' : ''}"><td class="lbl">${esc(r.label)}</td>${
        r.cells.map((x, i) => `<td class="${i === act ? 'curc' : ''}">${esc(x)}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  const slots = [0, 1, 2].map((k) => {
    const d = visit[k];
    return `<div class="slot ${d ? '' : 'empty'} ${opts.sel === k ? 'sel' : ''}" data-slot="${k}">${d ? esc(label(d)) : '–'}</div>`;
  }).join('');
  const sum = visit.reduce((a, d) => a + score(d), 0);
  return `<div class="board">${cols}</div>${grid}
    <div class="visitbar">${slots}<div class="visitsum">${visit.length ? sum : ''}</div><div class="hint">${esc(v.hint || '')}</div></div>`;
}

function keypadHTML() {
  const nums = Array.from({ length: 20 }, (_, k) => k + 1);
  return `<div class="keypad">
    ${nums.map((n) => `<button data-n="${n}">${n}</button>`).join('')}
    <button data-n="25" data-m="1">25</button><button data-n="25" data-m="2">Bull</button>
    <button class="mod" data-mod="2">Double</button>
    <button class="mod" data-mod="3">Treble</button>
    <button class="miss" data-n="0">Miss</button>
    <button data-undo="1">↶ Undo</button>
    <button class="next wide2" data-next="1">Next ▶</button>
  </div>`;
}

/** update keypad labels for the current modifier without rebuilding it (taps never get lost) */
function refreshKeypad() {
  const pre = mod === 3 ? 'T' : mod === 2 ? 'D' : '';
  $app.querySelectorAll('.keypad [data-n]').forEach((b) => {
    const n = +b.dataset.n;
    if (n >= 1 && n <= 20) b.textContent = pre + n;
  });
  $app.querySelectorAll('.keypad [data-mod]').forEach((b) => b.classList.toggle('on', +b.dataset.mod === mod));
}

function bindKeypad(send) {
  $app.querySelectorAll('[data-mod]').forEach((b) => b.onclick = () => { mod = mod === +b.dataset.mod ? 1 : +b.dataset.mod; refreshKeypad(); });
  $app.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => {
    const n = +b.dataset.n;
    let d;
    if (n === 0) d = { n: 0, m: 0 };
    else if (n === 25) d = { n: 25, m: mod === 2 ? 2 : +b.dataset.m };
    else d = { n, m: mod };
    mod = 1; refreshKeypad();
    send({ dart: d });
  });
  $app.querySelector('[data-undo]').onclick = () => { mod = 1; refreshKeypad(); send({ undo: true }); };
  $app.querySelector('[data-next]').onclick = () => { mod = 1; refreshKeypad(); send({ next: true }); };
  refreshKeypad();
}

function statusLine(s) {
  if (s.matchOver) return '';
  if (s.legWinner !== null && s.legWinner !== undefined) return board.on ? 'Leg over – pull the darts (or press Next) to start the next leg' : 'Leg over – press Next to start the next leg';
  if (s.visitClosed) return board.on ? 'Pull the darts (or press Next)' : 'Press Next for the next player';
  return '';
}

// ------------------------------------------------------------------ game page (host)
let lastGameHTML = '';
async function renderGame() {
  if (!game) {
    let active = null;
    try { active = await api.get('active'); } catch { /* ignore */ }
    if (active && active.game && active.hostId !== TAB && Date.now() - active.beat < 8000) { location.hash = '#/remote'; return; }
    if (active && active.game && !active.matchOver) { const g = restoreGame(active.game); if (g) { hostGame(g); } }
    if (!game) { location.hash = '#/'; return; }
  }
  const G = game.constructor, s = game.s, v = game.view();
  if (s.matchOver) { lastGameHTML = ''; renderResults(); return; }
  if (!document.getElementById('gamepage')) {
    lastGameHTML = '';
    $app.innerHTML = `<div id="gamepage">
      <div class="gamehead"><span class="title" id="gtitle"></span><span class="info" id="ginfo"></span>
        <button id="endgame" class="ghost">End</button></div>
      <div id="sb"></div><div class="waiting" id="st"></div>${keypadHTML()}</div>`;
    bindKeypad((x) => {
      if (x.dart) inputDart(x.dart);
      else if (x.undo) { sel = null; act(() => game.undo()); }
      else if (x.next) { sel = null; act(() => game.next()); }
    });
    document.getElementById('endgame').onclick = endGame;
  }
  if (sel !== null && sel >= s.visit.length) sel = null;
  const html = scoreboardHTML(v, s.visit, { sel });
  document.getElementById('gtitle').textContent = G.title;
  document.getElementById('ginfo').textContent = v.info;
  document.getElementById('st').textContent = sel !== null ? `Correcting dart ${sel + 1} – choose the right segment` : statusLine(s);
  if (html !== lastGameHTML) {
    lastGameHTML = html;
    document.getElementById('sb').innerHTML = html;
    document.querySelectorAll('#sb [data-slot]').forEach((el) => el.onclick = () => {
      const k = +el.dataset.slot;
      if (k < game.s.visit.length) { sel = sel === k ? null : k; renderGame(); }
    });
  }
}

async function endGame() {
  const G = game.constructor;
  const thrown = game.s.ps.some((p) => p.darts > 0 || p.attempts > 0);
  if (G.training && thrown) {
    if (!confirm('End the training session? The darts thrown so far are saved to your statistics.')) return;
    await saveHistory(true);
  } else if (!confirm('End this game without a result?')) return;
  game = null;
  await api.send('DELETE', 'active');
  location.hash = '#/';
}

function renderResults() {
  const G = game.constructor, s = game.s, v = game.view();
  const order = s.ranking || [...Array(game.n).keys()];
  $app.innerHTML = `
    <div class="card" style="max-width:760px;margin:0 auto">
      <h1>🏆 ${esc(G.training ? 'Session complete' : game.name(s.winner) + ' wins!')}</h1>
      <p class="mut">${esc(G.title)} · ${esc(v.info)}</p>
      <ul class="rank">${order.map((i, k) => {
        const c = v.cols[i];
        return `<li><span class="pos">${G.training && game.n === 1 ? '' : k + 1}</span><span class="grow"><b>${esc(c.name)}</b><br>
          <span class="mut">${esc(resultLine(i))}</span></span><b style="font-size:24px">${esc(c.big)}</b></li>`;
      }).join('')}</ul>
      <div class="row" style="margin-top:14px">
        <button id="rematch" class="primary">${G.training ? 'Again' : 'Rematch'}</button>
        <a href="#/setup/${G.id}"><button>Change settings</button></a>
        <button id="undoLast" class="ghost">↶ Undo last dart</button>
        <button id="home" class="ghost">Done</button>
      </div>
      <p class="mut">Results are saved to the statistics.</p>
    </div>`;
  document.getElementById('rematch').onclick = () => {
    const players = s.players.length > 1 && !G.training ? [...s.players.slice(1), s.players[0]] : s.players;
    hostGame(new G({ ...game.cfg }, players));
    renderGame();
  };
  document.getElementById('undoLast').onclick = () => act(() => game.undo());
  document.getElementById('home').onclick = async () => { game = null; await api.send('DELETE', 'active'); location.hash = '#/'; };
}

function resultLine(i) {
  const r = game.summary(i);
  const bits = [];
  if (r.avg !== undefined) bits.push(`⌀ ${r.avg}`);
  if (r.first9) bits.push(`first 9 ⌀ ${r.first9}`);
  if (r.coPct !== undefined && r.coAttempts) bits.push(`checkout ${r.coPct}% (${r.coHits}/${r.coAttempts})`);
  if (r.mpr !== undefined) bits.push(`MPR ${r.mpr}`);
  if (r.hitPct !== undefined) bits.push(`hit ${r.hitPct}%`);
  if (r.successPct !== undefined) bits.push(`success ${r.successPct}% (${r.success}/${r.attempts})`);
  if (r.exactPct !== undefined) bits.push(`${r.exact}/${r.darts} = ${r.exactPct}%, ⌀ ${r.ppv}/visit`);
  if (r.finishDarts) bits.push(`${r.finishDarts} darts`);
  if (r.t180) bits.push(`${r.t180}×180`);
  if (r.darts !== undefined && !r.exactPct && r.exactPct !== 0) bits.push(`${r.darts} darts`);
  return bits.join(' · ');
}

// ------------------------------------------------------------------ remote keypad (phone)
let remoteTimer = null, remoteLast = '', remoteVisitLen = 0;
async function renderRemote() {
  clearTimeout(remoteTimer);
  if (page !== 'remote') return;
  let a = null;
  try { a = await api.get('active'); } catch { /* ignore */ }
  if (page !== 'remote') return;
  const live = a && a.game && a.hostId !== TAB && Date.now() - a.beat <= 8000;
  if (!live) {
    const key = a && a.game ? 'dead:' + a.title : 'none';
    if (key === remoteLast) { remoteTimer = setTimeout(renderRemote, 1500); return; }   // don't rebuild under the user's finger
    remoteLast = key;
    if (!a || !a.game) {
      $app.innerHTML = '<div class="card">No game is running. <a href="#/">Start one</a></div>';
    } else {
      $app.innerHTML = `<div class="card">The screen running <b>${esc(a.title)}</b> is not responding.
        <button id="take" class="primary">Continue the game here</button></div>`;
      document.getElementById('take').onclick = () => { const g = restoreGame(a.game); if (g) { hostGame(g); location.hash = '#/game'; } };
    }
  } else {
    if (!document.getElementById('remotepage') || remoteLast.startsWith('dead:') || remoteLast === 'none') {
      remoteLast = '';
      $app.innerHTML = `<div id="remotepage">
        <div class="gamehead"><span class="title" id="rtitle"></span><span class="info" id="rinfo"></span></div>
        <div id="sb"></div><div class="waiting" id="st"></div><div id="kp">${keypadHTML()}</div></div>`;
      bindKeypad(async (x) => {
        let body;
        if (x.dart) body = sel !== null ? { action: 'correct', index: sel, dart: x.dart } : { action: 'dart', dart: x.dart };
        else body = { action: x.undo ? 'undo' : 'next' };
        sel = null;
        await api.send('POST', 'input', body);
        setTimeout(renderRemote, 500);
      });
    }
    const visit = a.visit || [];
    remoteVisitLen = visit.length;
    if (sel !== null && sel >= visit.length) sel = null;
    const html = scoreboardHTML(a.view, visit, { sel });
    document.getElementById('rtitle').textContent = a.title;
    document.getElementById('rinfo').textContent = 'Remote keypad · ' + a.view.info;
    document.getElementById('st').textContent = a.matchOver ? 'Game over – see the screen'
      : sel !== null ? `Correcting dart ${sel + 1} – choose the right segment` : statusLine(a);
    document.getElementById('kp').hidden = !!a.matchOver;
    if (html !== remoteLast) {
      remoteLast = html;
      document.getElementById('sb').innerHTML = html;
      document.querySelectorAll('#sb [data-slot]').forEach((el) => el.onclick = () => {
        const k = +el.dataset.slot;
        if (k < remoteVisitLen) { sel = sel === k ? null : k; renderRemote(); }
      });
    }
  }
  remoteTimer = setTimeout(renderRemote, 1500);
}

// ------------------------------------------------------------------ players
async function renderPlayers() {
  const players = await api.get('players');
  $app.innerHTML = `<h1>Players</h1>
    <div class="card"><form id="newp" class="row"><input type="text" id="newname" placeholder="New player name" maxlength="24" style="flex:1"><button class="primary">Add</button></form></div>
    <div class="card"><ul class="plist">${players.map((p) => `<li><span class="nm">${esc(p.name)}</span>
      <a href="#/stats/${p.id}"><button>Stats</button></a><button data-ren="${p.id}">Rename</button><button data-del="${p.id}" class="danger">Remove</button></li>`).join('')
      || '<li class="mut">No players yet.</li>'}</ul></div>`;
  document.getElementById('newp').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('newname').value.trim();
    if (name) { await api.send('POST', 'players', { name }); renderPlayers(); }
  };
  $app.querySelectorAll('[data-ren]').forEach((b) => b.onclick = async () => {
    const p = players.find((x) => x.id === b.dataset.ren);
    const name = prompt('New name', p.name);
    if (name && name.trim()) { const r = await api.send('PUT', 'players/' + p.id, { name }); if (r.error) toast(r.error, 'bad'); renderPlayers(); }
  });
  $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const p = players.find((x) => x.id === b.dataset.del);
    if (confirm(`Remove ${p.name} from the name list? Their statistics stay saved.`)) { await api.send('DELETE', 'players/' + p.id); renderPlayers(); }
  });
}

// ------------------------------------------------------------------ statistics
function sparkSVG(series) {
  const pts = series.slice(-40);
  if (pts.length < 2) return '<p class="mut">Play more sessions to see a trend.</p>';
  const vs = pts.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const W = 600, H = 100, P = 6;
  const xy = pts.map((p, k) => [P + (k * (W - 2 * P)) / (pts.length - 1), H - P - ((p.v - lo) * (H - 2 * P)) / span]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <polyline fill="none" stroke="var(--acc)" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${xy.map((p) => p.join(',')).join(' ')}"/>
    ${xy.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--acc)"><title>${fmtDate(pts[k].ts)}: ${pts[k].v}</title></circle>`).join('')}
    <text x="${P}" y="12" fill="var(--mut)" font-size="12">max ${hi}</text>
    <text x="${P}" y="${H - 2}" fill="var(--mut)" font-size="12">min ${lo}</text></svg>`;
}

function doublesGrid(per) {
  const keys = [...Array.from({ length: 20 }, (_, k) => String(k + 1)), '25'].filter((k) => per[k]);
  if (!keys.length) return '';
  return `<div class="dgrid">${keys.map((k) => {
    const [h, a] = per[k], p = a ? h / a : 0;
    return `<div style="background:hsl(${Math.round(p * 120)} 55% 22%)"><b>${k === '25' ? 'Bull' : 'D' + k}</b>${Math.round(p * 100)}%<br><span class="mut">${h}/${a}</span></div>`;
  }).join('')}</div>`;
}

async function renderStats(pid) {
  const players = await api.get('players');
  if (!pid && players.length) { location.hash = '#/stats/' + players[0].id; return; }
  const chips = players.map((p) => `<a href="#/stats/${p.id}"><button class="pchip" style="${p.id === pid ? 'background:var(--acc);color:#001425' : ''}">${esc(p.name)}</button></a>`).join('');
  if (!pid) { $app.innerHTML = '<h1>Statistics</h1><p class="mut">No players yet – play a game or training first.</p>'; return; }
  const hist = await api.get('history?player=' + encodeURIComponent(pid));
  const groups = playerStats(hist, pid);
  const name = (players.find((p) => p.id === pid) || {}).name || 'Player';
  $app.innerHTML = `<h1>Statistics</h1><div class="pchips">${chips}</div>
    <h2>${esc(name)}</h2>
    ${groups.map((g) => `<div class="card">
      <div class="row spread"><h3>${esc(g.title)}</h3><span class="mut">${g.count} session${g.count === 1 ? '' : 's'}${g.multi ? ` · ${g.wins} won of ${g.multi}` : ''}</span></div>
      ${g.cards.length ? `<div class="kv">${g.cards.map(([k, v]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>` : ''}
      ${g.series ? `<div class="mut" style="margin-top:8px;font-size:13px">${esc(g.seriesLabel)} per session</div>${sparkSVG(g.series)}` : ''}
      ${g.doubles ? doublesGrid(g.doubles) : ''}
    </div>`).join('') || '<p class="mut">No games or training sessions recorded yet.</p>'}
    ${hist.length ? `<h2>Recent sessions</h2><div class="card"><table class="hist">${hist.slice(-25).reverse().map((r) => `<tr>
      <td>${fmtDate(r.ts)}</td><td><b>${esc(r.title)}</b>${r.partial ? ' <span class="mut">(stopped early)</span>' : ''}</td>
      <td class="mut">${esc(r.players.map((p) => p.name).join(', '))}</td>
      <td>${r.winner === pid && r.players.length > 1 ? '🏆' : ''}</td>
      <td><button class="ghost" data-delh="${r.id}" title="Delete this record">✕</button></td></tr>`).join('')}</table></div>` : ''}`;
  $app.querySelectorAll('[data-delh]').forEach((b) => b.onclick = async () => {
    if (confirm('Delete this session from the statistics (for all its players)?')) { await api.send('DELETE', 'history/' + b.dataset.delh); renderStats(pid); }
  });
}

// ------------------------------------------------------------------ keyboard (kiosk with a keyboard)
document.addEventListener('keydown', (e) => {
  if (page !== 'game' || !game || e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter') { e.preventDefault(); sel = null; act(() => game.next()); }
  else if (e.key === 'Backspace') { e.preventDefault(); sel = null; act(() => game.undo()); }
  else if (e.key === 'd' || e.key === 'D') { mod = mod === 2 ? 1 : 2; refreshKeypad(); }
  else if (e.key === 't' || e.key === 'T') { mod = mod === 3 ? 1 : 3; refreshKeypad(); }
  else if (e.key === 'm' || e.key === 'M') inputDart({ n: 0, m: 0 });
});

// ------------------------------------------------------------------ start
async function start() {
  // Resume a game this box was hosting before a reload (e.g. browser restarted)
  try {
    const a = await api.get('active');
    if (a && a.game && !a.matchOver && (a.hostId === TAB || (isKiosk && Date.now() - a.beat > 8000))) {
      const g = restoreGame(a.game);
      if (g) { hostGame(g); if (!location.hash || location.hash === '#/') location.hash = '#/game'; }
    }
  } catch { /* server not reachable yet */ }
  route();
  boardChip();
  pollBoard();
  pollRemote();
}
start();

// exposed for tests / debugging
window.__playroom = { BY_ID, get game() { return game; } };
