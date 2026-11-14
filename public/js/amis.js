// Page « Mes amis » : ajouter, accepter, défier, et l'historique des parties.
import { $, escapeHtml, gameRow, saveGame, getGame, serverGameToLocal as toLocal } from '/js/common.js';
import { session, api, challenge, refreshBadge, toast } from '/js/compte.js';

const { user, stats, socket } = await session;
if (!user) location.href = '/connexion?retour=/amis';
else start();

function start() {
  $('#friends-page').hidden = false;
  $('#profile-initial').textContent = user.username[0].toUpperCase();
  $('#profile-name').textContent = user.username;
  const total = stats.wins + stats.losses + stats.draws;
  $('#profile-stats').textContent = total
    ? `${total} partie${total > 1 ? 's' : ''} · ${stats.wins} victoire${stats.wins > 1 ? 's' : ''}, ${stats.losses} défaite${stats.losses > 1 ? 's' : ''}, ${stats.draws} nulle${stats.draws > 1 ? 's' : ''}`
    : 'Ajoute tes amis par leur pseudo, puis défie-les quand ils sont en ligne.';

  $('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.username;
    const msg = $('#add-msg');
    try {
      const res = await api('/api/amis', { method: 'POST', body: { username: input.value.trim() } });
      msg.textContent = res.message;
      msg.className = 'form-msg ok';
      input.value = '';
      load();
    } catch (ex) {
      msg.textContent = ex.message;
      msg.className = 'form-msg error';
    }
    msg.hidden = false;
  });

  // Mises à jour en direct : présence, demandes, nouveaux amis
  socket?.on('amis:maj', load);
  socket?.on('presence', ({ id, online, playing }) => {
    const f = friends.find((x) => x.id === id);
    if (!f) return;
    Object.assign(f, { online, playing });
    renderFriends();
  });

  load();
  loadHistory();
}

let friends = [];

async function load() {
  const data = await api('/api/amis');
  friends = data.friends;
  renderFriends();

  $('#incoming-card').hidden = !data.incoming.length;
  $('#incoming').innerHTML = data.incoming
    .map(
      (u) => `<li class="person">${avatar(u)}<span class="person-name">${escapeHtml(u.username)}</span>
        <span class="person-actions"><button class="btn btn-primary small" data-accept="${u.id}">Accepter</button>
        <button class="btn btn-ghost small" data-decline="${u.id}">Refuser</button></span></li>`,
    )
    .join('');

  $('#outgoing-card').hidden = !data.outgoing.length;
  $('#outgoing').innerHTML = data.outgoing
    .map(
      (u) => `<li class="person">${avatar(u)}<span class="person-name">${escapeHtml(u.username)} <small class="muted">en attente</small></span>
        <span class="person-actions"><button class="btn btn-ghost small" data-remove="${u.id}">Annuler</button></span></li>`,
    )
    .join('');
  refreshBadge();
}

function avatar(u, status) {
  return `<span class="person-avatar">${escapeHtml(u.username[0].toUpperCase())}${status ? `<i class="presence ${status}"></i>` : ''}</span>`;
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
          return `<li class="person">${avatar(f, status)}
            <span class="person-name">${escapeHtml(f.username)} <small class="status-${status}">${label}</small></span>
            <span class="person-actions">
              <button class="btn btn-primary small" data-challenge="${f.id}" ${f.online && !f.playing ? '' : 'disabled'}>⚔ Défier</button>
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
    if (b.dataset.challenge) challenge(friends.find((f) => f.id === Number(b.dataset.challenge)));
    if (b.dataset.accept) await api(`/api/amis/${b.dataset.accept}/accepter`, { method: 'POST' });
    if (b.dataset.decline) await api(`/api/amis/${b.dataset.decline}/refuser`, { method: 'POST' });
    if (b.dataset.remove) {
      const name = b.closest('.person').querySelector('.person-name').firstChild.textContent.trim();
      if (!confirm(`Retirer ${name} ?`)) return;
      await api(`/api/amis/${b.dataset.remove}`, { method: 'DELETE' });
    }
    if (b.dataset.accept || b.dataset.decline || b.dataset.remove) load();
  } catch (ex) {
    toast(escapeHtml(ex.message), { cls: 'error' });
  }
});

async function loadHistory() {
  const { games } = await api('/api/parties');
  // On garde une copie locale pour que le bilan s'ouvre directement
  for (const g of games) if (!getGame(g.id)) saveGame(toLocal(g));
  $('#history').innerHTML = games.length
    ? games.map((g) => gameRow(toLocal(g))).join('')
    : '<li class="empty">Tes parties contre tes amis apparaîtront ici.</li>';
}
