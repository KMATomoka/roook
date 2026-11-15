// Page d'administration : tous les membres, en direct, et ce que l'admin peut faire
// (bannir / débannir, retirer une photo, réinitialiser un mot de passe, nommer ou retirer un admin).
// Les vraies protections sont dans les règles de la base : seul un admin peut lire ces données et agir.
import { $, escapeHtml } from './common.js';
import { session, toast, picHtml, isBanActive, banEndText, profileUrl, roleBadge } from './compte.js';
import { db, ref, get, set, remove, onValue, serverTimestamp, serverNow, sendPasswordResetEmail, auth } from './fb.js';

const { user, banned } = await session;

const data = { users: {}, private: {}, status: {}, roles: {}, bans: {}, avatars: {}, games: {}, friends: {} };
let openId = null; // fiche ouverte
let banTarget = null;

if (banned) {
  // écran de suspension déjà affiché
} else if (!user) {
  location.href = 'connexion.html?retour=admin.html';
} else if (user.role !== 'admin' && user.role !== 'fondateur') {
  $('#admin-denied').hidden = false;
} else {
  start();
}

function start() {
  $('#admin-app').hidden = false;
  // Tout est suivi en direct : un nouveau membre, une connexion, un bannissement apparaissent tout seuls
  for (const node of ['users', 'private', 'status', 'roles', 'bans', 'avatars']) {
    onValue(
      ref(db, node),
      (s) => {
        data[node] = s.val() || {};
        render();
      },
      (e) => node === 'users' && denied(e),
    );
  }
  loadStats();
  $('#member-search').addEventListener('input', render);
  $('#member-sort').addEventListener('change', render);
  document.querySelectorAll('[name="filtre"]').forEach((r) => r.addEventListener('change', render));
  $('#members').addEventListener('click', onClick);
  $('#ban-form').addEventListener('submit', onBan);
  setInterval(render, 60000); // « vu il y a 3 min » reste juste
}

function denied() {
  $('#admin-app').hidden = true;
  $('#admin-denied').hidden = false;
}

/** Parties jouées et nombre d'amis de chaque membre (lu une fois, puis à la demande). */
async function loadStats() {
  try {
    const [hist, friends] = await Promise.all([get(ref(db, 'history')), get(ref(db, 'friends'))]);
    const games = {};
    for (const [uid, list] of Object.entries(hist.val() || {})) {
      const g = { n: 0, w: 0, l: 0, d: 0 };
      for (const h of Object.values(list || {})) {
        g.n++;
        if (h.result === '1/2-1/2') g.d++;
        else if ((h.result === '1-0' && h.me === 'w') || (h.result === '0-1' && h.me === 'b')) g.w++;
        else g.l++;
      }
      games[uid] = g;
    }
    data.games = games;
    data.friends = friends.val() || {};
    render();
  } catch (e) {
    console.warn('statistiques', e.message);
  }
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------
function members() {
  return Object.entries(data.users)
    .filter(([, u]) => u && u.username)
    .map(([id, u]) => {
      const st = data.status[id] || {};
      const ban = data.bans[id];
      return {
        id,
        username: u.username,
        createdAt: u.createdAt || 0,
        email: data.private[id]?.email || null,
        online: !!st.connections,
        playing: !!st.playing,
        lastSeen: st.connections ? serverNow() : st.lastSeen || 0,
        role: data.roles[id] === 'fondateur' || data.roles[id] === 'admin' ? data.roles[id] : 'member',
        admin: data.roles[id] === 'admin' || data.roles[id] === 'fondateur',
        ban: isBanActive(ban) ? ban : null,
        avatar: data.avatars[id] || null,
        games: data.games[id] || { n: 0, w: 0, l: 0, d: 0 },
        friends: Object.values(data.friends[id] || {}).map((f) => f.username).filter(Boolean),
      };
    });
}

function ago(t) {
  if (!t) return 'jamais vu';
  const s = Math.max(0, (serverNow() - t) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`;
  return 'le ' + date(t);
}
const date = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function render() {
  const all = members();
  const stat = (n, label, cls = '') => `<div class="admin-stat ${cls}"><b>${n}</b><span>${label}</span></div>`;
  $('#stats').innerHTML =
    stat(all.length, all.length > 1 ? 'membres' : 'membre') +
    stat(all.filter((m) => m.online).length, 'en ligne', 'online') +
    stat(all.filter((m) => m.playing).length, 'en partie', 'playing') +
    stat(all.filter((m) => m.ban).length, 'bannis', 'banned') +
    stat(all.filter((m) => m.admin).length, 'admins', 'admin');

  const q = $('#member-search').value.trim().toLowerCase();
  const filter = document.querySelector('[name="filtre"]:checked').value;
  const sort = $('#member-sort').value;
  let list = all.filter(
    (m) =>
      (!q || m.username.toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)) &&
      (filter === 'all' || (filter === 'online' && m.online) || (filter === 'banned' && m.ban) || (filter === 'admin' && m.admin)),
  );
  const by = {
    recent: (a, b) => b.createdAt - a.createdAt,
    seen: (a, b) => b.lastSeen - a.lastSeen,
    name: (a, b) => a.username.localeCompare(b.username),
    games: (a, b) => b.games.n - a.games.n,
  };
  list.sort(by[sort]);

  $('#members').innerHTML = list.length
    ? list.map(row).join('')
    : `<li class="empty">${all.length ? 'Aucun membre ne correspond.' : 'Aucun membre pour le moment.'}</li>`;
}

function row(m) {
  const me = m.id === user.id;
  const presence = m.playing ? 'playing' : m.online ? 'online' : 'offline';
  const badges = [
    me ? '<span class="badge me">toi</span>' : '',
    roleBadge(m.role),
    m.ban ? '<span class="badge banned">⛔ banni</span>' : '',
  ].join('');
  const statusTxt = m.playing ? '<span class="status-playing">en partie</span>' : m.online ? '<span class="status-online">en ligne</span>' : `<span class="muted">${ago(m.lastSeen)}</span>`;
  const open = openId === m.id;
  return `<li class="member ${open ? 'open' : ''} ${m.ban ? 'is-banned' : ''}" data-id="${m.id}">
    <button class="member-main" type="button" data-a="toggle" aria-expanded="${open}">
      ${picHtml(m.username, m.avatar, 'person-avatar', `<i class="presence ${presence}"></i>`)}
      <span class="member-id">
        <span class="member-name">${escapeHtml(m.username)} ${badges}</span>
        <span class="member-email">${m.email ? escapeHtml(m.email) : '<em>ancien compte, sans e-mail</em>'}</span>
      </span>
      <span class="member-col"><small>Inscrit</small>${date(m.createdAt)}</span>
      <span class="member-col"><small>Statut</small>${statusTxt}</span>
      <span class="member-col"><small>Parties</small>${m.games.n}</span>
      <span class="member-chevron" aria-hidden="true">▾</span>
    </button>
    ${open ? details(m, me) : ''}
  </li>`;
}

function details(m, me) {
  const g = m.games;
  const banInfo = m.ban
    ? `<div class="member-ban">⛔ Banni ${escapeHtml(banEndText(m.ban))}${m.ban.reason ? ` · motif : « ${escapeHtml(m.ban.reason)} »` : ''}${m.ban.byName ? ` · par ${escapeHtml(m.ban.byName)}` : ''} · le ${date(m.ban.at)}</div>`
    : '';
  const actions = [];
  if (m.ban) actions.push('<button class="btn btn-primary small" data-a="unban">✓ Débannir</button>');
  else if (!me && !m.admin) actions.push('<button class="btn btn-danger small" data-a="ban">⛔ Bannir…</button>');
  if (m.avatar) actions.push('<button class="btn btn-ghost small" data-a="photo">🖼 Retirer la photo</button>');
  if (m.email) actions.push('<button class="btn btn-ghost small" data-a="reset">✉ Envoyer un lien « nouveau mot de passe »</button>');
  actions.unshift(`<a class="btn btn-ghost small" href="${profileUrl(m.id)}">👤 Voir le profil</a>`);
  // Nommer admin : admins et fondateur. Retirer le rôle d'un admin : le fondateur seulement. Le fondateur est intouchable.
  if (!me && m.role === 'member') actions.push('<button class="btn btn-ghost small" data-a="promote">🛡 Nommer admin</button>');
  if (!me && m.role === 'admin' && user.role === 'fondateur') actions.push('<button class="btn btn-ghost small" data-a="demote">Retirer le rôle admin</button>');
  return `<div class="member-details">
    ${banInfo}
    <dl class="member-facts">
      <div><dt>E-mail</dt><dd>${m.email ? escapeHtml(m.email) : '—'}</dd></div>
      <div><dt>Inscription</dt><dd>${date(m.createdAt)}</dd></div>
      <div><dt>Dernière connexion</dt><dd>${m.online ? 'en ligne maintenant' : ago(m.lastSeen)}</dd></div>
      <div><dt>Rôle</dt><dd>${m.role === 'fondateur' ? 'Fondateur' : m.role === 'admin' ? 'Administrateur' : 'Membre'}</dd></div>
      <div><dt>Parties entre amis</dt><dd>${g.n ? `${g.n} · ${g.w} V · ${g.l} D · ${g.d} N` : 'aucune'}</dd></div>
      <div><dt>Amis (${m.friends.length})</dt><dd>${m.friends.length ? m.friends.map(escapeHtml).join(', ') : 'aucun'}</dd></div>
      <div class="wide"><dt>Identifiant</dt><dd><code>${m.id}</code></dd></div>
    </dl>
    <div class="member-actions">${actions.join('') || '<span class="muted">C’est ton compte.</span>'}</div>
    ${!me && m.role === 'fondateur' ? '<p class="muted small-note">Le fondateur ne peut être ni banni ni rétrogradé.</p>' : ''}
    ${!me && m.role === 'admin' ? `<p class="muted small-note">Un admin ne peut pas être banni.${user.role === 'fondateur' ? ' Retire-lui d’abord son rôle.' : ' Seul le fondateur peut lui retirer son rôle.'}</p>` : ''}
  </div>`;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function onClick(e) {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const id = b.closest('.member').dataset.id;
  const m = members().find((x) => x.id === id);
  if (!m) return;
  const a = b.dataset.a;
  if (a === 'toggle') {
    openId = openId === id ? null : id;
    return render();
  }
  try {
    if (a === 'ban') {
      banTarget = m;
      $('#ban-name').textContent = m.username;
      $('#ban-form').reset();
      return $('#ban-dialog').showModal();
    }
    if (a === 'unban') {
      await remove(ref(db, `bans/${id}`));
      toast(`<b>${escapeHtml(m.username)}</b> n’est plus banni.`, { cls: 'info' });
    }
    if (a === 'photo') {
      if (!confirm(`Retirer la photo de profil de ${m.username} ?`)) return;
      await remove(ref(db, `avatars/${id}`));
      toast(`Photo de <b>${escapeHtml(m.username)}</b> retirée.`, { cls: 'info' });
    }
    if (a === 'reset') {
      if (!confirm(`Envoyer à ${m.email} un e-mail pour choisir un nouveau mot de passe ?`)) return;
      await sendPasswordResetEmail(auth, m.email);
      toast(`E-mail envoyé à <b>${escapeHtml(m.email)}</b>.`, { cls: 'info' });
    }
    if (a === 'promote') {
      if (!confirm(`Nommer ${m.username} administrateur ? Il pourra bannir des membres et voir les adresses e-mail.`)) return;
      await set(ref(db, `roles/${id}`), 'admin');
      toast(`<b>${escapeHtml(m.username)}</b> est maintenant admin.`, { cls: 'info' });
    }
    if (a === 'demote') {
      if (!confirm(`Retirer le rôle admin de ${m.username} ?`)) return;
      await remove(ref(db, `roles/${id}`));
      toast(`<b>${escapeHtml(m.username)}</b> redevient membre.`, { cls: 'info' });
    }
  } catch (ex) {
    toast('Action refusée : ' + escapeHtml(ex.message), { cls: 'error' });
  }
}

async function onBan(e) {
  if (e.submitter?.value !== 'ban' || !banTarget) return;
  e.preventDefault();
  const form = e.target;
  const ms = Number(form.duree.value);
  const reason = form.motif.value.trim().slice(0, 200);
  const m = banTarget;
  try {
    await set(ref(db, `bans/${m.id}`), {
      reason,
      at: serverTimestamp(),
      until: ms ? serverNow() + ms : 0,
      by: user.id,
      byName: user.username,
    });
    $('#ban-dialog').close();
    toast(`⛔ <b>${escapeHtml(m.username)}</b> est banni ${escapeHtml(banEndText({ until: ms ? serverNow() + ms : 0 }))}.`, { cls: 'info' });
  } catch (ex) {
    toast('Bannissement refusé : ' + escapeHtml(ex.message), { cls: 'error' });
  }
  banTarget = null;
}
