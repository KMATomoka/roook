// Génère le motif du damier « Western chess » (public/img/damier-western.svg) : une tuile de 2 × 2 cases,
// posée par-dessus le damier (CSS .board-western cg-board).
// - Cases terre cuite (en haut à droite, en bas à gauche) : motif navajo (losanges en escalier).
// - Cases turquoise (en haut à gauche, en bas à droite) : grains de sable du désert.
// Utilisation : node scripts/damier-western.js
const fs = require('fs');
const path = require('path');

const f = (n) => Math.round(n * 100) / 100;
// Hasard reproductible : la tuile est la même à chaque génération
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Losange en escalier (motif navajo) centré en (cx, cy), demi-largeur r, marches de taille st. */
function steppedDiamond(cx, cy, r, st) {
  const n = Math.round(r / st);
  const pts = [];
  // du sommet vers la droite, en escalier, puis tout le tour
  for (let i = 0; i <= n; i++) pts.push([cx + i * st, cy - r + i * st], [cx + (i + 1) * st, cy - r + i * st]);
  pts.length = pts.length - 1;
  const q1 = pts; // haut droite (du sommet vers la pointe de droite)
  const q2 = q1.map(([x, y]) => [x, 2 * cy - y]).reverse(); // bas droite
  const q3 = q1.map(([x, y]) => [2 * cx - x, 2 * cy - y]); // bas gauche
  const q4 = q1.map(([x, y]) => [2 * cx - x, y]).reverse(); // haut gauche
  return 'M' + [...q1, ...q2, ...q3, ...q4].map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
}

function navajo() {
  // Un grand losange en escalier au centre, un plus petit dedans, et des bandes en dents de scie en haut et en bas
  const big = steppedDiamond(50, 50, 30, 6);
  const small = steppedDiamond(50, 50, 12, 6);
  let zig = '';
  for (const y of [9, 91]) {
    zig += `M0 ${y}`;
    for (let x = 0; x < 100; x += 10) zig += `L${x + 5} ${y + (y < 50 ? -4 : 4)}L${x + 10} ${y}`;
  }
  return `<g fill="none" stroke="rgba(255,236,210,.24)" stroke-width="1.3" stroke-linejoin="miter">`
    + `<path d="${big}"/><path d="${small}"/><path d="${zig}"/></g>`
    + `<path d="${small}" fill="rgba(60,20,8,.12)" stroke="none"/>`;
}

function sand() {
  let dark = '';
  let light = '';
  for (let i = 0; i < 46; i++) dark += `<circle cx="${f(rnd() * 100)}" cy="${f(rnd() * 100)}" r="${f(0.45 + rnd() * 0.7)}"/>`;
  for (let i = 0; i < 18; i++) light += `<circle cx="${f(rnd() * 100)}" cy="${f(rnd() * 100)}" r="${f(0.5 + rnd() * 0.6)}"/>`;
  return `<g fill="rgba(24,92,82,.2)">${dark}</g><g fill="rgba(255,255,250,.5)">${light}</g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`
  + `<clipPath id="c"><rect width="100" height="100"/></clipPath>`
  + `<g id="dark" clip-path="url(#c)">${navajo()}</g>`
  + `<g id="light" clip-path="url(#c)">${sand()}</g>`
  + `</defs><use href="#dark" x="100"/><use href="#dark" y="100"/><use href="#light"/><use href="#light" x="100" y="100"/></svg>\n`;

const out = path.join(__dirname, '..', 'public/img/damier-western.svg');
fs.writeFileSync(out, svg);
console.log(`Motif du damier Western écrit dans public/img/damier-western.svg (${svg.length} octets)`);
