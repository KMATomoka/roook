// Page « Apprendre » : leçons pas à pas pour les débutants (déplacement des pièces, règles spéciales,
// échec et mat), puis exercices : « Mat à l'infini » (positions créées au hasard, mat en 1, 2 ou 3,
// vérifiées par Stockfish), gagner une pièce, défendre.
// Le contenu est dans apprendre-data.js ; la progression est gardée dans le navigateur.
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { $, Chess, legalDests, castleDest, isPromotion, askPromotion, getPref, setPref, frSan } from './common.js';
import './compte.js'; // compte, barre du haut, apparence choisie dans l'inventaire
import { createFx } from './fx.js';
import { CHAPTERS, LESSONS, PUZZLE_CATS, PUZZLES } from './apprendre-data.js';
import { Engine } from './engine.js';
import { findMate } from './mat-gen.js';

const ROLE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const WON = { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame' };
const BRAVO = ['Bravo !', 'Bien joué !', 'Parfait !', 'Exactement !', 'Super !'];
const GOAL_TEXT = {
  mate1: 'Fais échec et mat en un seul coup.',
  mate2: 'Fais échec et mat en deux coups, quoi que réponde ton adversaire.',
  defend: 'Ton adversaire menace de te faire échec et mat au prochain coup. Trouve un coup qui l’en empêche.',
  line: 'Trouve le coup qui te fait gagner une pièce.',
};
const PIECE_HINT = { p: 'un de tes pions', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'ta dame', k: 'ton roi' };
const INF_MODES = { hasard: 'Au hasard', 1: 'Mat en 1', 2: 'Mat en 2', 3: 'Mat en 3' };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const isOpening = (l) => l.chapter.startsWith('ouv-');
const groupOf = (l) => (isOpening(l) ? 'ouvertures' : 'lecons');
const GOOD = ['Bien !', 'Exact !', 'Oui !', 'Parfait !'];
const noCheck = (san) => san.replace(/[+#]/g, '');
const ESCAPE_WRONG = {
  king: 'Tu es bien sorti de l’échec, mais ici on veut que tu bouges le roi.',
  capture: 'Tu es bien sorti de l’échec, mais ici on veut que tu prennes la pièce qui attaque.',
  block: 'Tu es bien sorti de l’échec, mais ici on veut que tu mettes une pièce entre ton roi et la tour.',
};

const other = (c) => (c === 'w' ? 'b' : 'w');
const colorName = (c) => (c === 'w' ? 'white' : 'black');
const load = (fen) => new Chess(fen, { skipValidation: true });
const uci = (m) => m.from + m.to + (m.promotion || '');
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const icon = (role, color = 'white') => `<span class="cg-wrap learn-ico" aria-hidden="true"><piece class="${role} ${color}"></piece></span>`;

// --- Progression (dans le navigateur) -------------------------------------------
const progress = { lessons: {}, puzzles: {}, infinite: { solved: 0, streak: 0, best: 0 }, ...getPref('apprendre', {}) };
const save = () => setPref('apprendre', progress);

// --- Échiquier ------------------------------------------------------------------
let orientation = 'w';
const ground = Chessground($('#board'), {
  coordinates: true,
  animation: { enabled: true, duration: 200 },
  highlight: { lastMove: true, check: true },
  movable: { free: false, showDests: true, events: { after: onUserMove } },
  premovable: { enabled: false },
  draggable: { showGhost: true },
  drawable: { enabled: false, visible: true },
});
const fx = createFx($('.board-frame'), () => orientation);

// --- État de la leçon ou de l'exercice en cours -----------------------------------
let cur = null; // { kind: 'lesson', lesson, step } | { kind: 'puzzle', puzzle } | { kind: 'infinite', mode }
let task = null; // l'étape ou l'exercice joué
let chess = null;
let player = 'w';
let busy = false; // l'adversaire joue, ou un coup raté va être annulé
let finished = false;
let phase = 0; // mat en 2 : 0 = premier coup, 1 = coup du mat
let lineIdx = 0; // suite d'un exercice « line »
let visited = new Set(); // cases marquées déjà atteintes
let shownSolution = false;
let made = 0; // « Mat à l'infini » : coups déjà joués par le joueur
let mistake = false; // un coup raté dans cet exercice (la série sans faute s'arrête)
let seq = 0; // ouvertures : prochain coup de la suite
let gen = 0; // change à chaque nouvelle tâche (pour ignorer les minuteries d'avant)

const later = (ms, f) => {
  const g = gen;
  setTimeout(() => g === gen && f(), ms);
};

/** Même position, mais c'est encore au joueur (dans les leçons, les pièces noires ne bougent pas). */
function playerTurn(c) {
  const f = c.fen().split(' ');
  f[1] = player;
  f[3] = '-';
  return load(f.join(' '));
}

function dests() {
  const d = legalDests(chess);
  if (task.only) for (const from of [...d.keys()]) if (!task.only.includes(chess.get(from)?.type)) d.delete(from);
  return d;
}

function targetMap() {
  const m = new Map();
  for (const sq of task.targets || []) m.set(sq, visited.has(sq) ? 'learn-target done' : 'learn-target');
  return m;
}

function sync(lastMove) {
  if (lastMove === undefined) {
    const last = chess.history({ verbose: true }).at(-1);
    lastMove = last ? [last.from, last.to] : undefined;
  }
  const turn = chess.turn();
  const canMove = !busy && !finished && turn === player;
  ground.set({
    fen: chess.fen(),
    orientation: colorName(orientation),
    turnColor: colorName(turn),
    lastMove,
    check: chess.inCheck() ? colorName(turn) : false,
    movable: { color: canMove ? colorName(player) : undefined, dests: canMove ? dests() : new Map() },
    highlight: { custom: targetMap() },
  });
}

function feedback(text, kind = '') {
  const el = $('#p-feedback');
  el.textContent = text;
  el.className = 'learn-feedback' + (kind ? ' ' + kind : '');
}

// --- Jouer ----------------------------------------------------------------------
async function onUserMove(from, to) {
  if (finished || busy) return sync();
  to = castleDest(chess, from, to); // roi posé sur sa tour = roque
  let promotion;
  if (isPromotion(chess, from, to)) {
    promotion = await askPromotion(chess.turn());
    if (!promotion) return sync();
  }
  let m;
  try {
    m = chess.move({ from, to, promotion });
  } catch {
    return sync();
  }
  ground.setAutoShapes([]);
  fx.move(m, chess, { me: player });
  sync([m.from, m.to]);
  judge(m);
}

/** Coup de l'adversaire (prévu par la leçon ou choisi par la page). */
function playOpp(u) {
  const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  fx.move(m, chess, { me: player });
  return m;
}

const copyAfter = (c, m) => {
  const d = load(c.fen());
  d.move(m);
  return d;
};
const mates = (c) => c.moves({ verbose: true }).filter((m) => copyAfter(c, m).isCheckmate());
/** Après le coup du joueur : quoi que réponde l'adversaire, un mat existe. */
const forcesMate = (c) => !c.isGameOver() && c.moves({ verbose: true }).every((r) => mates(copyAfter(c, r)).length > 0);

function judge(m) {
  const g = task.goal;
  if (g === 'targets' || g === 'capture' || g === 'promote') {
    if (task.targets?.includes(m.to)) visited.add(m.to);
    const done =
      g === 'targets' ? visited.size === task.targets.length
      : g === 'capture' ? !chess.board().flat().some((p) => p && p.color !== player)
      : !!m.promotion;
    if (done) return success(g === 'promote' ? `Ton pion est devenu ${m.promotion === 'q' ? 'une dame' : 'une nouvelle pièce'} !` : undefined);
    chess = playerTurn(chess); // les pièces noires ne bougent pas : c'est encore à toi
    sync([m.from, m.to]);
    if (g === 'targets') feedback(`${visited.size} sur ${task.targets.length}, continue !`, 'good');
    return;
  }
  if (g === 'move') return task.moves.includes(uci(m)) ? success() : wrong(task.wrong || 'Ce n’est pas le coup attendu. Réessaie !');
  if (g === 'castle') {
    const side = m.flags.includes('k') ? 'k' : m.flags.includes('q') ? 'q' : null;
    if (side === task.side) return success(side === 'k' ? 'Petit roque réussi !' : 'Grand roque réussi !');
    return wrong(side ? 'C’est bien un roque, mais pas du bon côté. Réessaie !' : 'Ce n’est pas un roque : déplace ton roi de deux cases vers la tour.');
  }
  if (g === 'check') return chess.inCheck() ? success('Échec ! Le roi noir est attaqué.') : wrong('Ce coup n’attaque pas le roi noir. Réessaie !');
  if (g === 'escape') {
    const ok = task.how === 'king' ? m.piece === 'k' : task.how === 'capture' ? !!m.captured : m.piece !== 'k' && !m.captured;
    return ok ? success('Ton roi n’est plus en échec.') : wrong(ESCAPE_WRONG[task.how]);
  }
  if (g === 'mateN') {
    made++;
    if (chess.isCheckmate()) return success('Échec et mat !');
    if (chess.isStalemate() || made >= task.n) return judgeMate();
    busy = true;
    feedback('Noa vérifie ton coup…');
    sync();
    const g0 = gen;
    analyseMate(chess.fen()).then(({ mate, best }) => {
      if (g0 !== gen) return;
      const left = task.n - made;
      if (mate === undefined || mate >= 0 || -mate > left || !best) {
        busy = false;
        return wrong('Ce coup laisse une porte de sortie à ton adversaire : il n’y a plus de mat forcé. Réessaie !', 1700);
      }
      playOpp(best);
      busy = false;
      feedback(`Bien joué ! Ton adversaire s’est défendu au mieux. ${left > 1 ? `Encore ${left} coups` : 'Plus qu’un coup'} pour faire mat.`, 'good');
      sync();
    });
    return;
  }
  if (g === 'sequence') {
    const [san, say] = task.moves[seq];
    const want = san.split('|').map(noCheck);
    if (!want.includes(noCheck(m.san))) return wrong(`Pas ce coup-là. ${say}`, 1900);
    seq++;
    feedback(pick(GOOD), 'good');
    return seqNext();
  }
  if (g === 'mate' || g === 'mate1') return judgeMate();
  if (g === 'mate2') {
    if (phase === 1) return judgeMate();
    if (!forcesMate(chess)) return wrong('Ce coup ne force pas le mat : ton adversaire pourrait s’en sortir. Cherche un coup qui ne lui laisse aucun choix.', 1500);
    phase = 1;
    busy = true;
    feedback('Bien vu ! Ton adversaire répond…', 'good');
    sync();
    later(800, () => {
      const replies = chess.moves({ verbose: true });
      playOpp(uci(pick(replies)));
      busy = false;
      feedback('Maintenant, fais échec et mat !', 'good');
      sync();
    });
    return;
  }
  if (g === 'defend') {
    const threat = chess.isCheckmate() ? null : mates(chess)[0];
    if (!threat) return success('Bien défendu ! Ton adversaire n’a plus de mat.');
    busy = true;
    feedback('Pas suffisant… regarde la réponse de ton adversaire.', 'bad');
    sync();
    later(800, () => {
      playOpp(uci(threat));
      sync();
      feedback('Échec et mat : cette défense ne suffisait pas. Réessaie !', 'bad');
    });
    later(2600, () => {
      chess.undo();
      chess.undo();
      fx.reset();
      busy = false;
      sync();
    });
    return;
  }
  if (g === 'line') {
    const want = task.line[lineIdx].split('|');
    if (!want.includes(uci(m))) return wrong('Ce n’est pas le meilleur coup ici. Cherche encore !');
    lineIdx++;
    if (lineIdx >= task.line.length) return success(m.captured ? `${pick(BRAVO)} Tu gagnes ${WON[m.captured]}.` : undefined);
    busy = true;
    feedback('Bon coup ! Ton adversaire répond…', 'good');
    sync();
    later(800, () => {
      playOpp(task.line[lineIdx]);
      lineIdx++;
      busy = false;
      feedback('À toi : récupère ce que tu as gagné !', 'good');
      sync();
    });
  }
}

function judgeMate() {
  if (chess.isCheckmate()) return success('Échec et mat !');
  if (chess.isStalemate()) return wrong('Pat ! Le roi adverse n’est pas en échec mais ne peut plus bouger : la partie serait nulle. Réessaie.', 2000);
  if (chess.inCheck()) return wrong('Échec, mais pas mat : le roi peut encore s’en sortir. Réessaie !', 1400);
  return wrong('Ce coup ne fait pas échec et mat. Réessaie !');
}

/** Coup raté : on explique, puis on l'annule. */
function wrong(text, delay = 1100) {
  busy = true;
  mistake = true;
  feedback(text, 'bad');
  sync();
  later(delay, () => {
    if (task.goal === 'mateN') made--;
    chess.undo();
    fx.reset();
    busy = false;
    sync();
  });
}

function success(text) {
  finished = true;
  sync();
  feedback(text || pick(BRAVO), 'good');
  if (cur.kind === 'lesson') {
    const L = cur.lesson;
    const lastStep = cur.step === L.steps.length - 1;
    renderSteps(cur.step + 1);
    if (!lastStep) {
      // ouvertures : on laisse le temps de lire le résumé avant l'étape suivante
      later(task.goal === 'sequence' ? 4200 : 1400, () => (location.hash = `#lecon/${L.id}/${cur.step + 1}`));
      return;
    }
    progress.lessons[L.id] = true;
    save();
    feedback(`${text || pick(BRAVO)} Leçon terminée ! 🎉`, 'good');
    const same = LESSONS.filter((l) => groupOf(l) === groupOf(L));
    const next = same[same.indexOf(L) + 1];
    const after = isOpening(L) ? ['Toutes les ouvertures →', '#ouvertures'] : ['Passer aux entraînements →', '#exercices'];
    showNext(next ? `${isOpening(L) ? 'Ouverture' : 'Leçon'} suivante : ${next.title} →` : after[0], next ? `#lecon/${next.id}` : after[1]);
  } else if (cur.kind === 'infinite') {
    const st = progress.infinite;
    if (!shownSolution) st.solved++;
    st.streak = shownSolution || mistake ? 0 : st.streak + 1;
    st.best = Math.max(st.best, st.streak);
    save();
    renderSteps();
    if (st.streak > 1) feedback(`${text || pick(BRAVO)} 🔥 ${st.streak} d’affilée sans faute !`, 'good');
    showNext('Position suivante →', `#infini/${cur.mode}`);
    prefetch = { mode: cur.mode, promise: generate(cur.mode) }; // la suivante se prépare pendant que tu regardes
  } else {
    const P = cur.puzzle;
    if (!shownSolution) progress.puzzles[P.id] = true;
    save();
    renderSteps();
    const next = PUZZLES[PUZZLES.indexOf(P) + 1];
    showNext(next ? 'Exercice suivant →' : 'Revenir aux entraînements', next ? `#exo/${next.id}` : '#exercices');
  }
}

function showNext(label, href) {
  const b = $('#btn-next');
  b.textContent = label;
  b.dataset.href = href;
  b.hidden = false;
  $('#btn-solution').hidden = true;
  $('#btn-hint').hidden = true;
}

/** Un coup qui marche, pour le bouton « Solution » (ou null). */
function solutionMove() {
  const ms = chess.moves({ verbose: true });
  const g = task.goal;
  if (g === 'line') return ms.find((m) => task.line[lineIdx].split('|')[0] === uci(m));
  if (g === 'sequence') return ms.find((m) => noCheck(m.san) === noCheck(task.moves[seq][0].split('|')[0]));
  if (g === 'move') return ms.find((m) => task.moves.includes(uci(m)));
  if (g === 'castle') return ms.find((m) => m.flags.includes(task.side));
  if (g === 'check') return ms.find((m) => copyAfter(chess, m).inCheck());
  if (g === 'escape') return ms.find((m) => (task.how === 'king' ? m.piece === 'k' : task.how === 'capture' ? !!m.captured : m.piece !== 'k' && !m.captured));
  if (g === 'mate' || g === 'mate1' || (g === 'mate2' && phase === 1)) return mates(chess)[0];
  if (g === 'mate2') return ms.find((m) => forcesMate(copyAfter(chess, m)));
  if (g === 'defend') return ms.find((m) => mates(copyAfter(chess, m)).length === 0);
  return null;
}

// --- Affichage d'une leçon / d'un exercice ----------------------------------------
function startTask() {
  gen++;
  fx.reset();
  ground.setAutoShapes([]);
  const fen = task.fen || START;
  const fenTurn = fen.split(' ')[1];
  chess = task.goal === 'sequence' ? new Chess(fen) : cur.kind === 'lesson' ? load(fen) : new Chess(fen);
  player = task.side || (task.pre ? other(fenTurn) : fenTurn);
  seq = 0;
  orientation = player;
  visited = new Set();
  finished = false;
  busy = false;
  phase = 0;
  lineIdx = 0;
  shownSolution = false;
  made = 0;
  mistake = false;
  feedback('');
  $('#p-hint').hidden = true;
  $('#btn-next').hidden = true;
  const hasSolution = !['targets', 'capture', 'promote'].includes(task.goal);
  $('#btn-solution').hidden = !hasSolution;
  $('#btn-hint').hidden = !task.hint && task.goal !== 'mateN';
  $('#p-turn').innerHTML = `<span class="learn-side ${colorName(player)}"></span> Tu joues les ${player === 'w' ? 'Blancs' : 'Noirs'}`;
  $('#p-text').innerHTML =
    task.text ||
    (task.goal === 'mateN'
      ? task.n === 1 ? 'Fais échec et mat en un seul coup.' : `Fais échec et mat en ${task.n} coups, quoi que réponde ton adversaire.`
      : GOAL_TEXT[task.goal]);
  $('#p-line').hidden = task.goal !== 'sequence';
  if (task.goal === 'sequence') return seqNext();
  if (task.pre) {
    busy = true;
    sync();
    later(700, () => {
      playOpp(task.pre);
      busy = false;
      sync();
    });
  } else sync();
}

// --- Ouvertures : une suite de coups. Le joueur joue ses coups (avec une explication avant chacun),
// l'adversaire répond tout seul (avec un commentaire).
function seqLine() {
  const h = chess.history();
  $('#p-line').textContent = h.length
    ? h.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + frSan(san)).join(' ')
    : 'Position de départ';
}
function seqNext() {
  seqLine();
  if (seq >= task.moves.length) {
    busy = false;
    return success(task.end);
  }
  const mine = chess.turn() === player;
  if (mine) {
    busy = false;
    $('#p-text').innerHTML = `<b>${task.title}</b><br>${task.moves[seq][1]}`;
    sync();
    return;
  }
  busy = true;
  sync();
  later(seq === 0 ? 700 : 750, () => {
    const [san, note] = task.moves[seq];
    const m = chess.move(san);
    fx.move(m, chess, { me: player });
    seq++;
    feedback(note ? `${frSan(m.san)} : ${note}` : '', '');
    sync([m.from, m.to]);
    seqNext();
  });
}

function renderSteps(doneUpTo) {
  const ol = $('#p-steps');
  if (cur.kind === 'infinite') {
    const st = progress.infinite;
    ol.innerHTML = `<li class="learn-stat">🔥 Série sans faute <b>${st.streak}</b></li><li class="learn-stat">🏆 Record <b>${st.best}</b></li><li class="learn-stat">✓ Réussis <b>${st.solved}</b></li>`;
    return;
  }
  if (cur.kind === 'lesson') {
    const n = cur.lesson.steps.length;
    const done = doneUpTo ?? cur.step;
    ol.innerHTML = cur.lesson.steps
      .map((_, i) => `<li class="${i < done ? 'done' : ''} ${i === cur.step ? 'current' : ''}"><a href="#lecon/${cur.lesson.id}/${i}" title="Étape ${i + 1} sur ${n}">${i < done ? '✓' : i + 1}</a></li>`)
      .join('');
  } else {
    const list = PUZZLES.filter((p) => p.cat === cur.puzzle.cat);
    ol.innerHTML = list
      .map((p, i) => `<li class="${progress.puzzles[p.id] ? 'done' : ''} ${p === cur.puzzle ? 'current' : ''}"><a href="#exo/${p.id}" title="Exercice ${i + 1}">${progress.puzzles[p.id] ? '✓' : i + 1}</a></li>`)
      .join('');
  }
}

/** Affiche l'échiquier. Sur petit écran, l'explication est au-dessus : après la 1re étape, on va droit à la consigne. */
function showPlay(toTask = false) {
  $('#home').hidden = true;
  $('#play').hidden = false;
  ground.redrawAll();
  const small = matchMedia('(max-width: 900px)').matches;
  // après la mise en page (et après le défilement que le navigateur rétablit au chargement)
  setTimeout(() => scrollTo({ top: small && toTask ? $('.learn-task').getBoundingClientRect().top + scrollY - 10 : 0 }), 60);
}
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function openLesson(L, step) {
  cur = { kind: 'lesson', lesson: L, step: Math.min(Math.max(step, 0), L.steps.length - 1) };
  task = L.steps[cur.step];
  const ch = CHAPTERS.find((c) => c.id === L.chapter);
  $('#back').textContent = isOpening(L) ? '← Toutes les ouvertures' : '← Toutes les leçons';
  $('#back').href = isOpening(L) ? '#ouvertures' : '#lecons';
  $('#p-kicker').textContent = `${ch.title} · étape ${cur.step + 1} sur ${L.steps.length}`;
  $('#p-title').innerHTML = `${icon(ROLE[L.piece])} ${L.title}`;
  $('#p-intro').innerHTML = `<p>${L.intro}</p>`;
  $('#p-intro').hidden = false;
  renderSteps();
  showPlay(cur.step > 0);
  startTask();
  document.title = `${L.title} — Apprendre — ROOOK`;
}

function openPuzzle(P) {
  cur = { kind: 'puzzle', puzzle: P };
  task = P;
  const cat = PUZZLE_CATS.find((c) => c.id === P.cat);
  const list = PUZZLES.filter((p) => p.cat === P.cat);
  $('#back').textContent = '← Tous les entraînements';
  $('#back').href = '#exercices';
  $('#p-kicker').textContent = `Entraînement · exercice ${list.indexOf(P) + 1} sur ${list.length}`;
  $('#p-title').textContent = cat.title;
  $('#p-intro').innerHTML = `<p>${cat.desc}</p>`;
  renderSteps();
  showPlay(true);
  startTask();
  document.title = `${cat.title} — Entraînement — ROOOK`;
}

// --- Mat à l'infini : positions créées au hasard, vérifiées par Stockfish ---------------
let engine = null;
let prefetch = null; // { mode, promise } : la position suivante, préparée à l'avance
/** Le moteur cherche le mat ; score du point de vue du camp au trait (négatif : il se fait mater). */
async function analyseMate(fen) {
  engine ||= new Engine();
  const r = await engine.analyse(fen, { depth: 14 });
  return { mate: r.lines[0]?.mate, best: r.bestmove };
}
function generate(mode) {
  const n = mode === 'hasard' ? pick([1, 2, 2, 2, 3, 3, 3]) : Number(mode);
  return findMate(Chess, analyseMate, n, { maxTries: 3000 }).then((r) => r || generate(mode));
}
const modeLinks = (mode) =>
  `<div class="learn-modes">${['hasard', '1', '2', '3']
    .map((k) => [k, INF_MODES[k]])
    .map(([k, v]) => `<a class="btn small ${String(k) === String(mode) ? 'btn-primary' : 'btn-ghost'}" href="#infini/${k}">${v}</a>`)
    .join('')}</div>`;

async function openInfinite(mode) {
  if (!INF_MODES[mode]) mode = 'hasard';
  gen++;
  const g0 = gen;
  cur = { kind: 'infinite', mode };
  task = null;
  $('#back').textContent = '← Tous les entraînements';
  $('#back').href = '#exercices';
  $('#p-kicker').textContent = 'Entraînement · Mat à l’infini';
  $('#p-title').textContent = 'Mat à l’infini';
  $('#p-intro').innerHTML = `<p>Des positions créées au hasard, sans fin. Trouve le mat : ton adversaire se défend toujours au mieux.</p>${modeLinks(mode)}`;
  renderSteps();
  showPlay(true);
  // En attendant la position : échiquier figé
  ground.set({ movable: { color: undefined, dests: new Map() }, lastMove: undefined, check: false });
  ground.setAutoShapes([]);
  fx.reset();
  for (const id of ['#btn-next', '#btn-hint', '#btn-solution', '#p-hint']) $(id).hidden = true;
  $('#p-turn').textContent = '';
  $('#p-text').textContent = 'Noa prépare une position…';
  feedback('');
  const p = prefetch?.mode === mode ? prefetch.promise : generate(mode);
  prefetch = null;
  const r = await p;
  if (g0 !== gen) return; // on est parti ailleurs entre-temps
  task = { goal: 'mateN', fen: r.fen, n: r.n };
  $('#p-title').textContent = `Mat en ${r.n}`;
  startTask();
  document.title = `Mat en ${r.n} — Entraînement — ROOOK`;
}

// --- Sommaire --------------------------------------------------------------------
function bar(n, total, label) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return `<div class="learn-bar"><div class="learn-bar-top"><span>${label}</span><b>${n} / ${total}</b></div><div class="learn-bar-track"><div style="width:${pct}%"></div></div></div>`;
}

function renderHome(tab) {
  const basics = LESSONS.filter((l) => !isOpening(l));
  const openings = LESSONS.filter(isOpening);
  const lessonsDone = basics.filter((l) => progress.lessons[l.id]).length;
  const openingsDone = openings.filter((l) => progress.lessons[l.id]).length;
  const puzzlesDone = PUZZLES.filter((p) => progress.puzzles[p.id]).length;
  $('#progress').innerHTML = `<h2>Ta progression</h2>${bar(lessonsDone, basics.length, '📘 Leçons')}${bar(openingsDone, openings.length, '♞ Ouvertures')}${bar(puzzlesDone, PUZZLES.length, '🎯 Exercices')}<p class="learn-progress-inf">♾ Mats réussis : <b>${progress.infinite.solved}</b> · record <b>${progress.infinite.best}</b> d’affilée</p>`;

  const chaptersHtml = (chapters, list) => {
  const nextLesson = list.find((l) => !progress.lessons[l.id]);
  return chapters.map((ch, ci) => {
    const lessons = list.filter((l) => l.chapter === ch.id);
    return `<section class="learn-chapter">
      <div class="learn-chapter-head"><span class="learn-num">${ci + 1}</span><div><h2>${ch.title}</h2><p class="muted">${ch.desc}</p></div></div>
      <div class="learn-grid">${lessons
        .map((l) => {
          const done = progress.lessons[l.id];
          const isNext = l === nextLesson;
          return `<a class="learn-lesson${done ? ' done' : ''}${isNext ? ' next' : ''}" href="#lecon/${l.id}">
            ${icon(ROLE[l.piece])}
            <h3>${l.title}</h3>
            <p class="muted">${l.steps.length} étape${l.steps.length > 1 ? 's' : ''}</p>
            <span class="learn-state">${done ? '✓ Terminée' : isNext ? 'À faire ensuite →' : 'Commencer →'}</span>
          </a>`;
        })
        .join('')}</div>
    </section>`;
  }).join('');
  };
  $('#pane-lecons').innerHTML = chaptersHtml(CHAPTERS.filter((c) => !c.id.startsWith('ouv-')), basics);
  $('#pane-ouvertures').innerHTML =
    `<p class="lead learn-pane-lead">Apprends les grandes ouvertures coup par coup : tu joues ton camp en suivant les explications, l’adversaire répond tout seul. Chaque ouverture a aussi sa 2<sup>e</sup> étape : comment la défendre, ou l’affronter avec l’autre camp.</p>` +
    chaptersHtml(CHAPTERS.filter((c) => c.id.startsWith('ouv-')), openings);

  const inf = progress.infinite;
  $('#pane-exercices').innerHTML = `<article class="card learn-infinite">
      <div class="learn-infinite-text">
        <h2>♾ Mat à l’infini</h2>
        <p class="muted">Des positions de mat créées au hasard, sans fin : en 1, 2 ou 3 coups. Ton adversaire se défend toujours au mieux.</p>
        <p class="learn-infinite-stats">🔥 Série sans faute <b>${inf.streak}</b> · 🏆 Record <b>${inf.best}</b> · ✓ Réussis <b>${inf.solved}</b></p>
      </div>
      ${modeLinks('')}
    </article>
    <div class="learn-cats">${PUZZLE_CATS.map((cat) => {
    const list = PUZZLES.filter((p) => p.cat === cat.id);
    const solved = list.filter((p) => progress.puzzles[p.id]).length;
    const first = list.find((p) => !progress.puzzles[p.id]) || list[0];
    return `<article class="card learn-cat">
      <div class="learn-cat-head"><h2>${cat.title}</h2><span class="muted">${solved} / ${list.length}</span></div>
      <p class="muted">${cat.desc}</p>
      <ol class="learn-steps">${list.map((p, i) => `<li class="${progress.puzzles[p.id] ? 'done' : ''}"><a href="#exo/${p.id}" title="Exercice ${i + 1}">${progress.puzzles[p.id] ? '✓' : i + 1}</a></li>`).join('')}</ol>
      <a class="btn ${solved === list.length ? 'btn-ghost' : 'btn-primary'} small" href="#exo/${first.id}">${solved === 0 ? 'Commencer' : solved === list.length ? 'Recommencer' : 'Continuer'} →</a>
    </article>`;
  }).join('')}</div>
  <p class="muted learn-tip">Astuce : commence par les leçons si tu débutes, puis « Mat en 1 » avant de passer à 2 et 3 coups.</p>`;

  for (const b of document.querySelectorAll('.learn-tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('#pane-lecons').hidden = tab !== 'lecons';
  $('#pane-ouvertures').hidden = tab !== 'ouvertures';
  $('#pane-exercices').hidden = tab !== 'exercices';
}

function showHome(tab) {
  gen++;
  cur = null;
  $('#play').hidden = true;
  $('#home').hidden = false;
  renderHome(tab);
  document.title = 'Apprendre — ROOOK';
}

// --- Navigation --------------------------------------------------------------------
function route() {
  const [kind, id, n] = location.hash.slice(1).split('/');
  if (kind === 'lecon') {
    const L = LESSONS.find((l) => l.id === id);
    if (L) return openLesson(L, Number(n) || 0);
  }
  if (kind === 'infini') return openInfinite(id || 'hasard');
  if (kind === 'exo') {
    const P = PUZZLES.find((p) => p.id === id);
    if (P) return openPuzzle(P);
  }
  showHome(['exercices', 'ouvertures'].includes(kind) ? kind : 'lecons');
}

for (const b of document.querySelectorAll('.learn-tab')) b.addEventListener('click', () => (location.hash = '#' + b.dataset.tab));
$('#btn-retry').addEventListener('click', () => {
  if (!task) return; // position en préparation
  if (cur.kind === 'lesson') renderSteps();
  startTask();
});
$('#btn-hint').addEventListener('click', async () => {
  if (task.goal === 'mateN') {
    if (finished || busy) return;
    const fen = chess.fen();
    const { best } = await analyseMate(fen);
    if (!best || fen !== chess.fen()) return;
    const c = new Chess(fen);
    const m = c.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
    $('#p-hint').textContent = `💡 Joue ${PIECE_HINT[m.piece]}${c.inCheck() ? ', en donnant échec' : ''}.`;
  } else $('#p-hint').textContent = '💡 ' + task.hint;
  $('#p-hint').hidden = false;
});
$('#btn-solution').addEventListener('click', async () => {
  if (finished || busy) return;
  let m = solutionMove();
  if (task.goal === 'mateN') {
    const fen = chess.fen();
    const { best } = await analyseMate(fen);
    if (!best || fen !== chess.fen()) return;
    m = { from: best.slice(0, 2), to: best.slice(2, 4) };
  }
  if (!m) return;
  shownSolution = true;
  ground.setAutoShapes([{ orig: m.from, dest: m.to, brush: 'green' }]);
  feedback(cur.kind === 'lesson' ? 'Joue le coup indiqué par la flèche.' : 'Joue le coup de la flèche. (Cet exercice ne comptera pas comme réussi.)', '');
});
$('#btn-next').addEventListener('click', (e) => {
  const href = e.currentTarget.dataset.href;
  if (location.hash === href) route(); // « Position suivante » dans le même mode
  else location.hash = href;
});
addEventListener('hashchange', route);
route();
