// Compte du joueur, partagé par toutes les pages (version Firebase) :
// - inscription avec e-mail + pseudo unique, connexion par e-mail (ou pseudo pour les anciens comptes)
// - rôles (membre / admin) et bannissements
// - présence en ligne, amis, demandes d'amis
// - défis en direct : notification où qu'on soit sur le site, fenêtre « Défier »
import { escapeHtml, getPref, setPref } from './common.js';
import './theme.js'; // apparence choisie dans l'inventaire (plateau, pièces…)
import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, verifyBeforeUpdateEmail, deleteUser,
  ref, get, set, update, remove, push, onValue, onChildAdded, onChildRemoved, onDisconnect, serverTimestamp,
  query, orderByKey, startAt, endAt, limitToFirst,
  serverNow, pseudoEmail, USERNAME_RE, EMAIL_RE, isLegacyEmail,
} from './fb.js';

// Menu du haut (même menu sur toutes les pages) : la page en cours est mise en avant
{
  const here = location.pathname.split('/').pop() || 'index.html';
  const section = { 'jeu.html': 'jouer.html' }[here] || here;
  document.querySelectorAll('.topnav a').forEach((a) => {
    if (a.getAttribute('href') === section) a.setAttribute('aria-current', 'page');
  });
}

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
const PSEUDO_RULE = 'Pseudo : 3 à 20 caractères, lettres, chiffres, « _ » ou « - ».';
const AUTH_ERRORS = {
  'auth/email-already-in-use': 'Cette adresse e-mail a déjà un compte. Connecte-toi, ou utilise « Mot de passe oublié ».',
  'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-email': 'Cette adresse e-mail n’est pas valide.',
  'auth/missing-email': 'Indique ton adresse e-mail.',
  'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion Internet.',
  'auth/requires-recent-login': 'Par sécurité, déconnecte-toi puis reconnecte-toi avant de faire ça.',
  'auth/user-disabled': 'Ce compte a été désactivé.',
};
const authError = (e) => new Error(AUTH_ERRORS[e.code] || 'Erreur : ' + (e.code || e.message));

/** Le pseudo est-il libre ? (lisible sans être connecté, pour l'inscription) */
export async function pseudoAvailable(username) {
  const name = String(username || '').trim();
  if (!USERNAME_RE.test(name)) return false;
  return !(await get(ref(db, `usernames/${name.toLowerCase()}`))).exists();
}

let signupDone = null; // pendant une inscription, la session attend que le profil soit écrit

export async function signUp(username, email, password) {
  username = String(username || '').trim();
  email = String(email || '').trim();
  if (!USERNAME_RE.test(username)) throw new Error(PSEUDO_RULE);
  if (!EMAIL_RE.test(email)) throw new Error(AUTH_ERRORS['auth/invalid-email']);
  if (password.length < 6) throw new Error(AUTH_ERRORS['auth/weak-password']);
  if (!(await pseudoAvailable(username))) throw new Error('Ce pseudo est déjà pris. Choisis-en un autre.');
  let finish;
  signupDone = new Promise((r) => (finish = r));
  try {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw authError(e);
    }
    const uid = cred.user.uid;
    try {
      // Tout d'un coup : si le pseudo vient d'être pris par quelqu'un d'autre, rien n'est écrit
      await update(ref(db), {
        [`users/${uid}`]: { username, createdAt: serverTimestamp() },
        [`usernames/${username.toLowerCase()}`]: uid,
        [`private/${uid}`]: { email },
      });
    } catch {
      await deleteUser(cred.user).catch(() => {});
      throw new Error('Ce pseudo vient d’être pris. Choisis-en un autre.');
    }
  } finally {
    finish();
  }
}

/** Connexion par e-mail. Les anciens comptes (sans e-mail) se connectent encore avec leur pseudo. */
export async function signIn(identifier, password) {
  identifier = String(identifier || '').trim();
  let email = identifier;
  if (!identifier.includes('@')) {
    if (!USERNAME_RE.test(identifier)) throw new Error(AUTH_ERRORS['auth/invalid-credential']);
    email = pseudoEmail(identifier);
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    throw authError(e);
  }
}

/** Envoie l'e-mail « mot de passe oublié ». Ne dit pas si l'adresse a un compte (vie privée). */
export async function resetPassword(email) {
  email = String(email || '').trim();
  if (!EMAIL_RE.test(email)) throw new Error('Indique l’adresse e-mail de ton compte.');
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw authError(e);
  }
}

/** Ajoute ou change l'adresse e-mail du compte : Firebase envoie un lien de confirmation à la nouvelle adresse. */
export async function changeEmail(email) {
  email = String(email || '').trim();
  if (!EMAIL_RE.test(email)) throw new Error(AUTH_ERRORS['auth/invalid-email']);
  try {
    await verifyBeforeUpdateEmail(auth.currentUser, email);
  } catch (e) {
    throw authError(e);
  }
}

/** Adresse e-mail réelle du compte (null pour un ancien compte sans e-mail). */
export const myEmail = () => (auth.currentUser && !isLegacyEmail(auth.currentUser.email) ? auth.currentUser.email : null);

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
  if (u && signupDone) await signupDone; // inscription en cours : on attend que le profil soit écrit
  if (u) {
    const val = (path) => get(ref(db, path)).then((x) => x.val()).catch(() => null);
    const [username, avatar, role, ban] = await Promise.all([
      val(`users/${u.uid}/username`),
      avatarOf(u.uid),
      val(`roles/${u.uid}`),
      val(`bans/${u.uid}`),
    ]);
    if (isBanActive(ban)) {
      showBanScreen(ban);
      resolveSession({ user: null, banned: ban });
      return;
    }
    currentUser = { id: u.uid, username: username || 'Joueur', avatar, role: role === 'fondateur' || role === 'admin' ? role : 'member' };
    syncEmail(u);
    startPresence();
    listenInvitations();
    listenFriendRequests();
    watchBan(u.uid);
  }
  renderAccount(currentUser);
  resolveSession({ user: currentUser });
});

// ---------------------------------------------------------------------------
// Rôles et bannissements
// ---------------------------------------------------------------------------
/** Droits d'administration : admin ou fondateur. */
export const isAdmin = () => currentUser?.role === 'admin' || currentUser?.role === 'fondateur';
export const isFounder = () => currentUser?.role === 'fondateur';

/** Badge du rôle d'un joueur (rien pour un simple membre). */
export function roleBadge(role) {
  if (role === 'fondateur') return badgeHtml('fondateur');
  if (role === 'admin') return badgeHtml('admin');
  return '';
}

// ---------------------------------------------------------------------------
// Badges : on en possède plusieurs, on en affiche UN en partie (l'emoji à côté du pseudo)
// ---------------------------------------------------------------------------
export const BADGES = {
  fondateur: { name: 'Fondateur', emoji: '👑', cls: 'founder', how: 'Réservé au fondateur de ROOOK.' },
  admin: { name: 'Admin', emoji: '🛡️', cls: 'admin', how: 'Réservé aux administrateurs.' },
  royal: { name: 'Royal', emoji: '⚜️', cls: 'royal', how: 'Débloqué avec 100 victoires en ligne (le pack Royal chess).' },
  // Badge du pack Sakura chess : ouvert à tous pour l'instant (free) ; il ne s'affiche sur le profil que si on le porte
  sakura: { name: 'Sakura', emoji: '🌸', cls: 'sakura', free: true, how: 'Le badge du pack Sakura chess, ouvert à tous.' },
};
export const ROYAL_WINS = 100;

/** Pastille d'un badge : emoji + nom (profil), ou seulement l'emoji (en partie). */
export function badgeHtml(id, { name = true } = {}) {
  const b = BADGES[id];
  if (!b) return '';
  return name
    ? `<span class="badge ${b.cls}">${b.emoji} ${b.name}</span>`
    : `<span class="badge-emoji ${b.cls}" title="${b.name}" aria-label="Badge ${b.name}">${b.emoji}</span>`;
}

/** Victoires en ligne (parties entre amis, vérifiées) dans un historique : leurs clés, des plus anciennes aux plus récentes. */
export function winKeys(history) {
  return Object.entries(history || {})
    .filter(([, g]) => g && g.mode === 'ami' && ((g.me === 'w' && g.result === '1-0') || (g.me === 'b' && g.result === '0-1')))
    .sort((a, b) => (a[1].date || 0) - (b[1].date || 0))
    .map(([k]) => k);
}

/** Badges qu'un joueur possède : selon son rôle, et Royal s'il a sa preuve de 100 victoires (ou s'il peut la donner). */
export function ownedBadges({ role, royal }) {
  const out = [];
  if (role === 'fondateur') out.push('fondateur');
  if (role === 'admin') out.push('admin');
  if (royal) out.push('royal');
  for (const [id, b] of Object.entries(BADGES)) if (b.free) out.push(id);
  return out;
}

/** Badge réellement affichable (on ignore un badge qu'on ne possède plus, par exemple un ancien admin). */
export function shownBadge(badge, role, hasRoyalProof) {
  if (badge === 'fondateur' && role === 'fondateur') return badge;
  if (badge === 'admin' && role === 'admin') return badge;
  if (badge === 'royal' && hasRoyalProof) return badge;
  if (BADGES[badge]?.free) return badge;
  return null;
}

/** Badge affiché par un joueur (vérifié : il le possède encore), ou null. */
export async function badgeOf(uid) {
  if (!uid) return null;
  const val = (path) => get(ref(db, path)).then((x) => x.val()).catch(() => null);
  const [badge, proof, role] = await Promise.all([val(`users/${uid}/badge`), val(`users/${uid}/royalProof`), val(`roles/${uid}`)]);
  return shownBadge(badge, role, !!proof);
}

/** Choisit le badge affiché en partie (null = aucun). Pour Royal, on joint la preuve : 100 victoires de son historique,
 *  rangées par date strictement croissante (c'est ce que vérifient les règles). */
export async function chooseBadge(id) {
  if (!currentUser) return;
  const uid = currentUser.id;
  if (!id) return set(ref(db, `users/${uid}/badge`), null);
  if (id === 'royal') {
    const hist = (await get(ref(db, `history/${uid}`))).val() || {};
    const keys = [];
    for (const k of winKeys(hist)) {
      const prev = keys.length ? hist[keys[keys.length - 1]].date : -Infinity;
      if (typeof hist[k].date === 'number' && hist[k].date > prev) keys.push(k);
      if (keys.length === ROYAL_WINS) break;
    }
    if (keys.length < ROYAL_WINS) throw new Error(`Il te faut ${ROYAL_WINS} victoires en ligne pour ce badge (tu en as ${keys.length}).`);
    return update(ref(db, `users/${uid}`), { royalProof: Object.fromEntries(keys.map((k, i) => ['p' + i, k])), badge: 'royal' });
  }
  return set(ref(db, `users/${uid}/badge`), id);
}
export const isBanActive = (ban) => !!ban && (!ban.until || ban.until > serverNow());

export function banEndText(ban) {
  if (!ban.until) return 'définitivement';
  return 'jusqu’au ' + new Date(ban.until).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

/** Écran affiché à un joueur banni, sur toutes les pages. */
function showBanScreen(ban) {
  document.querySelector('.ban-screen')?.remove();
  const el = document.createElement('div');
  el.className = 'ban-screen';
  el.innerHTML = `
    <div class="card ban-card">
      <img src="img/noa/colere.svg" alt="" width="96" height="96">
      <h1>Compte suspendu</h1>
      <p>Ton compte ROOOK est suspendu <b>${escapeHtml(banEndText(ban))}</b>.</p>
      ${ban.reason ? `<p class="ban-reason">Motif : ${escapeHtml(ban.reason)}</p>` : ''}
      <p class="muted">Tu peux toujours jouer contre Noa sans compte après t’être déconnecté.</p>
      <button class="btn btn-primary" type="button">Se déconnecter</button>
    </div>`;
  el.querySelector('button').addEventListener('click', async () => {
    await signOut(auth).catch(() => {});
    location.href = './';
  });
  document.body.appendChild(el);
  document.body.classList.add('is-banned');
}

/** Si un admin bannit le joueur pendant qu'il est sur le site, la page se recharge sur l'écran de suspension. */
function watchBan(uid) {
  onValue(ref(db, `bans/${uid}`), (s) => {
    if (isBanActive(s.val())) location.reload();
  });
}

/** Garde à jour l'adresse e-mail visible par les admins (après un changement d'adresse confirmé). */
function syncEmail(u) {
  if (isLegacyEmail(u.email)) return;
  get(ref(db, `private/${u.uid}/email`))
    .then((s) => s.val() !== u.email && set(ref(db, `private/${u.uid}/email`), u.email))
    .catch(() => {});
}

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
      ${user.role === 'admin' || user.role === 'fondateur' ? '<a class="icon-btn admin-link" href="admin.html" title="Administration" aria-label="Administration">🛡</a>' : ''}
      <a class="account-chip" href="profil.html" title="Mon profil">
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
              <a class="search-link" href="${profileUrl(p.id)}" title="Voir le profil de ${escapeHtml(p.username)}">
                ${picHtml(p.username, p.avatar, 'person-avatar', status ? `<i class="presence ${status}"></i>` : '')}
                <span class="search-name">${escapeHtml(p.username)}${p.relation === 'friend' ? ' <small>ami</small>' : ''}</span>
              </a>
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
      list.querySelector('.search-link')?.click(); // ouvre le profil du premier joueur trouvé
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
    ply: 0,
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

/** Une partie de l'historique : la mienne, ou celle d'un autre joueur si son profil m'est visible. */
export async function historyGame(id, uid = null) {
  if (!currentUser) return null;
  const g = (await get(ref(db, `history/${uid || currentUser.id}/${id}`))).val();
  return g ? { id, ...g } : null;
}


export const me = () => currentUser;

/** Déconnexion, puis retour à l'accueil. */
export async function logout() {
  await signOut(auth).catch(() => {});
  location.href = './';
}

// ---------------------------------------------------------------------------
// Profils
// ---------------------------------------------------------------------------
export const profileUrl = (uid) => `profil.html?id=${encodeURIComponent(uid)}`;

/**
 * Tout ce qu'il faut pour afficher le profil d'un joueur.
 * Si le profil est privé (et qu'on n'est ni lui, ni son ami, ni admin), games et friends valent null.
 */
export async function loadProfile(uid) {
  const val = (path) => get(ref(db, path)).then((s) => s.val());
  const soft = (path) => val(path).catch(() => undefined); // undefined = lecture refusée (profil privé)
  const user = await val(`users/${uid}`).catch(() => null);
  if (!user || !user.username) return null;
  const meId = currentUser?.id;
  const [avatar, status, role, history, friends, rel] = await Promise.all([
    avatarOf(uid),
    soft(`status/${uid}`),
    soft(`roles/${uid}`),
    soft(`history/${uid}`),
    soft(`friends/${uid}`),
    meId && meId !== uid
      ? Promise.all([soft(`friends/${meId}/${uid}`), soft(`sentRequests/${meId}/${uid}`), soft(`friendRequests/${meId}/${uid}`)])
      : null,
  ]);
  const visible = history !== undefined;
  const relation = !rel ? 'me' : rel[0] ? 'friend' : rel[1] ? 'sent' : rel[2] ? 'received' : 'none';
  return {
    id: uid,
    username: user.username,
    createdAt: user.createdAt || 0,
    isPrivate: user.private === true,
    bio: typeof user.bio === 'string' ? user.bio : '',
    badge: shownBadge(user.badge, role, !!user.royalProof),
    hasRoyalProof: !!user.royalProof,
    avatar,
    online: !!status?.connections,
    playing: !!status?.playing,
    lastSeen: status?.lastSeen || 0,
    role: role === 'fondateur' || role === 'admin' ? role : 'member',
    admin: role === 'admin' || role === 'fondateur',
    relation,
    visible,
    games: visible ? Object.entries(history || {}).map(([id, g]) => ({ id, ...g })) : null,
    friends: friends === undefined ? null : Object.entries(friends || {}).map(([id, f]) => ({ id, username: f.username })),
  };
}

/** Rend mon profil privé (seuls mes amis voient mes statistiques et mes parties) ou public. */
export const BIO_MAX = 300;

/** Enregistre ma bio (texte libre, 300 caractères au plus ; vide = pas de bio). */
export async function setBio(text) {
  if (!currentUser) return;
  // Pas plus d'une ligne vide d'affilée
  const bio = String(text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, BIO_MAX);
  await set(ref(db, `users/${currentUser.id}/bio`), bio || null);
  return bio;
}

export async function setProfilePrivate(isPrivate) {
  if (!currentUser) return;
  await set(ref(db, `users/${currentUser.id}/private`), !!isPrivate);
}
