// Page « Jouer » : adversaire au hasard, contre un ami (comptes), contre l'ordinateur (Noa, Adriz ou Astrea), ou sur le même écran ; et les dernières parties.
import { LEVELS } from './engine.js';
import { ico } from './icons.js'; // icônes dessinées (à la place des emojis)
import { $, $$, getPref, setPref, loadGames, gameRow, escapeHtml, RIVALS, rivalOf, faceUrl } from './common.js';
import { session, challenge, watchFriends, picHtml, profileUrl, CADENCES } from './compte.js';
import { findOpponent } from './matchmaking.js';
import { db, ref, get, query, orderByKey, limitToLast, limitToFirst } from './fb.js';
import { RANKED_CADENCES, getRatings, rankOf, logoUrl, fmt, RANKS, PLACEMENT, MIN_GAMES } from './rangs.js';

const params = new URLSearchParams(location.search);

// --- Arrivée depuis l'accueil (jouer.html#ami ou #ia) : on met la carte en avant ----
const wanted = $('#card-' + location.hash.slice(1));
if (wanted) {
  wanted.scrollIntoView({ block: 'center' });
  wanted.classList.add('flash');
  setTimeout(() => wanted.classList.remove('flash'), 1400);
}

// --- Contre un ami (comptes) ----------------------------------------------------
const { user } = await session;
let friends = [];

async function loadFriends() {
  const box = $('#ami-content');
  if (!user) {
    box.innerHTML = `<p>Crée ton compte gratuit, ajoute tes amis par leur pseudo et défie-les en un clic : ils reçoivent ton défi en direct.</p>
      <div class="ami-actions">
        <a class="btn btn-primary" href="connexion.html?mode=inscription&retour=jouer.html">Créer un compte</a>
        <a class="btn btn-ghost" href="connexion.html?retour=jouer.html">Se connecter</a>
      </div>`;
    return;
  }
  // Amis et présence, mis à jour en direct
  watchFriends((data) => {
    friends = data.friends;
    renderFriends();
  });
}

function renderFriends() {
  const box = $('#ami-content');
  if (!friends.length) {
    box.innerHTML = `<p>Tu n’as pas encore d’amis sur ROOOK. Cherche-les par leur pseudo dans la barre de recherche, en haut.</p>
      <div class="ami-actions"><button class="btn btn-primary" type="button" data-open-search>⌕ Rechercher un joueur</button></div>`;
    return;
  }
  const rank = (f) => (f.online && !f.playing ? 0 : f.playing ? 1 : 2);
  const list = [...friends].sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username)).slice(0, 6);
  const nOnline = friends.filter((f) => f.online).length;
  box.innerHTML = `<p class="muted">${nOnline ? `${nOnline} ami${nOnline > 1 ? 's' : ''} en ligne` : 'Aucun ami en ligne pour le moment'}</p>
    <ul class="people compact">${list
      .map((f) => {
        const status = f.playing ? 'playing' : f.online ? 'online' : 'offline';
        const label = f.playing ? 'en partie' : f.online ? 'en ligne' : 'hors ligne';
        return `<li class="person">${picHtml(f.username, f.avatar, 'person-avatar', `<i class="presence ${status}"></i>`)}
          <span class="person-name"><a class="person-link" href="${profileUrl(f.id)}">${escapeHtml(f.username)}</a> <small class="status-${status}">${label}</small></span>
          <span class="person-actions"><button class="btn btn-primary small" data-challenge="${f.id}" ${status === 'online' ? '' : 'disabled'}>${ico('swords')} Défier</button></span></li>`;
      })
      .join('')}</ul>
    <a class="more-link" href="amis.html">Gérer mes amis →</a>`;
}

$('#ami-content').addEventListener('click', (e) => {
  const b = e.target.closest('[data-challenge]');
  if (b) challenge(friends.find((f) => f.id === b.dataset.challenge));
});
loadFriends();

// --- Adversaire au hasard (file d'attente, js/matchmaking.js) ----------------------
const mmBox = $('#mm-content');
let cancelSearch = null;
let searchTimer = null;
const cadenceName = (c) => (CADENCES.find(([k]) => k === c) || [c, c])[1];
const toMs = (c) => {
  const [m, s] = c.split('+').map(Number);
  return { base: m * 60000, inc: (s || 0) * 1000 };
};

// --- Partie classée : Elo par cadence, et 5 parties normales avant d'y avoir accès ---
let ratings = null;
let onlineGames = 0;
let recentOpps = new Map(); // adversaires des dernières 24 h → nombre de parties
async function loadRanked() {
  if (!user) return;
  const [r, first, last] = await Promise.all([
    getRatings(user.id).catch(() => null),
    get(query(ref(db, `history/${user.id}`), orderByKey(), limitToFirst(MIN_GAMES))).catch(() => null),
    get(query(ref(db, `history/${user.id}`), orderByKey(), limitToLast(40))).catch(() => null),
  ]);
  ratings = r;
  onlineGames = first?.size || 0;
  recentOpps = new Map();
  last?.forEach((s) => {
    const g = s.val();
    if (g?.opp && typeof g.date === 'number' && Date.now() - g.date < 86400000) recentOpps.set(g.opp, (recentOpps.get(g.opp) || 0) + 1);
  });
}
const rankedCat = (c) => (RANKED_CADENCES.find(([k]) => k === c) || [])[1];
const mmType = () => getPref('mm-type', 'normale');

function rankPanel(cat) {
  const e = ratings?.[cat];
  const rk = rankOf(e);
  const nextRank = RANKS[rk.i + 1];
  const catName = { bullet: 'Bullet', blitz: 'Blitz', rapide: 'Rapide' }[cat];
  if (rk.placement) {
    return `<div class="rk-panel"><img src="${logoUrl('fer')}" alt="" width="64" height="64" class="rk-panel-logo dim">
      <div><p class="rk-panel-cat">${catName} · placement</p><p class="rk-panel-name">${rk.games} / ${PLACEMENT} parties</p>
      <p class="muted rk-panel-note">Elo de départ ${fmt(e?.r ?? 800)}. Ton rang s’affiche après ${PLACEMENT} parties classées.</p></div></div>`;
  }
  return `<div class="rk-panel" style="--rk: ${rk.rank.col}"><img src="${logoUrl(rk.rank.k)}" alt="" width="64" height="64" class="rk-panel-logo">
    <div><p class="rk-panel-cat">Ton rang · ${catName}</p><p class="rk-panel-name">${rk.name}</p>
    <p class="rk-panel-elo">${fmt(rk.r)}</p>
    ${rk.next ? `<div class="rk-bar"><i style="width: ${Math.round(rk.progress * 100)}%"></i></div><p class="muted rk-panel-note">Encore ${rk.next - rk.r} pour ${rk.next >= (nextRank?.min ?? Infinity) ? nextRank.name : 'la division suivante'}</p>` : ''}
    </div></div>`;
}

function renderMatchForm() {
  if (!user) {
    mmBox.innerHTML = `<p>Affronte un joueur en ligne que tu ne connais pas, à la même cadence que toi.</p>
      <div class="ami-actions">
        <a class="btn btn-primary" href="connexion.html?mode=inscription&retour=jouer.html%23hasard">Créer un compte</a>
        <a class="btn btn-ghost" href="connexion.html?retour=jouer.html%23hasard">Se connecter</a>
      </div>`;
    return;
  }
  const type = mmType();
  const seg = `<div class="seg mm-type" role="radiogroup" aria-label="Type de partie">
      <label><input type="radio" name="mm-type" value="normale"${type === 'normale' ? ' checked' : ''}><span>Partie normale</span></label>
      <label><input type="radio" name="mm-type" value="classee"${type === 'classee' ? ' checked' : ''}><span>${ico('trophy')} Partie classée</span></label>
    </div>`;
  if (type === 'classee') {
    const saved = getPref('cadence-classee', '10+0');
    const cad = RANKED_CADENCES.some(([k]) => k === saved) ? saved : '10+0';
    const locked = onlineGames < MIN_GAMES;
    mmBox.innerHTML = `${seg}
      <p>Gagne de l’Elo et monte en rang contre un joueur de ton niveau. <a href="classe.html">Voir les rangs</a></p>
      ${locked
        ? `<p class="rk-locked">${ico('lock')} Joue encore ${MIN_GAMES - onlineGames} partie${MIN_GAMES - onlineGames > 1 ? 's' : ''} en ligne (normale ou entre amis) pour débloquer la partie classée.</p>`
        : `<form id="form-mm" class="mode-form">
          <div id="rk-panel">${ratings ? rankPanel(rankedCat(cad)) : ''}</div>
          <label>Temps pour chaque joueur
            <select name="cadence">${RANKED_CADENCES.map(([k, cat, label]) => `<option value="${k}"${k === cad ? ' selected' : ''}>${label} — ${fmt(ratings?.[cat]?.r ?? 800)}</option>`).join('')}</select>
          </label>
          <button class="btn btn-primary">${ico('trophy')} Chercher une partie classée</button>
          <p class="muted rk-rule">En classé, abandonner ou quitter la partie compte comme une défaite.</p>
        </form>`}`;
  } else {
    const saved = getPref('cadence-hasard', getPref('cadence', '10+0'));
    mmBox.innerHTML = `${seg}
      <p>Affronte un joueur en ligne que tu ne connais pas, à la même cadence que toi. Sans Elo, juste pour le plaisir.</p>
      <form id="form-mm" class="mode-form">
        <label>Temps pour chaque joueur
          <select name="cadence">${CADENCES.map(([k, label]) => `<option value="${k}"${k === saved ? ' selected' : ''}>${label}</option>`).join('')}</select>
        </label>
        <button class="btn btn-primary">${ico('dice')} Trouver un adversaire</button>
      </form>`;
  }
  for (const r of mmBox.querySelectorAll('input[name=mm-type]')) {
    r.addEventListener('change', () => {
      setPref('mm-type', r.value);
      renderMatchForm();
    });
  }
  const form = $('#form-mm');
  if (!form) return;
  if (type === 'classee') {
    form.cadence.addEventListener('change', () => ($('#rk-panel').innerHTML = rankPanel(rankedCat(form.cadence.value))));
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = e.target.cadence.value;
    setPref(type === 'classee' ? 'cadence-classee' : 'cadence-hasard', c);
    startSearch(c, type === 'classee');
  });
}

function startSearch(c, isRanked = false) {
  const t0 = Date.now();
  let waiting = 1;
  let win = null;
  const cat = isRanked ? rankedCat(c) : null;
  const myElo = isRanked ? ratings?.[cat]?.r ?? 800 : null;
  const label = isRanked ? (RANKED_CADENCES.find(([k]) => k === c) || [])[2] : cadenceName(c);
  mmBox.innerHTML = `<div class="mm-search" role="status">
      <div class="mm-radar" aria-hidden="true"><span></span><span></span><span>${isRanked ? `<img src="${logoUrl(rankOf(ratings?.[cat]).rank.k)}" alt="" width="34" height="34">` : ico('dice')}</span></div>
      <p class="mm-title">${isRanked ? 'Recherche d’un adversaire classé…' : 'Recherche d’un adversaire…'}</p>
      <p class="muted">${escapeHtml(label)} · <span id="mm-time">0:00</span></p>
      ${isRanked ? `<p class="mm-window" id="mm-window"></p>` : ''}
      <p class="muted mm-waiting" id="mm-waiting"></p>
      <button class="btn btn-ghost" type="button" id="mm-cancel">Annuler</button>
    </div>`;
  const tick = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const t = $('#mm-time');
    if (t) t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const w = $('#mm-waiting');
    if (w) w.textContent = waiting > 1 ? `${waiting} joueurs cherchent dans cette cadence` : s > 20 ? (isRanked ? 'Personne d’autre ne cherche en classé pour le moment. Tu peux attendre, ou jouer une partie normale.' : 'Personne d’autre ne cherche pour le moment. Essaie une autre cadence, ou invite un ami !') : '';
    const ww = $('#mm-window');
    if (ww && win) ww.innerHTML = `Écart d’Elo accepté : <b>± ${win}</b> <span class="muted">(${fmt(myElo - win)} à ${fmt(myElo + win)})</span>`;
  };
  searchTimer = setInterval(tick, 500);
  tick();
  const { base, inc } = toMs(c);
  const avoid = new Set([...recentOpps].filter(([, k]) => k >= 3).map(([id]) => id));
  cancelSearch = findOpponent({
    user,
    base,
    inc,
    ranked: isRanked ? { cat, elo: myElo, avoid } : null,
    onStatus: (st) => {
      waiting = st.waiting;
      win = st.window;
      tick();
    },
    onFound: (gameId) => {
      clearInterval(searchTimer);
      cancelSearch = null;
      mmBox.innerHTML = `<div class="mm-search found" role="status"><div class="mm-radar" aria-hidden="true"><span>${ico('swords')}</span></div>
        <p class="mm-title">Adversaire trouvé !</p><p class="muted">La partie commence…</p></div>`;
      setTimeout(() => (location.href = 'jeu.html?partie=' + gameId), 600);
    },
    onError: () => {
      clearInterval(searchTimer);
      cancelSearch = null;
      renderMatchForm();
      mmBox.insertAdjacentHTML('afterbegin', '<p class="error">La recherche n’a pas pu démarrer. Vérifie ta connexion et réessaie.</p>');
    },
  });
  $('#mm-cancel').addEventListener('click', () => {
    cancelSearch?.();
    cancelSearch = null;
    clearInterval(searchTimer);
    renderMatchForm();
  });
}
renderMatchForm();
loadRanked().then(() => {
  // « Rejouer en classé » depuis la fin d'une partie : jouer.html?classee=10%2B0 relance la recherche
  const again = params.get('classee');
  if (again) window.history.replaceState(null, '', location.pathname + location.hash);
  if (again && user && onlineGames >= MIN_GAMES && RANKED_CADENCES.some(([k]) => k === again)) {
    setPref('mm-type', 'classee');
    setPref('cadence-classee', again);
    startSearch(again, true);
  } else if (!cancelSearch) renderMatchForm();
});

// --- Contre l'IA ---------------------------------------------------------------
const formIa = $('#form-ia');
const lvl = $('#lvl');
lvl.value = getPref('niveau', 3);
// La tête de l'adversaire change avec le niveau : golmon au niveau 1, frime au niveau 8
const LEVEL_FACE = ['golmon', 'rire', 'content', 'neutre', 'hmm', 'grimace', 'colere', 'frime'];
// Adversaire choisi (Noa, Adriz ou Astrea) : gardé pour la prochaine fois
let rival = rivalOf(getPref('adversaire', 'noa'));
formIa.rival.value = rival.id;
// On précharge les visages pour que le changement soit instantané
for (const id of Object.keys(RIVALS)) LEVEL_FACE.forEach((f) => (new Image().src = faceUrl(id, f)));
let lastFace = null;
const showLevel = () => {
  const L = LEVELS[lvl.value - 1];
  const face = faceUrl(rival.id, LEVEL_FACE[lvl.value - 1]);
  $('#rival-name').textContent = rival.name;
  $('#ia-go').textContent = `Affronter ${rival.name}`;
  if (face !== lastFace) {
    const img = $('#noa-level-face');
    img.src = face;
    img.alt = `${rival.name}, niveau ${L.n}`;
    if (lastFace && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      img.animate(
        [{ transform: 'scale(.75) rotate(-10deg)' }, { transform: 'scale(1.1) rotate(4deg)' }, { transform: 'none' }],
        { duration: 300, easing: 'ease-out' },
      );
    }
    lastFace = face;
  }
  $('#lvl-name').textContent = `${L.n} · ${L.name}`;
  $('#lvl-elo').textContent = `(${L.elo})`;
  lvl.style.setProperty('--p', ((lvl.value - 1) / 7) * 100 + '%');
};
lvl.addEventListener('input', showLevel);
for (const r of formIa.querySelectorAll('input[name=rival]')) {
  r.addEventListener('change', () => {
    rival = rivalOf(r.value);
    setPref('adversaire', rival.id);
    showLevel();
  });
}
showLevel();
formIa.addEventListener('submit', (e) => {
  e.preventDefault();
  setPref('niveau', Number(lvl.value));
  setPref('adversaire', rival.id);
  setPref('cadence', formIa.cadence.value);
  location.href = `jeu.html?ia=${lvl.value}&adv=${rival.id}&couleur=${formIa.couleur.value}&cadence=${encodeURIComponent(formIa.cadence.value)}`;
});

// --- Sur le même écran ------------------------------------------------------------
const formLocal = $('#form-local');
formLocal.addEventListener('submit', (e) => {
  e.preventDefault();
  setPref('cadence', formLocal.cadence.value);
  location.href = `jeu.html?local=1&cadence=${encodeURIComponent(formLocal.cadence.value)}`;
});

// La dernière cadence choisie est proposée par défaut partout
for (const sel of $$('select[name=cadence]')) {
  const saved = getPref('cadence', '10+0');
  if ([...sel.options].some((o) => o.value === saved)) sel.value = saved;
}

// --- Dernières parties ----------------------------------------------------------
const games = loadGames().slice(0, 6);
if (games.length) {
  $('#recent').hidden = false;
  $('#recent-list').innerHTML = games.map(gameRow).join('');
}
