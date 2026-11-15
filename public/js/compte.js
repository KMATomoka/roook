// Compte du joueur, partagé par toutes les pages (version Firebase) :
// - connexion / inscription par pseudo + mot de passe
// - présence en ligne, amis, demandes d'amis
// - défis en direct : notification où qu'on soit sur le site, fenêtre « Défier »
import { escapeHtml, getPref, setPref } from './common.js';
import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  ref, get, set, update, remove, push, onValue, onChildAdded, onChildRemoved, onDisconnect, serverTimestamp,
  query, orderByKey, startAt, endAt, limitToFirst,
  serverNow, pseudoEmail, USERNAME_RE,
} from './fb.js';

export const CADENCES = [
  ['1+0', 'Bullet · 1 min'],
  ['3+0', 'Blitz · 3 min'],
  ['3+2', 'Blitz · 3 min + 2 s'],
  ['5+0', 'Blitz · 5 min'],
  ['10+0', 'Rapide · 10 min'],
  ['15+10', 'Rapide · 15 min + 10 s'],
  ['30+0', 'Classique · 30 min'],
];
export function cadenceLabel(base, inc) {
  const key = `${base / 60000}+${inc / 1000}`;
  return (CADENCES.find((c) => c[0] === key) || [key, `${base / 60000} min + ${inc / 1000} s`])[1];
}
function parseCadence(txt) {
  const [m, i] = String(txt || '10+0').split(/[+ ]/).map(Number);
  return { base: Math.min(180, Math.max(1, m || 10)) * 60000, inc: Math.min(60, Math.max(0, i || 0)) * 1000 };
}

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
// Connexion / inscription
// ---------------------------------------------------------------------------
const AUTH_ERRORS = {
  'auth/email-already-in-use': 'Ce pseudo est déjà pris.',
  'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
  'auth/invalid-credential': 'Pseudo ou mot de passe incorrect.',
  'auth/wrong-password': 'Pseudo ou mot de passe incorrect.',
  'auth/user-not-found': 'Pseudo ou mot de passe incorrect.',
  'auth/invalid-email': 'Pseudo : 3 à 20 caractères, lettres, chiffres, « _ » ou « - ».',
  'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion Internet.',
};
const authError = (e) => new Error(AUTH_ERRORS[e.code] || 'Erreur : ' + (e.code || e.message));

export async function signUp(username, password) {
  username = username.trim();
  if (!USERNAME_RE.test(username)) throw new Error(AUTH_ERRORS['auth/invalid-email']);
  if (password.length < 6) throw new Error(AUTH_ERRORS['auth/weak-password']);
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, pseudoEmail(username), password);
  } catch (e) {
    throw authError(e);
  }
  const uid = cred.user.uid;
  await update(ref(db), {
    [`users/${uid}`]: { username, createdAt: serverTimestamp() },
    [`usernames/${username.toLowerCase()}`]: uid,
  });
}

export async function signIn(username, password) {
  username = username.trim();
  if (!USERNAME_RE.test(username)) throw new Error(AUTH_ERRORS['auth/invalid-credential']);
  try {
    await signInWithEmailAndPassword(auth, pseudoEmail(username), password);
  } catch (e) {
    throw authError(e);
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
let currentUser = null;
let resolveSession;
export const session = new Promise((r) => (resolveSession = r));
let started = false;

onAuthStateChanged(auth, async (u) => {
  if (started) return; // une seule résolution par page (après connexion/déconnexion, on recharge)
  started = true;
  if (u) {
    let username = null;
    let avatar = null;
    try {
      [username, avatar] = await Promise.all([get(ref(db, `users/${u.uid}/username`)).then((x) => x.val()), avatarOf(u.uid)]);
    } catch {}
    currentUser = { id: u.uid, username: username || u.email.split('@')[0], avatar };
    startPresence();
    listenInvitations();
    listenFriendRequests();
  }
  renderAccount(currentUser);
  resolveSession({ user: currentUser });
});

function renderAccount(user) {
  const bar = document.querySelector('.topbar');
  if (!bar || document.body.classList.contains('page-auth')) return;
  const el = document.createElement('div');
  el.className = 'account';
  if (!user) {
    const back = encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash || './');
    el.innerHTML = `<a class="btn btn-primary small" href="connexion.html?retour=${back}">Se connecter</a>`;
  } else {
    el.innerHTML = `
      ${SEARCH_HTML}
      <a class="account-chip" href="amis.html" title="Mes amis et mes parties">
        ${picHtml(user.username, user.avatar, 'account-initial')}
        <span class="account-name">${escapeHtml(user.username)}</span>
        <span class="account-badge" hidden></span>
      </a>
      <button class="icon-btn account-logout" title="Se déconnecter" aria-label="Se déconnecter">⎋</button>`;
    el.querySelector('.account-logout').addEventListener('click', async () => {
      await signOut(auth).catch(() => {});
      location.href = './';
    });
  }
  bar.appendChild(el);
  if (user) setupSearch(el.querySelector('.player-search'));
}

// ---------------------------------------------------------------------------
// Recherche de joueurs (barre du haut) : on tape le début d'un pseudo, on ajoute ou on défie
// ---------------------------------------------------------------------------
const SEARCH_HTML = `
  <div class="player-search" role="search">
    <button class="icon-btn search-toggle" type="button" aria-label="Rechercher un joueur" title="Rechercher un joueur">⌕</button>
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input type="search" class="search-input" placeholder="Rechercher un joueur" maxlength="20" autocomplete="off" spellcheck="false" aria-label="Rechercher un joueur">
      <div class="search-results" hidden></div>
    </div>
  </div>`;

/** Joueurs dont le pseudo commence par `text` (10 au maximum), avec leur lien avec moi. */
export async function searchPlayers(text) {
  const q = String(text || '').trim().toLowerCase();
  if (!currentUser || !/^[a-z0-9_-]{1,20}$/.test(q)) return [];
  const uid = currentUser.id;
  const [found, friends, sent, received] = await Promise.all([
    get(query(ref(db, 'usernames'), orderByKey(), startAt(q), endAt(q + ''), limitToFirst(10))),
    get(ref(db, `friends/${uid}`)),
    get(ref(db, `sentRequests/${uid}`)),
    get(ref(db, `friendRequests/${uid}`)),
  ]);
  const ids = Object.values(found.val() || {}).filter((id) => typeof id === 'string' && id !== uid);
  const players = await Promise.all(
    ids.map(async (id) => {
      const isFriend = friends.child(id).exists();
      const [name, avatar, st] = await Promise.all([
        get(ref(db, `users/${id}/username`)).then((x) => x.val()).catch(() => null),
        avatarOf(id),
        isFriend ? get(ref(db, `status/${id}`)).then((x) => x.val() || {}).catch(() => ({})) : null,
      ]);
      if (!name) return null; // compte supprimé
      const relation = isFriend ? 'friend' : sent.child(id).exists() ? 'sent' : received.child(id).exists() ? 'received' : 'none';
      return { id, username: name, avatar, relation, online: !!st?.connections, playing: !!st?.playing };
    }),
  );
  return players.filter(Boolean);
}

/** Ouvre la recherche et place le curseur dedans (par exemple depuis un bouton « Ajouter un ami »). */
export function openPlayerSearch() {
  const box = document.querySelector('.player-search');
  if (!box) return;
  box.classList.add('open');
  box.querySelector('.search-input').focus();
}

function setupSearch(box) {
  if (!box) return;
  const input = box.querySelector('.search-input');
  const list = box.querySelector('.search-results');
  let timer = null;
  let seq = 0;
  let results = [];

  const close = () => {
    list.hidden = true;
    box.classList.remove('open');
  };
  const action = (p) => {
    if (p.relation === 'none') return '<button class="btn btn-primary small" data-s="add">+ Ajouter</button>';
    if (p.relation === 'sent') return '<span class="search-tag">Demande envoyée</span>';
    if (p.relation === 'received') return '<button class="btn btn-primary small" data-s="accept">Accepter</button>';
    if (p.online && !p.playing) return '<button class="btn btn-primary small" data-s="challenge">⚔ Défier</button>';
    return `<span class="search-tag">${p.playing ? 'En partie' : 'Hors ligne'}</span>`;
  };
  const render = (msg) => {
    list.hidden = false;
    if (msg) return void (list.innerHTML = `<div class="search-empty">${msg}</div>`);
    list.innerHTML = results.length
      ? results
          .map((p) => {
            const status = p.relation !== 'friend' ? '' : p.playing ? 'playing' : p.online ? 'online' : 'offline';
            return `<div class="search-row" data-id="${p.id}">
              ${picHtml(p.username, p.avatar, 'person-avatar', status ? `<i class="presence ${status}"></i>` : '')}
              <span class="search-name">${escapeHtml(p.username)}${p.relation === 'friend' ? ' <small>ami</small>' : ''}</span>
              ${action(p)}
            </div>`;
          })
          .join('')
      : '<div class="search-empty">Aucun joueur trouvé.</div>';
  };
  const run = async () => {
    const text = input.value.trim();
    const n = ++seq;
    if (!text) return void (list.hidden = true);
    if (!/^[A-Za-z0-9_-]+$/.test(text)) return render('Un pseudo ne contient que des lettres, des chiffres, « _ » ou « - ».');
    try {
      const found = await searchPlayers(text);
      if (n !== seq) return;
      results = found;
      render();
    } catch {
      if (n === seq) render('Recherche impossible pour le moment.');
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 220);
  });
  input.addEventListener('focus', () => input.value.trim() && run());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      close();
      input.blur();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      list.querySelector('.search-row button')?.click();
    }
  });
  box.querySelector('.search-toggle').addEventListener('click', () => (box.classList.contains('open') ? close() : openPlayerSearch()));
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && !e.target.closest('[data-open-search]')) close();
  });
  // Raccourci clavier : « / » pour chercher un joueur
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      openPlayerSearch();
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-search]')) {
      e.preventDefault();
      openPlayerSearch();
    }
  });
  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    const p = results.find((r) => r.id === b.closest('.search-row').dataset.id);
    if (!p) return;
    b.disabled = true;
    try {
      if (b.dataset.s === 'add') toast(escapeHtml(await addFriend(p.username)), { cls: 'info' });
      if (b.dataset.s === 'accept') {
        await acceptFriend(p.id, p.username);
        toast(`Toi et <b>${escapeHtml(p.username)}</b> êtes maintenant amis !`, { cls: 'info' });
      }
      if (b.dataset.s === 'challenge') {
        close();
        return challenge({ id: p.id, username: p.username });
      }
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
    run();
  });
}

// ---------------------------------------------------------------------------
// Photos de profil : une petite image carrée (160 px) rangée dans la base, sous avatars/{uid}
// (le stockage de fichiers de Firebase n'est pas gratuit, et 160 px suffisent largement).
// ---------------------------------------------------------------------------
const PIC_RE = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/;
const PIC_SIZE = 160;
const picCache = new Map();
const cleanPic = (v) => (typeof v === 'string' && PIC_RE.test(v) ? v : null);

/** Photo d'un joueur (data URL) ou null. Mise en cache pour la page. */
export function avatarOf(uid) {
  if (!uid) return Promise.resolve(null);
  if (!picCache.has(uid)) picCache.set(uid, get(ref(db, `avatars/${uid}`)).then((s) => cleanPic(s.val())).catch(() => null));
  return picCache.get(uid);
}

/** Pastille ronde : la photo si elle existe, sinon l'initiale du pseudo. */
export function picHtml(name, url, cls = 'person-avatar', extra = '') {
  const pic = cleanPic(url);
  const inner = pic ? `<img src="${pic}" alt="" draggable="false">` : escapeHtml((name || '?')[0].toUpperCase());
  return `<span class="${cls}${pic ? ' has-pic' : ''}">${inner}${extra}</span>`;
}

/** Recadre l'image choisie au centre, la réduit à 160 px et l'enregistre comme photo de profil. */
export async function setAvatar(file) {
  if (!currentUser) throw new Error('Connecte-toi d’abord.');
  if (!file || !/^image\//.test(file.type)) throw new Error('Choisis une image (JPG, PNG…).');
  if (file.size > 25e6) throw new Error('Image trop lourde (25 Mo maximum).');
  let img;
  try {
    img = await createImageBitmap(file);
  } catch {
    throw new Error('Cette image ne peut pas être lue. Essaie un JPG ou un PNG.');
  }
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PIC_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, PIC_SIZE, PIC_SIZE);
  img.close?.();
  let url = canvas.toDataURL('image/webp', 0.85);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.85);
  await set(ref(db, `avatars/${currentUser.id}`), url);
  applyMyPic(url);
  return url;
}

export async function removeAvatar() {
  if (!currentUser) return;
  await remove(ref(db, `avatars/${currentUser.id}`));
  applyMyPic(null);
}

function applyMyPic(url) {
  currentUser.avatar = url;
  picCache.set(currentUser.id, Promise.resolve(url));
  const chip = document.querySelector('.account-chip .account-initial');
  if (chip) chip.outerHTML = picHtml(currentUser.username, url, 'account-initial');
}

// ---------------------------------------------------------------------------
// Présence : une entrée par onglet ouvert, effacée automatiquement à la fermeture
// ---------------------------------------------------------------------------
function startPresence() {
  const uid = currentUser.id;
  onValue(ref(db, '.info/connected'), (s) => {
    if (!s.val()) return;
    const me = push(ref(db, `status/${uid}/connections`));
    onDisconnect(me).remove();
    set(me, true);
    onDisconnect(ref(db, `status/${uid}/lastSeen`)).set(serverTimestamp());
  });
}

/** Indique aux amis qu'on est en partie (jusqu'à la fermeture de la page). */
export function markPlaying(gameId) {
  if (!currentUser) return () => {};
  const r = push(ref(db, `status/${currentUser.id}/playing`));
  onDisconnect(r).remove();
  set(r, gameId);
  return () => remove(r);
}

// ---------------------------------------------------------------------------
// Amis
// ---------------------------------------------------------------------------
/** Suit en direct les amis (avec leur présence) et les demandes. Appelle cb({ friends, incoming, outgoing }). */
export function watchFriends(cb) {
  if (!currentUser) return;
  const uid = currentUser.id;
  const friends = new Map();
  const statusOff = new Map();
  let incoming = [];
  let outgoing = [];
  const emit = () => cb({ friends: [...friends.values()], incoming, outgoing });

  onValue(ref(db, `friends/${uid}`), (snap) => {
    const val = snap.val() || {};
    for (const [fid, off] of statusOff) {
      if (!val[fid]) {
        off.forEach((f) => f());
        statusOff.delete(fid);
        friends.delete(fid);
      }
    }
    for (const [fid, f] of Object.entries(val)) {
      if (!friends.has(fid)) friends.set(fid, { id: fid, username: f.username, online: false, playing: false, avatar: null });
      if (!statusOff.has(fid)) {
        statusOff.set(fid, [
          onValue(ref(db, `status/${fid}`), (s) => {
            const st = s.val() || {};
            const fr = friends.get(fid);
            if (!fr) return;
            fr.online = !!st.connections;
            fr.playing = !!st.playing;
            emit();
          }),
          onValue(ref(db, `avatars/${fid}`), (s) => {
            const fr = friends.get(fid);
            if (!fr) return;
            fr.avatar = cleanPic(s.val());
            picCache.set(fid, Promise.resolve(fr.avatar));
            emit();
          }),
        ]);
      }
    }
    emit();
  });
  onValue(ref(db, `friendRequests/${uid}`), (s) => {
    incoming = Object.entries(s.val() || {}).map(([id, v]) => ({ id, username: v.username, at: v.at }));
    emit();
  });
  onValue(ref(db, `sentRequests/${uid}`), (s) => {
    outgoing = Object.entries(s.val() || {}).map(([id, v]) => ({ id, username: v.username, at: v.at }));
    emit();
  });
}

export async function addFriend(username) {
  const me = currentUser;
  const name = String(username || '').trim();
  if (!USERNAME_RE.test(name)) throw new Error('Aucun joueur avec ce pseudo.');
  const uid = (await get(ref(db, `usernames/${name.toLowerCase()}`))).val();
  if (!uid) throw new Error('Aucun joueur avec ce pseudo.');
  if (uid === me.id) throw new Error('Tu ne peux pas t’ajouter toi-même 🙂');
  const theirName = (await get(ref(db, `users/${uid}/username`))).val() || name;
  if ((await get(ref(db, `friends/${me.id}/${uid}`))).exists()) throw new Error(`${theirName} est déjà ton ami.`);
  if ((await get(ref(db, `sentRequests/${me.id}/${uid}`))).exists()) throw new Error('Demande déjà envoyée.');
  if ((await get(ref(db, `friendRequests/${me.id}/${uid}`))).exists()) {
    // Il m'avait déjà envoyé une demande : on accepte directement
    await acceptFriend(uid, theirName);
    return `Toi et ${theirName} êtes maintenant amis !`;
  }
  await update(ref(db), {
    [`friendRequests/${uid}/${me.id}`]: { username: me.username, at: serverTimestamp() },
    [`sentRequests/${me.id}/${uid}`]: { username: theirName, at: serverTimestamp() },
  });
  return `Demande envoyée à ${theirName}.`;
}

export function acceptFriend(fromId, fromName) {
  const me = currentUser;
  return update(ref(db), {
    [`friends/${me.id}/${fromId}`]: { username: fromName, since: serverTimestamp() },
    [`friends/${fromId}/${me.id}`]: { username: me.username, since: serverTimestamp() },
    [`friendRequests/${me.id}/${fromId}`]: null,
    [`sentRequests/${fromId}/${me.id}`]: null,
  });
}

export function declineFriend(fromId) {
  const me = currentUser;
  return update(ref(db), { [`friendRequests/${me.id}/${fromId}`]: null, [`sentRequests/${fromId}/${me.id}`]: null });
}

export function cancelRequest(toId) {
  const me = currentUser;
  return update(ref(db), { [`friendRequests/${toId}/${me.id}`]: null, [`sentRequests/${me.id}/${toId}`]: null });
}

export function removeFriend(fid) {
  const me = currentUser;
  return update(ref(db), { [`friends/${me.id}/${fid}`]: null, [`friends/${fid}/${me.id}`]: null });
}

/** Pastille sur le pseudo = nombre de demandes d'amis reçues */
function setBadge(n) {
  const badge = document.querySelector('.account-badge');
  if (!badge) return;
  badge.hidden = !n;
  badge.textContent = n;
}

function listenFriendRequests() {
  const loadedAt = serverNow() - 5000;
  onValue(ref(db, `friendRequests/${currentUser.id}`), (s) => setBadge(Object.keys(s.val() || {}).length));
  onChildAdded(ref(db, `friendRequests/${currentUser.id}`), (s) => {
    const v = s.val();
    if ((v.at || 0) > loadedAt) toast(`👋 <b>${escapeHtml(v.username)}</b> veut être ton ami. <a href="amis.html">Voir</a>`, { cls: 'info', duration: 8000 });
  });
}

// ---------------------------------------------------------------------------
// Défis reçus
// ---------------------------------------------------------------------------
const inviteToasts = new Map();

function listenInvitations() {
  const uid = currentUser.id;
  onChildAdded(ref(db, `invites/${uid}`), (snap) => {
    const inv = { id: snap.key, ...snap.val() };
    const left = inv.expires - serverNow();
    if (left <= 0) return void remove(snap.ref).catch(() => {});
    const theirColor = inv.color === 'w' ? 'les Blancs' : inv.color === 'b' ? 'les Noirs' : 'une couleur au hasard';
    const t = toast(
      `<div class="toast-invite">
        <div class="toast-title">${picHtml(inv.fromName, null, 'toast-pic')} ${escapeHtml(inv.fromName)} te défie !</div>
        <div class="toast-sub">${cadenceLabel(inv.base, inv.inc)} · il prend ${theirColor}</div>
        <div class="toast-actions">
          <button class="btn btn-primary small" data-a="ok">Accepter</button>
          <button class="btn btn-ghost small" data-a="no">Refuser</button>
        </div>
        <div class="toast-timer"><span style="animation-duration:${left}ms"></span></div>
      </div>`,
      { duration: 0, cls: 'invite' },
    );
    inviteToasts.set(inv.id, t);
    avatarOf(inv.from).then((url) => {
      const el = t.querySelector('.toast-pic');
      if (url && el) el.outerHTML = picHtml(inv.fromName, url, 'toast-pic');
    });
    const expire = setTimeout(() => closeInvite(inv.id), left);
    t.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      clearTimeout(expire);
      t.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        if (a === 'ok') await acceptInvite(inv);
        else await replyInvite(inv, 'declined');
      } catch {
        toast('Cette invitation n’est plus valable.', { cls: 'error' });
      }
      closeInvite(inv.id);
    });
  });
  // Invitation annulée par l'autre joueur (ou expirée)
  onChildRemoved(ref(db, `invites/${uid}`), (snap) => closeInvite(snap.key));
}

function closeInvite(id) {
  const t = inviteToasts.get(id);
  if (t) {
    inviteToasts.delete(id);
    t.close();
  }
}

function replyInvite(inv, status, gameId = null) {
  return update(ref(db), {
    [`inviteReplies/${inv.from}/${inv.id}`]: { status, gameId, by: currentUser.username, at: serverTimestamp() },
    [`invites/${currentUser.id}/${inv.id}`]: null,
  });
}

async function acceptInvite(inv) {
  const me = currentUser;
  const exists = (await get(ref(db, `invites/${me.id}/${inv.id}`))).exists();
  if (!exists) throw new Error('expirée');
  let inviterColor = inv.color;
  if (inviterColor !== 'w' && inviterColor !== 'b') inviterColor = Math.random() < 0.5 ? 'w' : 'b';
  const inviter = { id: inv.from, name: inv.fromName };
  const mine = { id: me.id, name: me.username };
  const white = inviterColor === 'w' ? inviter : mine;
  const black = inviterColor === 'w' ? mine : inviter;
  const gameRef = push(ref(db, 'games'));
  await set(gameRef, {
    white: white.id,
    black: black.id,
    names: { w: white.name, b: black.name },
    time: { base: inv.base, inc: inv.inc },
    clock: { w: inv.base, b: inv.base, at: 0 },
    status: 'playing',
    round: 1,
    rematch: { w: false, b: false },
    createdAt: serverTimestamp(),
  });
  await replyInvite(inv, 'accepted', gameRef.key);
  location.href = 'jeu.html?partie=' + gameRef.key;
}

// ---------------------------------------------------------------------------
// Défier un ami
// ---------------------------------------------------------------------------
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
  form.addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'send') return;
    e.preventDefault();
    const err = form.querySelector('.error');
    const cadence = form.cadence.value;
    setPref('cadence', cadence);
    try {
      await sendInvite(friend, form.couleur.value, parseCadence(cadence));
      dlg.close();
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message;
    }
  });
  dlg.addEventListener('close', () => dlg.remove());
}

async function sendInvite(friend, color, time) {
  const me = currentUser;
  const st = (await get(ref(db, `status/${friend.id}`))).val() || {};
  if (!st.connections) throw new Error(`${friend.username} n’est pas connecté.`);
  if (st.playing) throw new Error(`${friend.username} est déjà en partie.`);
  const invRef = push(ref(db, `invites/${friend.id}`));
  const expires = serverNow() + 60000;
  await set(invRef, { from: me.id, fromName: me.username, toName: friend.username, color, base: time.base, inc: time.inc, expires, at: serverTimestamp() });

  const t = toast(
    `<div class="toast-invite">
      <div class="toast-title">Défi envoyé à ${escapeHtml(friend.username)}</div>
      <div class="toast-sub">En attente de sa réponse…</div>
      <div class="toast-actions"><button class="btn btn-ghost small" data-a="cancel">Annuler</button></div>
      <div class="toast-timer"><span style="animation-duration:60000ms"></span></div>
    </div>`,
    { duration: 0, cls: 'invite' },
  );
  const replyRef = ref(db, `inviteReplies/${me.id}/${invRef.key}`);
  let done = false;
  const finish = () => {
    done = true;
    clearTimeout(timer);
    off();
    t.close();
    remove(replyRef).catch(() => {});
  };
  const off = onValue(replyRef, (s) => {
    const r = s.val();
    if (!r || done) return;
    finish();
    if (r.status === 'accepted') location.href = 'jeu.html?partie=' + r.gameId;
    else toast(`${escapeHtml(friend.username)} a refusé ta partie.`, { cls: 'info' });
  });
  const timer = setTimeout(() => {
    if (done) return;
    finish();
    remove(invRef).catch(() => {});
    toast(`${escapeHtml(friend.username)} n’a pas répondu à temps.`, { cls: 'info' });
  }, 60000);
  t.querySelector('[data-a="cancel"]').addEventListener('click', () => {
    if (done) return;
    finish();
    remove(invRef).catch(() => {});
  });
}

/** Historique des parties du joueur (les plus récentes d'abord). */
export async function myHistory(limit = 100) {
  if (!currentUser) return [];
  const { query, limitToLast } = await import('./fb.js');
  const snap = await get(query(ref(db, `history/${currentUser.id}`), limitToLast(limit)));
  return Object.entries(snap.val() || {})
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => (b.date || 0) - (a.date || 0));
}

export async function historyGame(id) {
  if (!currentUser) return null;
  const g = (await get(ref(db, `history/${currentUser.id}/${id}`))).val();
  return g ? { id, ...g } : null;
}

export const me = () => currentUser;
