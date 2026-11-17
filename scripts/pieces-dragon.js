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

  // Cavalier : tête de dragon anguleuse sur un cou fin et arqué, long museau tourné vers le bas comme le cheval
  // d'un jeu d'échecs (on reconnaît le cavalier) : corne sur le nez, crocs, arcade à pointe, œil de braise,
  // collerette d'épines sur la joue, deux longues cornes rejetées en arrière, crête d'épines sur la nuque,
  // plaques sous la gorge, écailles sur le cou, et un jet de feu qui sort de la gueule
  n: (c) => `${base(c)}
  <path d="M34 80.5 Q37 69 43 63 H62 Q67 69 68.5 80.5Z" fill="url(#g)"/>
  <path d="M59 18 L69.5 14 L66.5 21.5 L76 22 L68.5 28.5 L77 31.5 L69 36.5 L76.5 41.5 L68 45 L74 51 L66.5 53.5 L71 59.5 L64.5 63 C63 58 62.5 53 63 48 C64 40 66 28 61 19Z" fill="${c.acc}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M63.5 19.5 L68 17 M65.5 26 L71.5 25 M66 33 L72.5 33.5 M65.5 40 L71.5 42 M64.5 47 L69.5 50 M64 54 L67.5 57.5" fill="none" stroke-width="1" opacity=".55"/>
  <path d="M57.5 22 C65.5 18.5 74 19.5 82.5 23.5 C74.5 23.5 67.5 25.5 62.5 29Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M49.5 18.5 C55.5 9.5 66 5.5 80.5 6.5 C70.5 9.5 63.5 14 58.5 20.5Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M54 14.5 C59.5 10.5 65.5 8.6 72 8.2" fill="none" stroke="#fff" stroke-width="1.1" opacity=".55"/>
  <path d="M43.5 63 C43.5 58 42 53 38 49 L33 49.6 L20 50.2 Q15.5 50.2 14.5 47 L13.8 44 Q13.5 41.4 16 40.4 L33 30 L40 25 L46 19.6 Q51 16 57 17.4 L61 19 C66 28 64 40 63 48 C62 54 63 59 64 63Z" fill="url(#g)"/>
  <path d="M15.5 46.8 C21 48.6 28 49.4 36.5 49.2 C35.2 48 34.4 47.2 34 46.6 C27.5 46.4 21 46 14.4 45.2Z" fill="${c.bot}" opacity=".35" stroke="none"/>
  ${scales(c, [[30, 1], [36, 0], [42, 1], [48, 0], [54, 1]], 47.5, 62.5, 2.3)}
  <path d="M42.6 53.5 Q46 52.6 49.5 53.6 M43.4 57.4 Q47 56.6 50.5 57.6 M43.8 61.2 Q47.4 60.5 51 61.4" fill="none" stroke="${c.scale}" stroke-width="1.4"/>
  <path d="M42 25.6 C48 22.2 54.5 21.4 60.5 22.6" fill="none" stroke-width="1.1" opacity=".5"/>
  <path d="M14.2 45.2 C21 46.2 27.5 46.8 34.2 46.6" fill="none" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M18 45.6 L19.2 48.8 L20.6 45.8Z M23.4 46.1 L24.6 49.6 L26 46.3Z M28.6 46.5 L29.6 49.4 L30.8 46.6Z" fill="#fff" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M14.4 45 C10.4 43 7.2 44 2.6 42.4 C5.2 45 4.8 46.8 3.2 49.6 C7 48 10.4 49 14.6 47.2Z" fill="${c.acc}" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M13.8 45.6 C10.8 45 8.8 45.6 6.8 45.4 C8.3 46.4 8.3 47.2 7.7 48 C9.8 47.4 11.8 47.6 13.9 46.8Z" fill="#ffd36b" stroke="none"/>
  <path d="M21.2 37 L20.4 31.4 L25.8 35Z" fill="${c.acc2}" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M15.6 42.2 Q17.2 40.9 19 41.4" fill="none" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M35 47 L45 42.4 L42 47.6 L49.5 48.6 L42.4 52.2 L45.6 55.6 L37 52.2Z" fill="${c.acc2}" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M29.5 32.6 L42 26 L47.5 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 34.6 L41.4 30.4 Q40.8 35 35.6 35.9Z" fill="${c.eye}" stroke-width="1.2" stroke-linejoin="round"/>
  <ellipse cx="37.2" cy="33.2" rx=".95" ry="2.1" fill="${c.dark}" stroke="none" transform="rotate(24 37.2 33.2)"/>
  <circle cx="35.6" cy="32.4" r=".6" fill="#fff" stroke="none" opacity=".85"/>
  <path d="M29.5 38.4 C32.5 41.2 36 42.6 39.6 43" fill="none" stroke-width="1.1" opacity=".5"/>
  <path d="M24 36.4 L31 32" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>
  <ellipse cx="53.5" cy="21.6" rx="1.8" ry="5" fill="#fff" opacity=".42" stroke="none" transform="rotate(70 53.5 21.6)"/>`,

  // Fou : mitre classique (on la reconnaît tout de suite), couverte d'écailles, griffée de trois entailles de
  // braise ; au sommet, une perle de feu
  b: (c) => `${base(c)}
  <path d="M38 80.5 Q41 69 45 63.5 H55 Q59 69 62 80.5Z" fill="url(#g)"/>
  <rect x="38.5" y="58" width="23" height="6" rx="3" fill="url(#g)"/>
  <path d="M50 15 C59.5 22.5 64 32.5 63 43 C62 51.5 56.5 57.5 50 58.5 C43.5 57.5 38 51.5 37 43 C36 32.5 40.5 22.5 50 15Z" fill="url(#g)"/>
  ${scales(c, [[40, 1], [45.5, 0], [51, 1]], 39, 61, 2.4)}
  <g stroke-linecap="round">
    <path d="M43.5 37 L53.5 25 M46.5 41 L56.5 29 M49.5 45 L59 33.5" stroke="${c.dark}" stroke-width="3.6"/>
    <path d="M43.5 37 L53.5 25 M46.5 41 L56.5 29 M49.5 45 L59 33.5" stroke="${c.acc}" stroke-width="1.9"/>
    <path d="M44.5 35.8 L52.5 26.2 M47.5 39.8 L55.5 30.2 M50.5 43.8 L58 34.7" stroke="#ffe08a" stroke-width=".7"/>
  </g>
  <circle cx="50" cy="12" r="4.4" fill="url(#ey)" stroke-width="1.6"/>
  ${flame(50, 7.8, 6, c.acc)}
  <ellipse cx="44" cy="36" rx="2.2" ry="6" fill="#fff" opacity=".42" stroke="none" transform="rotate(14 44 36)"/>`,

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
