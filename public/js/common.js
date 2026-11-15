// Outils partagés entre les pages.
import { Chess } from '../vendor/chess.js/chess.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const colorName = (c) => (c === 'w' ? 'white' : 'black');

/** Cases de destination légales, au format attendu par l'échiquier. */
export function legalDests(chess) {
  const dests = new Map();
  for (const m of chess.moves({ verbose: true })) {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from).push(m.to);
  }
  return dests;
}

export function isPromotion(chess, from, to) {
  const p = chess.get(from);
  return p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
}

/** Affiche le choix de la pièce de promotion. Renvoie 'q' | 'r' | 'b' | 'n' (ou null si annulé). */
export function askPromotion(color) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'promo-backdrop';
    const pieces = [
      ['q', 'queen', 'Dame'],
      ['r', 'rook', 'Tour'],
      ['b', 'bishop', 'Fou'],
      ['n', 'knight', 'Cavalier'],
    ];
    wrap.innerHTML = `<div class="promo-box cg-wrap" role="dialog" aria-label="Promotion">
      <p>Promotion du pion</p>
      <div class="promo-choices">${pieces
        .map(([k, role, label]) => `<button data-p="${k}" title="${label}"><piece class="${role} ${colorName(color)}"></piece></button>`)
        .join('')}</div></div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      wrap.remove();
      resolve(b ? b.dataset.p : null);
    });
    document.body.appendChild(wrap);
  });
}

// --- Parties enregistrées (dans le navigateur) ------------------------------
const KEY = 'roque:parties';

export function loadGames() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveGame(game) {
  try {
    const list = loadGames().filter((g) => g.id !== game.id);
    list.unshift(game);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
  } catch {}
}

export function getGame(id) {
  return loadGames().find((g) => g.id === id) || null;
}

export function getPref(k, def) {
  try {
    const v = localStorage.getItem('roque:' + k);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}

export function setPref(k, v) {
  try {
    localStorage.setItem('roque:' + k, JSON.stringify(v));
  } catch {}
}

// --- Textes ------------------------------------------------------------------
export const REASONS = {
  mat: 'par échec et mat',
  pat: 'par pat',
  materiel: 'par manque de matériel',
  repetition: 'par triple répétition',
  '50coups': 'par la règle des 50 coups',
  abandon: 'par abandon',
  accord: "d'un commun accord",
  temps: 'au temps',
  'temps-materiel': 'temps écoulé, mais matériel insuffisant',
  annulee: 'un coup illégal a été reçu, personne ne gagne',
};

export function resultText(result, reason, names = { w: 'Les Blancs', b: 'Les Noirs' }) {
  const why = REASONS[reason] || '';
  // « Les Noirs gagnent » (pluriel) mais « Léa gagne »
  const wins = (n) => (/^(Les )?(Blancs|Noirs)$/.test(n) ? `Les ${n.replace(/^Les /, '')} gagnent` : `${n} gagne`);
  if (result === '1-0') return { title: wins(names.w), sub: why };
  if (result === '0-1') return { title: wins(names.b), sub: why };
  if (result === '*') return { title: 'Partie annulée', sub: why };
  return { title: 'Partie nulle', sub: why };
}

/** Détecte la fin d'une partie jouée localement (contre l'IA ou sur le même écran). */
export function localGameOver(chess) {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'mat' };
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'pat' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'materiel' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'repetition' };
  if (chess.isDraw()) return { result: '1/2-1/2', reason: '50coups' };
  return null;
}

export function formatClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (ms < 10000 && ms > 0) return (Math.max(0, ms) / 1000).toFixed(1);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Pièces capturées et différence de matériel. */
export function material(chess) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const val = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== 'k') count[sq.color][sq.type]++;
  const captured = { w: [], b: [] }; // pièces prises PAR ce camp
  let score = 0;
  for (const t of ['q', 'r', 'b', 'n', 'p']) {
    for (let i = count.b[t]; i < start[t]; i++) captured.w.push(t);
    for (let i = count.w[t]; i < start[t]; i++) captured.b.push(t);
    score += (count.w[t] - count.b[t]) * val[t];
  }
  return { captured, score };
}

export function newChessFromMoves(moves) {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c;
}

/** Notation française : R (roi), D (dame), T (tour), F (fou), C (cavalier). */
export function frSan(san) {
  if (!san) return '';
  return san.replace(/[KQRBN]/g, (p) => ({ K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' })[p]);
}

export function gameRow(g) {
  const d = new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const res = g.result.replace(/1\/2/g, '½');
  let outcome = '';
  if (g.me && g.result !== '*') {
    const win = (g.result === '1-0' && g.me === 'w') || (g.result === '0-1' && g.me === 'b');
    outcome = g.result === '1/2-1/2' ? 'draw' : win ? 'win' : 'loss';
  }
  return `<li><a href="bilan.html?partie=${encodeURIComponent(g.id)}" class="game-row ${outcome}">
    <span class="gr-players">${escapeHtml(g.white)} <em>contre</em> ${escapeHtml(g.black)}</span>
    <span class="gr-meta">${res} · ${Math.ceil(g.moves.length / 2)} coups · ${d}</span></a></li>`;
}


/** Convertit une partie du serveur au format utilisé par le bilan. */
export function serverGameToLocal(g) {
  const c = new Chess();
  c.setHeader('White', g.white);
  c.setHeader('Black', g.black);
  c.setHeader('Result', g.result);
  for (const m of g.moves) c.move(m);
  return {
    id: g.id,
    date: g.date,
    mode: g.mode || 'ami',
    level: g.level,
    white: g.white,
    black: g.black,
    me: g.me,
    result: g.result,
    reason: g.reason,
    moves: g.moves,
    pgn: c.pgn() + ' ' + g.result,
    cadence: g.cadence,
  };
}

/** Une partie de l'historique Firebase -> format attendu par serverGameToLocal */
export function historyToGame(g) {
  return {
    id: g.id,
    white: g.white,
    black: g.black,
    me: g.me,
    mode: g.mode || 'ami',
    level: g.level,
    result: g.result,
    reason: g.reason,
    moves: g.moves ? g.moves.split(' ') : [],
    date: g.date,
    cadence: { base: g.base, inc: g.inc },
  };
}

export { Chess };

/** Fait défiler la liste des coups (et seulement elle, pas la page) jusqu'au coup actif. */
export function scrollMoveIntoList(list, item) {
  const top = item.offsetTop;
  const bottom = top + item.offsetHeight;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}
