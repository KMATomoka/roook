// Génère le damier en bois (public/img/damier-bois.svg) : érable clair et noyer foncé, grain fin et droit,
// comme un vrai damier en marqueterie (toutes les cases ont le fil dans le même sens).
// Une seule image pour tout le plateau (a8 clair en haut à gauche ; le damier est le même retourné, donc il va aussi
// quand on joue les Noirs). Chaque case a son propre grain (décalage du bruit) et une teinte qui varie un peu,
// comme des pièces de bois assemblées. Utilisation : node scripts/damier-bois.js
const fs = require('fs');
const path = require('path');

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const S = 100; // taille d'une case dans l'image

const LIGHT = ['#e4c393', '#e8c899', '#dfbc8a', '#e6c596'];
const DARK = ['#7a4a2b', '#734428', '#80502f', '#6d4024'];

let squares = '';
for (let r = 0; r < 8; r++) {
  for (let f = 0; f < 8; f++) {
    const light = (r + f) % 2 === 0;
    const fill = (light ? LIGHT : DARK)[Math.floor(rand() * 4)];
    // Le grain : un décalage différent par case, et des cases dont le fil va dans l'autre sens
    const dx = Math.floor(rand() * 600);
    const dy = Math.floor(rand() * 600);
    const vertical = true; // fil vertical partout, comme sur la photo
    // Le rectangle est décalé dans le motif (translate) puis remis sur sa case ; certaines cases tournent d'un quart
    const cx = f * S + S / 2;
    const cy = r * S + S / 2;
    const tr = `${vertical ? `rotate(90 ${cx} ${cy}) ` : ''}translate(${dx} ${dy})`;
    squares += `<rect x="${f * S}" y="${r * S}" width="${S}" height="${S}" fill="${fill}"/>`
      + `<rect x="${f * S - dx}" y="${r * S - dy}" width="${S}" height="${S}" fill="url(#${light ? 'gl' : 'gd'})" transform="${tr}"/>`;
  }
}
// Motif de grain : rendu une fois (bruit étiré), répété ; on le décale par case avec la position du motif
const grain = (id, rgb, alpha, freq, sd) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="400" height="400">
  <rect width="400" height="400" filter="url(#f${id})"/>
</pattern>
<filter id="f${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${sd}" stitchTiles="stitch"/>
  <feColorMatrix type="matrix" values="0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  0 0 0 ${alpha[0]} ${alpha[1]}"/>
</filter>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" preserveAspectRatio="none">
<defs>
${grain('gl', [0.5, 0.32, 0.15], [-2.3, 1.05], '0.003 0.22', 3)}
${grain('gd', [0.16, 0.07, 0.02], [-2.1, 1.1], '0.003 0.2', 8)}
</defs>
${squares}
<g fill="none" stroke="#3a1a0a" stroke-opacity=".18" stroke-width="1">${Array.from({ length: 7 }, (_, i) => `<path d="M${(i + 1) * S} 0 V800 M0 ${(i + 1) * S} H800"/>`).join('')}</g>
</svg>
`;
const out = path.join(__dirname, '..', 'public/img/damier-bois.svg');
fs.writeFileSync(out, svg);
console.log('Damier en bois écrit dans public/img/damier-bois.svg (' + svg.length + ' octets)');
