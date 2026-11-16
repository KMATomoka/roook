// Page « Mes amis » : la liste d'amis (présence en direct, défier, retirer) et les demandes d'amis.
import { $, escapeHtml } from './common.js';
import { ico } from './icons.js'; // icônes dessinées (à la place des emojis)
import { session, challenge, toast, watchFriends, acceptFriend, declineFriend, cancelRequest, removeFriend, picHtml, profileUrl } from './compte.js';

const { user, banned } = await session;
if (banned) {
  // l'écran de suspension est déjà affiché
} else if (!user) location.href = 'connexion.html?retour=amis.html';
else start();

let friends = [];
let incoming = [];

function start() {
  $('#friends-page').hidden = false;
  // Tout se met à jour en direct : présence des amis, demandes reçues et envoyées
  watchFriends((data) => {
    friends = data.friends;
    incoming = data.incoming;
    renderFriends();
    renderRequests(data);
  });
}

function avatar(name, status, url = null) {
  return picHtml(name, url, 'person-avatar', status ? `<i class="presence ${status}"></i>` : '');
}

function renderRequests({ incoming, outgoing }) {
  $('#incoming-card').hidden = !incoming.length;
  $('#incoming').innerHTML = incoming
    .map(
      (u) => `<li class="person">${avatar(u.username)}<span class="person-name"><a class="person-link" href="${profileUrl(u.id)}">${escapeHtml(u.username)}</a></span>
        <span class="person-actions"><button class="btn btn-primary small" data-accept="${u.id}">Accepter</button>
        <button class="btn btn-ghost small" data-decline="${u.id}">Refuser</button></span></li>`,
    )
    .join('');
  $('#outgoing-card').hidden = !outgoing.length;
  $('#outgoing').innerHTML = outgoing
    .map(
      (u) => `<li class="person">${avatar(u.username)}<span class="person-name"><a class="person-link" href="${profileUrl(u.id)}">${escapeHtml(u.username)}</a> <small class="muted">en attente</small></span>
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
            <span class="person-name"><a class="person-link" href="${profileUrl(f.id)}">${escapeHtml(f.username)}</a> <small class="status-${status}">${label}</small></span>
            <span class="person-actions">
              <button class="btn btn-primary small" data-challenge="${f.id}" ${status === 'online' ? '' : 'disabled'}>${ico('swords')} Défier</button>
              <button class="icon-btn" data-remove="${f.id}" title="Retirer de mes amis" aria-label="Retirer ${escapeHtml(f.username)} de mes amis">✕</button>
            </span></li>`;
        })
        .join('')
    : '<li class="empty">Pas encore d’amis. <a href="#" data-open-search>Cherche un joueur</a> par son pseudo dans la barre du haut.</li>';
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
