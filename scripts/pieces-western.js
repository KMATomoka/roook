// Génère les pièces du pack « Western chess » (public/img/pieces-western/*.svg).
// Blancs : sable du désert, trait brun. Noirs : cuir de selle, liseré de laiton.
// Pion cowboy, cavalier à bride, fou cactus (saguaro), tour fortin de rondins, dame à couronne de balles,
// roi shérif (grand chapeau et étoile).
// Utilisation : node scripts/pieces-western.js
const fs = require('fs');
const path = require('path');

const PAL = {
  // Blancs : sable, trait brun foncé
  w: { top: '#fff6e3', mid: '#f1dcb2', bot: '#d3ab6c', ink: '#4a2a14', line: '#4a2a14', red: '#b8342a', brass: '#c9982f', copper: '#b8602f', turq: '#2f9c95', mane: '#8a5a30', band: '#4a2a14' },
  // Noirs : cuir de selle, liseré laiton
  b: { top: '#a8703f', mid: '#6b3f20', bot: '#371d0c', ink: '#f0c27a', line: '#f0c27a', red: '#d8483a', brass: '#f0c27a', copper: '#d9773f', turq: '#4cc3bb', mane: '#2a1508', band: '#f0c27a' },
};
const f = (n) => Math.round(n * 100) / 100;

/** Socle de bois, avec une couture de cuir (pointillés). */
const base = (c) => `
  <path d="M20 92H80Q84 92 84 88.5Q84 85 80 85H20Q16 85 16 88.5Q16 92 20 92Z" fill="url(#g)"/>
  <path d="M21.5 88.5H78.5" stroke="${c.brass}" stroke-width="1.5" stroke-dasharray="2.4 2.2" stroke-linecap="round"/>`;

/** Étoile de shérif à six branches, boules au bout des branches. */
function sheriffStar(cx, cy, r, c) {
  let d = '';
  const balls = [];
  for (let i = 0; i < 12; i++) {
    const a = ((-90 + i * 30) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.52 : r;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    if (!(i % 2)) balls.push(`<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(r * 0.17)}"/>`);
  }
  return `<g fill="${c.brass}" stroke="${c.ink}" stroke-width="1.1"><path d="${d}Z"/>${balls.join('')}<circle cx="${cx}" cy="${cy}" r="${f(r * 0.26)}" fill="${c.turq}"/></g>`;
}

/** Chapeau de cowboy : bord relevé et calotte creusée. */
function hat(cx, brimY, w, crownH, c) {
  const l = cx - w / 2;
  const r = cx + w / 2;
  const cw = w * 0.32;
  const top = brimY - crownH;
  return `
  <path d="M${f(cx - cw)} ${f(brimY - 0.5)}C${f(cx - cw - 1.5)} ${f(top + crownH * 0.45)} ${f(cx - cw * 0.55)} ${f(top)} ${f(cx - cw * 0.3)} ${f(top)}Q${f(cx - cw * 0.12)} ${f(top + 2.2)} ${cx} ${f(top + 0.8)}Q${f(cx + cw * 0.12)} ${f(top + 2.2)} ${f(cx + cw * 0.3)} ${f(top)}C${f(cx + cw * 0.55)} ${f(top)} ${f(cx + cw + 1.5)} ${f(top + crownH * 0.45)} ${f(cx + cw)} ${f(brimY - 0.5)}Z" fill="url(#g)"/>
  <path d="M${f(cx - cw + 0.6)} ${f(brimY - crownH * 0.22)}H${f(cx + cw - 0.6)}" stroke="${c.band}" stroke-width="2.6"/>
  <path d="M${l} ${f(brimY - 2)}Q${f(l + 3)} ${f(brimY + 2.6)} ${cx} ${f(brimY + 1.6)}Q${f(r - 3)} ${f(brimY + 2.6)} ${r} ${f(brimY - 2)}Q${f(r - 6)} ${f(brimY - 0.6)} ${cx} ${f(brimY - 1.4)}Q${f(l + 6)} ${f(brimY - 0.6)} ${l} ${f(brimY - 2)}Z" fill="url(#g)"/>`;
}

const PIECES = {
  // Pion : petit cowboy (chapeau, foulard rouge)
  p: (c) => `${base(c)}
  <path d="M36.5 85C35.5 76 38.5 68 43 63H57C61.5 68 64.5 76 63.5 85Z" fill="url(#g)"/>
  <path d="M42.5 63.5H57.5L50 71.5Z" fill="${c.red}"/>
  <circle cx="50" cy="54" r="8.5" fill="url(#g)"/>
  ${hat(50, 48, 32, 12, c)}`,

  // Cavalier : tête de cheval, crinière foncée, bride en laiton
  n: (c) => `${base(c)}
  <path d="M27 85H73Q74 80 70 78H30Q26 80 27 85Z" fill="url(#g)"/>
  <path d="M70 78C74 60 72 37 58.5 22.5L57.5 11L49.5 19C41 20.5 33.5 26.5 29.5 34L21.5 49.5C19.5 54.5 23 59.5 29 58L39 53C43 52 46 54.5 45 58C41 64 36.5 70.5 34.5 78Z" fill="url(#g)"/>
  <path d="M58.5 22.5Q66.5 21.5 64.5 29Q72 29.5 68.8 37.5Q75.5 39.5 71.3 46.5Q77 50.5 72.2 56Q77.2 61 72.2 65.5Q76.2 70.5 71 74.5L70 78C74 60 72 37 58.5 22.5Z" fill="${c.mane}"/>
  <path d="M26 47.5L43.5 38.5M43.5 38.5L50 47" fill="none" stroke="${c.brass}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="43.5" cy="38.5" r="2.4" fill="${c.brass}" stroke-width="1"/>
  <path d="M40.5 33.6L45.5 31" fill="none" stroke="${c.line}" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="27.6" cy="50.4" r="1.3" fill="${c.line}" stroke="none"/>
  <path d="M57.5 11C61 7 66 6.5 69 9C65.5 9.5 63 11.5 61.5 15Z" fill="url(#g)"/>`,

  // Fou : cactus saguaro (deux bras, fleur rouge au sommet)
  b: (c) => `${base(c)}
  <path d="M43 80V31C43 22.5 57 22.5 57 31V80Z" fill="url(#g)"/>
  <path d="M43 64H35.5C32.5 64 30.5 61.5 30.5 58.5V46C30.5 41 37 41 37 46V57.5H43Z" fill="url(#g)"/>
  <path d="M57 56H64.5C67.5 56 69.5 53.5 69.5 50.5V38.5C69.5 33.5 63 33.5 63 38.5V49.5H57Z" fill="url(#g)"/>
  <path d="M47 29V79M50 26.5V79M53 29V79M33.7 46V58M66.3 38.5V50" fill="none" stroke="${c.line}" stroke-width="0.9" opacity="0.55"/>
  <circle cx="50" cy="22.5" r="3" fill="${c.red}" stroke-width="1.2"/>
  <path d="M27 85Q29.5 78.5 38 77.5H62Q70.5 78.5 73 85Z" fill="url(#g)"/>
  <path d="M34 81.5H39M44 80.5H48M57 81H62" stroke="${c.line}" stroke-width="1" opacity="0.6" stroke-linecap="round"/>`,

  // Tour : fortin de rondins pointus (créneaux) cerclés de cordes
  r: (c) => {
    let logs = '';
    const n = 5;
    const x0 = 28.5;
    const w = 43 / n;
    for (let i = 0; i < n; i++) {
      const a = x0 + i * w;
      const b = a + w;
      const top = i % 2 ? 36 : 26.5;
      logs += `<path d="M${f(a)} 85V${f(top + 5)}L${f((a + b) / 2)} ${f(top)}L${f(b)} ${f(top + 5)}V85Z" fill="url(#g)"/>`;
    }
    return `${base(c)}
  ${logs}
  <path d="M28.5 49H71.5M28.5 73H71.5" stroke="${c.brass}" stroke-width="2.6"/>
  <path d="M28.5 49H71.5M28.5 73H71.5" stroke="${c.ink}" stroke-width="0.8" stroke-dasharray="1.6 1.6"/>
  <path d="M45.6 85V63Q50 58.5 54.4 63V85Z" fill="${c.mane}"/>`;
  },

  // Dame : couronne de balles (douilles en laiton, ogives couleur de la pièce), clous turquoise
  q: (c) => {
    let bullets = '';
    for (const [ang, top] of [[-30, 33], [-15, 27], [0, 23], [15, 27], [30, 33]]) {
      // douille en laiton (avec son bourrelet) et ogive en cuivre
      bullets += `<g transform="rotate(${ang} 50 64)" stroke-width="1.2"><path d="M47 52V${top + 9}H53V52Z" fill="${c.brass}"/><path d="M46.2 ${top + 10.5}H53.8" stroke-width="1.4"/><path d="M47 ${top + 9}Q47 ${top + 2} 50 ${top}Q53 ${top + 2} 53 ${top + 9}Z" fill="${c.copper}"/></g>`;
    }
    return `${base(c)}
  ${bullets}
  <path d="M33.5 85C34.5 74 39 64 42.5 57H57.5C61 64 65.5 74 66.5 85Z" fill="url(#g)"/>
  <path d="M37.5 58H62.5Q64.5 55 62.5 51.5H37.5Q35.5 55 37.5 58Z" fill="url(#g)"/>
  <g fill="${c.turq}" stroke-width="0.9"><circle cx="42" cy="54.8" r="1.7"/><circle cx="50" cy="54.8" r="1.9"/><circle cx="58" cy="54.8" r="1.7"/></g>
  <path d="M41.5 72Q50 76 58.5 72" fill="none" stroke="${c.brass}" stroke-width="1.6"/>`;
  },

  // Roi : shérif (grand chapeau, étoile sur la poitrine)
  k: (c) => `${base(c)}
  <path d="M32.5 85C33.5 72 38 60.5 41 50.5H59C62 60.5 66.5 72 67.5 85Z" fill="url(#g)"/>
  <path d="M41 51H59L50 58Z" fill="${c.red}"/>
  ${sheriffStar(50, 69.5, 9.6, c)}
  <circle cx="50" cy="41.5" r="8.8" fill="url(#g)"/>
  ${hat(50, 34, 54, 27, c)}
  ${sheriffStar(50, 23, 3.6, c)}`,
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
