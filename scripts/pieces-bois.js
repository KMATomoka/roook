// Génère les pièces du pack « Bois » (public/img/pieces-bois/*.svg) : des pièces Staunton tournées, en bois.
// Blancs en buis clair, Noirs en noyer foncé ; un dégradé de tour (arrondi), un grain de bois vertical (bruit SVG)
// et des gorges sombres aux colliers, comme sur de vraies pièces tournées.
// Utilisation : node scripts/pieces-bois.js
const fs = require('fs');
const path = require('path');

const PAL = {
  w: { edge: '#a87444', light: '#fbe7c2', mid: '#e9c690', stroke: '#4a2c14', grain: '0.36 0.20 0.06', groove: '#8a5a30', hi: '#fff6e0' },
  b: { edge: '#120702', light: '#6e4024', mid: '#3d200e', stroke: '#0a0402', grain: '0.06 0.025 0.005', groove: '#0f0602', hi: '#b07a50' },
};

/** Socle tourné, commun à toutes les pièces. */
const base = () => `<path d="M23 89 Q23 82.5 30.5 81.5 H69.5 Q77 82.5 77 89 Q77 94 71.5 94 H28.5 Q23 94 23 89Z" fill="url(#g)"/>
  <path d="M27 88.5 H73" class="gv"/>`;
/** Collier (anneau) avec sa gorge. */
const collar = (y, w = 24) => `<rect x="${50 - w / 2}" y="${y}" width="${w}" height="6" rx="3" fill="url(#g)"/><path d="M${52 - w / 2} ${y + 3} H${48 + w / 2}" class="gv"/>`;

const PIECES = {
  p: () => `${base()}
  <path d="M34 82 Q36 70 43.5 64 H56.5 Q64 70 66 82Z" fill="url(#g)"/>
  ${collar(58.5, 22)}
  <circle cx="50" cy="44" r="12.5" fill="url(#gr)"/>`,

  r: () => `${base()}
  <path d="M32 82 L35.5 53 H64.5 L68 82Z" fill="url(#g)"/>
  ${collar(48.5, 34)}
  <path d="M30.5 49 V30 H38.5 V36.5 H46 V30 H54 V36.5 H61.5 V30 H69.5 V49Z" fill="url(#g)"/>
  <path d="M34 43 H66" class="gv"/>`,

  n: () => `${base()}
  <path d="M35 82 Q37 70 43 64 H62 Q66 70 67 82Z" fill="url(#g)"/>
  ${collar(58.5, 30)}
  <path d="M43 59 C40 53 40 48 43 43 C37 44.5 32 47 28.5 48.5 C24.5 50 21.5 47.5 22.5 43.5 C23.5 39.5 27 36.5 31 33 C35 29.5 38 25 41.5 20 L43 12 L48.5 17 C58 17 66.5 23.5 69.5 33 C72 42 70 51 66 59Z" fill="url(#g)"/>
  <path d="M48.5 17.5 C57 20 63.5 27 65.5 36 C67 43 66 51 63 58" class="gv" style="stroke-width:1.6"/>
  <path d="M27 44 Q28.5 42.5 30.5 43" fill="none" stroke-width="1.8"/>
  <circle cx="40" cy="29.5" r="2.4" class="eye"/>`,

  b: () => `${base()}
  <path d="M36 82 Q38 71 44.5 63.5 H55.5 Q62 71 64 82Z" fill="url(#g)"/>
  ${collar(57.5, 24)}
  <path d="M50 21.5 C61 30 64.5 42 59 53.5 H41 C35.5 42 39 30 50 21.5Z" fill="url(#g)"/>
  <path d="M55 31.5 L45.5 42.5" style="stroke-width:3.2"/>
  <path d="M41.5 53.5 H58.5" class="gv"/>
  <circle cx="50" cy="17.5" r="4" fill="url(#gr)"/>`,

  q: () => `${base()}
  <path d="M33.5 82 Q37.5 66 42 54 H58 Q62.5 66 66.5 82Z" fill="url(#g)"/>
  ${collar(49.5, 28)}
  <path d="M38 50 L32 27 L42 37.5 L45.5 22.5 L50 35 L54.5 22.5 L58 37.5 L68 27 L62 50Z" fill="url(#g)"/>
  <g fill="url(#gr)"><circle cx="32" cy="25.5" r="3.2"/><circle cx="45.5" cy="20.5" r="3.2"/><circle cx="54.5" cy="20.5" r="3.2"/><circle cx="68" cy="25.5" r="3.2"/></g>
  <path d="M39.5 45 H60.5" class="gv"/>`,

  k: () => `${base()}
  <path d="M33.5 82 Q37.5 66 42 54 H58 Q62.5 66 66.5 82Z" fill="url(#g)"/>
  ${collar(49.5, 28)}
  <path d="M38 50 Q34.5 38 39 31.5 H61 Q65.5 38 62 50Z" fill="url(#g)"/>
  <path d="M40.5 38 H59.5 M39.5 45 H60.5" class="gv"/>
  <path d="M46.8 31.5 V22 H40.5 V16.5 H46.8 V9.5 H53.2 V16.5 H59.5 V22 H53.2 V31.5Z" fill="url(#g)"/>`,
};

function svg(col, t) {
  const c = PAL[col];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${c.edge}"/><stop offset=".3" stop-color="${c.light}"/><stop offset=".55" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.edge}"/>
  </linearGradient>
  <radialGradient id="gr" cx=".38" cy=".34" r=".75">
    <stop offset="0" stop-color="${c.hi}"/><stop offset=".35" stop-color="${c.light}"/><stop offset=".75" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.edge}"/>
  </radialGradient>
  <filter id="wood" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.22 0.012" numOctaves="2" seed="${col === 'w' ? 5 : 9}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${c.grain.split(' ')[0]}  0 0 0 0 ${c.grain.split(' ')[1]}  0 0 0 0 ${c.grain.split(' ')[2]}  0 0 0 -2.6 1.45" result="gr"/>
    <feComposite in="gr" in2="SourceAlpha" operator="in" result="gi"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge>
  </filter>
  <style>.gv{fill:none;stroke:${c.groove};stroke-width:1.4;stroke-linecap:round}.eye{fill:${c.stroke};stroke:none}</style>
</defs>
<g filter="url(#wood)" stroke="${c.stroke}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">
${PIECES[t]()}
</g>
</svg>
`;
}

const out = path.join(__dirname, '..', 'public/img/pieces-bois');
fs.mkdirSync(out, { recursive: true });
const NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
for (const col of ['w', 'b']) for (const t of 'pnbrqk') fs.writeFileSync(path.join(out, col + NAMES[t] + '.svg'), svg(col, t));
console.log('12 pièces en bois écrites dans public/img/pieces-bois');
