// Dartbox Playroom – UI, game hosting, Autodarts board input, phone remote.
import { GAMES } from './games.js';
import { TRAININGS } from './training.js';
import { label, score } from './darts.js';
import { playerStats } from './stats.js';
import { getSettings, setSetting, resetSettings, DESCRIPTIONS, onSettings } from './settings.js';
import { play, call, unlockAudio, loadServerVoices, hasNaturalVoice, boxVoices, deviceVoices, resolveVoice, sayUrl } from './sound.js';
import { t, tr, setLang, getLang, resolveLang, LANG_CHOICES } from './i18n.js';
import { callerParts, prewarmList } from './caller.js';
import { celebrate, tween } from './fx.js';
import { boardSVG } from './dartboard.js';
import { lineChart, PLAYER_COLORS } from './charts.js';

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

/** run a game action, then persist / render / save history. silent: no sounds/effects (undo, corrections) */
function act(fn, { silent = false } = {}) {
  if (!game) return false;
  game.events = [];
  const r = fn();
  const s = game.s;
  const shown = silent ? false : handleEvents(game.events);
  game.events = [];
  if (s.msg && s.msg.t > lastMsgT) { lastMsgT = s.msg.t; if (!shown) toast(tr(s.msg.text), s.msg.kind); }
  if (s.matchOver && !s.saved) { s.saved = true; saveHistory(false); }
  saveActive();
  if (page === 'game') renderGame();
  return r;
}

// ------------------------------------------------------------------ events -> sounds, effects, caller
const PRIORITY = ['match', 'leg', 'checkout', '180', 'shanghai', 'whitehorse', 'killer', 'gotcha', 'out',
  'bust', 'halved', 'fail', 'marks', 'score', 'hit'];

/** Returns true if a big on-screen effect was shown (then the plain toast is skipped). */
function handleEvents(evts) {
  if (!evts.length || !game) return false;
  const G = game.constructor, nm = (i) => game.name(i), x01 = G.stype === 'x01';
  for (const e of evts) if (e.type === 'dart') play('dart', e.d);
  const top = PRIORITY.map((t) => evts.find((e) => e.type === t)).find(Boolean);
  let shown = false;
  if (top) {
    switch (top.type) {
      case 'match':
        play('match');
        shown = celebrate(G.training ? t('Session complete') : t('{name} wins!', { name: nm(top.i) }), 'win', { confetti: !G.training, sub: tr(G.title), ms: 2800 });
        call(callerParts('match', nm(top.i), x01, !!G.training));
        break;
      case 'leg':
        play('leg');
        shown = celebrate(t('{name} wins the leg', { name: nm(top.i) }), 'win', { ms: 2200 });
        call(callerParts('leg', nm(top.i), x01));
        break;
      case 'checkout': play('checkout'); shown = celebrate(t('Checkout {n}', { n: top.value }), 'great'); call(callerParts('checkout')); break;
      case '180': play('oneEighty'); shown = celebrate('180', 'great', { confetti: true, sub: t('ONE HUNDRED AND EIGHTY') }); call(callerParts('oneEighty')); break;
      case 'shanghai': play('special'); shown = celebrate('Shanghai!', 'great', { confetti: true }); call(callerParts('shanghai')); break;
      case 'whitehorse': play('special'); shown = celebrate(t('White horse'), 'great', { sub: t('9 marks') }); call(callerParts('whitehorse')); break;
      case 'killer': play('special'); shown = celebrate(t('{name} is a killer', { name: nm(top.i) }), 'great'); call(callerParts('killer', nm(top.i))); break;
      case 'gotcha': play('special'); shown = celebrate('Gotcha!', 'great', { sub: t('{name} back to zero', { name: nm(top.victim) }) }); break;
      case 'out': play('out'); shown = celebrate(t('{name} is out', { name: nm(top.i) }), 'bad', { ms: 1500 }); call(callerParts('out', nm(top.i))); break;
      case 'bust': play('bust'); shown = celebrate(t('Bust'), 'bad', { ms: 1300 }); call(callerParts('bust')); break;
      case 'halved': play('fail'); shown = celebrate(t('Halved!'), 'bad', { ms: 1300 }); break;
      case 'fail': play('fail'); break;
      case 'marks': play('big'); shown = celebrate(t('{n} marks', { n: top.marks }), 'good', { ms: 1300 }); break;
      case 'score':
        if (top.points >= 100) { play('big'); shown = celebrate(String(top.points), 'good', { ms: 1300, sub: top.points >= 140 ? t('TON FORTY PLUS') : t('TON PLUS') }); }
        call(callerParts('score', top.points));
        break;
      case 'hit': play('hit'); break;
      default: break;
    }
  }
  const turn = evts.filter((e) => e.type === 'turn').pop();
  if (turn && turn.call) {
    const m = /, you require (\d+)$/.exec(turn.call);       // engine says "Name, you require N"
    if (m) call(callerParts('require', nm(turn.i), +m[1]), { interrupt: false });
  }
  return shown;
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
    hist: Object.fromEntries(s.players.map((p, i) => [p.id, (s.hist && s.hist[i]) || {}])),
  };
  const r = await api.send('POST', 'history', rec);
  lastHistoryId = r.id || null;
}

function inputDart(d) {
  if (sel !== null) { const i = sel; sel = null; act(() => game.correct(i, d), { silent: true }); }
  else act(() => game.dart(d));
}

// ------------------------------------------------------------------ Autodarts board input
const board = { on: store.get('board', isKiosk), seen: null, key: null, st: null, health: null, takeoutSince: 0 };
const TAKEOUT_STUCK_MS = 20000;
const isTakeout = (st) => !!(st && st.status && st.status.startsWith('takeout'));
const takeoutStuck = () => board.takeoutSince > 0 && Date.now() - board.takeoutSince > TAKEOUT_STUCK_MS;

function boardChip() {
  const c = document.getElementById('boardchip');
  if (!board.on) { c.className = 'chip'; c.textContent = t('Board off'); return; }
  const st = board.st, h = board.health;
  if (!st) { c.className = 'chip wait'; c.textContent = t('Board …'); return; }
  if (!st.ok) { c.className = 'chip err'; c.textContent = t('Board offline'); return; }
  if (h && h.ok && h.calibrating) { c.className = 'chip wait'; c.textContent = t('Board: calibrating …'); return; }
  if (h && h.ok && h.calibrated === false) { c.className = 'chip err'; c.textContent = t('Board: not calibrated'); return; }
  if (st.running === false) { c.className = 'chip wait'; c.textContent = t('Board: stopped'); return; }
  if (isTakeout(st)) {
    const stuck = takeoutStuck();
    c.className = 'chip ' + (stuck ? 'err' : 'wait');
    c.textContent = stuck ? t('Takeout stuck? Tap') : t('Board: takeout');
    return;
  }
  c.className = 'chip on';
  c.textContent = t('Board on · {n} in board', { n: st.throws.length });
}

document.getElementById('boardchip').onclick = () => openBoardPanel();

// The slower health check (calibration, cameras) feeds the chip even while the panel is closed.
async function pollBoardHealth() {
  try {
    if (board.on && !boardPanel.open) board.health = await api.get('board/status');
  } catch { board.health = null; } finally {
    boardChip();
    setTimeout(pollBoardHealth, 6000);
  }
}

// ------------------------------------------------------------------ board panel (status, reset, calibrate)
const boardPanel = { open: false, timer: null, imgTimer: null, busy: '', lastSrc: '' };

function openBoardPanel() {
  let el = document.getElementById('boardpanel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'boardpanel';
    el.innerHTML = '<div class="bp-sheet" role="dialog" aria-modal="true"></div>';
    el.onclick = (e) => { if (e.target === el) closeBoardPanel(); };
    document.body.appendChild(el);
  }
  el.hidden = false;
  boardPanel.open = true;
  renderBoardSheet(board.health);
  refreshBoardPanel();
  refreshBoardImage();
}

function closeBoardPanel() {
  boardPanel.open = false;
  clearTimeout(boardPanel.timer); clearTimeout(boardPanel.imgTimer);
  const el = document.getElementById('boardpanel');
  if (el) el.hidden = true;
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && boardPanel.open) closeBoardPanel(); });

async function refreshBoardPanel() {
  clearTimeout(boardPanel.timer);
  if (!boardPanel.open) return;
  try { board.health = await api.get('board/status'); } catch { board.health = { ok: false }; }
  if (!boardPanel.open) return;
  renderBoardSheet(board.health);
  boardChip();
  boardPanel.timer = setTimeout(refreshBoardPanel, board.health && board.health.calibrating ? 1000 : 2000);
}

// Camera picture: loaded off-screen and swapped in, so it never flickers
function refreshBoardImage() {
  clearTimeout(boardPanel.imgTimer);
  if (!boardPanel.open) return;
  const next = new Image();
  next.onload = () => {
    boardPanel.lastSrc = next.src;
    const box = document.querySelector('#boardpanel .bp-cam');
    if (box) { box.querySelector('img').src = next.src; box.classList.remove('nocam'); }
    boardPanel.imgTimer = setTimeout(refreshBoardImage, 1500);
  };
  next.onerror = () => {
    boardPanel.lastSrc = '';
    const box = document.querySelector('#boardpanel .bp-cam');
    if (box) box.classList.add('nocam');
    boardPanel.imgTimer = setTimeout(refreshBoardImage, 4000);
  };
  next.src = 'api/board/image?t=' + Date.now();
}

function boardHeadline(h) {
  if (!h) return ['wait', '…', t('Checking the board …'), ''];
  if (!h.ok) return ['err', '⚠', t('Board manager not reachable'), t('Is Autodarts running on the box? A restart of the box usually helps.')];
  if (h.calibrating) return ['wait', '🎯', t('Calibrating …'), t('Keep the board empty until it is finished.')];
  if (h.calibrated === false) return ['err', '⚠', t('Not calibrated'), t('Take all darts out of the board and press Calibrate.')];
  if (h.running === false) return ['wait', '⏸', t('Detection is stopped'), t('Press Start to detect darts again.')];
  if (isTakeout(h)) {
    return takeoutStuck()
      ? ['err', '✋', t('Takeout seems stuck'), t('All darts out of the board? Then press Reset.')]
      : ['wait', '✋', t('Takeout – pull the darts'), t('Detection continues once the board is empty.')];
  }
  return ['ok', '✓', t('Ready – throw!'), h.throws && h.throws.length ? t('{n} darts in the board', { n: h.throws.length }) : t('Board is empty.')];
}

function renderBoardSheet(h) {
  const sheet = document.querySelector('#boardpanel .bp-sheet');
  if (!sheet) return;
  const [kind, icon, title, sub] = boardHeadline(h);
  const ok = !!(h && h.ok);
  const busy = boardPanel.busy;
  const yes = (b) => (b ? `<span class="good">${t('yes')}</span>` : `<span class="bad">${t('no')}</span>`);
  const cams = ok && h.cams && h.cams.length ? h.cams.map((c, i) => {
    const cls = c.failed || !c.calibrated ? 'bad' : c.calibrating ? 'wait' : 'good';
    const what = c.calibrating ? t('calibrating') : c.failed ? t('failed') : c.calibrated ? '✓' : t('not calibrated');
    const err = c.calibrated && c.error_px !== null && c.error_px !== undefined ? ` · ${c.error_px} px` : '';
    return `<span class="bp-camchip ${cls}" title="${esc(t('Calibration error (lower is better)'))}">${t('Cam {n}', { n: i + 1 })}: ${what}${err}${c.fps ? ` · ${c.fps} fps` : ''}</span>`;
  }).join('') : '';
  const inBoard = ok && h.throws && h.throws.length ? h.throws.map((d) => esc(label(d))).join(' · ') : '';
  const dis = (cond) => (cond ? '' : 'disabled');
  sheet.innerHTML = `
    <div class="bp-head"><h2>${t('Autodarts board')}</h2><button class="ghost bp-x" data-bp="close" aria-label="${esc(t('Close'))}">✕</button></div>
    <div class="bp-status ${kind}"><span class="bp-icon">${icon}</span><div><b>${esc(title)}</b>${sub ? `<div class="mut">${esc(sub)}</div>` : ''}</div></div>
    <div class="bp-cam ${boardPanel.lastSrc ? '' : 'nocam'}"><img alt="${esc(t('Live camera picture'))}" ${boardPanel.lastSrc ? `src="${boardPanel.lastSrc}"` : ''}><span class="mut">${t('No camera picture')}</span></div>
    ${ok ? `<div class="bp-facts">
      <div>${t('Detection')}: ${h.running === false ? `<span class="wait">${t('stopped')}</span>` : `<span class="good">${t('running')}</span>`}</div>
      <div>${t('Calibrated')}: ${h.calibrated === null || h.calibrated === undefined ? '–' : yes(h.calibrated)}</div>
      ${inBoard ? `<div>${t('In the board')}: ${inBoard}</div>` : ''}
      ${h.version ? `<div class="mut">${t('Board manager')} ${esc(h.version)}${h.cpu !== null && h.cpu !== undefined ? ` · CPU ${h.cpu}%` : ''}</div>` : ''}
    </div>` : ''}
    ${cams ? `<div class="bp-cams">${cams}</div>` : ''}
    <div class="bp-actions">
      <button class="primary" data-bp="reset" ${dis(ok && !busy)}>${busy === 'reset' ? '…' : t('↺ Reset')}<small>${t('stuck takeout, wrong darts')}</small></button>
      <button data-bp="calibrate" ${dis(ok && !busy && !h.calibrating)}>${busy === 'calibrate' ? '…' : t('🎯 Calibrate')}<small>${t('board must be empty')}</small></button>
      ${ok && h.running === false
        ? `<button data-bp="start" ${dis(!busy)}>${busy === 'start' ? '…' : t('▶ Start detection')}</button>`
        : `<button data-bp="stop" ${dis(ok && !busy)}>${busy === 'stop' ? '…' : t('⏸ Stop detection')}</button>`}
      <button class="ghost" data-bp="restart" ${dis(ok && !busy)}>${busy === 'restart' ? '…' : t('⟳ Restart cameras')}</button>
    </div>
    <label class="setrow"><div><b>${t('Use the board in the playroom')}</b><div class="mut">${t('Off: enter darts by hand (this device only).')}</div></div>
      <input type="checkbox" class="switch" data-bp="toggle" ${board.on ? 'checked' : ''}></label>
    <p class="mut bp-foot"><a href="http://${location.hostname}:3180/" target="_blank" rel="noopener">${t('Open the full board manager')} ↗</a></p>`;
  sheet.querySelectorAll('[data-bp]').forEach((b) => {
    const a = b.dataset.bp;
    if (a === 'toggle') b.onchange = () => setBoardOn(b.checked);
    else b.onclick = () => boardAction(a);
  });
}

const BOARD_CONFIRM = {
  calibrate: 'Calibrate the board now? Take all darts out first – it takes a few seconds.',
  restart: 'Restart the cameras? Detection pauses for a moment.',
  stop: 'Stop dart detection? Darts are then not recognised until you press Start.',
};

async function boardAction(a) {
  if (a === 'close') { closeBoardPanel(); return; }
  if (BOARD_CONFIRM[a] && !confirm(t(BOARD_CONFIRM[a]))) return;
  boardPanel.busy = a; renderBoardSheet(board.health);
  let r;
  try { r = await api.send('POST', 'board/' + a); } catch { r = { ok: false }; }
  boardPanel.busy = '';
  if (r.ok) {
    if (a === 'reset') { board.takeoutSince = 0; board.seen = null; }
    toast({ reset: t('Board reset'), calibrate: t('Calibration started'), start: t('Detection started'),
            stop: t('Detection stopped'), restart: t('Cameras restarting …') }[a], 'ok');
  } else {
    toast(t('The board manager did not accept that ({error})', { error: r.error || '?' }), 'err', 4000);
  }
  refreshBoardPanel();
}

function setBoardOn(on) {
  board.on = on; board.seen = null; board.st = null;
  store.set('board', board.on); boardChip();
  toast(board.on ? t('Automatic detection on') : t('Automatic detection off – enter darts manually'), 'info');
}

async function pollBoard() {
  try {
    if (!board.on) return;
    let st;
    try { st = await api.get('board'); } catch { st = { ok: false, throws: [] }; }
    board.st = st;
    if (isTakeout(st)) { if (!board.takeoutSince) board.takeoutSince = Date.now(); } else board.takeoutSince = 0;
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
      else if (it.action === 'correct' && it.dart) act(() => game.correct(it.index, it.dart), { silent: true });
      else if (it.action === 'undo') act(() => game.undo(), { silent: true });
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
  translateStatic();
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active',
    a.dataset.nav === page || (a.dataset.nav === 'home' && ['home', 'setup', 'game', 'remote'].includes(page))));
  $app.className = page === 'game' || page === 'remote' ? 'full' : '';
  ({ home: renderHome, setup: () => renderSetup(parts[1]), game: renderGame, remote: renderRemote,
     stats: () => renderStats(parts[1]), players: renderPlayers, settings: renderSettings }[page] || renderHome)();
}
window.addEventListener('hashchange', route);

// ------------------------------------------------------------------ home
async function renderHome() {
  let active = null;
  if (!game) { try { active = await api.get('active'); } catch { /* ignore */ } }
  const fresh = active && active.hostId !== TAB && Date.now() - active.beat < 8000;
  let banner = '';
  if (game) {
    banner = `<div class="card resume"><div class="grow">${t('{game} is running here', { game: `<b>${esc(tr(game.constructor.title))}</b>` })}<br><span class="mut">${esc(tr(game.view().info))}</span></div>
      <a href="#/game"><button class="primary">${t('Back to game')}</button></a></div>`;
  } else if (active && active.game && !active.matchOver) {
    banner = `<div class="card resume"><div class="grow"><b>${esc(tr(active.title))}</b> ${fresh ? t('is running on another screen') : t('was not finished')}<br>
      <span class="mut">${esc(tr(active.view && active.view.info))}</span></div>
      ${fresh ? `<a href="#/remote"><button class="primary">${t('Remote keypad')}</button></a>` : ''}
      <button id="takeover" class="${fresh ? '' : 'primary'}">${fresh ? t('Take over here') : t('Resume')}</button>
      ${fresh ? '' : `<button id="discard" class="ghost">${t('Discard')}</button>`}</div>`;
  }
  const tiles = (list) => list.map((G) => `<a class="tile" href="#/setup/${G.id}"><b>${esc(tr(G.title))}</b><span>${esc(tr(G.desc))}</span></a>`).join('');
  $app.innerHTML = `${banner}
    <h2>${t('Games')}</h2><div class="grid">${tiles(GAMES)}</div>
    <h2>${t('Training')}</h2><div class="grid">${tiles(TRAININGS)}</div>
    <footer class="about" id="about"></footer>`;
  renderAbout();
  const tk = document.getElementById('takeover');
  if (tk) tk.onclick = () => { const g = restoreGame(active.game); if (g) { hostGame(g); location.hash = '#/game'; } };
  const dc = document.getElementById('discard');
  if (dc) dc.onclick = async () => { if (confirm(t('Discard the unfinished game?'))) { await api.send('DELETE', 'active'); renderHome(); } };
}

async function renderAbout() {
  let a;
  try { a = await api.get('about'); } catch { return; }
  const el = document.getElementById('about');
  if (!el) return;
  const hub = `http://${location.hostname}/#system`;
  el.innerHTML = [
    a.version ? `Dartbox ${esc(a.version)}` : '',
    a.update_available ? `<a href="${hub}">⬆️ ${t('Update {tag} available', { tag: esc(a.update_tag) })}</a>` : '',
    a.support_url ? `<a class="coffee" href="${esc(a.support_url)}" target="_blank" rel="noopener">${t('☕ Buy me a coffee')}</a>` : '',
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
      <h1>${esc(tr(G.title))} ${G.training ? `<span class="chip">${t('Training')}</span>` : ''}</h1>
      <p class="mut" style="margin-top:-8px">${esc(tr(G.desc))}</p>
      <div class="setup">
        <div class="card">
          <h3>${t('Players')} <span class="mut">(${G.minPlayers === G.maxPlayers ? G.minPlayers : `${G.minPlayers}–${G.maxPlayers}`})</span></h3>
          <ul class="plist">${chosen.map((pid, k) => `<li><span class="mut">${k + 1}.</span><span class="nm">${esc(known.get(pid).name)}</span>
            <button data-up="${k}" ${k ? '' : 'disabled'}>↑</button><button data-dn="${k}" ${k < count - 1 ? '' : 'disabled'}>↓</button><button data-rm="${k}">✕</button></li>`).join('')
            || `<li class="mut">${t('Tap names below to add players')}</li>`}</ul>
          <div class="row" style="margin-top:8px"><button id="shuffle" ${count > 1 ? '' : 'disabled'}>${t('🔀 Shuffle order')}</button></div>
          <div class="pchips">${pool.map((p) => `<button class="pchip" data-add="${p.id}">+ ${esc(p.name)}</button>`).join('')}</div>
          <form id="newp" class="row"><input type="text" id="newname" placeholder="${t('New player name')}" maxlength="24" autocomplete="off" style="flex:1"><button>${t('Add')}</button></form>
        </div>
        <div class="card">
          <h3>${t('Settings')}</h3>
          ${G.settings.map((s) => `<div class="setting"><label>${esc(tr(s.label))}</label><select data-set="${s.key}">${
            s.options.map(([v, l], k) => `<option value="${k}" ${String(v) === String(cfg[s.key]) ? 'selected' : ''}>${esc(tr(l))}</option>`).join('')}</select></div>`).join('')
            || `<p class="mut">${t('No settings.')}</p>`}
          <button id="start" class="primary" style="width:100%;margin-top:6px" ${okCount ? '' : 'disabled'}>${t('Start {game}', { game: esc(tr(G.title)) })}</button>
          ${okCount ? '' : `<p class="mut">${t('Choose {n} player(s).', { n: `${G.minPlayers}${G.maxPlayers > G.minPlayers ? `–${G.maxPlayers}` : ''}` })}</p>`}
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
      if (!p.id) { toast(p.error || t('Could not add player'), 'bad'); return; }
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
      if (game && !game.s.matchOver && !confirm(t('A game is running here. Replace it?'))) return;
      hostGame(new G({ ...cfg }, chosen.map((pid) => known.get(pid))));
      prefetchNames();
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
      ${c.sub.filter(Boolean).map((x) => `<div class="sub ${x === 'KILLER' ? 'tag' : ''}">${esc(tr(x))}</div>`).join('')}</div>`).join('');
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
    <div class="visitbar">${slots}<div class="visitsum">${visit.length ? sum : ''}</div><div class="hint">${esc(tr(v.hint || ''))}</div></div>`;
}

function keypadHTML() {
  const nums = Array.from({ length: 20 }, (_, k) => k + 1);
  return `<div class="keypad">
    ${nums.map((n) => `<button data-n="${n}">${n}</button>`).join('')}
    <button data-n="25" data-m="1">25</button><button data-n="25" data-m="2">Bull</button>
    <button class="mod" data-mod="2">${t('Double')}</button>
    <button class="mod" data-mod="3">${t('Treble')}</button>
    <button class="miss" data-n="0">${t('Miss')}</button>
    <button data-undo="1">${t('↶ Undo')}</button>
    <button class="next wide2" data-next="1">${t('Next ▶')}</button>
  </div>`;
}

/** update keypad labels for the current modifier without rebuilding it (taps never get lost) */
function refreshKeypad() {
  const pre = mod === 3 ? 'T' : mod === 2 ? 'D' : '';    // T/D are understood in German darts too
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
  if (s.legWinner !== null && s.legWinner !== undefined) return board.on ? t('Leg over – pull the darts (or press Next) to start the next leg') : t('Leg over – press Next to start the next leg');
  if (s.visitClosed) return board.on ? t('Pull the darts (or press Next)') : t('Press Next for the next player');
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
        <button id="endgame" class="ghost">${t('End')}</button></div>
      <div class="gamegrid" id="ggrid"><div class="gmain"><div id="sb"></div><div class="waiting" id="st"></div>${keypadHTML()}</div>
      <div class="gboard" id="gboard"></div></div></div>`;
    lastBoardHTML = '';
    bindKeypad((x) => {
      if (x.dart) inputDart(x.dart);
      else if (x.undo) { sel = null; act(() => game.undo(), { silent: true }); }
      else if (x.next) { sel = null; act(() => game.next()); }
    });
    document.getElementById('endgame').onclick = endGame;
  }
  if (sel !== null && sel >= s.visit.length) sel = null;
  const html = scoreboardHTML(v, s.visit, { sel });
  document.getElementById('gtitle').textContent = tr(G.title);
  document.getElementById('ginfo').textContent = tr(v.info);
  document.getElementById('st').textContent = sel !== null ? t('Correcting dart {n} – choose the right segment', { n: sel + 1 }) : statusLine(s);
  if (html !== lastGameHTML) {
    const before = [...document.querySelectorAll('#sb .pcol .big')].map((e) => e.textContent);
    const visitBefore = document.querySelectorAll('#sb .slot:not(.empty)').length;
    lastGameHTML = html;
    document.getElementById('sb').innerHTML = html;
    document.querySelectorAll('#sb [data-slot]').forEach((el) => el.onclick = () => {
      const k = +el.dataset.slot;
      if (k < game.s.visit.length) { sel = sel === k ? null : k; renderGame(); }
    });
    // animated score change + "pop" for a new dart
    document.querySelectorAll('#sb .pcol .big').forEach((el, i) => {
      const a = before[i], b = el.textContent;
      if (a !== undefined && a !== b && /^\d+$/.test(a) && /^\d+$/.test(b)) tween(el, +a, +b);
    });
    if (getSettings().animations && s.visit.length > visitBefore && s.visit.length) {
      const slot = document.querySelector(`#sb [data-slot="${s.visit.length - 1}"]`);
      if (slot) slot.classList.add('pop');
    }
  }
  renderBoardPanel(s);
}

let lastBoardHTML = '';
function renderBoardPanel(s) {
  const st = getSettings(), grid = document.getElementById('ggrid'), panel = document.getElementById('gboard');
  if (!grid || !panel) return;
  const wide = innerWidth >= 1000;
  const show = st.boardView && (wide || st.boardOnSmall);
  grid.classList.toggle('withboard', show);
  panel.hidden = !show;
  if (!show) return;
  const html = boardSVG({
    hits: s.visit,
    targets: st.showTargets && game.canThrow() ? game.targets() : [],
    animate: st.animations,
  });
  if (html !== lastBoardHTML) { lastBoardHTML = html; panel.innerHTML = html; }
}
addEventListener('resize', () => { if (page === 'game' && game) renderBoardPanel(game.s); });

async function endGame() {
  const G = game.constructor;
  const thrown = game.s.ps.some((p) => p.darts > 0 || p.attempts > 0);
  if (G.training && thrown) {
    if (!confirm(t('End the training session? The darts thrown so far are saved to your statistics.'))) return;
    await saveHistory(true);
  } else if (!confirm(t('End this game without a result?'))) return;
  game = null;
  await api.send('DELETE', 'active');
  location.hash = '#/';
}

function renderResults() {
  const G = game.constructor, s = game.s, v = game.view();
  const order = s.ranking || [...Array(game.n).keys()];
  $app.innerHTML = `
    <div class="card" style="max-width:760px;margin:0 auto">
      <h1>🏆 ${esc(G.training ? t('Session complete') : t('{name} wins!', { name: game.name(s.winner) }))}</h1>
      <p class="mut">${esc(tr(G.title))} · ${esc(tr(v.info))}</p>
      <ul class="rank">${order.map((i, k) => {
        const c = v.cols[i];
        return `<li><span class="pos">${G.training && game.n === 1 ? '' : k + 1}</span><span class="grow"><b>${esc(c.name)}</b><br>
          <span class="mut">${esc(resultLine(i))}</span></span><b style="font-size:24px">${esc(c.big)}</b></li>`;
      }).join('')}</ul>
      <div class="row" style="margin-top:14px">
        <button id="rematch" class="primary">${G.training ? t('Again') : t('Rematch')}</button>
        <a href="#/setup/${G.id}"><button>${t('Change settings')}</button></a>
        <button id="undoLast" class="ghost">${t('↶ Undo last dart')}</button>
        <button id="home" class="ghost">${t('Done')}</button>
      </div>
      <p class="mut">${t('Results are saved to the statistics.')}</p>
    </div>
    ${resultsVisuals()}`;
  document.getElementById('rematch').onclick = () => {
    const players = s.players.length > 1 && !G.training ? [...s.players.slice(1), s.players[0]] : s.players;
    hostGame(new G({ ...game.cfg }, players));
    renderGame();
  };
  document.getElementById('undoLast').onclick = () => act(() => game.undo(), { silent: true });
  document.getElementById('home').onclick = async () => { game = null; await api.send('DELETE', 'active'); location.hash = '#/'; };
}

const TRACE_LABEL = { x01: 'Points left (last leg)', cricket: 'Score (last leg)', atc: 'Targets done', killer: 'Lives',
  doubles: 'Hit % (running)', target: 'Hit % (running)', checkout: 'Successful finishes', bobs27: 'Score' };

function resultsVisuals() {
  const s = game.s, G = game.constructor;
  const series = s.players.map((p, i) => ({ name: p.name, values: (s.trace && s.trace[i]) || [], color: PLAYER_COLORS[i] }))
    .filter((x) => x.values.length > 1);
  const chart = lineChart(series, { label: t(TRACE_LABEL[G.stype] || 'Score'), xTitle: t('Visit'), decimals: 1 });
  const heats = (s.hist || []).map((h, i) => ({ h, i })).filter(({ h }) => Object.keys(h).length).slice(0, 4);
  const boards = heats.length ? `<div class="heatgrid">${heats.map(({ h, i }) => `<div class="heatcell">
      ${boardSVG({ heat: h, small: true })}<div><b>${esc(s.players[i].name)}</b><br><span class="mut">${esc(topSegments(h))}</span></div></div>`).join('')}</div>` : '';
  if (!chart && !boards) return '';
  return `<div class="card" style="max-width:760px;margin:12px auto 0">${chart}${boards ? `<h3 style="margin-top:14px">${t('Where the darts landed')}</h3>${boards}` : ''}</div>`;
}

function topSegments(h) {
  const total = Object.values(h).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, v]) => `${k.replace(/^S/, '')} ${Math.round((v / total) * 100)}%`).join(' · ');
}

function resultLine(i) {
  const r = game.summary(i);
  const bits = [];
  if (r.avg !== undefined) bits.push(`⌀ ${r.avg}`);
  if (r.first9) bits.push(`${t('first 9')} ⌀ ${r.first9}`);
  if (r.coPct !== undefined && r.coAttempts) bits.push(`${t('checkout')} ${r.coPct}% (${r.coHits}/${r.coAttempts})`);
  if (r.mpr !== undefined) bits.push(`MPR ${r.mpr}`);
  if (r.hitPct !== undefined) bits.push(`${t('hit')} ${r.hitPct}%`);
  if (r.successPct !== undefined) bits.push(`${t('success')} ${r.successPct}% (${r.success}/${r.attempts})`);
  if (r.exactPct !== undefined) bits.push(`${r.exact}/${r.darts} = ${r.exactPct}%, ⌀ ${r.ppv}/${t('visit')}`);
  if (r.finishDarts) bits.push(`${r.finishDarts} ${t('darts')}`);
  if (r.t180) bits.push(`${r.t180}×180`);
  if (r.darts !== undefined && !r.exactPct && r.exactPct !== 0) bits.push(`${r.darts} ${t('darts')}`);
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
      $app.innerHTML = `<div class="card">${t('No game is running.')} <a href="#/">${t('Start one')}</a></div>`;
    } else {
      $app.innerHTML = `<div class="card">${t('The screen running {game} is not responding.', { game: `<b>${esc(tr(a.title))}</b>` })}
        <button id="take" class="primary">${t('Continue the game here')}</button></div>`;
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
    document.getElementById('rtitle').textContent = tr(a.title);
    document.getElementById('rinfo').textContent = t('Remote keypad · {info}', { info: tr(a.view.info) });
    document.getElementById('st').textContent = a.matchOver ? t('Game over – see the screen')
      : sel !== null ? t('Correcting dart {n} – choose the right segment', { n: sel + 1 }) : statusLine(a);
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
  $app.innerHTML = `<h1>${t('Players')}</h1>
    <div class="card"><form id="newp" class="row"><input type="text" id="newname" placeholder="${t('New player name')}" maxlength="24" style="flex:1"><button class="primary">${t('Add')}</button></form></div>
    <div class="card"><ul class="plist">${players.map((p) => `<li><span class="nm">${esc(p.name)}</span>
      <a href="#/stats/${p.id}"><button>${t('Stats')}</button></a><button data-ren="${p.id}">${t('Rename')}</button><button data-del="${p.id}" class="danger">${t('Remove')}</button></li>`).join('')
      || `<li class="mut">${t('No players yet.')}</li>`}</ul></div>`;
  document.getElementById('newp').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('newname').value.trim();
    if (name) { await api.send('POST', 'players', { name }); renderPlayers(); }
  };
  $app.querySelectorAll('[data-ren]').forEach((b) => b.onclick = async () => {
    const p = players.find((x) => x.id === b.dataset.ren);
    const name = prompt(t('New name'), p.name);
    if (name && name.trim()) { const r = await api.send('PUT', 'players/' + p.id, { name }); if (r.error) toast(r.error, 'bad'); renderPlayers(); }
  });
  $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const p = players.find((x) => x.id === b.dataset.del);
    if (confirm(t('Remove {name} from the name list? Their statistics stay saved.', { name: p.name }))) { await api.send('DELETE', 'players/' + p.id); renderPlayers(); }
  });
}

// ------------------------------------------------------------------ statistics
// one chart per game type: the value of every session, oldest -> newest (last 40)
function trendChart(series, label) {
  const pts = series.slice(-40);
  if (pts.length < 2) return `<p class="mut">${t('Play more sessions to see a trend.')}</p>`;
  const day = (ts) => new Date(ts * 1000).toLocaleDateString(getLang() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'numeric' });
  return lineChart([{ name: label, values: pts.map((p) => p.v), color: PLAYER_COLORS[0] }],
    { label, xLabels: pts.map((p) => day(p.ts)), decimals: 1 });
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
  if (!pid) { $app.innerHTML = `<h1>${t('Statistics')}</h1><p class="mut">${t('No players yet – play a game or training first.')}</p>`; return; }
  const hist = await api.get('history?player=' + encodeURIComponent(pid));
  const groups = playerStats(hist, pid);
  const name = (players.find((p) => p.id === pid) || {}).name || t('Player');
  const heat = {};
  for (const r of hist.slice(-100)) for (const [k, v] of Object.entries((r.hist && r.hist[pid]) || {})) heat[k] = (heat[k] || 0) + v;
  const darts = Object.values(heat).reduce((a, b) => a + b, 0);
  const heatCard = darts ? `<div class="card"><div class="row spread"><h3>${t('Where your darts land')}</h3><span class="mut">${t('{n} darts, last {m} sessions', { n: darts, m: Math.min(hist.length, 100) })}</span></div>
    <div class="heatcell big">${boardSVG({ heat })}<div class="mut">${esc(topSegments(heat))}<br>Miss: ${Math.round(((heat.Miss || 0) / darts) * 100)}%</div></div></div>` : '';
  $app.innerHTML = `<h1>${t('Statistics')}</h1><div class="pchips">${chips}</div>
    <h2>${esc(name)}</h2>
    ${heatCard}
    ${groups.map((g) => `<div class="card">
      <div class="row spread"><h3>${esc(tr(g.title))}</h3><span class="mut">${t(g.count === 1 ? '{n} session' : '{n} sessions', { n: g.count })}${g.multi ? ` · ${t('{w} won of {m}', { w: g.wins, m: g.multi })}` : ''}</span></div>
      ${g.cards.length ? `<div class="kv">${g.cards.map(([k, v]) => `<div><b>${esc(v)}</b><span>${esc(t(k))}</span></div>`).join('')}</div>` : ''}
      ${g.series ? trendChart(g.series, t('{label} per session', { label: t(g.seriesLabel) })) : ''}
      ${g.doubles ? doublesGrid(g.doubles) : ''}
    </div>`).join('') || `<p class="mut">${t('No games or training sessions recorded yet.')}</p>`}
    ${hist.length ? `<h2>${t('Recent sessions')}</h2><div class="card"><table class="hist">${hist.slice(-25).reverse().map((r) => `<tr>
      <td>${fmtDate(r.ts)}</td><td><b>${esc(tr(r.title))}</b>${r.partial ? ` <span class="mut">${t('(stopped early)')}</span>` : ''}</td>
      <td class="mut">${esc(r.players.map((p) => p.name).join(', '))}</td>
      <td>${r.winner === pid && r.players.length > 1 ? '🏆' : ''}</td>
      <td><button class="ghost" data-delh="${r.id}" title="${t('Delete this record')}">✕</button></td></tr>`).join('')}</table></div>` : ''}`;
  $app.querySelectorAll('[data-delh]').forEach((b) => b.onclick = async () => {
    if (confirm(t('Delete this session from the statistics (for all its players)?'))) { await api.send('DELETE', 'history/' + b.dataset.delh); renderStats(pid); }
  });
}

// ------------------------------------------------------------------ settings (per device)
function renderSettings() {
  const st = getSettings();
  const row = ([key, labelText, desc, kind]) => {
    if (kind === 'lang') {
      return `<div class="setrow"><div><b>${t(labelText)}</b><div class="mut">${t(desc)}</div></div>
        <select data-lang="1">${LANG_CHOICES.map(([v, l]) => `<option value="${v}" ${st.lang === v ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></div>`;
    }
    if (kind === 'callervoice') return callerVoiceRow(st);
    if (kind === 'range') {
      return `<div class="setrow"><div><b>${t(labelText)}</b></div>
        <input type="range" min="0" max="1" step="0.05" value="${st[key]}" data-range="${key}"></div>`;
    }
    return `<label class="setrow"><div><b>${t(labelText)}</b><div class="mut">${esc(t(desc))}</div></div>
      <input type="checkbox" class="switch" data-key="${key}" ${st[key] ? 'checked' : ''}></label>`;
  };
  $app.innerHTML = `<h1>${t('Settings')}</h1>
    <p class="mut" style="margin-top:-8px">${t('Saved on this device only – the box\'s screen and your phone can be set up differently.')}</p>
    ${DESCRIPTIONS.map(([title, rows]) => `<div class="card"><h3>${t(title)}</h3>${rows.map(row).join('')}</div>`).join('')}
    <div class="row"><button id="t-sound">${t('▶ Test sounds')}</button><button id="t-fx">${t('▶ Test effects')}</button>
      <button id="t-reset" class="ghost">${t('Reset to defaults')}</button></div>`;
  $app.querySelectorAll('[data-key]').forEach((el) => el.onchange = () => { setSetting(el.dataset.key, el.checked); unlockAudio(); });
  $app.querySelectorAll('[data-range]').forEach((el) => el.oninput = () => setSetting(el.dataset.range, +el.value));
  const lsel = $app.querySelector('[data-lang]');
  if (lsel) lsel.onchange = () => { setSetting('lang', lsel.value); applyLang(); renderSettings(); };
  const vsel = $app.querySelector('[data-voice]');
  if (vsel) vsel.onchange = () => {
    setSetting('callerVoice', { ...(getSettings().callerVoice || {}), [getLang()]: vsel.value });
    renderSettings();
    testVoice();
  };
  const vt = document.getElementById('t-voice');
  if (vt) vt.onclick = () => testVoice();
  document.getElementById('t-sound').onclick = () => { unlockAudio(); play('dart', { n: 20, m: 3 }); setTimeout(() => play('hit'), 400); setTimeout(() => play('oneEighty'), 900); };
  document.getElementById('t-fx').onclick = () => { if (!celebrate('180', 'great', { confetti: true, sub: t('ONE HUNDRED AND EIGHTY') })) toast(t('Celebrations are switched off'), 'info'); };
  document.getElementById('t-reset').onclick = () => { resetSettings(); renderSettings(); };
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if (page === 'settings') renderSettings(); };

// One select for the caller voice: the box's natural voices first, then this device's own voices.
function callerVoiceRow(st) {
  const lang = getLang();
  const choice = (st.callerVoice || {})[lang] || 'auto';
  const box = boxVoices(lang), dev = deviceVoices(lang), cur = resolveVoice(lang);
  const q = { x_low: t('basic quality'), low: t('basic quality'), medium: '', high: t('high quality') };
  const boxLabel = (v) => [v.label, v.styles ? t('excited for 180s & checkouts') : '', q[v.quality] || '', v.default ? t('box default') : '']
    .filter(Boolean).join(' · ');
  const opt = (val, text) => `<option value="${esc(val)}" ${choice === val ? 'selected' : ''}>${esc(text)}</option>`;
  const autoText = cur.kind === 'box' ? t('Automatic – {v}', { v: cur.label }) : cur.kind === 'dev' ? t('Automatic – {v}', { v: cur.name }) : t('Automatic');
  const help = cur.kind === 'box'
    ? t('Natural voice: generated on the box, sounds human, works on every device that opens the playroom.')
    : cur.kind === 'dev'
      ? (box.length ? t('Voice of this device (browser/operating system) – usually sounds more robotic than the box voices.')
        : t('No natural voice installed on the box for this language – the voice of this device is used.'))
      : t('No voice available for this language on this device.');
  return `<div class="setrow voicerow"><div><b>${t('Voice')}</b><div class="mut">${help}</div></div>
    <div class="voicepick"><select data-voice="1">
      ${opt('auto', autoText)}
      ${box.length ? `<optgroup label="${esc(t('Natural voices (box)'))}">${box.map((v) => opt('box:' + v.id, boxLabel(v))).join('')}</optgroup>` : ''}
      ${dev.length ? `<optgroup label="${esc(t('Voices of this device'))}">${dev.map((v) => opt('dev:' + v.name, v.name)).join('')}</optgroup>` : ''}
    </select><button id="t-voice" ${cur.kind === 'none' ? 'disabled' : ''}>${t('▶ Listen')}</button></div></div>`;
}

// Plays a short sample with the selected voice – also when the caller is switched off.
function testVoice() {
  unlockAudio();
  const names = { de: 'Anna', en: 'Anna' };
  const samples = [callerParts('oneEighty'), callerParts('require', names[getLang()] || 'Anna', 32)];
  call(samples[0], { force: true });
  call(samples[1], { force: true, interrupt: false });
}
// browsers only allow sound after the first tap / key press
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, unlockAudio, { passive: true }));

// ------------------------------------------------------------------ language
let serverLang = 'auto';
function applyLang() {
  setLang(resolveLang(getSettings().lang, serverLang));
  translateStatic();
}
function translateStatic() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  boardChip();
}
onSettings(() => { /* language / voice changes take effect on the next render */ });

// The box renders all fixed caller phrases once in the background, so calls are instant later.
async function prewarmVoice() {
  const lang = getLang(), key = 'pr.prewarmed.' + lang;
  if (!isKiosk || !getSettings().caller || !hasNaturalVoice(lang)) return;
  try { if (localStorage.getItem(key)) return; } catch { /* ignore */ }
  for (const p of prewarmList(lang)) {
    if (getLang() !== lang) return;
    try { await fetch(sayUrl(lang, p.s, p.t), { method: 'HEAD' }); } catch { return; }
  }
  try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
}
/** player names are spoken separately – render them when a game starts */
function prefetchNames() {
  if (!game || !getSettings().caller || !hasNaturalVoice()) return;
  const lang = getLang();
  game.s.players.forEach((p) => ['calm', 'hype'].forEach((s) =>
    fetch(sayUrl(lang, s, p.name), { method: 'HEAD' }).catch(() => {})));
}

// ------------------------------------------------------------------ keyboard (kiosk with a keyboard)
document.addEventListener('keydown', (e) => {
  if (page !== 'game' || !game || e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter') { e.preventDefault(); sel = null; act(() => game.next()); }
  else if (e.key === 'Backspace') { e.preventDefault(); sel = null; act(() => game.undo(), { silent: true }); }
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
  try { serverLang = (await api.get('about')).language || 'auto'; } catch { /* ignore */ }
  applyLang();
  await loadServerVoices();
  route();
  setTimeout(prewarmVoice, 8000);
  boardChip();
  pollBoard();
  pollBoardHealth();
  pollRemote();
}
start();

// exposed for tests / debugging
window.__playroom = { BY_ID, get game() { return game; } };
