// Page « Bilan » : le moteur analyse chaque coup, puis Noa, le coach, explique la partie.
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { ico } from './icons.js'; // icônes dessinées (à la place des emojis)
import { Engine, toWhiteCp, winPercent, formatEval } from './engine.js';
import { attachArrows } from './arrows.js';
import { explainMove, resetPhrasing } from './explain.js';
import { scrollMoveIntoList } from './common.js';
import { legalDests, castleDest, isPromotion, askPromotion } from './common.js';
import { $, $$, Chess, colorName, getGame, loadGames, saveGame, resultText, escapeHtml, frSan, gameRow, serverGameToLocal, historyToGame } from './common.js';
import { session, historyGame } from './compte.js';

const DEPTH = 13;

// Catégories de coups, de la meilleure à la pire.
const CATS = {
  best: { label: 'Meilleur coup', short: 'Meilleur', sym: '★', cls: 'c-best' },
  excellent: { label: 'Excellent', short: 'Excellent', sym: '!', cls: 'c-excellent' },
  good: { label: 'Bon coup', short: 'Bon', sym: '✓', cls: 'c-good' },
  inaccuracy: { label: 'Imprécision', short: 'Imprécision', sym: '?!', cls: 'c-inaccuracy' },
  mistake: { label: 'Erreur', short: 'Erreur', sym: '?', cls: 'c-mistake' },
  blunder: { label: 'Gaffe', short: 'Gaffe', sym: '??', cls: 'c-blunder' },
};
const CAT_ORDER = Object.keys(CATS);

let game = null; // partie enregistrée
let plies = []; // coups (verbose) + analyse
let fens = []; // positions : fens[0] = départ, fens[i] = après le coup i
let evals = []; // évaluation (centipions, point de vue des Blancs) de chaque position
let bests = []; // meilleur coup (uci) de chaque position
let pvs = []; // meilleure suite de chaque position
let seconds = []; // évaluation du 2e meilleur coup de chaque position (null si inconnue ou coup unique)
let cur = 0;
let orientation = 'w';
let ground = null;
let marks = null;
// Variante jouée à la main : on bouge soi-même les pièces pour tester un coup, le moteur dit s'il est bon.
// steps[i] = { move, fen, eval, best, cat, loss, pending } ; vIdx = nombre de coups de la variante affichés.
let vari = null;
let vIdx = 0;
let vEngine = null;

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

function showPicker() {
  $('#pick').hidden = false;
  const list = loadGames();
  $('#pick-list').innerHTML = list.length
    ? list.map(gameRow).join('')
    : '<li class="empty">Tu n’as pas encore joué de partie. <a href="./">Lance-toi !</a></li>';
  $('#pgn-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = $('#pgn-input').value.trim();
    const c = parsePgn(txt);
    if (!c) {
      $('#pgn-error').hidden = false;
      $('#pgn-error').textContent = 'Impossible de lire cette partie. Vérifie le format PGN.';
      return;
    }
    const h = c.getHeaders ? c.getHeaders() : {};
    const g = {
      id: 'pgn-' + Date.now().toString(36),
      date: Date.now(),
      mode: 'pgn',
      white: h.White && h.White !== '?' ? h.White : 'Blancs',
      black: h.Black && h.Black !== '?' ? h.Black : 'Noirs',
      me: null,
      result: h.Result && h.Result !== '*' ? h.Result : '*',
      reason: '',
      moves: c.history(),
      pgn: txt,
    };
    saveGame(g);
    history.replaceState(null, '', 'bilan.html?partie=' + g.id);
    $('#pick').hidden = true;
    start(g);
  });
}

function parsePgn(txt) {
  const tryLoad = (t) => {
    const c = new Chess();
    try {
      c.loadPgn(t);
      return c.history().length ? c : null;
    } catch {
      return null;
    }
  };
  // Accepte aussi la notation française (R, D, T, F, C).
  const fr = txt.replace(/\b([RDTFC])(?=[a-h1-8x]*[a-h][1-8])/g, (m) => ({ R: 'K', D: 'Q', T: 'R', F: 'B', C: 'N' })[m])
    .replace(/=([DTFC])/g, (_, p) => '=' + { D: 'Q', T: 'R', F: 'B', C: 'N' }[p]);
  return tryLoad(txt) || tryLoad(fr);
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------
async function start(g) {
  game = g;
  const c = new Chess();
  fens = [c.fen()];
  plies = [];
  for (const san of g.moves) {
    const m = c.move(san);
    plies.push(m);
    fens.push(c.fen());
  }
  orientation = g.me || 'w';

  if (g.analysis && g.analysis.depth === DEPTH && g.analysis.evals.length === fens.length && Array.isArray(g.analysis.seconds)) {
    ({ evals, bests, pvs } = g.analysis);
    seconds = g.analysis.seconds;
  } else {
    $('#progress').hidden = false;
    const engine = new Engine();
    evals = [];
    bests = [];
    pvs = [];
    seconds = [];
    for (let i = 0; i < fens.length; i++) {
      $('#progress-text').textContent = i === 0 ? 'Position de départ' : `Coup ${Math.ceil(i / 2)} sur ${Math.ceil((fens.length - 1) / 2)}`;
      $('#progress-bar').style.width = `${Math.round((i / fens.length) * 100)}%`;
      const pos = new Chess(fens[i]);
      if (pos.isCheckmate()) {
        evals.push(pos.turn() === 'w' ? -10000 : 10000);
        bests.push(null);
        pvs.push([]);
        seconds.push(null);
        continue;
      }
      if (pos.isDraw() || pos.isStalemate()) {
        evals.push(0);
        bests.push(null);
        pvs.push([]);
        seconds.push(null);
        continue;
      }
      // Deux lignes : le meilleur coup, et le 2e (pour savoir si le meilleur était le seul bon coup)
      const res = await engine.analyse(fens[i], { depth: DEPTH, multipv: 2 });
      evals.push(toWhiteCp(res.lines[0], pos.turn()));
      bests.push(res.bestmove);
      pvs.push((res.lines[0]?.pv || []).slice(0, 6));
      seconds.push(res.lines[1] ? toWhiteCp(res.lines[1], pos.turn()) : null);
    }
    engine.destroy();
    $('#progress-bar').style.width = '100%';
    g.analysis = { depth: DEPTH, evals, bests, pvs, seconds };
    saveGame(g);
    $('#progress').hidden = true;
  }
  classify();
  showReview();
}

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Le coup laisse-t-il en prise une pièce qui vaut plus que ce qu'il a pris ? (un sacrifice) */
function isSacrifice(m, i) {
  if (m.piece === 'k' || m.piece === 'p') return false;
  const given = VAL[m.promotion || m.piece];
  const taken = m.captured ? VAL[m.captured] : 0;
  if (given - taken < 2) return false;
  const after = new Chess(fens[i + 1]);
  const takers = after.moves({ verbose: true }).filter((x) => x.to === m.to && x.captured);
  if (!takers.length) return false;
  const cheapest = Math.min(...takers.map((x) => VAL[x.piece] || 0));
  return cheapest < given || !after.isAttacked(m.to, m.color);
}

/**
 * Un coup « remarquable » peut-il l'être ? Hors ouverture, partie encore disputée (pas déjà perdue), coup qui tient,
 * pas un mat en un, pas une reprise évidente, pas un coup forcé.
 */
function notable(m, i, before, after) {
  if (i < 12) return false; // les 6 premiers coups de chaque camp : de l'ouverture
  if (before < 12 || after < 45) return false;
  if (m.san.includes('#')) return false;
  const prev = plies[i - 1];
  if (m.captured && prev && prev.captured && prev.to === m.to) return false; // reprise
  return new Chess(fens[i]).moves().length >= 2;
}
/** De combien de points de chances de gain le 2e meilleur coup était-il moins bon ? (null si inconnu) */
function gapToSecond(m, i) {
  if (typeof seconds[i] !== 'number') return null;
  const sign = m.color === 'w' ? 1 : -1;
  return winPercent(sign * evals[i]) - winPercent(sign * seconds[i]);
}
/**
 * Coup du moteur (ou aussi bon) : sa catégorie.
 *  - ★ « Meilleur coup » (très rare, comme un coup brillant) : un sacrifice qui marche (même dans une partie déjà
 *    gagnée), ou le seul bon coup (le 2e meilleur perdait au moins 20 points de chances de gain) ;
 *  - ! « Excellent » (rare) : un coup qui comptait, le 2e meilleur perdait au moins 8 points ;
 *  - ✓ « Bon coup » : le reste (le coup évident, celui de l'ouverture, celui d'une partie déjà gagnée…).
 */
function topMoveCat(m, i, before, after) {
  if (!notable(m, i, before, after)) return 'good';
  if (isSacrifice(m, i)) return 'best';
  if (before > 88) return 'good'; // déjà gagné : trouver le bon coup n'a plus rien d'exceptionnel
  const gap = gapToSecond(m, i);
  if (gap === null) return 'good';
  return gap >= 20 ? 'best' : gap >= 8 ? 'excellent' : 'good';
}

/** Note chaque coup selon la chance de gain perdue. */
function classify() {
  plies.forEach((m, i) => {
    const mover = m.color;
    const sign = mover === 'w' ? 1 : -1;
    const before = winPercent(sign * evals[i]);
    const after = winPercent(sign * evals[i + 1]);
    const loss = Math.max(0, before - after);
    const uci = m.from + m.to + (m.promotion || '');
    let cat;
    if (uci === bests[i] || loss < 0.5) cat = topMoveCat(m, i, before, after);
    else if (loss < 7) cat = 'good';
    else if (loss < 12) cat = 'inaccuracy';
    else if (loss < 22) cat = 'mistake';
    else cat = 'blunder';
    // Mat raté : on avait un mat forcé et on ne l'a plus
    const hadMate = sign * evals[i] > 9000;
    const stillMate = sign * evals[i + 1] > 9000;
    if (hadMate && !stillMate && cat !== 'best') cat = after > 85 ? 'mistake' : 'blunder';
    // Coup qui laisse un mat à l'adversaire
    const allowsMate = sign * evals[i + 1] < -9000 && sign * evals[i] > -9000;
    if (allowsMate) cat = 'blunder';
    m.cat = cat;
    m.loss = loss;
    m.hadMate = hadMate && !stillMate;
    m.allowsMate = allowsMate;
    m.accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
    m.ply = i + 1;
  });
}

// ---------------------------------------------------------------------------
// Affichage du bilan
// ---------------------------------------------------------------------------
function uciToSan(fen, uci) {
  if (!uci) return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

function pvToSan(fen, pv) {
  const c = new Chess(fen);
  const out = [];
  for (const u of pv) {
    try {
      out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
    } catch {
      break;
    }
  }
  return out;
}

function stats(color) {
  const ms = plies.filter((m) => m.color === color);
  const counts = Object.fromEntries(CAT_ORDER.map((k) => [k, 0]));
  ms.forEach((m) => counts[m.cat]++);
  const acc = ms.length ? ms.reduce((s, m) => s + m.accuracy, 0) / ms.length : 0;
  return { ms, counts, acc };
}

function phaseOf(m, i) {
  if (i < 20) return 'ouverture';
  const pieces = new Chess(fens[i + 1]).board().flat().filter((p) => p && p.type !== 'p' && p.type !== 'k').length;
  return pieces <= 6 ? 'finale' : 'milieu de partie';
}

function showReview() {
  $('#review').hidden = false;
  const names = { w: game.white, b: game.black };
  const r = game.result === '*' ? { title: 'Partie non terminée', sub: '' } : resultText(game.result, game.reason, names);
  $('#r-title').textContent = `${game.white} contre ${game.black}`;
  $('#r-sub').textContent = `${r.title}${r.sub ? ' ' + r.sub : ''} · ${Math.ceil(plies.length / 2)} coups`;
  $('#r-replay').href = game.mode === 'ia' ? `jeu.html?ia=${game.level || 3}` : '/';
  $('#r-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(game.pgn);
      $('#r-copy').textContent = 'PGN copié ✓';
    } catch {}
  });

  // Précision
  const st = { w: stats('w'), b: stats('b') };
  $('#accuracy').innerHTML = `
    <table class="acc-table">
      <thead><tr><th></th>
        <th><div class="acc-player"><span class="avatar white"></span>${escapeHtml(game.white)}</div><div class="acc-num">${st.w.acc.toFixed(0)}<small>%</small></div></th>
        <th><div class="acc-player"><span class="avatar black"></span>${escapeHtml(game.black)}</div><div class="acc-num">${st.b.acc.toFixed(0)}<small>%</small></div></th>
      </tr></thead>
      <tbody>${CAT_ORDER.map((k) => `<tr><td><span class="badge ${CATS[k].cls}">${CATS[k].sym}</span>${CATS[k].label}</td><td>${st.w.counts[k]}</td><td>${st.b.counts[k]}</td></tr>`).join('')}</tbody>
    </table>
    <p class="muted small-print">Précision : plus elle est proche de 100 %, plus tes coups sont précis.</p>`;

  writeCoach(st);
  drawGraph();
  renderMoments();

  ground = Chessground($('#board'), {
    viewOnly: false,
    coordinates: true,
    // On peut bouger soi-même les pièces (les deux camps) pour tester un autre coup
    movable: { free: false, color: 'both', showDests: true, events: { after: (o, d) => onUserMove(o, d) } },
    draggable: { enabled: true },
    selectable: { enabled: true },
    drawable: { enabled: false }, // flèches au clic droit : arrows.js
    animation: { duration: 160 },
  });
  marks = attachArrows($('.review-board .board-frame'), ground, () => orientation);
  $('#moves').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ply]');
    if (b) goTo(Number(b.dataset.ply));
  });
  $$('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
  $('#comment').addEventListener('click', (e) => {
    if (e.target.closest('[data-exit-var]')) return goTo(vari ? vari.base : cur);
    const s = e.target.closest('[data-vstep]');
    if (s && vari) {
      vIdx = Number(s.dataset.vstep);
      showVar();
    }
  });
  $('#flip').addEventListener('click', () => {
    orientation = orientation === 'w' ? 'b' : 'w';
    if (vari) showVar();
    else goTo(cur);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') navigate('prev');
    if (e.key === 'ArrowRight') navigate('next');
    if (e.key === 'ArrowUp') navigate('first');
    if (e.key === 'ArrowDown') navigate('last');
    if (e.key === 'Escape' && vari) goTo(vari.base);
  });
  renderMoveList();
  // On commence sur la plus grosse erreur du joueur, sinon au début.
  goTo(0);
}

function writeCoach(st) {
  const me = game.me; // null si on analyse les deux camps
  const who = me ? st[me] : null;
  const name = me ? 'Tu' : null;
  const lines = [];
  let title;

  const verdict = (acc) =>
    acc >= 92 ? 'Une partie remarquable' : acc >= 82 ? 'Une très belle partie' : acc >= 70 ? 'Une bonne partie' : acc >= 55 ? 'Une partie correcte, avec des erreurs' : 'Une partie compliquée';

  if (who) {
    title = `${verdict(who.acc)} !`;
    const good = who.counts.best + who.counts.excellent + who.counts.good;
    const pct = who.ms.length ? Math.round((good / who.ms.length) * 100) : 0;
    lines.push(`Tu as joué <b>${good} bons coups sur ${who.ms.length}</b> (${pct} %), avec une précision de <b>${who.acc.toFixed(0)} %</b>.`);
    const errs = [];
    if (who.counts.blunder) errs.push(`${who.counts.blunder} gaffe${who.counts.blunder > 1 ? 's' : ''}`);
    if (who.counts.mistake) errs.push(`${who.counts.mistake} erreur${who.counts.mistake > 1 ? 's' : ''}`);
    if (who.counts.inaccuracy) errs.push(`${who.counts.inaccuracy} imprécision${who.counts.inaccuracy > 1 ? 's' : ''}`);
    lines.push(errs.length ? `À retravailler : ${errs.join(', ')}.` : 'Aucune erreur sérieuse : bravo !');

    // Par phase de jeu
    const phases = {};
    who.ms.forEach((m) => {
      const p = phaseOf(m, m.ply - 1);
      (phases[p] ||= []).push(m.accuracy);
    });
    const avg = Object.entries(phases)
      .filter(([, a]) => a.length >= 3)
      .map(([p, a]) => [p, a.reduce((s, x) => s + x, 0) / a.length]);
    if (avg.length >= 2) {
      avg.sort((a, b) => b[1] - a[1]);
      lines.push(`Ton point fort : <b>${avg[0][0]}</b> (${avg[0][1].toFixed(0)} %). Ton point faible : <b>${avg[avg.length - 1][0]}</b> (${avg[avg.length - 1][1].toFixed(0)} %).`);
    }

    // Conseil
    const worst = [...who.ms].sort((a, b) => b.loss - a.loss)[0];
    if (worst && (worst.cat === 'blunder' || worst.cat === 'mistake')) {
      const best = uciToSan(fens[worst.ply - 1], bests[worst.ply - 1]);
      lines.push(`Le tournant : au coup <a href="#" data-goto="${worst.ply}">${moveLabel(worst)}</a>, ${best ? `<b>${frSan(best)}</b> était bien meilleur` : 'il y avait mieux'}.`);
    }
    lines.push(`<span class="tip">${ico('bulb')} ${tip(who, phases)}</span>`);
  } else {
    title = 'Le bilan des deux joueurs';
    for (const c of ['w', 'b']) {
      const s = st[c];
      lines.push(`<b>${escapeHtml(c === 'w' ? game.white : game.black)}</b> : ${s.acc.toFixed(0)} % de précision, ${s.counts.blunder} gaffe(s), ${s.counts.mistake} erreur(s).`);
    }
    const all = [...plies].sort((a, b) => b.loss - a.loss)[0];
    if (all && all.loss > 12) lines.push(`Le tournant de la partie : <a href="#" data-goto="${all.ply}">${moveLabel(all)}</a>.`);
  }
  $('#coach-title').textContent = title;
  const acc = who ? who.acc : (st.w.acc + st.b.acc) / 2;
  $('#coach-avatar').src = `img/noa/${acc >= 88 ? 'frime' : acc >= 78 ? 'content' : acc >= 65 ? 'neutre' : acc >= 50 ? 'hmm' : 'grimace'}.svg`;
  $('#coach-text').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
  $('#coach-text').addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    e.preventDefault();
    goTo(Number(a.dataset.goto));
    $('.review-main').scrollIntoView({ behavior: 'smooth' });
  });
}

function tip(who, phases) {
  const bad = who.ms.filter((m) => m.cat === 'blunder' || m.cat === 'mistake');
  const inOpening = bad.filter((m) => m.ply <= 20).length;
  const allowsMate = who.ms.some((m) => m.allowsMate);
  const missedMate = who.ms.some((m) => m.hadMate);
  if (missedMate) return 'Tu as laissé passer un mat. Quand l’adversaire est en difficulté, cherche d’abord les échecs : ils mènent souvent au mat.';
  if (allowsMate) return 'Un de tes coups a permis un mat. Avant de jouer, vérifie toujours les échecs que ton adversaire pourrait donner.';
  if (who.counts.blunder >= 1) return 'Avant chaque coup, pose-toi la question : « Quelles pièces sont attaquées, et que menace mon adversaire ? ». Cela évite la plupart des gaffes.';
  if (inOpening >= 2) return 'En ouverture : contrôle le centre, sors tes cavaliers et tes fous, puis roque tôt. Évite de jouer deux fois la même pièce.';
  if (phases.finale && bad.some((m) => phaseOf(m, m.ply - 1) === 'finale')) return 'En finale, le roi devient une pièce forte : centralise-le, et pousse tes pions passés.';
  if (who.counts.mistake >= 2) return 'Quand tu hésites entre deux coups, compare ce que chacun laisse à ton adversaire : les cases, les pièces non protégées, les échecs possibles.';
  if (who.counts.inaccuracy >= 3) return 'Pas de grosse faute, mais quelques coups un peu passifs. Cherche les coups qui améliorent ta pire pièce.';
  return 'Continue comme ça ! Pour progresser, essaie un niveau d’IA au-dessus.';
}

function moveLabel(m) {
  const n = Math.ceil(m.ply / 2);
  return `${n}${m.color === 'w' ? '.' : '…'} ${frSan(m.san)}`;
}

function renderMoments() {
  const focus = game.me ? plies.filter((m) => m.color === game.me) : plies;
  const key = focus
    .filter((m) => ['blunder', 'mistake', 'inaccuracy'].includes(m.cat))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 4)
    .sort((a, b) => a.ply - b.ply);
  const stars = focus.filter((m) => m.cat === 'best').length;
  $('#moments').innerHTML = key.length
    ? key
        .map((m) => {
          const best = uciToSan(fens[m.ply - 1], bests[m.ply - 1]);
          return `<li><button data-goto="${m.ply}"><span class="badge ${CATS[m.cat].cls}">${CATS[m.cat].sym}</span>
            <span><b>${moveLabel(m)}</b> — ${CATS[m.cat].label.toLowerCase()}${best ? `, mieux : ${frSan(best)}` : ''}</span></button></li>`;
        })
        .join('')
    : `<li class="empty">Aucune erreur importante. Propre !${stars ? ` Et ${stars === 1 ? 'un meilleur coup ★' : `${stars} meilleurs coups ★`} !` : ''}</li>`;
  $('#moments').addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (b) goTo(Number(b.dataset.goto));
  });
}

function renderMoveList() {
  let html = '';
  for (let i = 0; i < plies.length; i += 2) {
    const cell = (j) => {
      const m = plies[j];
      if (!m) return '<span></span>';
      const show = ['blunder', 'mistake', 'inaccuracy', 'best', 'excellent'].includes(m.cat);
      return `<button class="mv ${CATS[m.cat].cls}" data-ply="${j + 1}">${frSan(m.san)}${show ? `<i>${CATS[m.cat].sym}</i>` : ''}</button>`;
    };
    html += `<li><span class="num">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</li>`;
  }
  $('#moves').innerHTML = html;
}

/** Boutons et flèches : dans une variante, on avance ou recule dans la variante ; sinon dans la partie. */
function navigate(nav) {
  if (vari) {
    if (nav === 'prev') {
      if (vIdx > 1) {
        vIdx--;
        return showVar();
      }
      return goTo(vari.base);
    }
    if (nav === 'next') {
      if (vIdx < vari.steps.length) {
        vIdx++;
        showVar();
      }
      return;
    }
    return goTo(nav === 'first' ? 0 : plies.length);
  }
  goTo(nav === 'first' ? 0 : nav === 'prev' ? cur - 1 : nav === 'next' ? cur + 1 : plies.length);
}

/** Les pièces de la position affichée peuvent bouger (les deux camps, selon le trait). */
function setMovable(fen) {
  const c = new Chess(fen);
  ground.set({ movable: { color: c.isGameOver() ? undefined : 'both', dests: legalDests(c) } });
}

function goTo(ply) {
  vari = null;
  vIdx = 0;
  $('.review-board')?.classList.remove('exploring');
  cur = Math.max(0, Math.min(plies.length, ply));
  const fen = fens[cur];
  const c = new Chess(fen);
  const m = plies[cur - 1];
  const shapes = [];
  if (m && ['inaccuracy', 'mistake', 'blunder'].includes(m.cat) && bests[cur - 1]) {
    const b = bests[cur - 1];
    shapes.push({ from: b.slice(0, 2), to: b.slice(2, 4), color: 'green' });
  }
  ground.set({
    fen,
    orientation: colorName(orientation),
    lastMove: m ? [m.from, m.to] : undefined,
    check: c.inCheck() ? colorName(c.turn()) : false,
    turnColor: colorName(c.turn()),
  });
  marks.update(fen);
  marks.setAuto(shapes);
  setMovable(fen);
  // Badge de la catégorie sur la case d'arrivée
  $('#board .move-badge')?.remove();
  if (m) {
    const badge = document.createElement('div');
    badge.className = `move-badge badge ${CATS[m.cat].cls}`;
    badge.textContent = CATS[m.cat].sym;
    const file = m.to.charCodeAt(0) - 97;
    const rank = Number(m.to[1]) - 1;
    const x = orientation === 'w' ? file : 7 - file;
    const y = orientation === 'w' ? 7 - rank : rank;
    badge.style.left = `calc(${(x + 1) * 12.5}% - 14px)`;
    badge.style.top = `calc(${y * 12.5}% - 8px)`;
    $('#board').appendChild(badge);
  }

  // Barre d'évaluation
  const cp = evals[cur];
  const pct = winPercent(cp);
  $('#eval-fill').style.height = `${orientation === 'w' ? pct : 100 - pct}%`;
  $('#eval-bar').classList.toggle('flipped', orientation === 'b');
  $('#eval-num').textContent = formatEval(cp);
  $('#eval-num').className = cp >= 0 ? 'w' : 'b';

  // Commentaire
  $('#comment').innerHTML = commentFor(cur);

  $$('#moves .mv').forEach((b) => b.classList.toggle('active', Number(b.dataset.ply) === cur));
  const act = $('#moves .active');
  if (act) scrollMoveIntoList($('#moves'), act);
  $$('#graph .cursor').forEach((el) => el.setAttribute('x1', gx(cur)) || el.setAttribute('x2', gx(cur)));
}

// ---------------------------------------------------------------------------
// Tester ses propres coups (variante)
// ---------------------------------------------------------------------------
const varFen = () => (vari && vIdx > 0 ? vari.steps[vIdx - 1].fen : fens[vari ? vari.base : cur]);
/** Évaluation (point de vue des Blancs) et meilleur coup de la position avant le coup n° i de la variante. */
const varBefore = (i) => (i === 0 ? { eval: evals[vari.base], best: bests[vari.base] } : vari.steps[i - 1]);

async function onUserMove(orig, dest) {
  const fenBefore = vari ? varFen() : fens[cur];
  const c = new Chess(fenBefore);
  dest = castleDest(c, orig, dest);
  let promotion;
  if (isPromotion(c, orig, dest)) {
    promotion = await askPromotion(c.turn());
    if (!promotion) return vari ? showVar() : goTo(cur);
  }
  let m;
  try {
    m = c.move({ from: orig, to: dest, promotion });
  } catch {
    m = null;
  }
  if (!m) return vari ? showVar() : goTo(cur);
  if (!vari) {
    // Le coup de la partie : on avance simplement
    const next = plies[cur];
    if (next && next.from === m.from && next.to === m.to && (next.promotion || '') === (m.promotion || '')) return goTo(cur + 1);
    vari = { base: cur, steps: [] };
    vIdx = 0;
  }
  // Rejoué depuis le milieu de la variante : la suite est remplacée
  vari.steps = vari.steps.slice(0, vIdx);
  m.ply = vari.base + vari.steps.length + 1; // numéro du demi-coup (pour « 12. Cf3 »)
  const step = { move: m, fen: c.fen(), pending: true };
  vari.steps.push(step);
  vIdx = vari.steps.length;
  const i = vIdx - 1;
  const v = vari;
  showVar();
  await evalStep(v, i);
  if (vari === v && v.steps[i] === step) showVar();
}

/** Le moteur note le coup : évaluation après le coup, meilleur coup ensuite, et la chance de gain perdue. */
async function evalStep(v, i) {
  const step = v.steps[i];
  const pos = new Chess(step.fen);
  if (pos.isCheckmate()) {
    step.eval = pos.turn() === 'w' ? -10000 : 10000;
    step.best = null;
  } else if (pos.isDraw() || pos.isStalemate()) {
    step.eval = 0;
    step.best = null;
  } else {
    vEngine ||= new Engine();
    const res = await vEngine.analyse(step.fen, { depth: DEPTH });
    step.eval = toWhiteCp(res.lines[0], pos.turn());
    step.best = res.bestmove;
  }
  // L'évaluation d'avant (le coup précédent de la variante doit être noté d'abord)
  const before = i === 0 ? { eval: evals[v.base], best: bests[v.base] } : v.steps[i - 1];
  for (let k = 0; k < 100 && before.pending; k++) await new Promise((r) => setTimeout(r, 100));
  const m = step.move;
  const sign = m.color === 'w' ? 1 : -1;
  const wb = winPercent(sign * before.eval);
  const wa = winPercent(sign * step.eval);
  const loss = Math.max(0, wb - wa);
  const uci = m.from + m.to + (m.promotion || '');
  let cat = uci === before.best ? 'best' : loss < 2 ? 'excellent' : loss < 7 ? 'good' : loss < 12 ? 'inaccuracy' : loss < 22 ? 'mistake' : 'blunder';
  if (sign * step.eval < -9000 && sign * before.eval > -9000) cat = 'blunder'; // laisse un mat
  if (sign * before.eval > 9000 && sign * step.eval < 9000 && cat !== 'best') cat = wa > 85 ? 'mistake' : 'blunder'; // mat raté
  if (m.san.includes('#')) cat = 'best';
  Object.assign(step, { cat, loss, pending: false });
}

/** Affiche la variante : plateau, flèche du meilleur coup, barre d'évaluation et l'avis de Noa. */
function showVar() {
  $('.review-board')?.classList.add('exploring');
  const fen = varFen();
  const c = new Chess(fen);
  const step = vIdx > 0 ? vari.steps[vIdx - 1] : null;
  const shapes = [];
  if (step && !step.pending && ['inaccuracy', 'mistake', 'blunder'].includes(step.cat)) {
    const b = varBefore(vIdx - 1).best;
    if (b) shapes.push({ from: b.slice(0, 2), to: b.slice(2, 4), color: 'green' });
  }
  ground.set({
    fen,
    orientation: colorName(orientation),
    lastMove: step ? [step.move.from, step.move.to] : undefined,
    check: c.inCheck() ? colorName(c.turn()) : false,
    turnColor: colorName(c.turn()),
  });
  marks.update(fen);
  marks.setAuto(shapes);
  setMovable(fen);
  $('#board .move-badge')?.remove();
  if (step && !step.pending) {
    const badge = document.createElement('div');
    badge.className = `move-badge badge ${CATS[step.cat].cls}`;
    badge.textContent = CATS[step.cat].sym;
    const file = step.move.to.charCodeAt(0) - 97;
    const rank = Number(step.move.to[1]) - 1;
    const x = orientation === 'w' ? file : 7 - file;
    const y = orientation === 'w' ? 7 - rank : rank;
    badge.style.left = `calc(${(x + 1) * 12.5}% - 14px)`;
    badge.style.top = `calc(${y * 12.5}% - 8px)`;
    $('#board').appendChild(badge);
  }
  // Barre d'évaluation : celle du coup testé (ou de la position de départ de la variante)
  const cp = step ? (step.pending ? null : step.eval) : evals[vari.base];
  if (cp !== null && cp !== undefined) {
    const pct = winPercent(cp);
    $('#eval-fill').style.height = `${orientation === 'w' ? pct : 100 - pct}%`;
    $('#eval-num').textContent = formatEval(cp);
    $('#eval-num').className = cp >= 0 ? 'w' : 'b';
  }
  $('#comment').innerHTML = varComment(step);
  $$('#moves .mv').forEach((b) => b.classList.toggle('active', Number(b.dataset.ply) === vari.base));
}

function varComment(step) {
  const base = vari.base;
  const line = vari.steps
    .map((s, k) => {
      const p = base + k;
      const num = p % 2 === 0 ? `${p / 2 + 1}. ` : k === 0 ? `${Math.ceil(p / 2)}… ` : '';
      const cls = s.pending ? '' : CATS[s.cat].cls;
      return `<button class="mv ${cls} ${k + 1 === vIdx ? 'active' : ''}" data-vstep="${k + 1}">${num}${frSan(s.move.san)}${s.pending ? '' : `<i>${CATS[s.cat].sym}</i>`}</button>`;
    })
    .join(' ');
  const head = `<div class="var-bar"><span class="var-tag">Ton essai</span><div class="var-line">${line}</div>
    <button class="btn btn-ghost small" type="button" data-exit-var>↩ Revenir à la partie</button></div>`;
  if (!step) return head + noaSays('neutre', '<p>Joue un coup sur l’échiquier : je te dis s’il est bon.</p>');
  if (step.pending) return head + noaSays('hmm', '<p>Je regarde ton coup…</p>');
  const cat = CATS[step.cat];
  const i = vIdx - 1;
  const before = varBefore(i);
  const fenBefore = i === 0 ? fens[base] : vari.steps[i - 1].fen;
  let text = '';
  try {
    resetPhrasing((base + i) * 7 + 5);
    text = explainMove({
      fenBefore,
      move: step.move,
      cat: step.cat,
      bestUci: before.best,
      replyUci: step.best,
      evalBefore: before.eval,
      evalAfter: step.eval,
      prior: [...plies.slice(0, base), ...vari.steps.slice(0, i).map((s) => s.move)],
    });
  } catch {
    text = `<p>${cat.label}.</p>`;
  }
  // Comparé au coup joué dans la partie
  let cmp = '';
  if (i === 0 && plies[base]) {
    const g = plies[base];
    cmp = `<p class="muted var-cmp">Dans la partie : ${frSan(g.san)} <span class="cat-name ${CATS[g.cat].cls}">${CATS[g.cat].label}</span></p>`;
  }
  let sugg = '';
  if (['inaccuracy', 'mistake', 'blunder'].includes(step.cat) && before.best) {
    const san = uciToSan(fenBefore, before.best);
    if (san) sugg = `<p class="pv"><span class="muted">Meilleur coup ici :</span> ${frSan(san)}</p>`;
  }
  const delta = step.loss >= 3 ? `<span class="loss">−${step.loss.toFixed(0)} % de chances de gain</span>` : '';
  return `${head}<div class="comment-head"><span class="badge ${cat.cls}">${cat.sym}</span>
      <h3>${moveLabel(step.move)} <span class="cat-name ${cat.cls}">${cat.label}</span></h3><span class="eval-pill">${formatEval(step.eval)}</span></div>
    ${delta ? `<p class="muted mover-line">${delta}</p>` : ''}
    ${noaSays(EMOTE[step.cat], text + sugg)}${cmp}`;
}

// Expression de Noa selon la qualité du coup
const EMOTE = { best: 'frime', excellent: 'content', good: 'neutre', inaccuracy: 'hmm', mistake: 'grimace', blunder: 'surpris' };

function noaSays(emote, html) {
  return `<div class="noa-says"><img class="noa-face" src="img/noa/${emote}.svg" alt="Noa" width="56" height="56">
    <div class="bubble"><span class="noa-name">Noa</span>${html}</div></div>`;
}

function commentFor(ply) {
  if (ply === 0) {
    return `<div class="comment-head"><h3>Position de départ</h3></div>
      ${noaSays('neutre', '<p>Salut, c’est Noa ! Avance coup par coup avec les flèches ← → (ou clique sur un coup) : je t’explique ce qui marche, ce qui coince, et ce qu’il fallait jouer.</p><p>Tu peux aussi <b>bouger les pièces toi-même</b> pour tester un autre coup : je te dis s’il est bon.</p>')}`;
  }
  const m = plies[ply - 1];
  const cat = CATS[m.cat];
  const fenBefore = fens[ply - 1];
  const evalTxt = formatEval(evals[ply]);
  const mover = m.color === 'w' ? game.white : game.black;

  resetPhrasing(ply * 7 + 3);
  const text = explainMove({
    fenBefore,
    move: m,
    cat: m.cat,
    bestUci: bests[ply - 1],
    replyUci: bests[ply],
    evalBefore: evals[ply - 1],
    evalAfter: evals[ply],
    prior: plies.slice(0, ply - 1),
  });

  let emote = EMOTE[m.cat];
  if (m.san.includes('#')) emote = game.me && m.color !== game.me ? 'grimace' : 'rire';

  let line = '';
  if (['inaccuracy', 'mistake', 'blunder'].includes(m.cat) && pvs[ply - 1]?.length) {
    const san = pvToSan(fenBefore, pvs[ply - 1]);
    line = `<p class="pv"><span class="muted">Suite conseillée :</span> ${formatLine(san, ply - 1)}</p>`;
  }
  const delta = m.loss >= 3 ? `<span class="loss">−${m.loss.toFixed(0)} % de chances de gain</span>` : '';
  return `<div class="comment-head"><span class="badge ${cat.cls}">${cat.sym}</span>
      <h3>${moveLabel(m)} <span class="cat-name ${cat.cls}">${cat.label}</span></h3><span class="eval-pill">${evalTxt}</span></div>
    <p class="muted mover-line">${escapeHtml(mover)} ${delta}</p>
    ${noaSays(emote, text + line)}`;
}

function formatLine(sans, startPly) {
  return sans
    .map((s, k) => {
      const p = startPly + k; // nombre de demi-coups déjà joués
      const num = p % 2 === 0 ? `${p / 2 + 1}. ` : k === 0 ? `${Math.ceil(p / 2)}… ` : '';
      return num + frSan(s);
    })
    .join(' ');
}

// ---------------------------------------------------------------------------
// Graphique d'évaluation
// ---------------------------------------------------------------------------
const GW = 800;
const GH = 160;
const gx = (i) => (fens.length > 1 ? (i / (fens.length - 1)) * GW : 0);
const gy = (cp) => GH - (winPercent(cp) / 100) * GH;

function drawGraph() {
  const pts = evals.map((e, i) => `${gx(i).toFixed(1)},${gy(e).toFixed(1)}`);
  const area = `M0,${GH} L${pts.join(' L')} L${GW},${GH} Z`;
  const dots = plies
    .filter((m) => ['mistake', 'blunder'].includes(m.cat))
    .map((m) => `<circle cx="${gx(m.ply)}" cy="${gy(evals[m.ply])}" r="5" class="dot ${CATS[m.cat].cls}"><title>${moveLabel(m)} — ${CATS[m.cat].label}</title></circle>`)
    .join('');
  $('#graph').innerHTML = `<svg viewBox="0 0 ${GW} ${GH}" class="eval-graph">
      <rect width="${GW}" height="${GH}" class="g-bg"/>
      <path d="${area}" class="g-area"/>
      <line x1="0" x2="${GW}" y1="${GH / 2}" y2="${GH / 2}" class="g-mid"/>
      <polyline points="${pts.join(' ')}" class="g-line" vector-effect="non-scaling-stroke"/>
      <line class="cursor" x1="0" x2="0" y1="0" y2="${GH}" vector-effect="non-scaling-stroke"/>
      ${dots}
    </svg>`;
  const svg = $('#graph svg');
  const pick = (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (fens.length - 1));
    goTo(i);
  };
  svg.addEventListener('click', pick);
  svg.addEventListener('pointermove', (e) => e.buttons && pick(e));
}

// ---------------------------------------------------------------------------
// Démarrage (à la fin du fichier, une fois toutes les fonctions et constantes prêtes)
// ---------------------------------------------------------------------------
const id = new URLSearchParams(location.search).get('partie');
const owner = new URLSearchParams(location.search).get('joueur'); // partie d'un autre joueur (depuis son profil)
if (id && !owner && getGame(id)) start(getGame(id));
else if (id) {
  // Partie rangée sur le serveur (la mienne, ou celle du profil qu'on regarde)
  session
    .then(() => historyGame(id, owner))
    .then((h) => {
      if (!h) return showPicker();
      const g = serverGameToLocal(historyToGame(h));
      if (!owner) saveGame(g); // la partie d'un autre joueur ne va pas dans « mes parties »
      start(g);
    })
    .catch(showPicker);
} else showPicker();
