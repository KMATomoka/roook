// Génère le motif du damier « Océan » (public/img/damier-ocean.svg) : une tuile de 2 × 2 cases,
// posée par-dessus le damier (CSS .board-ocean cg-board).
// - Cases claires (en haut à gauche, en bas à droite) : eau claire, réseau de reflets de lumière.
// - Cases foncées (en haut à droite, en bas à gauche) : eau profonde, quelques petites bulles.
// Utilisation : node scripts/damier-ocean.js
const fs = require('fs');
const path = require('path');

const f = (n) => Math.round(n * 100) / 100;
// Hasard reproductible : la tuile est la même à chaque génération
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function light() {
  // Reflets : des lignes souples qui se croisent, comme la lumière au fond d'un lagon
  const net = 'M0 30Q20 17 43 33T100 27M0 74Q27 61 50 77T100 70M30 0Q17 23 37 47T27 100M74 0Q83 27 67 50T77 100';
  return `<rect width="100" height="100" fill="url(#gl)"/>`
    + `<path d="${net}" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round"/>`;
}

function dark() {
  let bubbles = '';
  for (let i = 0; i < 9; i++) {
    const r = 0.9 + rnd() * 1.6;
    bubbles += `<circle cx="${f(6 + rnd() * 88)}" cy="${f(6 + rnd() * 88)}" r="${f(r)}"/>`;
  }
  return `<rect width="100" height="100" fill="url(#gd)"/>`
    + `<g fill="rgba(200,245,255,.28)">${bubbles}</g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`
  + `<radialGradient id="gl" cx=".3" cy=".15" r="1"><stop offset="0" stop-color="#e3f8f8"/><stop offset=".6" stop-color="#b5e3ea"/><stop offset="1" stop-color="#9dd3df"/></radialGradient>`
  + `<radialGradient id="gd" cx=".35" cy=".1" r="1"><stop offset="0" stop-color="#2a83a8"/><stop offset=".55" stop-color="#17648a"/><stop offset="1" stop-color="#0f4c6c"/></radialGradient>`
  + `<clipPath id="c"><rect width="100" height="100"/></clipPath>`
  + `<g id="d" clip-path="url(#c)">${dark()}</g>`
  + `<g id="l" clip-path="url(#c)">${light()}</g>`
  + `</defs><use href="#l"/><use href="#d" x="100"/><use href="#d" y="100"/><use href="#l" x="100" y="100"/></svg>\n`;

const out = path.join(__dirname, '..', 'public/img/damier-ocean.svg');
fs.writeFileSync(out, svg);
console.log(`Motif du damier Océan écrit dans public/img/damier-ocean.svg (${svg.length} octets)`);
