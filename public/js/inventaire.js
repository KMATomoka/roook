// Page Inventaire, façon « collection » de jeu vidéo :
//  - en haut, ce qui est équipé (« Pack personnalisé » quand on mélange des éléments de packs différents) ;
//  - des onglets : Packs, Plateau, Pièces, Fin de partie, Prise et son ;
//  - onglet Pièces : on change tout le jeu d'un coup, ou une seule pièce (pion, tour, cavalier…) ;
//  - une grille d'éléments à gauche, et à droite un grand aperçu de l'élément choisi, avec « Équiper ».
// L'équipement est géré par js/theme.js (compte Firebase, ou ce navigateur sans compte).
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { ico } from './icons.js'; // icônes dessinées (à la place des emojis)
import { $, $$, Chess, escapeHtml } from './common.js';
import { toast } from './compte.js';
import {
  PACKS, PACK_COLOR, SLOTS, SLOT_NAMES, RARITY, PIECE_TYPES, PIECE_NAMES, PIECE_ROLE, PACK_ITEMS, THEME_CLASS, packHas,
  getEquip, setEquip, equipPack, equipOwnedPieces, onEquipChange, themeClasses, ready, isUnlocked, isItemUnlocked,
  unlockedCount, piecesCount, piecesPack, itemName, unlockProgress, loadPackFont,
} from './theme.js';
import { createFx } from './fx.js';
import { playSound, isMuted, stopAllSounds } from './sound.js';

// Les aperçus montrent les animations de tous les packs : on charge leurs polices une fois la page affichée
addEventListener('load', () => PACKS.forEach((p) => loadPackFont(p.id)));

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
const TIER = PACK_COLOR;
const packById = (id) => PACKS.find((p) => p.id === id);
const allPieces = (id) => Object.fromEntries(PIECE_TYPES.map((t) => [t, id]));
const whole = (id) => ({ ...Object.fromEntries(SLOTS.map((s) => [s, id])), piece: allPieces(id) });
/** Onglet Pièces : null = tout le jeu, sinon la pièce à changer (P, R, N…). */
let pieceType = null;
/** L'élément regardé dans l'onglet courant : un slot, une pièce, ou « pieces » (tout le jeu). */
const curSlot = () => (tab === 'pieces' && pieceType ? pieceType : tab);
/** Verrouillé dans l'onglet courant : le pack entier (onglet Packs), cet élément, ou toutes ses pièces. */
const lockedHere = (p) => {
  if (tab === 'packs') return !isUnlocked(p.id);
  if (tab === 'pieces' && !pieceType) return piecesCount(p.id) === 0;
  return !isItemUnlocked(p.id, curSlot());
};
/** Jeu de pièces trouvé en partie seulement (quelques pièces sur 6). */
const partialSet = (p) => tab === 'pieces' && !pieceType && !p.unlock && piecesCount(p.id) > 0 && piecesCount(p.id) < PIECE_TYPES.length;
/** Petit texte du cadenas : mission (Royal) ou box. */
function lockLabel(p) {
  if (p.unlock) {
    const pr = unlockProgress(p.id);
    return `${ico('lock')} ${pr.wins}/${pr.need}`;
  }
  if (tab === 'packs') return `${ico('lock')} ${unlockedCount(p.id)}/${PACK_ITEMS.length}`;
  if (tab === 'pieces' && !pieceType) return `${ico('lock')} 0/${PIECE_TYPES.length}`;
  return `${ico('lock')} Box`;
}
/** Équipé dans l'onglet courant ? */
function isOn(id, eq = getEquip()) {
  if (tab === 'packs') return SLOTS.every((s) => s === 'pieces' || eq[s] === id) && piecesPack(eq) === id;
  if (tab === 'pieces') return pieceType ? eq.piece[pieceType] === id : piecesPack(eq) === id;
  return eq[tab] === id;
}
const rarityTag = (p) => `<span class="inv-rarity" style="--r:${RARITY[p.rarity].color}">${RARITY[p.rarity].name}</span>`;

let tab = 'packs';
let selected = getEquip().board; // pack sélectionné dans l'onglet courant
const pieceEl = (t, c) => `<piece class="${PIECE_ROLE[t]} ${c}"></piece>`;

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
  for (const cls of [...host.classList]) if (THEME_CLASS.test(cls)) host.classList.remove(cls);
  host.classList.add(...themeClasses(equip));
}
/** Quelques pièces en grand, sur les couleurs du plateau (aperçu « Pièces ») ; ou une seule pièce, en blanc et noir. */
function piecesShow(host, t = null) {
  host.innerHTML = t
    ? `<div class="inv-pieces-show one cg-wrap">${pieceEl(t, 'black')}${pieceEl(t, 'white')}</div>`
    : `<div class="inv-pieces-show cg-wrap">
    <piece class="knight black"></piece><piece class="king black"></piece><piece class="queen black"></piece>
    <piece class="queen white"></piece><piece class="king white"></piece><piece class="knight white"></piece>
  </div>`;
}

/** Ce qu'un élément de l'onglet courant change par rapport à l'équipement actuel. */
function overrideFor(id) {
  const eq = getEquip();
  if (tab === 'packs') return whole(id);
  if (tab === 'pieces') {
    if (pieceType) return { ...eq, piece: { ...eq.piece, [pieceType]: id } };
    return { ...eq, pieces: id, piece: allPieces(id) };
  }
  return { ...eq, [tab]: id };
}

// ---------------------------------------------------------------------------
// En haut : l'équipement actuel
// ---------------------------------------------------------------------------
miniBoard($('#inv-current-board'));
function renderCurrent() {
  const eq = getEquip();
  dress($('#inv-current-board'), eq);
  const first = eq[SLOTS[0]];
  const pack = SLOTS.every((s) => s === 'pieces' || eq[s] === first) && piecesPack(eq) === first ? packById(first) : null;
  const cur = $('#inv-current');
  cur.classList.toggle('custom', !pack);
  cur.style.setProperty('--tier', pack ? TIER[pack.id] : '#3cf2a3');
  $('#inv-current-name').innerHTML = pack ? escapeHtml(pack.name) : '✦ Pack personnalisé';
  $('#inv-current-desc').textContent = pack ? pack.desc : 'Ton mélange à toi : chaque élément vient d’un pack différent.';
  $('#inv-current-slots').innerHTML = SLOTS.map((s) => {
    // Pièces : le jeu du pack, ou « mélangées » si elles viennent de packs différents
    const mixed = s === 'pieces' && !piecesPack(eq);
    const p = packById(s === 'pieces' ? piecesPack(eq) || eq.piece.K : eq[s]);
    const name = mixed ? 'Pièces mélangées' : p.items[s].name;
    return `<li><button type="button" class="inv-slot" data-goto="${s}" data-pick="${p.id}" style="--tier:${mixed ? '#3cf2a3' : TIER[p.id]}" title="Changer : ${SLOT_NAMES[s]}">
      <span class="inv-slot-icon" aria-hidden="true">${ICONS[s]}</span>
      <span class="inv-slot-text"><small>${SLOT_NAMES[s]}</small>${escapeHtml(name)}</span>
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
/** Le pack choisi doit être dans la liste de l'onglet (Bois n'est pas dans l'onglet Packs) ; sinon le premier. */
function fixSelected() {
  const p = PACKS.find((x) => x.id === selected);
  const visible = (x) => (tab === 'packs' ? !x.only : packHas(x, curSlot()));
  if (!p || !visible(p)) selected = (PACKS.find((x) => x.id === getEquip().endAnim && visible(x)) || PACKS.find(visible)).id;
}
function goTo(newTab, pick = null, type = null) {
  tab = newTab;
  pieceType = tab === 'pieces' ? type : null;
  const eq = getEquip();
  selected = pick || (tab === 'packs' ? eq.board : tab === 'pieces' ? (pieceType ? eq.piece[pieceType] : piecesPack(eq) || eq.pieces) : eq[tab]);
  fixSelected();
  renderTabs();
  renderPiecePick();
  renderGrid();
  renderDetail(true);
}

/** Onglet Pièces : « Tout le jeu » ou une pièce ; chaque bouton montre la pièce équipée en ce moment. */
function renderPiecePick() {
  const box = $('#inv-piece-pick');
  box.hidden = tab !== 'pieces';
  if (box.hidden) return;
  const eq = getEquip();
  const btn = (t, label, inner, tier) => `<button type="button" role="radio" class="inv-pp ${pieceType === t ? 'active' : ''}" aria-checked="${pieceType === t}" data-ptype="${t || ''}" style="--tier:${tier}">
      <span class="inv-pp-art cg-wrap">${inner}</span><span class="inv-pp-name">${label}</span></button>`;
  const set = piecesPack(eq);
  box.innerHTML = btn(null, 'Tout le jeu', `${pieceEl('K', 'white')}${pieceEl('Q', 'black')}`, set ? TIER[set] : '#3cf2a3')
    + '<span class="inv-pp-sep" aria-hidden="true"></span>'
    + PIECE_TYPES.map((t) => btn(t, PIECE_NAMES[t], pieceEl(t, 'white'), TIER[eq.piece[t]])).join('');
}

// ---------------------------------------------------------------------------
// Grille des éléments
// ---------------------------------------------------------------------------
function renderGrid() {
  const eq = getEquip();
  const grid = $('#inv-items');
  // Onglet Packs : les packs complets ; sinon, les packs qui ont cet élément (Bois : plateau et pièces seulement)
  grid.innerHTML = PACKS.filter((p) => (tab === 'packs' ? !p.only : packHas(p, tab))).map((p) => {
    const name = tab === 'packs' ? p.name : itemName(p.id, curSlot());
    const on = isOn(p.id, eq);
    const locked = lockedHere(p);
    const part = partialSet(p) ? `<span class="inv-item-lock part">${piecesCount(p.id)}/${PIECE_TYPES.length}</span>` : '';
    return `<button type="button" role="option" class="inv-item ${on ? 'equipped' : ''} ${p.id === selected ? 'selected' : ''} ${locked ? 'locked' : ''}"
        aria-selected="${p.id === selected}" data-pick="${p.id}" style="--tier:${TIER[p.id]}">
      <span class="inv-item-preview" data-preview></span>
      <span class="inv-item-foot">
        <span class="inv-item-name">${escapeHtml(name)}</span>
        <span class="inv-item-pack">${tab === 'packs' ? `${PACK_ITEMS.length} éléments` : escapeHtml(p.name)}</span>
      </span>
      ${on ? '<span class="inv-item-tag">Équipé</span>' : ''}
      ${locked ? `<span class="inv-item-lock">${lockLabel(p)}</span>` : part}
      ${rarityTag(p)}
    </button>`;
  }).join('');
  for (const item of $$('.inv-item', grid)) {
    const host = item.querySelector('[data-preview]');
    const id = item.dataset.pick;
    if (tab === 'pieces') piecesShow(host, pieceType);
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
  const locked = lockedHere(p);
  const isPack = tab === 'packs';
  const slot = curSlot();
  const isPiece = PIECE_TYPES.includes(slot);
  const it = isPack ? null : isPiece ? { name: itemName(p.id, slot), desc: `${PIECE_NAMES[slot]} du jeu « ${p.items.pieces.name} ». ${p.items.pieces.desc}` } : p.items[slot];
  const on = isOn(p.id, eq);
  const partial = partialSet(p);

  $('#inv-detail').style.setProperty('--tier', TIER[p.id]);
  $('#inv-detail').classList.toggle('locked', locked);
  $('#inv-d-tier').innerHTML = `${escapeHtml(isPack ? `Pack · ${p.name}` : `${isPiece ? PIECE_NAMES[slot] : SLOT_NAMES[tab]} · ${p.name}`)} ${rarityTag(p)}`;
  $('#inv-d-name').textContent = isPack ? p.name : it.name;
  $('#inv-d-desc').textContent = isPack ? p.desc : it.desc;

  // Contenu du pack, ou encart « verrouillé »
  let extra = '';
  const setView = tab === 'pieces' && !pieceType;
  if ((locked || partial) && p.box) {
    const n = isPack ? unlockedCount(p.id) : piecesCount(p.id);
    const max = isPack ? PACK_ITEMS.length : PIECE_TYPES.length;
    extra += `<div class="inv-lock">
      <div class="inv-lock-head">${ico('lock')} ${isPack ? 'Ses éléments se trouvent' : setView ? 'Ses pièces se trouvent une par une' : 'Se trouve'} dans les <a href="box.html">box</a> : une box à chaque victoire en ligne</div>
      ${isPack || setView ? `<div class="inv-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${n}"><i style="width:${(n / max) * 100}%"></i></div>
      <div class="inv-lock-count">${n} / ${max} ${isPack ? 'éléments' : 'pièces'} trouvé${n > 1 ? 's' : ''}${isPack ? ' · pack entier bientôt en boutique' : ''}</div>` : ''}
    </div>`;
  } else if (locked) {
    const pr = unlockProgress(p.id);
    extra += `<div class="inv-lock">
      <div class="inv-lock-head">${ico('lock')} Se débloque avec <b>${pr.need} victoires</b> en ligne contre tes amis</div>
      <div class="inv-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${pr.need}" aria-valuenow="${pr.wins}"><i style="width:${Math.min(100, (pr.wins / pr.need) * 100)}%"></i></div>
      <div class="inv-lock-count">${pr.wins} / ${pr.need} victoires</div>
    </div>`;
  }
  if (isPack) {
    extra += `<ul class="inv-contents">${SLOTS.map((s) => {
      const ok = isItemUnlocked(p.id, s);
      const n = s === 'pieces' && !ok && piecesCount(p.id) ? ` <small>(${piecesCount(p.id)}/${PIECE_TYPES.length})</small>` : '';
      return `<li class="${ok ? '' : 'off'}"><span aria-hidden="true">${ok ? ICONS[s] : ico('lock')}</span><small>${SLOT_NAMES[s]}</small> ${escapeHtml(p.items[s].name)}${n}</li>`;
    }).join('')}</ul>`;
  }
  if (setView) {
    // Les 6 pièces du jeu : trouvées ou non, et un clic pour n'en changer qu'une
    extra += `<ul class="inv-set">${PIECE_TYPES.map((t) => {
      const ok = isItemUnlocked(p.id, t);
      return `<li><button type="button" class="inv-set-piece ${ok ? '' : 'off'}" data-ptype="${t}" title="${escapeHtml(itemName(p.id, t))}${ok ? '' : ' (à trouver)'}">
        <span class="cg-wrap pieces-${p.id}">${pieceEl(t, 'white')}</span><small>${ok ? PIECE_NAMES[t] : ico('lock')}</small></button></li>`;
    }).join('')}</ul>`;
  }
  $('#inv-d-extra').innerHTML = extra;

  const demo = isPack || !DEMOS[tab]
    ? ''
    : tab === 'endAnim'
      ? '<div class="inv-demo-row"><button type="button" class="btn btn-ghost" data-demo="win">▶ Quand tu gagnes</button><button type="button" class="btn btn-ghost" data-demo="loss">▶ Quand tu perds</button></div>'
      : `<button type="button" class="btn btn-ghost" data-demo="win">▶ Revoir ${DEMOS[tab].label}</button>`;
  const main = locked
    ? p.box
      ? `<a class="btn inv-equip-btn" href="box.html">${ico('gift')} ${isPack ? 'Trouver ses éléments' : setView ? 'Trouver ses pièces' : 'Le trouver'} dans les box</a>`
      : `<button type="button" class="btn inv-equip-btn" disabled>${ico('lock')} Verrouillé</button>`
    : on
      ? `<button type="button" class="btn inv-equip-btn is-on" disabled>✓ ${isPack ? 'Pack équipé' : setView ? 'Jeu équipé' : 'Équipé'}</button>`
      : `<button type="button" class="btn inv-equip-btn" data-equip>${isPack ? 'Équiper le pack' : partial ? `Équiper mes ${piecesCount(p.id)} pièces` : setView ? 'Équiper tout le jeu' : 'Équiper'}</button>`;
  $('#inv-d-actions').innerHTML = demo + main;

  // Grand aperçu : le pack entier, ou l'équipement actuel avec cet élément à la place
  clearTimeout(demoTimer);
  dFx.reset();
  stopAllSounds(); // on change d'élément ou d'onglet : le son de l'aperçu d'avant s'arrête
  dress(dHost, overrideFor(p.id));
  const fen = isPack ? START : tab === 'board' ? MIDDLE : tab === 'pieces' ? START : DEMOS[tab].fen;
  // Pièce choisie : elle est mise en avant sur le grand aperçu
  dHost.dataset.hl = isPiece ? PIECE_ROLE[slot] : ''; // pièce mise en avant (pas un bouton)
  detail.ground.set({ fen, lastMove: undefined, check: false });
  if (autoplay && DEMOS[tab]) playDemo(500);
}

/** Rejoue le coup de démonstration avec l'animation (et le son) de l'élément choisi. */
function playDemo(delay = 300, outcome = 'win') {
  stopAllSounds(); // l'animation d'avant se tait
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
  const pt = e.target.closest('[data-ptype]');
  if (pt) {
    // Depuis le détail d'un jeu : on garde le pack regardé, on voit tout de suite sa pièce
    goTo('pieces', pt.closest('#inv-d-extra') ? selected : null, pt.dataset.ptype || null);
    return;
  }
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
      } else if (tab === 'pieces' && pieceType) {
        await setEquip({ [pieceType]: selected });
        toast(`${PIECE_NAMES[pieceType]} : <b>${escapeHtml(itemName(selected, pieceType))}</b> équipé.`, { cls: 'info', duration: 2500 });
      } else if (tab === 'pieces') {
        const n = piecesCount(selected);
        await equipOwnedPieces(selected);
        toast(n === PIECE_TYPES.length ? `Pièces : <b>${escapeHtml(packById(selected).items.pieces.name)}</b> équipées.` : `<b>${n} pièce${n > 1 ? 's' : ''}</b> du jeu ${escapeHtml(packById(selected).name)} équipée${n > 1 ? 's' : ''}.`, { cls: 'info', duration: 2500 });
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
  fixSelected();
  renderCurrent();
  renderPiecePick();
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
