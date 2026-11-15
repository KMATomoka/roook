// Génère le motif du damier « Sakura chess » (public/img/damier-japon.svg) : une tuile de 2 × 2 cases,
// posée par-dessus le damier (CSS .board-japon cg-board).
// - Cases indigo (en haut à droite, en bas à gauche) : vagues seigaiha.
// - Cases roses (en haut à gauche, en bas à droite) : asanoha, l'étoile en feuille de chanvre.
// Utilisation : node scripts/damier-japon.js
const fs = require('fs');
const path = require('path');

const INDIGO = '#6683c4'; // = --sq-dark de .board-japon (bleu « ai » clair, pour que les pièces indigo ressortent)
const WAVE_LINE = 'rgba(255,255,255,.16)';
const ASANOHA_LINE = '#ffffff'; // blanc : motif « papier washi » ton sur ton, sans voile rouge
const f = (n) => Math.round(n * 100) / 100;

// Seigaiha : rangées de demi-cercles concentriques qui se recouvrent
function seigaiha() {
  const R = 12.5;
  let uses = '';
  for (let row = 0, y = -R / 2; y <= 100 + R; y += R / 2, row++) {
    for (let x = (row % 2) * R; x <= 100 + R; x += 2 * R) uses += `<use href="#w" x="${x}" y="${y}"/>`;
  }
  return uses;
}

// Asanoha : grille de triangles équilatéraux ; dans chaque triangle, les côtés et les trois traits
// sommet → centre dessinent les étoiles à six branches.
function asanoha() {
  const a = 100 / 3; // côté d'un triangle (3 par case)
  const h = (a * Math.sqrt(3)) / 2;
  let d = '';
  for (let r = -1; r * h <= 100 + h; r++) {
    const y0 = r * h;
    const y1 = y0 + h;
    const off = r % 2 === 0 ? 0 : a / 2;
    for (let x = -a + off; x <= 100 + a; x += a) {
      // triangle pointe en haut : (x, y1) (x+a, y1) (x+a/2, y0) ; pointe en bas : (x+a/2, y0) (x+a*1.5, y0) (x+a, y1)
      for (const t of [
        [[x, y1], [x + a, y1], [x + a / 2, y0]],
        [[x + a / 2, y0], [x + a * 1.5, y0], [x + a, y1]],
      ]) {
        const gx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const gy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        d += `M${f(t[0][0])} ${f(t[0][1])}L${f(t[1][0])} ${f(t[1][1])}L${f(t[2][0])} ${f(t[2][1])}Z`;
        for (const [px, py] of t) d += `M${f(px)} ${f(py)}L${f(gx)} ${f(gy)}`;
      }
    }
  }
  return d;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`
  + `<g id="w" fill="${INDIGO}" stroke="${WAVE_LINE}" stroke-width="1.1"><circle r="12.5"/><circle r="8.5"/><circle r="4.5"/></g>`
  + `<clipPath id="c"><rect width="100" height="100"/></clipPath>`
  + `<g id="dark" clip-path="url(#c)">${seigaiha()}</g>`
  + `<g id="light" clip-path="url(#c)"><path d="${asanoha()}" fill="none" stroke="${ASANOHA_LINE}" stroke-width=".7" stroke-linejoin="round" opacity=".5"/></g>`
  + `</defs><use href="#dark" x="100"/><use href="#dark" y="100"/><use href="#light"/><use href="#light" x="100" y="100"/></svg>\n`;

const out = path.join(__dirname, '..', 'public/img/damier-japon.svg');
fs.writeFileSync(out, svg);
console.log(`Motif du damier Sakura écrit dans public/img/damier-japon.svg (${svg.length} octets)`);
