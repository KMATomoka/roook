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

  // Cavalier : tête de dragon de profil, gueule fermée et crocs qui dépassent, museau long et plat,
  // arcade sourcilière lourde et œil de braise, deux grandes cornes rejetées en arrière, crête d'épines
  // le long de la nuque, plaques sous la gorge, écailles sur le cou
  n: (c) => `${base(c)}
  <path d="M34 80.5 Q37 69 43 63 H62 Q67 69 68.5 80.5Z" fill="url(#g)"/>
  <path d="M67.5 22 L78 22.5 L70.5 29 L80.5 32.5 L72 37.5 L81 42.5 L72 46.5 L79.5 52.5 L70.5 55 L75.5 61 L67.5 62Z" fill="${c.acc}" stroke-width="1.6"/>
  <path d="M55 21.5 C61 14.5 70 11.5 81 13 C72.5 15.5 66.5 19.5 62.5 25.5Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M43.5 19.5 C47.5 9 56.5 3 70 2.5 C61 6.5 55 11.5 52.5 18.5Z" fill="${c.acc2}" stroke-width="1.6"/>
  <path d="M41.5 63 C39.5 57 38.5 53 36.5 50.5 C30 50 23.5 49.4 18.5 48.4 C14.8 47.6 12.8 45 12.8 41.6 C12.8 38.5 14.4 36 17.6 34.6 C22 32.6 27 30.6 31 28.6 C34 24.6 37.5 21 41.5 19 C47 16 54 15 59.5 17.2 C66.5 20.2 71.5 28.5 72 38.5 C72.5 47.5 70.5 55.5 68 63Z" fill="url(#g)"/>
  <path d="M15 42 C21 43 27.5 44 35.5 45.5" fill="none" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M21 42.6 L22.6 47 L24.2 43.2Z M27.5 43.6 L28.8 47.4 L30.2 44Z" fill="#fff" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M17.2 43.4 L18.4 40.4 L19.8 43.6Z" fill="#fff" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M38.5 53.5 Q42 52.4 45.5 53.6 M39.6 57.6 Q43 56.6 46.5 57.8 M40.4 61.4 Q44 60.6 47.4 61.6" fill="none" stroke="${c.scale}" stroke-width="1.3"/>
  ${scales(c, [[34, 1], [40, 0], [46, 1], [52, 0], [58, 1]], 49, 69, 2.5)}
  <path d="M21.5 33.5 L24.5 32 M26 31.3 L29 29.8" fill="none" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
  <path d="M15.8 37.6 Q17.6 36.2 19.4 36.8" fill="none" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M31.5 27.2 L45.5 22.6" fill="none" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M34 29.6 L44.8 25.8 Q43.6 30.6 37.6 31.4Z" fill="${c.eye}" stroke-width="1.2" stroke-linejoin="round"/>
  <ellipse cx="40.4" cy="28.6" rx=".95" ry="2.2" fill="${c.dark}" stroke="none" transform="rotate(20 40.4 28.6)"/>
  <path d="M38 48.5 L47.5 44.5 L44 51Z" fill="${c.acc2}" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M14.5 35.5 C11 33.5 10.5 29.5 13.5 27 C12.8 24 15 21.8 17.5 21.5" fill="none" stroke="${c.acc}" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
  <ellipse cx="55" cy="22.5" rx="2" ry="5.5" fill="#fff" opacity=".4" stroke="none" transform="rotate(62 55 22.5)"/>`,

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
