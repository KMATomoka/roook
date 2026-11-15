// Génère les pièces du pack « Sakura chess » (public/img/pieces-japon/*.svg).
// Blancs : ivoire et trait d'encre (sumi). Noirs : laque noire (urushi) et liseré d'or (maki-e).
// Pion kokeshi, cavalier à crinière vermillon, fou « giboshi » (le bulbe des ponts japonais),
// tour en château (tenshu), dame à éventail (sensu), roi à cimier de kabuto et soleil rouge.
// Utilisation : node scripts/pieces-japon.js
const fs = require('fs');
const path = require('path');

const PAL = {
  w: { top: '#fffdf7', mid: '#f3e8d2', bot: '#dbc8a4', ink: '#2b211c', line: '#2b211c', red: '#c8372d', gold: '#c99a35', hair: '#2b211c' },
  b: { top: '#5a4c45', mid: '#2a211e', bot: '#110c0b', ink: '#e0b85e', line: '#e0b85e', red: '#d9472f', gold: '#e8c46a', hair: '#d9472f' },
};

/** Petite fleur de cerisier (5 pétales). */
function sakura(cx, cy, r, fill, stroke) {
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = (-90 + i * 72) * (Math.PI / 180);
    const px = cx + Math.cos(a) * r * 0.55;
    const py = cy + Math.sin(a) * r * 0.55;
    d += `<ellipse cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" rx="${(r * 0.42).toFixed(2)}" ry="${(r * 0.56).toFixed(2)}" transform="rotate(${i * 72} ${px.toFixed(2)} ${py.toFixed(2)})"/>`;
  }
  return `<g fill="${fill}" stroke="${stroke}" stroke-width="0.7">${d}<circle cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(2)}" fill="${stroke}" stroke="none"/></g>`;
}

/** Socle laqué commun, avec son filet vermillon. */
const base = (c) => `
  <path d="M20 92H80Q84 92 84 88.5Q84 85 80 85H20Q16 85 16 88.5Q16 92 20 92Z" fill="url(#g)"/>
  <path d="M21 88.5H79" stroke="${c.red}" stroke-width="1.7" stroke-linecap="round"/>`;

/** Toit de château aux bords relevés : avant-toit de largeur w posé à la hauteur y, sommet à y-h. */
function roof(cx, y, w, h) {
  const l = cx - w / 2;
  const r = cx + w / 2;
  return `M${l} ${y - 1.5}Q${cx - w * 0.36} ${y - h * 0.12} ${cx - w * 0.27} ${y - h}H${cx + w * 0.27}Q${cx + w * 0.36} ${y - h * 0.12} ${r} ${y - 1.5}Q${cx + w * 0.4} ${y + 2.2} ${cx} ${y + 2.2}Q${cx - w * 0.4} ${y + 2.2} ${l} ${y - 1.5}Z`;
}

const PIECES = {
  // Pion : poupée kokeshi
  p: (c) => `${base(c)}
  <path d="M34.5 85C33.5 74 36 63 41.5 55H58.5C64 63 66.5 74 65.5 85Z" fill="url(#g)"/>
  <path d="M42.5 55.5L50 62.5L57.5 55.5" fill="none" stroke="${c.red}" stroke-width="2.2"/>
  ${sakura(50, 73.5, 6.2, c.red, c.line)}
  <circle cx="50" cy="40" r="14.5" fill="url(#g)"/>
  <path d="M35.6 41.5A14.5 14.5 0 0 1 64.4 41.5Q60 35.5 54 37.5Q50 33.5 46 37.5Q40 35.5 35.6 41.5Z" fill="${c.hair}"/>
  <circle cx="44.5" cy="46.5" r="1.9" fill="${c.red}" stroke="none" opacity="0.75"/>
  <circle cx="55.5" cy="46.5" r="1.9" fill="${c.red}" stroke="none" opacity="0.75"/>`,

  // Cavalier : tête de cheval, crinière vermillon au pinceau, cordon tressé
  n: (c) => `${base(c)}
  <path d="M27 85H73Q74 80 70 78H30Q26 80 27 85Z" fill="url(#g)"/>
  <path d="M70 78C74 60 72 37 58.5 22.5L57.5 11L49.5 19C41 20.5 33.5 26.5 29.5 34L21.5 49.5C19.5 54.5 23 59.5 29 58L39 53C43 52 46 54.5 45 58C41 64 36.5 70.5 34.5 78Z" fill="url(#g)"/>
  <path d="M58.5 22.5Q67.5 20 65 29Q73.5 29 69.5 37.5Q77 39.5 72 46.5Q78.5 50.5 73 56Q78 61 72.8 65.5Q76.5 71 71.2 75L70 78C74 60 72 37 58.5 22.5Z" fill="${c.red}"/>
  <path d="M40.5 34.6L45.5 32" fill="none" stroke="${c.line}" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="27.6" cy="50.4" r="1.3" fill="${c.line}" stroke="none"/>
  <path d="M45 59C49 62.5 54 64.5 60 64.8" fill="none" stroke="${c.red}" stroke-width="3" stroke-linecap="round"/>
  <path d="M45 59C49 62.5 54 64.5 60 64.8" fill="none" stroke="${c.gold}" stroke-width="1" stroke-dasharray="1.6 2" stroke-linecap="round"/>
  <circle cx="61.5" cy="65" r="2.2" fill="${c.red}"/>
  <path d="M57.5 11C61 7 66 6.5 69 9C65.5 9.5 63 11.5 61.5 15Z" fill="url(#g)"/>`,

  // Fou : bulbe « giboshi » à pointe, entaille d'encre rouge
  b: (c) => `${base(c)}
  <path d="M36.5 85C37.5 75 41.5 66.5 44 60H56C58.5 66.5 62.5 75 63.5 85Z" fill="url(#g)"/>
  <path d="M39.5 60.5H60.5Q62.5 58.5 60.5 56H39.5Q37.5 58.5 39.5 60.5Z" fill="${c.red}"/>
  <path d="M50 17C52.5 24 64.5 31.5 64.5 42.5C64.5 51 58 56 50 56C42 56 35.5 51 35.5 42.5C35.5 31.5 47.5 24 50 17Z" fill="url(#g)"/>
  <path d="M43.5 47.5L56.5 33.5" fill="none" stroke="${c.red}" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M39.5 45Q41 51 47 53" fill="none" stroke="${c.line}" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/>
  <circle cx="50" cy="14" r="3" fill="${c.gold}"/>`,

  // Tour : château japonais (muraille de pierre, trois toits aux bords relevés)
  r: (c) => `${base(c)}
  <path d="M26.5 85Q32 77 32.5 67H67.5Q68 77 73.5 85Z" fill="url(#g)"/>
  <path d="M30.5 79H69.5M32 73H68M41 85V79M59 85V79M48 79V73M37 73V67M63 73V67" fill="none" stroke="${c.line}" stroke-width="1" opacity="0.7"/>
  <path d="M35.5 67V57.5H64.5V67Z" fill="url(#g)"/>
  <path d="M40.5 60.5H45V64.5H40.5ZM47.8 60.5H52.2V64.5H47.8ZM55 60.5H59.5V64.5H55Z" fill="${c.line}" stroke="none"/>
  <path d="${roof(50, 57.5, 50, 8)}" fill="url(#g)"/>
  <path d="M40 49.5V43H60V49.5Z" fill="url(#g)"/>
  <path d="${roof(50, 43, 38, 7)}" fill="url(#g)"/>
  <path d="M44 36V30.5H56V36Z" fill="url(#g)"/>
  <path d="M47.6 31.5H52.4V35H47.6Z" fill="${c.red}" stroke="none"/>
  <path d="${roof(50, 30.5, 28, 7.5)}" fill="url(#g)"/>
  <path d="M43.5 23.2Q41 19.5 43.5 17.5Q44 20.5 46 21.5ZM56.5 23.2Q59 19.5 56.5 17.5Q56 20.5 54 21.5Z" fill="${c.gold}" stroke-width="1"/>`,

  // Dame : éventail ouvert (sensu) au bord vermillon
  q: (c) => {
    const cx = 50;
    const cy = 57;
    const R = 32;
    const r0 = 9;
    const a0 = -158;
    const a1 = -22;
    const P = (r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(2)).join(' ');
    const sector = (ri, ro) => `M${P(ri, a0)}L${P(ro, a0)}A${ro} ${ro} 0 0 1 ${P(ro, a1)}L${P(ri, a1)}A${ri} ${ri} 0 0 0 ${P(ri, a0)}Z`;
    let ribs = '';
    for (let i = 1; i < 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8;
      ribs += `M${P(r0, a)}L${P(R - 5, a)}`;
    }
    return `${base(c)}
  <path d="M33.5 85C34.5 74 39 65 42.5 58H57.5C61 65 65.5 74 66.5 85Z" fill="url(#g)"/>
  <path d="${sector(r0, R)}" fill="url(#g)"/>
  <path d="${sector(R - 5, R)}" fill="${c.red}"/>
  <path d="${ribs}" fill="none" stroke="${c.line}" stroke-width="1.1" opacity="0.8"/>
  <circle cx="50" cy="40" r="5.2" fill="${c.red}" stroke-width="1.4"/>
  <path d="M39.5 61H60.5Q62 59 60 57H40Q38 59 39.5 61Z" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="2.6" fill="${c.gold}" stroke-width="1.2"/>
  ${sakura(50, 73, 5.2, c.red, c.line)}`;
  },

  // Roi : casque de samouraï (kabuto) à cornes dorées (kuwagata) et soleil rouge
  k: (c) => `${base(c)}
  <path d="M32.5 85C33.5 72 38 60.5 41 51H59C62 60.5 66.5 72 67.5 85Z" fill="url(#g)"/>
  <path d="M43 52L50 60L57 52" fill="none" stroke="${c.red}" stroke-width="2.2"/>
  ${sakura(50, 72.5, 5.6, c.red, c.line)}
  <path d="M33.5 52.5Q50 44 66.5 52.5L63.5 46.5Q50 41 36.5 46.5Z" fill="url(#g)"/>
  <path d="M38 46.5C38 36 43.5 30.5 50 30.5C56.5 30.5 62 36 62 46.5Z" fill="url(#g)"/>
  <path d="M44 46V33.8M50 46V30.8M56 46V33.8" fill="none" stroke="${c.line}" stroke-width="1" opacity="0.75"/>
  <path d="M47.5 31.5C41 27.5 35.5 20.5 33.5 8.5C39 15 44.5 20.5 51 24Z" fill="${c.gold}"/>
  <path d="M52.5 31.5C59 27.5 64.5 20.5 66.5 8.5C61 15 55.5 20.5 49 24Z" fill="${c.gold}"/>
  <circle cx="50" cy="25.5" r="5.8" fill="${c.red}" stroke-width="1.8"/>`,
};

function svg(col, t) {
  const c = PAL[col];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="0.45" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.bot}"/></linearGradient></defs><g stroke="${c.ink}" stroke-width="2.3" stroke-linejoin="round">${PIECES[t](c)}</g></svg>`
    .replace(/\n\s*/g, ' ');
}

const out = path.join(__dirname, '..', 'public/img/pieces-japon');
fs.mkdirSync(out, { recursive: true });
const NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
let n = 0;
for (const col of ['w', 'b']) {
  for (const t of 'pnbrqk') {
    fs.writeFileSync(path.join(out, col + NAMES[t] + '.svg'), svg(col, t) + '\n');
    n++;
  }
}
console.log(`${n} pièces Sakura écrites dans public/img/pieces-japon`);
