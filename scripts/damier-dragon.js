// Génère le motif du damier « Epic Dragon » (public/img/damier-dragon.svg) : une tuile de 2 × 2 cases,
// posée par-dessus le damier (CSS .board-dragon cg-board).
// - Cases claires (en haut à gauche, en bas à droite) : pierre de cendre chaude, écailles de dragon à peine gravées.
// - Cases foncées (en haut à droite, en bas à gauche) : obsidienne fendue de veines de lave qui rougeoient.
// Des braises montent par-dessus tout le plateau (CSS, cg-board::before).
// Utilisation : node scripts/damier-dragon.js
const fs = require('fs');
const path = require('path');

const f = (n) => Math.round(n * 100) / 100;
let seed = 23;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function light() {
  // Écailles : des arcs en quinconce, très discrets
  let d = '';
  for (let row = 0; row < 8; row++) {
    const y = 8 + row * 12;
    for (let x = row % 2 ? -6 : 0; x < 100; x += 12) d += `M${x} ${y}a6 6 0 0 0 12 0`;
  }
  return `<rect width="100" height="100" fill="url(#gl)"/>`
    + `<path d="${d}" fill="none" stroke="#7a3f12" stroke-opacity=".13" stroke-width="1.3"/>`
    + `<rect width="100" height="100" fill="url(#gv)"/>`;
}

/** Veine de lave : une ligne brisée qui se ramifie. */
function crack(x, y, ang, len, depth) {
  let d = `M${f(x)} ${f(y)}`;
  let out = '';
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    ang += (rnd() - 0.5) * 1.1;
    x += Math.cos(ang) * (len / n);
    y += Math.sin(ang) * (len / n);
    d += ` L${f(x)} ${f(y)}`;
    if (depth > 0 && rnd() < 0.35) out += crack(x, y, ang + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.45, depth - 1);
  }
  return `<path d="${d}"/>` + out;
}

function dark() {
  const veins = crack(4, 22 + rnd() * 20, 0.35, 70, 2) + crack(96, 70 + rnd() * 20, Math.PI + 0.3, 62, 2) + crack(40 + rnd() * 20, 98, -Math.PI / 2 + 0.2, 44, 1);
  return `<rect width="100" height="100" fill="url(#gd)"/>`
    + `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`
    + `<g stroke="#ff4d12" stroke-width="5" opacity=".5" filter="url(#bl)">${veins}</g>`
    + `<g stroke="#ff8a2a" stroke-width="2.2">${veins}</g>`
    + `<g stroke="#ffe08a" stroke-width=".8">${veins}</g></g>`
    + `<rect width="100" height="100" fill="url(#gv)"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`
  + `<radialGradient id="gl" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#f3dcb4"/><stop offset=".6" stop-color="#e2bf8c"/><stop offset="1" stop-color="#cfa16b"/></radialGradient>`
  + `<radialGradient id="gd" cx=".4" cy=".3" r="1"><stop offset="0" stop-color="#3f2024"/><stop offset=".55" stop-color="#2a1418"/><stop offset="1" stop-color="#160a0c"/></radialGradient>`
  + `<radialGradient id="gv" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a0c02" stop-opacity=".22"/></radialGradient>`
  + `<filter id="bl" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>`
  + `<clipPath id="c"><rect width="100" height="100"/></clipPath>`
  + `<g id="d" clip-path="url(#c)">${dark()}</g>`
  + `<g id="d2" clip-path="url(#c)">${dark()}</g>`
  + `<g id="l" clip-path="url(#c)">${light()}</g>`
  + `</defs><use href="#l"/><use href="#d" x="100"/><use href="#d2" y="100"/><use href="#l" x="100" y="100"/></svg>\n`;

const out = path.join(__dirname, '..', 'public/img/damier-dragon.svg');
fs.writeFileSync(out, svg);
console.log(`Motif du damier Dragon écrit dans public/img/damier-dragon.svg (${svg.length} octets)`);
