// Génère les pièces du pack « Western chess » (public/img/pieces-western/*.svg).
// Couleurs du Sud-Ouest : Blancs turquoise (bijoux navajos), Noirs terre cuite (roches rouges des canyons).
// Pion à foulard, fou à étoile, tour en façade de saloon, cavalier géométrique (style navajo), dame à couronne de balles, roi couronné de l'étoile du shérif.
// Utilisation : node scripts/pieces-western.js
const fs = require('fs');
const path = require('path');

const PAL = {
  // Blancs : turquoise, trait sarcelle foncé
  w: { top: '#effdf9', mid: '#a9e2d8', bot: '#4fa89a', ink: '#123a35', line: '#123a35', red: '#c4402c', metal: '#e8edf0', brass: '#d9a441', stud: '#c4402c', mane: '#1f5c54', band: '#123a35' },
  // Noirs : terre cuite, liseré os
  b: { top: '#d9875a', mid: '#9c4424', bot: '#4a1a0b', ink: '#f8e3c6', line: '#f8e3c6', red: '#f0c25a', metal: '#f8e3c6', brass: '#f0c25a', stud: '#5cc8b8', mane: '#2e0f05', band: '#f8e3c6' },
};
const f = (n) => Math.round(n * 100) / 100;

/** Socle, avec une couture de cuir (pointillés). */
const base = (c) => `
  <path d="M20 92H80Q84 92 84 88.5Q84 85 80 85H20Q16 85 16 88.5Q16 92 20 92Z" fill="url(#g)"/>
  <path d="M21.5 88.5H78.5" stroke="${c.line}" stroke-width="1.3" stroke-dasharray="2.4 2.2" stroke-linecap="round" opacity="0.8"/>`;

/** Étoile de shérif à six branches, boules au bout des branches. */
function sheriffStar(cx, cy, r, c, fill = c.brass) {
  let d = '';
  const balls = [];
  for (let i = 0; i < 12; i++) {
    const a = ((-90 + i * 30) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.52 : r;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    if (!(i % 2)) balls.push(`<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(r * 0.17)}"/>`);
  }
  return `<g fill="${fill}" stroke="${c.ink}" stroke-width="1.2"><path d="${d}Z"/>${balls.join('')}</g>`;
}

/** Corde (cordelette tressée) sur une ligne horizontale. */
const rope = (x1, x2, y, c) => `<path d="M${x1} ${y}H${x2}" stroke="${c.line}" stroke-width="1.1" stroke-dasharray="1.8 1.6" stroke-linecap="round"/>`;

const PIECES = {
  // Pion : silhouette classique, foulard noué, clou turquoise
  p: (c) => `${base(c)}
  <path d="M33 85C33 76 38 69 43 65H57C62 69 67 76 67 85Z" fill="url(#g)"/>
  <path d="M38 65.5H62Q64.5 62.5 62 59.5H38Q35.5 62.5 38 65.5Z" fill="url(#g)"/>
  ${rope(38.5, 61.5, 62.5, c)}
  <circle cx="50" cy="47" r="12.5" fill="url(#g)"/>
  <path d="M43.5 66L50 73L56.5 66Z" fill="${c.red}" stroke-width="1.4"/>
  <circle cx="50" cy="78.5" r="2.4" fill="${c.stud}" stroke-width="1"/>`,

  // Cavalier : tête de cheval géométrique (tout en angles, à la manière de l'art navajo),
  // crinière en dents de scie, couverture de selle à motif et plume
  n: (c) => {
    // crinière : dents de scie le long de la nuque
    let mane = 'M57 21';
    const pts = [[64, 24], [61, 30], [68, 34], [64, 40], [71, 45], [66.5, 50], [72.5, 56], [67.5, 61], [72, 67]];
    for (const [x, y] of pts) mane += `L${x} ${y}`;
    mane += 'L69 69L63.5 36Z';
    return `${base(c)}
  <path d="M30 85V75H70V85Z" fill="url(#g)"/>
  <path d="M33 75L38 55L36.5 51L27 55.5L22 52.5L22.5 45L31.5 31L44 22.5L50.5 21L53 11L57.5 20.5L64 34L69.5 55L70 75Z" fill="url(#g)"/>
  <path d="${mane}" fill="${c.red}" stroke-width="1.4"/>
  <path d="M31 75L33.5 66H69L70.5 75Z" fill="${c.stud}" stroke-width="1.6"/>
  <path d="M34 70.5L37 68L40 70.5L43 68L46 70.5L49 68L52 70.5L55 68L58 70.5L61 68L64 70.5L67 68" fill="none" stroke="${c.ink}" stroke-width="1.1"/>
  <path d="M40.5 31.5L44.5 28.5L48.5 31.5L44.5 34.5Z" fill="${c.ink}" stroke="none"/>
  <path d="M25 49.5L28.5 48.5" stroke="${c.line}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M36.5 51L38 55" stroke="${c.line}" stroke-width="1.2"/>
  <path d="M53 11Q61 8.5 63.5 14.5Q59 13.5 56 16Z" fill="${c.brass}" stroke-width="1.1"/>
  <path d="M53.5 12.5L61 12.2" stroke="${c.ink}" stroke-width="0.7"/>`;
  },

  // Fou : mitre classique entaillée, étoile au sommet
  b: (c) => `${base(c)}
  <path d="M36 85C37 76 41.5 68 44 63H56C58.5 68 63 76 64 85Z" fill="url(#g)"/>
  <path d="M39 63.5H61Q63 60.5 61 57.5H39Q37 60.5 39 63.5Z" fill="url(#g)"/>
  ${rope(39.5, 60.5, 60.5, c)}
  <path d="M50 21C56 26.5 63 34.5 63 44C63 52 57.5 57.5 50 57.5C42.5 57.5 37 52 37 44C37 34.5 44 26.5 50 21Z" fill="url(#g)"/>
  <path d="M44 46.5L55.5 34.5" fill="none" stroke="${c.red}" stroke-width="3.6" stroke-linecap="round"/>
  ${sheriffStar(50, 15.5, 5.2, c)}
  <circle cx="50" cy="75" r="2.3" fill="${c.stud}" stroke-width="1"/>`,

  // Tour : façade de saloon (grand fronton en bois, enseigne à étoile, fenêtres, portes battantes)
  r: (c) => `${base(c)}
  <path d="M33 85V50H67V85Z" fill="url(#g)"/>
  <path d="M30 51.5V31.5Q30 28 33.5 27.5Q37 21.5 43 23.5Q46.5 17.5 50 17.5Q53.5 17.5 57 23.5Q63 21.5 66.5 27.5Q70 28 70 31.5V51.5Z" fill="url(#g)"/>
  <path d="M29 51.5H71V55.5H29Z" fill="url(#g)"/>
  <path d="M35 32.5H65V44.5H35Z" fill="${c.mane}" stroke-width="1.6"/>
  ${sheriffStar(50, 38.5, 4.6, c, c.brass)}
  <path d="M38 38.5H43M57 38.5H62" stroke="${c.metal}" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M33.5 59.5H41.5V67.5H33.5ZM58.5 59.5H66.5V67.5H58.5Z" fill="${c.stud}" stroke-width="1.5"/>
  <path d="M37.5 59.5V67.5M62.5 59.5V67.5" stroke="${c.ink}" stroke-width="1"/>
  <path d="M44 85V64H56V85Z" fill="${c.mane}" stroke-width="1.6"/>
  <path d="M44.5 69H49.6V79H44.5ZM50.4 69H55.5V79H50.4Z" fill="url(#g)" stroke-width="1.2"/>
  <path d="M33 72.5H42M58 72.5H67" stroke="${c.line}" stroke-width="0.9" opacity="0.6"/>`,

  // Dame : couronne de balles (douilles en laiton, ogives en cuivre), plus grande que les autres pièces
  q: (c) => {
    let bullets = '';
    for (const [ang, top] of [[-32, 28], [-16, 19], [0, 13], [16, 19], [32, 28]]) {
      bullets += `<g transform="rotate(${ang} 50 63)" stroke-width="1.3"><path d="M46.5 51V${top + 11}H53.5V51Z" fill="${c.brass}"/><path d="M45.6 ${top + 12.6}H54.4" stroke-width="1.5"/><path d="M46.5 ${top + 11}Q46.5 ${top + 2.5} 50 ${top}Q53.5 ${top + 2.5} 53.5 ${top + 11}Z" fill="#c4683a"/></g>`;
    }
    return `${base(c)}
  ${bullets}
  <path d="M31 85C32 73 37.5 62 41.5 55H58.5C62.5 62 68 73 69 85Z" fill="url(#g)"/>
  <path d="M35.5 56.5H64.5Q67 53 64.5 49H35.5Q33 53 35.5 56.5Z" fill="url(#g)"/>
  <g fill="${c.stud}" stroke-width="1"><circle cx="41" cy="52.8" r="2"/><circle cx="50" cy="52.8" r="2.2"/><circle cx="59" cy="52.8" r="2"/></g>
  <path d="M40 72.5Q50 77.5 60 72.5" fill="none" stroke="${c.line}" stroke-width="1.6"/>`;
  },

  // Roi : silhouette classique, couronne surmontée de l'étoile du shérif
  k: (c) => `${base(c)}
  <path d="M32.5 85C33.5 72 38 60 41 50H59C62 60 66.5 72 67.5 85Z" fill="url(#g)"/>
  <path d="M36.5 50.5H63.5Q66 47 63.5 43.5H36.5Q34 47 36.5 50.5Z" fill="url(#g)"/>
  <g fill="${c.stud}" stroke-width="0.9"><circle cx="42" cy="47" r="1.7"/><circle cx="50" cy="47" r="1.9"/><circle cx="58" cy="47" r="1.7"/></g>
  <path d="M38 43.5L34.5 28.5L43 34.5L50 26L57 34.5L65.5 28.5L62 43.5Z" fill="url(#g)"/>
  ${sheriffStar(50, 15, 8.6, c)}
  <path d="M41.5 70.5Q50 75 58.5 70.5" fill="none" stroke="${c.line}" stroke-width="1.6"/>`,
};

function svg(col, t) {
  const c = PAL[col];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="0.45" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.bot}"/></linearGradient></defs><g stroke="${c.ink}" stroke-width="2.3" stroke-linejoin="round">${PIECES[t](c)}</g></svg>`
    .replace(/\n\s*/g, ' ');
}

const out = path.join(__dirname, '..', 'public/img/pieces-western');
fs.mkdirSync(out, { recursive: true });
const NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
let n = 0;
for (const col of ['w', 'b']) {
  for (const t of 'pnbrqk') {
    fs.writeFileSync(path.join(out, col + NAMES[t] + '.svg'), svg(col, t) + '\n');
    n++;
  }
}
console.log(`${n} pièces Western écrites dans public/img/pieces-western`);
