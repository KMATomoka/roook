// Page « Apprendre » : leçons pas à pas pour les débutants (déplacement des pièces, règles spéciales,
// échec et mat), puis exercices (mat en 1, gagner une pièce, défendre, mat en 2).
// Le contenu est dans apprendre-data.js ; la progression est gardée dans le navigateur.
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { $, Chess, legalDests, castleDest, isPromotion, askPromotion, getPref, setPref } from './common.js';
import './compte.js'; // compte, barre du haut, apparence choisie dans l'inventaire
import { createFx } from './fx.js';
import { CHAPTERS, LESSONS, PUZZLE_CATS, PUZZLES } from './apprendre-data.js';

const ROLE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const WON = { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame' };
const BRAVO = ['Bravo !', 'Bien joué !', 'Parfait !', 'Exactement !', 'Super !'];
const GOAL_TEXT = {
  mate1: 'Fais échec et mat en un seul coup.',
  mate2: 'Fais échec et mat en deux coups, quoi que réponde ton adversaire.',
  defend: 'Ton adversaire menace de te faire échec et mat au prochain coup. Trouve un coup qui l’en empêche.',
  line: 'Trouve le coup qui te fait gagner une pièce.',
};
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
const progress = { lessons: {}, puzzles: {}, ...getPref('apprendre', {}) };
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
let cur = null; // { kind: 'lesson', lesson, step } | { kind: 'puzzle', puzzle }
let task = null; // l'étape ou l'exercice joué
let chess = null;
let player = 'w';
let busy = false; // l'adversaire joue, ou un coup raté va être annulé
let finished = false;
let phase = 0; // mat en 2 : 0 = premier coup, 1 = coup du mat
let lineIdx = 0; // suite d'un exercice « line »
let visited = new Set(); // cases marquées déjà atteintes
let shownSolution = false;
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
  feedback(text, 'bad');
  sync();
  later(delay, () => {
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
      later(1400, () => (location.hash = `#lecon/${L.id}/${cur.step + 1}`));
      return;
    }
    progress.lessons[L.id] = true;
    save();
    feedback(`${text || pick(BRAVO)} Leçon terminée ! 🎉`, 'good');
    const next = LESSONS[LESSONS.indexOf(L) + 1];
    showNext(next ? `Leçon suivante : ${next.title} →` : 'Passer aux entraînements →', next ? `#lecon/${next.id}` : '#exercices');
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
  const fenTurn = task.fen.split(' ')[1];
  chess = cur.kind === 'lesson' ? load(task.fen) : new Chess(task.fen);
  player = task.pre ? other(fenTurn) : fenTurn;
  orientation = player;
  visited = new Set();
  finished = false;
  busy = false;
  phase = 0;
  lineIdx = 0;
  shownSolution = false;
  feedback('');
  $('#p-hint').hidden = true;
  $('#btn-next').hidden = true;
  const hasSolution = !['targets', 'capture', 'promote'].includes(task.goal);
  $('#btn-solution').hidden = !hasSolution;
  $('#btn-hint').hidden = !task.hint;
  $('#p-turn').innerHTML = `<span class="learn-side ${colorName(player)}"></span> Tu joues les ${player === 'w' ? 'Blancs' : 'Noirs'}`;
  $('#p-text').innerHTML = task.text || GOAL_TEXT[task.goal];
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

function renderSteps(doneUpTo) {
  const ol = $('#p-steps');
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
  $('#back').textContent = '← Toutes les leçons';
  $('#back').href = '#lecons';
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

// --- Sommaire --------------------------------------------------------------------
function bar(n, total, label) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return `<div class="learn-bar"><div class="learn-bar-top"><span>${label}</span><b>${n} / ${total}</b></div><div class="learn-bar-track"><div style="width:${pct}%"></div></div></div>`;
}

function renderHome(tab) {
  const lessonsDone = LESSONS.filter((l) => progress.lessons[l.id]).length;
  const puzzlesDone = PUZZLES.filter((p) => progress.puzzles[p.id]).length;
  $('#progress').innerHTML = `<h2>Ta progression</h2>${bar(lessonsDone, LESSONS.length, '📘 Leçons')}${bar(puzzlesDone, PUZZLES.length, '🎯 Exercices réussis')}`;

  const nextLesson = LESSONS.find((l) => !progress.lessons[l.id]);
  $('#pane-lecons').innerHTML = CHAPTERS.map((ch, ci) => {
    const lessons = LESSONS.filter((l) => l.chapter === ch.id);
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

  $('#pane-exercices').innerHTML = `<div class="learn-cats">${PUZZLE_CATS.map((cat) => {
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
  <p class="muted learn-tip">Astuce : commence par les leçons si tu débutes. Les exercices « Mat en 2 » sont les plus difficiles.</p>`;

  for (const b of document.querySelectorAll('.learn-tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('#pane-lecons').hidden = tab !== 'lecons';
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
  if (kind === 'exo') {
    const P = PUZZLES.find((p) => p.id === id);
    if (P) return openPuzzle(P);
  }
  showHome(kind === 'exercices' ? 'exercices' : 'lecons');
}

for (const b of document.querySelectorAll('.learn-tab')) b.addEventListener('click', () => (location.hash = '#' + b.dataset.tab));
$('#btn-retry').addEventListener('click', () => {
  if (cur.kind === 'lesson') renderSteps();
  startTask();
});
$('#btn-hint').addEventListener('click', () => {
  $('#p-hint').textContent = '💡 ' + task.hint;
  $('#p-hint').hidden = false;
});
$('#btn-solution').addEventListener('click', () => {
  if (finished || busy) return;
  const m = solutionMove();
  if (!m) return;
  shownSolution = true;
  ground.setAutoShapes([{ orig: m.from, dest: m.to, brush: 'green' }]);
  feedback(cur.kind === 'puzzle' ? 'Joue le coup de la flèche. (Cet exercice ne comptera pas comme réussi.)' : 'Joue le coup indiqué par la flèche.', '');
});
$('#btn-next').addEventListener('click', (e) => (location.hash = e.currentTarget.dataset.href));
addEventListener('hashchange', route);
route();
