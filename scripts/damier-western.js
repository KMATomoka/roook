// Génère le motif du damier « Western chess » (public/img/damier-western.svg) : une tuile de 2 × 2 cases,
// posée par-dessus le damier (CSS .board-western cg-board).
// - Cases cuir (en haut à droite, en bas à gauche) : planches de saloon (joints, grain du bois, clous).
// - Cases sable (en haut à gauche, en bas à droite) : grains de sable.
// Utilisation : node scripts/damier-western.js
const fs = require('fs');
const path = require('path');

const f = (n) => Math.round(n * 100) / 100;
// Hasard reproductible : la tuile est la même à chaque génération
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function planks() {
  let seams = '';
  let grain = '';
  let nails = '';
  const ends = [38, 74, 18, 58];
  for (let i = 0; i < 4; i++) {
    const y0 = i * 25;
    if (i) seams += `M0 ${y0}H100`;
    seams += `M${ends[i]} ${y0}V${y0 + 25}`;
    // Fil du bois : deux lignes ondulées par planche
    for (const k of [0.33, 0.68]) {
      const y = y0 + 25 * k + (rnd() - 0.5) * 3;
      grain += `M0 ${f(y)}Q25 ${f(y + (rnd() - 0.5) * 5)} 50 ${f(y)}T100 ${f(y + (rnd() - 0.5) * 2)}`;
    }
    // Clous de part et d'autre du joint
    for (const x of [ends[i] - 3.5, ends[i] + 3.5]) {
      nails += `<circle cx="${f(x)}" cy="${y0 + 7}" r="1.1"/><circle cx="${f(x)}" cy="${y0 + 18}" r="1.1"/>`;
    }
  }
  return `<path d="${seams}" stroke="rgba(45,22,6,.42)" stroke-width="1.3" fill="none"/>`
    + `<path d="${grain}" stroke="rgba(45,22,6,.2)" stroke-width=".7" fill="none"/>`
    + `<g fill="rgba(255,226,170,.5)">${nails}</g>`;
}

function sand() {
  let dark = '';
  let light = '';
  for (let i = 0; i < 46; i++) dark += `<circle cx="${f(rnd() * 100)}" cy="${f(rnd() * 100)}" r="${f(0.45 + rnd() * 0.7)}"/>`;
  for (let i = 0; i < 18; i++) light += `<circle cx="${f(rnd() * 100)}" cy="${f(rnd() * 100)}" r="${f(0.5 + rnd() * 0.6)}"/>`;
  return `<g fill="rgba(140,88,38,.28)">${dark}</g><g fill="rgba(255,250,232,.45)">${light}</g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`
  + `<clipPath id="c"><rect width="100" height="100"/></clipPath>`
  + `<g id="dark" clip-path="url(#c)">${planks()}</g>`
  + `<g id="light" clip-path="url(#c)">${sand()}</g>`
  + `</defs><use href="#dark" x="100"/><use href="#dark" y="100"/><use href="#light"/><use href="#light" x="100" y="100"/></svg>\n`;

const out = path.join(__dirname, '..', 'public/img/damier-western.svg');
fs.writeFileSync(out, svg);
console.log(`Motif du damier Western écrit dans public/img/damier-western.svg (${svg.length} octets)`);
