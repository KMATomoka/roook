// Flèches et cases marquées au clic droit, comme sur chess.com :
// - clic droit glissé d'une case à une autre : flèche (en L pour un saut de cavalier),
//   seulement si la pièce de départ peut se déplacer ainsi (voir canReach)
// - clic droit sur une case : la surligne
// - refaire la même flèche ou la même case l'efface ; on peut en mettre autant qu'on veut
// - Maj = vert, Ctrl = rouge, Alt = bleu (orange par défaut pour les flèches)
// - clic gauche sur l'échiquier, ou nouvelle position : tout s'efface

const COLORS = {
  orange: '#ffaa00',
  green: '#7fc24e',
  red: '#eb5a4a',
  blue: '#4c9fe6',
};

function colorFor(e, fallback) {
  if (e.shiftKey) return 'green';
  if (e.ctrlKey || e.metaKey) return 'red';
  if (e.altKey) return 'blue';
  return fallback;
}

const FILES = 'abcdefgh';

/**
 * Une flèche partant d'une pièce doit suivre la façon dont cette pièce se déplace :
 * cavalier en L, fou en diagonale, tour en ligne droite, dame les deux, roi d'une case
 * (ou roque), pion vers l'avant (2 cases depuis sa case de départ) ou en diagonale pour prendre.
 * Les pièces sur le chemin ne bloquent pas la flèche, pour pouvoir montrer un plan.
 * Depuis une case vide, toutes les flèches sont permises.
 */
function canReach(piece, from, to) {
  if (!piece) return true;
  const dx = FILES.indexOf(to[0]) - FILES.indexOf(from[0]);
  const dy = Number(to[1]) - Number(from[1]);
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const white = piece.color === 'white';
  switch (piece.role) {
    case 'knight':
      return (ax === 1 && ay === 2) || (ax === 2 && ay === 1);
    case 'bishop':
      return ax === ay;
    case 'rook':
      return dx === 0 || dy === 0;
    case 'queen':
      return ax === ay || dx === 0 || dy === 0;
    case 'king': {
      if (Math.max(ax, ay) === 1) return true;
      // Roque : le roi va de deux cases sur le côté, depuis sa case de départ
      return dy === 0 && ax === 2 && from === (white ? 'e1' : 'e8');
    }
    case 'pawn': {
      const dir = white ? 1 : -1;
      const startRank = white ? '2' : '7';
      if (dx === 0 && dy === dir) return true;
      if (dx === 0 && dy === 2 * dir && from[1] === startRank) return true;
      return ax === 1 && dy === dir; // prise en diagonale
    }
    default:
      return true;
  }
}

/**
 * @param {HTMLElement} frame  conteneur de l'échiquier (position: relative)
 * @param {import('/vendor/chessground/chessground.js').Api} ground
 * @param {() => 'w'|'b'} getOrientation
 */
export function attachArrows(frame, ground, getOrientation) {
  const arrows = new Map(); // "e2e4" -> couleur
  const marks = new Map(); // "e4" -> couleur
  let auto = []; // flèches posées par le site (indice, meilleur coup) : [{ from, to, color }]
  let drawing = null; // { from, to, color }
  let lastFen = null;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 8 8');
  svg.setAttribute('class', 'arrow-layer');
  frame.appendChild(svg);

  // --- Coordonnées ----------------------------------------------------------
  function squareAt(e) {
    const r = frame.getBoundingClientRect();
    const fx = Math.floor(((e.clientX - r.left) / r.width) * 8);
    const fy = Math.floor(((e.clientY - r.top) / r.height) * 8);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    const white = getOrientation() === 'w';
    const file = white ? fx : 7 - fx;
    const rank = white ? 7 - fy : fy;
    return FILES[file] + (rank + 1);
  }

  // Centre d'une case, en unités de case (0 à 8)
  function center(sq) {
    const file = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]) - 1;
    const white = getOrientation() === 'w';
    return { x: (white ? file : 7 - file) + 0.5, y: (white ? 7 - rank : rank) + 0.5 };
  }

  // --- Dessin -------------------------------------------------------------
  const W = 0.2; // épaisseur du trait
  const HEAD_L = 0.42; // longueur de la pointe
  const HEAD_W = 0.4; // demi-largeur de la pointe

  function arrowSvg(from, to, color, ghost) {
    const a = center(from);
    const b = center(to);
    const dfx = Math.abs(FILES.indexOf(to[0]) - FILES.indexOf(from[0]));
    const dfy = Math.abs(Number(to[1]) - Number(from[1]));
    const knight = (dfx === 1 && dfy === 2) || (dfx === 2 && dfy === 1);

    // Points du trajet : tout droit, ou en L (d'abord le grand côté, puis le petit)
    let pts;
    if (knight) {
      const longVertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
      const corner = longVertical ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
      pts = [a, corner, b];
    } else {
      pts = [a, b];
    }

    // La pointe s'arrête un peu avant le centre de la case d'arrivée
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const len = Math.hypot(last.x - prev.x, last.y - prev.y);
    const ux = (last.x - prev.x) / len;
    const uy = (last.y - prev.y) / len;
    const tip = { x: last.x - ux * 0.12, y: last.y - uy * 0.12 };
    const base = { x: tip.x - ux * HEAD_L, y: tip.y - uy * HEAD_L };

    // Le départ commence un peu après le centre de la case de départ (sauf en L)
    const first = pts[0];
    const second = pts[1];
    const l0 = Math.hypot(second.x - first.x, second.y - first.y);
    const start = knight ? first : { x: first.x + ((second.x - first.x) / l0) * 0.25, y: first.y + ((second.y - first.y) / l0) * 0.25 };

    const body = [start, ...pts.slice(1, -1), base].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
    const px = -uy;
    const py = ux;
    const head = [
      tip,
      { x: base.x + px * HEAD_W, y: base.y + py * HEAD_W },
      { x: base.x - px * HEAD_W, y: base.y - py * HEAD_W },
    ]
      .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
      .join(' ');
    const fill = COLORS[color];
    return `<g opacity="${ghost ? 0.55 : 0.82}">
      <polyline points="${body}" fill="none" stroke="${fill}" stroke-width="${W}" stroke-linejoin="miter" stroke-linecap="butt"/>
      <polygon points="${head}" fill="${fill}"/>
    </g>`;
  }

  function render() {
    let html = '';
    for (const a of auto) html += arrowSvg(a.from, a.to, a.color, false);
    for (const [k, c] of arrows) html += arrowSvg(k.slice(0, 2), k.slice(2, 4), c, false);
    if (drawing && drawing.to && drawing.to !== drawing.from) html += arrowSvg(drawing.from, drawing.to, drawing.color, true);
    svg.innerHTML = html;
    // Les cases marquées sont dessinées par l'échiquier, sous les pièces
    const custom = new Map();
    for (const [sq, c] of marks) custom.set(sq, 'mark-' + c);
    ground.set({ highlight: { custom } });
  }

  // --- Souris ----------------------------------------------------------------
  frame.addEventListener('contextmenu', (e) => e.preventDefault());

  frame.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button === 2) {
        const sq = squareAt(e);
        if (!sq) return;
        e.preventDefault();
        drawing = { from: sq, to: sq, over: sq, piece: pieceOn(sq), color: colorFor(e, 'orange') };
        frame.setPointerCapture?.(e.pointerId);
      } else if (e.button === 0 && (arrows.size || marks.size)) {
        clear();
      }
    },
    true,
  );

  // La pièce posée sur une case de la position affichée (ou undefined si la case est vide)
  const pieceOn = (sq) => ground.state.pieces.get(sq);

  frame.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const sq = squareAt(e);
    if (!sq || sq === drawing.over) return;
    drawing.over = sq;
    // Sur une case que la pièce ne peut pas atteindre, on n'affiche pas de flèche
    const to = canReach(drawing.piece, drawing.from, sq) ? sq : drawing.from;
    if (to !== drawing.to) {
      drawing.to = to;
      render();
    }
  });

  frame.addEventListener('pointerup', (e) => {
    if (!drawing || e.button !== 2) return;
    const { from, color, piece } = drawing;
    const to = squareAt(e) || drawing.over || from;
    drawing = null;
    if (to === from) {
      const c = colorFor(e, 'red');
      if (marks.get(from) === c) marks.delete(from);
      else marks.set(from, c);
    } else if (canReach(piece, from, to)) {
      const key = from + to;
      if (arrows.get(key) === color) arrows.delete(key);
      else arrows.set(key, color);
    }
    render();
  });

  frame.addEventListener('pointercancel', () => {
    drawing = null;
    render();
  });

  function clear() {
    arrows.clear();
    marks.clear();
    drawing = null;
    render();
  }

  return {
    clear,
    /** Flèches du site (indice, meilleur coup), dessinées comme celles du joueur. */
    setAuto(list) {
      auto = list || [];
      render();
    },
    /** À appeler après chaque changement de position ou d'orientation. */
    update(fen) {
      if (fen !== undefined && fen !== lastFen) {
        lastFen = fen;
        if (arrows.size || marks.size) return clear();
      }
      render();
    },
  };
}
