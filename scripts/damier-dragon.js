// Génère le motif du damier « Epic Dragon » (public/img/damier-dragon.svg) : une tuile de 2 × 2 cases,
// posée par-dessus le damier (CSS .board-dragon cg-board). Le trésor du dragon :
// - Cases claires (en haut à gauche, en bas à droite) : marbre d'or, veines claires et douces.
// - Cases foncées (en haut à droite, en bas à gauche) : marbre d'obsidienne, fines veines de braise et d'or.
// Chaque case est cerclée d'un mince filet d'or, comme une dalle sertie.
// Des braises montent par-dessus tout le plateau (CSS, cg-board::before).
// Utilisation : node scripts/damier-dragon.js
const fs = require('fs');
const path = require('path');

const f = (n) => Math.round(n * 10) / 10;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Une veine de marbre : une courbe souple qui traverse la case, avec parfois une branche. */
function vein() {
  let x = rnd() < 0.5 ? -5 : rnd() * 100;
  let y = x < 0 ? rnd() * 100 : -5;
  let ang = x < 0 ? rnd() * 0.9 - 0.2 : Math.PI / 2 + rnd() * 0.9 - 0.45;
  let d = `M${f(x)} ${f(y)}`;
  let branch = '';
  for (let i = 0; i < 6; i++) {
    const a2 = ang + (rnd() - 0.5) * 0.9;
    const len = 14 + rnd() * 12;
    const cx = x + Math.cos(ang) * len * 0.5;
    const cy = y + Math.sin(ang) * len * 0.5;
    x += Math.cos(a2) * len;
    y += Math.sin(a2) * len;
    d += ` Q${f(cx)} ${f(cy)} ${f(x)} ${f(y)}`;
    ang = a2;
    if (!branch && i > 1 && rnd() < 0.4) {
      const ba = ang + (rnd() < 0.5 ? 0.8 : -0.8);
      branch = `M${f(x)} ${f(y)} Q${f(x + Math.cos(ba) * 8)} ${f(y + Math.sin(ba) * 8)} ${f(x + Math.cos(ba + 0.3) * 18)} ${f(y + Math.sin(ba + 0.3) * 18)}`;
    }
  }
  return d + ' ' + branch;
}

function square(kind) {
  const veins = [vein(), vein(), vein()];
  const light = kind === 'l';
  const lines = veins
    .map((d, i) =>
      light
        ? `<path d="${d}" stroke="#fff6dc" stroke-opacity="${i ? 0.35 : 0.6}" stroke-width="${i ? 0.8 : 1.4}"/>`
        : `<path d="${d}" stroke="#ff7a2a" stroke-opacity="${i ? 0.25 : 0.55}" stroke-width="${i ? 0.7 : 1.2}"/>` + (i ? '' : `<path d="${d}" stroke="#ffd98a" stroke-opacity=".5" stroke-width=".4"/>`),
    )
    .join('');
  return `<rect width="100" height="100" fill="url(#${light ? 'gl' : 'gd'})"/>`
    + `<g fill="none" stroke-linecap="round">${lines}</g>`
    + `<rect width="100" height="100" fill="url(#gv)"/>`
    // filet d'or (clair en haut à gauche, sombre en bas à droite : une dalle légèrement en relief)
    + `<path d="M1 99 V1 H99" fill="none" stroke="#ffe6a0" stroke-opacity="${light ? 0.75 : 0.55}" stroke-width="1.6"/>`
    + `<path d="M1 99 H99 V1" fill="none" stroke="#7a4a10" stroke-opacity="${light ? 0.55 : 0.8}" stroke-width="1.6"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`
  + `<linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc9a"/><stop offset=".5" stop-color="#e6bd68"/><stop offset="1" stop-color="#cf9a45"/></linearGradient>`
  + `<linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2228"/><stop offset=".5" stop-color="#22121a"/><stop offset="1" stop-color="#140a0e"/></linearGradient>`
  + `<radialGradient id="gv" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient>`
  + `<clipPath id="c"><rect width="100" height="100"/></clipPath>`
  + `<g id="l1" clip-path="url(#c)">${square('l')}</g>`
  + `<g id="l2" clip-path="url(#c)">${square('l')}</g>`
  + `<g id="d1" clip-path="url(#c)">${square('d')}</g>`
  + `<g id="d2" clip-path="url(#c)">${square('d')}</g>`
  + `</defs><use href="#l1"/><use href="#d1" x="100"/><use href="#d2" y="100"/><use href="#l2" x="100" y="100"/></svg>\n`;

const out = path.join(__dirname, '..', 'public/img/damier-dragon.svg');
fs.writeFileSync(out, svg);
console.log(`Motif du damier Dragon écrit dans public/img/damier-dragon.svg (${svg.length} octets)`);
