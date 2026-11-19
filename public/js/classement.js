// Page « Classé » : l'échelle des huit rangs, ton rang, et le classement de chaque cadence.
import { $, $$, escapeHtml, getPref, setPref } from './common.js';
import { session, profileUrl } from './compte.js';
import { RANKS, CATS, divisions, rangeLabel, rankOf, logoUrl, noRankHtml, fmt, getRatings, leaderboard, placeOf, PLACEMENT } from './rangs.js';

const { user } = await session;
let cat = getPref('rang-cat', 'rapide');
if (!CATS[cat]) cat = 'rapide';
let mine = null;

const LINES = {
  cendre: 'Les premiers pas. On apprend à ne plus laisser traîner ses pièces.',
  fer: 'Le rang de départ : tout le monde commence à 800.',
  marees: 'Les ouvertures tiennent, les fourchettes commencent à piquer.',
  emeraude: 'Le jeu devient précis : on voit deux ou trois coups à l’avance.',
  amethyste: 'Solide en finale, rare en gaffe. Le haut du tableau commence ici.',
  or: 'Des plans à long terme et une technique de club confirmée.',
  dragon: 'Peu de joueurs, beaucoup de feu. Chaque point se gagne cher.',
  astral: 'Au-dessus de 2 400, plus de division : ta place au classement s’affiche.',
};

function renderLadder() {
  const e = mine?.[cat];
  const rk = e && !rankOf(e).placement ? rankOf(e) : null;
  $('#rk-ladder').innerHTML = [...RANKS.keys()].reverse().map((i) => {
    const r = RANKS[i];
    const here = rk && rk.i === i;
    const divs = divisions(i);
    return `<div class="rk-row${here ? ' here' : ''}" style="--rk: ${r.col}">
      <img src="${logoUrl(r.k)}" alt="" width="80" height="80" loading="lazy">
      <div class="rk-row-txt"><h2>${r.name}</h2><p class="muted">${LINES[r.k]}</p></div>
      <div class="rk-divs">${divs.length ? divs.map(([d, lo, hi]) => `<span class="${here && rk.div === d ? 'on' : ''}"><b>${d}</b> ${fmt(lo)} – ${fmt(hi)}</span>`).join('') : '<span><b>Sans division</b></span>'}</div>
      <div class="rk-row-range"><b>${rangeLabel(i)}</b>${here ? `<span class="rk-chip">Tu es ici · ${fmt(rk.r)}</span>` : r.k === 'fer' ? '<span class="rk-chip">Départ · 800</span>' : ''}</div>
    </div>`;
  }).join('');
}

async function renderMe() {
  const box = $('#rk-me');
  if (!user || !mine) return;
  const e = mine[cat];
  const rk = rankOf(e);
  box.hidden = false;
  if (rk.placement) {
    box.innerHTML = `${noRankHtml(72)}
      <div><p class="rk-panel-cat">${CATS[cat]} · placement</p><h2>${rk.games} / ${PLACEMENT} parties</h2>
      <p class="muted">Elo ${fmt(e.r)}. Ton rang s’affiche après ${PLACEMENT} parties classées en ${CATS[cat]}.</p></div>
      <a class="btn btn-primary" href="jouer.html#hasard">Jouer une partie classée</a>`;
    return;
  }
  box.innerHTML = `<img src="${logoUrl(rk.rank.k)}" alt="" width="72" height="72">
    <div><p class="rk-panel-cat">Ton rang · ${CATS[cat]}</p><h2 style="color: ${rk.rank.col}">${rk.name}</h2>
    <p><b class="rk-num">${fmt(e.r)}</b> <span class="muted">· meilleur ${fmt(e.best || e.r)} · ${e.n} parties · <span id="rk-place">…</span></span></p>
    ${rk.next ? `<div class="rk-bar"><i style="width: ${Math.round(rk.progress * 100)}%"></i></div>` : ''}</div>
    <a class="btn btn-primary" href="jouer.html#hasard">Jouer une partie classée</a>`;
  const place = await placeOf(cat, e.r).catch(() => null);
  const p = $('#rk-place');
  if (p) p.textContent = place ? `${place}${place === 1 ? 'er' : 'e'} au classement` : '';
}

async function renderBoard() {
  const box = $('#rk-board');
  if (!user) {
    box.innerHTML = '<p class="muted">Connecte-toi pour voir le classement des joueurs.</p>';
    return;
  }
  box.innerHTML = '<p class="muted">Chargement…</p>';
  let list = [];
  try {
    list = await leaderboard(cat, 50);
  } catch {
    box.innerHTML = '<p class="muted">Le classement n’a pas pu être chargé.</p>';
    return;
  }
  if (!list.length) {
    box.innerHTML = `<p class="muted">Personne n’a encore fini ses ${PLACEMENT} parties de placement en ${CATS[cat]}. Sois le premier !</p>`;
    return;
  }
  box.innerHTML = `<div class="rk-table-wrap"><table class="rk-table">
    <thead><tr><th>Place</th><th>Joueur</th><th>Rang</th><th class="num">Elo</th><th class="num">Parties</th></tr></thead>
    <tbody>${list.map((p, i) => {
      const rk = rankOf(p);
      return `<tr${user && p.id === user.id ? ' class="me"' : ''}><td class="num">${i + 1}</td>
        <td><a href="${profileUrl(p.id)}">${escapeHtml(p.name || '?')}</a></td>
        <td><span class="rk-cell"><img src="${logoUrl(rk.rank.k)}" alt="" width="24" height="24"><span style="color: ${rk.rank.col}">${rk.rank.k === 'astral' ? `${rk.rank.name} n° ${i + 1}` : rk.name}</span></span></td>
        <td class="num"><b>${fmt(p.r)}</b></td><td class="num muted">${p.n}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function renderAll() {
  renderLadder();
  renderMe();
  renderBoard();
}

for (const r of $$('input[name=cat]')) {
  r.checked = r.value === cat;
  r.addEventListener('change', () => {
    cat = r.value;
    setPref('rang-cat', cat);
    renderAll();
  });
}
renderLadder();
renderBoard();
if (user) {
  mine = await getRatings(user.id).catch(() => null);
  renderAll();
}
