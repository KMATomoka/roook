// Génère les pièces du pack « Western chess » (public/img/pieces-western/*.svg).
// Couleurs du Sud-Ouest : Blancs turquoise (bijoux navajos), Noirs terre cuite (roches rouges des canyons).
// Silhouettes d'échecs classiques, détails western : pion à foulard, tour au fer à cheval, fou à étoile,
// cavalier à bandana, dame à couronne de balles, roi couronné de l'étoile du shérif.
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

  // Cavalier : tête de cheval, bandana rouge au cou, bride à clous
  n: (c) => `${base(c)}
  <path d="M27 85H73Q74 80 70 78H30Q26 80 27 85Z" fill="url(#g)"/>
  <path d="M70 78C74 60 72 37 58.5 22.5L57.5 11L49.5 19C41 20.5 33.5 26.5 29.5 34L21.5 49.5C19.5 54.5 23 59.5 29 58L39 53C43 52 46 54.5 45 58C41 64 36.5 70.5 34.5 78Z" fill="url(#g)"/>
  <path d="M58.5 22.5Q66.5 21.5 64.5 29Q72 29.5 68.8 37.5Q75.5 39.5 71.3 46.5Q77 50.5 72.2 56Q77.2 61 72.2 65.5Q76.2 70.5 71 74.5L70 78C74 60 72 37 58.5 22.5Z" fill="${c.mane}"/>
  <path d="M44.2 59.5Q55 66 70.5 63L69.5 69.5Q58 71 47 66Z" fill="${c.red}" stroke-width="1.4"/>
  <path d="M51 67.5L47.5 76L55.5 71.5Z" fill="${c.red}" stroke-width="1.2"/>
  <path d="M26.5 47L42.5 39.5" fill="none" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="34.5" cy="43.3" r="1.7" fill="${c.stud}" stroke-width="0.8"/>
  <circle cx="42.5" cy="39.5" r="1.9" fill="${c.stud}" stroke-width="0.8"/>
  <path d="M40.5 33.6L45.5 31" fill="none" stroke="${c.line}" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="27.6" cy="50.4" r="1.3" fill="${c.line}" stroke="none"/>
  <path d="M57.5 11C61 7 66 6.5 69 9C65.5 9.5 63 11.5 61.5 15Z" fill="url(#g)"/>`,

  // Fou : mitre classique entaillée, étoile au sommet
  b: (c) => `${base(c)}
  <path d="M36 85C37 76 41.5 68 44 63H56C58.5 68 63 76 64 85Z" fill="url(#g)"/>
  <path d="M39 63.5H61Q63 60.5 61 57.5H39Q37 60.5 39 63.5Z" fill="url(#g)"/>
  ${rope(39.5, 60.5, 60.5, c)}
  <path d="M50 21C56 26.5 63 34.5 63 44C63 52 57.5 57.5 50 57.5C42.5 57.5 37 52 37 44C37 34.5 44 26.5 50 21Z" fill="url(#g)"/>
  <path d="M44 46.5L55.5 34.5" fill="none" stroke="${c.red}" stroke-width="3.6" stroke-linecap="round"/>
  ${sheriffStar(50, 15.5, 5.2, c)}
  <circle cx="50" cy="75" r="2.3" fill="${c.stud}" stroke-width="1"/>`,

  // Tour : tour crénelée classique, fer à cheval sur le corps
  r: (c) => `${base(c)}
  <path d="M34.5 85L37.5 54H62.5L65.5 85Z" fill="url(#g)"/>
  <path d="M30 54V31H38V37.5H46V31H54V37.5H62V31H70V54Z" fill="url(#g)"/>
  <path d="M30 54H70V58.5H30Z" fill="url(#g)"/>
  ${rope(31, 69, 56.3, c)}
  <path d="M43.5 64.5V71A6.5 6.5 0 0 0 56.5 71V64.5" fill="none" stroke="${c.ink}" stroke-width="5.4" stroke-linecap="round"/>
  <path d="M43.5 64.5V71A6.5 6.5 0 0 0 56.5 71V64.5" fill="none" stroke="${c.metal}" stroke-width="3.2" stroke-linecap="round"/>
  <g fill="${c.ink}" stroke="none"><circle cx="43.5" cy="68" r=".75"/><circle cx="56.5" cy="68" r=".75"/><circle cx="45.4" cy="74.6" r=".75"/><circle cx="54.6" cy="74.6" r=".75"/></g>`,

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
