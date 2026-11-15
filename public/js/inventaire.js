// Page Inventaire : choisir son plateau, ses pièces, son animation de fin de partie et de prise (avec les sons).
// L'équipement est géré par js/theme.js (compte Firebase, ou ce navigateur sans compte).
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { $, $$, Chess, escapeHtml } from './common.js';
import { toast } from './compte.js';
import { PACKS, SLOTS, SLOT_NAMES, getEquip, setEquip, equipPack, onEquipChange, themeClasses, ready } from './theme.js';
import { createFx } from './fx.js';
import { playSound, isMuted } from './sound.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MIDDLE = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8';
// Positions des aperçus animés (le coup est vérifié par chess.js)
const DEMOS = {
  capture: { fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', san: 'Nxh4' },
  move: { fen: START, san: 'e4' },
  check: { fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', san: 'Bb5+' },
  mate: { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', san: 'Qxf7#' },
};
const PIECES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

/** Classes d'un aperçu : l'équipement actuel, avec un élément (ou un pack) remplacé. */
const previewClasses = (override) => themeClasses({ ...getEquip(), ...override });
const packOverride = (id) => Object.fromEntries(SLOTS.map((s) => [s, id]));

const boards = []; // { node, override, ground }

function miniBoard(host, override, { fen = START, coordinates = false } = {}) {
  host.innerHTML = '<div class="board-frame inv-frame"><div class="cg-wrap board"></div></div>';
  const frame = host.querySelector('.board-frame');
  const ground = Chessground(frame.querySelector('.board'), { fen, viewOnly: true, coordinates, animation: { duration: 220 } });
  const b = { node: host, override, ground, frame };
  boards.push(b);
  return b;
}

function piecesRow(host) {
  host.innerHTML = ['white', 'black']
    .map((c) => `<div class="cg-wrap inv-pieces">${PIECES.map((p) => `<piece class="${p} ${c}"></piece>`).join('')}</div>`)
    .join('');
}

function equipButton(attrs) {
  return `<button class="btn btn-primary small inv-equip" ${attrs}>Équiper</button>`;
}

// --- Packs ----------------------------------------------------------------
const packsEl = $('#inv-packs');
packsEl.innerHTML = PACKS.map(
  (p) => `<article class="card inv-card inv-pack" data-pack="${p.id}">
    <div class="inv-preview" data-preview></div>
    <div class="inv-body">
      <h3>${escapeHtml(p.name)}</h3>
      <p class="muted">${escapeHtml(p.desc)}</p>
      <ul class="inv-pack-list">${SLOTS.map((s) => `<li><span>${SLOT_NAMES[s]}</span> ${escapeHtml(p.items[s].name)}</li>`).join('')}</ul>
      <div class="inv-actions"><button class="btn btn-primary small inv-equip" data-equip-pack="${p.id}">Tout équiper</button></div>
    </div>
  </article>`,
).join('');
for (const card of $$('.inv-pack', packsEl)) miniBoard(card.querySelector('[data-preview]'), packOverride(card.dataset.pack), { fen: MIDDLE });

// --- Éléments, par catégorie ---------------------------------------------------
for (const grid of $$('.inv-grid[data-slot]')) {
  const slot = grid.dataset.slot;
  grid.innerHTML = PACKS.map((p) => {
    const it = p.items[slot];
    let buttons = '';
    if (slot === 'capture') buttons = `<button class="btn btn-ghost small" data-demo="capture">▶ Aperçu</button><button class="btn btn-ghost small" data-demo="move">♪ Un coup</button>`;
    if (slot === 'endAnim') buttons = `<button class="btn btn-ghost small" data-demo="mate">▶ Aperçu</button><button class="btn btn-ghost small" data-demo="check">▶ Échec</button>`;
    return `<article class="card inv-card" data-slot="${slot}" data-id="${p.id}">
      <div class="inv-preview" data-preview></div>
      <div class="inv-body">
        <h3>${escapeHtml(it.name)} <span class="inv-from">${escapeHtml(p.name)}</span></h3>
        <p class="muted">${escapeHtml(it.desc)}</p>
        <div class="inv-actions">${buttons}${equipButton(`data-equip-slot="${slot}" data-equip-id="${p.id}"`)}</div>
      </div>
    </article>`;
  }).join('');
  for (const card of $$('.inv-card', grid)) {
    const host = card.querySelector('[data-preview]');
    const override = { [slot]: card.dataset.id };
    if (slot === 'pieces') {
      host.classList.add('inv-preview-pieces');
      piecesRow(host);
      boards.push({ node: host, override });
    } else {
      const b = miniBoard(host, override, { fen: slot === 'board' ? MIDDLE : DEMOS[slot === 'capture' ? 'capture' : 'mate'].fen, coordinates: slot === 'board' });
      if (slot !== 'board') b.fx = createFx(b.frame, () => 'w');
      card._board = b;
    }
  }
}

// --- Aperçus animés --------------------------------------------------------------
let demoTimer = null;
function playDemo(card, kind) {
  const b = card._board;
  if (!b) return;
  const demo = DEMOS[kind];
  const chess = new Chess(demo.fen);
  b.fx.reset();
  b.ground.set({ fen: demo.fen, lastMove: undefined, check: false });
  clearTimeout(demoTimer);
  demoTimer = setTimeout(() => {
    const m = chess.move(demo.san);
    b.ground.move(m.from, m.to);
    b.ground.set({ fen: chess.fen(), lastMove: [m.from, m.to], check: chess.inCheck() ? (chess.turn() === 'w' ? 'white' : 'black') : false });
    b.fx.move(m, chess, { me: 'w', style: { [card.dataset.slot]: card.dataset.id } });
  }, 280);
}

$('main').addEventListener('click', async (e) => {
  const demo = e.target.closest('[data-demo]');
  if (demo) return playDemo(demo.closest('.inv-card'), demo.dataset.demo);
  const btn = e.target.closest('.inv-equip');
  if (!btn || btn.disabled) return;
  try {
    if (btn.dataset.equipPack) {
      await equipPack(btn.dataset.equipPack);
      toast(`Pack <b>${escapeHtml(PACKS.find((p) => p.id === btn.dataset.equipPack).name)}</b> équipé.`, { cls: 'info', duration: 2500 });
    } else {
      await setEquip({ [btn.dataset.equipSlot]: btn.dataset.equipId });
      // Petit aperçu sonore en équipant des sons
      if (btn.dataset.equipSlot === 'capture') playSound(new Chess(DEMOS.capture.fen).move(DEMOS.capture.san), 'neutral');
    }
  } catch {
    toast('Impossible d’enregistrer pour l’instant. Vérifie ta connexion et réessaie.', { cls: 'error' });
  }
});

// --- État « équipé » -------------------------------------------------------------
function refresh() {
  const eq = getEquip();
  for (const b of boards) {
    for (const cls of [...b.node.classList]) if (/^(board|pieces|end|capture)-[a-z]+$/.test(cls)) b.node.classList.remove(cls);
    b.node.classList.add(...previewClasses(b.override));
  }
  for (const card of $$('.inv-card[data-slot]')) {
    const on = eq[card.dataset.slot] === card.dataset.id;
    card.classList.toggle('equipped', on);
    const btn = card.querySelector('.inv-equip');
    btn.disabled = on;
    btn.textContent = on ? '✓ Équipé' : 'Équiper';
    btn.classList.toggle('btn-primary', !on);
    btn.classList.toggle('btn-ghost', on);
  }
  for (const card of $$('.inv-pack')) {
    const on = SLOTS.every((s) => eq[s] === card.dataset.pack);
    const some = SLOTS.some((s) => eq[s] === card.dataset.pack);
    card.classList.toggle('equipped', on);
    const btn = card.querySelector('.inv-equip');
    btn.disabled = on;
    btn.textContent = on ? '✓ Pack équipé' : some ? 'Tout équiper' : 'Équiper le pack';
    btn.classList.toggle('btn-primary', !on);
    btn.classList.toggle('btn-ghost', on);
  }
}
onEquipChange(refresh);
refresh();
$('#inv-muted').hidden = !isMuted();

ready.then(({ signedIn }) => {
  $('#inv-where').innerHTML = signedIn
    ? '✓ Enregistré sur ton compte : tu retrouves ton apparence sur tous tes appareils.'
    : 'Enregistré dans ce navigateur. <a href="connexion.html?retour=inventaire.html">Connecte-toi</a> pour retrouver ton apparence partout.';
});
