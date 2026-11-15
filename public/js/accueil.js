// Page d'accueil
import { Chessground } from '../vendor/chessground/chessground.min.js';
import { LEVELS } from './engine.js';
import { $, $$, Chess, getPref, setPref, loadGames, gameRow, escapeHtml } from './common.js';
import { session, challenge, watchFriends, picHtml } from './compte.js';

// --- Échiquier animé : la « partie de l'Opéra » (Morphy, 1858) ---------------
const OPERA = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
const hero = Chessground($('#hero-board'), { viewOnly: true, coordinates: false, animation: { duration: 350 } });
let chess = new Chess();
let i = 0;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function step() {
  if (i >= OPERA.length) {
    i = 0;
    chess = new Chess();
    hero.set({ fen: chess.fen(), lastMove: undefined, check: false });
    return setTimeout(step, 1800);
  }
  const m = chess.move(OPERA[i++]);
  hero.set({ fen: chess.fen(), lastMove: [m.from, m.to], check: chess.inCheck() ? (chess.turn() === 'w' ? 'white' : 'black') : false });
  setTimeout(step, i === OPERA.length ? 4000 : 1100);
}
if (reduceMotion) {
  for (const s of OPERA) chess.move(s);
  hero.set({ fen: chess.fen() });
} else setTimeout(step, 800);

// --- Ouvrir directement une carte depuis les boutons du haut ----------------
$$('[data-open]').forEach((a) =>
  a.addEventListener('click', () => {
    const card = $('#card-' + a.dataset.open);
    setTimeout(() => {
      card.classList.add('flash');
      card.querySelector('input:not([type=radio]), button')?.focus({ preventScroll: true });
      setTimeout(() => card.classList.remove('flash'), 1200);
    }, 350);
  }),
);

// --- Contre un ami (comptes) ----------------------------------------------------
const { user } = await session;
let friends = [];

async function loadFriends() {
  const box = $('#ami-content');
  if (!user) {
    box.innerHTML = `<p>Crée ton compte gratuit, ajoute tes amis par leur pseudo et défie-les en un clic : ils reçoivent ton défi en direct.</p>
      <div class="ami-actions">
        <a class="btn btn-primary" href="connexion.html?mode=inscription&retour=.%2F%23jouer">Créer un compte</a>
        <a class="btn btn-ghost" href="connexion.html?retour=.%2F%23jouer">Se connecter</a>
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
          <span class="person-name">${escapeHtml(f.username)} <small class="status-${status}">${label}</small></span>
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

// --- Contre l'IA ---------------------------------------------------------------
const formIa = $('#form-ia');
const lvl = $('#lvl');
lvl.value = getPref('niveau', 3);
// La tête de Noa change avec le niveau : golmon au niveau 1, lunettes de soleil au niveau 8
const LEVEL_FACE = ['golmon', 'rire', 'content', 'neutre', 'hmm', 'grimace', 'colere', 'frime'];
// On précharge les visages pour que le changement soit instantané
LEVEL_FACE.forEach((f) => (new Image().src = `img/noa/${f}.svg`));
let lastFace = null;
const showLevel = () => {
  const L = LEVELS[lvl.value - 1];
  const face = LEVEL_FACE[lvl.value - 1];
  if (face !== lastFace) {
    const img = $('#noa-level-face');
    img.src = `img/noa/${face}.svg`;
    img.alt = `Noa, niveau ${L.n}`;
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
showLevel();
formIa.addEventListener('submit', (e) => {
  e.preventDefault();
  setPref('niveau', Number(lvl.value));
  setPref('cadence', formIa.cadence.value);
  location.href = `jeu.html?ia=${lvl.value}&couleur=${formIa.couleur.value}&cadence=${encodeURIComponent(formIa.cadence.value)}`;
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
