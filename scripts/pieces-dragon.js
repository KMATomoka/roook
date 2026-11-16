// Génère les pièces du pack « Epic Dragon » (public/img/pieces-dragon/*.svg).
// Blancs en or et ivoire écaillés, Noirs en obsidienne aux contours de braise (halo flou orange).
// Pion œuf de dragon serré dans des griffes, tour forteresse volcanique (porte de feu, fissures de lave),
// fou mitre de flammes, cavalier tête de dragon cornue, dame couronne aux ailes de dragon, roi couronne à cornes
// et œil de dragon surmonté d'une flamme.
// Utilisation : node scripts/pieces-dragon.js
const fs = require('fs');
const path = require('path');

const PAL = {
  w: { top: '#ffffff', sheen: '#fff4dc', mid: '#f5d9a2', bot: '#b7793a', stroke: '#3d1a06', acc: '#ff6a1f', acc2: '#ffc63a', scale: '#c0802e', eye: '#ff3b10', dark: '#2a1004', glow: null },
  b: { top: '#6a4a5a', sheen: '#432a37', mid: '#21121a', bot: '#060205', stroke: '#ff8a3d', acc: '#ff4d1a', acc2: '#ffb347', scale: '#c2501f', eye: '#ffd23a', dark: '#060205', glow: '#ff5a1f' },
};

/** Trait épais cerclé (contour + couleur). */
const dbl = (d, c, w = 4, col = 'url(#gu)') =>
  `<path d="${d}" fill="none" stroke="${c.stroke}" stroke-width="${w + 3.4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Rangées d'écailles (petits arcs) entre x0 et x1. */
const scales = (c, rows, x0, x1, r = 2.6) =>
  rows
    .map(([y, shift]) => {
      let d = '';
      for (let x = x0 + (shift ? r : 0); x + 2 * r <= x1 + 0.01; x += 2 * r) d += `M${x.toFixed(1)} ${y} a${r} ${r} 0 0 0 ${2 * r} 0 `;
      return d;
    })
    .map((d) => `<path d="${d}" fill="none" stroke="${c.scale}" stroke-width="1.15" opacity=".85"/>`)
    .join('');
/** Socle de pierre, une rangée de flammes. */
const base = (c) => `<path d="M22 88.5 Q22 81 30 80.5 H70 Q78 81 78 88.5 Q78 94 72 94 H28 Q22 94 22 88.5Z" fill="url(#g)"/>
  <path d="M28 88.5 L31.5 85.5 L34 88.5 L37.5 85 L40.5 88.5 L44 84.5 L47 88.5 L50 84 L53 88.5 L56 84.5 L59.5 88.5 L62.5 85 L66 88.5 L68.5 85.5 L72 88.5" fill="none" stroke="${c.acc}" stroke-width="1.7" stroke-linejoin="round"/>`;
/** Petite flamme (goutte qui ondule). */
const flame = (x, y, h, fill) =>
  `<path d="M${x} ${y - h} C${x + h * 0.32} ${y - h * 0.62} ${x + h * 0.45} ${y - h * 0.4} ${x + h * 0.3} ${y - h * 0.12} C${x + h * 0.2} ${y + h * 0.05} ${x + h * 0.08} ${y + h * 0.1} ${x} ${y + h * 0.1} C${x - h * 0.1} ${y + h * 0.1} ${x - h * 0.24} ${y + h * 0.02} ${x - h * 0.3} ${y - h * 0.15} C${x - h * 0.4} ${y - h * 0.42} ${x - h * 0.2} ${y - h * 0.55} ${x - h * 0.12} ${y - h * 0.4} C${x - h * 0.08} ${y - h * 0.62} ${x - h * 0.06} ${y - h * 0.8} ${x} ${y - h}Z" fill="${fill}"/>`;

const PIECES = {
  // Pion : un œuf de dragon fendu (le feu brille dedans), serré dans trois griffes
  p: (c) => `${base(c)}
  <path d="M35 80.5 Q38 70 44 65 H56 Q62 70 65 80.5Z" fill="url(#g)"/>
  <ellipse cx="50" cy="44" rx="14.5" ry="18.5" fill="url(#g)"/>
  ${scales(c, [[34, 0], [40, 1], [46, 0], [52, 1]], 38, 62, 2.6)}
  <path d="M45 27.5 L48.5 33 L45.5 37 L50.5 41.5 L48.5 45" fill="none" stroke="${c.acc}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M45 27.5 L48.5 33 L45.5 37 L50.5 41.5 L48.5 45" fill="none" stroke="#ffe9a0" stroke-width=".8" stroke-linejoin="round" opacity=".9"/>
  <path d="M36.5 67 C31.5 61 31 52 35.5 45.5 C36.5 52 38.5 58 42.5 63Z" fill="${c.acc2}" stroke-width="1.5"/>
  <path d="M63.5 67 C68.5 61 69 52 64.5 45.5 C63.5 52 61.5 58 57.5 63Z" fill="${c.acc2}" stroke-width="1.5"/>
  <path d="M46.5 64.5 C46 59 47.5 55 50 52 C52.5 55 54 59 53.5 64.5Z" fill="${c.acc2}" stroke-width="1.5"/>
  <ellipse cx="44" cy="35" rx="3" ry="6" fill="#fff" opacity=".5" stroke="none" transform="rotate(20 44 35)"/>`,

  // Tour : forteresse volcanique, porte en arc où brûle un feu, fissures de lave
  r: (c) => `${base(c)}
  <path d="M31 80.5 L34.5 47 H65.5 L69 80.5Z" fill="url(#g)"/>
  <path d="M29 48 V28.5 H37.5 V35 H45.5 V28.5 H54.5 V35 H62.5 V28.5 H71 V48Z" fill="url(#g)"/>
  <path d="M35 41.5 H65 M33.5 55 H66.5 M32.6 64 H67.4" fill="none" stroke="${c.scale}" stroke-width="1.2" opacity=".8"/>
  <path d="M41 55 V64 M58 55 V64 M50 41.5 V48" fill="none" stroke="${c.scale}" stroke-width="1.2" opacity=".8"/>
  <path d="M38.5 48 L41.5 52.5 L39 56.5 L42.5 60.5" fill="none" stroke="${c.acc}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M62 47 L59 51 L61.5 55" fill="none" stroke="${c.acc}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M43 80.5 V71 Q50 62.5 57 71 V80.5Z" fill="${c.dark}"/>
  ${flame(50, 79.5, 13, c.acc)}${flame(50, 79.5, 7.5, '#ffd36b')}
  ${flame(33.2, 27.5, 7, c.acc)}${flame(66.8, 27.5, 7, c.acc)}`,

  // Cavalier : tête de dragon de profil, gueule ouverte (crocs, langue de feu), deux longues cornes
  // rejetées en arrière, arcade sourcilière menaçante, crête d'épines le long du cou, écailles
  n: (c) => `${base(c)}
  <path d="M34 80.5 Q37 69 43 63 H61 Q66 69 68 80.5Z" fill="url(#g)"/>
  <path d="M71 29 L80.5 31.5 L72.5 36 L81 40.5 L72 44 L79 49.5 L70.5 52.5 L76 58 L68 60Z" fill="${c.acc}" stroke-width="1.6"/>
  <path d="M51 18 C58 9 70 4.5 85 5.5 C74 9 65 14 59.5 22Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M60 23.5 C67.5 18.5 77.5 18 87.5 22 C77.5 22.5 70 25.5 64.5 30Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M16.5 36.5 C25 38.5 35 40.5 45 45 L43 51 C35.5 51 27.5 51.5 20 53Z" fill="${c.dark}"/>
  ${flame(19, 46.5, 9, c.acc)}
  <path d="M45 45 C38.5 46 31.5 47.5 25 50.5 L19.5 53 C17.5 54 18 57 20.5 57 C28 56.5 36 54 43 51.5Z" fill="url(#g)"/>
  <path d="M42 63 C42 56 43 50.5 46 46 C41 41 34.5 38.5 28 38.5 L17.5 37.5 C14.5 37.3 13.5 34.5 15.5 32.8 L24 26.8 C29 23.4 34 21.8 39 21 C45 15 53 12.8 60.5 15 C68.5 17.8 72.5 26 72.5 35 C72.5 46 70.5 54.5 67 63Z" fill="url(#g)"/>
  <path d="M19 37.6 L20.2 41 L21.6 37.8 L23 41.3 L24.4 38.1 L25.9 41.5 L27.4 38.4" fill="#fff" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M22.5 52.4 L23.8 49.4 L25.3 52 L26.8 48.9 L28.3 51.4" fill="#fff" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M47 45 L54.5 49.5 L46.5 50.5Z" fill="${c.acc2}" stroke-width="1.3"/>
  ${scales(c, [[48, 1], [53.5, 0], [59, 1]], 47, 68, 2.6)}
  <path d="M32 25.5 L47 21" fill="none" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M35 28.6 Q40 24.4 45.5 26.4 Q41.5 30.8 35 28.6Z" fill="${c.eye}" stroke-width="1.2"/>
  <ellipse cx="41" cy="27.5" rx=".9" ry="2.1" fill="${c.dark}" stroke="none" transform="rotate(15 41 27.5)"/>
  <circle cx="19" cy="32.5" r="1.2" fill="${c.dark}" stroke="none"/>
  <path d="M56 31 C59 36 60 41 59 46" fill="none" stroke-width="1.2" opacity=".55"/>
  <ellipse cx="57" cy="21" rx="2" ry="5" fill="#fff" opacity=".4" stroke="none" transform="rotate(60 57 21)"/>`,

  // Fou : mitre en forme de flamme, couverte d'écailles, entaille de braise
  b: (c) => `${base(c)}
  <path d="M38 80.5 Q41 69 45 63.5 H55 Q59 69 62 80.5Z" fill="url(#g)"/>
  <rect x="39" y="58.5" width="22" height="5.5" rx="2.75" fill="url(#g)"/>
  <path d="M50 8 C55.5 17 64 23.5 63.5 40 C63 51 57.5 58.5 50 59 C42.5 58.5 37 51 36.5 40 C36 30 41.5 25.5 43.5 17.5 C45.5 21.5 46.8 24.5 48 27 C49 21 49.2 14.5 50 8Z" fill="url(#g)"/>
  ${scales(c, [[44, 0], [50, 1]], 39.5, 60.5, 2.6)}
  <path d="M50 28 C53.5 34.5 57.5 38 56.5 45 C56 50.5 53.5 54 50 54 C46.5 54 43.8 50.8 43.8 46.5 C43.8 41 48 37 50 28Z" fill="${c.acc}" stroke-width="1.6"/>
  <path d="M50 39 C51.5 42.5 53.5 44.5 53 48 C52.6 50.6 51.5 52 50 52 C48.5 52 47.2 50.6 47.2 48.6 C47.2 45.5 49 43 50 39Z" fill="#ffd36b" stroke="none"/>
  <ellipse cx="44" cy="35" rx="2.2" ry="6" fill="#fff" opacity=".45" stroke="none" transform="rotate(14 44 35)"/>`,

  // Dame : couronne flanquée de deux ailes de dragon, joyaux de feu, larme de feu au centre
  q: (c) => {
    const wing = `<path d="M39.5 51 C31 47.5 22.5 39.5 17.5 26 C23 29.5 27 29.5 30 26.5 C31 31.5 34 33.8 37.5 33.5 C37.5 40 38.5 46 41.5 50Z" fill="${c.acc2}" stroke-width="1.6"/>
      <path d="M38.5 49.5 C32 42 25 35 18.5 27.5 M38 45 C34.5 40 31.5 34 30 27.5 M38.5 41 L37.6 34" fill="none" stroke-width="1.1" opacity=".75"/>`;
    return `${base(c)}
  ${wing}<g transform="translate(100 0) scale(-1 1)">${wing}</g>
  <path d="M34 80.5 Q38 66 44 58.5 H56 Q62 66 66 80.5Z" fill="url(#g)"/>
  <rect x="36" y="53" width="28" height="6" rx="3" fill="url(#g)"/>
  <path d="M37 54 L33 30 L42 40.5 L45 23.5 L50 36 L55 23.5 L58 40.5 L67 30 L63 54Z" fill="url(#g)"/>
  ${scales(c, [[46, 0]], 38.5, 61.5, 2.6)}
  ${[[33, 28.5, 2.8], [45, 21.5, 2.8], [55, 21.5, 2.8], [67, 28.5, 2.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.acc}" stroke-width="1.4"/>`).join('')}
  ${flame(50, 22, 12, c.acc)}${flame(50, 21, 6.5, '#ffd36b')}
  <path d="M46 70 Q50 66.5 54 70" fill="none" stroke="${c.acc}" stroke-width="1.6" opacity=".85"/>`;
  },

  // Roi : couronne à deux grandes cornes, œil de dragon au centre, une flamme au sommet
  k: (c) => `${base(c)}
  <path d="M38 50 C29.5 44 26.5 33 31 21.5 C32 30 36 36.5 43 41Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M62 50 C70.5 44 73.5 33 69 21.5 C68 30 64 36.5 57 41Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M33 81 Q37 67 43 59 H57 Q63 67 67 81Z" fill="url(#g)"/>
  <rect x="35" y="54" width="30" height="6" rx="3" fill="url(#g)"/>
  <path d="M37 55 L35 40 Q50 34 65 40 L63 55Z" fill="url(#g)"/>
  ${scales(c, [[46, 0], [51, 1]], 38, 62, 2.6)}
  <circle cx="50" cy="31" r="7.2" fill="url(#ey)" stroke-width="1.6"/>
  <ellipse cx="50" cy="31" rx="1.4" ry="5" fill="${c.dark}" stroke="none"/>
  <ellipse cx="47.6" cy="28.4" rx="1.7" ry="1" fill="#fff" opacity=".75" stroke="none"/>
  ${flame(50, 21.5, 13, c.acc)}${flame(50, 21, 7, '#ffd36b')}
  <path d="M46 70 Q50 66.5 54 70" fill="none" stroke="${c.acc}" stroke-width="1.6" opacity=".85"/>`,
};

function svg(col, t) {
  const c = PAL[col];
  const draw = PIECES[t](c);
  // Noirs : une copie floue du contour, en orange braise, sous la pièce (l'obsidienne qui rougeoie)
  const glow = c.glow ? `<g class="gl" filter="url(#bl)" opacity=".8" stroke-width="3.6">${draw}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="0.3" stop-color="${c.sheen}"/><stop offset="0.6" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.bot}"/></linearGradient>
    <linearGradient id="gu" gradientUnits="userSpaceOnUse" x1="35" y1="4" x2="62" y2="60"><stop offset="0" stop-color="${c.top}"/><stop offset="0.4" stop-color="${c.sheen}"/><stop offset="1" stop-color="${c.mid}"/></linearGradient>
    <radialGradient id="ey" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fff3a0"/><stop offset=".45" stop-color="#ffb020"/><stop offset="1" stop-color="#c43006"/></radialGradient>
    ${c.glow ? `<filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter><style>.gl *{fill:none!important;stroke:${c.glow}!important}</style>` : ''}
    </defs>${glow}<g stroke="${c.stroke}" stroke-width="2.3" stroke-linejoin="round">${draw}</g></svg>`
    .replace(/\s*\n\s*/g, ' ');
}

const out = path.join(__dirname, '..', 'public/img/pieces-dragon');
fs.mkdirSync(out, { recursive: true });
const NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
let n = 0;
for (const col of ['w', 'b']) {
  for (const t of 'pnbrqk') {
    fs.writeFileSync(path.join(out, col + NAMES[t] + '.svg'), svg(col, t) + '\n');
    n++;
  }
}
console.log(`${n} pièces Dragon écrites dans public/img/pieces-dragon`);
