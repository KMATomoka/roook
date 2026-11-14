// Page de partie : contre un ami en ligne, contre l'IA, ou à deux sur le même écran.
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { Engine, LEVELS } from './engine.js';
import {
  $, $$, Chess, colorName, legalDests, isPromotion, askPromotion, saveGame, getPref, setPref,
  resultText, localGameOver, formatClock, escapeHtml, material, frSan,
} from './common.js';
import { isMuted, setMuted, lowTimeBeep } from './sound.js';
import { createFx } from './fx.js';
import { attachArrows } from './arrows.js';
import { scrollMoveIntoList } from './common.js';
import { session } from './compte.js';
import { gameSocket } from './online.js';
const account = await session;

const params = new URLSearchParams(location.search);
const onlineId = params.get('partie');
const mode = onlineId ? 'ami' : params.has('ia') ? 'ia' : 'local';

// ---------------------------------------------------------------------------
// État commun
// ---------------------------------------------------------------------------
let chess = new Chess();
let myColor = 'w'; // pour 'local', c'est seulement l'orientation de départ
let orientation = 'w';
let viewPly = null; // null = position actuelle ; sinon on revoit un coup passé
let names = { w: 'Blancs', b: 'Noirs' };
let over = null; // { result, reason } quand la partie est finie
let gameId = mode === 'ami' ? onlineId + '-' + Date.now().toString(36) : mode + '-' + Date.now().toString(36);
let savedThisGame = false;

const ground = Chessground($('#board'), {
  coordinates: true,
  animation: { enabled: true, duration: 180 },
  highlight: { lastMove: true, check: true },
  movable: { free: false, showDests: true, events: { after: onUserMove } },
  premovable: { enabled: false },
  draggable: { showGhost: true },
  drawable: { enabled: false }, // les flèches au clic droit sont gérées par arrows.js
});
const marks = attachArrows($('.board-frame'), ground, () => orientation);
const fx = createFx($('.board-frame'), () => orientation);
// Effets visuels seulement si on regarde la position actuelle
const fxOpts = () => ({ visual: viewPly === null, me: mode === 'local' ? null : myColor });

// Bouton pour couper / remettre le son
const soundBtn = $('#sound-toggle');
const showSound = () => {
  soundBtn.textContent = isMuted() ? '🔇' : '🔊';
  soundBtn.title = isMuted() ? 'Remettre le son' : 'Couper le son';
};
soundBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  showSound();
});
showSound();

function history() {
  return chess.history({ verbose: true });
}

/** Position affichée (actuelle, ou passée si on revoit la partie). */
function shownChess() {
  if (viewPly === null) return chess;
  const c = new Chess();
  for (const m of history().slice(0, viewPly)) c.move(m);
  return c;
}

/** Quel camp peut bouger les pièces en ce moment ? */
function movableColor() {
  if (over || viewPly !== null) return undefined;
  if (mode === 'local') return colorName(chess.turn());
  if (mode === 'ia') return !aiThinking && chess.turn() === myColor ? colorName(myColor) : undefined;
  if (mode === 'ami') return online.status === 'playing' && myColor && chess.turn() === myColor ? colorName(myColor) : undefined;
}

function syncBoard() {
  const c = shownChess();
  const h = c.history({ verbose: true });
  const last = h[h.length - 1];
  const mc = movableColor();
  ground.set({
    fen: c.fen(),
    orientation: colorName(orientation),
    turnColor: colorName(c.turn()),
    lastMove: last ? [last.from, last.to] : undefined,
    check: c.inCheck() ? colorName(c.turn()) : false,
    movable: { color: mc, dests: mc ? legalDests(c) : new Map() },
  });
  marks.update(c.fen());
  fx.setPaused(viewPly !== null);
}

function render() {
  syncBoard();
  renderPlayers();
  renderMoves();
  renderStatus();
  renderActions();
}

// ---------------------------------------------------------------------------
// Joueurs, pendules, pièces prises
// ---------------------------------------------------------------------------
const clocks = { w: 0, b: 0, base: 0, inc: 0, running: false, at: 0 };

// Cadence choisie sur l'accueil, ex. « 10+0 » = 10 minutes chacun, 0 seconde ajoutée par coup.
function parseCadence(txt) {
  const [m, i] = String(txt || '10+0').split(/[+ ]/).map(Number); // « + » devient une espace dans une adresse
  const base = Math.min(180, Math.max(1, m || 10));
  const inc = Math.min(60, Math.max(0, i || 0));
  return { base: base * 60000, inc: inc * 1000, label: `${base} min${inc ? ` + ${inc} s` : ''}` };
}
const cadence = parseCadence(params.get('cadence'));

/** Pendule gérée dans le navigateur (contre l'IA et sur le même écran). */
function resetLocalClock() {
  clocks.base = cadence.base;
  clocks.inc = cadence.inc;
  clocks.w = clocks.b = cadence.base;
  clocks.running = false;
  clocks.at = 0;
}

// Comme sur chess.com, la pendule démarre quand chaque camp a joué son premier coup.
function clockAfterMove(mover) {
  if (!clocks.base) return;
  if (clocks.running) clocks[mover] = Math.max(0, clocks[mover] - (Date.now() - clocks.at)) + clocks.inc;
  clocks.running = history().length >= 2;
  clocks.at = Date.now();
}

function freezeClock() {
  if (!clocks.running) return;
  const t = chess.turn();
  clocks[t] = Math.max(0, liveClock(t));
  clocks.running = false;
}

/** Temps écoulé : perdu, sauf si l'adversaire n'a plus que son roi (nulle). */
function timeoutEnd(loser) {
  const opp = loser === 'w' ? 'b' : 'w';
  const hasMaterial = chess.board().flat().some((p) => p && p.color === opp && p.type !== 'k');
  if (!hasMaterial) return { result: '1/2-1/2', reason: 'temps-materiel' };
  return { result: opp === 'w' ? '1-0' : '0-1', reason: 'temps' };
}

function liveClock(c) {
  if (!clocks.running || over) return clocks[c];
  return c === chess.turn() ? clocks[c] - (Date.now() - clocks.at) : clocks[c];
}

function playerHtml(c) {
  const mat = material(chess);
  const caps = mat.captured[c];
  const adv = c === 'w' ? mat.score : -mat.score;
  const role = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
  const capHtml = caps.map((t) => `<piece class="${role[t]} ${colorName(c === 'w' ? 'b' : 'w')}"></piece>`).join('');
  let dot = '';
  if (mode === 'ami' && online.seated?.[c]) dot = `<span class="dot ${online.online?.[c] ? 'on' : 'off'}" title="${online.online?.[c] ? 'En ligne' : 'Hors ligne'}"></span>`;
  const isTurn = !over && chess.turn() === c;
  let sub = '';
  if (mode === 'ia' && c !== myColor) sub = `<small>niveau ${level.n} · ${level.name}</small>`;
  if (mode === 'ami' && c === myColor) sub = '<small>Toi</small>';
  const clock = clocks.base
    ? `<div class="clock ${isTurn && clocks.running ? 'running' : ''} ${liveClock(c) < 20000 ? 'low' : ''}" data-clock="${c}">${formatClock(liveClock(c))}</div>`
    : '';
  const face = mode === 'ia' && c !== myColor
    ? `<img class="avatar noa" data-noa src="img/noa/${noaMood}.svg" alt="Noa" width="44" height="44">`
    : `<div class="avatar ${colorName(c)}"></div>`;
  return `${face}
    <div class="pinfo"><div class="pname">${dot}${escapeHtml(names[c] || '…')} ${sub}</div>
    <div class="captured cg-wrap">${capHtml}${adv > 0 ? `<span class="adv">+${adv}</span>` : ''}</div></div>
    ${clock}`;
}

function renderPlayers() {
  const top = orientation === 'w' ? 'b' : 'w';
  const bottom = orientation;
  $('#p-top').innerHTML = playerHtml(top);
  $('#p-bottom').innerHTML = playerHtml(bottom);
  $('#p-top').classList.toggle('turn', !over && chess.turn() === top);
  $('#p-bottom').classList.toggle('turn', !over && chess.turn() === bottom);
}

const lowWarned = { w: false, b: false };
setInterval(() => {
  if (!clocks.base) return;
  if (mode !== 'ami' && !over && clocks.running && liveClock(chess.turn()) <= 0) {
    const loser = chess.turn();
    clocks.running = false;
    clocks[loser] = 0;
    aiGen++; // l'IA arrête de réfléchir
    aiThinking = false;
    $('#thinking').hidden = true;
    finish(timeoutEnd(loser));
  }
  const mine = mode === 'local' ? chess.turn() : myColor;
  if (mine && !over && clocks.running && chess.turn() === mine) {
    const left = liveClock(mine);
    if (left < 10000 && !lowWarned[mine]) {
      lowWarned[mine] = true;
      lowTimeBeep();
    }
  }
  for (const el of $$('[data-clock]')) {
    const ms = liveClock(el.dataset.clock);
    el.textContent = formatClock(ms);
    el.classList.toggle('low', ms < 20000);
  }
}, 100);

// ---------------------------------------------------------------------------
// Liste des coups et navigation
// ---------------------------------------------------------------------------
function renderMoves() {
  const h = history();
  const cur = viewPly === null ? h.length : viewPly;
  let html = '';
  for (let i = 0; i < h.length; i += 2) {
    const cell = (j) => (h[j] ? `<button class="mv ${cur === j + 1 ? 'active' : ''}" data-ply="${j + 1}">${frSan(h[j].san)}</button>` : '<span></span>');
    html += `<li><span class="num">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</li>`;
  }
  if (over) html += `<li class="result">${over.result.replace('1/2', '½').replace('1/2', '½')}</li>`;
  const ol = $('#moves');
  ol.innerHTML = html || '<li class="empty">La partie n’a pas encore commencé.</li>';
  const active = ol.querySelector('.active');
  if (active) scrollMoveIntoList(ol, active);
  else ol.scrollTop = ol.scrollHeight;
}

function goTo(ply) {
  const n = history().length;
  if (ply === null || ply >= n) viewPly = null;
  else viewPly = Math.max(0, ply);
  render();
}

$('#moves').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ply]');
  if (b) goTo(Number(b.dataset.ply));
});
$$('[data-nav]').forEach((b) =>
  b.addEventListener('click', () => {
    const n = history().length;
    const cur = viewPly === null ? n : viewPly;
    const nav = b.dataset.nav;
    goTo(nav === 'first' ? 0 : nav === 'prev' ? cur - 1 : nav === 'next' ? cur + 1 : null);
  }),
);
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const n = history().length;
  const cur = viewPly === null ? n : viewPly;
  if (e.key === 'ArrowLeft') goTo(cur - 1);
  if (e.key === 'ArrowRight') goTo(cur + 1);
  if (e.key === 'ArrowUp') goTo(0);
  if (e.key === 'ArrowDown') goTo(null);
});

// ---------------------------------------------------------------------------
// Statut et boutons
// ---------------------------------------------------------------------------
function renderStatus() {
  const el = $('#status');
  let txt = '';
  if (over) {
    const r = resultText(over.result, over.reason, names);
    txt = `<strong>${r.title}</strong> ${r.sub}. <a href="#" id="status-review">Voir le bilan →</a>`;
  } else if (mode === 'ami' && online.status === 'waiting') {
    txt = myColor ? 'En attente de ton ami…' : 'Partie en attente d’un second joueur.';
  } else if (mode === 'ami' && !myColor) {
    txt = `Tu regardes la partie en spectateur. Au tour de <strong>${escapeHtml(names[chess.turn()])}</strong>.`;
  } else if (mode === 'local') {
    txt = `Au tour des <strong>${chess.turn() === 'w' ? 'Blancs' : 'Noirs'}</strong>.`;
  } else if (aiThinking) {
    txt = 'L’IA réfléchit…';
  } else if (chess.turn() === myColor) {
    txt = '<strong>À toi de jouer.</strong>';
  } else {
    txt = `Au tour de <strong>${escapeHtml(names[chess.turn()])}</strong>.`;
  }
  if (!over && chess.inCheck()) txt += ' <span class="tag-check">Échec !</span>';
  if (viewPly !== null) txt += ` <a href="#" id="back-live">Revenir à la position actuelle</a>`;
  el.innerHTML = txt;
  $('#status-review')?.addEventListener('click', (e) => {
    e.preventDefault();
    openReview();
  });
  $('#back-live')?.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(null);
  });
}

function renderActions() {
  const playing = !over;
  $('#btn-draw').hidden = mode !== 'ami' || !playing || !myColor || online.status !== 'playing';
  $('#btn-resign').hidden = !playing || (mode === 'ami' && (!myColor || online.status !== 'playing'));
  if (mode === 'ami') {
    $('#btn-draw').disabled = online.drawOffer === myColor;
    $('#btn-draw').textContent = online.drawOffer === myColor ? '½ Nulle proposée' : '½ Proposer nulle';
    const offer = !over && online.drawOffer && online.drawOffer !== myColor && myColor;
    $('#draw-banner').hidden = !offer;
    if (offer) $('#draw-text').textContent = `${names[online.drawOffer]} propose la nulle.`;
  }
}

$('#btn-flip').addEventListener('click', () => {
  orientation = orientation === 'w' ? 'b' : 'w';
  render();
});

$('#btn-resign').addEventListener('click', () => {
  if (!confirm('Abandonner la partie ?')) return;
  if (mode === 'ami') return socket.emit('resign');
  const loser = mode === 'local' ? chess.turn() : myColor;
  finish({ result: loser === 'w' ? '0-1' : '1-0', reason: 'abandon' });
});

// ---------------------------------------------------------------------------
// Coup joué par l'utilisateur
// ---------------------------------------------------------------------------
async function onUserMove(from, to) {
  let promotion;
  if (isPromotion(chess, from, to)) {
    promotion = await askPromotion(chess.turn());
    if (!promotion) return syncBoard();
  }
  let move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return syncBoard();
  }
  fx.move(move, chess, fxOpts());
  if (mode === 'ami') socket.emit('move', { from, to, promotion });
  afterMove();
}

function afterMove() {
  if (mode === 'ia') noaReact(history()[history().length - 1]);
  if (mode !== 'ami') clockAfterMove(chess.turn() === 'w' ? 'b' : 'w');
  const end = localGameOver(chess);
  if (end && mode !== 'ami') finish(end);
  else render();
  if (!end && mode === 'ia' && chess.turn() !== myColor) aiMove();
}

// ---------------------------------------------------------------------------
// Fin de partie
// ---------------------------------------------------------------------------
function finish(end) {
  freezeClock();
  over = end;
  viewPly = null;
  render();
  storeGame();
  const r = resultText(end.result, end.reason, names);
  let icon = '½';
  if (end.result !== '1/2-1/2') {
    const winner = end.result === '1-0' ? 'w' : 'b';
    const iWon = mode === 'local' || winner === myColor;
    icon = iWon ? '🏆' : '♚';
    if (mode !== 'local' && myColor) r.title = iWon ? 'Victoire !' : 'Défaite';
  }
  $('#end-icon').textContent = icon;
  if (mode === 'ia') {
    // Noa réagit au résultat
    const noaWon = end.result !== '1/2-1/2' && (end.result === '1-0' ? 'w' : 'b') !== myColor;
    const face = end.result === '1/2-1/2' ? 'hmm' : noaWon ? 'frime' : 'content';
    setNoaMood(face, 0);
    $('#end-icon').innerHTML = `<img class="end-noa" src="img/noa/${face}.svg" alt="Noa" width="96" height="96">`;
  }
  $('#end-title').textContent = r.title;
  $('#end-sub').textContent = r.sub ? r.sub.charAt(0).toUpperCase() + r.sub.slice(1) + '.' : '';
  if (mode === 'ia') {
    const noaWon = end.result !== '1/2-1/2' && (end.result === '1-0' ? 'w' : 'b') !== myColor;
    $('#end-sub').textContent += noaWon ? ' Noa : « Trop facile. Tu prends ta revanche ? »' : end.result === '1/2-1/2' ? ' Noa : « Hmm… on remet ça ? »' : ' Noa : « GG, bien joué ! »';
  }
  $('#end-review').href = `bilan.html?partie=${encodeURIComponent(gameId)}`;
  $('#end-rematch').textContent = mode === 'ami' ? 'Revanche' : 'Rejouer';
  $('#end-rematch').hidden = mode === 'ami' && !myColor;
  $('#end-rematch').disabled = false;
  setTimeout(() => !$('#end-dialog').open && $('#end-dialog').showModal(), end.reason === 'mat' ? 2700 : 600);
}

function storeGame() {
  if (savedThisGame || history().length === 0) return;
  savedThisGame = true;
  const pgnChess = new Chess();
  pgnChess.setHeader('Event', mode === 'ia' ? `Contre Noa (niveau ${level.n} · ${level.name})` : mode === 'ami' ? 'Partie entre amis' : 'Partie sur le même écran');
  pgnChess.setHeader('Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
  pgnChess.setHeader('White', names.w);
  pgnChess.setHeader('Black', names.b);
  pgnChess.setHeader('Result', over.result);
  const tc = mode === 'ami' ? online.time : cadence;
  if (tc?.base) pgnChess.setHeader('TimeControl', `${tc.base / 1000}+${tc.inc / 1000}`);
  for (const m of history()) pgnChess.move(m);
  saveGame({
    id: gameId,
    date: Date.now(),
    mode,
    white: names.w,
    black: names.b,
    me: mode === 'local' ? null : myColor,
    result: over.result,
    reason: over.reason,
    moves: history().map((m) => m.san),
    pgn: pgnChess.pgn() + ' ' + over.result,
    level: mode === 'ia' ? level.n : undefined,
    cadence: mode === 'ami' ? online.time : { base: cadence.base, inc: cadence.inc },
  });
}

function openReview() {
  storeGame();
  location.href = `bilan.html?partie=${encodeURIComponent(gameId)}`;
}
$('#end-review').addEventListener('click', (e) => {
  e.preventDefault();
  openReview();
});
$('#end-close').addEventListener('click', () => $('#end-dialog').close());
$('#end-rematch').addEventListener('click', () => {
  if (mode === 'ami') {
    socket.emit('rematch');
    $('#end-rematch').textContent = 'Revanche demandée…';
    $('#end-rematch').disabled = true;
    return;
  }
  $('#end-dialog').close();
  restartLocal(mode === 'ia' ? (myColor === 'w' ? 'b' : 'w') : 'w');
});

function restartLocal(color) {
  chess = new Chess();
  over = null;
  fx.reset();
  lowWarned.w = lowWarned.b = false;
  clearTimeout(noaTimer);
  noaMood = 'neutre'; // Noa reprend son visage normal pour la nouvelle partie
  viewPly = null;
  savedThisGame = false;
  gameId = mode + '-' + Date.now().toString(36);
  resetLocalClock();
  if (mode === 'ia') {
    setupAiColor(color);
    engine.newGame();
  }
  render();
  if (mode === 'ia' && chess.turn() !== myColor) aiMove();
}

// ---------------------------------------------------------------------------
// Mode IA
// ---------------------------------------------------------------------------
let engine = null;
let level = LEVELS[2];
let aiThinking = false;
let aiGen = 0; // pour ignorer une réponse de l'IA arrivée trop tard

// --- Humeur de Noa : son visage réagit à ce qui se passe sur l'échiquier ---
let noaMood = 'neutre';
let noaTimer = null;
function setNoaMood(mood, revertAfter = 2400) {
  clearTimeout(noaTimer);
  const changed = mood !== noaMood;
  noaMood = mood;
  const img = document.querySelector('[data-noa]');
  if (img && changed) {
    img.src = `img/noa/${mood}.svg`;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      img.animate([{ transform: 'scale(.6) rotate(-12deg)' }, { transform: 'scale(1.18) rotate(4deg)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
    }
  }
  if (revertAfter) noaTimer = setTimeout(() => !over && setNoaMood('neutre', 0), revertAfter);
}

function noaReact(m) {
  if (!m || over) return;
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const byNoa = m.color !== myColor;
  const won = VAL[m.captured] || 0;
  if (byNoa) {
    if (won >= 5) setNoaMood('rire');
    else if (m.san.includes('+')) setNoaMood('frime');
    else if (won >= 3) setNoaMood('content');
  } else {
    if (won >= 9) setNoaMood('colere');
    else if (won >= 3) setNoaMood('grimace');
    else if (m.san.includes('+')) setNoaMood('surpris');
  }
}

function setupAiColor(c) {
  myColor = c;
  orientation = c;
  const me = account.user?.username || 'Toi';
  const ai = 'Noa';
  names = c === 'w' ? { w: me, b: ai } : { w: ai, b: me };
}

async function aiMove() {
  const gen = ++aiGen;
  aiThinking = true;
  $('#thinking').hidden = false;
  render();
  const started = Date.now();
  let uci = null;
  try {
    const left = liveClock(chess.turn());
    const budget = clocks.base ? Math.max(100, Math.round(left / 35 + clocks.inc * 0.7)) : undefined;
    uci = await engine.play(chess.fen(), level, budget);
  } catch (e) {
    console.error(e);
  }
  // Petite pause pour que le coup ne tombe pas instantanément (sauf quand l'IA manque de temps)
  const minThink = clocks.base && liveClock(chess.turn()) < 15000 ? 0 : 450;
  const wait = Math.max(0, minThink - (Date.now() - started));
  await new Promise((r) => setTimeout(r, wait));
  if (gen !== aiGen || over) return;
  aiThinking = false;
  $('#thinking').hidden = true;
  if (!uci) return render();
  const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  fx.move(move, chess, fxOpts());
  afterMove();
}

// ---------------------------------------------------------------------------
// Mode en ligne (contre un ami)
// ---------------------------------------------------------------------------
let socket = null;
let online = { status: 'waiting' };

function startOnline() {
  $('#mode-label').textContent = 'Partie entre amis';
  $('#chat').hidden = false;
  if (!account.user) {
    $('.game-layout').innerHTML = `<div class="card notfound"><h2>Connecte-toi pour suivre cette partie</h2>
      <p>Les parties entre amis sont réservées aux joueurs inscrits.</p>
      <a class="btn btn-primary" href="connexion.html?retour=${encodeURIComponent('jeu.html?partie=' + onlineId)}">Se connecter</a></div>`;
    return;
  }
  socket = gameSocket(onlineId, account.user);

  socket.emit('join', { id: onlineId }, (res) => {
    if (res.error) {
      $('.game-layout').innerHTML = `<div class="card notfound"><h2>Partie introuvable</h2>
        <p>Ce lien ne correspond à aucune partie.</p>
        <a class="btn btn-primary" href="amis.html">Retour à mes amis</a></div>`;
      return;
    }
    myColor = res.color;
    orientation = myColor || 'w';
    $('#chat-log').innerHTML = '';
    res.chat.forEach(addChat);
    if (!myColor) $('#chat').hidden = true; // les spectateurs regardent sans écrire
    render();
  });

  socket.on('state', (s) => {
    const wasOver = online.status === 'over';
    const before = history().length;
    online = s;
    names = s.names;
    gameId = `${onlineId}-${s.round}`;
    clocks.base = s.time.base;
    clocks.w = s.clock.w;
    clocks.b = s.clock.b;
    clocks.running = s.clockRunning;
    clocks.at = Date.now();

    // On reconstruit la partie à partir des coups du serveur (il fait foi).
    const c = new Chess();
    for (const m of s.moves) c.move(m);
    if (c.fen() !== chess.fen() || c.history().length !== chess.history().length) {
      const isNewOpponentMove = s.moves.length === before + 1;
      chess = c;
      if (isNewOpponentMove) {
        const h = history();
        fx.move(h[h.length - 1], chess, fxOpts());
      }
    }
    if (viewPly !== null && viewPly > s.moves.length) viewPly = null;

    if (s.status === 'over' && !wasOver) {
      finish({ result: s.result, reason: s.reason });
    } else if (s.status !== 'over' && over) {
      // Revanche acceptée : nouvelle partie
      over = null;
      fx.reset();
      lowWarned.w = lowWarned.b = false;
      savedThisGame = false;
      $('#end-dialog').open && $('#end-dialog').close();
      render();
    } else {
      render();
    }
    if (s.status === 'over' && myColor) {
      const opp = myColor === 'w' ? 'b' : 'w';
      const btn = $('#end-rematch');
      if (s.rematch[opp] && !s.rematch[myColor]) btn.textContent = `Accepter la revanche`;
    }
  });

  socket.on('swap', () => {
    if (myColor) myColor = myColor === 'w' ? 'b' : 'w';
    orientation = myColor || 'w';
    chess = new Chess();
  });

  socket.on('chat', addChat);
  socket.on('disconnect', () => {
    $('#status').innerHTML = '<span class="tag-check">Connexion perdue…</span> reconnexion en cours.';
  });

  $('#btn-draw').addEventListener('click', () => socket.emit('offerDraw'));
  $('#draw-accept').addEventListener('click', () => socket.emit('offerDraw'));
  $('#draw-decline').addEventListener('click', () => socket.emit('declineDraw'));

  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#chat-input').value.trim();
    if (!v) return;
    socket.emit('chat', v);
    $('#chat-input').value = '';
  });
}

function addChat(m) {
  const log = $('#chat-log');
  const div = document.createElement('div');
  div.className = 'chat-msg' + (m.color && m.color === myColor ? ' me' : '');
  div.innerHTML = `<b>${escapeHtml(m.from)}</b> ${escapeHtml(m.text)}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
if (mode === 'ami') {
  startOnline();
} else if (mode === 'ia') {
  const n = Math.min(8, Math.max(1, Number(params.get('ia')) || 3));
  level = LEVELS[n - 1];
  let c = params.get('couleur');
  if (c !== 'w' && c !== 'b') c = Math.random() < 0.5 ? 'w' : 'b';
  $('#mode-label').textContent = `Contre Noa · niveau ${level.n} · ${cadence.label}`;
  resetLocalClock();
  document.title = `Contre Noa — Roque`;
  engine = new Engine();
  setupAiColor(c);
  render();
  if (chess.turn() !== myColor) aiMove();
} else {
  $('#mode-label').textContent = `Sur le même écran · ${cadence.label}`;
  resetLocalClock();
  names = { w: 'Blancs', b: 'Noirs' };
  render();
}
