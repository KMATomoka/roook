// « Mat à l'infini » : fabrique au hasard des positions où l'attaquant a un mat forcé.
// Ce fichier propose des positions plausibles (roi qui se défend, souvent roqué derrière ses pions,
// quelques défenseurs, deux ou trois attaquants) ; le moteur (Stockfish) garde seulement celles
// qui ont un mat forcé dans le nombre de coups voulu. Utilisé par js/apprendre.js,
// et mesuré par scripts/mesure-mat-gen.mjs.

/** Tirage pondéré : list = [[valeur, poids], …] */
function weighted(list, rand) {
  let r = rand() * list.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of list) if ((r -= w) <= 0) return v;
  return list[list.length - 1][0];
}
const int = (a, b, rand) => a + Math.floor(rand() * (b - a + 1));

// Case du roi qui se défend (Noirs avant le retournement) : surtout roqué, parfois au centre ou sorti.
const DEF_KING = [['g8', 30], ['h8', 14], ['b8', 8], ['c8', 7], ['a8', 4], ['e8', 10], ['f8', 7], ['d8', 5], ['g7', 5], ['f7', 3], ['h7', 4], ['e7', 3]];
const ATT_KING = [['g1', 35], ['h1', 15], ['c1', 12], ['b1', 10], ['e1', 10], ['f1', 8], ['g2', 10]];
const ATT_PIECES = [['Q', 30], ['R', 30], ['B', 18], ['N', 18]];
const DEF_PIECES = [['r', 35], ['n', 22], ['b', 25], ['q', 10]];
// Pas plus de pièces qu'au début d'une partie : 1 dame, 2 tours, 2 fous, 2 cavaliers
const MAX = { q: 1, r: 2, b: 2, n: 2 };
/** Tire une pièce de la liste sans dépasser MAX (used : nombre déjà posé par type). */
function drawPiece(list, used, rand) {
  for (let i = 0; i < 20; i++) {
    const p = weighted(list, rand);
    const t = p.toLowerCase();
    if ((used[t] || 0) < MAX[t]) {
      used[t] = (used[t] || 0) + 1;
      return p;
    }
  }
  return null;
}

/**
 * Une position candidate (FEN), sans garantie de mat : c'est le moteur qui tranche.
 * Le camp qui attaque est au trait ; il a les Blancs ou les Noirs, au hasard.
 */
export function mateCandidate(Chess, rand = Math.random) {
  for (let tries = 0; tries < 500; tries++) {
    // b[r][f] : r = 0 pour la 1re rangée
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    const sq = (s) => [s.charCodeAt(0) - 97, Number(s[1]) - 1];
    const free = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8 && !b[r][f];
    const put = (f, r, p) => (free(f, r) ? ((b[r][f] = p), true) : false);
    const putRandom = (p, r0, r1) => {
      for (let i = 0; i < 40; i++) if (put(int(0, 7, rand), int(r0, r1, rand), p)) return true;
      return false;
    };

    // Roi qui se défend et son abri de pions
    const [kf, kr] = sq(weighted(DEF_KING, rand));
    put(kf, kr, 'k');
    for (let f = kf - 1; f <= kf + 1; f++) {
      if (f < 0 || f > 7) continue;
      const x = rand();
      if (kr === 7) {
        if (x < 0.62) put(f, 6, 'p');
        else if (x < 0.8) put(f, 5, 'p');
      } else if (x < 0.45) put(f, kr - 1, 'p');
    }
    // Défenseurs : 0 à 2 pièces, quelques pions
    const nDef = weighted([[0, 25], [1, 45], [2, 30]], rand);
    const defUsed = {};
    for (let i = 0; i < nDef; i++) {
      const p = drawPiece(DEF_PIECES, defUsed, rand);
      if (p) putRandom(p, 4, 7);
    }
    for (let i = weighted([[0, 30], [1, 35], [2, 25], [3, 10]], rand); i > 0; i--) putRandom('p', 3, 5);

    // Roi attaquant, à l'abri, et ses pions
    const [af, ar] = sq(weighted(ATT_KING, rand));
    if (!put(af, ar, 'K')) continue;
    for (let f = af - 1; f <= af + 1; f++) if (f >= 0 && f < 8 && rand() < 0.6) put(f, ar + 1, 'P');
    // Attaquants : 2 ou 3 pièces, surtout dans le camp adverse
    const nAtt = weighted([[2, 55], [3, 45]], rand);
    const attUsed = {};
    for (let i = 0; i < nAtt; i++) {
      const p = drawPiece(ATT_PIECES, attUsed, rand);
      if (p) putRandom(p, rand() < 0.75 ? 3 : 1, 6);
    }
    for (let i = weighted([[0, 25], [1, 35], [2, 30], [3, 10]], rand); i > 0; i--) putRandom('P', 2, rand() < 0.2 ? 5 : 4);

    // Retournements : côté (a↔h) et couleurs (l'attaquant joue les Noirs)
    const mirrorFiles = rand() < 0.4;
    const swapColors = rand() < 0.5;
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      const rr = swapColors ? 7 - r : r;
      let row = '';
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        let p = b[rr][mirrorFiles ? 7 - f : f];
        if (p && swapColors) p = p === p.toUpperCase() ? p.toLowerCase() : p.toUpperCase();
        if (!p) empty++;
        else {
          if (empty) row += empty;
          empty = 0;
          row += p;
        }
      }
      rows.push(row + (empty || ''));
    }
    const fen = `${rows.join('/')} ${swapColors ? 'b' : 'w'} - - 0 1`;

    let c;
    try {
      c = new Chess(fen);
    } catch {
      continue; // position impossible (rois collés…)
    }
    if (c.inCheck() || c.isGameOver()) continue;
    // le camp qui ne joue pas ne doit pas être en échec
    const f2 = fen.split(' ');
    f2[1] = f2[1] === 'w' ? 'b' : 'w';
    try {
      if (new Chess(f2.join(' ')).inCheck()) continue;
    } catch {
      continue;
    }
    return fen;
  }
  return null;
}

/**
 * Cherche une position de mat en exactement n coups (n = 1, 2 ou 3).
 * analyse(fen) → Promise<{ mate?: number }> (le score du moteur pour le camp au trait).
 * Renvoie { fen, n } ou null si rien n'a été trouvé en maxTries essais.
 */
export async function findMate(Chess, analyse, n, { maxTries = 400, rand = Math.random, accept } = {}) {
  for (let i = 0; i < maxTries; i++) {
    const fen = mateCandidate(Chess, rand);
    if (!fen) continue;
    // Tri rapide sans moteur : un mat en 1 se voit directement
    const c = new Chess(fen);
    const mateIn1 = c.moves({ verbose: true }).some((m) => {
      const d = new Chess(fen);
      d.move(m);
      return d.isCheckmate();
    });
    if (mateIn1 !== (n === 1)) continue;
    if (n === 1) return { fen, n, tries: i + 1 };
    const res = await analyse(fen);
    if (res.mate === n && (!accept || accept(fen))) return { fen, n, tries: i + 1 };
  }
  return null;
}
