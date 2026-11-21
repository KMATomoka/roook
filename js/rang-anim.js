// Mode classé, fenêtre de fin de partie : l'Elo qui défile, puis la montée de rang (ou le premier rang après le
// placement) avec sa mise en scène et ses bruitages (js/sound.js → rankSfx).
// Utilisé par js/jeu.js ; aussi par la page de démo des animations de rang.
import { rankOf, logoUrl, noRankHtml, fmt, CATS, RANKS, divisions, PLACEMENT } from './rangs.js?v=f4cd128-mwquidh7';
import { rankSfx } from './sound.js?v=f4cd128-mwquidh7';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const CHARGE = 1500; // durée de la montée en tension avant l'éclat (ms)

/**
 * Elo qui défile dans l'encart « Partie classée » de la fenêtre de fin.
 * res = { before, after, myElo } (js/rangs.js → applyResult). onPromote(rkBefore, rkAfter, after, d, firstRank) :
 * appelé quand la partie fait monter de rang ou termine le placement.
 */
export function animateElo(box, { before, after, myElo }, cat, onPromote) {
  const from = myElo;
  const to = after.r;
  const d = to - from;
  const rkBefore = rankOf({ r: from, n: Math.max(0, after.n - 1), floor: before.floor, shield: before.shield });
  const rkAfter = rankOf(after);
  const placing = after.n < PLACEMENT;
  const nextRank = RANKS[rkAfter.i + 1];
  box.innerHTML = `<div class="rk-end-head"><span class="rk-chip">Partie classée · ${CATS[cat] || ''}</span><span class="muted">Elo</span></div>
    <p class="rk-end-elo"><s class="muted">${fmt(from)}</s> <b class="rk-end-new">${fmt(from)}</b> <span class="rk-end-delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${Math.abs(d)}</span></p>
    ${placing
      ? `<p class="muted rk-end-msg">Placement ${after.n} / ${PLACEMENT} : ton rang s’affiche après ${PLACEMENT} parties classées.</p>`
      : `<div class="rk-end-bar">
          ${after.n === PLACEMENT ? noRankHtml(30) : `<img src="${logoUrl(rkBefore.rank.k)}" alt="${rkBefore.name}" title="${rkBefore.name}" width="30" height="30">`}
          <div class="rk-bar"><i style="width: ${Math.round(rkBefore.progress * 100)}%"></i></div>
          <img src="${logoUrl((nextRank || rkAfter.rank).k)}" alt="" width="30" height="30">
        </div>
        <p class="rk-end-msg">${rkAfter.name}${rkAfter.next ? ` · prochaine étape à ${fmt(rkAfter.next)}` : ''}</p>`}`;
  const num = box.querySelector('.rk-end-new');
  const bar = box.querySelector('.rk-bar i');
  const t0 = performance.now();
  const dur = reduce() ? 0 : 900;
  let lastTick = 0;
  let ticks = 0;
  const step = (t) => {
    const k = dur ? Math.min(1, (t - t0) / dur) : 1;
    num.textContent = fmt(from + d * k);
    // Petit cliquetis pendant que l'Elo défile, de plus en plus aigu
    if (k < 1 && d && t - lastTick > 70) {
      lastTick = t;
      rankSfx.tick(ticks++, d > 0);
    }
    if (k < 1) return requestAnimationFrame(step);
    num.textContent = fmt(to);
    rankSfx.eloEnd(d >= 0);
    if (bar) bar.style.width = Math.round((rkAfter.i === rkBefore.i ? rkAfter.progress : d > 0 ? 1 : 0) * 100) + '%';
  };
  requestAnimationFrame(step);
  const promoted = !placing && (rkAfter.i > rkBefore.i || after.n === PLACEMENT);
  if (promoted && onPromote) setTimeout(() => onPromote(rkBefore, rkAfter, after, d, after.n === PLACEMENT && rkAfter.i <= rkBefore.i), reduce() ? 400 : 1700);
}

/**
 * Montée de rang dans la fenêtre de fin : l'ancien logo (ou le « ? » du placement) tremble et se charge de lumière,
 * éclate, et le nouveau logo apparaît dans une gerbe d'étincelles, avec la fanfare du rang.
 * dlg : la fenêtre ; anchor : l'élément après lequel l'encart se place.
 */
export function showRankUp(dlg, anchor, before, after, entry, d, firstRank, cat) {
  dlg.querySelector('#end-rankup')?.remove();
  const div = divisions(after.i);
  const nextDiv = after.next;
  const sparks = Array.from({ length: 16 }, (_, i) => `<i style="--a: ${i * 22.5 + (i % 2 ? 8 : 0)}deg; --d: ${80 + (i % 3) * 22}px; --s: ${i % 3 ? 6 : 9}px"></i>`).join('');
  const up = document.createElement('div');
  up.id = 'end-rankup';
  up.className = 'rk-rankup charge';
  up.style.setProperty('--rk', after.rank.col);
  up.innerHTML = `<div class="rk-rankup-logo" aria-hidden="true">
      <span class="rk-rays"></span><span class="rk-flash"></span><span class="rk-sparks">${sparks}</span>
      <span class="rk-old">${firstRank ? noRankHtml(120) : `<img src="${logoUrl(before.rank.k)}" alt="" width="150" height="150">`}</span>
      <img class="rk-new" src="${logoUrl(after.rank.k)}" alt="" width="150" height="150">
    </div>
    <p class="eyebrow rk-late" style="--i: 0">${firstRank ? 'Ton premier rang' : 'Nouveau rang'}</p>
    <h2 class="rk-late" style="--i: 1">${after.name}</h2>
    ${firstRank ? '' : `<p class="muted rk-rankup-path rk-late" style="--i: 2"><img src="${logoUrl(before.rank.k)}" alt="" width="20" height="20"> ${before.name} → <img src="${logoUrl(after.rank.k)}" alt="" width="20" height="20"> ${after.name}</p>`}
    <div class="rk-end rk-rankup-info rk-late" style="--i: 3">
      <span><span class="muted">Elo ${CATS[cat] || ''}</span><br><b class="rk-num">${fmt(entry.r)}</b> <span class="rk-end-delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${Math.abs(d)}</span></span>
      ${nextDiv && div.length ? `<span class="rk-right"><span class="muted">Prochaine étape</span><br><b>${fmt(nextDiv)}</b></span>` : ''}
    </div>
    ${firstRank ? '' : '<p class="muted rk-rankup-shield rk-late" style="--i: 4">Bouclier : 3 parties sans redescendre de rang.</p>'}`;
  anchor.after(up);
  dlg.classList.add('rankup');
  if (reduce()) {
    up.classList.replace('charge', 'reveal');
    rankSfx.reveal(after.i, firstRank);
    return;
  }
  rankSfx.charge(CHARGE / 1000);
  setTimeout(() => {
    up.classList.replace('charge', 'reveal');
    rankSfx.reveal(after.i, firstRank);
  }, CHARGE);
}
