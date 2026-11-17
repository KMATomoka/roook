// Génère les pièces du pack « Epic Dragon » (public/img/pieces-dragon/*.svg).
// Blancs en or et ivoire écaillés, Noirs en obsidienne aux contours de braise (halo flou orange).
// Pion œuf de dragon serré dans des griffes, tour forteresse volcanique (porte de feu, fissures de lave),
// fou mitre de flammes, cavalier tête de dragon cornue, dame couronne aux ailes de dragon, roi couronne à cornes
// et œil de dragon surmonté d'une flamme.
// Utilisation : node scripts/pieces-dragon.js
const fs = require('fs');
const path = require('path');

const PAL = {
  w: { top: '#ffffff', sheen: '#fff4dc', mid: '#f5d9a2', bot: '#b7793a', stroke: '#3d1a06', acc: '#ff6a1f', acc2: '#ffc63a', scale: '#c0802e', eye: '#ff3b10', dark: '#2a1004', glow: null, hornTop: '#fffaf0', hornBot: '#c9a066', maneTop: '#f8c868', maneBot: '#a8561a' },
  b: { top: '#6a4a5a', sheen: '#432a37', mid: '#21121a', bot: '#060205', stroke: '#ff8a3d', acc: '#ff4d1a', acc2: '#ffb347', scale: '#c2501f', eye: '#ffd23a', dark: '#060205', glow: '#ff5a1f', hornTop: '#8a6a6a', hornBot: '#1e1014', maneTop: '#5a2422', maneBot: '#120507' },
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

  // Cavalier : tête de dragon (d'après le modèle choisi), dessinée en couches : crinière à deux rangées de lames
  // (sombre derrière, claire devant), deux cornes annelées, tête au museau crochu et gueule ouverte qui rougeoie,
  // crocs, barbillons sous la mâchoire, collerette dentelée, arcade tranchante et œil de braise, plaques sous la
  // gorge, écailles sur le cou, ombres et reflets
  n: (c) => `${base(c)}
  <clipPath id="nk"><path d="M 14.6 32.3 C 16.9 29.6 20.0 27.3 21.9 25.4 C 23.5 23.4 24.6 21.1 25.8 19.0 L 28.5 18.0 L 30.8 11.1 L 32.5 16.3 L 40.5 16.1 C 45.5 17.3 48.6 20.3 49.7 24.2 C 51.7 31.2 53.2 38.9 54.8 46.6 C 55.9 52.8 56.3 60.5 55.9 71.0 L 30.8 71.0 C 32.4 60.5 34.7 51.7 39.3 42.4 C 34.7 45.1 30.0 48.2 24.8 49.1 L 21.2 47.4 L 23.9 45.4 C 30.0 42.0 36.2 38.9 42.0 37.2 L 24.2 38.3 C 20.0 39.3 16.9 41.1 15.3 43.4 C 13.0 40.4 12.9 35.0 14.6 32.3Z"/></clipPath>
  <path d="M 41.6 16.6 Q 52.5 13.0 67.5 17.1 Q 59.4 20.5 52.5 23.3 Q 64.8 23.3 76.0 27.1 Q 65.2 31.0 53.6 33.3 Q 66.8 34.6 78.3 41.1 Q 66.8 44.5 55.5 45.2 Q 67.5 48.3 76.4 55.5 Q 65.2 56.5 55.9 57.4 Q 64.8 60.9 71.0 67.5 L 56.3 68.7 L 48.6 45.1 L 45.5 21.9Z" fill="url(#gm)" stroke-width="2"/>
  <path d="M 38.5 17.3 C 47.0 10.3 55.5 4.9 65.0 1.9 C 59.4 6.4 53.2 11.8 48.6 17.6Z" fill="url(#gh)" stroke-width="2"/>
  <path class="dt" d="M43.6 13.3 Q48.2 13.3 51.5 14.2 M47.2 10.7 Q51.2 10.9 53.8 11.9 M50.9 8.4 Q54.1 8.6 56.1 9.6 M54.6 6.3 Q57.2 6.5 58.5 7.4 M58.1 4.6 Q60.1 4.7 60.7 5.5 " fill="none" stroke-width="1" opacity=".6"/>
  <path d="M 47.4 21.3 Q 55.5 21.3 64.4 24.1 Q 56.9 26.5 51.7 29.0 Q 59.8 30.4 69.3 35.2 Q 59.8 37.2 53.4 38.9 Q 61.6 41.1 70.7 48.6 Q 59.9 49.1 54.8 50.0 Q 61.3 53.2 66.2 60.2 Q 58.9 59.9 55.1 60.7 L 53.7 52.8 L 50.6 33.6Z" fill="url(#gf)" stroke-width="1.8"/>
  <path d="M 24.2 38.3 L 42.0 37.2 C 36.2 38.9 30.0 42.0 23.9 45.4 L 21.7 46.0Z" fill="url(#mo)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M 14.6 32.3 C 16.9 29.6 20.0 27.3 21.9 25.4 C 23.5 23.4 24.6 21.1 25.8 19.0 L 28.5 18.0 L 30.8 11.1 L 32.5 16.3 L 40.5 16.1 C 45.5 17.3 48.6 20.3 49.7 24.2 C 51.7 31.2 53.2 38.9 54.8 46.6 C 55.9 52.8 56.3 60.5 55.9 71.0 L 30.8 71.0 C 32.4 60.5 34.7 51.7 39.3 42.4 C 34.7 45.1 30.0 48.2 24.8 49.1 L 21.2 47.4 L 23.9 45.4 C 30.0 42.0 36.2 38.9 42.0 37.2 L 24.2 38.3 C 20.0 39.3 16.9 41.1 15.3 43.4 C 13.0 40.4 12.9 35.0 14.6 32.3Z" fill="url(#g)" stroke-width="2.2"/>
  <g class="dt" clip-path="url(#nk)">
    <path d="M41.0 43.0a2.5 2.5 0 0 0 5.0 0 M46.0 43.0a2.5 2.5 0 0 0 5.0 0 M51.0 43.0a2.5 2.5 0 0 0 5.0 0 M43.1 46.1a2.5 2.5 0 0 0 5.0 0 M48.1 46.1a2.5 2.5 0 0 0 5.0 0 M53.1 46.1a2.5 2.5 0 0 0 5.0 0 M40.2 49.2a2.5 2.5 0 0 0 5.0 0 M45.2 49.2a2.5 2.5 0 0 0 5.0 0 M50.2 49.2a2.5 2.5 0 0 0 5.0 0 M42.4 52.4a2.5 2.5 0 0 0 5.0 0 M47.4 52.4a2.5 2.5 0 0 0 5.0 0 M52.4 52.4a2.5 2.5 0 0 0 5.0 0 M39.5 55.5a2.5 2.5 0 0 0 5.0 0 M44.5 55.5a2.5 2.5 0 0 0 5.0 0 M49.5 55.5a2.5 2.5 0 0 0 5.0 0 M54.5 55.5a2.5 2.5 0 0 0 5.0 0 M41.6 58.6a2.5 2.5 0 0 0 5.0 0 M46.6 58.6a2.5 2.5 0 0 0 5.0 0 M51.6 58.6a2.5 2.5 0 0 0 5.0 0 M38.8 61.8a2.5 2.5 0 0 0 5.0 0 M43.8 61.8a2.5 2.5 0 0 0 5.0 0 M48.8 61.8a2.5 2.5 0 0 0 5.0 0 M53.8 61.8a2.5 2.5 0 0 0 5.0 0 M40.9 64.9a2.5 2.5 0 0 0 5.0 0 M45.9 64.9a2.5 2.5 0 0 0 5.0 0 M50.9 64.9a2.5 2.5 0 0 0 5.0 0 M38.0 68.0a2.5 2.5 0 0 0 5.0 0 M43.0 68.0a2.5 2.5 0 0 0 5.0 0 M48.0 68.0a2.5 2.5 0 0 0 5.0 0 M53.0 68.0a2.5 2.5 0 0 0 5.0 0 " fill="none" stroke="${c.scale}" stroke-width=".9" opacity=".55"/>
    <path d="M 37.6 45.1 Q 41.5 46.8 45.2 45.5 M 36.4 49.7 Q 40.2 51.4 43.9 50.2 M 35.3 54.4 Q 39.2 56.1 42.9 54.8 M 34.2 59.0 Q 38.1 60.7 41.8 59.5 M 33.3 63.6 Q 37.1 65.3 40.9 64.1 M 32.5 68.3 Q 36.4 70.0 40.1 68.7" fill="none" stroke="${c.scale}" stroke-width="1.5"/>
    <path d="M 23.2 30.2 L 36.1 23.6 L 38.4 27.5 L 29.9 31.8Z" fill="${c.bot}" opacity=".35" stroke="none"/>
  </g>
  <path d="M 32.5 16.3 C 37.8 11.1 45.5 4.9 53.6 1.0 C 48.6 5.7 43.9 11.1 39.7 15.9Z" fill="url(#gh)" stroke-width="2"/>
  <path class="dt" d="M35.6 13.4 Q39.4 12.8 42.0 13.2 M38.2 11.1 Q41.7 10.6 43.9 11.1 M41.1 8.8 Q44.1 8.4 45.8 9.0 M44.2 6.6 Q46.6 6.3 47.8 6.9 M47.2 4.6 Q49.0 4.3 49.6 4.9 " fill="none" stroke-width="1" opacity=".6"/>
  <path d="M 41.6 37.4 L 40.2 33.6 L 47.0 33.2 L 43.9 29.9 L 50.9 29.0 L 47.7 25.8 L 52.6 23.3 C 48.6 25.8 44.3 30.4 41.6 35.0Z" fill="url(#gf)" stroke-width="1.6" stroke-linejoin="round"/>
  <path class="dt" d="M 25.2 38.2 L 26.1 41.6 L 27.1 38.1Z M 29.9 38.0 L 30.7 41.4 L 31.7 37.9Z M 34.8 37.7 L 35.7 41.1 L 36.7 37.7Z M 27.3 44.3 L 28.2 41.2 L 29.3 43.8Z M 32.4 42.1 L 33.3 39.1 L 34.4 41.7Z" fill="#fff8e8" stroke-width=".8" stroke-linejoin="round"/>
  <path class="dt" d="M 22.9 30.4 L 36.2 23.3" fill="none" stroke-width="2.6" stroke-linecap="round"/>
  <path class="dt" d="M 25.2 29.2 L 32.5 25.8 Q 31.7 29.6 27.7 30.1Z" fill="url(#ey)" stroke-width="1.1" stroke-linejoin="round"/>
  <ellipse class="dt" cx="28.9" cy="27.9" rx=".75" ry="1.7" fill="${c.dark}" stroke="none" transform="rotate(25 28.9 27.9)"/>
  <circle class="dt" cx="26.6" cy="28.2" r=".6" fill="#fff" stroke="none"/>
  <path class="dt" d="M 16.6 33.2 Q 18.1 31.5 20.5 31.9" fill="none" stroke-width="1.5" stroke-linecap="round"/>
  <path class="dt" d="M 18.3 32.1 C 20.5 29.6 22.8 27.5 24.8 25.1" fill="none" stroke="#fff" stroke-width="1.3" opacity=".55" stroke-linecap="round"/>
  <path d="M29.5 80.5 Q31.5 74 34.5 69.5 H65.5 Q68.5 74 70.5 80.5Z" fill="url(#g)"/>`,

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
    <linearGradient id="gh" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${c.hornBot}"/><stop offset="1" stop-color="${c.hornTop}"/></linearGradient>
    <linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.maneTop}"/><stop offset="1" stop-color="${c.maneBot}"/></linearGradient>
    <linearGradient id="gf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.sheen}"/><stop offset=".6" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.bot}"/></linearGradient>
    <radialGradient id="mo" cx=".7" cy=".4" r=".8"><stop offset="0" stop-color="#ffb347"/><stop offset=".45" stop-color="#d8380c"/><stop offset="1" stop-color="#3a0804"/></radialGradient>
    <radialGradient id="ey" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fff3a0"/><stop offset=".45" stop-color="#ffb020"/><stop offset="1" stop-color="#c43006"/></radialGradient>
    ${c.glow ? `<filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter><style>.gl *{fill:none!important;stroke:${c.glow}!important} .gl .dt{display:none}</style>` : ''}
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
