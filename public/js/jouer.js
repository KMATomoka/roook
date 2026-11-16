// Page « Jouer » : adversaire au hasard, contre un ami (comptes), contre l'ordinateur (Noa, Adriz ou Astrea), ou sur le même écran ; et les dernières parties.
import { LEVELS } from './engine.js';
import { $, $$, getPref, setPref, loadGames, gameRow, escapeHtml, RIVALS, rivalOf } from './common.js';
import { session, challenge, watchFriends, picHtml, profileUrl, CADENCES } from './compte.js';
import { findOpponent } from './matchmaking.js';

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
          <span class="person-actions"><button class="btn btn-primary small" data-challenge="${f.id}" ${status === 'online' ? '' : 'disabled'}>⚔ Défier</button></span></li>`;
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

function renderMatchForm() {
  if (!user) {
    mmBox.innerHTML = `<p>Affronte un joueur en ligne que tu ne connais pas, à la même cadence que toi.</p>
      <div class="ami-actions">
        <a class="btn btn-primary" href="connexion.html?mode=inscription&retour=jouer.html%23hasard">Créer un compte</a>
        <a class="btn btn-ghost" href="connexion.html?retour=jouer.html%23hasard">Se connecter</a>
      </div>`;
    return;
  }
  const saved = getPref('cadence-hasard', getPref('cadence', '10+0'));
  mmBox.innerHTML = `<p>Affronte un joueur en ligne que tu ne connais pas, à la même cadence que toi.</p>
    <form id="form-mm" class="mode-form">
      <label>Temps pour chaque joueur
        <select name="cadence">${CADENCES.map(([k, label]) => `<option value="${k}"${k === saved ? ' selected' : ''}>${label}</option>`).join('')}</select>
      </label>
      <button class="btn btn-primary">🎲 Trouver un adversaire</button>
    </form>`;
  $('#form-mm').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = e.target.cadence.value;
    setPref('cadence-hasard', c);
    startSearch(c);
  });
}

function startSearch(c) {
  const t0 = Date.now();
  let waiting = 1;
  mmBox.innerHTML = `<div class="mm-search" role="status">
      <div class="mm-radar" aria-hidden="true"><span></span><span></span><span>🎲</span></div>
      <p class="mm-title">Recherche d’un adversaire…</p>
      <p class="muted">${escapeHtml(cadenceName(c))} · <span id="mm-time">0:00</span></p>
      <p class="muted mm-waiting" id="mm-waiting"></p>
      <button class="btn btn-ghost" type="button" id="mm-cancel">Annuler</button>
    </div>`;
  const tick = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const t = $('#mm-time');
    if (t) t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
      mmBox.innerHTML = `<div class="mm-search found" role="status"><div class="mm-radar" aria-hidden="true"><span>⚔</span></div>
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
for (const id of Object.keys(RIVALS)) LEVEL_FACE.forEach((f) => (new Image().src = `img/${id}/${f}.svg`));
let lastFace = null;
const showLevel = () => {
  const L = LEVELS[lvl.value - 1];
  const face = `${rival.id}/${LEVEL_FACE[lvl.value - 1]}`;
  $('#rival-name').textContent = rival.name;
  if (face !== lastFace) {
    const img = $('#noa-level-face');
    img.src = `img/${face}.svg`;
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
