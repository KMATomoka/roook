// Compte du joueur, partagé par toutes les pages :
// - affiche le pseudo (ou « Se connecter ») en haut à droite
// - ouvre la connexion temps réel et reçoit les invitations, où qu'on soit sur le site
// - fenêtre « Défier un ami » (couleur + cadence)
import { escapeHtml, getPref, setPref } from '/js/common.js';

export const CADENCES = [
  ['1+0', 'Bullet · 1 min'],
  ['3+0', 'Blitz · 3 min'],
  ['3+2', 'Blitz · 3 min + 2 s'],
  ['5+0', 'Blitz · 5 min'],
  ['10+0', 'Rapide · 10 min'],
  ['15+10', 'Rapide · 15 min + 10 s'],
  ['30+0', 'Classique · 30 min'],
];
const cadenceLabel = (t) => {
  const key = `${t.base / 60000}+${t.inc / 1000}`;
  return (CADENCES.find((c) => c[0] === key) || [key, `${t.base / 60000} min + ${t.inc / 1000} s`])[1];
};

async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur du serveur.');
  return data;
}
export { api };

// ---------------------------------------------------------------------------
// Notifications (petites cartes en bas à droite)
// ---------------------------------------------------------------------------
function toastBox() {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  return box;
}

/** Affiche une notification. Renvoie l'élément (pour pouvoir la retirer). */
export function toast(html, { duration = 5000, cls = '' } = {}) {
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.innerHTML = html;
  toastBox().appendChild(t);
  const close = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 250);
  };
  t.close = close;
  if (duration) setTimeout(close, duration);
  return t;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
let socket = null;
let currentUser = null;

export const session = (async () => {
  try {
    const { user, stats } = await api('/api/moi');
    currentUser = user;
    // La connexion temps réel sert aussi aux spectateurs, connectés ou non
    socket = window.io ? window.io() : null;
    renderAccount(user);
    if (user && socket) listenInvitations();
    return { user, stats, socket };
  } catch {
    renderAccount(null);
    return { user: null, stats: null, socket: window.io ? window.io() : null };
  }
})();

function renderAccount(user) {
  const bar = document.querySelector('.topbar');
  if (!bar) return;
  const el = document.createElement('div');
  el.className = 'account';
  if (!user) {
    const back = encodeURIComponent(location.pathname + location.search);
    el.innerHTML = `<a class="btn btn-primary small" href="/connexion?retour=${back}">Se connecter</a>`;
  } else {
    el.innerHTML = `
      <a class="account-chip" href="/amis" title="Mes amis et mes parties">
        <span class="account-initial">${escapeHtml(user.username[0].toUpperCase())}</span>
        <span class="account-name">${escapeHtml(user.username)}</span>
        <span class="account-badge" hidden></span>
      </a>
      <button class="icon-btn account-logout" title="Se déconnecter" aria-label="Se déconnecter">⎋</button>`;
    el.querySelector('.account-logout').addEventListener('click', async () => {
      await api('/api/deconnexion', { method: 'POST' }).catch(() => {});
      location.href = '/';
    });
    refreshBadge();
  }
  bar.appendChild(el);
}

/** Pastille sur le pseudo = nombre de demandes d'amis reçues */
export async function refreshBadge() {
  const badge = document.querySelector('.account-badge');
  if (!badge || !currentUser) return;
  try {
    const { incoming } = await api('/api/amis');
    badge.hidden = !incoming.length;
    badge.textContent = incoming.length;
  } catch {}
}

// ---------------------------------------------------------------------------
// Invitations reçues
// ---------------------------------------------------------------------------
const inviteToasts = new Map();

function listenInvitations() {
  socket.on('invitation', (inv) => {
    if (inviteToasts.has(inv.id)) return;
    const theirColor = inv.color === 'w' ? 'les Blancs' : inv.color === 'b' ? 'les Noirs' : 'une couleur au hasard';
    const left = Math.max(0, inv.expires - Date.now());
    const t = toast(
      `<div class="toast-invite">
        <div class="toast-title">♟ ${escapeHtml(inv.from.username)} te défie !</div>
        <div class="toast-sub">${cadenceLabel(inv.time)} · il prend ${theirColor}</div>
        <div class="toast-actions">
          <button class="btn btn-primary small" data-a="ok">Accepter</button>
          <button class="btn btn-ghost small" data-a="no">Refuser</button>
        </div>
        <div class="toast-timer"><span style="animation-duration:${left}ms"></span></div>
      </div>`,
      { duration: 0, cls: 'invite' },
    );
    inviteToasts.set(inv.id, t);
    t.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'ok') {
        t.querySelectorAll('button').forEach((b) => (b.disabled = true));
        socket.emit('invite:accepter', { id: inv.id }, (res) => {
          if (res?.error) {
            toast(escapeHtml(res.error), { cls: 'error' });
            t.close();
          }
        });
      }
      if (a === 'no') {
        socket.emit('invite:refuser', { id: inv.id });
        inviteToasts.delete(inv.id);
        t.close();
      }
    });
  });

  socket.on('invitation:fin', ({ id, reason, by }) => {
    const t = inviteToasts.get(id);
    if (t) {
      inviteToasts.delete(id);
      t.close();
    }
    const pending = sentInvites.get(id);
    if (pending) {
      sentInvites.delete(id);
      pending.close();
      if (reason === 'refusee') toast(`${escapeHtml(by)} a refusé ta partie.`, { cls: 'info' });
      if (reason === 'expiree') toast(`${escapeHtml(by)} n’a pas répondu à temps.`, { cls: 'info' });
      if (reason === 'deconnecte') toast(`${escapeHtml(by)} s’est déconnecté.`, { cls: 'info' });
    }
  });

  socket.on('partie:debut', ({ id }) => {
    location.href = '/partie/' + id;
  });

  socket.on('amis:demande', ({ from }) => {
    toast(`👋 <b>${escapeHtml(from)}</b> veut être ton ami. <a href="/amis">Voir</a>`, { cls: 'info', duration: 8000 });
    refreshBadge();
  });
  socket.on('amis:maj', refreshBadge);
}

// ---------------------------------------------------------------------------
// Défier un ami
// ---------------------------------------------------------------------------
const sentInvites = new Map();

export function challenge(friend) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal challenge';
  const saved = getPref('cadence', '10+0');
  dlg.innerHTML = `
    <form method="dialog">
      <h2>Défier ${escapeHtml(friend.username)}</h2>
      <p>Il recevra une notification et aura une minute pour accepter.</p>
      <fieldset><legend>Ta couleur</legend>
        <div class="seg">
          <label><input type="radio" name="couleur" value="w"><span>Blancs</span></label>
          <label><input type="radio" name="couleur" value="random" checked><span>Au hasard</span></label>
          <label><input type="radio" name="couleur" value="b"><span>Noirs</span></label>
        </div>
      </fieldset>
      <label class="field">Temps pour chaque joueur
        <select name="cadence">${CADENCES.map(([v, l]) => `<option value="${v}" ${v === saved ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <p class="error" hidden></p>
      <div class="end-actions">
        <button class="btn btn-primary" value="send">Envoyer le défi</button>
        <button class="btn btn-ghost" value="cancel" formnovalidate>Annuler</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  dlg.showModal();
  const form = dlg.querySelector('form');
  form.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'send') return; // « Annuler » ferme la fenêtre
    e.preventDefault();
    const cadence = form.cadence.value;
    setPref('cadence', cadence);
    socket.emit('invite', { friendId: friend.id, color: form.couleur.value, cadence }, (res) => {
      if (res?.error) {
        const err = form.querySelector('.error');
        err.hidden = false;
        err.textContent = res.error;
        return;
      }
      dlg.close();
      const inv = res.invite;
      const t = toast(
        `<div class="toast-invite">
          <div class="toast-title">Défi envoyé à ${escapeHtml(friend.username)}</div>
          <div class="toast-sub">En attente de sa réponse…</div>
          <div class="toast-actions"><button class="btn btn-ghost small" data-a="cancel">Annuler</button></div>
          <div class="toast-timer"><span style="animation-duration:${Math.max(0, inv.expires - Date.now())}ms"></span></div>
        </div>`,
        { duration: 0, cls: 'invite' },
      );
      sentInvites.set(inv.id, t);
      t.querySelector('[data-a="cancel"]').addEventListener('click', () => {
        socket.emit('invite:annuler', { id: inv.id });
        sentInvites.delete(inv.id);
        t.close();
      });
    });
  });
  dlg.addEventListener('close', () => dlg.remove());
}
