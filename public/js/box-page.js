// Page « Mes box » : box disponibles, ouverture animée, taux de drop et collection. Logique dans js/box.js.
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { $, $$, escapeHtml } from './common.js';
import { session, toast } from './compte.js';
import { PACKS, SLOTS, SLOT_NAMES, RARITY, themeClasses, setEquip, equipPack, getEquip } from './theme.js';
import { RATES, DUST_PER_BOX, BOX_TYPES, watchBoxes, openBox, grantTestBox } from './box.js';

const ICONS = { board: '▦', pieces: '♞', endAnim: '♚', capture: '✦' };
const RATE_COLOR = { commun: RARITY.commun.color, rare: RARITY.rare.color, epique: RARITY.epique.color, pack: '#3cf2a3' };
const packById = (id) => PACKS.find((p) => p.id === id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** La box, dessinée (couvercle à part pour l'ouverture). */
const BOX_SVG = `<svg class="bx-svg" viewBox="0 0 120 112" aria-hidden="true">
  <defs>
    <linearGradient id="bxBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7B5CFF"/><stop offset="1" stop-color="#34237F"/></linearGradient>
    <linearGradient id="bxLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B29BFF"/><stop offset="1" stop-color="#5A3FD0"/></linearGradient>
  </defs>
  <ellipse cx="60" cy="104" rx="44" ry="6" fill="rgba(0,0,0,.4)"/>
  <g class="bx-body">
    <rect x="16" y="50" width="88" height="50" rx="8" fill="url(#bxBody)" stroke="#1A1430" stroke-width="3"/>
    <path d="M 22 58 Q 60 64 98 58" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>
    <rect x="53" y="50" width="14" height="50" fill="#3CF2A3" stroke="#1A1430" stroke-width="2.4"/>
    <g fill="#E9E2FF" opacity=".8"><circle cx="30" cy="80" r="1.6"/><circle cx="40" cy="90" r="1.1"/><circle cx="86" cy="76" r="1.4"/><circle cx="92" cy="90" r="1"/></g>
  </g>
  <g class="bx-lid">
    <rect x="10" y="34" width="100" height="22" rx="7" fill="url(#bxLid)" stroke="#1A1430" stroke-width="3"/>
    <rect x="53" y="34" width="14" height="22" fill="#3CF2A3" stroke="#1A1430" stroke-width="2.4"/>
    <circle cx="60" cy="45" r="9" fill="#fff" stroke="#1A1430" stroke-width="2.6"/>
    <path d="M 60 39 L 61.8 43.2 L 66.2 43.4 L 62.8 46.2 L 64 50.6 L 60 48.1 L 56 50.6 L 57.2 46.2 L 53.8 43.4 L 58.2 43.2 Z" fill="#8F6BFF"/>
  </g>
</svg>`;

const { user, banned } = await session;
let uid = user?.id || null;
let state = { ready: false, keys: [], owned: {}, dust: 0 };
let staff = false;
let opening = false;

// ---------------------------------------------------------------------------
// Taux de drop
// ---------------------------------------------------------------------------
function renderRates() {
  const who = (id) => {
    if (id === 'pack') return 'Les 4 éléments d’un pack rare ou épique d’un coup';
    const list = PACKS.filter((p) => p.rarity === id).map((p) => p.name).join(', ');
    return id === 'commun' ? `${list} — déjà à toi : se change en ✨ poussière d’étoile` : list;
  };
  $('#bx-rates').innerHTML =
    RATES.map((r) => `<li style="--c:${RATE_COLOR[r.id]}"><span class="bx-rate-name">${r.id === 'pack' ? '🎁 ' : ''}${escapeHtml(r.name)}</span><b>${String(r.pct).replace('.', ',')} %</b><small>${escapeHtml(who(r.id))}</small></li>`).join('')
    + `<li style="--c:${RARITY.legendaire.color}" class="bx-rate-off"><span class="bx-rate-name">Légendaire</span><b>—</b><small>Royal chess : une mission spéciale (100 victoires en ligne), jamais dans les box</small></li>`;
}

// ---------------------------------------------------------------------------
// Box disponibles
// ---------------------------------------------------------------------------
function renderMain() {
  const main = $('#bx-main');
  if (!uid) {
    main.innerHTML = `<div class="bx-card"><div class="bx-card-art">${BOX_SVG}</div><div class="bx-card-body">
      <h2>${BOX_TYPES.classique.name}</h2><p class="muted">Connecte-toi pour gagner des box : une à chaque victoire en ligne.</p>
      <a class="btn btn-primary" href="connexion.html?retour=box.html">Se connecter</a></div></div>`;
    return;
  }
  if (!state.ready) return;
  const n = state.keys.length;
  const dustOk = state.dust >= DUST_PER_BOX;
  main.innerHTML = `<div class="bx-card${n ? ' has' : ''}">
      <div class="bx-card-art">${BOX_SVG}${n ? `<span class="bx-count">×${n}</span>` : ''}</div>
      <div class="bx-card-body">
        <h2>${BOX_TYPES.classique.name}</h2>
        <p class="muted">${BOX_TYPES.classique.desc}</p>
        <p class="bx-have">${n ? `Tu as <b>${n} box</b> à ouvrir.` : 'Plus de box à ouvrir : gagne une partie en ligne pour en avoir une.'}</p>
        <div class="bx-actions">
          <button class="btn btn-primary" type="button" data-open ${n && !banned ? '' : 'disabled'}>🎁 Ouvrir une box</button>
          <a class="btn btn-ghost" href="jouer.html">Jouer en ligne</a>
        </div>
        <div class="bx-dust">
          <span>✨ Poussière d’étoile : <b>${state.dust}</b> / ${DUST_PER_BOX}</span>
          <div class="bx-dust-bar"><i style="width:${Math.min(100, (state.dust / DUST_PER_BOX) * 100)}%"></i></div>
          <button class="btn btn-ghost small" type="button" data-dust ${dustOk && !banned ? '' : 'disabled'}>Ouvrir une box avec ${DUST_PER_BOX} ✨</button>
        </div>
        ${staff ? '<p class="bx-staff"><button class="btn btn-ghost small" type="button" data-grant>🛠 +1 box de test</button> <span class="muted">(admins et fondateur)</span></p>' : ''}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------
function renderCollection() {
  const packs = PACKS.filter((p) => p.box);
  $('#bx-collection').innerHTML = packs.map((p) => {
    const have = SLOTS.filter((s) => state.owned[p.id]?.[s]).length;
    return `<article class="bx-pack" style="--c:${RARITY[p.rarity].color}">
      <div class="bx-pack-head"><h3>${escapeHtml(p.name)}</h3><span class="bx-rarity">${RARITY[p.rarity].name}</span><b>${have} / ${SLOTS.length}</b></div>
      <ul>${SLOTS.map((s) => {
        const ok = !!state.owned[p.id]?.[s];
        return `<li class="${ok ? 'ok' : ''}"><span aria-hidden="true">${ok ? ICONS[s] : '🔒'}</span><span><small>${SLOT_NAMES[s]}</small>${escapeHtml(p.items[s].name)}</span></li>`;
      }).join('')}</ul>
    </article>`;
  }).join('');
}

function renderAll() {
  renderMain();
  renderCollection();
}

// ---------------------------------------------------------------------------
// Ouverture
// ---------------------------------------------------------------------------
/** Aperçu d'un élément : un petit échiquier (plateau), quelques pièces, ou une icône. */
function preview(packId, slot) {
  const host = document.createElement('div');
  host.className = 'bx-preview';
  const equip = { ...getEquip(), [slot]: packId };
  if (slot === 'pieces') {
    host.innerHTML = `<div class="bx-prev-pieces cg-wrap"><piece class="knight black"></piece><piece class="king black"></piece><piece class="queen white"></piece><piece class="knight white"></piece></div>`;
  } else if (slot === 'board') {
    host.innerHTML = '<div class="board-frame bx-prev-board"><div class="cg-wrap board"></div></div>';
    requestAnimationFrame(() => Chessground(host.querySelector('.board'), { fen: 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R', viewOnly: true, coordinates: false }));
  } else {
    host.innerHTML = `<div class="bx-prev-icon">${ICONS[slot]}</div>`;
  }
  host.classList.add(...themeClasses(equip));
  return host;
}

async function doOpen(key) {
  if (opening) return;
  opening = true;
  const stage = $('#bx-stage');
  const box = $('#bx-stage-box');
  const result = $('#bx-result');
  const burst = $('#bx-burst');
  box.innerHTML = BOX_SVG;
  box.hidden = false;
  result.hidden = true;
  burst.className = 'bx-burst';
  stage.hidden = false;
  document.body.classList.add('bx-opening');
  let res;
  try {
    res = await openBox(uid, key, state);
  } catch (e) {
    stage.hidden = true;
    document.body.classList.remove('bx-opening');
    opening = false;
    toast(escapeHtml(e.message || 'Impossible d’ouvrir la box pour l’instant.'), { cls: 'error' });
    return;
  }
  const color = RATE_COLOR[res.rarity];
  stage.style.setProperty('--c', color);
  const svg = box.querySelector('.bx-svg');
  if (!reduce) {
    // La box tremble de plus en plus, s'illumine de la couleur de la rareté, puis le couvercle saute
    await svg.animate(
      [0, -5, 5, -7, 7, -9, 9, -11, 11, -6, 0].map((r, i) => ({ transform: `rotate(${r}deg) scale(${1 + i * 0.012})`, filter: `drop-shadow(0 0 ${6 + i * 3}px ${color})` })),
      { duration: res.rarity === 'commun' ? 900 : 1300, easing: 'ease-in' },
    ).finished;
    svg.querySelector('.bx-lid').animate(
      [{ transform: 'none', opacity: 1 }, { transform: 'translate(-6px, -60px) rotate(-28deg)', opacity: 0 }],
      { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' },
    );
    burst.classList.add('on');
    for (let i = 0; i < (res.rarity === 'commun' ? 10 : 24); i++) {
      const sp = document.createElement('i');
      sp.className = 'bx-spark';
      $('.bx-stage-inner').appendChild(sp);
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 140;
      sp.animate(
        [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 0 }],
        { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' },
      ).finished.then(() => sp.remove());
    }
    await wait(380);
  }
  box.hidden = true;
  showResult(res);
  opening = false;
}

function showResult(res) {
  const p = packById(res.pack);
  const rar = res.rarity === 'pack' ? { name: 'Pack entier !', color: RATE_COLOR.pack } : RARITY[res.rarity];
  const isPack = res.rarity === 'pack';
  const isNew = res.fresh.length > 0;
  const title = isPack ? p.name : p.items[res.slots[0]].name;
  const sub = isPack ? 'Les 4 éléments du pack' : `${SLOT_NAMES[res.slots[0]]} · ${p.name}`;
  const status = isNew
    ? `<p class="bx-new">✦ Nouveau ! ${isPack ? `${res.fresh.length} élément${res.fresh.length > 1 ? 's' : ''} débloqué${res.fresh.length > 1 ? 's' : ''}` : 'Débloqué dans ton inventaire'}</p>`
    : `<p class="bx-dup">${p.rarity === 'commun' ? 'Tu l’as déjà depuis le début' : 'Déjà obtenu'} : <b>+${res.dust} ✨</b></p>`;
  const r = $('#bx-result');
  r.style.setProperty('--c', rar.color);
  r.innerHTML = `<p class="bx-res-rarity">${escapeHtml(rar.name)}</p>
    <div class="bx-res-art"></div>
    <h2>${escapeHtml(title)}</h2>
    <p class="muted">${escapeHtml(sub)}</p>
    ${status}
    <div class="bx-res-actions">
      ${isNew ? `<button class="btn btn-primary" type="button" data-equip-res>Équiper</button>` : ''}
      ${state.keys.length > 1 || (!state.keys.length && state.dust >= DUST_PER_BOX) ? '<button class="btn btn-ghost" type="button" data-again>Ouvrir la suivante</button>' : ''}
      <button class="btn btn-ghost" type="button" data-close>Fermer</button>
    </div>`;
  const art = r.querySelector('.bx-res-art');
  if (isPack) art.innerHTML = `<ul class="bx-res-pack">${SLOTS.map((s) => `<li><span>${ICONS[s]}</span>${escapeHtml(p.items[s].name)}</li>`).join('')}</ul>`;
  else art.appendChild(preview(res.pack, res.slots[0]));
  r.hidden = false;
  r.dataset.pack = res.pack;
  r.dataset.slot = isPack ? '' : res.slots[0];
  if (!reduce) r.animate([{ transform: 'scale(.6) translateY(20px)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'ease-out' });
}

function closeStage() {
  $('#bx-stage').hidden = true;
  document.body.classList.remove('bx-opening');
}

// ---------------------------------------------------------------------------
// Clics
// ---------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-open]')) return state.keys.length && doOpen(state.keys[0]);
  if (e.target.closest('[data-dust]')) return doOpen(null);
  if (e.target.closest('[data-grant]')) {
    try {
      await grantTestBox(uid);
      toast('🛠 Box de test ajoutée.', { cls: 'info', duration: 2000 });
    } catch {
      toast('Réservé aux admins et au fondateur.', { cls: 'error' });
    }
    return;
  }
  if (e.target.closest('[data-close]')) return closeStage();
  if (e.target.closest('[data-again]')) {
    closeStage();
    return state.keys.length ? doOpen(state.keys[0]) : doOpen(null);
  }
  const eq = e.target.closest('[data-equip-res]');
  if (eq) {
    const r = $('#bx-result');
    try {
      if (r.dataset.slot) await setEquip({ [r.dataset.slot]: r.dataset.pack });
      else await equipPack(r.dataset.pack);
      eq.textContent = '✓ Équipé';
      eq.disabled = true;
    } catch (ex) {
      toast(escapeHtml(ex.message || 'Impossible d’équiper pour l’instant.'), { cls: 'error' });
    }
  }
});
$('#bx-stage').addEventListener('click', (e) => {
  if (e.target === e.currentTarget && !opening && !$('#bx-result').hidden) closeStage();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !opening && !$('#bx-stage').hidden) closeStage();
});

// ---------------------------------------------------------------------------
renderRates();
renderMain();
if (uid) {
  staff = user.role === 'admin' || user.role === 'fondateur';
  watchBoxes(uid, (st) => {
    state = st;
    renderAll();
  });
} else {
  renderCollection();
}
