// Génère le motif du damier « Epic Dragon » (public/img/damier-dragon.svg) : une tuile de 2 × 2 cases,
// posée par-dessus le damier (CSS .board-dragon cg-board).
// - Cases foncées (en haut à droite, en bas à gauche) : peau de dragon, écailles rouge sang qui se chevauchent
//   comme des tuiles, chacune avec son reflet.
// - Cases claires (en haut à gauche, en bas à droite) : os et ivoire, les mêmes écailles à peine gravées.
// Des braises montent par-dessus tout le plateau (CSS, cg-board::before).
// Utilisation : node scripts/damier-dragon.js
const fs = require('fs');
const path = require('path');

const R = 10; // rayon d'une écaille (5 écailles par rangée dans une case de 100)
/** Rangées d'écailles, de bas en haut : chaque rangée recouvre le bas de celle du dessous (les pointes vers le bas). */
function scaleRows(draw) {
  let out = '';
  for (let row = 11; row >= -1; row--) {
    const y = row * (R * 0.85);
    for (let x = row % 2 ? 0 : R; x <= 100 + R; x += 2 * R) out += draw(x, y);
  }
  return out;
}

function dark() {
  return `<rect width="100" height="100" fill="#4a0d0a"/>`
    + scaleRows((x, y) => `<path d="M${x - R} ${y} Q${x - R} ${y + R * 1.25} ${x} ${y + R * 1.7} Q${x + R} ${y + R * 1.25} ${x + R} ${y} Z" fill="url(#sd)" stroke="#260404" stroke-width="1.1"/>`
      + `<path d="M${x - R * 0.55} ${y + R * 0.45} Q${x - R * 0.5} ${y + R * 1.05} ${x} ${y + R * 1.32}" fill="none" stroke="#ff8a5a" stroke-opacity=".35" stroke-width="1.1" stroke-linecap="round"/>`)
    + `<rect width="100" height="100" fill="url(#gv)"/>`;
}

function light() {
  return `<rect width="100" height="100" fill="url(#gl)"/>`
    + scaleRows((x, y) => `<path d="M${x - R} ${y} Q${x - R} ${y + R * 1.25} ${x} ${y + R * 1.7} Q${x + R} ${y + R * 1.25} ${x + R} ${y}" fill="none" stroke="#8a4a1c" stroke-opacity=".14" stroke-width="1.1"/>`)
    + `<rect width="100" height="100" fill="url(#gv)"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`
  + `<radialGradient id="gl" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#fbf0dc"/><stop offset=".6" stop-color="#eedbb8"/><stop offset="1" stop-color="#dcc196"/></radialGradient>`
  + `<radialGradient id="sd" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="#c8321c"/><stop offset=".55" stop-color="#8c1a10"/><stop offset="1" stop-color="#4a0806"/></radialGradient>`
  + `<radialGradient id="gv" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a0602" stop-opacity=".25"/></radialGradient>`
  + `<clipPath id="c"><rect width="100" height="100"/></clipPath>`
  + `<g id="d" clip-path="url(#c)">${dark()}</g>`
  + `<g id="l" clip-path="url(#c)">${light()}</g>`
  + `</defs><use href="#l"/><use href="#d" x="100"/><use href="#d" y="100"/><use href="#l" x="100" y="100"/></svg>\n`;

const out = path.join(__dirname, '..', 'public/img/damier-dragon.svg');
fs.writeFileSync(out, svg);
console.log(`Motif du damier Dragon écrit dans public/img/damier-dragon.svg (${svg.length} octets)`);
