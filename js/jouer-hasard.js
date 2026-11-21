// Page Jouer, carte « Adversaire au hasard » : partie normale (sans Elo) ou partie classée (Elo, rangs).
// Classée : rang de la cadence choisie, recherche par écart d'Elo (js/matchmaking.js), puis l'adversaire trouvé
// avec ce que la partie peut rapporter, avant d'ouvrir la partie.
import { ico } from './icons.js?v=f4cd128-mwquidh7';
import { $, getPref, setPref, escapeHtml } from './common.js?v=f4cd128-mwquidh7';
import { findOpponent } from './matchmaking.js?v=f4cd128-mwquidh7';
import { db, ref, get, query, orderByKey, limitToFirst, onValue } from './fb.js?v=f4cd128-mwquidh7';
import {
  RANKED_CADENCES, RANDOM_CADENCES, RANKS, CATS, PLACEMENT, MIN_GAMES, MAX_GAP, getRatings, getLog, rankOf, logoUrl, noRankHtml, fmt, delta,
  windowFor, rankedKey, placeOf, onlineProof,
} from './rangs.js?v=f4cd128-mwquidh7';

const STEPS = [[0, 50], [10, 75], [20, 100], [30, 125], [45, 150], [60, 200]]; // même chose que windowFor
const toMs = (c) => {
  const [m, s] = c.split('+').map(Number);
  return { base: m * 60000, inc: (s || 0) * 1000 };
};
const splitLabel = (label) => {
  const [fam, time] = label.split(' · ');
  return { fam, time: time || label };
};
const rankLogo = (e, size, extra = '') => {
  const rk = rankOf(e);
  return rk.placement ? noRankHtml(size) : `<img src="${logoUrl(rk.rank.k)}" alt="${rk.name}" title="${rk.name}" width="${size}" height="${size}"${extra}>`;
};
const resBadge = (res) => `<span class="rk-res ${res}" title="${{ v: 'Victoire', n: 'Nulle', d: 'Défaite' }[res]}">${res.toUpperCase()}</span>`;

export function initRandom(user, params) {
  const card = $('#card-hasard');
  const box = $('#mm-content');
  card.classList.add('mm-wide');
  let ratings = null;
  let logs = {};
  let onlineGames = 0;
  let proof = null; // preuve des 5 parties en ligne (file classée)
  let cancelSearch = null;
  let searchTimer = null;
  let stopCount = null; // abonnement au nombre de joueurs dans la file choisie

  const rankedOpen = () => onlineGames >= MIN_GAMES || user?.role === 'fondateur' || user?.role === 'admin';
  const rankedCat = (c) => (RANKED_CADENCES.find(([k]) => k === c) || [])[1];
  const type = () => getPref('mm-type', 'normale');

  async function load() {
    if (!user) return;
    const [r, first, ...lg] = await Promise.all([
      getRatings(user.id).catch(() => null),
      get(query(ref(db, `history/${user.id}`), orderByKey(), limitToFirst(MIN_GAMES))).catch(() => null),
      ...Object.keys(CATS).map((c) => getLog(user.id, c, 5).catch(() => [])),
    ]);
    ratings = r;
    Object.keys(CATS).forEach((c, i) => (logs[c] = lg[i]));
    onlineGames = first?.size || 0;
    proof = onlineProof(first);
  }

  // --- Formulaire -------------------------------------------------------------
  function rankAside(cat) {
    const e = ratings?.[cat];
    const rk = rankOf(e);
    const catName = CATS[cat];
    if (!ratings) return '<aside class="mm-rank"><p class="muted">Chargement de ton rang…</p></aside>';
    if (rk.placement) {
      return `<aside class="mm-rank">
        <p class="mm-rank-cat">Placement · ${catName}</p>
        ${noRankHtml(104)}
        <h4 class="mm-rank-name">${rk.games} / ${PLACEMENT} parties</h4>
        <p class="mm-rank-elo">${fmt(rk.r)}</p>
        <p class="muted mm-rank-note">Ton rang s’affiche après ${PLACEMENT} parties classées en ${catName}.</p>
        ${recentHtml(cat)}
        <a class="mm-rank-link" href="classe.html">Voir tous les rangs →</a>
      </aside>`;
    }
    const nextRank = RANKS[rk.i + 1];
    const toNextRank = rk.next && nextRank && rk.next >= nextRank.min;
    return `<aside class="mm-rank" style="--rk: ${rk.rank.col}">
      <p class="mm-rank-cat">Ton rang · ${catName}</p>
      <img class="mm-rank-logo" src="${logoUrl(rk.rank.k)}" alt="" width="104" height="104">
      <h4 class="mm-rank-name">${rk.name}</h4>
      <p class="mm-rank-elo">${fmt(rk.r)}</p>
      ${rk.next ? `<div class="mm-rank-progress"><div class="rk-bar"><i style="width: ${Math.round(rk.progress * 100)}%"></i></div>
        <p><span class="muted">${fmt(rk.lo)}</span><span>Encore <b>${rk.next - rk.r}</b> pour ${toNextRank ? `<img src="${logoUrl(nextRank.k)}" alt="" width="16" height="16"> <b>${nextRank.name.split(' ')[0]}</b>` : `<b>${rk.rank.name.split(' ')[0]} ${{ III: 'II', II: 'I' }[rk.div] || ''}</b>`}</span></p></div>` : ''}
      ${recentHtml(cat)}
      <p class="muted mm-rank-place" id="mm-place"></p>
      <a class="mm-rank-link" href="classe.html">Voir tous les rangs →</a>
    </aside>`;
  }
  function recentHtml(cat) {
    const l = (logs[cat] || []).slice(-5);
    return l.length ? `<div class="mm-rank-recent" aria-label="Tes dernières parties classées">${l.map((g) => resBadge(g.res)).join('')}</div>` : '';
  }

  function render() {
    stopCount?.();
    stopCount = null;
    if (!user) {
      card.classList.remove('mm-wide');
      box.innerHTML = `<p>Affronte un joueur en ligne que tu ne connais pas, en partie normale ou classée.</p>
        <div class="ami-actions">
          <a class="btn btn-primary" href="connexion.html?mode=inscription&retour=jouer.html%23hasard">Créer un compte</a>
          <a class="btn btn-ghost" href="connexion.html?retour=jouer.html%23hasard">Se connecter</a>
        </div>`;
      return;
    }
    const t = type();
    const ranked = t === 'classee';
    const list = ranked ? RANKED_CADENCES.map(([k, cat, label]) => ({ k, cat, label })) : RANDOM_CADENCES.map(([k, label]) => ({ k, label }));
    const saved = ranked ? getPref('cadence-classee', '10+0') : getPref('cadence-hasard', getPref('cadence', '10+0'));
    const cad = list.some((x) => x.k === saved) ? saved : '10+0';
    const locked = ranked && !rankedOpen();
    box.innerHTML = `<div class="mm-layout${ranked ? ' ranked' : ''}">
      <div class="mm-main">
        <div class="mm-types" role="radiogroup" aria-label="Type de partie">
          <label class="mm-opt${!ranked ? ' on' : ''}"><input type="radio" name="mm-type" value="normale"${!ranked ? ' checked' : ''}>
            <span class="mm-opt-box"><span class="mm-opt-top"><strong>Partie normale</strong><span class="mm-dot"></span></span>
            <span class="muted">Pour le plaisir. Pas d’Elo en jeu, adversaire trouvé plus vite.</span>
            <span class="rk-chip">Aucun classement</span></span></label>
          <label class="mm-opt${ranked ? ' on' : ''}"><input type="radio" name="mm-type" value="classee"${ranked ? ' checked' : ''}>
            <span class="mm-opt-box"><span class="mm-opt-top"><strong>Partie classée</strong><span class="mm-dot"></span></span>
            <span class="mm-opt-txt">Gagne de l’Elo et monte en rang, contre un joueur de ton niveau.</span>
            <span class="mm-opt-logos" aria-hidden="true">${RANKS.slice(1).map((r) => `<img src="${logoUrl(r.k)}" alt="" width="26" height="26">`).join('')}</span></span></label>
        </div>
        ${locked
          ? `<p class="rk-locked">${ico('lock')} Joue encore ${MIN_GAMES - onlineGames} partie${MIN_GAMES - onlineGames > 1 ? 's' : ''} en ligne (normale ou entre amis) pour débloquer la partie classée.</p>`
          : `<form id="form-mm" class="mm-form">
            <p class="mm-cad-label"><b>Cadence</b>${ranked ? ' <span class="muted">· ton Elo dans chacune</span>' : ''}</p>
            <div class="mm-cads n4" role="radiogroup" aria-label="Cadence">
              ${list.map((x) => {
                const { fam, time } = splitLabel(x.label);
                const e = ranked ? ratings?.[x.cat] : null;
                return `<label class="mm-cad"><input type="radio" name="cadence" value="${x.k}"${x.k === cad ? ' checked' : ''}>
                  <span><small>${fam}</small><b>${time}</b>${ranked ? `<span class="mm-cad-elo">${rankLogo(e, 18)}<span class="rk-num">${fmt(e?.r ?? 800)}</span></span>` : ''}</span></label>`;
              }).join('')}
            </div>
            <div class="mm-go">
              <button class="btn btn-primary btn-lg">${ranked ? `${ico('trophy')} Chercher une partie classée` : `${ico('dice')} Trouver un adversaire`}</button>
              <span class="muted mm-count" id="mm-count"></span>
            </div>
            ${ranked ? `<p class="muted rk-rule">${ico('shield')} En classé, abandonner ou quitter la partie compte comme une défaite.</p>` : ''}
          </form>`}
      </div>
      ${ranked ? `<div id="mm-aside">${rankAside(rankedCat(cad))}</div>` : ''}
    </div>`;
    for (const r of box.querySelectorAll('input[name=mm-type]')) {
      r.addEventListener('change', () => {
        setPref('mm-type', r.value);
        render();
      });
    }
    const form = $('#form-mm');
    if (form) {
      const changed = () => {
        const c = form.cadence.value;
        setPref(ranked ? 'cadence-classee' : 'cadence-hasard', c);
        if (ranked) {
          $('#mm-aside').innerHTML = rankAside(rankedCat(c));
          showPlace(rankedCat(c));
        }
        watchCount(c, ranked);
      };
      for (const r of form.querySelectorAll('input[name=cadence]')) r.addEventListener('change', changed);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        startSearch(form.cadence.value, ranked);
      });
      watchCount(cad, ranked);
      if (ranked) showPlace(rankedCat(cad));
    }
  }

  /** Nombre de joueurs qui cherchent dans la file choisie, en direct. */
  function watchCount(c, ranked) {
    stopCount?.();
    const { base, inc } = toMs(c);
    const key = ranked ? rankedKey(base, inc) : `${base}-${inc}`;
    const label = (ranked ? RANKED_CADENCES.find(([k]) => k === c)?.[2] : RANDOM_CADENCES.find(([k]) => k === c)?.[1]) || c;
    stopCount = onValue(ref(db, `matchmaking/${key}`), (s) => {
      const n = s.size;
      const el = $('#mm-count');
      if (el) el.innerHTML = `${ico('friends')} ${n ? `${n} joueur${n > 1 ? 's' : ''} cherche${n > 1 ? 'nt' : ''} en ${escapeHtml(label)}` : `Personne ne cherche en ${escapeHtml(label)} pour l’instant`}`;
    }, () => {});
  }

  async function showPlace(cat) {
    const e = ratings?.[cat];
    if (!e || rankOf(e).placement) return;
    const p = await placeOf(cat, e.r).catch(() => null);
    const el = $('#mm-place');
    if (el && p && rankedCat(getPref('cadence-classee', '10+0')) === cat) el.textContent = `${p}${p === 1 ? 'er' : 'e'} au classement ${CATS[cat]}`;
  }

  // --- Recherche ----------------------------------------------------------------
  function startSearch(c, ranked) {
    stopCount?.();
    stopCount = null;
    if (!ranked) return startNormalSearch(c);
    const t0 = Date.now();
    const cat = rankedCat(c);
    const mine = ratings?.[cat];
    const myRk = rankOf(mine);
    const myElo = mine?.r ?? 800;
    const label = RANKED_CADENCES.find(([k]) => k === c)?.[2] || c;
    const lo = Math.round((myElo - 500) / 100) * 100;
    const hi = lo + 1000;
    const pct = (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
    let waiting = 1;
    let win = 50;
    card.classList.add('mm-searching');
    box.innerHTML = `<div class="mm-search-layout" role="status">
      <div class="mm-search-main">
        <p class="eyebrow">Partie classée · ${escapeHtml(label)}</p>
        <div class="mm-vs">
          <div class="mm-vs-me">${rankLogo(mine, 88)}<b>${escapeHtml(user.username)}</b><span class="muted">${myRk.placement ? `Placement ${myRk.games}/${PLACEMENT}` : myRk.name} · <span class="rk-num">${fmt(myElo)}</span></span></div>
          <div class="mm-vs-mid"><span class="mm-vs-word">VS</span><span class="rk-num mm-vs-time">${ico('hourglass')} <span id="mm-time">0:00</span></span></div>
          <div class="mm-vs-opp"><div class="mm-vs-q" aria-hidden="true"><span></span><span></span><i></i><b>?</b></div><b>Recherche…</b><span class="muted">entre <span class="rk-num" id="mm-lo"></span> et <span class="rk-num" id="mm-hi"></span></span></div>
        </div>
        <div class="mm-window">
          <p class="mm-window-head"><span>Écart d’Elo accepté</span><span class="rk-num">± <span id="mm-win">50</span></span></p>
          <div class="mm-axis">
            <div class="mm-axis-track"></div>
            <div class="mm-axis-max" style="left: ${pct(myElo - MAX_GAP)}%; width: ${pct(myElo + MAX_GAP) - pct(myElo - MAX_GAP)}%"></div>
            <div class="mm-axis-band" id="mm-band"></div>
            <div class="mm-axis-me" style="left: ${pct(myElo)}%"></div>
            ${[0, 200, 400, 600, 800, 1000].map((d, i) => `<span class="mm-axis-tick" style="left: ${i * 20}%">${fmt(lo + d)}</span>`).join('')}
          </div>
          <div class="mm-steps">${STEPS.map(([s, e]) => `<span data-s="${s}"><small>${s} s</small><b>±${e}</b></span>`).join('')}</div>
          <p class="muted mm-window-note">La pointillée montre l’écart maximal (±${MAX_GAP}), atteint après une minute.</p>
        </div>
        <div class="mm-search-foot"><span class="muted" id="mm-waiting"></span><button class="btn btn-ghost" type="button" id="mm-cancel">Annuler la recherche</button></div>
      </div>
      <aside class="mm-found" id="mm-found">
        <div class="mm-wait"><span class="mm-dots" aria-hidden="true"><i></i><i></i><i></i></span><b>En attente d’un adversaire</b>
          <p class="muted">Dès qu’un joueur dans ta fenêtre d’Elo lance une recherche, la partie est créée.</p></div>
      </aside>
    </div>`;
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      $('#mm-time') && ($('#mm-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
      const w = $('#mm-waiting');
      if (w) w.innerHTML = waiting > 1 ? `${waiting} joueurs cherchent en ${escapeHtml(label)}` : s > 20 ? 'Personne d’autre ne cherche en classé pour le moment. Tu peux attendre, ou jouer une partie normale.' : '';
      win = windowFor(Date.now() - t0);
      $('#mm-win') && ($('#mm-win').textContent = win);
      $('#mm-lo') && ($('#mm-lo').textContent = fmt(myElo - win));
      $('#mm-hi') && ($('#mm-hi').textContent = fmt(myElo + win));
      const band = $('#mm-band');
      if (band) {
        band.style.left = pct(myElo - win) + '%';
        band.style.width = pct(myElo + win) - pct(myElo - win) + '%';
      }
      box.querySelectorAll('.mm-steps span').forEach((el) => {
        const st = Number(el.dataset.s);
        const next = STEPS.find(([x]) => x > st)?.[0] ?? Infinity;
        el.className = s >= next ? 'done' : s >= st ? 'on' : '';
      });
    };
    searchTimer = setInterval(tick, 500);
    tick();
    const { base, inc } = toMs(c);
    const stop = () => {
      clearInterval(searchTimer);
      cancelSearch = null;
      card.classList.remove('mm-searching');
    };
    cancelSearch = findOpponent({
      user,
      base,
      inc,
      ranked: { cat, elo: myElo, placement: myRk.placement, proof },
      onStatus: (st) => {
        waiting = st.waiting;
        tick();
      },
      onFound: (gameId) => {
        clearInterval(searchTimer);
        cancelSearch = null;
        showFound(gameId, { cat, mine, myElo, waited: Math.floor((Date.now() - t0) / 1000) });
      },
      onError: () => {
        stop();
        render();
        box.insertAdjacentHTML('afterbegin', '<p class="error">La recherche n’a pas pu démarrer. Vérifie ta connexion et réessaie.</p>');
      },
    });
    $('#mm-cancel').addEventListener('click', () => {
      cancelSearch?.();
      stop();
      render();
    });
  }

  /** Adversaire trouvé : qui c'est, ce que la partie peut rapporter, puis la partie s'ouvre. */
  async function showFound(gameId, { mine, myElo, waited }) {
    const go = () => (location.href = 'jeu.html?partie=' + gameId);
    const g = await get(ref(db, `games/${gameId}`)).then((s) => s.val()).catch(() => null);
    if (!g?.elo) return go();
    const seat = g.white === user.id ? 'w' : 'b';
    const os = seat === 'w' ? 'b' : 'w';
    const oppElo = g.elo[os];
    const oppPl = !!g.pl?.[os];
    const oppRk = rankOf({ r: oppElo, n: oppPl ? 0 : PLACEMENT });
    const n = mine?.n || 0;
    const stakes = [1, 0.5, 0].map((s) => delta(myElo, oppElo, s, n));
    const diff = oppElo - myElo;
    const myRk = rankOf(mine);
    const winRk = rankOf({ ...(mine || {}), r: myElo + stakes[0], n: n + 1 });
    const promo = !myRk.placement && winRk.i > myRk.i;
    const sign = (x) => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0');
    $('.mm-vs-opp').innerHTML = `${oppPl ? noRankHtml(88) : `<img src="${logoUrl(oppRk.rank.k)}" alt="${oppRk.name}" width="88" height="88" class="mm-pop">`}<b>${escapeHtml(g.names[os])}</b><span class="muted">${oppPl ? 'Placement' : oppRk.name} · <span class="rk-num">${fmt(oppElo)}</span></span>`;
    $('#mm-found').classList.add('on');
    $('#mm-found').innerHTML = `<span class="rk-chip mm-found-chip">Adversaire trouvé · ${Math.floor(waited / 60)}:${String(waited % 60).padStart(2, '0')}</span>
      <div class="mm-found-opp">${oppPl ? noRankHtml(72) : `<img src="${logoUrl(oppRk.rank.k)}" alt="" width="72" height="72">`}
        <div><b class="mm-found-name">${escapeHtml(g.names[os])}</b><span style="color: ${oppPl ? 'var(--muted)' : oppRk.rank.col}">${oppPl ? 'Placement' : oppRk.name} · <span class="rk-num">${fmt(oppElo)}</span></span>
        <span class="muted">${diff === 0 ? 'Le même Elo que toi' : `${Math.abs(diff)} point${Math.abs(diff) > 1 ? 's' : ''} de ${diff > 0 ? 'plus' : 'moins'} que toi`}</span></div></div>
      <p class="mm-found-label">Ce que tu peux gagner</p>
      <div class="mm-stakes"><span class="v"><b class="rk-num">${sign(stakes[0])}</b>Victoire</span><span class="n"><b class="rk-num">${sign(stakes[1])}</b>Nulle</span><span class="d"><b class="rk-num">${sign(stakes[2])}</b>Défaite</span></div>
      ${promo ? `<p class="mm-found-promo">Une victoire te ferait passer <b style="color: ${winRk.rank.col}">${winRk.name}</b>.</p>` : ''}
      <div class="mm-found-start"><span>Tu joues les <b>${seat === 'w' ? 'Blancs' : 'Noirs'}</b></span><b class="rk-num">La partie commence dans <span id="mm-cd">3</span>…</b></div>`;
    let k = 3;
    const cd = setInterval(() => {
      k--;
      if (k <= 0) {
        clearInterval(cd);
        return go();
      }
      $('#mm-cd') && ($('#mm-cd').textContent = k);
    }, 1000);
  }

  function startNormalSearch(c) {
    const t0 = Date.now();
    let waiting = 1;
    const label = RANDOM_CADENCES.find(([k]) => k === c)?.[1] || c;
    box.innerHTML = `<div class="mm-search" role="status">
        <div class="mm-radar" aria-hidden="true"><span></span><span></span><span>${ico('dice')}</span></div>
        <p class="mm-title">Recherche d’un adversaire…</p>
        <p class="muted">${escapeHtml(label)} · <span id="mm-time">0:00</span></p>
        <p class="muted mm-waiting" id="mm-waiting"></p>
        <button class="btn btn-ghost" type="button" id="mm-cancel">Annuler</button>
      </div>`;
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      $('#mm-time') && ($('#mm-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
      const w = $('#mm-waiting');
      if (w) w.textContent = waiting > 1 ? `${waiting} joueurs cherchent dans cette cadence` : s > 20 ? 'Personne d’autre ne cherche pour le moment. Essaie une autre cadence, ou invite un ami !' : '';
    };
    searchTimer = setInterval(tick, 500);
    tick();
    const { base, inc } = toMs(c);
    cancelSearch = findOpponent({
      user,
      base,
      inc,
      onStatus: (st) => {
        waiting = st.waiting;
        tick();
      },
      onFound: (gameId) => {
        clearInterval(searchTimer);
        cancelSearch = null;
        box.innerHTML = `<div class="mm-search found" role="status"><div class="mm-radar" aria-hidden="true"><span>${ico('swords')}</span></div>
          <p class="mm-title">Adversaire trouvé !</p><p class="muted">La partie commence…</p></div>`;
        setTimeout(() => (location.href = 'jeu.html?partie=' + gameId), 600);
      },
      onError: () => {
        clearInterval(searchTimer);
        cancelSearch = null;
        render();
        box.insertAdjacentHTML('afterbegin', '<p class="error">La recherche n’a pas pu démarrer. Vérifie ta connexion et réessaie.</p>');
      },
    });
    $('#mm-cancel').addEventListener('click', () => {
      cancelSearch?.();
      cancelSearch = null;
      clearInterval(searchTimer);
      render();
    });
  }

  render();
  load().then(() => {
    // « Rejouer en classé » depuis la fin d'une partie : jouer.html?classee=10%2B0 relance la recherche
    const again = params.get('classee');
    if (again) window.history.replaceState(null, '', location.pathname + location.hash);
    if (again && user && rankedOpen() && RANKED_CADENCES.some(([k]) => k === again)) {
      setPref('mm-type', 'classee');
      setPref('cadence-classee', again);
      startSearch(again, true);
    } else if (!cancelSearch) render();
  });
}
