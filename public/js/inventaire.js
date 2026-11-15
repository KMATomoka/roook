// Page Inventaire, organisée en packs :
//  - en haut, ce qui est équipé (« Pack personnalisé » quand on mélange des éléments de packs différents) ;
//  - en dessous, les packs : un clic ouvre la fenêtre du pack, où l'on équipe tout le pack d'un coup,
//    ou seulement son plateau, ses pièces, son animation de fin de partie ou de prise.
// L'équipement est géré par js/theme.js (compte Firebase, ou ce navigateur sans compte).
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { $, $$, Chess, escapeHtml } from './common.js';
import { toast } from './compte.js';
import { PACKS, SLOTS, SLOT_NAMES, getEquip, setEquip, equipPack, onEquipChange, themeClasses, ready, isUnlocked, unlockProgress } from './theme.js';
import { createFx } from './fx.js';
import { playSound, isMuted } from './sound.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MIDDLE = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8';
// Aperçus animés (coups vérifiés par chess.js)
const DEMOS = {
  capture: { fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', san: 'Nxh4', label: 'une prise' },
  endAnim: { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', san: 'Qxf7#', label: 'un échec et mat' },
};
const ICONS = { board: '▦', pieces: '♞', endAnim: '♚', capture: '✦' };
const packById = (id) => PACKS.find((p) => p.id === id);
const packOf = (slot, id) => packById(id)?.items[slot];

/** Petit échiquier non jouable, habillé avec des classes de thème. */
function miniBoard(host, fen = MIDDLE) {
  host.innerHTML = '<div class="board-frame inv-frame"><div class="cg-wrap board"></div></div>';
  const frame = host.querySelector('.board-frame');
  const ground = Chessground(frame.querySelector('.board'), { fen, viewOnly: true, coordinates: false, animation: { duration: 220 } });
  return { host, frame, ground };
}
function dress(host, equip) {
  for (const cls of [...host.classList]) if (/^(board|pieces|end|capture)-[a-z]+$/.test(cls)) host.classList.remove(cls);
  host.classList.add(...themeClasses(equip));
}

/** Le pack entièrement équipé, ou null si les éléments viennent de packs différents. */
function currentPack(eq) {
  const first = eq[SLOTS[0]];
  return SLOTS.every((s) => eq[s] === first) ? packById(first) : null;
}

function lockHtml(id) {
  const pr = unlockProgress(id);
  if (pr.unlocked) return '';
  return `<div class="inv-lock">
    <div class="inv-lock-head">🔒 Se débloque avec <b>${pr.need} victoires</b> en ligne contre tes amis</div>
    <div class="inv-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${pr.need}" aria-valuenow="${pr.wins}"><i style="width:${Math.min(100, (pr.wins / pr.need) * 100)}%"></i></div>
    <div class="inv-lock-count">${pr.wins} / ${pr.need} victoires</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// En haut : l'équipement actuel
// ---------------------------------------------------------------------------
const current = miniBoard($('#inv-current-board'));

function renderCurrent() {
  const eq = getEquip();
  dress($('#inv-current-board'), eq);
  const pack = currentPack(eq);
  $('#inv-current').classList.toggle('custom', !pack);
  $('#inv-current-name').innerHTML = pack ? escapeHtml(pack.name) : '✦ Pack personnalisé';
  $('#inv-current-desc').textContent = pack ? pack.desc : 'Ton mélange à toi : chaque élément vient d’un pack différent.';
  $('#inv-current-slots').innerHTML = SLOTS.map((s) => {
    const p = packById(eq[s]);
    return `<li><button type="button" class="inv-slot" data-open="${p.id}" data-focus="${s}" title="Changer : ${SLOT_NAMES[s]}">
      <span class="inv-slot-icon" aria-hidden="true">${ICONS[s]}</span>
      <span class="inv-slot-text"><small>${SLOT_NAMES[s]}</small>${escapeHtml(p.items[s].name)}</span>
      <span class="inv-slot-pack">${escapeHtml(p.name)}</span>
    </button></li>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Les packs
// ---------------------------------------------------------------------------
const tiles = $('#inv-tiles');
tiles.innerHTML = PACKS.map(
  (p) => `<button type="button" class="card inv-tile" data-open="${p.id}">
    <div class="inv-tile-board" data-board></div>
    <div class="inv-tile-body">
      <span class="inv-tile-name">${escapeHtml(p.name)}</span>
      <span class="inv-tile-status" data-status></span>
    </div>
    <div class="inv-tile-lock" data-lock></div>
  </button>`,
).join('');
for (const t of $$('.inv-tile', tiles)) {
  const host = t.querySelector('[data-board]');
  miniBoard(host, START);
  dress(host, Object.fromEntries(SLOTS.map((s) => [s, t.dataset.open])));
}

function renderTiles() {
  const eq = getEquip();
  for (const t of $$('.inv-tile', tiles)) {
    const id = t.dataset.open;
    const n = SLOTS.filter((s) => eq[s] === id).length;
    const locked = !isUnlocked(id);
    t.classList.toggle('locked', locked);
    t.classList.toggle('equipped', n === SLOTS.length);
    const pr = unlockProgress(id);
    t.querySelector('[data-status]').innerHTML = locked
      ? `🔒 ${pr.wins} / ${pr.need} victoires`
      : n === SLOTS.length
        ? '<b>✓ Équipé</b>'
        : n
          ? `${n} élément${n > 1 ? 's' : ''} sur 4 équipé${n > 1 ? 's' : ''}`
          : 'Choisir';
    t.querySelector('[data-lock]').innerHTML = locked
      ? `<div class="inv-progress"><i style="width:${Math.min(100, (pr.wins / pr.need) * 100)}%"></i></div>`
      : '';
  }
}

// ---------------------------------------------------------------------------
// Fenêtre d'un pack
// ---------------------------------------------------------------------------
const dialog = $('#inv-dialog');
const dBoardHost = $('#inv-d-board');
const dBoard = miniBoard(dBoardHost, START);
const dFx = createFx(dBoard.frame, () => 'w');
let openId = null;
let demoTimer = null;

function openPack(id, focus = null) {
  openId = id;
  const p = packById(id);
  clearTimeout(demoTimer);
  dFx.reset();
  dBoard.ground.set({ fen: START, lastMove: undefined, check: false });
  dress(dBoardHost, Object.fromEntries(SLOTS.map((s) => [s, id])));
  $('#inv-d-name').textContent = p.name;
  $('#inv-d-desc').textContent = p.desc;
  $('#inv-d-hint').textContent = 'Aperçu du pack';
  renderDialog();
  if (!dialog.open) dialog.showModal();
  if (focus) dialog.querySelector(`[data-slot="${focus}"]`)?.classList.add('focus');
}

function renderDialog() {
  if (!openId) return;
  const p = packById(openId);
  const eq = getEquip();
  const locked = !isUnlocked(openId);
  const all = SLOTS.every((s) => eq[s] === openId);
  dialog.classList.toggle('locked', locked);
  $('#inv-d-status').textContent = locked ? 'Pack verrouillé' : all ? 'Pack équipé' : 'Pack';
  $('#inv-d-lock').innerHTML = lockHtml(openId);
  $('#inv-d-items').innerHTML = SLOTS.map((s) => {
    const it = p.items[s];
    const on = eq[s] === openId;
    const demo = DEMOS[s] ? `<button type="button" class="btn btn-ghost small" data-demo="${s}" title="Voir ${DEMOS[s].label}">▶ Aperçu</button>` : '';
    const btn = locked
      ? '<button type="button" class="btn btn-ghost small" disabled>🔒</button>'
      : on
        ? '<button type="button" class="btn btn-ghost small" disabled>✓ Équipé</button>'
        : `<button type="button" class="btn btn-primary small" data-equip="${s}">Équiper</button>`;
    return `<li class="inv-d-item ${on ? 'on' : ''}" data-slot="${s}">
      <span class="inv-slot-icon" aria-hidden="true">${ICONS[s]}</span>
      <span class="inv-d-text"><small>${SLOT_NAMES[s]}</small><b>${escapeHtml(it.name)}</b><span class="muted">${escapeHtml(it.desc)}</span></span>
      <span class="inv-d-actions">${demo}${btn}</span>
    </li>`;
  }).join('');
  const allBtn = $('#inv-d-all');
  allBtn.disabled = locked || all;
  allBtn.textContent = locked ? '🔒 Pack verrouillé' : all ? '✓ Pack équipé' : 'Équiper tout le pack';
}

/** Rejoue un coup sur l'aperçu de la fenêtre, avec l'animation (et le son) de ce pack. */
function playDemo(slot) {
  const demo = DEMOS[slot];
  const chess = new Chess(demo.fen);
  clearTimeout(demoTimer);
  dFx.reset();
  dBoard.ground.set({ fen: demo.fen, lastMove: undefined, check: false });
  $('#inv-d-hint').textContent = `Aperçu : ${demo.label}`;
  demoTimer = setTimeout(() => {
    const m = chess.move(demo.san);
    dBoard.ground.move(m.from, m.to);
    dBoard.ground.set({ fen: chess.fen(), lastMove: [m.from, m.to], check: chess.inCheck() ? (chess.turn() === 'w' ? 'white' : 'black') : false });
    dFx.move(m, chess, { me: 'w', style: { [slot]: openId } });
  }, 300);
}

dialog.addEventListener('click', async (e) => {
  if (e.target === dialog || e.target.closest('[data-close]')) return dialog.close();
  const demo = e.target.closest('[data-demo]');
  if (demo) return playDemo(demo.dataset.demo);
  const one = e.target.closest('[data-equip]');
  const all = e.target.closest('#inv-d-all');
  if (!one && !all) return;
  try {
    if (all) {
      await equipPack(openId);
      toast(`Pack <b>${escapeHtml(packById(openId).name)}</b> équipé.`, { cls: 'info', duration: 2500 });
    } else {
      const slot = one.dataset.equip;
      await setEquip({ [slot]: openId });
      toast(`${escapeHtml(SLOT_NAMES[slot])} : <b>${escapeHtml(packOf(slot, openId).name)}</b> équipé.`, { cls: 'info', duration: 2500 });
      if (slot === 'capture') playSound(new Chess(DEMOS.capture.fen).move(DEMOS.capture.san), 'neutral');
    }
  } catch (ex) {
    toast(escapeHtml(ex.message || 'Impossible d’enregistrer pour l’instant.'), { cls: 'error' });
  }
});
dialog.addEventListener('close', () => {
  openId = null;
  clearTimeout(demoTimer);
  dFx.reset();
});

// Ouvrir un pack : depuis une tuile, ou depuis un élément de l'équipement actuel
$('main').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b) openPack(b.dataset.open, b.dataset.focus || null);
});

// ---------------------------------------------------------------------------
function refresh() {
  renderCurrent();
  renderTiles();
  renderDialog();
}
onEquipChange(refresh);
refresh();
$('#inv-muted').hidden = !isMuted();

ready.then(({ signedIn }) => {
  refresh(); // les victoires (packs à débloquer) sont maintenant connues
  $('#inv-where').innerHTML = signedIn
    ? '✓ Enregistré sur ton compte : tu retrouves ton apparence sur tous tes appareils.'
    : 'Enregistré dans ce navigateur. <a href="connexion.html?retour=inventaire.html">Connecte-toi</a> pour retrouver ton apparence partout.';
});
