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
  // Pion v2 : œuf de dragon pointu couvert d'écailles en tuiles, fendu par une fissure de feu qui rougeoie,
  // tenu par trois serres aux griffes de corne, sur un petit pied
  p: (c) => `${base(c)}
  <defs><clipPath id="eg"><path d="M50 21 C60.5 21 66.5 33.5 66.5 45.5 C66.5 57 59 64.5 50 64.5 C41 64.5 33.5 57 33.5 45.5 C33.5 33.5 39.5 21 50 21Z"/></clipPath>
  <radialGradient id="crk" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe08a" stop-opacity=".95"/><stop offset=".5" stop-color="${c.acc}" stop-opacity=".45"/><stop offset="1" stop-color="${c.acc}" stop-opacity="0"/></radialGradient></defs>
  <path d="M37 80.5 Q39.5 72.5 44 68.5 H56 Q60.5 72.5 63 80.5Z" fill="url(#g)"/>
  <path d="M50 21 C60.5 21 66.5 33.5 66.5 45.5 C66.5 57 59 64.5 50 64.5 C41 64.5 33.5 57 33.5 45.5 C33.5 33.5 39.5 21 50 21Z" fill="url(#g)"/>
  <g class="dt" clip-path="url(#eg)" fill="none" stroke="${c.scale}" stroke-width="1.1" opacity=".8">
    ${[28, 33, 38, 43, 48, 53, 58, 63].map((y, i) => { let d = ''; for (let x = 30 + (i % 2 ? 3.2 : 0); x < 70; x += 6.4) d += `M${x.toFixed(1)} ${y} q3.2 4.6 6.4 0 `; return `<path d="${d}"/>`; }).join('')}
  </g>
  <ellipse class="dt" cx="49" cy="38" rx="9" ry="12" fill="url(#crk)" stroke="none"/>
  <path d="M44 24.5 L48.5 31 L44.5 35.5 L51 40.5 L47.5 45 L52.5 49" fill="none" stroke="${c.dark}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M44 24.5 L48.5 31 L44.5 35.5 L51 40.5 L47.5 45 L52.5 49" fill="none" stroke="${c.acc}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  <path class="dt" d="M44 24.5 L48.5 31 L44.5 35.5 L51 40.5 L47.5 45 L52.5 49" fill="none" stroke="#fff3c0" stroke-width=".7" stroke-linejoin="round"/>
  <path d="M39.5 68.5 C35.5 63.5 34.5 56 36.3 49 C37.5 53 39 57 41 60 C42.5 62.5 44 64 45.5 65.5Z" fill="url(#g)" stroke-width="1.6"/>
  <path d="M60.5 68.5 C64.5 63.5 65.5 56 63.7 49 C62.5 53 61 57 59 60 C57.5 62.5 56 64 54.5 65.5Z" fill="url(#g)" stroke-width="1.6"/>
  <path d="M46 68.5 C45.5 63 46.8 58.5 50 55 C53.2 58.5 54.5 63 54 68.5Z" fill="url(#g)" stroke-width="1.6"/>
  <path d="M36.3 49 L35.4 43.4 L38.6 48.2Z M63.7 49 L64.6 43.4 L61.4 48.2Z M50 55 L48.3 50.6 L51.9 50.6Z" fill="url(#gh)" stroke-width="1.2"/>
  <path class="dt" d="M38 52 Q39 58 42.5 62.5 M62 52 Q61 58 57.5 62.5" fill="none" stroke="${c.scale}" stroke-width="1" opacity=".8"/>
  <ellipse class="dt" cx="42.5" cy="33" rx="2.6" ry="6.5" fill="#fff" opacity=".45" stroke="none" transform="rotate(22 42.5 33)"/>`,

  // Tour v2 : donjon du dragon. Créneaux en crocs, pierres taillées, deux meurtrières de feu, porte en arc fermée
  // par une herse où brûle le feu, et la queue du dragon (écailles, pointe en fer de lance) enroulée autour
  r: (c) => `${base(c)}
  <path d="M32 80.5 L35 46 H65 L68 80.5Z" fill="url(#g)"/>
  <path d="M29 47.5 V34 L33 26 L37 34 V37 H44.5 V34 L50 23.5 L55.5 34 V37 H63 V34 L67 26 L71 34 V47.5Z" fill="url(#g)"/>
  <path d="M30.5 42 H69.5" fill="none" stroke="${c.scale}" stroke-width="1.1" opacity=".75"/>
  <g class="dt" fill="none" stroke="${c.scale}" stroke-width="1.1" opacity=".75">
    <path d="M34.6 53 H65.4 M33.9 61 H66.1 M33.2 69 H66.8"/>
    <path d="M42 46 V53 M58 46 V53 M37.5 53 V61 M50 53 V58 M62.5 53 V61 M43 61 V65 M57 61 V65 M39 69 V76 M61 69 V76"/>
  </g>
  <path d="M40 48.5 V53.5 M60 48.5 V53.5" fill="none" stroke="${c.dark}" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 49 V53 M60 49 V53" fill="none" stroke="${c.acc}" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M43 80.5 V70 Q50 61.5 57 70 V80.5Z" fill="${c.dark}"/>
  ${flame(50, 79.5, 12, c.acc)}${flame(50, 79.5, 7, '#ffd36b')}
  <path d="M45.5 80.5 V67.5 M50 80.5 V64.8 M54.5 80.5 V67.5 M43 72.5 H57 M43 77 H57" fill="none" stroke="${c.stroke}" stroke-width="1.1" opacity=".9"/>
  ${dbl('M28.5 64.5 C40 62.5 56 57 70 50.5', c, 4.4, 'url(#gh)')}
  <path d="M69.4 50.9 L75.5 44.6 L74.3 51.8 L79.2 53.4Z" fill="url(#gh)" stroke-width="1.5" stroke-linejoin="round"/>
  <path class="dt" d="M33 64.6 l1.3 -2.4 M38 63.8 l1.4 -2.5 M43 62.7 l1.5 -2.6 M48 61.3 l1.5 -2.7 M53 59.6 l1.6 -2.8 M58 57.6 l1.6 -2.8 M63 55.3 l1.6 -2.8" fill="none" stroke="${c.scale}" stroke-width="1" opacity=".9"/>
  ${flame(33, 25.5, 6, c.acc)}${flame(67, 25.5, 6, c.acc)}${flame(50, 23, 7, c.acc)}`,


  // Cavalier : tête de dragon (d'après le modèle choisi), dessinée en couches : crinière à deux rangées de lames
  // (sombre derrière, claire devant), deux cornes annelées, tête au museau crochu et gueule ouverte qui rougeoie,
  // crocs, barbillons sous la mâchoire, collerette dentelée, arcade tranchante et œil de braise, plaques sous la
  // gorge, écailles sur le cou, ombres et reflets
  n: (c) => `${base(c)}
  <clipPath id="nk"><path d="M 14.6 32.3 C 16.9 29.6 20.0 27.3 21.9 25.4 C 23.5 23.4 24.6 21.1 25.8 19.0 L 28.5 18.0 L 30.8 11.1 L 32.5 16.3 L 40.5 16.1 C 45.5 17.3 48.6 20.3 49.7 24.2 C 51.7 31.2 53.2 38.9 54.8 46.6 C 56.7 54.4 61.7 62.9 65.4 71.0 L 34.7 71.0 C 35.1 62.1 36.2 52.0 39.3 42.4 C 34.7 45.1 30.0 48.2 24.8 49.1 L 21.2 47.4 L 23.9 45.4 C 30.0 42.0 36.2 38.9 42.0 37.2 L 24.2 38.3 C 20.0 39.3 16.9 41.1 15.3 43.4 C 13.0 40.4 12.9 35.0 14.6 32.3Z"/></clipPath>
  <path d="M 41.6 16.6 Q 52.5 13.0 67.5 17.1 Q 59.4 20.5 52.5 23.3 Q 64.8 23.3 76.0 27.1 Q 65.2 31.0 53.6 33.3 Q 66.8 34.6 78.3 41.1 Q 66.8 44.5 55.5 45.2 Q 67.5 48.3 76.4 55.5 Q 65.2 56.5 55.9 57.4 Q 64.8 60.9 71.0 67.5 L 56.3 68.7 L 48.6 45.1 L 45.5 21.9Z" fill="url(#gm)" stroke-width="2"/>
  <path d="M 38.5 17.3 C 47.0 10.3 55.5 4.9 65.0 1.9 C 59.4 6.4 53.2 11.8 48.6 17.6Z" fill="url(#gh)" stroke-width="2"/>
  <path class="dt" d="M43.6 13.3 Q48.2 13.3 51.5 14.2 M47.2 10.7 Q51.2 10.9 53.8 11.9 M50.9 8.4 Q54.1 8.6 56.1 9.6 M54.6 6.3 Q57.2 6.5 58.5 7.4 M58.1 4.6 Q60.1 4.7 60.7 5.5 " fill="none" stroke-width="1.1" opacity=".9"/>
  <path d="M29.5 80.5 Q31 75.5 34.5 70.5 H65.5 Q69 75.5 70.5 80.5Z" fill="url(#g)"/>
  ${scales(c, [[74, 0], [77.5, 1]], 32.5, 67.5, 2.2)}
  <path d="M 47.4 21.3 Q 55.5 21.3 64.4 24.1 Q 56.9 26.5 51.7 29.0 Q 59.8 30.4 69.3 35.2 Q 59.8 37.2 53.4 38.9 Q 61.6 41.1 70.7 48.6 Q 59.9 49.1 54.8 50.0 Q 61.3 53.2 66.2 60.2 Q 58.9 59.9 55.1 60.7 L 53.7 52.8 L 50.6 33.6Z" fill="url(#gf)" stroke-width="1.8"/>
  <path d="M 24.2 38.3 L 42.0 37.2 C 36.2 38.9 30.0 42.0 23.9 45.4 L 21.7 46.0Z" fill="url(#mo)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M 14.6 32.3 C 16.9 29.6 20.0 27.3 21.9 25.4 C 23.5 23.4 24.6 21.1 25.8 19.0 L 28.5 18.0 L 30.8 11.1 L 32.5 16.3 L 40.5 16.1 C 45.5 17.3 48.6 20.3 49.7 24.2 C 51.7 31.2 53.2 38.9 54.8 46.6 C 56.7 54.4 61.7 62.9 65.4 71.0 L 34.7 71.0 C 35.1 62.1 36.2 52.0 39.3 42.4 C 34.7 45.1 30.0 48.2 24.8 49.1 L 21.2 47.4 L 23.9 45.4 C 30.0 42.0 36.2 38.9 42.0 37.2 L 24.2 38.3 C 20.0 39.3 16.9 41.1 15.3 43.4 C 13.0 40.4 12.9 35.0 14.6 32.3Z" fill="url(#g)" stroke-width="2.2"/>
  <g class="dt" clip-path="url(#nk)">
    <path d="M41.0 43.0a2.5 2.5 0 0 0 5.0 0 M46.0 43.0a2.5 2.5 0 0 0 5.0 0 M51.0 43.0a2.5 2.5 0 0 0 5.0 0 M43.1 46.1a2.5 2.5 0 0 0 5.0 0 M48.1 46.1a2.5 2.5 0 0 0 5.0 0 M53.1 46.1a2.5 2.5 0 0 0 5.0 0 M40.2 49.2a2.5 2.5 0 0 0 5.0 0 M45.2 49.2a2.5 2.5 0 0 0 5.0 0 M50.2 49.2a2.5 2.5 0 0 0 5.0 0 M42.4 52.4a2.5 2.5 0 0 0 5.0 0 M47.4 52.4a2.5 2.5 0 0 0 5.0 0 M52.4 52.4a2.5 2.5 0 0 0 5.0 0 M39.5 55.5a2.5 2.5 0 0 0 5.0 0 M44.5 55.5a2.5 2.5 0 0 0 5.0 0 M49.5 55.5a2.5 2.5 0 0 0 5.0 0 M54.5 55.5a2.5 2.5 0 0 0 5.0 0 M41.6 58.6a2.5 2.5 0 0 0 5.0 0 M46.6 58.6a2.5 2.5 0 0 0 5.0 0 M51.6 58.6a2.5 2.5 0 0 0 5.0 0 M38.8 61.8a2.5 2.5 0 0 0 5.0 0 M43.8 61.8a2.5 2.5 0 0 0 5.0 0 M48.8 61.8a2.5 2.5 0 0 0 5.0 0 M53.8 61.8a2.5 2.5 0 0 0 5.0 0 M40.9 64.9a2.5 2.5 0 0 0 5.0 0 M45.9 64.9a2.5 2.5 0 0 0 5.0 0 M50.9 64.9a2.5 2.5 0 0 0 5.0 0 M38.0 68.0a2.5 2.5 0 0 0 5.0 0 M43.0 68.0a2.5 2.5 0 0 0 5.0 0 M48.0 68.0a2.5 2.5 0 0 0 5.0 0 M53.0 68.0a2.5 2.5 0 0 0 5.0 0 " fill="none" stroke="${c.scale}" stroke-width="1.1" opacity=".9"/>
    <path d="M 37.6 45.1 Q 41.5 46.8 45.2 45.5 M 36.4 49.7 Q 40.2 51.4 43.9 50.2 M 35.3 54.4 Q 39.2 56.1 42.9 54.8 M 34.2 59.0 Q 38.1 60.7 41.8 59.5 M 33.3 63.6 Q 37.1 65.3 40.9 64.1 M 32.5 68.3 Q 36.4 70.0 40.1 68.7" fill="none" stroke="${c.scale}" stroke-width="1.5"/>
    <path d="M 23.2 30.2 L 36.1 23.6 L 38.4 27.5 L 29.9 31.8Z" fill="${c.bot}" opacity=".35" stroke="none"/>
  </g>
  <path d="M 32.5 16.3 C 37.8 11.1 45.5 4.9 53.6 1.0 C 48.6 5.7 43.9 11.1 39.7 15.9Z" fill="url(#gh)" stroke-width="2"/>
  <path class="dt" d="M35.6 13.4 Q39.4 12.8 42.0 13.2 M38.2 11.1 Q41.7 10.6 43.9 11.1 M41.1 8.8 Q44.1 8.4 45.8 9.0 M44.2 6.6 Q46.6 6.3 47.8 6.9 M47.2 4.6 Q49.0 4.3 49.6 4.9 " fill="none" stroke-width="1.1" opacity=".9"/>
  <path d="M 41.6 37.4 L 40.2 33.6 L 47.0 33.2 L 43.9 29.9 L 50.9 29.0 L 47.7 25.8 L 52.6 23.3 C 48.6 25.8 44.3 30.4 41.6 35.0Z" fill="url(#gf)" stroke-width="1.6" stroke-linejoin="round"/>
  <path class="dt" d="M 25.2 38.2 L 26.1 41.6 L 27.1 38.1Z M 29.9 38.0 L 30.7 41.4 L 31.7 37.9Z M 34.8 37.7 L 35.7 41.1 L 36.7 37.7Z M 27.3 44.3 L 28.2 41.2 L 29.3 43.8Z M 32.4 42.1 L 33.3 39.1 L 34.4 41.7Z" fill="#fff8e8" stroke-width=".8" stroke-linejoin="round"/>
  <path class="dt" d="M 22.9 30.4 L 36.2 23.3" fill="none" stroke-width="2.6" stroke-linecap="round"/>
  <defs><radialGradient id="eyg"><stop offset="0" stop-color="#ffe27a" stop-opacity=".95"/><stop offset=".45" stop-color="#ff8a1f" stop-opacity=".55"/><stop offset="1" stop-color="#ff4d1a" stop-opacity="0"/></radialGradient>
  <radialGradient id="mog"><stop offset="0" stop-color="#fff1b0" stop-opacity=".95"/><stop offset=".5" stop-color="#ff7a1f" stop-opacity=".6"/><stop offset="1" stop-color="#ff4d1a" stop-opacity="0"/></radialGradient></defs>
  <ellipse class="dt" cx="28.8" cy="27.8" rx="6.5" ry="4.2" fill="url(#eyg)" stroke="none" transform="rotate(-25 28.8 27.8)"/>
  <path class="dt" d="M 25.2 29.2 L 32.5 25.8 Q 31.7 29.6 27.7 30.1Z" fill="url(#ey)" stroke-width="1.1" stroke-linejoin="round"/>
  <ellipse class="dt" cx="28.9" cy="27.9" rx=".75" ry="1.7" fill="${c.dark}" stroke="none" transform="rotate(25 28.9 27.9)"/>
  <circle class="dt" cx="26.6" cy="28.2" r=".6" fill="#fff" stroke="none"/>
  <path class="dt" d="M 16.6 33.2 Q 18.1 31.5 20.5 31.9" fill="none" stroke-width="1.5" stroke-linecap="round"/>
  <path class="dt" d="M 18.3 32.1 C 20.5 29.6 22.8 27.5 24.8 25.1" fill="none" stroke="#fff" stroke-width="1.3" opacity=".55" stroke-linecap="round"/>
  <ellipse class="dt" cx="23.5" cy="43" rx="7" ry="5" fill="url(#mog)" stroke="none"/>
  <path d="M23 43.2 C19 43.4 15 45.2 11.2 48.6 C14.3 48 16.4 48.2 17.9 48.9 C15.4 50.1 14.2 51.7 13.6 53.6 C17.3 51.7 20.6 49.5 23.2 46.8Z" fill="${c.acc}" stroke-width="1.2" stroke-linejoin="round"/>
  <path class="dt" d="M22.6 44.2 C19.6 44.6 17 46 15 47.6 C17.4 47.4 19 47.8 20 48.4 C18.6 49.2 17.8 50.2 17.4 51.2 C19.6 50 21.4 48.6 22.8 46.6Z" fill="#ffd36b" stroke="none"/>
  <circle class="dt" cx="9.6" cy="46.2" r=".9" fill="#ffd36b" stroke="none"/><circle class="dt" cx="11.6" cy="55.4" r=".7" fill="#ffb347" stroke="none"/>
`,

  // Fou v3 : la mitre est une grande flamme (comme le premier fou) aux langues qui se tordent, écaillée en bas ;
  // dedans brûle un feu à trois couches (orange, or, cœur blanc) ; des braises s'échappent de la pointe ; col
  // d'écailles et bande sertie de trois braises
  b: (c) => `${base(c)}
  <defs><clipPath id="bf"><path d="M50 59 C42 58.5 36.5 51.5 36.5 42 C36.5 33 41 28 43 20.5 C44.6 24.6 46 27.4 47.6 29.6 C47.4 21 50.2 12.6 55.4 5.6 C54.4 12.6 56.2 18.4 59.4 23 C60.6 20.8 61.2 18.2 61 15.4 C63.8 19.6 65 25 64.2 30.5 C63.8 33 63.6 36 63.6 42 C63.4 51.5 58 58.5 50 59Z"/></clipPath>
  <radialGradient id="bfg" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ffe08a" stop-opacity=".9"/><stop offset=".55" stop-color="${c.acc}" stop-opacity=".35"/><stop offset="1" stop-color="${c.acc}" stop-opacity="0"/></radialGradient></defs>
  <path d="M38 80.5 Q41 69 45 63.5 H55 Q59 69 62 80.5Z" fill="url(#g)"/>
  ${scales(c, [[70, 0], [74.5, 1]], 41, 59, 2.2)}
  <rect x="37.5" y="57.5" width="25" height="6.5" rx="3.2" fill="url(#g)"/>
  ${[43, 50, 57].map((x) => `<circle cx="${x}" cy="60.75" r="1.6" fill="${c.acc}" stroke-width="1"/>`).join('')}
  <path d="M50 59 C42 58.5 36.5 51.5 36.5 42 C36.5 33 41 28 43 20.5 C44.6 24.6 46 27.4 47.6 29.6 C47.4 21 50.2 12.6 55.4 5.6 C54.4 12.6 56.2 18.4 59.4 23 C60.6 20.8 61.2 18.2 61 15.4 C63.8 19.6 65 25 64.2 30.5 C63.8 33 63.6 36 63.6 42 C63.4 51.5 58 58.5 50 59Z" fill="url(#g)"/>
  <g class="dt" clip-path="url(#bf)">${scales(c, [[47, 0], [51.5, 1], [56, 0]], 34, 66, 2.5)}</g>
  <path class="dt" d="M43 21.5 C42 27 39.5 31 38.6 36 M55 7 C52.6 13 51.6 19 51.8 25 M61 16.5 C61.6 21 61 25.5 59.6 28.5" fill="none" stroke="${c.scale}" stroke-width="1" opacity=".75" stroke-linecap="round"/>
  <ellipse class="dt" cx="50" cy="44" rx="10.5" ry="13" fill="url(#bfg)" stroke="none"/>
  <path d="M50 25.5 C54.5 32.5 59 37.5 58 46 C57.3 52 54 55.5 50 55.5 C46 55.5 42.6 52.2 42.6 47 C42.6 42.5 45 40 46.4 36.4 C47.4 38.6 48.4 40 49.2 41 C49 35.6 49.4 30.6 50 25.5Z" fill="${c.acc}" stroke-width="1.6"/>
  <path d="M50 36.5 C52.4 40.5 55 43 54.4 47.5 C54 50.6 52.2 52.6 50 52.6 C47.6 52.6 45.8 50.8 45.8 48.2 C45.8 45 48.6 42 50 36.5Z" fill="#ffd36b" stroke="none"/>
  <ellipse class="dt" cx="50" cy="48.8" rx="1.7" ry="2.7" fill="#fff8e0" stroke="none"/>
  <circle class="dt" cx="58.6" cy="9.2" r="1" fill="#ffd36b" stroke="none"/><circle class="dt" cx="47.2" cy="13" r=".75" fill="#ffb347" stroke="none"/><circle class="dt" cx="62.4" cy="12.2" r=".6" fill="#ffd36b" stroke="none"/>
  <ellipse class="dt" cx="41.6" cy="40" rx="2" ry="6" fill="#fff" opacity=".42" stroke="none" transform="rotate(14 41.6 40)"/>`,

  // Dame v2 : reine dragonne. Deux grandes ailes de chauve-souris déployées derrière (doigts et membranes),
  // couronne de cinq épines courbes avec des braises au bout, larme de feu au centre, col d'écailles
  q: (c) => {
    const wing = `<path d="M40 56 C30 54 20 47 12.5 33 C17 34 20.5 33 22.5 30.5 C23 35.5 26 38 29.5 38 C28.5 30 30.5 23 35 18 C35.5 26 37.5 33 41 38.5 C41.5 44 41.5 50 43 55Z" fill="url(#gm)" stroke-width="1.7"/>
      <path class="dt" d="M41.5 54 C33 47 24 41 13.5 34 M41 50 C35.5 44 30.5 39 29.5 38.2 M41.5 46 C38 37 36 28 35 18.5" fill="none" stroke-width="1.1" opacity=".7"/>`;
    return `${base(c)}
  ${wing}<g transform="translate(100 0) scale(-1 1)">${wing}</g>
  <path d="M35.5 80.5 Q39.5 66 44.5 58.5 H55.5 Q60.5 66 64.5 80.5Z" fill="url(#g)"/>
  ${scales(c, [[67, 0], [71.5, 1], [76, 0]], 40, 60, 2.3)}
  <rect x="36" y="53" width="28" height="6.5" rx="3.2" fill="url(#g)"/>
  <path d="M37 54 C35 47 33 41 31 34.5 C35 38 38 40 40.8 41.2 C40.5 36 41 31 42.5 26.5 C44.2 31 45.5 35 46.6 38.4 C47.4 32.5 48.5 26.5 50 20.5 C51.5 26.5 52.6 32.5 53.4 38.4 C54.5 35 55.8 31 57.5 26.5 C59 31 59.5 36 59.2 41.2 C62 40 65 38 69 34.5 C67 41 65 47 63 54Z" fill="url(#g)"/>
  ${scales(c, [[47.5, 0]], 38.5, 61.5, 2.6)}
  ${[[31, 34.5, 2.4], [42.5, 26.5, 2.4], [57.5, 26.5, 2.4], [69, 34.5, 2.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.acc}" stroke-width="1.3"/>`).join('')}
  ${flame(50, 20.5, 11, c.acc)}${flame(50, 20, 6, '#ffd36b')}
  <path d="M50 40.5 C52.6 43.5 53.2 46 50 49.5 C46.8 46 47.4 43.5 50 40.5Z" fill="url(#ey)" stroke-width="1.2"/>
  <ellipse class="dt" cx="43.5" cy="66" rx="1.6" ry="5" fill="#fff" opacity=".4" stroke="none" transform="rotate(14 43.5 66)"/>`;
  },

  // Roi v2 : roi-dragon. Deux grandes cornes de bélier annelées qui s'enroulent, couronne d'écailles portant un
  // œil de dragon fendu, croix d'or au sommet devant une flamme, col d'écailles
  k: (c) => `${base(c)}
  ${dbl('M40.5 46 C31 47 22.5 41.5 22.5 32.5 C22.5 25 28.5 21 33.5 23 C37.5 24.5 37.5 30.5 33.5 31 C31 31.3 30 29 31.5 28', c, 5, 'url(#gh)')}
  ${dbl('M59.5 46 C69 47 77.5 41.5 77.5 32.5 C77.5 25 71.5 21 66.5 23 C62.5 24.5 62.5 30.5 66.5 31 C69 31.3 70 29 68.5 28', c, 5, 'url(#gh)')}
  <path class="dt" d="M26 38.5 l3 -1.6 M24.4 33 l3.3 -.4 M25.6 27.6 l3 1.2 M74 38.5 l-3 -1.6 M75.6 33 l-3.3 -.4 M74.4 27.6 l-3 1.2" fill="none" stroke="${c.scale}" stroke-width="1.1"/>
  <path d="M33 80.5 Q37 66.5 43 59 H57 Q63 66.5 67 80.5Z" fill="url(#g)"/>
  ${scales(c, [[67, 0], [71.5, 1], [76, 0]], 38, 62, 2.4)}
  <rect x="34.5" y="54" width="31" height="6.5" rx="3.2" fill="url(#g)"/>
  <path d="M36.5 55 L34.5 38.5 L39.5 41.5 L42 33.5 L46 39 L50 31.5 L54 39 L58 33.5 L60.5 41.5 L65.5 38.5 L63.5 55Z" fill="url(#g)"/>
  ${scales(c, [[48, 1]], 37.5, 62.5, 2.5)}
  <path d="M42.5 47 Q50 40 57.5 47 Q50 54 42.5 47Z" fill="url(#ey)" stroke-width="1.4"/>
  <ellipse cx="50" cy="47" rx="1.1" ry="4.6" fill="${c.dark}" stroke="none"/>
  <circle class="dt" cx="48" cy="45.3" r=".8" fill="#fff" opacity=".8" stroke="none"/>
  ${flame(50, 30, 12, c.acc)}${flame(50, 29.5, 6.5, '#ffd36b')}
  <path d="M47.6 31.5 V19.5 H43.5 V15.2 H47.6 V10.5 H52.4 V15.2 H56.5 V19.5 H52.4 V31.5Z" fill="url(#g)" stroke-width="1.7"/>
  <ellipse class="dt" cx="42" cy="68" rx="1.7" ry="5.5" fill="#fff" opacity=".4" stroke="none" transform="rotate(14 42 68)"/>`,
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
