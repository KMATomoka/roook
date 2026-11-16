// Noa, le coach : explique avec des mots simples pourquoi un coup est bon ou mauvais.
// Les explications viennent de l'analyse de la position (pièces attaquées, défendues,
// fourchettes, mat, développement, centre…), pas d'une phrase toute faite.
import { Chess } from '../vendor/chess.js/chess.js';
import { ico } from './icons.js'; // icônes dessinées (à la place des emojis)
import { frSan } from './common.js';

const NAME = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const FEM = { r: true, q: true };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const CENTER = ['d4', 'e4', 'd5', 'e5'];

/** « le cavalier », « la dame » (+ « en f3 » si on donne la case) */
const art = (t, sq) => `${FEM[t] ? 'la' : 'le'} ${NAME[t]}${sq ? ` en ${sq}` : ''}`;
/** « le » / « la » comme pronom */
const pron = (t) => (FEM[t] ? 'la' : 'le');
const other = (c) => (c === 'w' ? 'b' : 'w');
const sideName = (c) => (c === 'w' ? 'les Blancs' : 'les Noirs');
const b = (san) => `<b>${frSan(san)}</b>`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function listFr(items) {
  if (items.length <= 1) return items[0] || '';
  return items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1];
}

function playUci(fen, uci) {
  if (!uci) return null;
  const c = new Chess(fen);
  try {
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { chess: c, move: m };
  } catch {
    return null;
  }
}

/** Une pièce est « en prise » si elle est attaquée et pas défendue, ou attaquée par moins fort qu'elle. */
function isHanging(chess, sq) {
  const p = chess.get(sq);
  if (!p || p.type === 'k') return false;
  const attackers = chess.attackers(sq, other(p.color));
  if (!attackers.length) return false;
  const defenders = chess.attackers(sq, p.color);
  if (!defenders.length) return true;
  const weakest = Math.min(...attackers.map((s) => VAL[chess.get(s).type]));
  return weakest < VAL[p.type];
}

/** Pièces adverses intéressantes attaquées par la pièce posée sur `from`. */
function targetsOf(chess, from) {
  const me = chess.get(from);
  if (!me) return [];
  const out = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color === me.color || p.type === 'p') continue;
      if (!chess.attackers(p.square, me.color).includes(from)) continue;
      if (p.type === 'k' || isHanging(chess, p.square) || VAL[p.type] > VAL[me.type]) out.push(p);
    }
  }
  return out;
}

const backRank = (c) => (c === 'w' ? '1' : '8');
const nonPawnCount = (chess) => chess.board().flat().filter((p) => p && p.type !== 'p' && p.type !== 'k').length;
const centerDist = (sq) => Math.max(Math.abs(sq.charCodeAt(0) - 100.5), Math.abs(Number(sq[1]) - 4.5));

function isPassed(chess, sq, color) {
  const f = sq.charCodeAt(0);
  const r = Number(sq[1]);
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.type !== 'p' || p.color === color) continue;
      const pf = p.square.charCodeAt(0);
      const pr = Number(p.square[1]);
      if (Math.abs(pf - f) <= 1 && (color === 'w' ? pr > r : pr < r)) return false;
    }
  }
  return true;
}

/**
 * Ce que fait un coup, en mots, du plus important au moins important.
 * @returns {{w:number, t:string}[]}  t commence par un verbe : « développe le cavalier »
 */
export function describe(fenBefore, move) {
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  after.move({ from: move.from, to: move.to, promotion: move.promotion });
  const me = move.color;
  const opp = other(me);
  const f = [];
  const opening = before.moveNumber() <= 12;

  if (after.isCheckmate()) return [{ w: 100, t: 'donne échec et mat' }];

  // Prise
  if (move.captured) {
    const capSq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const defended = before.attackers(capSq, opp).length > 0;
    if (!defended) f.push({ w: 50 + VAL[move.captured], t: `gagne ${art(move.captured)} gratuitement` });
    else if (VAL[move.captured] > VAL[move.piece]) f.push({ w: 40 + VAL[move.captured], t: `prend ${art(move.captured)} avec ${art(move.piece)}, un échange gagnant` });
    else if (VAL[move.captured] === VAL[move.piece]) f.push({ w: 18, t: `échange ${art(move.captured)}` });
    else f.push({ w: 12, t: `prend ${art(move.captured)}` });
  }
  if (move.promotion) f.push({ w: 60, t: `transforme le pion en ${NAME[move.promotion]}` });
  if (move.flags.includes('k') || move.flags.includes('q')) f.push({ w: 30, t: 'met le roi à l’abri en roquant' });

  // Menaces créées par la pièce qui vient de bouger
  const targets = targetsOf(after, move.to).filter((p) => p.type !== 'k');
  if (after.inCheck() && targets.length >= 1) f.push({ w: 48, t: `donne échec et attaque en même temps ${art(targets[0].type, targets[0].square)}` });
  else if (targets.length >= 2) f.push({ w: 45, t: `fait une fourchette : il attaque ${art(targets[0].type, targets[0].square)} et ${art(targets[1].type, targets[1].square)} en même temps` });
  else if (targets.length === 1) f.push({ w: 24, t: `attaque ${art(targets[0].type, targets[0].square)}` });
  else if (after.inCheck()) f.push({ w: 16, t: 'donne échec et oblige l’adversaire à réagir' });

  // Mettre une pièce à l'abri / en protéger une autre
  if (move.piece !== 'p' && isHanging(before, move.from) && !isHanging(after, move.to)) f.push({ w: 26, t: `met ${art(move.piece)} à l’abri` });
  for (const row of before.board()) {
    for (const p of row) {
      if (!p || p.color !== me || p.square === move.from || p.type === 'p') continue;
      if (isHanging(before, p.square) && after.get(p.square) && !isHanging(after, p.square)) {
        f.push({ w: 22, t: `protège ${art(p.type, p.square)}, qui était menacé${FEM[p.type] ? 'e' : ''}` });
      }
    }
  }

  // Ouverture : développement et centre
  if (opening && (move.piece === 'n' || move.piece === 'b') && move.from[1] === backRank(me)) f.push({ w: 15, t: `développe ${art(move.piece)}` });
  if (CENTER.includes(move.to) && (move.piece === 'p' || opening)) f.push({ w: 13, t: 'occupe le centre' });
  else if (move.piece !== 'k') {
    const ctrl = CENTER.filter((c) => after.attackers(c, me).includes(move.to)).length;
    if (ctrl >= 2) f.push({ w: 10, t: 'contrôle le centre' });
  }

  // Tours, pions passés, roi actif en finale
  if (move.piece === 'r') {
    const file = move.to[0];
    const pawns = after.board().flat().filter((p) => p && p.type === 'p' && p.square[0] === file);
    if (!pawns.length) f.push({ w: 12, t: 'place la tour sur une colonne ouverte' });
    else if (!pawns.some((p) => p.color === me)) f.push({ w: 9, t: 'place la tour sur une colonne semi-ouverte' });
  }
  if (move.piece === 'p' && !move.promotion && isPassed(after, move.to, me)) {
    const rel = me === 'w' ? Number(move.to[1]) : 9 - Number(move.to[1]);
    if (rel >= 5) f.push({ w: 14 + rel, t: 'pousse un pion passé vers la promotion' });
  }
  if (move.piece === 'k' && nonPawnCount(after) <= 6 && centerDist(move.to) < centerDist(move.from)) f.push({ w: 14, t: 'active le roi, ce qu’il faut faire en finale' });

  return f.sort((a, b2) => b2.w - a.w);
}

/** Phrase courte à partir des deux idées principales d'un coup. */
function featureText(features, max = 2) {
  const top = features.slice(0, max).map((x) => x.t);
  return listFr(top);
}

/** Erreurs « de principe » visibles sans calcul. */
function principleProblem(fenBefore, move, priorSameSide) {
  const before = new Chess(fenBefore);
  const n = before.moveNumber();
  const me = move.color;
  if (move.piece === 'q' && n <= 6 && !move.captured) return 'Sortir la dame si tôt l’expose : l’adversaire va la chasser en développant ses pièces, et gagner du temps.';
  if (move.piece === 'k' && !move.flags.includes('k') && !move.flags.includes('q') && nonPawnCount(before) > 6) {
    const rights = before.getCastlingRights ? before.getCastlingRights(me) : null;
    if (!rights || rights.k || rights.q) return 'Déplacer le roi au milieu de la partie lui fait perdre le droit de roquer et le laisse exposé.';
  }
  if (move.piece === 'p' && n <= 10) {
    const kingSide = ['f', 'g', 'h'].includes(move.from[0]);
    const start = me === 'w' ? '2' : '7';
    if (kingSide && move.from[1] === start && ['f', 'g'].includes(move.from[0])) return 'Avancer ce pion devant le roi ouvre des lignes vers lui : le roi devient plus facile à attaquer.';
  }
  if (move.piece === 'n' && !move.captured && ['a', 'h'].includes(move.to[0])) return 'Un cavalier au bord de l’échiquier contrôle peu de cases : au centre, il est bien plus fort.';
  if (n <= 10 && move.piece !== 'p' && !move.captured && priorSameSide.some((m) => m.to === move.from && m.piece === move.piece)) return 'Jouer deux fois la même pièce dans l’ouverture fait perdre du temps : il vaut mieux sortir les autres pièces.';
  if (n <= 8 && move.piece === 'p' && !CENTER.includes(move.to)) {
    const undeveloped = before.board().flat().filter((p) => p && p.color === me && (p.type === 'n' || p.type === 'b') && p.square[1] === backRank(me)).length;
    if (undeveloped >= 3) return 'Beaucoup de coups de pion et peu de pièces sorties : dans l’ouverture, développe d’abord les cavaliers et les fous.';
  }
  return null;
}

/** Que menace l'adversaire après le coup joué ? (à partir de sa meilleure réponse) */
function punishment(fenBefore, played, fenAfter, replyUci, moverEval) {
  const r = playUci(fenAfter, replyUci);
  if (!r) return null;
  const { chess, move } = r;
  if (moverEval <= -9000) {
    const n = 10000 + moverEval; // mat en n coups pour l'adversaire
    return `Ce coup permet un mat${n > 0 && n < 20 ? ` en ${n}` : ''} : l’adversaire commence par ${b(move.san)}.`;
  }
  if (move.captured) {
    const posAfter = new Chess(fenAfter);
    const posBefore = new Chess(fenBefore);
    const capSq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const undefended = posAfter.attackers(capSq, other(move.color)).length === 0;
    if (move.captured === 'p' && !undefended) return null;
    const victim = art(move.captured, capSq);
    const it = pron(move.captured);
    const e = FEM[move.captured] ? 'e' : '';
    // 1. C'est la pièce qu'on vient de jouer qui tombe
    if (capSq === played.to) return `${cap(art(played.piece))} va en ${played.to}, mais l’adversaire peut ${pron(played.piece)} prendre avec ${b(move.san)}${undefended ? ' : la case n’est pas protégée' : ''}.`;
    // 2. Le coup a ouvert une ligne : la pièce déplacée bloquait l'attaque
    const attackedBefore = posBefore.attackers(capSq, move.color).includes(move.from);
    if (!attackedBefore) {
      const ilElle = FEM[played.piece] ? 'elle' : 'il';
      return `En ${played.from}, ${art(played.piece)} bloquait la ligne et protégeait ${victim}. Maintenant qu’${ilElle} est parti${FEM[played.piece] ? 'e' : ''}, l’adversaire peut ${it} prendre avec ${b(move.san)}.`;
    }
    // 3. La pièce était déjà menacée et le coup ne règle pas le problème
    if (isHanging(posBefore, capSq)) return `${cap(victim)} était menacé${e}, et ce coup ne règle pas le problème : l’adversaire peut ${it} prendre avec ${b(move.san)}.`;
    // 4. Le coup a retiré un défenseur
    return `Après ce coup, ${victim} ${undefended ? `n’est plus protégé${e}` : `est mal protégé${e}`} : l’adversaire peut ${it} prendre avec ${b(move.san)}.`;
  }
  const t = targetsOf(chess, move.to).filter((p) => p.type !== 'k');
  if (chess.inCheck() && t.length) return `L’adversaire peut répondre ${b(move.san)} : échec, et ${art(t[0].type, t[0].square)} tombe ensuite.`;
  if (t.length >= 2) return `L’adversaire répond ${b(move.san)} et attaque ${art(t[0].type, t[0].square)} et ${art(t[1].type, t[1].square)} en même temps : impossible de tout sauver.`;
  if (t.length === 1 && VAL[t[0].type] >= 3) return `L’adversaire répond ${b(move.san)} et attaque ${art(t[0].type, t[0].square)}.`;
  return null;
}

/**
 * Commentaire complet d'un coup, en HTML.
 * @param o.fenBefore   position avant le coup
 * @param o.move        coup joué (verbose)
 * @param o.cat         catégorie : best | excellent | good | inaccuracy | mistake | blunder
 * @param o.bestUci     meilleur coup dans la position avant
 * @param o.replyUci    meilleure réponse de l'adversaire après le coup joué
 * @param o.evalBefore  / o.evalAfter : évaluations (centipions, point de vue des Blancs)
 * @param o.prior       coups précédents de la partie (verbose)
 */
export function explainMove(o) {
  const { fenBefore, move, cat, bestUci, replyUci, evalBefore, evalAfter, prior = [] } = o;
  const sign = move.color === 'w' ? 1 : -1;
  const moverBefore = sign * evalBefore;
  const moverAfter = sign * evalAfter;
  const fenAfter = (() => {
    const c = new Chess(fenBefore);
    c.move({ from: move.from, to: move.to, promotion: move.promotion });
    return c.fen();
  })();
  const own = describe(fenBefore, move);
  const best = playUci(fenBefore, bestUci);
  const bestFeat = best && best.move.san !== move.san ? describe(fenBefore, best.move) : [];
  const priorSame = prior.filter((m) => m.color === move.color);
  const lines = [];

  if (move.san.includes('#')) return `<p>Échec et mat, la partie est terminée. Bien joué ! ${ico('party')}</p>`;

  const ownTxt = featureText(own);
  const bestTxt = featureText(bestFeat);
  const bestSan = best ? b(best.move.san) : '';

  switch (cat) {
    case 'best':
    case 'excellent': {
      const opener = cat === 'best' ? pickOne(['Parfait.', 'Exactement ça.', 'Très bien vu.', 'C’est le coup à jouer.']) : pickOne(['Très bon coup.', 'Bien joué.', 'Solide.']);
      if (ownTxt) lines.push(`${opener} Ce coup ${ownTxt}.`);
      else lines.push(`${opener} ${calmReason(moverAfter)}`);
      if (moverBefore > 9000 && moverAfter > 9000) lines.push('Le mat approche : continue à donner des échecs précis.');
      break;
    }
    case 'good': {
      // « Bon coup » : souvent le coup du moteur lui-même, mais évident (ouverture, reprise, partie déjà gagnée…)
      const isTop = best && best.move.san === move.san;
      if (isTop) lines.push(ownTxt ? `Bon coup : il ${ownTxt}.` : `Bon coup. ${calmReason(moverAfter)}`);
      else lines.push(ownTxt ? `Coup correct : il ${ownTxt}.` : 'Coup correct, la position reste équilibrée.');
      if (!isTop && best && bestTxt) lines.push(`${bestSan} était un peu plus fort, car il ${bestTxt}.`);
      else if (!isTop && best) lines.push(`${bestSan} était un peu plus précis.`);
      break;
    }
    default: {
      // Imprécision, erreur, gaffe : on explique le problème, puis ce qu'il fallait faire
      const missedMate = moverBefore > 9000 && moverAfter < 9000;
      const pun = punishment(fenBefore, move, fenAfter, replyUci, moverAfter);
      const principle = principleProblem(fenBefore, move, priorSame);
      if (missedMate && best) lines.push(`Il y avait un mat forcé ! Il commençait par ${bestSan}. Quand l’adversaire est en difficulté, cherche d’abord les échecs.`);
      else if (pun) lines.push(pun);
      else if (principle) lines.push(principle);
      else if (cat === 'inaccuracy') lines.push('Pas une grosse faute, mais ce coup est un peu passif et laisse l’adversaire souffler.');
      else lines.push(moverAfter < -150 ? 'Après ce coup, la position devient vraiment difficile.' : 'Ce coup laisse filer une bonne partie de l’avantage.');

      if (best && !missedMate) {
        if (bestTxt) lines.push(`Il fallait jouer ${bestSan} : il ${bestTxt}.`);
        else lines.push(`Il fallait jouer ${bestSan}, plus solide.`);
      }
      if (pun && principle && cat !== 'inaccuracy') lines.push(`<span class="tip-inline">${ico('bulb')} ${principle}</span>`);
    }
  }
  return lines.map((l) => `<p>${cap(l)}</p>`).join('');
}

function calmReason(moverEval) {
  if (moverEval > 300) return 'Il garde un gros avantage, sans prendre de risque.';
  if (moverEval > 80) return 'Il garde l’avantage et ne laisse rien à l’adversaire.';
  if (moverEval > -80) return 'La position reste équilibrée, sans faiblesse.';
  return 'C’est la meilleure défense dans une position difficile.';
}

// Choix stable (même texte à chaque affichage d'un même coup)
let seed = 0;
function pickOne(arr) {
  seed = (seed * 9301 + 49297) % 233280;
  return arr[seed % arr.length];
}
export function resetPhrasing(n) {
  seed = n;
}

export { sideName };
