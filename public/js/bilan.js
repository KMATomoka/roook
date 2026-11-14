// Page « Bilan » : le moteur analyse chaque coup, puis Noa, le coach, explique la partie.
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { Engine, toWhiteCp, winPercent, formatEval } from './engine.js';
import { attachArrows } from './arrows.js';
import { explainMove, resetPhrasing } from './explain.js';
import { scrollMoveIntoList } from './common.js';
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
let cur = 0;
let orientation = 'w';
let ground = null;
let marks = null;

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

  if (g.analysis && g.analysis.depth === DEPTH && g.analysis.evals.length === fens.length) {
    ({ evals, bests, pvs } = g.analysis);
  } else {
    $('#progress').hidden = false;
    const engine = new Engine();
    evals = [];
    bests = [];
    pvs = [];
    for (let i = 0; i < fens.length; i++) {
      $('#progress-text').textContent = i === 0 ? 'Position de départ' : `Coup ${Math.ceil(i / 2)} sur ${Math.ceil((fens.length - 1) / 2)}`;
      $('#progress-bar').style.width = `${Math.round((i / fens.length) * 100)}%`;
      const pos = new Chess(fens[i]);
      if (pos.isCheckmate()) {
        evals.push(pos.turn() === 'w' ? -10000 : 10000);
        bests.push(null);
        pvs.push([]);
        continue;
      }
      if (pos.isDraw() || pos.isStalemate()) {
        evals.push(0);
        bests.push(null);
        pvs.push([]);
        continue;
      }
      const res = await engine.analyse(fens[i], { depth: DEPTH });
      evals.push(toWhiteCp(res.lines[0], pos.turn()));
      bests.push(res.bestmove);
      pvs.push((res.lines[0]?.pv || []).slice(0, 6));
    }
    engine.destroy();
    $('#progress-bar').style.width = '100%';
    g.analysis = { depth: DEPTH, evals, bests, pvs };
    saveGame(g);
    $('#progress').hidden = true;
  }
  classify();
  showReview();
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
    if (uci === bests[i] || loss < 0.5) cat = uci === bests[i] ? 'best' : 'excellent';
    else if (loss < 3) cat = 'excellent';
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
    movable: { free: false, color: undefined },
    draggable: { enabled: false },
    selectable: { enabled: false },
    drawable: { enabled: false }, // flèches au clic droit : arrows.js
    animation: { duration: 160 },
  });
  marks = attachArrows($('.review-board .board-frame'), ground, () => orientation);
  $('#moves').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ply]');
    if (b) goTo(Number(b.dataset.ply));
  });
  $$('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      const nav = b.dataset.nav;
      goTo(nav === 'first' ? 0 : nav === 'prev' ? cur - 1 : nav === 'next' ? cur + 1 : plies.length);
    }),
  );
  $('#flip').addEventListener('click', () => {
    orientation = orientation === 'w' ? 'b' : 'w';
    goTo(cur);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(cur - 1);
    if (e.key === 'ArrowRight') goTo(cur + 1);
    if (e.key === 'ArrowUp') goTo(0);
    if (e.key === 'ArrowDown') goTo(plies.length);
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
    lines.push(`<span class="tip">💡 ${tip(who, phases)}</span>`);
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
  const brilliant = focus.filter((m) => m.cat === 'best' && m.loss < 1 && evals[m.ply - 1] !== undefined).length;
  $('#moments').innerHTML = key.length
    ? key
        .map((m) => {
          const best = uciToSan(fens[m.ply - 1], bests[m.ply - 1]);
          return `<li><button data-goto="${m.ply}"><span class="badge ${CATS[m.cat].cls}">${CATS[m.cat].sym}</span>
            <span><b>${moveLabel(m)}</b> — ${CATS[m.cat].label.toLowerCase()}${best ? `, mieux : ${frSan(best)}` : ''}</span></button></li>`;
        })
        .join('')
    : `<li class="empty">Aucune erreur importante, et ${brilliant} coups parfaits. Propre !</li>`;
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
      const show = ['blunder', 'mistake', 'inaccuracy', 'best'].includes(m.cat);
      return `<button class="mv ${CATS[m.cat].cls}" data-ply="${j + 1}">${frSan(m.san)}${show ? `<i>${CATS[m.cat].sym}</i>` : ''}</button>`;
    };
    html += `<li><span class="num">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</li>`;
  }
  $('#moves').innerHTML = html;
}

function goTo(ply) {
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

// Expression de Noa selon la qualité du coup
const EMOTE = { best: 'frime', excellent: 'content', good: 'neutre', inaccuracy: 'hmm', mistake: 'grimace', blunder: 'surpris' };

function noaSays(emote, html) {
  return `<div class="noa-says"><img class="noa-face" src="img/noa/${emote}.svg" alt="Noa" width="56" height="56">
    <div class="bubble"><span class="noa-name">Noa</span>${html}</div></div>`;
}

function commentFor(ply) {
  if (ply === 0) {
    return `<div class="comment-head"><h3>Position de départ</h3></div>
      ${noaSays('neutre', '<p>Salut, c’est Noa ! Avance coup par coup avec les flèches ← → (ou clique sur un coup) : je t’explique ce qui marche, ce qui coince, et ce qu’il fallait jouer.</p>')}`;
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
if (id && getGame(id)) start(getGame(id));
else if (id) {
  // Partie jouée contre un ami : on la récupère sur le serveur
  session
    .then(() => historyGame(id))
    .then((h) => {
      if (!h) return showPicker();
      const g = serverGameToLocal(historyToGame(h));
      saveGame(g);
      start(g);
    })
    .catch(showPicker);
} else showPicker();
