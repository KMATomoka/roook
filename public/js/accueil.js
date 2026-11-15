// Page d'accueil : présentation, échiquier animé, accès aux autres pages
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { $, Chess } from './common.js';
import './compte.js'; // compte, barre du haut, notifications

// --- Échiquier animé : la « partie de l'Opéra » (Morphy, 1858) ---------------
const OPERA = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
const hero = Chessground($('#hero-board'), { viewOnly: true, coordinates: false, animation: { duration: 350 } });
let chess = new Chess();
let i = 0;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function step() {
  if (i >= OPERA.length) {
    i = 0;
    chess = new Chess();
    hero.set({ fen: chess.fen(), lastMove: undefined, check: false });
    return setTimeout(step, 1800);
  }
  const m = chess.move(OPERA[i++]);
  hero.set({ fen: chess.fen(), lastMove: [m.from, m.to], check: chess.inCheck() ? (chess.turn() === 'w' ? 'white' : 'black') : false });
  setTimeout(step, i === OPERA.length ? 4000 : 1100);
}
if (reduceMotion) {
  for (const s of OPERA) chess.move(s);
  hero.set({ fen: chess.fen() });
} else setTimeout(step, 800);
