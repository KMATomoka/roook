// Page d'accueil : présentation, échiquier animé, accès aux autres pages
import { Chessground } from '../vendor/chessground/chessground.min.js?v=f4cd128-mwquidh7';
import { $, Chess } from './common.js?v=f4cd128-mwquidh7';
import './compte.js?v=f4cd128-mwquidh7'; // compte, barre du haut, notifications

// --- Échiquier animé : des parties célèbres, l'une après l'autre, dans un ordre au hasard -------------
// (chaque partie a été vérifiée coup par coup et se termine par un échec et mat)
const GAMES = [
  {
    caption: 'Morphy contre le duc de Brunswick et le comte Isouard — « la partie de l’Opéra », Paris, 1858',
    moves: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#',
  },
  {
    caption: 'Anderssen contre Kieseritzky — « l’Immortelle », Londres, 1851',
    moves: 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#',
  },
  {
    caption: 'Anderssen contre Dufresne — « la Toujours-Jeune », Berlin, 1852',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#',
  },
  {
    caption: 'Donald Byrne contre Bobby Fischer (13 ans) — « la partie du siècle », New York, 1956',
    moves: 'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#',
  },
  {
    caption: 'Magnus Carlsen (13 ans) contre Sipke Ernst, Wijk aan Zee, 2004',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6 Bf4 Ngf6 O-O-O Be7 Ne4 Qa5 Kb1 O-O Nxf6+ Nxf6 Ne5 Rad8 Qe2 c5 Ng6 fxg6 Qxe6+ Kh8 hxg6 Ng8 Bxh6 gxh6 Rxh6+ Nxh6 Qxe7 Nf7 gxf7 Kg7 Rd3 Rd6 Rg3+ Rg6 Qe5+ Kxf7 Qf5+ Rf6 Qd7#',
  },
  {
    caption: 'Réti contre Tartakower, Vienne, 1910',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4 Qd8+ Kxd8 Bg5+ Kc7 Bd8#',
  },
].map((g) => ({ ...g, moves: g.moves.split(' ') }));

const hero = Chessground($('#hero-board'), { viewOnly: true, coordinates: false, animation: { duration: 350 } });
const caption = $('#hero-caption');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Ordre au hasard, sans jamais rejouer deux fois de suite la même partie
let order = [];
let last = null;
function nextGame() {
  if (!order.length) {
    order = GAMES.map((_, k) => k).sort(() => Math.random() - 0.5);
    if (order[0] === last && order.length > 1) order.push(order.shift());
  }
  last = order.shift();
  return GAMES[last];
}

function showCaption(text) {
  caption.classList.add('fade');
  setTimeout(() => {
    caption.textContent = text;
    caption.classList.remove('fade');
  }, 300);
}

let game, chess, i;
function startGame() {
  game = nextGame();
  chess = new Chess();
  i = 0;
  hero.set({ fen: chess.fen(), lastMove: undefined, check: false });
  showCaption(game.caption);
}

function step() {
  if (i >= game.moves.length) {
    startGame();
    return setTimeout(step, 1800);
  }
  const m = chess.move(game.moves[i++]);
  hero.set({ fen: chess.fen(), lastMove: [m.from, m.to], check: chess.inCheck() ? (chess.turn() === 'w' ? 'white' : 'black') : false });
  // Un peu plus rapide pour les longues parties ; une pause sur la position finale
  const pace = game.moves.length > 60 ? 850 : 1100;
  setTimeout(step, i === game.moves.length ? 4500 : pace);
}

startGame();
if (reduceMotion) {
  for (const s of game.moves) chess.move(s);
  hero.set({ fen: chess.fen() });
} else setTimeout(step, 800);
