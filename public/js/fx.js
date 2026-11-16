// Effets visuels des coups : prises, échec, échec et mat.
// Tout passe par l'API Web Animations : rien ne reste dans la page une fois l'effet terminé.
// L'inventaire (js/theme.js) choisit la variante : « astrea » (espace), « classic » (sobre), « royal » (couronnement,
// particules d'or), « japon » (Sakura : coup de sabre, pétales de cerisier, soleil rouge, sceaux 勝 / 負)
// « western » (coups de feu, viseur, virevoltant, pancarte de saloon) ou « ocean » (siphon, aileron, baleine, kraken).
import { playSound } from './sound.js';
import { getEquip } from './theme.js';

const ROLE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const COLOR = { w: 'white', b: 'black' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const FILES = 'abcdefgh';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Téléphone et tablette : moins de particules et pas de lueur floutée sur chacune (sinon ça saccade)
const LITE = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const lite = (n) => (LITE ? Math.ceil(n * 0.55) : n);
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
  /** Centre d'une case, en pixels dans le cadre. On mesure l'échiquier réel (cg-board) : Chessground arrondit
   *  sa taille à un nombre entier de pixels par case, il peut donc être un peu plus petit que le cadre. */
  function at(sq) {
    const fr = frame.getBoundingClientRect();
    const board = frame.querySelector('cg-board');
    const br = board ? board.getBoundingClientRect() : fr;
    const s = br.width / 8;
    const ox = br.left - fr.left;
    const oy = br.top - fr.top;
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    const white = getOrientation() === 'w';
    return { x: ox + ((white ? f : 7 - f) + 0.5) * s, y: oy + ((white ? 7 - r : r) + 0.5) * s, s };
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
    for (let i = 0, n = lite(count); i < n; i++) {
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
    for (let i = 0, n = lite(count); i < n; i++) {
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
  // -------------------------------------------------------------------------
  // Échec et mat « Royal » : le Couronnement
  //  lumière dorée, le roi vaincu s'incline et se pétrifie, sa couronne s'envole et se pose sur le roi vainqueur,
  //  rayons d'or derrière lui, poussière d'or qui tombe, titre de cérémonie. (Le son reste celui de base.)
  // -------------------------------------------------------------------------
  let crownId = 0;
  function crownSvg() {
    const id = 'fx-crown-' + ++crownId;
    return `<svg viewBox="0 0 100 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#f0c75a"/><stop offset="1" stop-color="#a8740f"/></linearGradient></defs>
      <g stroke="#5a3b0a" stroke-width="3" stroke-linejoin="round">
        <path d="M10 56 L5 20 L29 39 L50 9 L71 39 L95 20 L90 56 Z" fill="url(#${id})"/>
        <rect x="9" y="54" width="82" height="12" rx="2.5" fill="url(#${id})"/>
        <circle cx="50" cy="9" r="5.5" fill="#fff8e2" stroke-width="2"/>
        <circle cx="5" cy="20" r="4.2" fill="#fff8e2" stroke-width="2"/>
        <circle cx="95" cy="20" r="4.2" fill="#fff8e2" stroke-width="2"/>
        <path d="M50 37 L55 44 L50 51 L45 44 Z" fill="#a01d33" stroke-width="2"/>
        <circle cx="30" cy="60" r="3.4" fill="#24589c" stroke-width="1.6"/>
        <circle cx="50" cy="60" r="3.8" fill="#a01d33" stroke-width="1.6"/>
        <circle cx="70" cy="60" r="3.4" fill="#24589c" stroke-width="1.6"/>
      </g></svg>`;
  }

  /** Poussière d'or qui tombe doucement sur tout l'échiquier. */
  function goldDust(count, gen) {
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    for (let i = 0, n = lite(count); i < n; i++) {
      const side = Math.random() < 0.6 ? 'b' : 'w';
      const r = rand(2, 4.5) * (W / 520);
      const d = el(over, 'fx-mote', { left: `${rand(0, W)}px`, top: `${-10}px`, width: `${r}px`, height: `${r}px`, background: pick(ROYAL[side]), boxShadow: `0 0 ${r * 2}px ${r * 0.6}px ${ROYAL.glow[side]}` });
      const fall = H * rand(0.55, 1.05);
      const sway = rand(-0.08, 0.08) * W;
      once(
        d,
        [
          { transform: 'translate(-50%,0) scale(.6)', opacity: 0 },
          { transform: `translate(calc(-50% + ${sway * 0.4}px), ${fall * 0.25}px) scale(1)`, opacity: 1, offset: 0.2 },
          { transform: `translate(calc(-50% - ${sway * 0.3}px), ${fall * 0.65}px) scale(.9)`, opacity: 0.85, offset: 0.65 },
          { transform: `translate(calc(-50% + ${sway}px), ${fall}px) scale(.5)`, opacity: 0 },
        ],
        { duration: rand(2400, 3800), delay: rand(0, 1600), easing: 'linear', fill: 'backwards' },
      );
    }
  }

  async function royalMateFx(move, kingSq, winnerSq, loser, outcome, gen) {
    const { x, y, s } = at(kingSq);
    const W = frame.clientWidth;
    const calm = reduceMotion();
    await wait(140);
    if (gen !== generation) return;

    // Lumière dorée et assombrissement chaud autour de l'échiquier
    const glow = el(over, 'fx-screen-flash fx-royal-light');
    once(glow, [{ opacity: 0 }, { opacity: 0.55, offset: 0.25 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
    const vignette = el(over, 'fx-vignette fx-royal-vignette');
    vignette.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1100, fill: 'forwards' });

    // Le roi vaincu s'incline lentement et se pétrifie
    frame.classList.add('mated-' + loser);
    const king = el(over, 'cg-wrap fx-king', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="king ${COLOR[loser]}"></piece>`);
    let dir = FILES.indexOf(move.to[0]) <= FILES.indexOf(kingSq[0]) ? 1 : -1;
    if (getOrientation() === 'b') dir = -dir;
    king.animate(
      calm
        ? [{ filter: 'none' }, { filter: 'grayscale(1) sepia(.35) brightness(.7)' }]
        : [
            { transform: 'rotate(0deg) translateY(0)', filter: 'none' },
            { transform: `rotate(${dir * -4}deg) translateY(-3%)`, filter: 'brightness(1.25)', offset: 0.18 },
            { transform: `rotate(${dir * 18}deg) translateY(2%)`, offset: 0.45 },
            { transform: `rotate(${dir * 74}deg) translateY(12%)`, filter: 'grayscale(1) sepia(.35) brightness(.7) drop-shadow(0 4px 6px rgba(0,0,0,.55))' },
          ],
      { duration: calm ? 700 : 2200, delay: calm ? 0 : 900, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' },
    );
    ring(kingSq, { color: 'rgba(240,216,143,.95)', size: 2.2, width: 0.04, duration: 1100 });

    // Sa couronne s'envole et va couronner le roi vainqueur
    if (!calm && winnerSq) {
      const w = at(winnerSq);
      // Couronne posée SUR la tête du roi vainqueur (elle recouvre le haut de la pièce, comme portée)
      const cw = s * 0.44;
      const HEAD = 0.38; // centre de la couronne, au-dessus du centre de la case (en fraction de case)
      const crown = el(over, 'fx-crown', { left: `${x}px`, top: `${y - s * HEAD}px`, width: `${cw}px`, height: `${cw * 0.72}px` }, crownSvg());
      const dx = w.x - x;
      const dy = w.y - y;
      const peak = -Math.max(s * 1.6, Math.abs(dx) * 0.35);
      crown.animate(
        [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(.2) rotate(0deg)', opacity: 0 },
          { transform: 'translate(-50%,-50%) translate(0,-6%) scale(1) rotate(-6deg)', opacity: 1, offset: 0.14 },
          { transform: `translate(-50%,-50%) translate(0px, ${-s * 0.5}px) scale(1.15) rotate(4deg)`, offset: 0.28 },
          { transform: `translate(-50%,-50%) translate(${dx * 0.5}px, ${dy * 0.5 + peak}px) scale(1.3) rotate(${dx > 0 ? 8 : -8}deg)`, offset: 0.6 },
          { transform: `translate(-50%,-50%) translate(${dx}px, ${dy - s * 0.22}px) scale(1.05) rotate(0deg)`, offset: 0.86 },
          { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1) rotate(0deg)`, opacity: 1 },
        ],
        { duration: 2300, delay: 1100, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
      );
      // Éclat au moment où elle se pose, rayons d'or derrière le vainqueur
      setTimeout(() => {
        if (gen !== generation) return;
        flashSquare(winnerSq, 'rgba(255,230,160,.95)', 0, 600);
        ring(winnerSq, { color: 'rgba(255,230,160,.95)', size: 2.6, width: 0.035, duration: 1100 });
        motes(winnerSq, 'b', { count: 22, spread: 1.4, rise: 1.4 });
        const rays = el(under, 'fx-sunburst', { left: `${w.x}px`, top: `${w.y}px`, width: `${s * 5}px`, height: `${s * 5}px` });
        once(rays, [
          { transform: 'translate(-50%,-50%) rotate(0deg) scale(.4)', opacity: 0 },
          { transform: 'translate(-50%,-50%) rotate(14deg) scale(1)', opacity: 1, offset: 0.2 },
          { transform: 'translate(-50%,-50%) rotate(48deg) scale(1.05)', opacity: 0.85, offset: 0.8 },
          { transform: 'translate(-50%,-50%) rotate(60deg) scale(1.1)', opacity: 0 },
        ], { duration: 4800, easing: 'linear' });
        // La couronne disparaît avec le titre
        setTimeout(() => gen === generation && once(crown, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' }), 3600);
      }, 1100 + 2300);
    }
    if (!calm) setTimeout(() => gen === generation && goldDust(46, gen), 900);

    // Titre de cérémonie
    setTimeout(() => {
      if (gen !== generation) return;
      const sub = outcome === 'win' ? 'Victoire' : outcome === 'loss' ? 'Défaite' : `${loser === 'w' ? 'Les Noirs' : 'Les Blancs'} l’emportent`;
      const banner = el(over, 'fx-mate-banner royal ' + outcome, { fontSize: `${Math.max(24, W * 0.088)}px` },
        `<div class="orn">⚜</div><div class="t">Échec et mat</div><div class="rule"><i></i><b>◆</b><i></i></div><div class="s">${sub}</div>`);
      const parts = [...banner.children];
      parts.forEach((p, i) =>
        p.animate(
          [
            { opacity: 0, transform: 'translateY(18%)', letterSpacing: i === 1 ? '.4em' : 'normal', filter: 'blur(6px)' },
            { opacity: 1, transform: 'none', letterSpacing: i === 1 ? '.08em' : 'normal', filter: 'blur(0)' },
          ],
          { duration: calm ? 300 : 1100, delay: calm ? 0 : i * 180, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' },
        ),
      );
      setTimeout(() => {
        if (gen !== generation) return;
        once(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
        once(vignette, [{ opacity: 1 }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
      }, 5600);
    }, calm ? 300 : 700);
  }

  // -------------------------------------------------------------------------
  // Astrea (espace) : étoiles à 4 branches, trou de ver, supernova, trou noir
  // -------------------------------------------------------------------------
  const SPACE = ['#ffffff', '#e6e0fa', '#b9a6ff', '#8f6bff', '#3cf2a3', '#7fd8ff'];

  /** Petites étoiles à 4 branches qui jaillissent d'un point (avec une traînée). */
  function starBurst(x, y, s, { count = 14, colors = SPACE, spread = [0.5, 1.4], size = [0.09, 0.2], delay = 0, duration = [600, 1000] } = {}) {
    if (reduceMotion()) return;
    for (let i = 0, n = lite(count); i < n; i++) {
      const w = s * rand(size[0], size[1]);
      const c = pick(colors);
      const d = el(over, 'fx-star', { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${w}px`, background: c, filter: LITE ? 'none' : `drop-shadow(0 0 ${w * 0.5}px ${c})` });
      const ang = rand(0, Math.PI * 2);
      const dist = s * rand(spread[0], spread[1]);
      once(
        d,
        [
          { transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 0 },
          { transform: `translate(calc(-50% + ${Math.cos(ang) * dist * 0.35}px), calc(-50% + ${Math.sin(ang) * dist * 0.35}px)) scale(1.2) rotate(45deg)`, opacity: 1, offset: 0.2 },
          { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(.3) rotate(${rand(90, 200)}deg)`, opacity: 0 },
        ],
        { duration: rand(duration[0], duration[1]), delay: delay + rand(0, 80), easing: 'cubic-bezier(.15,.75,.3,1)', fill: 'backwards' },
      );
    }
  }

  /** Trou noir / trou de ver : disque sombre et anneau d'accrétion qui tourne. */
  function blackHole(x, y, size, { hot = false, delay = 0, life = 700 } = {}) {
    const d = el(over, 'fx-hole' + (hot ? ' hot' : ''), { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` });
    once(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(160deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-50%) scale(1.08) rotate(420deg)', opacity: 1, offset: 0.78 },
        { transform: 'translate(-50%,-50%) scale(0) rotate(620deg)', opacity: 0 },
      ],
      { duration: life, delay, easing: 'cubic-bezier(.35,.1,.3,1)', fill: 'backwards' },
    );
  }

  /** Une pièce aspirée en spirale (vers le centre de sa case). */
  function spiralIn(holder, { duration = 560, delay = 0 } = {}) {
    once(
      holder,
      [
        { transform: 'scale(1) rotate(0deg)', opacity: 1, filter: 'brightness(1)' },
        { transform: 'scale(.85) rotate(120deg) skewX(8deg)', opacity: 1, filter: 'brightness(1.6) hue-rotate(20deg)', offset: 0.35 },
        { transform: 'scale(.35) rotate(380deg) skewX(18deg)', opacity: 0.85, filter: 'brightness(2.4) hue-rotate(60deg) blur(1px)', offset: 0.75 },
        { transform: 'scale(0) rotate(560deg)', opacity: 0, filter: 'brightness(3) blur(2px)' },
      ],
      { duration, delay, easing: 'cubic-bezier(.5,0,.75,.5)', fill: 'both' },
    );
  }

  /** Prise « Astrea » : la pièce prise est aspirée par un petit trou de ver, qui se referme dans un éclat d'étoiles. */
  function spaceCaptureFx(move) {
    const sq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const victim = move.color === 'w' ? 'b' : 'w';
    const { x, y, s } = at(sq);
    const value = VALUE[move.captured] || 1;
    const impact = 120;
    const life = 520 + value * 30;
    if (reduceMotion()) {
      const g = el(under, 'cg-wrap fx-ghost', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="${ROLE[move.captured]} ${COLOR[victim]}"></piece>`);
      once(g, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
      return;
    }
    blackHole(x, y, s * (0.9 + value * 0.05), { delay: impact - 60, life });
    const ghost = el(over, 'cg-wrap fx-ghost', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="${ROLE[move.captured]} ${COLOR[victim]}"></piece>`);
    spiralIn(ghost, { duration: life * 0.8, delay: impact });
    const close = impact + life * 0.78;
    flashSquare(sq, 'rgba(230,220,255,.95)', close, 300);
    starBurst(x, y, s, { count: 7 + value * 2, delay: close, size: [0.13, 0.26], spread: [0.5, 1.6] });
    ring(sq, { delay: close, size: 1.3 + value * 0.06, width: 0.035, duration: 520, color: 'rgba(185,166,255,.9)' });
    if (value >= 5) ring(sq, { delay: close + 80, size: 2, width: 0.025, color: 'rgba(60,242,163,.7)', duration: 680 });
    if (value >= 3) setTimeout(() => shake(value >= 9 ? 3.5 : value >= 5 ? 2.2 : 1.2, 260), close);
  }

  /** Traînées d'hyperespace qui partent d'un point. */
  function warpStreaks(x, y, W, { count = 26, delay = 0 } = {}) {
    if (reduceMotion()) return;
    for (let i = 0, n = lite(count); i < n; i++) {
      const ang = rand(0, 360);
      const len = W * rand(0.12, 0.3);
      const d = el(over, 'fx-streak', { left: `${x}px`, top: `${y}px`, width: `${len}px`, transform: `rotate(${ang}deg)` });
      const d0 = W * rand(0.02, 0.1);
      const d1 = W * rand(0.6, 0.95);
      once(
        d,
        [
          { transform: `rotate(${ang}deg) translateX(${d0}px) scaleX(.1)`, opacity: 0 },
          { transform: `rotate(${ang}deg) translateX(${d0 + (d1 - d0) * 0.3}px) scaleX(1)`, opacity: 1, offset: 0.3 },
          { transform: `rotate(${ang}deg) translateX(${d1}px) scaleX(.4)`, opacity: 0 },
        ],
        { duration: rand(500, 800), delay: delay + rand(0, 260), easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'backwards' },
      );
    }
  }

  /** Onde de lumière qui traverse l'échiquier case par case, depuis une case. */
  function boardWave(fromSq, { colors = ['rgba(185,166,255,.55)', 'rgba(60,242,163,.45)'], step = 55, delay = 0 } = {}) {
    if (reduceMotion()) return;
    const f0 = FILES.indexOf(fromSq[0]);
    const r0 = Number(fromSq[1]) - 1;
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const sq = FILES[f] + (r + 1);
        const { x, y, s } = at(sq);
        const dist = Math.hypot(f - f0, r - r0);
        const d = el(under, 'fx-cell', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px`, background: colors[(f + r) % colors.length] });
        once(d, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 0, transform: 'scale(.92)' }], { duration: 620, delay: delay + dist * step, easing: 'ease-out', fill: 'backwards' });
      }
    }
  }

  /** Le roi vainqueur : halo cosmique et trois petites lunes en orbite. */
  function kingGlory(sq, gen, life = 4200) {
    if (reduceMotion() || !sq) return;
    const { x, y, s } = at(sq);
    const aura = el(under, 'fx-aura', { left: `${x}px`, top: `${y}px`, width: `${s * 2.4}px`, height: `${s * 2.4}px` });
    once(aura, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.15 }, { opacity: 0.8, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.85 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.2)' }], { duration: life, easing: 'ease-out' });
    const moons = [
      { r: 0.62, size: 0.13, color: '#3cf2a3', period: 1600, tilt: -18 },
      { r: 0.78, size: 0.1, color: '#b9a6ff', period: 2300, tilt: 22 },
      { r: 0.92, size: 0.08, color: '#7fd8ff', period: 3100, tilt: -4 },
    ];
    for (const m of moons) {
      // Une orbite = un anneau aplati qui tourne, la lune posée sur son bord
      const orbit = el(over, 'fx-moon-orbit', { left: `${x}px`, top: `${y}px`, width: `${s * m.r * 2}px`, height: `${s * m.r * 2}px`, transform: `translate(-50%,-50%) rotate(${m.tilt}deg) scale(1,.38)` });
      const spin = el(orbit, 'fx-moon-spin');
      el(spin, 'fx-moon', { width: `${s * m.size}px`, height: `${s * m.size / 0.38}px`, background: m.color, boxShadow: `0 0 ${s * 0.12}px ${m.color}` });
      spin.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: m.period, iterations: Infinity });
      once(orbit, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: life });
    }
  }

  /** Comète qui traverse l'échiquier en diagonale. */
  function comet({ delay = 0, fromLeft = true } = {}) {
    if (reduceMotion()) return;
    const W = frame.clientWidth;
    const y0 = W * rand(0.05, 0.35);
    const d = el(over, 'fx-comet', { left: `${fromLeft ? -W * 0.1 : W * 1.1}px`, top: `${y0}px`, width: `${W * 0.22}px` });
    const ang = fromLeft ? rand(14, 26) : 180 - rand(14, 26);
    const dist = W * 1.35;
    once(d, [
      { transform: `rotate(${ang}deg) translateX(0)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { transform: `rotate(${ang}deg) translateX(${dist}px)`, opacity: 0 },
    ], { duration: 1100, delay, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'backwards' });
  }

  /** Titre de fin « espace » : dégradé nébuleuse et petite planète en orbite autour. */
  function spaceBanner(outcome, loser, W, gen, calm, vignette, hold = 4800) {
    const sub = outcome === 'win' ? 'Victoire !' : outcome === 'loss' ? 'Défaite' : `${loser === 'w' ? 'Les Noirs' : 'Les Blancs'} gagnent`;
    const banner = el(over, 'fx-mate-banner space ' + outcome, { fontSize: `${Math.max(26, W * 0.1)}px` },
      `<div class="orbit"><span class="spin"><i></i></span></div><div class="t">Échec et mat</div><div class="s">${sub}</div>`);
    const t = banner.querySelector('.t');
    t.animate(
      [
        { opacity: 0, transform: 'scale(.6)', filter: 'blur(12px)', letterSpacing: '.35em' },
        { opacity: 1, transform: 'scale(1.06)', filter: 'blur(0)', letterSpacing: '.02em', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0)', letterSpacing: '.02em' },
      ],
      { duration: calm ? 300 : 900, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
    );
    banner.querySelector('.orbit').animate([{ opacity: 0, transform: 'rotate(-12deg) scale(.6, .18)' }, { opacity: 1, transform: 'rotate(-12deg) scale(1, .3)' }], { duration: 700, delay: 250, easing: 'ease-out', fill: 'both' });
    banner.querySelector('.s').animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 500, easing: 'ease-out', fill: 'both' });
    setTimeout(() => {
      if (gen !== generation) return;
      once(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: 'forwards' });
      once(vignette, [{ opacity: 1 }, { opacity: 0 }], { duration: 1000, fill: 'forwards' });
    }, hold);
  }

  /**
   * Échec et mat « Astrea » :
   *  - victoire (ou spectateur) : SUPERNOVA — hyperespace, le roi vaincu surchauffe et explose en nébuleuse d'étoiles ;
   *  - défaite : TROU NOIR — ton roi est aspiré par un trou noir.
   */
  async function spaceMateFx(move, kingSq, loser, outcome, gen, winnerSq = null) {
    const { x, y, s } = at(kingSq);
    const W = frame.clientWidth;
    const calm = reduceMotion();
    await wait(120);
    if (gen !== generation) return;
    const loss = outcome === 'loss';

    const vignette = el(over, 'fx-vignette fx-space-vignette' + (loss ? ' cold' : ''));
    vignette.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: 'forwards' });
    frame.classList.add('mated-' + loser);
    const king = el(over, 'cg-wrap fx-king', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="king ${COLOR[loser]}"></piece>`);

    if (calm) {
      king.animate([{ opacity: 1 }, { opacity: 0.25, filter: 'grayscale(1)' }], { duration: 600, fill: 'forwards' });
      setTimeout(() => gen === generation && spaceBanner(outcome, loser, W, gen, calm, vignette), 300);
      return;
    }

    if (loss) {
      // TROU NOIR : il grossit sous ton roi, qui tremble puis est aspiré en spirale
      king.style.zIndex = '4';
      blackHole(x, y, s * 2.6, { hot: true, delay: 100, life: 2300 });
      king.animate(
        [
          { transform: 'translate(0,0) rotate(0deg)' },
          { transform: 'translate(1px,-1px) rotate(-4deg)', offset: 0.1 },
          { transform: 'translate(-1px,1px) rotate(5deg)', offset: 0.2 },
          { transform: 'translate(1px,0) rotate(-3deg)', offset: 0.3 },
        ],
        { duration: 800, iterations: 1, easing: 'linear' },
      );
      spiralIn(king, { duration: 1300, delay: 700 });
      warpStreaks(x, y, W * 0.7, { count: 18, delay: 500 });
      // les traînées « tombent » vers le trou : on les inverse
      setTimeout(() => gen === generation && ring(kingSq, { color: 'rgba(255,90,110,.9)', size: 3.2, width: 0.04, duration: 900 }), 2000);
      setTimeout(() => gen === generation && starBurst(x, y, s, { count: 10, colors: ['#ff8a95', '#b9a6ff', '#ffffff'], spread: [0.3, 0.9] }), 2050);
      setTimeout(() => gen === generation && shake(4, 400), 2000);
      setTimeout(() => gen === generation && spaceBanner(outcome, loser, W, gen, calm, vignette), 1500);
      return;
    }

    // SUPERNOVA : hyperespace, le roi surchauffe, puis explose en nébuleuse
    warpStreaks(x, y, W, { count: 30 });
    king.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.06) translate(1px,0)', filter: 'brightness(1.8) drop-shadow(0 0 6px #b9a6ff)', offset: 0.4 },
        { transform: 'scale(1.12) translate(-1px,0)', filter: 'brightness(3) drop-shadow(0 0 14px #ffffff)', offset: 0.85 },
        { transform: 'scale(1.3)', filter: 'brightness(5) drop-shadow(0 0 22px #ffffff)', opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' },
    );
    setTimeout(() => {
      if (gen !== generation) return;
      const flash = el(over, 'fx-screen-flash');
      once(flash, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
      const nova = el(over, 'fx-nova', { left: `${x}px`, top: `${y}px`, width: `${s}px`, height: `${s}px` });
      once(nova, [
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
        { transform: 'translate(-50%,-50%) scale(4)', opacity: 0.9, offset: 0.35 },
        { transform: 'translate(-50%,-50%) scale(7)', opacity: 0 },
      ], { duration: 1600, easing: 'cubic-bezier(.1,.7,.3,1)' });
      ring(kingSq, { color: 'rgba(255,255,255,.95)', size: 3, width: 0.06, duration: 700 });
      ring(kingSq, { color: 'rgba(143,107,255,.95)', delay: 90, size: 5.2, width: 0.045, duration: 1000 });
      ring(kingSq, { color: 'rgba(60,242,163,.8)', delay: 170, size: 7, width: 0.03, duration: 1200 });
      starBurst(x, y, s, { count: 60, spread: [1, 4.5], size: [0.08, 0.2], duration: [900, 1600] });
      // Débris du roi qui flottent en apesanteur
      shards(kingSq, { count: 16, colors: loser === 'w' ? ['#fbf8ee', '#e9e4d3', '#b9a6ff'] : ['#2b2b29', '#45443f', '#8f6bff'], spread: [0.5, 1.4], gravity: -0.15, duration: [1400, 2200] });
      shake(7, 650);
      boardWave(kingSq, { delay: 60 });
    }, 900);
    setTimeout(() => gen === generation && kingGlory(winnerSq, gen, 4600), 1350);
    setTimeout(() => gen === generation && comet({ fromLeft: true }), 2100);
    setTimeout(() => gen === generation && comet({ fromLeft: false }), 2900);
    setTimeout(() => gen === generation && spaceBanner(outcome, loser, W, gen, calm, vignette, 5400), 1250);
  }

  function confetti(x, y, s, W, colors, count) {
    for (let i = 0, n = lite(count); i < n; i++) {
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
  // Sakura (Japon) : coup de sabre (iaï), pétales de cerisier, soleil rouge, encre, sceaux 勝 / 負
  // -------------------------------------------------------------------------
  const SAKURA = ['#ffd3de', '#ffbccd', '#ffc8d5', '#fde6ec', '#f7a3bb'];
  const WILTED = ['#cdb7b4', '#b9a19d', '#a99390', '#d9cbc6'];

  /** Pétales qui jaillissent d'un point puis retombent en se balançant. */
  function petals(px, py, s, { count = 12, spread = 1, delay = 0, colors = SAKURA, rise = 0.7, fall = 2.4, dur = [1500, 2600] } = {}) {
    if (reduceMotion()) return;
    for (let i = 0, n = lite(count); i < n; i++) {
      const w = s * rand(0.1, 0.17);
      const d = el(over, 'fx-petal', { left: `${px}px`, top: `${py}px`, width: `${w}px`, height: `${w * 0.8}px`, background: pick(colors) });
      const ang = rand(0, Math.PI * 2);
      const dist = s * rand(0.35, 1.1) * spread;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist * 0.7 - s * rise * rand(0.3, 1);
      const sway = s * rand(0.25, 0.6) * (Math.random() < 0.5 ? -1 : 1);
      const down = s * fall * rand(0.6, 1.1);
      const r0 = rand(0, 360);
      const flip = rand(360, 900);
      once(
        d,
        [
          { transform: `translate(-50%,-50%) rotate(${r0}deg) rotateX(0deg) scale(.3)`, opacity: 0 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${r0 + 90}deg) rotateX(${flip * 0.25}deg) scale(1)`, opacity: 1, offset: 0.22 },
          { transform: `translate(calc(-50% + ${dx + sway}px), calc(-50% + ${dy + down * 0.5}px)) rotate(${r0 + 180}deg) rotateX(${flip * 0.6}deg) scale(1)`, opacity: 1, offset: 0.6 },
          { transform: `translate(calc(-50% + ${dx - sway * 0.4}px), calc(-50% + ${dy + down}px)) rotate(${r0 + 260}deg) rotateX(${flip}deg) scale(.9)`, opacity: 0 },
        ],
        { duration: rand(dur[0], dur[1]), delay: delay + rand(0, 160), easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'backwards' },
      );
    }
  }

  /** Tempête de pétales poussée par le vent, de gauche à droite, sur tout l'échiquier. */
  function petalStorm(gen, { count = 60, duration = 4200, delay = 0, colors = SAKURA, slow = 1 } = {}) {
    if (reduceMotion()) return;
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    const s = W / 8;
    for (let i = 0, n = lite(count); i < n; i++) {
      const start = delay + (i / count) * duration * 0.75 + rand(0, 200);
      setTimeout(() => {
        if (gen !== generation) return;
        const w = s * rand(0.1, 0.18);
        const x0 = rand(-0.15, 0.75) * W;
        const y0 = -s * rand(0.2, 0.8);
        const d = el(over, 'fx-petal', { left: `${x0}px`, top: `${y0}px`, width: `${w}px`, height: `${w * 0.8}px`, background: pick(colors) });
        const tx = W * rand(0.35, 0.8);
        const ty = H + s;
        const sway = s * rand(0.4, 0.9);
        const r0 = rand(0, 360);
        const flip = rand(540, 1260);
        once(
          d,
          [
            { transform: `translate(-50%,-50%) rotate(${r0}deg) rotateX(0deg)`, opacity: 0 },
            { transform: `translate(calc(-50% + ${tx * 0.3 + sway}px), calc(-50% + ${ty * 0.3}px)) rotate(${r0 + 120}deg) rotateX(${flip * 0.3}deg)`, opacity: 1, offset: 0.25 },
            { transform: `translate(calc(-50% + ${tx * 0.65 - sway}px), calc(-50% + ${ty * 0.62}px)) rotate(${r0 + 230}deg) rotateX(${flip * 0.65}deg)`, opacity: 1, offset: 0.62 },
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${r0 + 330}deg) rotateX(${flip}deg)`, opacity: 0 },
          ],
          { duration: rand(2600, 4000) * slow, easing: 'linear' },
        );
      }, start);
    }
  }

  /** Éclair de sabre : une ligne de lumière qui se trace en diagonale à travers un point. */
  function slash(x, y, len, angle, { delay = 0, duration = 240, thick = 3 } = {}) {
    const d = el(over, 'fx-slash', { left: `${x}px`, top: `${y}px`, width: `${len}px`, height: `${thick}px` });
    once(
      d,
      [
        { transform: `translate(-50%,-50%) rotate(${angle}deg)`, clipPath: 'inset(0 100% 0 0)', opacity: 1 },
        { transform: `translate(-50%,-50%) rotate(${angle}deg)`, clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.35 },
        { transform: `translate(-50%,-50%) rotate(${angle}deg) scaleY(.4)`, clipPath: 'inset(0 0 0 0)', opacity: 0 },
      ],
      { duration, delay, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' },
    );
  }

  /** Une pièce tranchée en deux le long d'une diagonale : les deux moitiés glissent et tombent. */
  function splitPiece(layer, x, y, s, role, color, cut, { delay = 0, duration = 750, push = 0.32, drop = 0.35, dim = false } = {}) {
    // cut '/' : moitiés haut-gauche et bas-droite ; '\\' : haut-droite et bas-gauche
    const halves = cut === '/'
      ? [['polygon(0 0, 100% 0, 0 100%)', -1, -1], ['polygon(100% 0, 100% 100%, 0 100%)', 1, 1]]
      : [['polygon(0 0, 100% 0, 100% 100%)', 1, -1], ['polygon(0 0, 0 100%, 100% 100%)', -1, 1]];
    for (const [clip, sx, sy] of halves) {
      const g = el(layer, 'cg-wrap fx-ghost', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px`, clipPath: clip }, `<piece class="${role} ${color}"></piece>`);
      const px = sx * s * push * 0.7;
      const py = sy * s * push * 0.7;
      once(
        g,
        [
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1, filter: 'none' },
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1, filter: 'brightness(1.6)', offset: 0.08 },
          { transform: `translate(${px * 0.6}px, ${py * 0.6}px) rotate(${sx * 6}deg)`, opacity: 1, filter: dim ? 'grayscale(.6)' : 'none', offset: 0.4 },
          { transform: `translate(${px}px, ${py + s * drop}px) rotate(${sx * 14}deg)`, opacity: 0, filter: dim ? 'grayscale(1) brightness(.6)' : 'none' },
        ],
        { duration, delay, easing: 'cubic-bezier(.3,.2,.4,1)', fill: 'backwards' },
      );
    }
  }

  /** Prise « Iaï » : un éclair de sabre, la pièce prise tranchée en deux, quelques pétales. */
  function japonCaptureFx(move) {
    const sq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const victim = move.color === 'w' ? 'b' : 'w';
    const { x, y, s } = at(sq);
    const value = VALUE[move.captured] || 1;
    const impact = 120;
    const cut = Math.random() < 0.5 ? '/' : '\\';
    if (reduceMotion()) {
      splitPiece(under, x, y, s, ROLE[move.captured], COLOR[victim], cut, { duration: 300, push: 0, drop: 0 });
      return;
    }
    slash(x, y, s * (1.5 + value * 0.04), cut === '/' ? -45 : 45, { delay: impact, thick: Math.max(2, s * 0.035) });
    splitPiece(under, x, y, s, ROLE[move.captured], COLOR[victim], cut, { delay: impact + 40, duration: 680 + value * 20 });
    petals(x, y, s, { count: 4 + value * 2, delay: impact + 60, spread: 0.8 + value * 0.04 });
    if (value >= 5) ring(sq, { color: 'rgba(232,85,63,.85)', delay: impact + 40, size: 1.8, width: 0.03, duration: 620 });
    setTimeout(() => shake(value >= 9 ? 3.5 : value >= 5 ? 2.2 : 0, 260), impact);
  }

  /** Échec « Sakura » : coup de taiko (onde rouge) et sceau 王手 (« échec » au shogi). */
  function japonCheckFx(kingSq) {
    const delay = 120;
    ring(kingSq, { color: 'rgba(232,85,63,.95)', delay, size: 1.6, width: 0.06, duration: 560 });
    ring(kingSq, { color: 'rgba(232,85,63,.6)', delay: delay + 220, size: 2.1, width: 0.03, duration: 620 });
    setTimeout(() => shake(2.4, 240), delay);
    const { x, y, s } = at(kingSq);
    const above = y - s * 0.75 > s * 0.3;
    const tag = el(over, 'fx-check-tag japon', { left: `${Math.min(Math.max(x, s * 0.9), frame.clientWidth - s * 0.9)}px`, top: `${above ? y - s * 0.74 : y + s * 0.74}px`, fontSize: `${Math.max(12, s * 0.24)}px` }, '<b>王手</b><i>échec</i>');
    once(
      tag,
      [
        { transform: 'translate(-50%,-50%) scale(1.8) rotate(-10deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(.95) rotate(-4deg)', opacity: 1, offset: 0.1 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.16 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', opacity: 0 },
      ],
      { duration: 1400, delay, easing: 'ease-out', fill: 'backwards' },
    );
  }

  /** Sceau rouge (hanko) qu'on appose : 勝 la victoire, 負 la défaite. */
  function hankoBanner(outcome, loser, W, calm) {
    const lose = outcome === 'loss';
    const sub = outcome === 'win' ? 'Victoire' : lose ? 'Défaite' : `${loser === 'w' ? 'Les Noirs' : 'Les Blancs'} l’emportent`;
    const banner = el(over, 'fx-mate-banner japon ' + outcome, { fontSize: `${Math.max(24, W * 0.09)}px` },
      `<div class="hanko">${lose ? '負' : '勝'}</div><div class="t">Échec et mat</div><div class="s">${sub}</div>`);
    const [hanko, t, s] = banner.children;
    hanko.animate(
      calm
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { transform: 'scale(2.6) rotate(-16deg)', opacity: 0 },
            { transform: 'scale(.92) rotate(-6deg)', opacity: 1, offset: 0.55 },
            { transform: 'scale(1) rotate(-6deg)', opacity: 1 },
          ],
      { duration: calm ? 300 : 420, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'both' },
    );
    if (!calm) setTimeout(() => shake(4, 260), 230);
    [t, s].forEach((p, i) =>
      p.animate([{ opacity: 0, transform: 'translateY(14%)', filter: 'blur(5px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
        duration: calm ? 300 : 900, delay: calm ? 0 : 380 + i * 200, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both',
      }),
    );
    return banner;
  }

  /**
   * Mat « Hanami ».
   * Victoire : le roi vaincu tremble, un coup de sabre le tranche en deux, un soleil rouge se lève sous une
   * tempête de pétales, et le sceau 勝 s'appose. Défaite : ton roi se dissout dans une tache d'encre,
   * le soleil se couche, des pétales fanés tombent lentement, sceau 負.
   */
  async function japonMateFx(move, kingSq, loser, outcome, gen, winnerSq = null) {
    const { x, y, s } = at(kingSq);
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    const calm = reduceMotion();
    await wait(140);
    if (gen !== generation) return;
    frame.classList.add('mated-' + loser);
    const vignette = el(over, 'fx-vignette fx-japon-vignette' + (outcome === 'loss' ? ' loss' : ''));
    vignette.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, fill: 'forwards' });
    const sun = el(under, 'fx-japon-sun' + (outcome === 'loss' ? ' loss' : ''), { left: `${W / 2}px`, top: `${H / 2}px`, width: `${W * 0.6}px`, height: `${W * 0.6}px` });
    let king = null;

    if (outcome !== 'loss') {
      // Le roi vaincu tremble, puis il est tranché
      king = el(over, 'cg-wrap fx-king', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="king ${COLOR[loser]}"></piece>`);
      if (!calm) {
        const tremble = [];
        for (let i = 0; i <= 10; i++) tremble.push({ transform: i === 10 ? 'none' : `translateX(${(i % 2 ? 1 : -1) * s * 0.025}px)` });
        king.animate(tremble, { duration: 650, easing: 'linear' });
      }
      setTimeout(() => {
        if (gen !== generation) return;
        const cut = Math.random() < 0.5 ? '/' : '\\';
        if (!calm) {
          const flash = el(over, 'fx-screen-flash');
          once(flash, [{ opacity: 0 }, { opacity: 0.45, offset: 0.12 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
          slash(x, y, s * 3.2, cut === '/' ? -45 : 45, { duration: 380, thick: Math.max(3, s * 0.05) });
          shake(6, 380);
        }
        king.remove();
        splitPiece(over, x, y, s, 'king', COLOR[loser], cut, { duration: calm ? 400 : 1500, push: calm ? 0 : 0.5, drop: calm ? 0 : 0.7, dim: true });
        petals(x, y, s, { count: calm ? 0 : 26, spread: 1.6, rise: 1, delay: 60 });
        // Le soleil se lève
        sun.animate(
          [
            { transform: 'translate(-50%,-30%) scale(.7)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          ],
          { duration: calm ? 300 : 1600, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
        );
        if (winnerSq) {
          ring(winnerSq, { color: 'rgba(255,214,222,.95)', delay: 500, size: 2.4, width: 0.035, duration: 1100 });
          const w = at(winnerSq);
          setTimeout(() => gen === generation && petals(w.x, w.y, w.s, { count: calm ? 0 : 16, spread: 1.3, rise: 1.4 }), 500);
        }
        petalStorm(gen, { count: calm ? 0 : 70, duration: 4200, delay: 300 });
      }, calm ? 0 : 760);
    } else {
      // Défaite : ton roi se dissout dans une tache d'encre qui s'étend
      king = el(over, 'cg-wrap fx-king', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="king ${COLOR[loser]}"></piece>`);
      for (let i = 0; i < (calm ? 1 : 7); i++) {
        const r = s * (i === 0 ? 1.5 : rand(0.5, 1.1));
        const ox = i === 0 ? 0 : rand(-1, 1) * s * 0.9;
        const oy = i === 0 ? 0 : rand(-1, 1) * s * 0.9;
        const blot = el(under, 'fx-ink', { left: `${x + ox}px`, top: `${y + oy}px`, width: `${r * 2}px`, height: `${r * 2}px` });
        blot.animate(
          [
            { transform: 'translate(-50%,-50%) scale(.05)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0.9, offset: 0.3 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.85 },
          ],
          { duration: calm ? 400 : 1900, delay: calm ? 0 : 200 + i * 160, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'both' },
        );
      }
      king.animate(
        calm
          ? [{ filter: 'none' }, { filter: 'grayscale(1) brightness(.5)', opacity: 0.5 }]
          : [
              { transform: 'translateY(0) scale(1)', filter: 'none', opacity: 1 },
              { transform: 'translateY(4%) scale(.97)', filter: 'grayscale(.8) brightness(.6) blur(.5px)', opacity: 0.9, offset: 0.45 },
              { transform: 'translateY(14%) scale(.9)', filter: 'grayscale(1) brightness(.3) blur(2.5px)', opacity: 0.15 },
            ],
        { duration: calm ? 500 : 2600, delay: calm ? 0 : 500, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' },
      );
      // Le soleil se couche
      sun.animate(
        [
          { transform: 'translate(-50%,-55%) scale(1)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.8, offset: 0.25 },
          { transform: 'translate(-50%,-5%) scale(.95)', opacity: 0 },
        ],
        { duration: calm ? 400 : 4200, delay: calm ? 0 : 300, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
      );
      petalStorm(gen, { count: calm ? 0 : 26, duration: 4600, delay: 600, colors: WILTED, slow: 1.5 });
    }

    // Le sceau
    setTimeout(() => {
      if (gen !== generation) return;
      const banner = hankoBanner(outcome, loser, W, calm);
      setTimeout(() => {
        if (gen !== generation) return;
        once(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
        once(vignette, [{ opacity: 1 }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
        once(sun, [{ opacity: getComputedStyle(sun).opacity }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
      }, 5400);
    }, calm ? 300 : outcome === 'loss' ? 1500 : 1350);
  }

  // -------------------------------------------------------------------------
  // Western : coup de feu (éclair du canon, impact, douille), viseur, virevoltant, pancarte de saloon
  // -------------------------------------------------------------------------
  /** Éclair du canon : une étoile de feu très brève. */
  function muzzle(x, y, s, { delay = 0, size = 1 } = {}) {
    const d = el(over, 'fx-muzzle', { left: `${x}px`, top: `${y}px`, width: `${s * 1.1 * size}px`, height: `${s * 1.1 * size}px` });
    once(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: `translate(-50%,-50%) scale(1.15) rotate(${rand(-20, 20)}deg)`, opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 },
      ],
      { duration: 200, delay, easing: 'ease-out', fill: 'backwards' },
    );
  }

  /** Impact de balle (trou et fêlures) qui reste un moment puis s'efface. */
  function bulletHole(x, y, s, { delay = 0, life = 1100, size = 0.3 } = {}) {
    const w = s * size;
    const d = el(over, 'fx-bullethole', { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${w}px` });
    once(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.05 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
      ],
      { duration: life, delay, easing: 'ease-out', fill: 'backwards' },
    );
  }

  /** Nuages de poussière qui s'étalent et retombent. */
  function dust(x, y, s, { count = 8, spread = 1, delay = 0, rise = 0.3 } = {}) {
    if (reduceMotion()) return;
    for (let i = 0, n = lite(count); i < n; i++) {
      const r = s * rand(0.25, 0.5);
      const d = el(over, 'fx-dust', { left: `${x}px`, top: `${y + s * 0.3}px`, width: `${r}px`, height: `${r}px` });
      const ang = rand(Math.PI, Math.PI * 2);
      const dist = s * rand(0.3, 0.9) * spread;
      once(
        d,
        [
          { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
          { transform: `translate(calc(-50% + ${Math.cos(ang) * dist * 0.5}px), calc(-50% + ${Math.sin(ang) * dist * 0.3}px)) scale(1)`, opacity: 0.85, offset: 0.25 },
          { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist * 0.5 - s * rise}px)) scale(1.8)`, opacity: 0 },
        ],
        { duration: rand(700, 1200), delay: delay + rand(0, 100), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' },
      );
    }
  }

  /** Douille éjectée : elle saute, tourne et rebondit. */
  function casing(x, y, s, { delay = 0 } = {}) {
    if (reduceMotion()) return;
    const d = el(over, 'fx-casing', { left: `${x}px`, top: `${y}px`, width: `${s * 0.13}px`, height: `${s * 0.06}px` });
    const dir = Math.random() < 0.5 ? -1 : 1;
    const dx = dir * s * rand(0.5, 0.9);
    const up = -s * rand(0.6, 0.9);
    const floor = s * rand(0.25, 0.4);
    once(
      d,
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.2,.6,.4,1)' },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${up}px)) rotate(${dir * 400}deg)`, opacity: 1, offset: 0.4, easing: 'cubic-bezier(.6,0,.9,.5)' },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${floor}px)) rotate(${dir * 820}deg)`, opacity: 1, offset: 0.75, easing: 'ease-out' },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${floor - s * 0.1}px)) rotate(${dir * 900}deg)`, opacity: 1, offset: 0.86, easing: 'ease-in' },
        { transform: `translate(calc(-50% + ${dx * 1.25}px), calc(-50% + ${floor}px)) rotate(${dir * 960}deg)`, opacity: 0 },
      ],
      { duration: 1000, delay, fill: 'backwards' },
    );
  }

  /** Viseur rouge qui se resserre sur une case. */
  function crosshair(sq, { delay = 0, duration = 900, hold = 0.5 } = {}) {
    const { x, y, s } = at(sq);
    const d = el(over, 'fx-crosshair', { left: `${x}px`, top: `${y}px`, width: `${s * 0.95}px`, height: `${s * 0.95}px` });
    once(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(2.4) rotate(90deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1, offset: 1 - hold },
        { transform: 'translate(-50%,-50%) scale(.92) rotate(0deg)', opacity: 1, offset: 1 - hold * 0.4 },
        { transform: 'translate(-50%,-50%) scale(.92) rotate(0deg)', opacity: 0 },
      ],
      { duration, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' },
    );
    return d;
  }

  /** Virevoltant (tumbleweed) qui traverse l'échiquier en roulant et en rebondissant. */
  function tumbleweed(gen, { delay = 0, duration = 3200, y = 0.75 } = {}) {
    if (reduceMotion()) return;
    setTimeout(() => {
      if (gen !== generation) return;
      const W = frame.clientWidth;
      const H = frame.clientHeight;
      const size = W / 8 * 0.9;
      const fromLeft = Math.random() < 0.5;
      const x0 = fromLeft ? -size : W + size;
      const x1 = fromLeft ? W + size : -size;
      const d = el(over, 'fx-tumbleweed', { left: `${x0}px`, top: `${H * y}px`, width: `${size}px`, height: `${size}px` }, tumbleweedSvg());
      const frames = [];
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const hop = i % 2 ? -size * (0.55 - t * 0.25) : 0;
        frames.push({ transform: `translate(calc(-50% + ${(x1 - x0) * t}px), calc(-50% + ${hop}px)) rotate(${(fromLeft ? 1 : -1) * 900 * t}deg)`, offset: t });
      }
      once(d, frames, { duration, easing: 'linear' });
    }, delay);
  }
  const tumbleweedSvg = () => {
    let d = '';
    for (let i = 0; i < 9; i++) {
      const a = rand(0, Math.PI * 2);
      const r1 = rand(18, 44);
      const a2 = a + rand(1.4, 3.2);
      d += `M${(50 + Math.cos(a) * r1).toFixed(1)} ${(50 + Math.sin(a) * r1).toFixed(1)}Q${(50 + rand(-30, 30)).toFixed(1)} ${(50 + rand(-30, 30)).toFixed(1)} ${(50 + Math.cos(a2) * rand(20, 46)).toFixed(1)} ${(50 + Math.sin(a2) * rand(20, 46)).toFixed(1)}`;
    }
    return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#8a6436" stroke-width="3" stroke-dasharray="14 6 22 8"/><path d="${d}" fill="none" stroke="#a87c45" stroke-width="2.6" stroke-linecap="round"/><circle cx="50" cy="50" r="32" fill="none" stroke="#6e4c26" stroke-width="2" stroke-dasharray="9 7"/></svg>`;
  };

  /** Prise « Duel » : coup de feu sur la pièce prise, impact, la pièce est projetée, poussière et douille. */
  function westernCaptureFx(move) {
    const sq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const victim = move.color === 'w' ? 'b' : 'w';
    const { x, y, s } = at(sq);
    const value = VALUE[move.captured] || 1;
    const impact = 110;
    const ghost = el(over, 'cg-wrap fx-ghost', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="${ROLE[move.captured]} ${COLOR[victim]}"></piece>`);
    if (reduceMotion()) {
      once(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      return;
    }
    // La pièce est projetée à l'opposé du tireur, en tournoyant
    const from = at(move.from);
    let vx = x - from.x;
    let vy = y - from.y;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;
    const spin = (vx >= 0 ? 1 : -1) * rand(140, 260);
    once(
      ghost,
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1, filter: 'none' },
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1, filter: 'brightness(1.8)', offset: 0.15 },
        { transform: `translate(${vx * s * 0.55}px, ${vy * s * 0.55 - s * 0.35}px) rotate(${spin * 0.6}deg)`, opacity: 1, filter: 'none', offset: 0.5 },
        { transform: `translate(${vx * s * 0.9}px, ${vy * s * 0.9 + s * 0.2}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 640 + value * 15, delay: impact - 20, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'backwards' },
    );
    muzzle(x, y, s, { delay: impact, size: 0.8 + value * 0.04 });
    bulletHole(x + rand(-0.15, 0.15) * s, y + rand(-0.1, 0.15) * s, s, { delay: impact, life: 1200 });
    dust(x, y, s, { count: 5 + value * 2, delay: impact + 30 });
    casing(from.x > x ? x + s * 0.3 : x - s * 0.3, y - s * 0.1, s, { delay: impact + 80 });
    setTimeout(() => shake(value >= 9 ? 5 : value >= 5 ? 3.5 : 2, 260), impact);
  }

  /** Échec « Western » : le viseur se pose sur le roi, pancarte « Échec ! ». */
  function westernCheckFx(kingSq) {
    const delay = 80;
    crosshair(kingSq, { delay, duration: 1250, hold: 0.55 });
    const { x, y, s } = at(kingSq);
    const above = y - s * 0.75 > s * 0.3;
    const tag = el(over, 'fx-check-tag western', { left: `${Math.min(Math.max(x, s * 0.9), frame.clientWidth - s * 0.9)}px`, top: `${above ? y - s * 0.78 : y + s * 0.78}px`, fontSize: `${Math.max(12, s * 0.24)}px` }, 'Échec !');
    once(
      tag,
      [
        { transform: 'translate(-50%,-50%) rotate(-14deg) translateY(-30%)', opacity: 0 },
        { transform: 'translate(-50%,-50%) rotate(6deg)', opacity: 1, offset: 0.14 },
        { transform: 'translate(-50%,-50%) rotate(-3deg)', opacity: 1, offset: 0.24 },
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 0 },
      ],
      { duration: 1400, delay: delay + 150, easing: 'ease-out', fill: 'backwards' },
    );
  }

  /**
   * Mat « Règlement de comptes » : le viseur se resserre sur le roi vaincu, BANG, il tombe dans la poussière,
   * un virevoltant traverse l'échiquier, puis une pancarte de saloon descend avec l'étoile du shérif.
   * Défaite : même duel mais c'est ton roi ; la pancarte est trouée d'une balle et pend de travers.
   */
  async function westernMateFx(move, kingSq, loser, outcome, gen) {
    const { x, y, s } = at(kingSq);
    const W = frame.clientWidth;
    const calm = reduceMotion();
    const lose = outcome === 'loss';
    await wait(140);
    if (gen !== generation) return;
    frame.classList.add('mated-' + loser);
    const vignette = el(over, 'fx-vignette fx-western-vignette' + (lose ? ' loss' : ''));
    vignette.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1200, fill: 'forwards' });
    const king = el(over, 'cg-wrap fx-king', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="king ${COLOR[loser]}"></piece>`);
    const BANG = calm ? 0 : 860;
    if (!calm) crosshair(kingSq, { duration: 1050, hold: 0.25 });

    setTimeout(() => {
      if (gen !== generation) return;
      if (!calm) {
        const flash = el(over, 'fx-screen-flash fx-western-flash');
        once(flash, [{ opacity: 0 }, { opacity: 0.55, offset: 0.1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
        muzzle(x, y, s, { size: 1.6 });
        bulletHole(x + s * 0.05, y - s * 0.08, s, { life: 2400, size: 0.34 });
        dust(x, y, s, { count: 16, spread: 1.6 });
        shake(7, 420);
      }
      let dir = FILES.indexOf(move.to[0]) <= FILES.indexOf(kingSq[0]) ? 1 : -1;
      if (getOrientation() === 'b') dir = -dir;
      king.animate(
        calm
          ? [{ filter: 'none' }, { filter: 'grayscale(.7) brightness(.7)' }]
          : [
              { transform: 'translate(0,0) rotate(0deg)', filter: 'brightness(1.6)' },
              { transform: `translate(${dir * 6}%, -10%) rotate(${dir * 25}deg)`, filter: 'none', offset: 0.3 },
              { transform: `translate(${dir * 14}%, 12%) rotate(${dir * 92}deg)`, filter: 'brightness(.75) drop-shadow(0 4px 5px rgba(0,0,0,.5))', offset: 0.75 },
              { transform: `translate(${dir * 13}%, 10%) rotate(${dir * 86}deg)`, filter: 'brightness(.7) drop-shadow(0 4px 5px rgba(0,0,0,.5))' },
            ],
        { duration: calm ? 500 : 900, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' },
      );
    }, BANG);

    tumbleweed(gen, { delay: BANG + 500, duration: lose ? 4300 : 3300, y: 0.74 });
    if (!calm) setTimeout(() => gen === generation && dust(W * 0.15, frame.clientHeight * 0.8, s, { count: 6, spread: 2, rise: 0.1 }), BANG + 900);

    // La pancarte du saloon
    setTimeout(() => {
      if (gen !== generation) return;
      const sub = outcome === 'win' ? 'Victoire' : lose ? 'Défaite' : `${loser === 'w' ? 'Les Noirs' : 'Les Blancs'} gagnent le duel`;
      const banner = el(over, 'fx-mate-banner western ' + outcome, { fontSize: `${Math.max(24, W * 0.085)}px` },
        `<div class="sign">${lose ? '<i class="hole"></i>' : '<div class="star">★</div>'}<div class="t">Échec et mat</div><div class="s">${sub}</div></div>`);
      const sign = banner.firstElementChild;
      // La pancarte est accrochée en haut du damier : deux clous, deux cordes jusqu'à elle
      const { oy } = boardBox();
      const fr = frame.getBoundingClientRect();
      const sr = sign.getBoundingClientRect();
      const rope = Math.max(10, sr.top - (fr.top + oy) - 4);
      sign.style.setProperty('--rope', `${rope}px`);
      sign.insertAdjacentHTML('afterbegin', '<i class="rope l"></i><i class="rope r"></i>');
      const nails = [0.16, 0.84].map((p) => el(banner, 'wnail', { left: `${sr.left - fr.left + p * sr.width}px`, top: `${oy + 4}px` }));
      const end = 0;
      sign.animate(
        calm
          ? [{ opacity: 0 }, { opacity: 1, transform: `rotate(${end}deg)` }]
          : [
              { transform: 'translateY(-160%) rotate(0deg)', opacity: 1 },
              { transform: 'translateY(4%) rotate(0deg)', offset: 0.35 },
              { transform: `translateY(0) rotate(${end - 9}deg)`, offset: 0.5 },
              { transform: `translateY(0) rotate(${end + 6}deg)`, offset: 0.66 },
              { transform: `translateY(0) rotate(${end - 3}deg)`, offset: 0.82 },
              { transform: `translateY(0) rotate(${end}deg)`, opacity: 1 },
            ],
        { duration: calm ? 300 : 1500, easing: 'ease-out', fill: 'both' },
      );
      // Défaite : la corde de droite se décroche du clou, la pancarte pend de travers et la corde tombe
      if (lose) {
        setTimeout(() => {
          if (gen !== generation) return;
          const A = 38;
          // La pancarte bascule autour de son coin gauche (là où tient la corde de gauche, qui reste tendue)
          sign.style.transformOrigin = '16% 0';
          if (!calm) dust(nails[1].offsetLeft, nails[1].offsetTop, s, { count: 4, spread: 0.6, rise: 0.4 });
          const swing = (k) => (calm ? [{ transform: 'none' }, { transform: `rotate(${k * A}deg)` }] : [{ transform: 'none' }, { transform: `rotate(${k * (A + 10)}deg)`, offset: 0.35 }, { transform: `rotate(${k * (A - 6)}deg)`, offset: 0.58 }, { transform: `rotate(${k * (A + 3)}deg)`, offset: 0.78 }, { transform: `rotate(${k * A}deg)` }]);
          const opts = { duration: calm ? 200 : 1400, easing: 'cubic-bezier(.35,0,.4,1)', fill: 'forwards' };
          sign.animate(swing(1), opts);
          // La corde de gauche tourne à l'envers : elle reste droite, du clou à la pancarte
          sign.querySelector('.rope.l').animate(swing(-1), opts);
          // La corde de droite, décrochée, pend sous le coin de la pancarte (plus courte : elle s'est enroulée)
          const r = sign.querySelector('.rope.r');
          r.style.height = `min(var(--rope), 2.4em)`;
          r.style.top = `calc(-1 * min(var(--rope), 2.4em))`;
          r.animate(
            calm
              ? [{ transform: 'none' }, { transform: `rotate(${180 - A}deg)` }]
              : [{ transform: 'none' }, { transform: `rotate(${120 - A}deg)`, offset: 0.3 }, { transform: `rotate(${200 - A}deg)`, offset: 0.55 }, { transform: `rotate(${168 - A}deg)`, offset: 0.75 }, { transform: `rotate(${185 - A}deg)`, offset: 0.9 }, { transform: `rotate(${180 - A}deg)` }],
            { duration: calm ? 200 : 1700, easing: 'ease-out', fill: 'forwards' },
          );
        }, calm ? 400 : 2100);
      }
      setTimeout(() => {
        if (gen !== generation) return;
        once(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
        once(vignette, [{ opacity: 1 }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
      }, 5200);
    }, calm ? 300 : BANG + 650);
  }

  // -------------------------------------------------------------------------
  // Pack Océan : siphon, aileron, Les Abysses
  // -------------------------------------------------------------------------
  /** Tourbillon vu de dessus : un centre sombre et des bras en spirale. */
  const WHIRL = (() => {
    const arm = (a0, w, col, op) => {
      const pts = [];
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const r = 47 - 42 * t;
        const a = a0 + t * Math.PI * 1.7;
        pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`);
      }
      return `<path d="M${pts.join(' L')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
    };
    const arms = [0, 1, 2, 3].map((k) => arm((k * Math.PI) / 2, 3, '#e6fbff', 0.8)).join('') + [0, 1, 2, 3].map((k) => arm((k * Math.PI) / 2 + 0.7, 1.5, '#6fe3ea', 0.75)).join('');
    return `<svg viewBox="-50 -50 100 100"><defs><radialGradient id="fx-wp" r=".5"><stop offset="0" stop-color="#01070f" stop-opacity=".95"/><stop offset=".28" stop-color="#05223a" stop-opacity=".8"/><stop offset=".7" stop-color="#1d6f8f" stop-opacity=".35"/><stop offset="1" stop-color="#6fe3ea" stop-opacity="0"/></radialGradient></defs><circle r="49" fill="url(#fx-wp)"/>${arms}</svg>`;
  })();
  const FIN = `<svg viewBox="0 0 40 32" style="overflow:visible"><path d="M6 27 C12 22.5 16 14 16 3 C23 6.5 31 15 34 27Z" fill="#35576b" stroke="#0b1d29" stroke-width="1.6" stroke-linejoin="round"/><path d="M18 7 C21 11 25 17 27 24" fill="none" stroke="#7ea9bf" stroke-width="1.4" opacity=".7"/><path d="M-4 28 Q4 25 12 28 T28 28 T44 28" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/></svg>`;
  const WHALE = `<svg viewBox="0 0 200 90"><g fill="rgba(3,26,46,.8)"><path d="M196 46 C194 34 176 24 150 21 C112 16 66 22 46 40 C40 44 34 46 24 46 L10 32 C7 38 9 44 14 49 C9 54 6 60 9 66 L24 53 C34 53 42 56 50 60 C72 70 120 72 150 68 C176 64 196 58 196 46Z"/><path d="M128 66 C126 76 118 84 106 86 C112 78 114 72 114 67Z"/></g><path d="M150 56 C165 58 180 56 192 52 M146 61 C162 63.5 178 61.5 189 57" stroke="rgba(150,220,255,.3)" stroke-width="1.6" fill="none"/><circle cx="172" cy="41" r="2.2" fill="rgba(170,235,255,.6)"/></svg>`;
  const FISH = (col) => `<svg viewBox="0 0 30 14"><path d="M2 7 C7 1 17 1 23 7 C17 13 7 13 2 7Z M22 7 L29 2 L27.5 7 L29 12Z" fill="${col}"/><circle cx="7" cy="6" r="1.1" fill="#04192c"/></svg>`;
  const EYE = `<svg viewBox="0 0 120 60" style="overflow:visible"><defs><radialGradient id="fx-iris" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#fff4a8"/><stop offset=".5" stop-color="#ffaa2a"/><stop offset="1" stop-color="#8f2a0c"/></radialGradient></defs><path d="M4 30 Q60 -6 116 30 Q60 66 4 30Z" fill="url(#fx-iris)" stroke="#2b0716" stroke-width="3"/><path d="M30 22 Q60 30 90 22 M28 38 Q60 31 92 38" fill="none" stroke="#7a2510" stroke-width="1.2" opacity=".6"/><ellipse class="pupil" cx="60" cy="30" rx="5" ry="21" fill="#0c0206"/><ellipse cx="51" cy="21" rx="5" ry="2.6" fill="#fff" opacity=".7"/><path d="M0 30 Q60 -12 120 30" fill="none" stroke="#3a0f2a" stroke-width="6" stroke-linecap="round"/></svg>`;
  // Tentacule : pointe enroulée vers la droite (flip = vers la gauche)
  const TENTACLE = (flip) => `<svg viewBox="0 0 40 120" preserveAspectRatio="none" style="transform:scaleX(${flip ? -1 : 1})"><defs><linearGradient id="fx-tg" x1="0" x2="1"><stop offset="0" stop-color="#5a1a52"/><stop offset=".45" stop-color="#b8428e"/><stop offset=".7" stop-color="#8a2a6c"/><stop offset="1" stop-color="#3e0f3a"/></linearGradient></defs><path d="M9 122 C5 92 23 74 16.5 50 C10.5 30 18 11 30 6.5 C36.5 4.5 38.5 11 33.5 13 C25.5 17 21 31 27 48 C35 72 24 94 26.5 122Z" fill="url(#fx-tg)" stroke="#ff9fd6" stroke-opacity=".55" stroke-width="1.4"/><g fill="#ffc2e6" stroke="#5a1450" stroke-width=".8"><circle cx="30.5" cy="17" r="1.2"/><circle cx="26.5" cy="26" r="1.5"/><circle cx="25.5" cy="36" r="1.8"/><circle cx="27.5" cy="47" r="2"/><circle cx="30" cy="59" r="2.2"/><circle cx="30.5" cy="72" r="2.3"/><circle cx="28.5" cy="85" r="2.4"/><circle cx="27" cy="99" r="2.5"/><circle cx="26.8" cy="112" r="2.6"/></g></svg>`;

  /** Le carré de l'échiquier réel dans le cadre : { ox, oy, W }. */
  function boardBox() {
    const fr = frame.getBoundingClientRect();
    const board = frame.querySelector('cg-board');
    const br = board ? board.getBoundingClientRect() : fr;
    return { ox: br.left - fr.left, oy: br.top - fr.top, W: br.width };
  }

  /** Bulles qui remontent en ondulant. */
  function seaBubbles(parent, x, y, s, count, { delay = 0, spread = 0.6, rise = 1.6, span = 400, size = 1 } = {}) {
    if (reduceMotion()) return;
    for (let i = 0, n = lite(count); i < n; i++) {
      const r = s * rand(0.06, 0.16) * size;
      const b = el(parent, 'fx-bubble', { left: `${x + rand(-spread, spread) * s}px`, top: `${y + rand(-0.2, 0.2) * s}px`, width: `${r}px`, height: `${r}px` });
      const h = s * rand(rise * 0.6, rise);
      const wob = s * rand(0.06, 0.18);
      once(
        b,
        [
          { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
          { transform: `translate(calc(-50% + ${wob}px), calc(-50% - ${h * 0.35}px)) scale(1)`, opacity: 1, offset: 0.3 },
          { transform: `translate(calc(-50% - ${wob}px), calc(-50% - ${h * 0.7}px)) scale(1)`, opacity: 0.9, offset: 0.65 },
          { transform: `translate(-50%, calc(-50% - ${h}px)) scale(1.15)`, opacity: 0 },
        ],
        { duration: rand(1000, 1600), delay: delay + rand(0, span), easing: 'ease-out', fill: 'backwards' },
      );
    }
  }

  /** Prise « Siphon » : un tourbillon s'ouvre sous la case, la pièce prise y tourne et disparaît. */
  function oceanCaptureFx(move) {
    const sq = move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
    const victim = move.color === 'w' ? 'b' : 'w';
    const { x, y, s } = at(sq);
    const ghost = el(over, 'cg-wrap fx-ghost', { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` }, `<piece class="${ROLE[move.captured]} ${COLOR[victim]}"></piece>`);
    if (reduceMotion()) {
      once(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      return;
    }
    const wp = el(under, 'fx-whirl', { left: `${x}px`, top: `${y}px`, width: `${s * 1.45}px`, height: `${s * 1.45}px` }, WHIRL);
    once(
      wp,
      [
        { transform: 'translate(-50%,-50%) rotate(0deg) scale(.2)', opacity: 0 },
        { transform: 'translate(-50%,-50%) rotate(-160deg) scale(1)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-50%) rotate(-480deg) scale(.95)', opacity: 0.9, offset: 0.72 },
        { transform: 'translate(-50%,-50%) rotate(-680deg) scale(.25)', opacity: 0 },
      ],
      { duration: 1150, easing: 'linear' },
    );
    once(
      ghost,
      [
        { transform: 'rotate(0deg) scale(1)', opacity: 1, filter: 'none' },
        { transform: 'rotate(-80deg) scale(.88)', opacity: 1, filter: 'none', offset: 0.3 },
        { transform: 'rotate(-460deg) scale(0)', opacity: 0, filter: 'brightness(.35)' },
      ],
      { duration: 820, delay: 60, easing: 'cubic-bezier(.5,0,.85,.55)', fill: 'backwards' },
    );
    seaBubbles(over, x, y, s, 6, { delay: 520, spread: 0.3, rise: 1.3, span: 300, size: 0.9 });
  }

  /** Échec « Océan » : un aileron de requin tourne autour du roi menacé, ondes, étiquette « Échec ! ». */
  function oceanCheckFx(kingSq) {
    const { x, y, s } = at(kingSq);
    const above = y - s * 0.75 > s * 0.3;
    const tag = el(over, 'fx-check-tag ocean', { left: `${Math.min(Math.max(x, s * 0.9), frame.clientWidth - s * 0.9)}px`, top: `${above ? y - s * 0.95 : y + s * 0.95}px`, fontSize: `${Math.max(12, s * 0.26)}px` }, 'Échec !');
    once(
      tag,
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.85 },
        { transform: 'translate(-50%,-80%) scale(1)', opacity: 0 },
      ],
      { duration: 1800, delay: 80, fill: 'backwards' },
    );
    if (reduceMotion()) return;
    for (let i = 0; i < 3; i++) {
      const r = el(over, 'fx-ocean-ripple', { left: `${x}px`, top: `${y + s * 0.3}px`, width: `${s}px`, height: `${s * 0.5}px` });
      once(r, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(2.2)', opacity: 0 }], { duration: 1200, delay: i * 380, easing: 'ease-out', fill: 'backwards' });
    }
    // L'aileron fait un tour et demi autour du roi, puis plonge
    const fin = el(over, 'fx-ocean-fin', { left: `${x}px`, top: `${y + s * 0.35}px`, width: `${s * 0.62}px`, height: `${s * 0.5}px` }, FIN);
    const R = s * 1.1;
    const N = 48;
    const frames = [];
    for (let i = 0; i <= N; i++) {
      const th = Math.PI / 2 + (i / N) * 1.4 * Math.PI * 2;
      const dx = Math.cos(th) * R;
      const dy = Math.sin(th) * R * 0.45;
      const v = -Math.sin(th);
      const sx = (v >= 0 ? 1 : -1) * Math.max(0.3, Math.abs(v));
      const up = i < 4 ? i / 4 : i > N - 4 ? (N - i) / 4 : 1;
      frames.push({ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) translate(-50%, -100%) scale(${sx.toFixed(2)}, ${up})`, opacity: up * (dy < 0 ? 0.55 : 1) });
    }
    once(fin, frames, { duration: 2300, easing: 'linear' });
  }

  /**
   * Mat « Les Abysses ». Victoire : la lumière descend de la surface, une baleine passe, un banc de poissons,
   * le roi vaincu s'enfonce dans sa case et ton roi brille comme une perle.
   * Défaite : le noir se referme autour de ton roi, l'œil du kraken s'ouvre et ses tentacules l'entraînent.
   */
  async function oceanMateFx(move, kingSq, loser, outcome, gen, winSq) {
    const { x, y, s } = at(kingSq);
    const calm = reduceMotion();
    const lose = outcome === 'loss';
    await wait(140);
    if (gen !== generation) return;
    frame.classList.add('mated-' + loser);
    const { ox, oy, W } = boardBox();
    // Tout se passe dans le carré de l'échiquier (rien ne dépasse du plateau)
    const clip = el(over, 'fx-ocean-clip', { left: `${ox}px`, top: `${oy}px`, width: `${W}px`, height: `${W}px` });
    const kx = x - ox;
    const ky = y - oy;
    const king = el(clip, 'cg-wrap fx-king', { left: `${kx - s / 2}px`, top: `${ky - s / 2}px`, width: `${s}px`, height: `${s}px`, zIndex: 6 }, `<piece class="king ${COLOR[loser]}"></piece>`);
    const later = (fn, ms) => setTimeout(() => gen === generation && fn(), ms);
    const fades = [];

    if (calm) {
      king.animate([{ filter: 'none' }, { filter: 'grayscale(.7) brightness(.6)' }], { duration: 500, fill: 'forwards' });
    } else if (!lose) {
      // L'eau s'assombrit un peu, la lumière descend de la surface
      const deep = el(clip, 'fx-ocean-deep', {});
      deep.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, fill: 'forwards' });
      fades.push(deep);
      for (let i = 0; i < 5; i++) {
        const ray = el(clip, 'fx-ocean-ray', { left: `${W * (0.04 + i * 0.21)}px`, top: `${-W * 0.15}px`, width: `${W * rand(0.08, 0.14)}px`, height: `${W * 1.3}px`, transform: 'rotate(14deg)' });
        ray.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0.35, offset: 0.6 }, { opacity: 0.7 }], { duration: 2600, delay: 200 + i * 140, fill: 'forwards', easing: 'ease-in-out' });
        fades.push(ray);
      }
      // La baleine passe au loin
      const wh = el(clip, 'fx-ocean-whale', { left: `${-W * 0.75}px`, top: `${W * 0.08}px`, width: `${W * 0.7}px`, height: `${W * 0.315}px`, opacity: '.5', filter: 'blur(1px)' }, WHALE);
      once(wh, [{ transform: 'translate(0,0) rotate(2deg)' }, { transform: `translate(${W * 0.9}px, ${-W * 0.03}px) rotate(-2deg)`, offset: 0.5 }, { transform: `translate(${W * 1.85}px, ${W * 0.01}px) rotate(2deg)` }], { duration: 7000, easing: 'linear' });
      // Le roi vaincu coule comme dans l'eau : il perd pied, puis descend lentement vers le fond en se balançant
      // de gauche à droite (comme une feuille), de plus en plus petit, sombre et flou, jusqu'à disparaître
      const depth = Math.min(3.2, (W - ky) / s + 0.6); // il descend de quelques cases (sans sortir du plateau)
      const side = kx > W / 2 ? -1 : 1;
      const sink = [];
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        const fall = Math.pow(k, 1.35); // il accélère un peu, puis reste lent (la résistance de l'eau)
        const sway = i === 0 ? 0 : Math.sin(k * Math.PI * 3.2) * (0.28 - k * 0.12) * side;
        sink.push({
          transform: `translate(${(sway * 100).toFixed(1)}%, ${(fall * depth * 100).toFixed(1)}%) rotate(${(sway * 70 + k * 25 * side).toFixed(1)}deg) scale(${(1 - k * 0.32).toFixed(3)})`,
          filter: `brightness(${(1 - k * 0.6).toFixed(2)}) saturate(${(1 - k * 0.5).toFixed(2)}) blur(${(k * 1.6).toFixed(2)}px)`,
          opacity: i < 7 ? 1 : (1 - (i - 6) / 4).toFixed(2),
          offset: k,
        });
      }
      king.animate(sink, { duration: 4200, delay: 350, easing: 'cubic-bezier(.35,.1,.6,1)', fill: 'forwards' });
      // Des bulles s'échappent du roi pendant qu'il coule
      for (let k = 0; k < 6; k++) {
        later(() => {
          const r = king.getBoundingClientRect();
          const cr = clip.getBoundingClientRect();
          seaBubbles(clip, r.left - cr.left + r.width / 2, r.top - cr.top + r.height * 0.3, s, 4, { spread: 0.25, rise: 1.6 });
        }, 600 + k * 550);
      }
      // Ton roi (ou celui du vainqueur) brille comme une perle
      if (winSq) {
        const w = at(winSq);
        const halo = el(clip, 'fx-ocean-halo', { left: `${w.x - ox}px`, top: `${w.y - oy}px`, width: `${s * 2.2}px`, height: `${s * 2.2}px` });
        halo.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(.85)', opacity: 0.75 }], { duration: 1600, delay: 900, fill: 'forwards' });
        fades.push(halo);
      }
      // Un banc de poissons traverse le plateau
      const cols = ['#e8fbff', '#bfeff6', '#f3c4d6', '#9fe7ef'];
      for (let i = 0, n = lite(16); i < n; i++) {
        const fsh = el(clip, 'fx-ocean-fish', { left: `${-s}px`, top: `${W * 0.55 + rand(-0.12, 0.12) * W}px`, width: `${s * 0.42}px`, height: `${s * 0.2}px`, zIndex: 7 }, FISH(cols[i % 4]));
        const dy = rand(-0.08, 0.08) * W;
        once(
          fsh,
          [
            { transform: 'translate(0,0) scaleX(-1)' },
            { transform: `translate(${W * 0.5}px, ${dy - W * 0.06}px) scaleX(-1)`, offset: 0.45 },
            { transform: `translate(${W * 1.2}px, ${dy + W * 0.04}px) scaleX(-1)` },
          ],
          { duration: rand(2600, 3200), delay: 1300 + i * rand(40, 90), easing: 'ease-in-out', fill: 'backwards' },
        );
      }
      for (let i = 0; i < 4; i++) later(() => seaBubbles(clip, W * rand(0.1, 0.9), W * 1.02, s, 6, { spread: 0.6, rise: 4.5, size: 1.1 }), 600 + i * 500);
    } else {
      // Le noir se referme autour de ton roi
      const dark = el(clip, 'fx-ocean-dark', { left: `${kx}px`, top: `${ky}px`, width: `${s * 1.7}px`, height: `${s * 1.7}px`, boxShadow: `0 0 0 ${W * 2.2}px rgba(1,6,14,.9), inset 0 0 ${s * 0.5}px ${s * 0.35}px rgba(1,6,14,.9)` });
      dark.animate([{ transform: 'translate(-50%,-50%) scale(7)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 1500, easing: 'cubic-bezier(.3,0,.3,1)', fill: 'forwards' });
      fades.push(dark);
      // Des lueurs des profondeurs qui dérivent
      for (let i = 0, n = lite(20); i < n; i++) {
        const r = rand(2, 4.5);
        const sp = el(clip, 'fx-ocean-speck', { left: `${rand(0.03, 0.97) * W}px`, top: `${rand(0.1, 1) * W}px`, width: `${r}px`, height: `${r}px` });
        once(sp, [{ opacity: 0, transform: 'translate(0,0)' }, { opacity: rand(0.5, 1), offset: 0.3 }, { opacity: 0, transform: `translate(${rand(-0.3, 0.3) * s}px, ${-rand(0.5, 1.5) * s}px)` }], { duration: rand(2500, 4000), delay: 700 + rand(0, 1200), fill: 'both' });
      }
      // L'œil du kraken s'ouvre loin du roi, cligne, puis le fixe
      const eyeY = ky > W / 2 ? W * 0.22 : W * 0.78;
      const eye = el(clip, 'fx-ocean-eye', { left: `${W * 0.5}px`, top: `${eyeY}px`, width: `${W * 0.36}px`, height: `${W * 0.18}px`, zIndex: 7 }, EYE);
      eye.animate(
        [
          { transform: 'translate(-50%,-50%) scaleY(0)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scaleY(0)', opacity: 1, offset: 0.2 },
          { transform: 'translate(-50%,-50%) scaleY(1)', opacity: 1, offset: 0.36 },
          { transform: 'translate(-50%,-50%) scaleY(1)', opacity: 1, offset: 0.55 },
          { transform: 'translate(-50%,-50%) scaleY(.08)', opacity: 1, offset: 0.6 },
          { transform: 'translate(-50%,-50%) scaleY(1)', opacity: 1, offset: 0.66 },
          { transform: 'translate(-50%,-50%) scaleY(1)', opacity: 0.85 },
        ],
        { duration: 3600, delay: 500, easing: 'ease-in-out', fill: 'forwards' },
      );
      fades.push(eye);
      const look = (kx - W * 0.5) / W;
      eye.querySelector('.pupil').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(0)', offset: 0.7 }, { transform: `translate(${(look * 30).toFixed(1)}px, ${ky > eyeY ? 5 : -5}px)` }], { duration: 3600, delay: 500, fill: 'forwards' });
      // Les tentacules sortent de la case et entraînent ton roi
      const T = 1900;
      // La boîte des tentacules (leur « sol ») est sous le roi ; au bord du haut, elle descend pour rester visible
      const TH = 1.3; // hauteur des tentacules, en cases
      const boxTop = Math.max(0, ky + s / 2 - s * TH);
      for (const [off, h, flip, i] of [[-0.55, 1.15, false, 0], [-0.18, 1.0, false, 1], [0.18, 1.08, true, 2], [0.55, 1.22, true, 3]]) {
        const box = el(clip, 'fx-ocean-tentacle-box', { left: `${kx - s}px`, top: `${boxTop}px`, width: `${s * 2}px`, height: `${s * TH}px`, overflow: 'hidden', zIndex: 8 });
        const t = el(box, 'fx-ocean-tentacle', { left: `${s + off * s - s * 0.24}px`, bottom: '0', width: `${s * 0.48}px`, height: `${h * s}px`, transformOrigin: '50% 100%' }, TENTACLE(flip));
        t.animate(
          [
            { transform: 'translateY(100%) rotate(0deg)' },
            { transform: `translateY(8%) rotate(${flip ? 6 : -6}deg)`, offset: 0.35 },
            { transform: `translateY(0) rotate(${flip ? -5 : 5}deg)`, offset: 0.55 },
            { transform: `translateY(4%) rotate(${flip ? 3 : -3}deg)`, offset: 0.7 },
            { transform: 'translateY(100%) rotate(0deg)' },
          ],
          { duration: 2900, delay: T - 900 + i * 90, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' },
        );
      }
      king.animate(
        [
          { transform: 'none', clipPath: 'inset(-30% -30% 0 -30%)', filter: 'none' },
          { transform: 'translateX(-4%) rotate(-5deg)', clipPath: 'inset(-30% -30% 0 -30%)', offset: 0.18 },
          { transform: 'translateX(4%) rotate(5deg)', clipPath: 'inset(-30% -30% 0 -30%)', offset: 0.3 },
          { transform: 'translateX(-3%) rotate(-3deg)', clipPath: 'inset(-30% -30% 0 -30%)', filter: 'brightness(.8)', offset: 0.42 },
          { transform: 'translateY(0)', clipPath: 'inset(-30% -30% 0 -30%)', filter: 'brightness(.7)', offset: 0.52 },
          { transform: 'translateY(70%) rotate(-12deg)', clipPath: 'inset(-30% -30% 70% -30%)', filter: 'brightness(.35)' },
        ],
        { duration: 2400, delay: T - 300, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' },
      );
      later(() => seaBubbles(clip, kx, ky + s * 0.2, s, 18, { spread: 0.5, rise: 2.6, span: 900 }), T + 900);
    }

    // Le titre
    later(() => {
      const sub = outcome === 'win' ? 'Victoire' : lose ? 'Défaite' : `${loser === 'w' ? 'Les Noirs' : 'Les Blancs'} gagnent`;
      const banner = el(over, 'fx-mate-banner ocean ' + outcome, { fontSize: `${Math.max(24, W * 0.1)}px` }, `<div class="t">Échec et mat</div><div class="s">${sub}</div>`);
      banner.animate(
        calm
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: 'translateY(8%) scale(.85)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: calm ? 300 : 1100, easing: 'cubic-bezier(.2,.8,.3,1.1)', fill: 'both' },
      );
      later(() => {
        once(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
        for (const f of fades) once(f, [{ opacity: getComputedStyle(f).opacity }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
      }, 5200);
    }, calm ? 300 : lose ? 3400 : 1300);
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
      if (move.captured) {
        if (eq.capture === 'classic') classicCaptureFx(move);
        else if (eq.capture === 'royal') captureFx(move, true); // l'ancienne prise (éclats) avec les particules d'or
        else if (eq.capture === 'japon') japonCaptureFx(move);
        else if (eq.capture === 'western') westernCaptureFx(move);
        else if (eq.capture === 'ocean') oceanCaptureFx(move);
        else spaceCaptureFx(move);
      }
      const kSq = move.san.includes('+') || mated ? kingSquare(chess, loser) : null;
      if (mated && kSq) {
        if (classicEnd) classicMateFx(move, kSq, loser, outcome, gen);
        else if (eq.endAnim === 'royal') royalMateFx(move, kSq, kingSquare(chess, loser === 'w' ? 'b' : 'w'), loser, outcome, gen);
        else if (eq.endAnim === 'japon') japonMateFx(move, kSq, loser, outcome, gen, kingSquare(chess, loser === 'w' ? 'b' : 'w'));
        else if (eq.endAnim === 'western') westernMateFx(move, kSq, loser, outcome, gen);
        else if (eq.endAnim === 'ocean') oceanMateFx(move, kSq, loser, outcome, gen, kingSquare(chess, loser === 'w' ? 'b' : 'w'));
        else spaceMateFx(move, kSq, loser, outcome, gen, kingSquare(chess, loser === 'w' ? 'b' : 'w'));
      }
      else if (kSq) (classicEnd ? classicCheckFx : eq.endAnim === 'japon' ? japonCheckFx : eq.endAnim === 'western' ? westernCheckFx : eq.endAnim === 'ocean' ? oceanCheckFx : checkFx)(kSq);
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
