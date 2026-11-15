// Génère les pièces du pack Royal (public/img/pieces-royal/*.svg) à partir des dessins de la maquette
// (public/maquette-royale.html), pour que les deux restent identiques.
// Utilisation : node scripts/pieces-royal.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/maquette-royale.html'), 'utf8');
const start = html.indexOf('const PAL = {');
const end = html.indexOf('const IMG = {};');
if (start < 0 || end < 0) throw new Error('Générateur de pièces introuvable dans la maquette');
const pieceUrl = new Function(html.slice(start, end) + '; return pieceSvg;')();

const out = path.join(root, 'public/img/pieces-royal');
fs.mkdirSync(out, { recursive: true });
const NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
let n = 0;
for (const col of ['w', 'b']) {
  for (const t of 'pnbrqk') {
    // La maquette renvoie url("data:image/svg+xml,…") : on en extrait le SVG
    const m = /^url\("data:image\/svg\+xml,(.*)"\)$/.exec(pieceUrl(col, t));
    if (!m) throw new Error('Format inattendu pour ' + col + t);
    const svg = decodeURIComponent(m[1]).trim();
    if (!svg.startsWith('<svg')) throw new Error('SVG invalide pour ' + col + t);
    fs.writeFileSync(path.join(out, col + NAMES[t] + '.svg'), svg + '\n');
    n++;
  }
}
console.log(`${n} pièces royales écrites dans public/img/pieces-royal`);
