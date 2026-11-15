// Effets visuels des coups : prises, échec, échec et mat.
// Tout passe par l'API Web Animations : rien ne reste dans la page une fois l'effet terminé.
// L'inventaire (js/theme.js) choisit la variante : « astrea » (éclats, confettis), « classic » (sobre)
// ou « royal » (comme Astrea, avec des particules dorées pour les pièces noires et crème pour les blanches).
import { playSound } from './sound.js';
import { getEquip } from './theme.js';

const ROLE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const COLOR = { w: 'white', b: 'black' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const FILES = 'abcdefgh';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Pack Royal : or pour les pièces noires, crème pour les blanches
const ROYAL = {
  b: ['#ffe28a', '#f0d88f', '#d29a1e', '#b47b16'],
  w: ['#fffaf0', '#f7eed6', '#f3e6c4', '#ffffff'],
  glow: { b: 'rgba(255, 210, 110, .95)', w: 'rgba(255, 246, 220, .95)' },
};

/**
 * @param {HTMLElement} frame  conteneur .board-frame de l'échiquier
 * @param {() => 'w'|'b'} getOrientation
 */
export function createFx(frame, getOrientation) {
  const under = layer('fx-layer fx-under'); // sous les pièces (pièce prise qui disparaît)
  const over = layer('fx-layer fx-over'); // au-dessus (éclats, ondes, texte)
  let generation = 0; // pour annuler les effets en attente lors d'une nouvelle partie

  function layer(cls) {
    const d = document.createElement('div');
    d.className = cls;
    frame.appendChild(d);
    return d;
  }

  function el(parent, cls, style = {}, html = '') {
    const d = document.createElement('div');
    d.className = cls;
    Object.assign(d.style, style);
    if (html) d.innerHTML = html;
    parent.appendChild(d);
    return d;
  }

  const once = (node, keyframes, opts) => {
    const anim = node.animate(keyframes, opts);
    anim.finished.then(() => node.remove(), () => node.remove());
    return anim;
  };

  /** Centre d'une case et taille d'une case, en pixels dans le cadre. */
  function at(sq) {
    const s = frame.clientWidth / 8;
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    const white = getOrientation() === 'w';
    return { x: ((white ? f : 7 - f) + 0.5) * s, y: ((white ? 7 - r : r) + 0.5) * s, s };
  }

  function shake(power, duration = 380) {
    if (reduceMotion() || power <= 0) return;
    const frames = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const k = power * (1 - i / n);
      frames.push({ transform: i === n ? 'none' : `translate(${rand(-k, k).toFixed(1)}px, ${rand(-k, k).toFixed(1)}px) rotate(${rand(-k, k) * 0.08}deg)` });
    }
    frame.animate(frames, { duration, easing: 'linear' });
  }

  function ring(sq, { color = 'rgba(185,166,255,.95)', delay = 0, size = 1.5, width = 0.05, duration = 520 } = {}) {
    const { x, y, s } = at(sq);
    const d = el(over, 'fx-ring', { left: `${x}px`, top: `${y}px`, width: `${s}px`, height: `${s}px`, borderWidth: `${Math.max(2, s * width)}px`, borderColor: color });
    once(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(.25)', opacity: 0.95 },
        { transform: `translate(-50%,-50%) scale(${size})`, opacity: 0 },
      ],
      { duration, delay, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'backwards' },
    );
  }

  function flashSquare(sq, color, delay = 0, duration = 300) {
    const { x, y, s } = at(sq);
    const d = el(over, 'fx-flash', { left: `${x}px`, top: `${y}px`, width: `${s * 1.4}px`, height: `${s * 1.4}px`, background: `radial-gradient(circle, ${color} 0%, transparent 65%)` });
    once(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.9 },
        { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 },
      ],
      { duration, delay, easing: 'ease-out', fill: 'backwards' },
    );
  }

  /** Éclats qui partent dans tous les sens depuis une case. */
  function shards(sq, { count = 12, colors, spread = [0.45, 1.1], size = [0.06, 0.12], delay = 0, gravity = 0.35, duration = [520, 760] } = {}) {
    if (reduceMotion()) return;
    const { x, y, s } = at(sq);
    for (let i = 0; i < count; i++) {
      const w = s * rand(size[0], size[1]);
      const h = w * rand(0.6, 1.4);
      const d = el(over, 'fx-shard', { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, background: pick(colors) });
      const ang = rand(0, Math.PI * 2);
      const dist = s * rand(spread[0], spread[1]);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const rot = rand(-540, 540);
      once(
        d,
        [
          { transform: 'translate(-50%,-50%) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.75}px), calc(-50% + ${dy * 0.75}px)) rotate(${rot * 0.6}deg) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + s * gravity}px)) rotate(${rot}deg) scale(.4)`, opacity: 0 },
        ],
        { duration: rand(duration[0], duration[1]), delay, easing: 'cubic-bezier(.12,.75,.35,1)', fill: 'backwards' },
      );
    }
  }

  /** Particules du pack Royal : petites lueurs qui jaillissent, flottent vers le haut et scintillent. */
  function motes(sq, side, { count = 16, delay = 0, spread = 1, rise = 1 } = {}) {
    if (reduceMotion()) return;
    const { x, y, s } = at(sq);
    const colors = ROYAL[side];
    for (let i = 0; i < count; i++) {
      const r = s * rand(0.035, 0.085);
      const c = pick(colors);
      const d = el(over, 'fx-mote', { left: `${x}px`, top: `${y}px`, width: `${r}px`, height: `${r}px`, background: c, boxShadow: `0 0 ${r * 1.6}px ${r * 0.5}px ${ROYAL.glow[side]}` });
      const ang = rand(0, Math.PI * 2);
      const dist = s * rand(0.25, 0.85) * spread;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist * 0.6;
      const up = -s * rand(0.5, 1.3) * rise;
      once(
        d,
        [
          { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) scale(1.15)`, opacity: 1, offset: 0.18 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + up * 0.55}px)) scale(.8)`, opacity: 0.55, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + up * 0.75}px)) scale(1)`, opacity: 0.9, offset: 0.7 },
          { transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + up}px)) scale(.3)`, opacity: 0 },
        ],
        { duration: rand(900, 1500), delay: delay + rand(0, 120), easing: 'cubic-bezier(.2,.7,.35,1)', fill: 'backwards' },
      );
    }
  }

  // -------------------------------------------------------------------------
  // Prise
  // -------------------------------------------------------------------------
  function captureFx(move, royal = false) {
    // En passant : le pion pris n'est pas sur la case d'arrivée
    const sq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const victim = move.color === 'w' ? 'b' : 'w';
    const { x, y, s } = at(sq);
    const value = VALUE[move.captured] || 1;
    const impact = 130; // moment où la pièce qui prend arrive sur la case

    // La pièce prise reste un instant, puis éclate
    const ghost = el(under, 'cg-wrap fx-ghost', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="${ROLE[move.captured]} ${COLOR[victim]}"></piece>`);
    const tilt = rand(-28, 28);
    once(
      ghost,
      [
        { transform: 'scale(1) rotate(0deg)', opacity: 1, filter: 'brightness(1)' },
        { transform: 'scale(1) rotate(0deg)', opacity: 1, filter: 'brightness(1)', offset: 0.22 },
        { transform: `scale(1.22) rotate(${tilt}deg) translateY(-8%)`, opacity: 0, filter: 'brightness(2.2) blur(2px)' },
      ],
      { duration: 560, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );

    const pieceColors = royal ? ROYAL[victim] : victim === 'w' ? ['#fbf8ee', '#e9e4d3', '#ffffff'] : ['#2b2b29', '#45443f', '#151514'];
    const accents = royal ? ['#f0d88f', '#ffffff'] : ['#b9a6ff', '#3cf2a3'];
    flashSquare(sq, royal ? ROYAL.glow[victim] : 'rgba(225,215,255,.9)', impact, 280);
    shards(sq, { count: 8 + value * 2, colors: [...pieceColors, ...pieceColors, ...accents], delay: impact });
    ring(sq, { delay: impact, size: 1.2 + value * 0.06, duration: 460, ...(royal ? { color: 'rgba(240,216,143,.95)' } : {}) });
    if (royal) motes(sq, victim, { count: 10 + value * 2, delay: impact });
    if (value >= 5) ring(sq, { delay: impact + 90, size: 1.9, width: 0.03, color: 'rgba(255,255,255,.6)', duration: 600 });
    setTimeout(() => shake(value >= 9 ? 4.5 : value >= 5 ? 3 : value >= 3 ? 1.6 : 0, 300), impact);
  }

  /** Prise « Classic » : la pièce prise s'efface rapidement, sans éclats ni secousse. */
  function classicCaptureFx(move) {
    const sq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const victim = move.color === 'w' ? 'b' : 'w';
    const { x, y, s } = at(sq);
    const ghost = el(under, 'cg-wrap fx-ghost', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="${ROLE[move.captured]} ${COLOR[victim]}"></piece>`);
    once(
      ghost,
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1, offset: 0.35 },
        { transform: 'scale(.88)', opacity: 0 },
      ],
      { duration: 300, easing: 'ease-out' },
    );
  }

  /** Échec « Classic » : un liseré rouge discret et une petite étiquette. */
  function classicCheckFx(kingSq) {
    const delay = 120;
    ring(kingSq, { color: 'rgba(200,40,30,.75)', delay, size: 1.35, width: 0.04, duration: 650 });
    const { x, y, s } = at(kingSq);
    const above = y - s * 0.75 > s * 0.3;
    const tag = el(over, 'fx-check-tag classic', { left: `${Math.min(Math.max(x, s * 0.9), frame.clientWidth - s * 0.9)}px`, top: `${above ? y - s * 0.7 : y + s * 0.7}px`, fontSize: `${Math.max(12, s * 0.24)}px` }, 'Échec');
    once(
      tag,
      [
        { opacity: 0, transform: 'translate(-50%,-40%)' },
        { opacity: 1, transform: 'translate(-50%,-50%)', offset: 0.15 },
        { opacity: 1, transform: 'translate(-50%,-50%)', offset: 0.8 },
        { opacity: 0, transform: 'translate(-50%,-50%)' },
      ],
      { duration: 1200, delay, easing: 'ease-out', fill: 'backwards' },
    );
  }

  /** Mat « Classic » : le roi se couche lentement, l'échiquier s'assombrit, un titre sobre apparaît. */
  async function classicMateFx(move, kingSq, loser, outcome, gen) {
    const { x, y, s } = at(kingSq);
    const W = frame.clientWidth;
    const calm = reduceMotion();
    await wait(160);
    if (gen !== generation) return;
    frame.classList.add('mated-' + loser);
    const king = el(over, 'cg-wrap fx-king', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="king ${COLOR[loser]}"></piece>`);
    let dir = FILES.indexOf(move.to[0]) < FILES.indexOf(kingSq[0]) ? 1 : -1;
    if (getOrientation() === 'b') dir = -dir;
    king.animate(
      calm
        ? [{ filter: 'none' }, { filter: 'grayscale(.6) brightness(.8)' }]
        : [
            { transform: 'rotate(0deg)', filter: 'none' },
            { transform: `translateY(12%) rotate(${dir * 90}deg)`, filter: 'brightness(.85) drop-shadow(0 3px 4px rgba(0,0,0,.45))' },
          ],
      { duration: 1100, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' },
    );
    const vignette = el(over, 'fx-vignette');
    vignette.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: 'forwards' });
    setTimeout(() => {
      if (gen !== generation) return;
      const sub = outcome === 'win' ? 'Victoire' : outcome === 'loss' ? 'Défaite' : `${loser === 'w' ? 'Les Noirs' : 'Les Blancs'} gagnent`;
      const banner = el(over, 'fx-mate-banner classic ' + outcome, { fontSize: `${Math.max(26, W * 0.1)}px` }, `<div class="t">Échec et mat</div><div class="rule"></div><div class="s">${sub}</div>`);
      banner.animate([{ opacity: 0, transform: 'translateY(4%)' }, { opacity: 1, transform: 'none' }], { duration: calm ? 200 : 800, easing: 'ease-out', fill: 'both' });
      setTimeout(() => {
        if (gen !== generation) return;
        once(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
        once(vignette, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
      }, 4200);
    }, 700);
  }

  // -------------------------------------------------------------------------
  // Échec
  // -------------------------------------------------------------------------
  function checkFx(kingSq) {
    const delay = 140;
    ring(kingSq, { color: 'rgba(235,70,60,.95)', delay, size: 1.7, width: 0.06, duration: 620 });
    ring(kingSq, { color: 'rgba(255,120,100,.8)', delay: delay + 160, size: 2.2, width: 0.035, duration: 700 });
    flashSquare(kingSq, 'rgba(255,60,50,.8)', delay, 450);
    setTimeout(() => shake(3, 280), delay);

    // Étiquette « Échec ! » au-dessus du roi
    const { x, y, s } = at(kingSq);
    const above = y - s * 0.75 > s * 0.3;
    const tag = el(over, 'fx-check-tag', { left: `${Math.min(Math.max(x, s * 0.9), frame.clientWidth - s * 0.9)}px`, top: `${above ? y - s * 0.72 : y + s * 0.72}px`, fontSize: `${Math.max(12, s * 0.26)}px` }, 'Échec !');
    once(
      tag,
      [
        { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.18)', opacity: 1, offset: 0.14 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.24 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.78 },
        { transform: `translate(-50%, calc(-50% - ${s * 0.25}px)) scale(.9)`, opacity: 0 },
      ],
      { duration: 1300, delay, easing: 'ease-out', fill: 'backwards' },
    );
  }

  // -------------------------------------------------------------------------
  // Échec et mat
  // -------------------------------------------------------------------------
  async function mateFx(move, kingSq, loser, outcome, gen, royal = false) {
    const { x, y, s } = at(kingSq);
    const W = frame.clientWidth;
    const calm = reduceMotion();
    await wait(140);
    if (gen !== generation) return;

    // Flash blanc sur tout l'échiquier
    const flash = el(over, 'fx-screen-flash');
    once(flash, [{ opacity: 0.75 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });

    // Le vrai roi est caché, un double vacille puis tombe
    frame.classList.add('mated-' + loser);
    const king = el(over, 'cg-wrap fx-king', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="king ${COLOR[loser]}"></piece>`);
    const attackerFile = FILES.indexOf(move.to[0]);
    const kingFile = FILES.indexOf(kingSq[0]);
    let dir = attackerFile === kingFile ? pick([-1, 1]) : attackerFile < kingFile ? 1 : -1; // tombe à l'opposé de l'attaquant
    if (getOrientation() === 'b') dir = -dir;
    if (calm) {
      king.animate([{ filter: 'none' }, { filter: 'grayscale(.7) brightness(.75)' }], { duration: 600, fill: 'forwards' });
    } else {
      king.animate(
        [
          { transform: 'rotate(0deg)', filter: 'none' },
          { transform: 'rotate(-11deg)', offset: 0.1 },
          { transform: 'rotate(9deg)', offset: 0.2 },
          { transform: 'rotate(-6deg)', offset: 0.3 },
          { transform: 'rotate(3deg)', offset: 0.38 },
          { transform: 'rotate(0deg)', offset: 0.44, easing: 'cubic-bezier(.55,0,.9,.5)' },
          { transform: `translateY(14%) rotate(${dir * 94}deg)`, offset: 0.78, easing: 'ease-out' },
          { transform: `translateY(10%) rotate(${dir * 82}deg)`, offset: 0.86, easing: 'ease-in' },
          { transform: `translateY(14%) rotate(${dir * 90}deg)`, filter: 'grayscale(.65) brightness(.72) drop-shadow(0 4px 6px rgba(0,0,0,.5))' },
        ],
        { duration: 1500, fill: 'forwards' },
      );
    }

    // Ondes de choc et secousse
    ring(kingSq, { color: 'rgba(235,70,60,1)', size: 2.4, width: 0.07, duration: 700 });
    ring(kingSq, { color: royal ? 'rgba(240,216,143,.95)' : 'rgba(143,107,255,.95)', delay: 120, size: 4, width: 0.05, duration: 900 });
    ring(kingSq, { color: royal ? 'rgba(255,246,220,.85)' : 'rgba(60,242,163,.8)', delay: 200, size: 5, width: 0.03, duration: 1000 });
    ring(kingSq, { color: 'rgba(255,255,255,.7)', delay: 260, size: 6, width: 0.03, duration: 1100 });
    flashSquare(kingSq, 'rgba(255,60,50,.95)', 0, 700);
    shake(10, 750);

    // Assombrissement autour de l'échiquier
    const vignette = el(over, 'fx-vignette');
    vignette.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: 'forwards' });

    // Explosion : confettis pour une victoire, éclats sombres pour une défaite
    setTimeout(() => {
      if (gen !== generation || calm) return;
      const winColors = royal ? [...ROYAL.b, ...ROYAL.w] : ['#8f6bff', '#b9a6ff', '#cdbeff', '#3cf2a3', '#ffffff', '#ff8a95'];
      const lossColors = ['#2b2b29', '#45443f', '#8a1f17', '#e0584c', '#6b6a63'];
      const colors = outcome === 'loss' ? lossColors : winColors;
      confetti(x, y, s, W, colors, outcome === 'loss' ? 45 : 90);
      shards(kingSq, { count: 18, colors: royal ? ROYAL[loser] : loser === 'w' ? ['#fbf8ee', '#e9e4d3'] : ['#2b2b29', '#45443f'], spread: [0.6, 1.6], delay: 0 });
      if (royal) {
        motes(kingSq, loser, { count: 26, spread: 1.8, rise: 1.6 });
        motes(kingSq, loser === 'w' ? 'b' : 'w', { count: 22, spread: 2.4, rise: 2, delay: 180 });
      }
    }, 380);

    // Grand titre
    setTimeout(() => {
      if (gen !== generation) return;
      const sub = outcome === 'win' ? 'Victoire !' : outcome === 'loss' ? 'Défaite' : `${loser === 'w' ? 'Les Noirs' : 'Les Blancs'} gagnent`;
      const banner = el(over, 'fx-mate-banner ' + outcome, { fontSize: `${Math.max(26, W * 0.105)}px` }, `<div class="t">Échec et mat</div><div class="s">${sub}</div>`);
      const t = banner.querySelector('.t');
      const sb = banner.querySelector('.s');
      t.animate(
        [
          { transform: 'scale(2.8)', opacity: 0, filter: 'blur(14px)', letterSpacing: '.3em' },
          { transform: 'scale(.9)', opacity: 1, filter: 'blur(0)', letterSpacing: '0em', offset: 0.6 },
          { transform: 'scale(1.04)', offset: 0.8 },
          { transform: 'scale(1)', opacity: 1, filter: 'blur(0)', letterSpacing: '0em' },
        ],
        { duration: calm ? 300 : 650, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      );
      if (!calm) setTimeout(() => shake(6, 380), 390);
      sb.animate([{ opacity: 0, transform: 'translateY(30%)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: 420, easing: 'ease-out', fill: 'both' });
      // Le titre et l'assombrissement s'effacent après quelques secondes
      setTimeout(() => {
        if (gen !== generation) return;
        once(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
        once(vignette, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
      }, 4200);
    }, 520);
  }

  function confetti(x, y, s, W, colors, count) {
    for (let i = 0; i < count; i++) {
      const w = rand(5, 10) * (W / 600);
      const d = el(over, 'fx-confetti', { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${w * rand(1.2, 2.2)}px`, background: pick(colors), borderRadius: Math.random() < 0.3 ? '50%' : '2px' });
      const dx = rand(-4.5, 4.5) * s;
      const up = -rand(1.5, 5) * s;
      const fall = rand(3, 7) * s;
      const rot = rand(-900, 900);
      once(
        d,
        [
          { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.1,.7,.35,1)' },
          { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${up}px)) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.35, easing: 'cubic-bezier(.45,0,.9,.6)' },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${up + fall}px)) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: rand(1700, 2700), delay: rand(0, 120), fill: 'backwards' },
      );
    }
  }

  // -------------------------------------------------------------------------
  // API
  // -------------------------------------------------------------------------
  function kingSquare(chess, color) {
    const rows = chess.board();
    for (const row of rows) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
    return null;
  }

  return {
    /**
     * Joue le son et les effets d'un coup.
     * @param move   coup « verbose » de chess.js
     * @param chess  partie APRÈS le coup
     * @param opts   { visual: bool, me: 'w'|'b'|null, style: { capture, endAnim } (aperçus de l'inventaire) }
     */
    move(move, chess, { visual = true, me = null, style = null } = {}) {
      if (!move) return;
      const eq = { ...getEquip(), ...(style || {}) };
      const classicEnd = eq.endAnim === 'classic';
      const mated = move.san.includes('#');
      const loser = chess.turn();
      const outcome = !mated ? 'neutral' : !me ? 'neutral' : loser === me ? 'loss' : 'win';
      playSound(move, outcome, eq);
      if (!visual) return;
      const gen = generation;
      if (move.captured) eq.capture === 'classic' ? classicCaptureFx(move) : captureFx(move, eq.capture === 'royal');
      const kSq = move.san.includes('+') || mated ? kingSquare(chess, loser) : null;
      if (mated && kSq) classicEnd ? classicMateFx(move, kSq, loser, outcome, gen) : mateFx(move, kSq, loser, outcome, gen, eq.endAnim === 'royal');
      else if (kSq) (classicEnd ? classicCheckFx : checkFx)(kSq);
    },
    /** Efface tout (nouvelle partie). */
    reset() {
      generation++;
      under.innerHTML = '';
      over.innerHTML = '';
      frame.classList.remove('mated-w', 'mated-b');
      frame.getAnimations().forEach((a) => a.cancel());
    },
    /** Masque les effets persistants (roi tombé) quand on revoit un coup passé. */
    setPaused(paused) {
      frame.classList.toggle('fx-paused', paused);
    },
  };
}
