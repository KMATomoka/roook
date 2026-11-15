// Génère les pièces du pack « Océan » (public/img/pieces-ocean/*.svg).
// Blancs en nacre irisée, Noirs en bleu des abysses aux contours qui luisent (halo flou cyan).
// Pion perle, tour de corail à hublot, fou coquillage, cavalier hippocampe mythique, dame couronne de perles, roi trident.
// Utilisation : node scripts/pieces-ocean.js
const fs = require('fs');
const path = require('path');

const PAL = {
  w: { top: '#ffffff', sheen: '#f7e4ef', mid: '#d9ecf3', bot: '#93b6cc', stroke: '#1f4259', acc: '#f3b4ca', acc2: '#3fb6c8', pearl: '#ffffff', dark: '#1f4259', glow: null },
  b: { top: '#2f7da1', sheen: '#1d6288', mid: '#0e3955', bot: '#03111e', stroke: '#86f3ff', acc: '#46e6d4', acc2: '#7ff0ff', pearl: '#c9fbff', dark: '#021019', glow: '#3fe0ff' },
};

/** Trait épais cerclé (contour + dégradé), pour le trident et le corail. */
const dbl = (d, c, w = 4, col = 'url(#gu)') =>
  `<path d="${d}" fill="none" stroke="${c.stroke}" stroke-width="${w + 3.4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Socle, avec une vague. */
const base = (c) => `<path d="M23 88.5 Q23 81.5 31 81 H69 Q77 81.5 77 88.5 Q77 94 71 94 H29 Q23 94 23 88.5Z" fill="url(#g)"/>
  <path d="M28.5 88 Q33.5 85 38.5 88 T48.5 88 T58.5 88 T68.5 88 T72 87.5" fill="none" stroke="${c.acc2}" stroke-width="1.7"/>`;

const PIECES = {
  // Pion : une perle posée dans un coquillage
  p: (c) => `${base(c)}
  <path d="M35 81 Q37 70 44 64 H56 Q63 70 65 81Z" fill="url(#g)"/>
  <rect x="39" y="59.5" width="22" height="5.5" rx="2.75" fill="url(#g)"/>
  <path d="M36.5 60 Q39 52.5 50 53 Q61 52.5 63.5 60 Q57 64 50 63 Q43 64 36.5 60Z" fill="${c.acc}" stroke-width="1.7"/>
  <path d="M42.5 62 L44.5 55.5 M50 63 V54 M57.5 62 L55.5 55.5" stroke-width="1.1" opacity=".6"/>
  <circle cx="50" cy="41.5" r="13" fill="url(#pr)"/>
  <ellipse cx="45" cy="36.5" rx="4.2" ry="2.6" fill="#fff" opacity=".8" stroke="none" transform="rotate(-30 45 36.5)"/>`,

  // Tour : tour de corail, avec un hublot
  r: (c) => `${base(c)}
  ${dbl('M33 79 C29.5 72 27 67 26.5 59 M28.5 70 C24.5 67 22.5 63.5 22.5 59.5', c, 2.4, c.acc)}
  <path d="M31 81 L34.5 47 H65.5 L69 81Z" fill="url(#g)"/>
  <path d="M29 48 V28.5 H37.5 V35 H45.5 V28.5 H54.5 V35 H62.5 V28.5 H71 V48Z" fill="url(#g)"/>
  <path d="M33.5 52.5 Q39 48.5 44.5 52.5 T55.5 52.5 T66.5 52.5" fill="none" stroke="${c.acc2}" stroke-width="2.2"/>
  <circle cx="50" cy="66" r="7" fill="${c.dark}" stroke-width="2.4"/>
  <circle cx="50" cy="66" r="4.2" fill="${c.acc2}" opacity=".6" stroke="none"/>
  <path d="M46.8 63.3 Q48.6 61.8 50.8 62.4" stroke="#fff" stroke-width="1.3" fill="none" opacity=".85"/>
  <g fill="${c.acc}" stroke-width="1"><circle cx="64" cy="74" r="1.8"/><circle cx="60.5" cy="77.5" r="1.3"/><circle cx="38" cy="42" r="1.4"/></g>`,

  // Cavalier : hippocampe mythique (cheval marin : oreilles en nageoires, crinière membraneuse, écailles)
  n: (c) => `${base(c)}
  <path d="M34 81 Q37 69 43 63 H60 Q65 69 67 81Z" fill="url(#g)"/>
  <path d="M62 18 C72.5 17 80.5 25.5 79.5 36 C79 46 74 54 67 58.5 L65.5 50 C68.5 42 69.5 30 61 22Z" fill="${c.acc}" stroke-width="1.6"/>
  <path d="M64 21 L75 24 M66.5 27 L79 32 M68 34 L79.5 39 M68.3 41 L77.5 47 M67.6 47.5 L73.5 54" stroke-width="1" opacity=".55"/>
  <path d="M40 22 L34.5 10.5 L40.5 14 L42.5 7 L46.5 14 L51.5 10 L50.5 18.5Z" fill="${c.acc}" stroke-width="1.5"/>
  <path d="M42 60.5 C40 52 41 46 45 41 C40 42 34 45 29.5 46.5 C26 47.5 23 45.5 23.5 42 C24 38.5 27 36 31 33 C35 30 38 26 41 21.5 C46 17 56 15 63 18.5 C70 22.5 72.5 33 70 43 C68 49 66 54 65 60.5Z" fill="url(#g)"/>
  <rect x="38" y="58.5" width="28" height="5.5" rx="2.75" fill="url(#g)"/>
  <circle cx="51" cy="70.5" r="2.7" fill="url(#pr)" stroke-width="1.3"/>
  <path d="M47 46 a2.8 2.8 0 0 0 5.6 0 a2.8 2.8 0 0 0 5.6 0 a2.8 2.8 0 0 0 5.6 0 M44.5 50.5 a2.8 2.8 0 0 0 5.6 0 a2.8 2.8 0 0 0 5.6 0 a2.8 2.8 0 0 0 5.6 0 a2.8 2.8 0 0 0 5.6 0 M46 55 a2.8 2.8 0 0 0 5.6 0 a2.8 2.8 0 0 0 5.6 0 a2.8 2.8 0 0 0 5.6 0" fill="none" stroke="${c.acc2}" stroke-width="1.3"/>
  <path d="M38.5 28.8 Q41.2 26.4 44 28.6 Q41.2 30.6 38.5 28.8Z" fill="${c.dark}" stroke-width="1"/>
  <circle cx="27" cy="41.5" r="1.1" fill="${c.dark}" stroke="none"/>
  <path d="M25 44.8 Q27.5 45.4 29.5 44.4" fill="none" stroke-width="1.1" opacity=".7"/>
  <path d="M30 46.5 C29 50 31 52 33.5 52.5" fill="none" stroke="${c.acc}" stroke-width="1.4"/>
  <ellipse cx="54" cy="24" rx="2" ry="5" fill="#fff" opacity=".4" stroke="none" transform="rotate(60 54 24)"/>`,

  // Fou : coquillage en spirale (turritelle), une perle au sommet
  b: (c) => `${base(c)}
  <path d="M38 81 Q41 69 45 63.5 H55 Q59 69 62 81Z" fill="url(#g)"/>
  <rect x="39" y="58.5" width="22" height="5.5" rx="2.75" fill="url(#g)"/>
  <path d="M50 12 C59 21 64.5 33.5 63 45.5 C62 54 57 59 50 59 C43 59 38 54 37 45.5 C35.5 33.5 41 21 50 12Z" fill="url(#g)"/>
  <path d="M37.6 47 Q50 41 62.6 46.5 M39 36.5 Q50 30.5 61.6 36 M42.5 26.5 Q50 22 57.5 26 M46.3 18.5 Q50 16 53.8 18" fill="none" stroke="${c.acc2}" stroke-width="1.9"/>
  <path d="M51 58 C46.5 53 46 46 49.5 41.5" fill="none" stroke-width="1.2" opacity=".5"/>
  <ellipse cx="44" cy="33" rx="2.3" ry="6" fill="#fff" opacity=".45" stroke="none" transform="rotate(14 44 33)"/>
  <circle cx="50" cy="9.5" r="3.4" fill="url(#pr)" stroke-width="1.5"/>`,

  // Dame : couronne à pointes, une perle sur chaque pointe
  q: (c) => `${base(c)}
  <path d="M34 81 Q38 66 44 58.5 H56 Q62 66 66 81Z" fill="url(#g)"/>
  <rect x="36" y="53" width="28" height="6" rx="3" fill="url(#g)"/>
  <path d="M36.5 54 L30 29 L40.5 41.5 L41 24 L48 39 L50 18 L52 39 L59 24 L59.5 41.5 L70 29 L63.5 54Z" fill="url(#g)"/>
  <path d="M36 49 Q43 45.5 50 49 T64 49" fill="none" stroke="${c.acc2}" stroke-width="1.9"/>
  ${[[30, 27, 3.3], [41, 21.5, 3.3], [50, 15, 4], [59, 21.5, 3.3], [70, 27, 3.3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#pr)" stroke-width="1.5"/>`).join('')}
  <circle cx="50" cy="43" r="2.7" fill="${c.acc}" stroke-width="1.3"/>
  <path d="M46 70 Q50 66.5 54 70" fill="none" stroke="${c.acc2}" stroke-width="1.6" opacity=".8"/>`,

  // Roi : couronne surmontée d'un trident
  k: (c) => `${base(c)}
  <path d="M33 81 Q37 67 43 59 H57 Q63 67 67 81Z" fill="url(#g)"/>
  <rect x="35" y="54" width="30" height="6" rx="3" fill="url(#g)"/>
  ${dbl('M50 42 V14', c, 3.6)}
  ${dbl('M39 22 V28.5 Q39 35 50 35 Q61 35 61 28.5 V22', c, 3.2)}
  <path d="M50 4 L55.5 14 H44.5Z" fill="url(#gu)"/><path d="M39 13 L43.2 22.5 H34.8Z" fill="url(#gu)"/><path d="M61 13 L65.2 22.5 H56.8Z" fill="url(#gu)"/>
  <path d="M37 55 L35 42 Q50 37 65 42 L63 55Z" fill="url(#g)"/>
  <path d="M37.5 49 Q43.8 45.5 50 49 T62.5 49" fill="none" stroke="${c.acc2}" stroke-width="1.9"/>
  <circle cx="50" cy="35" r="3" fill="url(#pr)" stroke-width="1.3"/>
  <path d="M46 70 Q50 66.5 54 70" fill="none" stroke="${c.acc2}" stroke-width="1.6" opacity=".8"/>`,
};

function svg(col, t) {
  const c = PAL[col];
  const draw = PIECES[t](c);
  // Noirs : une copie floue du contour, en cyan, sous la pièce (les créatures des profondeurs qui luisent)
  const glow = c.glow ? `<g class="gl" filter="url(#bl)" opacity=".75" stroke-width="3.6">${draw}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="0.3" stop-color="${c.sheen}"/><stop offset="0.6" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.bot}"/></linearGradient>
    <linearGradient id="gu" gradientUnits="userSpaceOnUse" x1="35" y1="4" x2="62" y2="60"><stop offset="0" stop-color="${c.top}"/><stop offset="0.4" stop-color="${c.sheen}"/><stop offset="1" stop-color="${c.mid}"/></linearGradient>
    <radialGradient id="pr" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="${c.pearl}"/><stop offset=".45" stop-color="${c.sheen}"/><stop offset="1" stop-color="${c.bot}"/></radialGradient>
    ${c.glow ? `<filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.5"/></filter><style>.gl *{fill:none!important;stroke:${c.glow}!important}</style>` : ''}
    </defs>${glow}<g stroke="${c.stroke}" stroke-width="2.3" stroke-linejoin="round">${draw}</g></svg>`
    .replace(/\s*\n\s*/g, ' ');
}

const out = path.join(__dirname, '..', 'public/img/pieces-ocean');
fs.mkdirSync(out, { recursive: true });
const NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
let n = 0;
for (const col of ['w', 'b']) {
  for (const t of 'pnbrqk') {
    fs.writeFileSync(path.join(out, col + NAMES[t] + '.svg'), svg(col, t) + '\n');
    n++;
  }
}
console.log(`${n} pièces Océan écrites dans public/img/pieces-ocean`);
