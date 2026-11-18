// Page « Mes box » : box disponibles, ouverture en 3D, aperçu de ce qu'on gagne, taux de drop et collection.
// Tirage et enregistrement : js/box.js. Sons : boxSfx (js/sound.js).
//
// L'ouverture, comme un jeu vidéo : le coffre (bois sombre cerclé de fer, gemme verte du coffre commun) tombe sur
// la scène, et c'est le joueur qui le frappe (rien ne se fait tout seul). Chaque coup le fait trembler, le couvercle
// se soulève et laisse fuir de la lumière ; tant qu'il ne s'ouvre pas, la rareté peut monter
// (Commun → Rare → Épique → Légendaire → Jeu complet). Plus le drop est gros, plus il faut de coups : c'est le suspense.
// Puis le couvercle saute, un rayon de lumière sort, et la carte de l'objet apparaît avec un vrai aperçu
// (plateau en 3D, pièce sur son socle, fin de partie ou prise jouée sur un petit échiquier).
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { ico } from './icons.js'; // icônes dessinées (à la place des emojis)
import { $, Chess, escapeHtml } from './common.js';
import { session, toast } from './compte.js';
import {
  PACKS, PACK_COLOR, SLOT_NAMES, RARITY, PIECE_TYPES, PIECE_NAMES, PIECE_ROLE, PACK_ITEMS,
  themeClasses, setEquip, equipOwnedPieces, getEquip, itemName, loadPackFont, packHas,
} from './theme.js';
import { RATES, DUST_PER_BOX, watchBoxes, openBox, grantTestBox, isSpecial } from './box.js';
import { createFx } from './fx.js';
import { boxMusic, unlockAudio, warmAudio, stopAllSounds } from './sound.js';
// Téléphones et petites tablettes : effets allégés (même règle que js/coffre3d.js)
const LOW_POWER = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
// La 3D (Three.js, 700 Ko) se charge après la page, pour qu'elle s'affiche tout de suite
let chestModule = null;
const loadChest3d = () => (chestModule ||= import('./coffre3d.js').catch(() => null));
import { boxSfx } from './sound.js';

const ICONS = { board: '▦', pieces: '♞', endAnim: '♚', capture: '✦', P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚' };
/** Paliers de suspense, dans l'ordre (le Jeu complet est le plus rare). */
const ORDER = ['commun', 'rare', 'epique', 'legendaire', 'jeu'];
const TIERS = {
  commun: { name: 'Commun', color: RARITY.commun.color },
  rare: { name: 'Rare', color: RARITY.rare.color },
  epique: { name: 'Épique', color: RARITY.epique.color },
  legendaire: { name: 'Légendaire', color: RARITY.legendaire.color },
  jeu: { name: 'Jeu complet', color: '#3cf2a3' },
};
const packById = (id) => PACKS.find((p) => p.id === id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pieceEl = (t, c, cls = '', style = '') => `<piece class="${PIECE_ROLE[t]} ${c} ${cls}"${style ? ` style="${style}"` : ''}></piece>`;

// Coups de démonstration (vérifiés par chess.js), comme dans l'inventaire
const DEMOS = {
  capture: { fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', san: 'Nxh4' },
  endAnim: { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', san: 'Qxf7#' },
};
const MIDDLE = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8';

/**
 * Le coffre en 3D (CSS), façon dark fantasy : planches de bois sombre veinées, gros cerclages de fer martelé
 * cloutés aux quatre coins, couvercle bombé (8 planches en arc) sur charnière, serrure en losange et la gemme
 * verte du coffre commun ; de la lumière à l'intérieur. La forme est dans style.css (« Le coffre commun »).
 */
const LID_FACETS = 8;
const bands = '<b class="band l"></b><b class="band r"></b>';
const cubeHTML = (cls = '') => `<div class="cube chest ${cls}" aria-hidden="true">
  <div class="cube-shadow"></div>
  <div class="cube-rot">
    <div class="cb-body"><i class="f inner"></i><i class="f bottom"></i>${['back', 'left', 'right'].map((f) => `<i class="f ${f}">${bands}<b class="rim"></b></i>`).join('')}<i class="f front">${bands}<b class="rim"></b><b class="lock"><b class="keyhole"></b></b></i></div>
    <div class="cb-lid"><i class="f lbot"></i><i class="f lb">${bands}</i><i class="f lf">${bands}</i>${Array.from({ length: LID_FACETS }, (_, i) => `<i class="f lid lid${i}">${bands}</i>`).join('')}<i class="f ll"><b class="cap-wood"></b></i><i class="f lr"><b class="cap-wood"></b></i><b class="gem-set"><b class="gem"></b></b></div>
  </div>
</div>`;

/** La version CSS du coffre (sans WebGL), avec la même interface que le coffre 3D. */
function cssChest(host0) {
  let host = host0;
  let cls = 'idle';
  const draw = () => (host.innerHTML = cubeHTML(cls));
  draw();
  const cube = () => host.querySelector('.cube');
  const hinge = (deg) => `translateZ(calc(var(--s) * -0.45)) rotateX(${deg}deg) translateZ(calc(var(--s) * 0.45))`;
  return {
    setTint: (c) => cube()?.style.setProperty('--c', c),
    setLeak: (v) => cube()?.style.setProperty('--leak', String(v)),
    setOpen: (d) => cube()?.style.setProperty('--open', `${d}deg`),
    setPaused() {},
    moveTo(h, { idle = true } = {}) {
      host.innerHTML = '';
      host = h;
      cls = idle ? 'idle' : 'stage-cube';
      draw();
    },
    hit() {
      cube().animate([{ transform: 'none' }, { transform: 'translateY(10px) scale(1.14, .8)', offset: 0.14 }, { transform: `translateY(-22px) scale(.92, 1.12) rotate(${rnd(-7, 7)}deg)`, offset: 0.45 }, { transform: 'none' }], { duration: 560, easing: 'ease-out' });
    },
    open() {
      cube().style.setProperty('--leak', '1');
      cube().querySelector('.cb-lid').animate([{ transform: hinge(16) }, { transform: hinge(128), offset: 0.55 }, { transform: hinge(104), offset: 0.8 }, { transform: hinge(112) }], { duration: 800, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    },
    reset: draw,
  };
}
// Un seul coffre pour toute la page : il vit dans la carte, et passe dans la scène le temps d'une ouverture
const cardHost = document.createElement('div');
cardHost.className = 'chest3d chest-card';
const stageHost = document.createElement('div');
stageHost.className = 'chest3d chest-stage';
let chest = null;
let chestReady = null;
let showcase = null; // la vitrine des autres coffres (rare, épique, légendaire)
let boxCount = 0;
/** Crée le coffre (3D si possible, sinon CSS), une seule fois. */
function ensureChest() {
  return (chestReady ||= loadChest3d().then((mod) => {
    chest = mod?.createChest(cardHost, { idle: true, tint: '#3cf2a3', zoom: 1.1 }) || cssChest(cardHost);
    restCardChest();
    return chest;
  }));
}
/** Le coffre au repos dans la carte : il brille un peu quand il y en a à ouvrir. */
function restCardChest() {
  if (!chest) return;
  chest.setTint('#3cf2a3');
  chest.setLeak(boxCount ? 0.25 : 0);
  chest.setOpen(0);
}
/** Pose le coffre de la page dans sa carte. */
function placeCardChest(n) {
  boxCount = n;
  const art = $('#bx-card-art');
  if (!art) return;
  art.prepend(cardHost);
  if (!opening) restCardChest();
  ensureChest();
}

const { user, banned } = await session;
const uid = user?.id || null;
let state = { ready: false, keys: [], owned: {}, dust: 0 };
let staff = false;
let opening = false;

// ---------------------------------------------------------------------------
// Taux de drop
// ---------------------------------------------------------------------------
function renderRates() {
  const who = (id) => {
    if (id === 'jeu') return 'Les 6 pièces d’un pack d’un coup';
    const list = PACKS.filter((p) => p.box && p.rarity === id).map((p) => p.name).join(', ');
    return id === 'commun' ? `${list} : le plateau ou une pièce` : `${list} : un plateau, une pièce, une fin de partie ou une prise`;
  };
  // Seulement ce qu'on peut trouver dans le coffre
  const list = $('#bx-rates');
  if (list) list.innerHTML = RATES.map((r) => `<li style="--c:${TIERS[r.id].color}"><span class="bx-rate-name">${r.id === 'jeu' ? '♚ ' : ''}${escapeHtml(r.name)}</span><b>${String(r.pct).replace('.', ',')} %</b><small>${escapeHtml(who(r.id))}</small></li>`).join('');
}
// ---------------------------------------------------------------------------
// Les coffres, en carrousel : un coffre par carte (Commun, Rare, Épique, Légendaire). Le ⓘ de chaque carte la
// retourne pour montrer ses infos (taux de drop, comment l'obtenir). Seul le coffre commun s'ouvre pour l'instant.
// ---------------------------------------------------------------------------
const CHESTS = [
  {
    id: 'commun', name: 'Coffre commun', rarity: 'Commun', color: '#3cf2a3',
    info: `<p>Un plateau, une pièce (pion, tour, cavalier, fou, dame ou roi), une fin de partie ou une prise et son. Et parfois, très rarement, un jeu de pièces complet.</p>
      <p class="bx-info-how">${ico('swords')}<span>Un à chaque victoire en ligne.</span></p>
      <span class="bx-rates-head">Taux de drop</span>
      <ul class="bx-rates" id="bx-rates"></ul>
      <span class="bx-rates-foot">Plus le drop est gros, plus il faut frapper le coffre avant qu’il s’ouvre.</span>`,
  },
  { id: 'rare', name: 'Coffre rare', rarity: 'Rare', how: '1 par jour avec les quêtes quotidiennes.', icon: 'target' },
  { id: 'epique', name: 'Coffre épique', rarity: 'Épique', how: 'Avec les quêtes hebdomadaires.', icon: 'trophy' },
  { id: 'legendaire', name: 'Coffre légendaire', rarity: 'Légendaire', how: 'Pas encore disponible.', icon: 'lock' },
].map((c) => ({ ...c, color: c.color || RARITY[c.id].color }));

/** Une carte du carrousel. */
const slideHTML = (c) => {
  const isCommun = c.id === 'commun';
  const info = c.info || `<p class="bx-info-how">${ico(c.icon)}<span>${c.how}</span></p>
    <p class="muted">Son contenu sera dévoilé bientôt.</p>`;
  return `<article class="bx-slide${isCommun ? '' : ' soon'}" data-chest="${c.id}" style="--c:${c.color}" aria-roledescription="carte" aria-label="${c.name}">
    <div class="bx-slide-art"${isCommun ? ' id="bx-card-art"' : ` data-variant="${c.id}"`}>${isCommun ? '' : '<span class="bx-count zero">×0</span>'}</div>
    <div class="bx-slide-body">
      <span class="bx-chest-rarity">${c.rarity}</span>
      <h2 class="bx-title">${c.name} <button class="bx-info" type="button" data-info aria-label="Infos sur le ${c.name.toLowerCase()}" aria-expanded="false">i</button></h2>
      <div class="bx-slide-dyn"${isCommun ? ' id="bx-commun-body"' : ''}>${isCommun ? '' : `<p class="bx-slide-soon">${ico('lock')} Bientôt</p>`}</div>
    </div>
    <div class="bx-slide-info">
      <button class="bx-slide-close" type="button" data-info-close aria-label="Fermer les infos">✕</button>
      <h3>${c.name}</h3>
      ${info}
    </div>
  </article>`;
};

/** Construit le carrousel une seule fois (les coffres 3D y vivent ; on ne met à jour ensuite que le texte). */
function buildCarousel() {
  if ($('#bx-car-track')) return;
  $('#bx-main').innerHTML = `<div class="bx-carousel">
      <button class="bx-car-nav prev" type="button" data-car="-1" aria-label="Coffre précédent">‹</button>
      <div class="bx-car-track" id="bx-car-track" tabindex="0" aria-label="Les coffres (flèches gauche et droite)">${CHESTS.map(slideHTML).join('')}</div>
      <button class="bx-car-nav next" type="button" data-car="1" aria-label="Coffre suivant">›</button>
    </div>
    <div class="bx-car-dots" role="tablist">${CHESTS.map((c, i) => `<button class="bx-car-dot" type="button" data-go="${i}" style="--c:${c.color}" aria-label="${c.name}"></button>`).join('')}</div>
    <div class="bx-under" id="bx-under"></div>`;
  renderRates();
  const track = $('#bx-car-track');
  const slides = [...track.children];
  const dots = [...document.querySelectorAll('.bx-car-dot')];
  const N = slides.length;
  const GAP = 18;
  let drag = 0;
  // Chaque carte est placée par rapport à la carte du centre : -1 à gauche, +1 à droite, ±2 hors de l'écran.
  // Le carrousel boucle : après le Légendaire revient le Commun. Une carte qui passe d'un bord à l'autre
  // le fait hors de l'écran, sans animation.
  let prev = carousel.cur;
  carousel.layout = (anim = true) => {
    const w = slides[0].offsetWidth + GAP;
    const tf = (d) => `translateX(${d * w + drag}px)${d ? ' scale(.94)' : ''}`;
    // sens du déplacement : +1 quand on va vers la carte de droite (les cartes partent à gauche)
    let dir = (((carousel.cur - prev) % N) + N) % N;
    dir = dir === 0 ? 0 : dir <= N / 2 ? 1 : -1;
    prev = carousel.cur;
    slides.forEach((sl, i) => {
      let d = (((i - carousel.cur) % N) + N) % N;
      if (d > N / 2) d -= N;
      if (d === N / 2) {
        // la carte du fond attend du côté où l'on glisse (pour arriver par là), sinon du côté d'où elle vient
        if (drag < 0) d = N / 2;
        else if (drag > 0) d = -N / 2;
        else if (sl._d < 0) d = -d;
      }
      const jump = sl._d !== undefined && Math.abs(d - sl._d) > 1;
      if (anim && jump && Math.abs(d) < N / 2) {
        // carte qui change de bord : on la pose d'abord hors de l'écran, du bon côté, puis elle glisse à sa place
        sl.style.transition = 'none';
        sl.style.transform = tf(d === 0 ? dir * (N / 2) : d + Math.sign(d));
        void sl.offsetWidth;
        sl.style.transition = '';
      } else sl.style.transition = !anim || jump ? 'none' : '';
      sl.style.transform = tf(d);
      sl.classList.toggle('is-active', d === 0);
      sl.toggleAttribute('inert', d !== 0);
      sl._d = d;
    });
    dots.forEach((dt, k) => dt.classList.toggle('on', k === carousel.cur));
  };
  carousel.layout(false);
  addEventListener('resize', () => carousel.layout(false));
  // Glisser au doigt (ou à la souris) : la carte suit, puis passe à la suivante au-delà de 50 px
  let x0 = null;
  let moved = false;
  track.addEventListener('pointerdown', (e) => {
    moved = false;
    if (e.button !== 0 || e.target.closest('button, a, .bx-slide-info')) return;
    x0 = e.clientX;
  });
  addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    drag = e.clientX - x0;
    if (Math.abs(drag) > 8) moved = true;
    if (moved) carousel.layout(false);
  });
  const release = () => {
    if (x0 === null) return;
    const d = drag;
    x0 = null;
    drag = 0;
    setTimeout(() => (moved = false), 0); // le clic qui suit un glissé est ignoré, pas les suivants
    if (Math.abs(d) > 50) goSlide(carousel.cur - Math.sign(d));
    else carousel.layout();
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  // après un glissé, pas de « clic » sur la carte
  track.addEventListener('click', (e) => {
    if (moved) {
      e.stopPropagation();
      moved = false;
    }
  }, true);
  // Clavier : flèches gauche et droite quand le carrousel a le focus
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') goSlide(carousel.cur + 1);
    else if (e.key === 'ArrowLeft') goSlide(carousel.cur - 1);
  });
  // La 3D des trois autres coffres : un seul contexte WebGL pour les trois, après le coffre commun
  loadChest3d().then((mod) => (window.requestIdleCallback || setTimeout)(() => {
    const hosts = [...track.querySelectorAll('.bx-slide-art[data-variant]')];
    showcase = mod?.createShowcase?.(hosts.map((h) => ({ host: h, variant: h.dataset.variant, dim: h.dataset.variant === 'legendaire' }))) || null;
    if (showcase && opening) showcase.setPaused(true);
  }, { timeout: 1500 }));
}
/** Le carrousel (infini) : la carte du centre. */
const carousel = { cur: 0, layout: () => {} };
/** Amène la carte i au centre (en boucle : -1 donne la dernière). */
function goSlide(i) {
  const n = $('#bx-car-track')?.children.length || 1;
  carousel.cur = ((i % n) + n) % n;
  for (const sl of document.querySelectorAll('.bx-slide.flipped')) sl.classList.remove('flipped');
  carousel.layout();
}

// ---------------------------------------------------------------------------
// Coffres disponibles (la carte du coffre commun)
// ---------------------------------------------------------------------------
function renderMain() {
  buildCarousel();
  const body = $('#bx-commun-body');
  const under = $('#bx-under');
  const slide = body.closest('.bx-slide');
  const art = $('#bx-card-art');
  if (!uid) {
    body.innerHTML = `<p class="muted">Connecte-toi pour gagner des coffres.</p>
      <a class="btn btn-primary" href="connexion.html?retour=box.html">Se connecter</a>`;
    under.innerHTML = '';
    placeCardChest(0);
    if (!art.querySelector('.bx-count')) art.insertAdjacentHTML('beforeend', '<span class="bx-count zero">×0</span>');
    return;
  }
  if (!state.ready) return;
  const n = state.keys.length;
  const specials = state.keys.filter(isSpecial).length;
  const dustOk = state.dust >= DUST_PER_BOX;
  slide.classList.toggle('has', n > 0);
  art.querySelector('.bx-count')?.remove();
  art.insertAdjacentHTML('beforeend', `<span class="bx-count${n ? '' : ' zero'}">×${n}</span>`);
  body.innerHTML = `<p class="bx-have">${n ? `Tu as <b>${n} coffre${n > 1 ? 's' : ''}</b> à ouvrir.` : 'Gagne une partie en ligne pour en avoir un.'}</p>
    <div class="bx-actions">
      <button class="btn btn-primary bx-open-btn" type="button" data-open ${n && !banned ? '' : 'disabled'}>${ico('key')} Ouvrir</button>
      <a class="btn btn-ghost" href="jouer.html">Jouer en ligne</a>
    </div>`;
  under.innerHTML = `<div class="bx-dust">
      <span>${ico('dust')} Poussière d’étoile : <b>${state.dust}</b> / ${DUST_PER_BOX}</span>
      <div class="bx-dust-bar"><i style="width:${Math.min(100, (state.dust / DUST_PER_BOX) * 100)}%"></i></div>
      <button class="btn btn-ghost small" type="button" data-dust ${dustOk && !banned ? '' : 'disabled'}>Ouvrir un coffre avec ${DUST_PER_BOX} ${ico('dust')}</button>
    </div>
    ${specials ? `<p class="bx-staff"><button class="btn btn-primary small" type="button" data-open-special ${banned ? 'disabled' : ''}>${ico('key')} Ouvrir un coffre spécial ×${specials}</button> <span class="muted">50 % épique, 50 % légendaire</span></p>` : ''}
    ${staff ? `<p class="bx-staff"><button class="btn btn-ghost small" type="button" data-grant>${ico('tools')} +1 coffre de test</button> <button class="btn btn-ghost small" type="button" data-grant-special>${ico('tools')} +1 coffre spécial (épique ou légendaire)</button> <span class="muted">(admins et fondateur)</span></p>` : ''}`;
  placeCardChest(n);
}

// ---------------------------------------------------------------------------
// Collection : par pack, le plateau, les 6 pièces (en vrai), la fin de partie, la prise
// ---------------------------------------------------------------------------
function renderCollection() {
  const packs = PACKS.filter((p) => p.box);
  const has = (p, s) => !!state.owned[p.id]?.[s] || (PIECE_TYPES.includes(s) && !!state.owned[p.id]?.pieces);
  $('#bx-collection').innerHTML = packs.map((p) => {
    const items = PACK_ITEMS.filter((s) => packHas(p, s)); // Bois : seulement le plateau et les pièces
    const n = items.filter((s) => has(p, s)).length;
    const row = (s) => {
      if (!packHas(p, s)) return '';
      const ok = has(p, s);
      return `<li class="${ok ? 'ok' : ''}"><span aria-hidden="true">${ok ? ICONS[s] : ico('lock')}</span><span><small>${SLOT_NAMES[s]}</small>${escapeHtml(p.items[s].name)}</span></li>`;
    };
    // La carte prend la couleur du pack (Sakura en rouge…), l'étiquette de rareté garde la sienne
    return `<article class="bx-pack" style="--c:${PACK_COLOR[p.id]};--rc:${RARITY[p.rarity].color}">
      <div class="bx-pack-head"><h3>${escapeHtml(p.name)}</h3><span class="bx-rarity">${RARITY[p.rarity].name}</span><b>${n} / ${items.length}</b></div>
      <div class="bx-pack-bar"><i style="width:${(n / items.length) * 100}%"></i></div>
      <ul>${row('board')}</ul>
      <div class="bx-pack-pieces cg-wrap pieces-${p.id}">${PIECE_TYPES.map((t) => `<span class="${has(p, t) ? 'ok' : ''}" title="${escapeHtml(itemName(p.id, t))}${has(p, t) ? '' : ' (à trouver)'}">${pieceEl(t, 'white')}${has(p, t) ? '' : `<b>${ico('lock')}</b>`}</span>`).join('')}</div>
      ${packHas(p, 'endAnim') ? `<ul>${row('endAnim')}${row('capture')}</ul>` : ''}
    </article>`;
  }).join('');
}

function renderAll() {
  if (opening) return renderCollection(); // pendant l'ouverture, on ne refait pas la carte (elle est sous la scène)
  renderMain();
  renderCollection();
}

// ---------------------------------------------------------------------------
// Particules (canvas plein écran) : étincelles, étoiles, confettis
// ---------------------------------------------------------------------------
const canvas = $('#bx-fx');
const g2 = canvas.getContext('2d');
let parts = [];
let raf = 0;
let dpr = 1;
function sizeCanvas() {
  dpr = 1; // les particules n'ont pas besoin de plus : un canevas plein écran en haute densité coûte cher
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
addEventListener('resize', sizeCanvas);
/** Lance des particules depuis (x, y) en pixels d'écran. */
function emit({ x, y, n = 20, speed = [3, 9], angle = [0, Math.PI * 2], color = '#fff', size = [1.5, 3.5], life = [40, 80], gravity = 0.12, kind = 'spark', drag = 0.97 }) {
  const cols = Array.isArray(color) ? color : [color];
  if (LOW_POWER) n = Math.ceil(n * 0.35); // téléphone : moins de particules
  // Plafond : jamais plus de N particules à l'écran (c'est ce qui fait ramer quand tout explose en même temps)
  n = Math.min(n, (LOW_POWER ? 110 : 500) - parts.length);
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const a = rnd(angle[0], angle[1]);
    const v = rnd(speed[0], speed[1]);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(size[0], size[1]), life: rnd(life[0], life[1]), age: 0, c: cols[i % cols.length], kind, g: gravity, drag, rot: rnd(0, 6.3), vr: rnd(-0.3, 0.3) });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  g2.clearRect(0, 0, innerWidth, innerHeight);
  // Téléphone : simple superposition (le mode « lighter » coûte cher sur un grand canevas)
  g2.globalCompositeOperation = LOW_POWER ? 'source-over' : 'lighter';
  parts = parts.filter((p) => p.age < p.life);
  for (const p of parts) {
    p.age++;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const k = 1 - p.age / p.life;
    g2.globalAlpha = Math.min(1, k * 1.6);
    if (p.kind === 'spark') {
      // Traînée dans le sens du mouvement
      g2.strokeStyle = p.c;
      g2.lineWidth = p.s;
      g2.lineCap = 'round';
      g2.beginPath();
      g2.moveTo(p.x, p.y);
      g2.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
      g2.stroke();
    } else if (p.kind === 'shard') {
      // Éclat de glace : un triangle fin qui tournoie
      g2.fillStyle = p.c;
      g2.save();
      g2.translate(p.x, p.y);
      g2.rotate(p.rot);
      g2.beginPath();
      g2.moveTo(0, -p.s * 1.8);
      g2.lineTo(p.s * 0.55, p.s * 0.6);
      g2.lineTo(-p.s * 0.45, p.s * 0.9);
      g2.closePath();
      g2.fill();
      g2.restore();
    } else if (p.kind === 'coin') {
      // Pièce d'or qui tourne sur elle-même (une ellipse qui s'aplatit), avec un reflet
      g2.globalCompositeOperation = 'source-over';
      const w = Math.abs(Math.cos(p.age * 0.18 + p.rot)) * p.s + 0.6;
      g2.fillStyle = p.c;
      g2.beginPath();
      g2.ellipse(p.x, p.y, w, p.s, 0, 0, Math.PI * 2);
      g2.fill();
      g2.fillStyle = '#fff3c4';
      g2.beginPath();
      g2.ellipse(p.x - w * 0.3, p.y - p.s * 0.3, w * 0.3, p.s * 0.3, 0, 0, Math.PI * 2);
      g2.fill();
      g2.globalCompositeOperation = LOW_POWER ? 'source-over' : 'lighter';
    } else if (p.kind === 'flake') {
      // Flocon : un point doux qui flotte en zigzag
      p.x += Math.sin(p.age * 0.08 + p.rot) * 0.6;
      g2.fillStyle = p.c;
      g2.beginPath();
      g2.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      g2.fill();
    } else if (p.kind === 'star') {
      g2.fillStyle = p.c;
      g2.save();
      g2.translate(p.x, p.y);
      g2.rotate(p.rot);
      const r = p.s * (0.6 + 0.4 * Math.sin(p.age * 0.4));
      g2.beginPath();
      for (let i = 0; i < 8; i++) {
        const rr = i % 2 ? r * 0.35 : r * 1.6;
        g2.lineTo(Math.cos((i * Math.PI) / 4) * rr, Math.sin((i * Math.PI) / 4) * rr);
      }
      g2.fill();
      g2.restore();
    } else {
      // Confettis : petits rectangles qui tournent
      g2.globalCompositeOperation = 'source-over';
      g2.fillStyle = p.c;
      g2.save();
      g2.translate(p.x, p.y);
      g2.rotate(p.rot);
      g2.scale(1, Math.cos(p.age * 0.25));
      g2.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s);
      g2.restore();
      g2.globalCompositeOperation = LOW_POWER ? 'source-over' : 'lighter';
    }
  }
  g2.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(tick) : 0;
  if (!raf) g2.clearRect(0, 0, innerWidth, innerHeight);
}

// ---------------------------------------------------------------------------
// Aperçus de l'objet gagné
// ---------------------------------------------------------------------------
/** Un échiquier fixe (sans Chessground) : se dessine juste, même pendant une animation ou en 3D. */
function staticBoard(fen, cls = '') {
  let pieces = '';
  fen.split(' ')[0].split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      pieces += pieceEl(ch.toUpperCase(), ch === ch.toUpperCase() ? 'white' : 'black', '', `transform:translate(${f * 100}%,${r * 100}%)`);
      f++;
    }
  });
  return `<div class="board-frame bx-sboard ${cls}"><div class="cg-wrap"><cg-container><cg-board>${pieces}</cg-board></cg-container></div></div>`;
}

/** Remplit la zone d'aperçu ; renvoie { play(outcome) } pour les animations (fin de partie, prise). */
function buildPreview(art, res) {
  const eq = getEquip();
  const slot = res.rarity === 'jeu' ? 'pieces' : res.slots[0];
  const pack = res.pack;
  if (slot === 'pieces') {
    // Jeu complet : les 12 pièces surgissent une à une
    art.className = `bx-res-art cg-wrap pieces-${pack}`;
    art.innerHTML = `<div class="bx-set">${['white', 'black'].map((c, ci) => PIECE_TYPES.map((t, i) => pieceEl(t, c, 'pop', `animation-delay:${0.35 + (ci * 6 + i) * 0.09}s`)).join('')).join('')}</div>`;
    return null;
  }
  if (PIECE_TYPES.includes(slot)) {
    // Une pièce : en grand sur un socle lumineux, Blancs devant et Noirs derrière, qui tournent doucement
    art.className = `bx-res-art cg-wrap pieces-${pack}`;
    art.innerHTML = `<div class="bx-show"><div class="bx-ped"></div><div class="bx-turn">${pieceEl(slot, 'black', 'bx-back')}${pieceEl(slot, 'white', 'bx-mirror')}${pieceEl(slot, 'white', 'bx-front')}</div></div>`;
    return null;
  }
  const look = { ...eq, [slot]: pack };
  if (slot === 'board') {
    // Le plateau, posé en 3D, avec tes pièces dessus
    art.className = 'bx-res-art';
    art.innerHTML = `<div class="bx-board3d">${staticBoard(MIDDLE)}</div>`;
    art.querySelector('.bx-board3d').classList.add(...themeClasses(look));
    return null;
  }
  // Fin de partie ou prise : on la joue sur un petit échiquier
  loadPackFont(pack);
  art.className = 'bx-res-art';
  art.innerHTML = '<div class="bx-demo"><div class="board-frame bx-dboard"><div class="cg-wrap board"></div></div></div>';
  const host = art.querySelector('.bx-demo');
  host.classList.add(...themeClasses(look));
  const frame = host.querySelector('.board-frame');
  const demo = DEMOS[slot];
  let ground = null;
  let fx = null;
  let timer = 0;
  return {
    start() {
      ground = Chessground(frame.querySelector('.board'), { fen: demo.fen, viewOnly: true, coordinates: false, animation: { duration: 240 } });
      fx = createFx(frame, () => 'w');
    },
    play(outcome = 'win', delay = 350) {
      if (!ground) return;
      clearTimeout(timer);
      fx.reset();
      const chess = new Chess(demo.fen);
      ground.set({ fen: demo.fen, lastMove: undefined, check: false });
      timer = setTimeout(() => {
        const m = chess.move(demo.san);
        ground.move(m.from, m.to);
        ground.set({ fen: chess.fen(), lastMove: [m.from, m.to], check: chess.inCheck() ? 'black' : false });
        fx.move(m, chess, { me: outcome === 'loss' ? 'b' : 'w', style: { [slot]: pack } });
      }, delay);
    },
    stop() {
      clearTimeout(timer);
      fx?.reset();
      ground?.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// Scène d'ouverture
// ---------------------------------------------------------------------------
const stage = $('#bx-stage');
const scene = $('#bx-scene');
const inner = $('#bx-inner');
const result = $('#bx-result');
let demoCtl = null;
let stopHum = () => {};
let curChest = 'commun'; // le coffre ouvert en ce moment (commun, rare, epique, legendaire)
/** Effets d'ouverture propres à chaque coffre : éclats, onde, pièces d'or. */
const CHEST_FX = {
  commun: { bits: { kind: 'confetti', color: ['#7a4e2c', '#a8744a', '#5c3a20'], size: [1.5, 3] }, flash: '#fff', fade: 900 },
  rare: { bits: { kind: 'shard', color: ['#e6f6ff', '#a9dcff', '#ffffff'], size: [2.5, 5] }, flash: '#d8f0ff', fade: 900, conf: ['#ffffff', '#a9dcff', '#4fa8ff', '#d8f0ff'] },
  epique: { bits: { kind: 'star', color: ['#c98aff', '#f0dcff'], size: [2, 4] }, flash: '#e2c4ff', fade: 1150, conf: ['#b26bff', '#e2c4ff', '#8f4dff', '#ffd98a'] },
  legendaire: { bits: { kind: 'coin', color: ['#f5b83d', '#ffd77a', '#e09a20'], size: [3, 5.5] }, flash: '#fff1c8', fade: 1350, conf: ['#f5b83d', '#ffd77a', '#fff1c8', '#e09a20'] },
};
let tapResolve = null;

/** Attend que le joueur frappe le coffre (clic, toucher, Espace, Entrée) : rien ne se fait tout seul. */
function waitTap() {
  return new Promise((resolve) => {
    tapResolve = () => {
      tapResolve = null;
      resolve();
    };
  });
}
stage.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (tapResolve && !e.target.closest('button, a')) tapResolve();
});

const center = () => {
  const r = scene.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.5 };
};
function shake(px, ms = 380) {
  if (reduce) return;
  inner.animate(
    Array.from({ length: 8 }, (_, i) => ({ transform: i === 7 ? 'none' : `translate(${rnd(-px, px)}px, ${rnd(-px, px)}px) rotate(${rnd(-px, px) * 0.12}deg)` })),
    { duration: ms, easing: 'linear' },
  );
}
function flash(color = '#fff', peak = 0.8, ms = 500) {
  const f = $('#bx-flash');
  f.style.background = color;
  f.animate([{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
}
function ring(color, scale = 3) {
  if (LOW_POWER && scene.querySelector('.bx-ring')) return;
  const r = document.createElement('i');
  r.className = 'bx-ring';
  r.style.borderColor = color;
  scene.appendChild(r);
  r.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(-50%,-50%) scale(${scale})`, opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.1,.7,.3,1)' }).finished.then(() => r.remove());
}
function slam(text, color) {
  const t = $('#bx-tier');
  t.textContent = text;
  t.style.setProperty('--tc', color);
  t.animate(
    [
      { transform: 'scale(2.6)', opacity: 0 },
      { transform: 'scale(.92)', opacity: 1, offset: 0.3 },
      { transform: 'scale(1)', opacity: 1, offset: 0.45 },
      { transform: 'scale(1.04)', opacity: 1, offset: 0.85 },
      { transform: 'scale(1.1)', opacity: 0 },
    ],
    { duration: 1300, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' },
  );
}
const setTier = (id) => {
  stage.style.setProperty('--c', TIERS[id].color);
  stage.dataset.level = String(ORDER.indexOf(id));
  chest?.setTint(TIERS[id].color);
  boxMusic.setLevel(ORDER.indexOf(id));
};

/** Un coup sur la box : elle s'écrase, rebondit, le couvercle se soulève et la lumière fuit. */
function hit(k, color, power = 1, last = false) {
  boxSfx.hit(k);
  if (last) boxSfx.unlock();
  chest.setOpen(4 + k * 3);
  chest.setLeak(Math.min(1, 0.3 + k * 0.18));
  chest.setPower?.(power);
  chest.hit(k);
  const fx = CHEST_FX[curChest];
  shake(curChest === 'legendaire' ? 5 + k * 2.5 : curChest === 'rare' ? 4 + k * 2 : 3 + k * 2);
  ring(color, 2.2 + k * 0.4);
  // Épique : une onde violette à chaque coup ; Légendaire : un anneau d'or en plus
  if (curChest === 'epique') setTimeout(() => ring('#b26bff', 3 + k * 0.5), 90);
  if (curChest === 'legendaire') setTimeout(() => ring('#f5b83d', 2.6 + k * 0.5), 60);
  const c = center();
  emit({ x: c.x, y: c.y - 10, n: 14 + k * 8, speed: [3, 7 + k * 2], angle: [-Math.PI * 0.95, -Math.PI * 0.05], color: [color, '#fff'], size: [1.5, 3], life: [25, 50], gravity: 0.2 });
  // les éclats du coffre : copeaux de bois, glace, éclats violets, pièces d'or
  emit({ x: c.x, y: c.y + 10, n: 8 + k * 5, speed: [2, 6 + k], angle: [-Math.PI * 0.9, -Math.PI * 0.1], ...fx.bits, life: [35, 65], gravity: fx.bits.kind === 'star' ? 0.04 : 0.28, drag: 0.97 });
}

/** La rareté monte d'un cran. */
function tierUp(id) {
  const t = TIERS[id];
  setTier(id);
  boxSfx.tierUp(id);
  stopHum();
  stopHum = () => {};
  flash(t.color, 0.55, 600);
  slam(id === 'jeu' ? 'Jeu complet ?!' : `${t.name} !`, t.color);
  ring(t.color, 4.5);
  const c = center();
  emit({ x: c.x, y: c.y, n: 40, speed: [4, 12], color: [t.color, '#fff'], kind: 'star', size: [2, 4], life: [40, 70], gravity: 0.05, drag: 0.95 });
}

/** Le couvercle saute : rayon de lumière, explosion de particules. */
async function burstOpen(id) {
  const t = TIERS[id];
  const lvl = ORDER.indexOf(id);
  boxMusic.resolve(lvl); // retour au calme, en majeur pour un gros drop
  stopHum();
  boxSfx.open(id);
  // Le couvercle s'ouvre, chaque coffre à sa façon (claque, lévite, tourne…)
  chest.open();
  const fx = CHEST_FX[curChest];
  $('#bx-beam').animate([{ transform: 'translateX(-50%) scaleY(0)', opacity: 0 }, { transform: 'translateX(-50%) scaleY(1)', opacity: 1, offset: 0.35 }, { transform: 'translateX(-50%) scaleY(1.08)', opacity: 0 }], { duration: 1700, delay: 150, easing: 'ease-out' });
  flash(fx.flash, curChest === 'legendaire' ? 1 : 0.9, curChest === 'legendaire' ? 1000 : 700);
  shake(12 + lvl * 4 + (curChest === 'legendaire' ? 6 : 0), curChest === 'legendaire' ? 800 : 500);
  ring(t.color, 6);
  const c = center();
  chestBurst(c);
  emit({ x: c.x, y: c.y, n: 70 + lvl * 40, speed: [5, 16 + lvl * 3], color: [t.color, '#fff', t.color], size: [2, 4], life: [40, 90], gravity: 0.15 });
  emit({ x: c.x, y: c.y - 20, n: 30 + lvl * 20, speed: [2, 8], angle: [-Math.PI * 0.85, -Math.PI * 0.15], color: [t.color, '#fff'], kind: 'star', size: [2, 5], life: [60, 110], gravity: -0.02, drag: 0.96 });
  if (lvl >= 2) {
    // confettis aux couleurs du coffre (arc-en-ciel pour le coffre commun)
    const conf = CHEST_FX[curChest].conf || ['#ff5fa2', '#ffd84a', '#3cf2a3', '#4fa8ff', '#b26bff'];
    // Pluie de confettis sur toute la largeur de l'écran
    for (let i = 0; i < 24; i++) emit({ x: rnd(0, innerWidth), y: rnd(-60, -10), n: 4 + lvl, speed: [0.5, 3], angle: [Math.PI * 0.3, Math.PI * 0.7], color: conf, kind: 'confetti', size: [3, 6], life: [160, 240], gravity: 0.06, drag: 0.99 });
  }
  stageHost.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(60px) scale(.8)', opacity: 0 }], { duration: 650, delay: fx.fade, easing: 'ease-in', fill: 'forwards' })
    .finished.then(() => opening && chest.setPaused(true), () => {}); // parti : plus de rendu 3D pendant la carte
  await wait(fx.fade + 200);
}

/** L'explosion propre à chaque coffre, quand le couvercle saute. */
function chestBurst(c) {
  if (curChest === 'rare') {
    // La glace vole en éclats, puis il neige un peu
    emit({ x: c.x, y: c.y, n: 60, speed: [5, 15], color: ['#e6f6ff', '#a9dcff', '#ffffff'], kind: 'shard', size: [3, 6], life: [45, 85], gravity: 0.3, drag: 0.97 });
    for (let i = 0; i < 10; i++) emit({ x: rnd(0, innerWidth), y: rnd(-40, 0), n: 4, speed: [0.3, 1.2], angle: [Math.PI * 0.4, Math.PI * 0.6], color: ['#ffffff', '#d8f0ff'], kind: 'flake', size: [1.2, 2.6], life: [180, 260], gravity: 0.015, drag: 0.99 });
  } else if (curChest === 'epique') {
    // Onde violette : trois anneaux qui partent l'un après l'autre, des étoiles qui tourbillonnent vers le haut
    [0, 160, 320].forEach((d, i) => setTimeout(() => ring(i === 1 ? '#e2c4ff' : '#b26bff', 7 + i * 1.5), d));
    emit({ x: c.x, y: c.y - 20, n: 50, speed: [2, 9], angle: [-Math.PI * 0.95, -Math.PI * 0.05], color: ['#c98aff', '#f0dcff', '#8f4dff'], kind: 'star', size: [2, 4.5], life: [70, 120], gravity: -0.05, drag: 0.96 });
  } else if (curChest === 'legendaire') {
    // Explosion de lumière dorée : fontaine de pièces d'or, pluie d'or sur tout l'écran, deuxième onde
    setTimeout(() => {
      ring('#ffd77a', 9);
      flash('#f5b83d', 0.45, 700);
    }, 260);
    emit({ x: c.x, y: c.y, n: 70, speed: [6, 17], angle: [-Math.PI * 0.92, -Math.PI * 0.08], color: ['#f5b83d', '#ffd77a', '#e09a20'], kind: 'coin', size: [3, 6], life: [70, 120], gravity: 0.32, drag: 0.985 });
    for (let i = 0; i < 16; i++) emit({ x: rnd(0, innerWidth), y: rnd(-80, -10), n: 3, speed: [1, 4], angle: [Math.PI * 0.35, Math.PI * 0.65], color: ['#f5b83d', '#ffd77a'], kind: 'coin', size: [3, 5], life: [140, 200], gravity: 0.12, drag: 0.99 });
  } else {
    // Copeaux de bois
    emit({ x: c.x, y: c.y, n: 30, speed: [4, 11], color: ['#7a4e2c', '#a8744a', '#5c3a20'], kind: 'confetti', size: [1.5, 3], life: [40, 70], gravity: 0.35 });
  }
}

async function doOpen(key, fake = null, variant = 'commun') {
  if (opening) return;
  // Coffre suivant (la scène est encore ouverte) : on coupe les sons de la carte d'avant (accord, aperçu…)
  if (!stage.hidden) stopAllSounds();
  opening = true;
  sizeCanvas();
  demoCtl?.stop();
  demoCtl = null;
  result.hidden = true;
  result.innerHTML = '';
  result.dataset.ready = '';
  result.classList.remove('preparing');
  scene.hidden = false;
  scene.innerHTML = '<i class="bx-beam" id="bx-beam"></i>';
  scene.prepend(stageHost);
  stageHost.getAnimations().forEach((a) => a.cancel());
  $('#bx-hint').hidden = true;
  stage.style.setProperty('--c', '#2fe38a'); // le coffre éteint : la lueur de sa gemme
  stage.dataset.level = '-1';
  showcase?.setPaused(true); // la vitrine est sous la scène : plus de rendu
  stage.hidden = false;
  document.body.classList.add('bx-opening');
  // Son et musique lancés tout de suite, dans le geste du joueur (sinon les téléphones les bloquent)
  unlockAudio();
  boxMusic.start(CHEST_FX[variant] ? variant : 'commun'); // chaque coffre a sa musique
  // Le coffre de la page passe dans la scène (déjà prêt : pas de chargement au moment d'ouvrir)
  await ensureChest();
  chest.moveTo(stageHost, { idle: false, zoom: 0.96, sharp: true, look: 0.66 }); // de la place au-dessus : le couvercle ouvert tient en entier
  chest.reset();
  chest.setPaused(false);
  const base = chest.setVariant?.(variant) || '#2fe38a';
  curChest = CHEST_FX[variant] ? variant : 'commun';
  boxSfx.chest(curChest);
  chest.setPower?.(0); // runes éteintes, aura faible : chaque coup les rallume
  stage.style.setProperty('--c', base);
  chest.setTint(base);

  let res;
  try {
    // Le tirage est fait et enregistré tout de suite (une box ne s'ouvre qu'une fois) ; la suite est le spectacle
    [res] = await Promise.all([fake || openBox(uid, key, state), reduce ? null : landing()]);
  } catch (e) {
    closeStage();
    opening = false;
    toast(escapeHtml(e.message || 'Impossible d’ouvrir le coffre pour l’instant.'), { cls: 'error' });
    return;
  }
  const target = ORDER.indexOf(res.rarity);
  if (!reduce) {
    // Sans musique, la gemme scintille doucement en attendant
    stopHum = () => {}; // la musique remplace les scintillements
    const hint = $('#bx-hint');
    hint.hidden = false;
    buildCard(res); // la carte se prépare, invisible, pendant les coups
    // Coups : le 1er allume la box ; chaque coup suivant peut monter d'un cran ; le dernier l'ouvre
    for (let k = 0; k <= target + 1; k++) {
      await waitTap();
      if (!opening) return; // fermé en cours de route
      if (k === 0) {
        hint.textContent = 'Encore !';
        setTier('commun');
        boxMusic.battle(); // premier coup : place à la musique épique
      }
      hit(k, TIERS[ORDER[Math.min(k, target)]].color, (k + 1) / (target + 2), k === target + 1);
      if (k === target + 1) break;
      if (k >= 1) {
        await wait(220);
        tierUp(ORDER[k]);
      }
    }
    hint.hidden = true;
    hint.textContent = 'Touche le coffre !';
    await wait(200);
    await burstOpen(res.rarity);
  } else {
    setTier(res.rarity);
  }
  scene.hidden = true;
  await reveal(res);
  opening = false;
}

/** Le coffre apparaît doucement, sans choc ni son de coup (seul le joueur le frappe). */
async function landing() {
  await stageHost.animate(
    [
      { transform: 'translateY(-40px) scale(.9)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 700, easing: 'cubic-bezier(.2,.8,.3,1)' },
  ).finished;
}

/** Étincelles qui montent sur la carte (positions fixes : le rendu reste le même d'une carte à l'autre). */
const SPARKS = [[18, 72, 5.2, 0], [30, 64, 4.4, 1.3], [44, 78, 6, 2.1], [58, 70, 4.8, 0.6], [70, 76, 5.6, 3], [82, 66, 4.2, 1.8], [24, 84, 5, 3.6], [64, 86, 6.4, 4.2], [50, 60, 4.6, 2.8], [88, 80, 5.4, 0.2]]
  .map(([x, y, d, t], i) => `<em class="spk${i % 3 ? '' : ' big'}" style="left:${x}%;top:${y}%;animation-duration:${d}s;animation-delay:${t}s"></em>`)
  .join('');

/**
 * Prépare la carte de l'objet gagné, invisible : ses images (pièces, plateau) se décodent pendant que le joueur
 * frappe le coffre, au lieu de figer l'écran au moment où elle apparaît.
 */
function buildCard(res) {
  const p = packById(res.pack);
  const t = TIERS[res.rarity];
  const isJeu = res.rarity === 'jeu';
  const slot = isJeu ? 'pieces' : res.slots[0];
  const isPiece = PIECE_TYPES.includes(slot);
  const isNew = res.fresh.length > 0;
  const title = isJeu ? p.items.pieces.name : itemName(p.id, slot);
  const sub = isJeu ? `Les 6 pièces · ${p.name}` : `${isPiece ? 'Pièce' : SLOT_NAMES[slot]} · ${p.name}`;
  const more = state.keys.length > 0 || state.dust >= DUST_PER_BOX;
  const demoBtns = slot === 'endAnim'
    ? '<div class="bx-res-demo"><button class="btn btn-ghost small" type="button" data-demo="win">▶ Quand tu gagnes</button><button class="btn btn-ghost small" type="button" data-demo="loss">▶ Quand tu perds</button></div>'
    : slot === 'capture' ? '<div class="bx-res-demo"><button class="btn btn-ghost small" type="button" data-demo="win">▶ Revoir la prise</button></div>' : '';
  const status = isNew
    ? `<p class="bx-new">✦ ${isJeu ? `${res.fresh.length} pièce${res.fresh.length > 1 ? 's' : ''} débloquée${res.fresh.length > 1 ? 's' : ''} dans ton inventaire` : 'Débloqué dans ton inventaire'}</p>`
    : `<p class="bx-dup">${p.free ? 'Tu l’as depuis le début' : 'Déjà obtenu'} : <b class="bx-dust-gain">+<span>0</span> ${ico('dust')}</b></p>`;
  result.style.setProperty('--c', t.color);
  // Arc-en-ciel holographique : Légendaire et Jeu complet. Rare (givre) et Épique (nébuleuse) ont leur propre fond (.bx-fx).
  result.className = `bx-result tier-${res.rarity}${ORDER.indexOf(res.rarity) >= ORDER.indexOf('legendaire') ? ' foil' : ''}${isNew ? ' is-new' : ' is-dup'}`;
  result.innerHTML = `<div class="bx-card-halo" aria-hidden="true"></div><div class="bx-card-shadow" aria-hidden="true"></div><div class="bx-card3d">
      <div class="bx-fx" aria-hidden="true"><b class="ray"></b><s class="core"></s><i class="tfx"></i></div>
      <div class="bx-gloss" aria-hidden="true"><b class="foil"></b><s class="hl"></s>${SPARKS}</div>
      <div class="bx-rim" aria-hidden="true"><i></i></div>
      <div class="bx-res-head"><span class="bx-res-rarity">${escapeHtml(t.name)}</span>${isNew ? '<span class="bx-res-badge">Nouveau</span>' : ''}</div>
      <div class="bx-res-art"></div>
      <h2>${escapeHtml(title)}</h2>
      <p class="bx-res-sub">${escapeHtml(sub)}</p>
      ${demoBtns}
      ${status}
      <div class="bx-res-actions">
        ${isNew ? `<button class="btn btn-primary" type="button" data-equip-res>${isPiece ? `Équiper ce ${PIECE_NAMES[slot].toLowerCase()}` : isJeu ? 'Équiper le jeu' : 'Équiper'}</button>` : ''}
        ${more ? '<button class="btn btn-ghost" type="button" data-again>Ouvrir la suivante</button>' : ''}
        <button class="btn btn-ghost" type="button" data-close>Fermer</button>
      </div>
    </div>`;
  result.dataset.pack = res.pack;
  result.dataset.slot = slot;
  demoCtl = buildPreview(result.querySelector('.bx-res-art'), res);
  result.dataset.ready = '1';
  // Presque transparente (pas « cachée ») : le navigateur la dessine déjà, l'apparition sera fluide
  result.classList.add('preparing');
  result.hidden = false;
}

/** La carte de l'objet gagné. */
async function reveal(res) {
  if (result.dataset.ready !== '1') buildCard(res);
  result.dataset.ready = '';
  const t = TIERS[res.rarity];
  const isNew = res.fresh.length > 0;
  result.classList.remove('preparing');
  boxSfx.reveal(res.rarity, isNew);
  if (!reduce) {
    // La carte sort de la box en tournant (dos de la carte, puis face) ; son ombre, qui ne tourne pas, apparaît à la fin
    for (const n of result.querySelectorAll('.bx-card-shadow, .bx-card-halo')) n.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: LOW_POWER ? 450 : 900, easing: 'ease-out' });
    await result.querySelector('.bx-card3d').animate(
      LOW_POWER ? [{ transform: 'translateY(40px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }] : [
        { transform: 'translateY(90px) scale(.3) rotateY(540deg)', opacity: 0 },
        { transform: 'translateY(-10px) scale(1.06) rotateY(-12deg)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: LOW_POWER ? 450 : 900, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).finished;
    if (isNew) {
      result.querySelector('.bx-res-badge')?.animate([{ transform: 'scale(3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(.9) rotate(4deg)', opacity: 1, offset: 0.6 }, { transform: 'rotate(4deg)' }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
      const r = result.getBoundingClientRect();
      emit({ x: r.left + r.width / 2, y: r.top + 40, n: 30, speed: [3, 9], angle: [-Math.PI, 0], color: [t.color, '#fff'], kind: 'star', size: [2, 4], life: [40, 70], gravity: 0.1 });
    }
  }
  if (demoCtl) {
    demoCtl.start();
    demoCtl.play('win', reduce ? 200 : 700);
  }
  if (!isNew) countDust(res.dust);
}

/** Doublon : la poussière d'étoile monte, avec des étincelles. */
async function countDust(n) {
  const out = result.querySelector('.bx-dust-gain span');
  if (!out) return;
  boxSfx.dust(n);
  const r = out.getBoundingClientRect();
  for (let i = 1; i <= n; i++) {
    out.textContent = String(i);
    if (!reduce) emit({ x: r.left + 6, y: r.top + 8, n: 6, speed: [1, 4], color: ['#ffd84a', '#fff'], kind: 'star', size: [1.5, 3], life: [25, 45], gravity: -0.02 });
    await wait(Math.max(40, 360 / n));
  }
}

function closeStage() {
  demoCtl?.stop();
  demoCtl = null;
  stopHum();
  tapResolve?.();
  stage.hidden = true;
  parts = [];
  document.body.classList.remove('bx-opening');
  renderMain();
  stopAllSounds(); // on ferme : plus aucun son (musique, accord, animation gagnée)
  curChest = 'commun';
  boxSfx.chest('commun');
  setTimeout(warmAudio, 400); // et on prépare déjà la musique du prochain coffre
  showcase?.setPaused(false);
  if (chest) {
    chest.setVariant?.('commun');
    chest.setPower?.(1);
    chest.moveTo(cardHost, { idle: true, zoom: 1.1 });
    chest.reset();
    chest.setPaused(false);
    restCardChest();
  }
}

// Carte holographique : elle penche vers la souris et un reflet la suit
result.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.bx-card3d');
  if (!card || reduce || e.pointerType === 'touch') return;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  // On écrit directement les transform (pas de variables CSS sur la carte : une variable changée sur la carte est
  // héritée par tout son contenu, et Chrome redessinait alors chaque pièce à chaque mouvement de souris)
  card.style.transform = `rotateX(${((0.5 - y) * 8).toFixed(2)}deg) rotateY(${((x - 0.5) * 10).toFixed(2)}deg)`;
  // le reflet glisse jusque sous la souris (décalage en px depuis le centre : un déplacement, pas un redessin)
  const hl = card.querySelector('.bx-gloss .hl');
  if (hl) hl.style.transform = `translate(${Math.round((x - 0.5) * card.offsetWidth)}px, ${Math.round((y - 0.5) * card.offsetHeight)}px)`;
});
result.addEventListener('pointerleave', () => {
  const card = result.querySelector('.bx-card3d');
  if (card) card.style.transform = '';
});

// ---------------------------------------------------------------------------
// Clics
// ---------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  // Carrousel : flèches, points, ⓘ qui retourne la carte
  const nav = e.target.closest('[data-car]');
  if (nav) return goSlide(carousel.cur + Number(nav.dataset.car));
  const dot = e.target.closest('[data-go]');
  if (dot) return goSlide(Number(dot.dataset.go));
  const flip = e.target.closest('[data-info], [data-info-close]');
  if (flip) {
    const sl = flip.closest('.bx-slide');
    const show = flip.hasAttribute('data-info') && !sl.classList.contains('flipped');
    sl.classList.toggle('flipped', show);
    sl.querySelector('[data-info]').setAttribute('aria-expanded', String(show));
    return;
  }
  // Bulle ⓘ des taux : un toucher l'ouvre ou la ferme ; un clic ailleurs la ferme
  const info = e.target.closest('.bx-info');
  for (const w of document.querySelectorAll('.bx-info-wrap.open')) {
    if (!info || !w.contains(info)) {
      w.classList.remove('open');
      w.querySelector('.bx-info').setAttribute('aria-expanded', 'false');
    }
  }
  if (info) {
    const w = info.closest('.bx-info-wrap');
    info.setAttribute('aria-expanded', String(w.classList.toggle('open')));
    return;
  }
  // le bouton principal ouvre d'abord les coffres normaux ; les coffres spéciaux ont leur bouton
  if (e.target.closest('[data-open]')) return state.keys.length && doOpen(state.keys.find((k) => !isSpecial(k)) || state.keys[0]);
  if (e.target.closest('[data-open-special]')) { const k = state.keys.find(isSpecial); return k && doOpen(k); }
  if (e.target.closest('[data-dust]')) return doOpen(null);
  if (e.target.closest('[data-grant-special]')) {
    try {
      await grantTestBox(uid, true);
      toast(`${ico('tools')} Coffre spécial ajouté (épique ou légendaire).`, { cls: 'info', duration: 2000 });
    } catch {
      toast('Réservé aux admins et au fondateur.', { cls: 'error' });
    }
    return;
  }
  if (e.target.closest('[data-grant]')) {
    try {
      await grantTestBox(uid);
      toast(`${ico('tools')} Coffre de test ajouté.`, { cls: 'info', duration: 2000 });
    } catch {
      toast('Réservé aux admins et au fondateur.', { cls: 'error' });
    }
    return;
  }
  if (e.target.closest('[data-close]')) return closeStage();
  const demo = e.target.closest('[data-demo]');
  if (demo) {
    stopAllSounds(); // on relance l'aperçu : le son du précédent s'arrête
    return demoCtl?.play(demo.dataset.demo, 250);
  }
  if (e.target.closest('[data-again]')) {
    if (state.keys.length) return doOpen(state.keys[0]);
    if (state.dust >= DUST_PER_BOX) return doOpen(null);
    return closeStage();
  }
  const eq = e.target.closest('[data-equip-res]');
  if (eq) {
    const { pack, slot } = result.dataset;
    try {
      if (slot === 'pieces') await equipOwnedPieces(pack);
      else await setEquip({ [slot]: pack });
      eq.textContent = '✓ Équipé';
      eq.disabled = true;
      boxSfx.thunk();
    } catch (ex) {
      toast(escapeHtml(ex.message || 'Impossible d’équiper pour l’instant.'), { cls: 'error' });
    }
  }
});
stage.addEventListener('click', (e) => {
  if (e.target === e.currentTarget && !opening && !result.hidden) closeStage();
});
addEventListener('keydown', (e) => {
  if (stage.hidden) return;
  if ((e.key === ' ' || e.key === 'Enter') && tapResolve) {
    e.preventDefault();
    tapResolve();
  } else if (e.key === 'Escape' && !opening) closeStage();
});

// En local seulement (localhost) : rejouer l'ouverture sans rien enregistrer, pour régler l'animation.
// bxDemo('legendaire', 'ocean', 'N') ; bxDemo('jeu', 'japon') ; bxDemo('rare', 'western', 'endAnim', false)
// Le 5e argument choisit le coffre : bxDemo('epique', 'japon', 'N', true, 'legendaire') ouvre le coffre légendaire.
// En local, toucher un coffre de la vitrine l'ouvre aussi pour de faux.
if (location.hostname === 'localhost') {
  window.bxDemo = (rarity = 'rare', pack = 'japon', slot = 'N', isNew = true, variant = 'commun') => {
    const slots = rarity === 'jeu' ? [...PIECE_TYPES] : [slot];
    return doOpen(null, { rarity, pack, slots, fresh: isNew ? slots : [], dust: isNew ? 0 : { commun: 1, rare: 3, epique: 6, legendaire: 10, jeu: 20 }[rarity] }, variant);
  };
  $('#bx-main')?.addEventListener('click', (e) => {
    const art = e.target.closest('.bx-slide-art[data-variant]');
    if (art) window.bxDemo(art.dataset.variant, 'japon', 'N', true, art.dataset.variant);
  });
  // Panneau « Sons des coffres » (en local seulement) : écouter chaque son, ou lancer une ouverture de démo
  const names = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
  const panel = document.createElement('section');
  panel.className = 'bx-section bx-devsfx';
  panel.innerHTML = `<h2>Sons des coffres <small class="muted">(en local seulement)</small></h2>
    <div class="bx-devsfx-grid">${Object.entries(names).map(([v, n]) => `<div class="bx-devsfx-row" style="--c:${v === 'commun' ? '#3cf2a3' : RARITY[v].color}">
      <b>${n}</b>
      <button class="btn btn-ghost small" type="button" data-sfx="${v}:hit">Coup</button>
      <button class="btn btn-ghost small" type="button" data-sfx="${v}:unlock">Serrure</button>
      <button class="btn btn-ghost small" type="button" data-sfx="${v}:open">Couvercle</button>
      <button class="btn btn-ghost small" type="button" data-sfx="${v}:reveal">Révélation</button>
      <button class="btn btn-ghost small" type="button" data-sfx="${v}:calm">♪ Musique d’attente</button>
      <button class="btn btn-ghost small" type="button" data-sfx="${v}:battle">♪ Musique de combat</button>
      <button class="btn btn-primary small" type="button" data-sfx="${v}:demo">Ouverture complète</button>
    </div>`).join('')}
    <p><button class="btn btn-ghost small" type="button" data-sfx="x:stop">■ Couper la musique</button></p></div>`;
  $('#bx-main')?.after(panel);
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sfx]');
    if (!b) return;
    unlockAudio();
    const [v, what] = b.dataset.sfx.split(':');
    const tier = v === 'commun' ? 'rare' : v;
    if (what === 'demo') return window.bxDemo(tier, 'japon', 'N', true, v);
    if (what === 'stop') return boxMusic.stop(0.4);
    if (what === 'calm' || what === 'battle') {
      // la musique du coffre (combat : au niveau épique, pour l'entendre bien chargée)
      boxMusic.stop(0.05);
      return setTimeout(() => {
        boxMusic.start(v);
        if (what === 'battle') {
          boxMusic.setLevel(2);
          boxMusic.battle();
        }
      }, 80);
    }
    boxSfx.chest(v);
    if (what === 'hit') [0, 1, 2].forEach((k) => setTimeout(() => boxSfx.hit(k), k * 420));
    else if (what === 'unlock') boxSfx.unlock();
    else if (what === 'open') boxSfx.open(tier);
    else boxSfx.reveal(tier, true);
  });
}
// box.html?demo=legendaire,ocean,N,new,legendaire : la lance au chargement (5e valeur : le coffre)
const demoArg = location.hostname === 'localhost' && new URLSearchParams(location.search).get('demo');
if (demoArg) {
  const [r, p, sl, n, v] = demoArg.split(',');
  setTimeout(() => window.bxDemo(r, p, sl, n !== 'old', v || 'commun'), 300);
}

// Le son et la musique se préparent quand la page est calme (pas au moment d'ouvrir)
addEventListener('load', () => (window.requestIdleCallback || setTimeout)(() => warmAudio(), { timeout: 3000 }));

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
