// Génère les visages des adversaires de l'ordinateur, avec les mêmes humeurs que Noa
// (neutre, content, frime, rire, surpris, hmm, grimace, colere, golmon), sans texte :
//  - Adriz : cheveux bouclés, moustache et bouc, veste noire zippée (public/img/adriz/*.svg) ;
//  - Astrea : le chat tigré dans le casque d'astronaute de Noa (public/img/astrea/*.svg).
// Utilisation : node scripts/visages.js
const fs = require('fs');
const path = require('path');

const INK = '#1A1430';
const MOODS = ['neutre', 'content', 'frime', 'rire', 'surpris', 'hmm', 'grimace', 'colere', 'golmon'];
const f = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Petits effets, autour du personnage (repère 112 × 112)
// ---------------------------------------------------------------------------
const heart = (x, y, s, fill = '#FF4D7A') =>
  `<path d="M ${x} ${f(y + s * 0.9)} C ${f(x - s * 1.6)} ${f(y - s * 0.1)} ${f(x - s * 0.9)} ${f(y - s * 1.2)} ${x} ${f(y - s * 0.45)} C ${f(x + s * 0.9)} ${f(y - s * 1.2)} ${f(x + s * 1.6)} ${f(y - s * 0.1)} ${x} ${f(y + s * 0.9)} Z" fill="${fill}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
const drop = (x, y, s = 1, fill = '#7CC8FF') =>
  `<path d="M ${x} ${f(y - 4 * s)} Q ${f(x + 3 * s)} ${f(y + 0.5 * s)} ${f(x + 2.4 * s)} ${f(y + 1.8 * s)} Q ${x} ${f(y + 4 * s)} ${f(x - 2.4 * s)} ${f(y + 1.8 * s)} Q ${f(x - 3 * s)} ${f(y + 0.5 * s)} ${x} ${f(y - 4 * s)} Z" fill="${fill}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
const vein = (x, y) =>
  `<g fill="none" stroke="#FF3B4E" stroke-width="2.4" stroke-linecap="round">${[0, 90, 180, 270]
    .map((a) => `<path d="M 1.5 -5 Q 1.5 -1.5 5 -1.5" transform="translate(${x} ${y}) rotate(${a})"/>`)
    .join('')}</g>`;
const question = (x, y) =>
  `<g transform="translate(${x} ${y})"><path d="M -3.6 -4 Q -3.6 -8.5 0.4 -8.5 Q 4.4 -8.5 4.4 -4.6 Q 4.4 -1.6 1.2 -0.4 Q 0 0.2 0 2.4" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M -3.6 -4 Q -3.6 -8.5 0.4 -8.5 Q 4.4 -8.5 4.4 -4.6 Q 4.4 -1.6 1.2 -0.4 Q 0 0.2 0 2.4" fill="none" stroke="#B49CFF" stroke-width="2.6" stroke-linecap="round"/><circle cx="0" cy="6.4" r="2.2" fill="#B49CFF" stroke="${INK}" stroke-width="1.1"/></g>`;
const sparkle = (x, y, s = 1, fill = '#3CF2A3') =>
  `<path d="M ${x} ${f(y - 5 * s)} Q ${f(x + 1 * s)} ${f(y - 1 * s)} ${f(x + 5 * s)} ${y} Q ${f(x + 1 * s)} ${f(y + 1 * s)} ${x} ${f(y + 5 * s)} Q ${f(x - 1 * s)} ${f(y + 1 * s)} ${f(x - 5 * s)} ${y} Q ${f(x - 1 * s)} ${f(y - 1 * s)} ${x} ${f(y - 5 * s)} Z" fill="${fill}"/>`;
const star5 = (x, y, r, fill = '#FFD84A') => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'} ${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)} `;
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`;
};
const svgDoc = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="256" height="256">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;

// ---------------------------------------------------------------------------
// Adriz
// ---------------------------------------------------------------------------
const A = {
  skin: '#F2C29C', skinDark: '#E0A57C', hair: '#3B2619', hairDark: '#2A1A10', hairHi: '#6B4A32', brow: '#2A1A10',
  iris: '#7A4A22', jacket: '#1F1C27', jacketHi: '#2E2A38', purple: '#8B5CF6',
};
const TORSO = 'M 8 112 Q 8 96 18 89 Q 28 83 42 81 L 70 81 Q 84 83 94 89 Q 104 96 104 112 Z';
const NECK = 'M 47.5 70 L 64.5 70 L 65.5 84 Q 56 89 46.5 84 Z';
const HEAD = 'M 34 52 Q 34 30 56 29 Q 78 30 78 52 L 78 60 Q 77 75 66 81 Q 56 86 46 81 Q 35 75 34 60 Z';
const HAIR_BASE = 'M 31.5 47 C 29 30 39 14.5 56 14 C 73 14.5 83 30 80.5 47 C 72 39 40 39 31.5 47 Z';
// Boucles : une coiffure ronde, plus large que haute, qui descend sur les tempes (du fond vers le devant)
const CURLS = [
  ...[[44, 17.5], [52, 15.5], [60, 15.5], [68, 17.5]].map(([x, y]) => [x, y, 5.6]),
  ...[[37, 24], [45, 22.5], [53, 21.5], [61, 21.5], [69, 22.5], [76, 24.5]].map(([x, y]) => [x, y, 5.8]),
  ...[[33.5, 33], [40.5, 30], [48, 29], [56, 28.6], [64, 29], [71.5, 30], [78.5, 33]].map(([x, y]) => [x, y, 5.2]),
  ...[[33, 41], [79, 41]].map(([x, y]) => [x, y, 4.2]),
];
const curls = () =>
  CURLS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${A.hair}" stroke="${INK}" stroke-width="1.3"/><path d="M ${f(x - r * 0.5)} ${f(y - r * 0.05)} Q ${x} ${f(y - r * 0.62)} ${f(x + r * 0.5)} ${f(y - r * 0.05)}" fill="none" stroke="${A.hairHi}" stroke-width="1.1" stroke-linecap="round"/>`).join('');

/** Œil ouvert (regard : décalage de l'iris ; lid : paupière tombante de 0 à 1). */
function aEye(x, y, { look = 0, lid = 0, wide = false } = {}) {
  if (wide) {
    return `<circle cx="${x}" cy="${y}" r="5.6" fill="#fff" stroke="${INK}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="1.5" fill="${INK}"/>`;
  }
  const lidPath = lid ? `<path d="M ${x - 6.4} ${y} Q ${x} ${f(y - 5.4)} ${x + 6.4} ${y} L ${x + 6.4} ${f(y - 5.4 + lid * 6)} Q ${x} ${f(y - 4 + lid * 6)} ${x - 6.4} ${f(y - 5.4 + lid * 6)} Z" fill="${A.skinDark}"/><path d="M ${x - 6.2} ${f(y - 4.4 + lid * 5.6)} Q ${x} ${f(y - 3.4 + lid * 6)} ${x + 6.2} ${f(y - 4.4 + lid * 5.6)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` : '';
  return `<path d="M ${x - 6} ${y} Q ${x} ${y - 5} ${x + 6} ${y} Q ${x} ${y + 4.2} ${x - 6} ${y} Z" fill="#fff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
    <circle cx="${x + look}" cy="${y - 0.2}" r="2.9" fill="${A.iris}"/><circle cx="${x + look}" cy="${y - 0.2}" r="1.5" fill="#1A0F08"/><circle cx="${f(x + look - 1)}" cy="${y - 1.4}" r="0.8" fill="#fff"/>${lidPath}`;
}
const aBrow = (d, w = 2.6) => `<path d="${d}" fill="none" stroke="${A.brow}" stroke-width="${w}" stroke-linecap="round"/>`;
const A_BROWS = {
  normal: aBrow('M 39.5 49 Q 46 46.5 52.5 48.5') + aBrow('M 59.5 48.5 Q 66 46.5 72.5 49'),
  up: aBrow('M 39.5 46 Q 46 42.5 52.5 45') + aBrow('M 59.5 45 Q 66 42.5 72.5 46'),
  angry: aBrow('M 39.5 46.5 L 52.5 51', 3.2) + aBrow('M 72.5 46.5 L 59.5 51', 3.2),
  sad: aBrow('M 39.5 50 Q 46 48.5 52.5 45.5') + aBrow('M 59.5 45.5 Q 66 48.5 72.5 50'),
  hmm: aBrow('M 39.5 46 Q 46 41.5 52.5 45') + aBrow('M 59.5 50 Q 66 49.5 72.5 50'),
  wink: aBrow('M 39.5 50.5 Q 46 49.5 52.5 50.5') + aBrow('M 59.5 47.5 Q 66 45 72.5 48'),
};
const A_NOSE = `<path d="M 56.5 56 Q 54.6 61.5 56.4 63.4 Q 58.2 63.8 59 62.6" fill="none" stroke="#B07850" stroke-width="1.4" stroke-linecap="round"/>`;
const A_MUSTACHE = `<path d="M 48.5 67.4 Q 52.5 64.4 56 66 Q 59.5 64.4 63.5 67.4 Q 59.5 68.8 56 67.8 Q 52.5 68.8 48.5 67.4 Z" fill="${A.hairDark}"/>`;
const A_GOATEE = `<path d="M 52 77.4 Q 56 82 60 77.4 L 58.8 75.9 Q 56 77.3 53.2 75.9 Z" fill="${A.hairDark}"/>`;
const A_BLUSH = (op = 0.45, big = false) => `<g fill="#F28B8B" opacity="${op}"><ellipse cx="41" cy="63.5" rx="${big ? 5 : 3.6}" ry="${big ? 2.6 : 1.9}"/><ellipse cx="71" cy="63.5" rx="${big ? 5 : 3.6}" ry="${big ? 2.6 : 1.9}"/></g>`;
const A_MOUTH = {
  smile: `<path d="M 50.5 70.6 Q 56 75 61.5 70.6" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  grin: `<path d="M 50 69.8 Q 56 77.2 62 69.8 Z" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`,
  laugh: `<path d="M 49.5 69.4 Q 56 81 62.5 69.4 Z" fill="#7A1F2B" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M 51 69.9 L 61 69.9 L 60.2 71.6 L 51.8 71.6 Z" fill="#fff"/><ellipse cx="56" cy="76.2" rx="3.4" ry="1.9" fill="#F27C95"/>`,
  o: `<ellipse cx="56" cy="72.4" rx="2.7" ry="3.8" fill="#5A1520" stroke="${INK}" stroke-width="1.3"/>`,
  grit: `<rect x="49.5" y="69" width="13" height="5.4" rx="1.4" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M 52.8 69 V 74.4 M 56 69 V 74.4 M 59.2 69 V 74.4 M 49.5 71.7 H 62.5" stroke="${INK}" stroke-width="0.9"/>`,
  frown: `<path d="M 51 73.4 Q 56 69.6 61 73.4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  smirk: `<path d="M 50.5 71.2 Q 57 72.6 61.8 69.2" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  open: `<path d="M 50.5 70 Q 56 77.5 61.5 70 Z" fill="#7A1F2B" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M 51.6 70.4 L 60.4 70.4 L 59.8 71.8 L 52.2 71.8 Z" fill="#fff"/>`,
};
const happyEye = (x, y) => `<path d="M ${x - 5.4} ${y + 1.4} Q ${x} ${y - 5} ${x + 5.4} ${y + 1.4}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
const heartEye = (x, y) => heart(x, y + 0.6, 4.6, '#FF4D7A');

function adrizFace(mood) {
  const L = 46, R = 66, Y = 55;
  switch (mood) {
    case 'content': return A_BROWS.normal + aEye(L, Y, { lid: 0.2 }) + aEye(R, Y, { lid: 0.2 }) + A_BLUSH() + A_NOSE + A_MOUTH.grin + A_MUSTACHE + A_GOATEE;
    case 'frime': return A_BROWS.wink + `<path d="M ${L - 5.6} ${Y + 0.6} Q ${L} ${Y - 3.6} ${L + 5.6} ${Y + 0.6}" fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round"/>` + aEye(R, Y) + A_BLUSH() + A_NOSE + A_MOUTH.smirk + A_MUSTACHE + A_GOATEE;
    case 'rire': return A_BROWS.up + happyEye(L, Y) + happyEye(R, Y) + A_BLUSH(0.5) + A_NOSE + A_MOUTH.laugh + A_MUSTACHE + A_GOATEE + drop(36.5, 62, 0.8) + drop(75.5, 62, 0.8);
    case 'surpris': return A_BROWS.up + aEye(L, Y, { wide: true }) + aEye(R, Y, { wide: true }) + A_NOSE + A_MOUTH.o + A_MUSTACHE + A_GOATEE;
    case 'hmm': return A_BROWS.hmm + aEye(L, Y, { look: 2.2, lid: 0.35 }) + aEye(R, Y, { look: 2.2, lid: 0.45 }) + A_NOSE + A_MOUTH.smirk + A_MUSTACHE + A_GOATEE;
    case 'grimace': return A_BROWS.sad + aEye(L, Y, { lid: 0.15 }) + aEye(R, Y, { lid: 0.15 }) + `<path d="M ${L - 4.6} ${Y + 2.6} Q ${L} ${Y + 4.4} ${L + 4.6} ${Y + 2.6} M ${R - 4.6} ${Y + 2.6} Q ${R} ${Y + 4.4} ${R + 4.6} ${Y + 2.6}" fill="none" stroke="#5FB8F5" stroke-width="1.4"/>` + A_NOSE + A_MOUTH.frown + A_MUSTACHE + A_GOATEE + drop(L - 2, Y + 9, 0.9);
    case 'colere': return `<ellipse cx="56" cy="65" rx="20" ry="15" fill="#FF3B4E" opacity=".13"/>` + A_BROWS.angry + aEye(L, Y + 0.5, { lid: 0.3 }) + aEye(R, Y + 0.5, { lid: 0.3 }) + A_BLUSH(0.55, true) + A_NOSE + A_MOUTH.grit + A_MUSTACHE + A_GOATEE;
    case 'golmon': return A_BROWS.up + heartEye(L, Y) + heartEye(R, Y) + A_BLUSH(0.55) + A_NOSE + A_MOUTH.open + A_MUSTACHE + A_GOATEE;
    default: return A_BROWS.normal + aEye(L, Y) + aEye(R, Y) + A_BLUSH(0.35) + A_NOSE + A_MOUTH.smile + A_MUSTACHE + A_GOATEE;
  }
}
const ADRIZ_FX = {
  rire: '',
  surpris: drop(82, 38, 1.1),
  hmm: question(88, 22),
  colere: vein(90, 20),
  golmon: heart(20, 30, 3.6) + heart(93, 27, 4.2),
  frime: sparkle(90, 24, 1),
};

function adriz(mood) {
  const jacket = `<path d="${TORSO}" fill="url(#jacket)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M 20 112 Q 20 98 30 91" fill="none" stroke="${A.jacketHi}" stroke-width="2" stroke-linecap="round"/>
    <path d="M 92 112 Q 92 98 82 91" fill="none" stroke="${A.jacketHi}" stroke-width="2" stroke-linecap="round"/>
    <path d="M 22 99 Q 56 106 90 99" fill="none" stroke="${A.purple}" stroke-width="1.9"/>
    <path d="M 56 85 V 112" stroke="#9A95A8" stroke-width="1.8"/>
    <path d="M 41.5 81 L 49.5 91 L 56 85 L 62.5 91 L 70.5 81" fill="${A.jacketHi}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="54.6" y="85.5" width="2.8" height="5.4" rx=".8" fill="#D8D4E3" stroke="${INK}" stroke-width=".8"/>
    <circle cx="77" cy="104" r="4.6" fill="none" stroke="#A78BFA" stroke-width="1.3"/>
    <path d="M 74.9 106.4 L 77 101.6 L 79.1 106.4 M 75.9 104.8 H 78.1" fill="none" stroke="#E9E2FF" stroke-width="1.1" stroke-linecap="round"/>`;
  const head = `<path d="${NECK}" fill="${A.skinDark}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="33.5" cy="57" rx="5" ry="7" fill="${A.skin}" stroke="${INK}" stroke-width="2"/><path d="M 32.5 53.5 Q 30.5 57 32.5 60.5" fill="none" stroke="${A.skinDark}" stroke-width="1.6"/>
    <ellipse cx="78.5" cy="57" rx="5" ry="7" fill="${A.skin}" stroke="${INK}" stroke-width="2"/><path d="M 79.5 53.5 Q 81.5 57 79.5 60.5" fill="none" stroke="${A.skinDark}" stroke-width="1.6"/>
    <path d="${HEAD}" fill="url(#skin)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="${HAIR_BASE}" fill="${A.hairDark}"/>${curls()}`;
  // Contour blanc d'autocollant autour de toute la silhouette
  const sticker = `<g fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round"><path d="${TORSO}"/><path d="${NECK}"/><path d="${HEAD}"/><ellipse cx="33.5" cy="57" rx="5" ry="7"/><ellipse cx="78.5" cy="57" rx="5" ry="7"/><path d="${HAIR_BASE}"/>${CURLS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  const defs = `<linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6CDA9"/><stop offset="1" stop-color="${A.skinDark}"/></linearGradient><linearGradient id="jacket" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#2B2735"/><stop offset="1" stop-color="#141219"/></linearGradient>`;
  return svgDoc(defs, `<g transform="translate(0 2)">${sticker}${jacket}${head}${adrizFace(mood)}</g>${ADRIZ_FX[mood] || ''}`);
}

// ---------------------------------------------------------------------------
// Astrea : le chat, dans le casque et la combinaison de Noa (repris de img/noa/neutre.svg)
// ---------------------------------------------------------------------------
const noaSvg = fs.readFileSync(path.join(__dirname, '..', 'public/img/noa/neutre.svg'), 'utf8');
const noaDefs = noaSvg.slice(noaSvg.indexOf('<defs>') + 6, noaSvg.indexOf('</defs>'));
const C = { fur: '#D9A066', furTop: '#E8B77E', furBot: '#C3854F', stripe: '#8B5A33', cream: '#F7E6CC', pink: '#F08A9A', eye: '#F2C14E' };
// Repère « intérieur » du casque (celui du visage de Noa) : la tête tient dans x 26-86, y 26-96
const CAT_HEAD = 'M 56 41 C 72 41 84 51 84 66 C 84 75 80 82 74 86 L 77 89 L 70 88.5 C 66 90 61 91 56 91 C 51 91 46 90 42 88.5 L 35 89 L 38 86 C 32 82 28 75 28 66 C 28 51 40 41 56 41 Z';
const EAR_L = 'M 31 57 L 32 28 L 50 43 Z';
const EAR_R = 'M 81 57 L 80 28 L 62 43 Z';
const cEyeOpen = (x, y, { look = 0, round = false } = {}) =>
  `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="6" fill="${C.eye}" stroke="${INK}" stroke-width="1.6"/>${round ? `<circle cx="${x + look}" cy="${y}" r="2.6" fill="${INK}"/>` : `<ellipse cx="${x + look}" cy="${y}" rx="1.7" ry="4.3" fill="${INK}"/>`}<circle cx="${f(x + look - 1.6)}" cy="${y - 2.4}" r="1.3" fill="#fff"/>`;
const cHappy = (x, y) => `<path d="M ${x - 5.4} ${y + 1.8} Q ${x} ${y - 5} ${x + 5.4} ${y + 1.8}" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>`;
const cSqueeze = (x, y, dir) => `<path d="M ${x - 4.6 * dir} ${y - 3.8} L ${x + 3.4 * dir} ${y} L ${x - 4.6 * dir} ${y + 3.8}" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
const C_MOUTH = {
  w: `<path d="M 49.5 76 Q 52.8 79.6 56 75.6 Q 59.2 79.6 62.5 76" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
  open: `<path d="M 49.5 75.6 Q 56 85 62.5 75.6 Q 59 77.2 56 75.4 Q 53 77.2 49.5 75.6 Z" fill="#7A1F2B" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="56" cy="80.6" rx="3.2" ry="1.8" fill="#F27C95"/>`,
  big: `<path d="M 47.5 75.4 Q 56 89 64.5 75.4 Q 60 77.4 56 75.2 Q 52 77.4 47.5 75.4 Z" fill="#7A1F2B" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="56" cy="82.4" rx="4" ry="2.2" fill="#F27C95"/>`,
  o: `<ellipse cx="56" cy="78.4" rx="2.6" ry="3.4" fill="#5A1520" stroke="${INK}" stroke-width="1.4"/>`,
  flat: `<path d="M 50.5 77.4 Q 56 76.4 61.5 77.4" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
  wobble: `<path d="M 49.5 78.4 Q 51.5 75.6 53.5 77.6 Q 55.5 75.4 57.5 77.6 Q 59.5 75.6 62.5 78.4" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
  fangs: `<path d="M 49.5 75.4 Q 56 83.5 62.5 75.4 Z" fill="#7A1F2B" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M 51.2 75.7 L 52.6 78.6 L 54 75.9 Z M 58 75.9 L 59.4 78.6 L 60.8 75.7 Z" fill="#fff" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>`,
  cat3: `<path d="M 51 76.2 Q 53.5 79.4 56 76.4 Q 58.5 79.4 61 76.2" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
};
const C_BLUSH = (op = 0.5) => `<g fill="#FF8FA3" opacity="${op}"><ellipse cx="38.5" cy="73" rx="4.6" ry="2.4"/><ellipse cx="73.5" cy="73" rx="4.6" ry="2.4"/></g>`;

function catFace(mood) {
  const L = 45, R = 67, Y = 62;
  switch (mood) {
    case 'content': return cHappy(L, Y) + cHappy(R, Y) + C_BLUSH() + C_MOUTH.open;
    case 'frime': return star5(L, Y, 6.4) + star5(R, Y, 6.4) + C_BLUSH(0.45) + C_MOUTH.open;
    case 'rire': return cSqueeze(L, Y, 1) + cSqueeze(R, Y, -1) + C_BLUSH(0.55) + C_MOUTH.big + drop(37, Y + 4, 0.75) + drop(75, Y + 4, 0.75);
    case 'surpris': return cEyeOpen(L, Y, { round: true }) + cEyeOpen(R, Y, { round: true }) + C_MOUTH.o;
    case 'hmm':
      return cEyeOpen(L, Y + 0.5, { look: 1.8 }) + cEyeOpen(R, Y + 0.5, { look: 1.8 })
        + `<path d="M ${L - 6} ${Y - 6.4} L ${L + 6} ${Y - 6.4} L ${L + 6} ${Y + 0.4} Q ${L} ${Y - 1.4} ${L - 6} ${Y + 0.4} Z M ${R - 6} ${Y - 6.4} L ${R + 6} ${Y - 6.4} L ${R + 6} ${Y + 0.4} Q ${R} ${Y - 1.4} ${R - 6} ${Y + 0.4} Z" fill="${C.fur}"/>`
        + `<path d="M ${L - 5.6} ${Y + 0.2} Q ${L} ${Y - 1.6} ${L + 5.6} ${Y + 0.2} M ${R - 5.6} ${Y + 0.2} Q ${R} ${Y - 1.6} ${R + 5.6} ${Y + 0.2}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` + C_MOUTH.flat;
    case 'grimace':
      return cEyeOpen(L, Y, { round: true }) + cEyeOpen(R, Y, { round: true })
        + `<path d="M ${L - 5} ${Y + 2} Q ${L} ${Y + 6.4} ${L + 5} ${Y + 2} Z M ${R - 5} ${Y + 2} Q ${R} ${Y + 6.4} ${R + 5} ${Y + 2} Z" fill="#7CC8FF" opacity=".9"/>`
        + `<path d="M ${L - 2} ${Y + 6} Q ${L - 4} ${Y + 14} ${L - 2} ${Y + 22} M ${R + 2} ${Y + 6} Q ${R + 4} ${Y + 14} ${R + 2} ${Y + 22}" fill="none" stroke="#7CC8FF" stroke-width="3.2" stroke-linecap="round" opacity=".9"/>` + C_MOUTH.wobble;
    case 'colere':
      return `<path d="${CAT_HEAD}" fill="#FF3B4E" opacity=".16"/>` + cEyeOpen(L, Y + 1) + cEyeOpen(R, Y + 1)
        + `<path d="M ${L - 6.4} ${Y - 7} L ${L + 6.6} ${Y - 7} L ${L + 6.6} ${Y + 0.4} Z M ${R + 6.4} ${Y - 7} L ${R - 6.6} ${Y - 7} L ${R - 6.6} ${Y + 0.4} Z" fill="${C.fur}"/>`
        + `<path d="M ${L - 6} ${Y - 5.4} L ${L + 6.2} ${Y + 0.2} M ${R + 6} ${Y - 5.4} L ${R - 6.2} ${Y + 0.2}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` + C_BLUSH(0.6) + C_MOUTH.fangs;
    case 'golmon': return heart(L, Y + 0.6, 5, '#FF4D7A') + heart(R, Y + 0.6, 5, '#FF4D7A') + C_BLUSH(0.6) + C_MOUTH.cat3;
    default: return cEyeOpen(L, Y) + cEyeOpen(R, Y) + C_BLUSH(0.35) + C_MOUTH.w;
  }
}
function catHead(mood) {
  return `<path d="${EAR_L}" fill="${C.fur}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M 34.5 51 L 35 34 L 45.5 43.5 Z" fill="${C.pink}"/>
    <path d="${EAR_R}" fill="${C.fur}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M 77.5 51 L 77 34 L 66.5 43.5 Z" fill="${C.pink}"/>
    <path d="${CAT_HEAD}" fill="url(#catFur)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M 56 42.5 V 51 M 49.5 43.6 Q 50.6 47.6 51.6 51 M 62.5 43.6 Q 61.4 47.6 60.4 51" fill="none" stroke="${C.stripe}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M 29.4 62 L 36 63.2 M 29.6 68.2 L 35.4 68.2 M 82.6 62 L 76 63.2 M 82.4 68.2 L 76.6 68.2" fill="none" stroke="${C.stripe}" stroke-width="2.4" stroke-linecap="round"/>
    <g fill="${C.cream}"><ellipse cx="50" cy="76" rx="7.4" ry="5.6"/><ellipse cx="62" cy="76" rx="7.4" ry="5.6"/><ellipse cx="56" cy="82.4" rx="7" ry="4.4"/></g>
    <path d="M 52.8 70.6 L 59.2 70.6 L 56 73.8 Z" fill="${C.pink}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M 56 73.8 V 75.4" stroke="${INK}" stroke-width="1.3"/>
    <g stroke="#FFF7EA" stroke-width="1" stroke-linecap="round" opacity=".9"><path d="M 43 75 L 30 72.6 M 43 77.4 L 30.4 78.4 M 69 75 L 82 72.6 M 69 77.4 L 81.6 78.4"/></g>
    ${catFace(mood)}`;
}
const CAT_FX = {
  surpris: drop(84, 34, 1.1),
  hmm: question(88, 20),
  colere: vein(89, 18),
  golmon: heart(19, 28, 3.6) + heart(94, 25, 4.2),
  frime: sparkle(92, 20, 1.1) + sparkle(18, 32, 0.7, '#FFD84A'),
  content: sparkle(92, 22, 0.8),
};
// Corps de chat : petit corps rond en combinaison, pattes en moufles, queue tigrée qui s'enroule
const SUIT = '#F4F1FF';
const SUIT_SHADE = '#D6CDF3';
const CAT_BODY = 'M 33 112 C 31 97 35 86 44 81 L 68 81 C 77 86 81 97 79 112 Z';
const TAIL = 'M 77 104 C 92 106 101 96 98 85 C 96 78 99 72 104.5 72.5';
/** Moufle de chat (avec les coussinets roses quand on voit le dessous de la patte). */
const paw = (x, y, beans = false) =>
  `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="5.8" fill="${SUIT}" stroke="${INK}" stroke-width="2"/>`
  + (beans ? `<g fill="${C.pink}"><ellipse cx="${x}" cy="${y + 1.4}" rx="2.2" ry="1.7"/><circle cx="${x - 2.4}" cy="${y - 2}" r="0.95"/><circle cx="${x}" cy="${y - 2.8}" r="0.95"/><circle cx="${x + 2.4}" cy="${y - 2}" r="0.95"/></g>`
    : `<path d="M ${x - 4.4} ${y - 2.6} Q ${x} ${y - 4.4} ${x + 4.4} ${y - 2.6}" fill="none" stroke="#8F6BFF" stroke-width="1.6"/>`);
/** Bras levé, de l'épaule (x1, y1) jusqu'à la patte (x2, y2). */
const arm = (x1, y1, x2, y2) =>
  `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2 + (x2 > 56 ? 4 : -4)} ${(y1 + y2) / 2 + 3} ${x2} ${y2}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M ${x1} ${y1} Q ${(x1 + x2) / 2 + (x2 > 56 ? 4 : -4)} ${(y1 + y2) / 2 + 3} ${x2} ${y2}" fill="none" stroke="${SUIT}" stroke-width="5.8" stroke-linecap="round"/>`;
const ARM_PATH = (x1, y1, x2, y2) => `M ${x1} ${y1} Q ${(x1 + x2) / 2 + (x2 > 56 ? 4 : -4)} ${(y1 + y2) / 2 + 3} ${x2} ${y2}`;
// Pose des pattes selon l'humeur : [bras levés (épaule → patte)], [pattes posées], cœur tenu ?
const POSES = {
  neutre: { up: [], rest: [[38, 99], [74, 99]] },
  content: { up: [[75, 88, 90, 73]], rest: [[38, 99]] }, // elle fait coucou
  frime: { up: [[37, 88, 21, 73], [75, 88, 91, 73]], rest: [] }, // les deux pattes en l'air
  surpris: { up: [[37, 88, 22, 74], [75, 88, 90, 74]], rest: [] },
  rire: { up: [], rest: [[45, 97], [67, 97]] }, // se tient le ventre
  hmm: { up: [], rest: [[38, 99], [74, 99]] },
  grimace: { up: [], rest: [[44, 95], [68, 95]] },
  colere: { up: [], rest: [[38, 97], [74, 97]] },
  golmon: { up: [], rest: [[49.5, 95], [62.5, 95]], heart: true }, // tient un cœur
};
function catBody(mood) {
  const pose = POSES[mood] || POSES.neutre;
  const sticker = `<g fill="#fff" stroke="#fff" stroke-linejoin="round" stroke-linecap="round"><path d="${CAT_BODY}" stroke-width="10"/><path d="${TAIL}" fill="none" stroke-width="17"/>${pose.up.map(([a, b, c, d]) => `<path d="${ARM_PATH(a, b, c, d)}" fill="none" stroke-width="15"/><circle cx="${c}" cy="${d}" r="9"/>`).join('')}</g>`;
  const tail = `<path d="${TAIL}" fill="none" stroke="${INK}" stroke-width="9.4" stroke-linecap="round"/><path d="${TAIL}" fill="none" stroke="${C.fur}" stroke-width="6.2" stroke-linecap="round"/><path d="${TAIL}" fill="none" stroke="${C.stripe}" stroke-width="6.2" stroke-dasharray="3 4.6" stroke-dashoffset="-6"/>`;
  const body = `<path d="${CAT_BODY}" fill="${SUIT}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M 69 82 C 76 87 80 97 78.5 112 L 71 112 C 73.5 98 73 89 69 82 Z" fill="${SUIT_SHADE}"/>
    <path d="M 33.6 101 Q 56 105.5 78.4 101" fill="none" stroke="#8F6BFF" stroke-width="3.2"/>
    <rect x="47" y="86" width="18" height="9" rx="2.6" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="51.6" cy="90.5" r="1.9" fill="#8F6BFF"/><circle cx="56.4" cy="90.5" r="1.9" fill="#3CF2A3"/><path d="M 59.6 89.3 H 62.4 M 59.6 91.7 H 62.4" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
  const arms = pose.up.map(([a, b, c, d]) => arm(a, b, c, d) + paw(c, d, true)).join('');
  const rest = pose.rest.map(([x, y]) => paw(x, y)).join('');
  const held = pose.heart ? heart(56, 92.5, 5.4, '#FF4D7A') : '';
  return { sticker, back: tail, front: body + rest + held + arms };
}
function astrea(mood) {
  const defs = noaDefs + `<linearGradient id="catFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.furTop}"/><stop offset="1" stop-color="${C.furBot}"/></linearGradient>`;
  const b = catBody(mood);
  const body = `<g transform="translate(0 3)">${b.sticker}<use href="#helmetBackA"></use>${b.back}${b.front}<use href="#noaHelmetA"></use><g transform="translate(13.61 -1.18) scale(0.757)"><g clip-path="url(#noaOpeningA)">${catHead(mood)}</g></g><use href="#noaRimA"></use><use href="#neckRingA"></use></g>${CAT_FX[mood] || ''}`;
  return svgDoc(defs, body);
}

// ---------------------------------------------------------------------------
for (const [dir, make] of [['adriz', adriz], ['astrea', astrea]]) {
  const out = path.join(__dirname, '..', 'public/img', dir);
  fs.mkdirSync(out, { recursive: true });
  for (const m of MOODS) fs.writeFileSync(path.join(out, m + '.svg'), make(m).replace(/\s*\n\s*/g, ' '));
}
console.log(`Visages écrits : public/img/adriz et public/img/astrea (${MOODS.length} humeurs chacun)`);
