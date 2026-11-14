// Page « Mes amis » : ajouter, accepter, défier, et l'historique des parties (Firebase).
import { $, escapeHtml, gameRow, saveGame, getGame, serverGameToLocal as toLocal, historyToGame as fromHistory } from './common.js';
import { session, challenge, toast, watchFriends, addFriend, acceptFriend, declineFriend, cancelRequest, removeFriend, myHistory, picHtml, setAvatar, removeAvatar } from './compte.js';

const { user } = await session;
if (!user) location.href = 'connexion.html?retour=amis.html';
else start();

let friends = [];
let incoming = [];

function start() {
  $('#friends-page').hidden = false;
  $('#profile-name').textContent = user.username;
  showMyPic();

  // Photo de profil : on clique sur la pastille ou sur le bouton, on choisit une image
  $('#pic-change').addEventListener('click', () => $('#pic-input').click());
  $('#pic-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    $('#pic-change').disabled = true;
    try {
      await setAvatar(file);
      showMyPic();
      toast('Photo de profil mise à jour ✨', { cls: 'info' });
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
    $('#pic-change').disabled = false;
  });
  $('#pic-remove').addEventListener('click', async () => {
    try {
      await removeAvatar();
      showMyPic();
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
  });

  $('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.username;
    const msg = $('#add-msg');
    try {
      msg.textContent = await addFriend(input.value);
      msg.className = 'form-msg ok';
      input.value = '';
    } catch (ex) {
      msg.textContent = ex.message;
      msg.className = 'form-msg error';
    }
    msg.hidden = false;
  });

  // Tout se met à jour en direct : présence des amis, demandes reçues et envoyées
  watchFriends((data) => {
    friends = data.friends;
    incoming = data.incoming;
    renderFriends();
    renderRequests(data);
  });
  loadHistory();
}

function showMyPic() {
  $('#profile-initial').outerHTML = picHtml(user.username, user.avatar, 'profile-avatar').replace('<span class="', '<span id="profile-initial" class="');
  $('#pic-remove').hidden = !user.avatar;
}

function avatar(name, status, url = null) {
  return picHtml(name, url, 'person-avatar', status ? `<i class="presence ${status}"></i>` : '');
}

function renderRequests({ incoming, outgoing }) {
  $('#incoming-card').hidden = !incoming.length;
  $('#incoming').innerHTML = incoming
    .map(
      (u) => `<li class="person">${avatar(u.username)}<span class="person-name">${escapeHtml(u.username)}</span>
        <span class="person-actions"><button class="btn btn-primary small" data-accept="${u.id}">Accepter</button>
        <button class="btn btn-ghost small" data-decline="${u.id}">Refuser</button></span></li>`,
    )
    .join('');
  $('#outgoing-card').hidden = !outgoing.length;
  $('#outgoing').innerHTML = outgoing
    .map(
      (u) => `<li class="person">${avatar(u.username)}<span class="person-name">${escapeHtml(u.username)} <small class="muted">en attente</small></span>
        <span class="person-actions"><button class="btn btn-ghost small" data-cancel="${u.id}">Annuler</button></span></li>`,
    )
    .join('');
}

function renderFriends() {
  // En ligne d'abord, puis en partie, puis hors ligne
  const rank = (f) => (f.online && !f.playing ? 0 : f.playing ? 1 : 2);
  const list = [...friends].sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username));
  $('#friends-count').textContent = friends.length ? `(${friends.length})` : '';
  $('#friends').innerHTML = list.length
    ? list
        .map((f) => {
          const status = f.playing ? 'playing' : f.online ? 'online' : 'offline';
          const label = f.playing ? 'en partie' : f.online ? 'en ligne' : 'hors ligne';
          return `<li class="person">${avatar(f.username, status, f.avatar)}
            <span class="person-name">${escapeHtml(f.username)} <small class="status-${status}">${label}</small></span>
            <span class="person-actions">
              <button class="btn btn-primary small" data-challenge="${f.id}" ${status === 'online' ? '' : 'disabled'}>⚔ Défier</button>
              <button class="icon-btn" data-remove="${f.id}" title="Retirer de mes amis" aria-label="Retirer ${escapeHtml(f.username)} de mes amis">✕</button>
            </span></li>`;
        })
        .join('')
    : '<li class="empty">Pas encore d’amis. Ajoute-en un avec son pseudo !</li>';
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.challenge) challenge(friends.find((f) => f.id === b.dataset.challenge));
    if (b.dataset.accept) {
      const req = incoming.find((r) => r.id === b.dataset.accept);
      await acceptFriend(req.id, req.username);
    }
    if (b.dataset.decline) await declineFriend(b.dataset.decline);
    if (b.dataset.cancel) await cancelRequest(b.dataset.cancel);
    if (b.dataset.remove) {
      const f = friends.find((x) => x.id === b.dataset.remove);
      if (!confirm(`Retirer ${f.username} de tes amis ?`)) return;
      await removeFriend(f.id);
    }
  } catch (ex) {
    toast(escapeHtml(ex.message), { cls: 'error' });
  }
});

async function loadHistory() {
  const games = await myHistory(200);
  const wins = games.filter((g) => (g.result === '1-0' && g.me === 'w') || (g.result === '0-1' && g.me === 'b')).length;
  const draws = games.filter((g) => g.result === '1/2-1/2').length;
  const losses = games.length - wins - draws;
  const n = games.length;
  $('#profile-stats').textContent = n
    ? `${n} partie${n > 1 ? 's' : ''} · ${wins} victoire${wins > 1 ? 's' : ''}, ${losses} défaite${losses > 1 ? 's' : ''}, ${draws} nulle${draws > 1 ? 's' : ''}`
    : 'Ajoute tes amis par leur pseudo, puis défie-les quand ils sont en ligne.';
  // Copie locale pour que le bilan s'ouvre directement
  for (const g of games) if (!getGame(g.id)) saveGame(toLocal(fromHistory(g)));
  $('#history').innerHTML = games.length
    ? games.slice(0, 30).map((g) => gameRow(toLocal(fromHistory(g)))).join('')
    : '<li class="empty">Tes parties contre tes amis apparaîtront ici.</li>';
}
