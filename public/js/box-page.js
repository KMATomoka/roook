// Page « Mes box » : box disponibles, ouverture en 3D, aperçu de ce qu'on gagne, taux de drop et collection.
// Tirage et enregistrement : js/box.js. Sons : boxSfx (js/sound.js).
//
// L'ouverture, comme un jeu vidéo : la box tombe sur la scène, on la frappe (ou elle se frappe toute seule).
// Chaque coup la fait trembler et laisse fuir de la lumière ; tant qu'elle ne s'ouvre pas, la rareté peut monter
// (Commun → Rare → Épique → Jeu complet). Plus le drop est gros, plus il faut de coups : c'est le suspense.
// Puis le couvercle saute, un rayon de lumière sort, et la carte de l'objet apparaît avec un vrai aperçu
// (plateau en 3D, pièce sur son socle, fin de partie ou prise jouée sur un petit échiquier).
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { $, Chess, escapeHtml } from './common.js';
import { session, toast } from './compte.js';
import {
  PACKS, SLOT_NAMES, RARITY, PIECE_TYPES, PIECE_NAMES, PIECE_ROLE, PACK_ITEMS,
  themeClasses, setEquip, equipOwnedPieces, getEquip, itemName, loadPackFont,
} from './theme.js';
import { RATES, DUST_PER_BOX, BOX_TYPES, watchBoxes, openBox, grantTestBox } from './box.js';
import { createFx } from './fx.js';
import { boxSfx } from './sound.js';

const ICONS = { board: '▦', pieces: '♞', endAnim: '♚', capture: '✦', P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚' };
/** Paliers de suspense, dans l'ordre (le Jeu complet est le plus rare). */
const ORDER = ['commun', 'rare', 'epique', 'jeu'];
const TIERS = {
  commun: { name: 'Commun', color: RARITY.commun.color },
  rare: { name: 'Rare', color: RARITY.rare.color },
  epique: { name: 'Épique', color: RARITY.epique.color },
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

/** La box en 3D (CSS) : un corps à 5 faces, un couvercle à 6 faces, un ruban, de la lumière à l'intérieur. */
const cubeHTML = (cls = '') => `<div class="cube ${cls}" aria-hidden="true">
  <div class="cube-shadow"></div>
  <div class="cube-rot">
    <div class="cb-body"><i class="f inner"></i><i class="f bottom"></i><i class="f back"></i><i class="f left"></i><i class="f right"></i><i class="f front"></i></div>
    <div class="cb-lid"><i class="f lbot"></i><i class="f lb"></i><i class="f ll"></i><i class="f lr"></i><i class="f lf"></i><i class="f top"></i></div>
  </div>
</div>`;

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
    if (id === 'jeu') return 'Les 6 pièces d’un pack rare ou épique d’un coup';
    const list = PACKS.filter((p) => p.rarity === id).map((p) => p.name).join(', ');
    return id === 'commun' ? `${list} — déjà à toi : se change en ✨ poussière d’étoile` : `${list} : un plateau, une pièce, une fin de partie ou une prise`;
  };
  $('#bx-rates').innerHTML =
    RATES.map((r) => `<li style="--c:${TIERS[r.id].color}"><span class="bx-rate-name">${r.id === 'jeu' ? '♚ ' : ''}${escapeHtml(r.name)}</span><b>${String(r.pct).replace('.', ',')} %</b><small>${escapeHtml(who(r.id))}</small></li>`).join('')
    + `<li style="--c:${RARITY.legendaire.color}" class="bx-rate-off"><span class="bx-rate-name">Légendaire</span><b>—</b><small>Royal chess : une mission spéciale (100 victoires en ligne), jamais dans les box</small></li>`
    + '<li style="--c:#ffd84a" class="bx-rate-off"><span class="bx-rate-name">Pack entier</span><b>—</b><small>Plus dans les box : bientôt dans la boutique</small></li>';
}

// ---------------------------------------------------------------------------
// Box disponibles
// ---------------------------------------------------------------------------
function renderMain() {
  const main = $('#bx-main');
  if (!uid) {
    main.innerHTML = `<div class="bx-card"><div class="bx-card-art">${cubeHTML('idle')}</div><div class="bx-card-body">
      <h2>${BOX_TYPES.classique.name}</h2><p class="muted">Connecte-toi pour gagner des box : une à chaque victoire en ligne.</p>
      <a class="btn btn-primary" href="connexion.html?retour=box.html">Se connecter</a></div></div>`;
    return;
  }
  if (!state.ready) return;
  const n = state.keys.length;
  const dustOk = state.dust >= DUST_PER_BOX;
  main.innerHTML = `<div class="bx-card${n ? ' has' : ''}">
      <div class="bx-card-art">${cubeHTML('idle')}${n ? `<span class="bx-count">×${n}</span>` : ''}</div>
      <div class="bx-card-body">
        <h2>${BOX_TYPES.classique.name}</h2>
        <p class="muted">Un plateau, une pièce (pion, tour, cavalier, fou, dame ou roi), une fin de partie ou une prise et son. Et parfois, très rarement, un jeu de pièces complet.</p>
        <p class="bx-have">${n ? `Tu as <b>${n} box</b> à ouvrir.` : 'Plus de box à ouvrir : gagne une partie en ligne pour en avoir une.'}</p>
        <div class="bx-actions">
          <button class="btn btn-primary bx-open-btn" type="button" data-open ${n && !banned ? '' : 'disabled'}>🎁 Ouvrir une box</button>
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
// Collection : par pack, le plateau, les 6 pièces (en vrai), la fin de partie, la prise
// ---------------------------------------------------------------------------
function renderCollection() {
  const packs = PACKS.filter((p) => p.box);
  const has = (p, s) => !!state.owned[p.id]?.[s] || (PIECE_TYPES.includes(s) && !!state.owned[p.id]?.pieces);
  $('#bx-collection').innerHTML = packs.map((p) => {
    const n = PACK_ITEMS.filter((s) => has(p, s)).length;
    const row = (s) => {
      const ok = has(p, s);
      return `<li class="${ok ? 'ok' : ''}"><span aria-hidden="true">${ok ? ICONS[s] : '🔒'}</span><span><small>${SLOT_NAMES[s]}</small>${escapeHtml(p.items[s].name)}</span></li>`;
    };
    return `<article class="bx-pack" style="--c:${RARITY[p.rarity].color}">
      <div class="bx-pack-head"><h3>${escapeHtml(p.name)}</h3><span class="bx-rarity">${RARITY[p.rarity].name}</span><b>${n} / ${PACK_ITEMS.length}</b></div>
      <div class="bx-pack-bar"><i style="width:${(n / PACK_ITEMS.length) * 100}%"></i></div>
      <ul>${row('board')}</ul>
      <div class="bx-pack-pieces cg-wrap pieces-${p.id}">${PIECE_TYPES.map((t) => `<span class="${has(p, t) ? 'ok' : ''}" title="${escapeHtml(itemName(p.id, t))}${has(p, t) ? '' : ' (à trouver)'}">${pieceEl(t, 'white')}${has(p, t) ? '' : '<b>🔒</b>'}</span>`).join('')}</div>
      <ul>${row('endAnim')}${row('capture')}</ul>
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
  dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
addEventListener('resize', sizeCanvas);
/** Lance des particules depuis (x, y) en pixels d'écran. */
function emit({ x, y, n = 20, speed = [3, 9], angle = [0, Math.PI * 2], color = '#fff', size = [1.5, 3.5], life = [40, 80], gravity = 0.12, kind = 'spark', drag = 0.97 }) {
  const cols = Array.isArray(color) ? color : [color];
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
  g2.globalCompositeOperation = 'lighter';
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
      g2.globalCompositeOperation = 'lighter';
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
    art.innerHTML = `<div class="bx-show"><div class="bx-ped"></div><div class="bx-turn">${pieceEl(slot, 'black', 'bx-back')}${pieceEl(slot, 'white', 'bx-front')}</div><div class="bx-ref">${pieceEl(slot, 'white')}</div></div>`;
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
let tapResolve = null;

/** Attend un coup sur la box (clic, toucher, Espace, Entrée) ou, sans rien, quelques instants. */
function waitTap(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      tapResolve = null;
      resolve();
    }
    tapResolve = done;
  });
}
stage.addEventListener('pointerdown', (e) => {
  if (tapResolve && !e.target.closest('button, a')) tapResolve();
});

const center = () => {
  const r = scene.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
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
      { transform: 'scale(2.6)', opacity: 0, filter: 'blur(12px)' },
      { transform: 'scale(.92)', opacity: 1, filter: 'blur(0)', offset: 0.3 },
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
};

/** Un coup sur la box : elle s'écrase, rebondit, le couvercle se soulève et la lumière fuit. */
function hit(k, color) {
  const cube = scene.querySelector('.cube');
  boxSfx.hit(k);
  cube.style.setProperty('--lift', `${6 + k * 5}px`);
  cube.style.setProperty('--leak', String(Math.min(1, 0.35 + k * 0.18)));
  cube.animate(
    [
      { transform: 'none' },
      { transform: `translateY(10px) scale(1.14, .8)`, offset: 0.14 },
      { transform: `translateY(-22px) scale(.92, 1.12) rotate(${rnd(-7, 7)}deg)`, offset: 0.45 },
      { transform: `translateY(4px) scale(1.04, .96)`, offset: 0.75 },
      { transform: 'none' },
    ],
    { duration: 560, easing: 'ease-out' },
  );
  shake(5 + k * 3);
  ring(color, 2.2 + k * 0.4);
  const c = center();
  emit({ x: c.x, y: c.y - 10, n: 14 + k * 8, speed: [3, 7 + k * 2], angle: [-Math.PI * 0.95, -Math.PI * 0.05], color: [color, '#fff'], size: [1.5, 3], life: [25, 50], gravity: 0.2 });
}

/** La rareté monte d'un cran. */
function tierUp(id) {
  const t = TIERS[id];
  setTier(id);
  boxSfx.tierUp(id);
  stopHum();
  stopHum = boxSfx.hum(ORDER.indexOf(id));
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
  const cube = scene.querySelector('.cube');
  stopHum();
  boxSfx.open(id);
  cube.classList.add('open');
  cube.style.setProperty('--leak', '1');
  cube.querySelector('.cb-lid').animate(
    [{ transform: 'translate3d(0, -20px, 0)' }, { transform: `translate3d(${rnd(-60, 60)}px, -340px, -120px) rotateX(-160deg) rotateZ(${rnd(-40, 40)}deg)`, opacity: 0 }],
    { duration: 900, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' },
  );
  $('#bx-beam').animate([{ transform: 'translateX(-50%) scaleY(0)', opacity: 0 }, { transform: 'translateX(-50%) scaleY(1)', opacity: 1, offset: 0.3 }, { transform: 'translateX(-50%) scaleY(1.05)', opacity: 0 }], { duration: 1500, easing: 'ease-out' });
  flash('#fff', 0.9, 700);
  shake(12 + lvl * 4, 500);
  ring(t.color, 6);
  const c = center();
  emit({ x: c.x, y: c.y, n: 70 + lvl * 40, speed: [5, 16 + lvl * 3], color: [t.color, '#fff', t.color], size: [2, 4], life: [40, 90], gravity: 0.15 });
  emit({ x: c.x, y: c.y - 20, n: 30 + lvl * 20, speed: [2, 8], angle: [-Math.PI * 0.85, -Math.PI * 0.15], color: [t.color, '#fff'], kind: 'star', size: [2, 5], life: [60, 110], gravity: -0.02, drag: 0.96 });
  if (lvl >= 2) {
    const conf = ['#ff5fa2', '#ffd84a', '#3cf2a3', '#4fa8ff', '#b26bff'];
    emit({ x: innerWidth / 2, y: -10, n: 90 + lvl * 30, speed: [1, 5], angle: [Math.PI * 0.2, Math.PI * 0.8], color: conf, kind: 'confetti', size: [3, 6], life: [120, 200], gravity: 0.08, drag: 0.99 });
  }
  cube.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(60px) scale(.7)', opacity: 0 }], { duration: 650, delay: 250, easing: 'ease-in', fill: 'forwards' });
  await wait(520);
}

async function doOpen(key, fake = null) {
  if (opening) return;
  opening = true;
  sizeCanvas();
  demoCtl?.stop();
  demoCtl = null;
  result.hidden = true;
  result.innerHTML = '';
  scene.hidden = false;
  scene.innerHTML = `${cubeHTML('stage-cube')}<i class="bx-beam" id="bx-beam"></i>`;
  $('#bx-hint').hidden = true;
  stage.style.setProperty('--c', '#8f6bff'); // la box éteinte, violette
  stage.dataset.level = '-1';
  stage.hidden = false;
  document.body.classList.add('bx-opening');

  let res;
  try {
    // Le tirage est fait et enregistré tout de suite (une box ne s'ouvre qu'une fois) ; la suite est le spectacle
    [res] = await Promise.all([fake || openBox(uid, key, state), reduce ? null : landing()]);
  } catch (e) {
    closeStage();
    opening = false;
    toast(escapeHtml(e.message || 'Impossible d’ouvrir la box pour l’instant.'), { cls: 'error' });
    return;
  }
  const target = ORDER.indexOf(res.rarity);
  if (!reduce) {
    stopHum = boxSfx.hum(0);
    const hint = $('#bx-hint');
    hint.hidden = false;
    // Coups : le 1er allume la box ; chaque coup suivant peut monter d'un cran ; le dernier l'ouvre
    for (let k = 0; k <= target + 1; k++) {
      await waitTap(k === 0 ? 2200 : 1500);
      if (k === 0) {
        hint.textContent = 'Encore !';
        setTier('commun');
      }
      hit(k, TIERS[ORDER[Math.min(k, target)]].color);
      if (k === target + 1) break;
      if (k >= 1) {
        await wait(220);
        tierUp(ORDER[k]);
      }
    }
    hint.hidden = true;
    hint.textContent = 'Touche la box !';
    await wait(200);
    await burstOpen(res.rarity);
  } else {
    setTier(res.rarity);
  }
  scene.hidden = true;
  await reveal(res);
  opening = false;
}

/** La box arrive : elle tombe en tournant et rebondit. */
async function landing() {
  const cube = scene.querySelector('.cube');
  boxSfx.land();
  await cube.animate(
    [
      { transform: 'translateY(-110vh) rotate(-25deg) scale(.6)', opacity: 0 },
      { transform: 'translateY(0) rotate(4deg) scale(1.08, .86)', opacity: 1, offset: 0.62 },
      { transform: 'translateY(-26px) rotate(-2deg) scale(.96, 1.06)', offset: 0.8 },
      { transform: 'none' },
    ],
    { duration: 720, easing: 'cubic-bezier(.5,0,.4,1)' },
  ).finished;
  shake(6);
  const c = center();
  emit({ x: c.x, y: c.y + 60, n: 24, speed: [2, 6], angle: [Math.PI * 0.9, Math.PI * 1.1], color: '#b9a8ff', size: [1.5, 3], life: [20, 40], gravity: 0.1 });
  emit({ x: c.x, y: c.y + 60, n: 24, speed: [2, 6], angle: [-Math.PI * 0.1, Math.PI * 0.1], color: '#b9a8ff', size: [1.5, 3], life: [20, 40], gravity: 0.1 });
}

/** La carte de l'objet gagné. */
async function reveal(res) {
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
    : `<p class="bx-dup">${p.rarity === 'commun' ? 'Tu l’as depuis le début' : 'Déjà obtenu'} : <b class="bx-dust-gain">+<span>0</span> ✨</b></p>`;
  result.style.setProperty('--c', t.color);
  result.className = `bx-result tier-${res.rarity}${ORDER.indexOf(res.rarity) >= 2 ? ' foil' : ''}${isNew ? ' is-new' : ' is-dup'}`;
  result.innerHTML = `<div class="bx-card3d">
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
  result.hidden = false;
  boxSfx.reveal(res.rarity, isNew);
  if (!reduce) {
    // La carte sort de la box en tournant (dos de la carte, puis face)
    await result.querySelector('.bx-card3d').animate(
      [
        { transform: 'translateY(90px) scale(.3) rotateY(540deg)', opacity: 0 },
        { transform: 'translateY(-10px) scale(1.06) rotateY(-12deg)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)' },
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
}

// Carte holographique : elle penche vers la souris et un reflet la suit
result.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.bx-card3d');
  if (!card || reduce || e.pointerType === 'touch') return;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
  card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
  card.style.setProperty('--mx', `${x * 100}%`);
  card.style.setProperty('--my', `${y * 100}%`);
});
result.addEventListener('pointerleave', () => {
  const card = result.querySelector('.bx-card3d');
  card?.style.setProperty('--rx', '0deg');
  card?.style.setProperty('--ry', '0deg');
});

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
  const demo = e.target.closest('[data-demo]');
  if (demo) return demoCtl?.play(demo.dataset.demo, 250);
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
// bxDemo('epique', 'ocean', 'N') ; bxDemo('jeu', 'japon') ; bxDemo('rare', 'western', 'endAnim', false)
if (location.hostname === 'localhost') {
  window.bxDemo = (rarity = 'rare', pack = 'japon', slot = 'N', isNew = true) => {
    const slots = rarity === 'jeu' ? [...PIECE_TYPES] : [slot];
    return doOpen(null, { rarity, pack, slots, fresh: isNew ? slots : [], dust: isNew ? 0 : { commun: 1, rare: 3, epique: 6, jeu: 20 }[rarity] });
  };
}
// box.html?demo=epique,ocean,N : la lance au chargement
const demoArg = location.hostname === 'localhost' && new URLSearchParams(location.search).get('demo');
if (demoArg) {
  const [r, p, sl, n] = demoArg.split(',');
  setTimeout(() => window.bxDemo(r, p, sl, n !== 'old'), 300);
}

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
