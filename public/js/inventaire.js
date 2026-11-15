// Page Inventaire, façon « collection » de jeu vidéo :
//  - en haut, ce qui est équipé (« Pack personnalisé » quand on mélange des éléments de packs différents) ;
//  - des onglets : Packs, Plateau, Pièces, Fin de partie, Prise et son ;
//  - une grille d'éléments à gauche, et à droite un grand aperçu de l'élément choisi, avec « Équiper ».
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
const ICONS = { packs: '◆', board: '▦', pieces: '♞', endAnim: '♚', capture: '✦' };
const TABS = [{ id: 'packs', name: 'Packs' }, ...SLOTS.map((s) => ({ id: s, name: SLOT_NAMES[s] }))];
// Couleur de chaque pack (comme la rareté d'un objet)
const TIER = { astrea: '#9b7bff', classic: '#c4c8d0', royal: '#e2b64e' };
const packById = (id) => PACKS.find((p) => p.id === id);
const whole = (id) => Object.fromEntries(SLOTS.map((s) => [s, id]));

let tab = 'packs';
let selected = getEquip().board; // pack sélectionné dans l'onglet courant

// ---------------------------------------------------------------------------
// Petits échiquiers d'aperçu
// ---------------------------------------------------------------------------
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
/** Quelques pièces en grand, sur les couleurs du plateau (aperçu « Pièces »). */
function piecesShow(host) {
  host.innerHTML = `<div class="inv-pieces-show cg-wrap">
    <piece class="knight black"></piece><piece class="king black"></piece><piece class="queen black"></piece>
    <piece class="queen white"></piece><piece class="king white"></piece><piece class="knight white"></piece>
  </div>`;
}

/** Ce qu'un élément de l'onglet courant change par rapport à l'équipement actuel. */
const overrideFor = (id) => (tab === 'packs' ? whole(id) : { ...getEquip(), [tab]: id });

// ---------------------------------------------------------------------------
// En haut : l'équipement actuel
// ---------------------------------------------------------------------------
miniBoard($('#inv-current-board'));
function renderCurrent() {
  const eq = getEquip();
  dress($('#inv-current-board'), eq);
  const first = eq[SLOTS[0]];
  const pack = SLOTS.every((s) => eq[s] === first) ? packById(first) : null;
  const cur = $('#inv-current');
  cur.classList.toggle('custom', !pack);
  cur.style.setProperty('--tier', pack ? TIER[pack.id] : '#3cf2a3');
  $('#inv-current-name').innerHTML = pack ? escapeHtml(pack.name) : '✦ Pack personnalisé';
  $('#inv-current-desc').textContent = pack ? pack.desc : 'Ton mélange à toi : chaque élément vient d’un pack différent.';
  $('#inv-current-slots').innerHTML = SLOTS.map((s) => {
    const p = packById(eq[s]);
    return `<li><button type="button" class="inv-slot" data-goto="${s}" data-pick="${p.id}" style="--tier:${TIER[p.id]}" title="Changer : ${SLOT_NAMES[s]}">
      <span class="inv-slot-icon" aria-hidden="true">${ICONS[s]}</span>
      <span class="inv-slot-text"><small>${SLOT_NAMES[s]}</small>${escapeHtml(p.items[s].name)}</span>
    </button></li>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------
function renderTabs() {
  $('#inv-tabs').innerHTML = TABS.map(
    (t) => `<button type="button" role="tab" class="inv-tab ${t.id === tab ? 'active' : ''}" aria-selected="${t.id === tab}" data-tab="${t.id}">
      <span aria-hidden="true">${ICONS[t.id]}</span> ${escapeHtml(t.name)}</button>`,
  ).join('');
}
function goTo(newTab, pick = null) {
  tab = newTab;
  const eq = getEquip();
  selected = pick || (tab === 'packs' ? eq.board : eq[tab]);
  renderTabs();
  renderGrid();
  renderDetail(true);
}

// ---------------------------------------------------------------------------
// Grille des éléments
// ---------------------------------------------------------------------------
function renderGrid() {
  const eq = getEquip();
  const grid = $('#inv-items');
  grid.innerHTML = PACKS.map((p) => {
    const name = tab === 'packs' ? p.name : p.items[tab].name;
    const on = tab === 'packs' ? SLOTS.every((s) => eq[s] === p.id) : eq[tab] === p.id;
    const locked = !isUnlocked(p.id);
    const pr = unlockProgress(p.id);
    return `<button type="button" role="option" class="inv-item ${on ? 'equipped' : ''} ${p.id === selected ? 'selected' : ''} ${locked ? 'locked' : ''}"
        aria-selected="${p.id === selected}" data-pick="${p.id}" style="--tier:${TIER[p.id]}">
      <span class="inv-item-preview" data-preview></span>
      <span class="inv-item-foot">
        <span class="inv-item-name">${escapeHtml(name)}</span>
        <span class="inv-item-pack">${tab === 'packs' ? '4 éléments' : escapeHtml(p.name)}</span>
      </span>
      ${on ? '<span class="inv-item-tag">Équipé</span>' : ''}
      ${locked ? `<span class="inv-item-lock">🔒 ${pr.wins}/${pr.need}</span>` : ''}
    </button>`;
  }).join('');
  for (const item of $$('.inv-item', grid)) {
    const host = item.querySelector('[data-preview]');
    const id = item.dataset.pick;
    if (tab === 'pieces') piecesShow(host);
    else miniBoard(host, tab === 'packs' ? START : tab === 'board' ? MIDDLE : DEMOS[tab].fen);
    dress(host, overrideFor(id));
  }
}

// ---------------------------------------------------------------------------
// Grand aperçu de l'élément choisi
// ---------------------------------------------------------------------------
const dHost = $('#inv-detail-board');
const detail = miniBoard(dHost, START);
const dFx = createFx(detail.frame, () => 'w');
let demoTimer = null;

function renderDetail(autoplay = false) {
  const p = packById(selected) || PACKS[0];
  const eq = getEquip();
  const locked = !isUnlocked(p.id);
  const isPack = tab === 'packs';
  const it = isPack ? null : p.items[tab];
  const on = isPack ? SLOTS.every((s) => eq[s] === p.id) : eq[tab] === p.id;

  $('#inv-detail').style.setProperty('--tier', TIER[p.id]);
  $('#inv-detail').classList.toggle('locked', locked);
  $('#inv-d-tier').textContent = isPack ? `Pack · ${p.name}` : `${SLOT_NAMES[tab]} · ${p.name}`;
  $('#inv-d-name').textContent = isPack ? p.name : it.name;
  $('#inv-d-desc').textContent = isPack ? p.desc : it.desc;

  // Contenu du pack, ou encart « verrouillé »
  let extra = '';
  if (locked) {
    const pr = unlockProgress(p.id);
    extra += `<div class="inv-lock">
      <div class="inv-lock-head">🔒 Se débloque avec <b>${pr.need} victoires</b> en ligne contre tes amis</div>
      <div class="inv-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${pr.need}" aria-valuenow="${pr.wins}"><i style="width:${Math.min(100, (pr.wins / pr.need) * 100)}%"></i></div>
      <div class="inv-lock-count">${pr.wins} / ${pr.need} victoires</div>
    </div>`;
  }
  if (isPack) {
    extra += `<ul class="inv-contents">${SLOTS.map((s) => `<li><span aria-hidden="true">${ICONS[s]}</span><small>${SLOT_NAMES[s]}</small> ${escapeHtml(p.items[s].name)}</li>`).join('')}</ul>`;
  }
  $('#inv-d-extra').innerHTML = extra;

  const demo = isPack || !DEMOS[tab]
    ? ''
    : tab === 'endAnim'
      ? '<div class="inv-demo-row"><button type="button" class="btn btn-ghost" data-demo="win">▶ Quand tu gagnes</button><button type="button" class="btn btn-ghost" data-demo="loss">▶ Quand tu perds</button></div>'
      : `<button type="button" class="btn btn-ghost" data-demo="win">▶ Revoir ${DEMOS[tab].label}</button>`;
  const main = locked
    ? '<button type="button" class="btn inv-equip-btn" disabled>🔒 Verrouillé</button>'
    : on
      ? `<button type="button" class="btn inv-equip-btn is-on" disabled>✓ ${isPack ? 'Pack équipé' : 'Équipé'}</button>`
      : `<button type="button" class="btn inv-equip-btn" data-equip>${isPack ? 'Équiper le pack' : 'Équiper'}</button>`;
  $('#inv-d-actions').innerHTML = demo + main;

  // Grand aperçu : le pack entier, ou l'équipement actuel avec cet élément à la place
  clearTimeout(demoTimer);
  dFx.reset();
  dress(dHost, overrideFor(p.id));
  const fen = isPack ? START : tab === 'board' ? MIDDLE : tab === 'pieces' ? START : DEMOS[tab].fen;
  detail.ground.set({ fen, lastMove: undefined, check: false });
  if (autoplay && DEMOS[tab]) playDemo(500);
}

/** Rejoue le coup de démonstration avec l'animation (et le son) de l'élément choisi. */
function playDemo(delay = 300, outcome = 'win') {
  const demo = DEMOS[tab];
  if (!demo) return;
  const chess = new Chess(demo.fen);
  clearTimeout(demoTimer);
  dFx.reset();
  detail.ground.set({ fen: demo.fen, lastMove: undefined, check: false });
  demoTimer = setTimeout(() => {
    const m = chess.move(demo.san);
    detail.ground.move(m.from, m.to);
    detail.ground.set({ fen: chess.fen(), lastMove: [m.from, m.to], check: chess.inCheck() ? (chess.turn() === 'w' ? 'white' : 'black') : false });
    // Les Blancs matent : en « défaite », on regarde la partie du côté des Noirs (celui qui est maté)
    dFx.move(m, chess, { me: outcome === 'loss' ? 'b' : 'w', style: { [tab]: selected } });
  }, delay);
}

// ---------------------------------------------------------------------------
// Clics
// ---------------------------------------------------------------------------
$('main').addEventListener('click', async (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) return goTo(tabBtn.dataset.tab);
  const slot = e.target.closest('[data-goto]');
  if (slot) {
    goTo(slot.dataset.goto, slot.dataset.pick);
    $('#inv-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const item = e.target.closest('.inv-item');
  if (item) {
    selected = item.dataset.pick;
    for (const it of $$('.inv-item')) {
      it.classList.toggle('selected', it === item);
      it.setAttribute('aria-selected', String(it === item));
    }
    renderDetail(true);
    // Sur téléphone, l'aperçu est sous la grille : on le montre
    if (matchMedia('(max-width: 860px)').matches) $('#inv-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const demoBtn = e.target.closest('[data-demo]');
  if (demoBtn) return playDemo(300, demoBtn.dataset.demo);
  if (e.target.closest('[data-equip]')) {
    try {
      if (tab === 'packs') {
        await equipPack(selected);
        toast(`Pack <b>${escapeHtml(packById(selected).name)}</b> équipé.`, { cls: 'info', duration: 2500 });
      } else {
        await setEquip({ [tab]: selected });
        toast(`${escapeHtml(SLOT_NAMES[tab])} : <b>${escapeHtml(packById(selected).items[tab].name)}</b> équipé.`, { cls: 'info', duration: 2500 });
        if (tab === 'capture') playSound(new Chess(DEMOS.capture.fen).move(DEMOS.capture.san), 'neutral');
      }
    } catch (ex) {
      toast(escapeHtml(ex.message || 'Impossible d’enregistrer pour l’instant.'), { cls: 'error' });
    }
  }
});

// ---------------------------------------------------------------------------
function refresh() {
  renderCurrent();
  renderGrid();
  renderDetail();
}
renderTabs();
onEquipChange(refresh);
refresh();
$('#inv-muted').hidden = !isMuted();

ready.then(({ signedIn }) => {
  refresh(); // les victoires (packs à débloquer) sont maintenant connues
  $('#inv-where').innerHTML = signedIn
    ? '✓ Enregistré sur ton compte : tu retrouves ton apparence sur tous tes appareils.'
    : 'Enregistré dans ce navigateur. <a href="connexion.html?retour=inventaire.html">Connecte-toi</a> pour retrouver ton apparence partout.';
});
