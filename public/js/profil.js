// Page « Profil » : statistiques d'un joueur (victoires, défaites, taux, séries, couleurs, contre Noa…),
// ses dernières parties, et pour son propre profil : le choix public / privé.
import { $, escapeHtml } from './common.js';
import { LEVELS } from './engine.js';
import {
  session, toast, picHtml, loadProfile, setProfilePrivate, profileUrl, addFriend, acceptFriend, challenge, cadenceLabel,
} from './compte.js';

const LEVEL_FACE = ['golmon', 'rire', 'content', 'neutre', 'hmm', 'grimace', 'colere', 'frime'];
const page = $('#profile-page');
const { user, banned } = await session;
const wanted = new URLSearchParams(location.search).get('id');

if (banned) {
  // écran de suspension déjà affiché
} else if (!user) {
  location.href = 'connexion.html?retour=' + encodeURIComponent('profil.html' + location.search);
} else {
  load(wanted || user.id);
}

async function load(uid) {
  let p;
  try {
    p = await loadProfile(uid);
  } catch {
    p = null;
  }
  if (!p) {
    page.innerHTML = `<div class="card notfound"><h2>Joueur introuvable</h2><p>Ce profil n’existe pas ou a été supprimé.</p><a class="btn btn-primary" href="./">Accueil</a></div>`;
    return;
  }
  document.title = `${p.username} — ROOOK`;
  render(p);
}

// ---------------------------------------------------------------------------
// Calcul des statistiques à partir de l'historique des parties
// ---------------------------------------------------------------------------
const outcome = (g) => (g.result === '1/2-1/2' ? 'd' : (g.result === '1-0' && g.me === 'w') || (g.result === '0-1' && g.me === 'b') ? 'w' : 'l');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const plies = (g) => (g.moves ? g.moves.split(' ').filter(Boolean).length : 0);

function record(list) {
  const r = { n: list.length, w: 0, l: 0, d: 0 };
  for (const g of list) r[outcome(g)]++;
  r.rate = pct(r.w, r.n);
  r.score = r.n ? Math.round(((r.w + r.d / 2) / r.n) * 100) : 0;
  return r;
}

function stats(games) {
  const list = [...games].sort((a, b) => (a.date || 0) - (b.date || 0)); // du plus ancien au plus récent
  const all = record(list);
  const friends = list.filter((g) => g.mode !== 'ia');
  const noa = list.filter((g) => g.mode === 'ia');

  // Séries de victoires
  let cur = 0, best = 0, run = 0;
  for (const g of list) {
    run = outcome(g) === 'w' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  for (let i = list.length - 1; i >= 0 && outcome(list[i]) === 'w'; i--) cur++;
  // Série en cours, quelle qu'elle soit (victoires, défaites ou nulles)
  let streakKind = list.length ? outcome(list[list.length - 1]) : null;
  let streak = 0;
  for (let i = list.length - 1; i >= 0 && outcome(list[i]) === streakKind; i--) streak++;

  // Couleurs
  const white = record(list.filter((g) => g.me === 'w'));
  const black = record(list.filter((g) => g.me === 'b'));

  // Comment se terminent les victoires et les défaites
  const how = (kind) => {
    const c = {};
    for (const g of list) if (outcome(g) === kind) c[g.reason || 'autre'] = (c[g.reason || 'autre'] || 0) + 1;
    return c;
  };

  // Rival : l'adversaire le plus affronté entre amis
  const opps = new Map();
  for (const g of friends) {
    const name = g.me === 'w' ? g.black : g.white;
    const key = g.opp || name;
    if (!opps.has(key)) opps.set(key, { id: g.opp || null, name, games: [] });
    opps.get(key).games.push(g);
  }
  const rival = [...opps.values()].sort((a, b) => b.games.length - a.games.length)[0] || null;

  // Contre Noa : meilleur niveau battu
  const beaten = noa.filter((g) => outcome(g) === 'w').map((g) => g.level || 0);
  const bestLevel = beaten.length ? Math.max(...beaten) : 0;

  // Longueur des parties, cadence préférée, victoire la plus rapide
  const lengths = list.map(plies);
  const avgMoves = list.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / list.length / 2) : 0;
  const wins = list.filter((g) => outcome(g) === 'w' && plies(g) > 0);
  const fastest = wins.length ? wins.reduce((a, b) => (plies(b) < plies(a) ? b : a)) : null;
  const cad = new Map();
  for (const g of list) if (g.base) cad.set(`${g.base}|${g.inc || 0}`, (cad.get(`${g.base}|${g.inc || 0}`) || 0) + 1);
  const favCad = [...cad.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    all, friends: record(friends), noa: record(noa), noaGames: noa, white, black,
    best, cur, streak, streakKind,
    winsHow: how('w'), lossesHow: how('l'),
    rival: rival && { ...rival, rec: record(rival.games) },
    bestLevel, avgMoves, fastest,
    favCadence: favCad ? cadenceLabel(Number(favCad[0].split('|')[0]), Number(favCad[0].split('|')[1])) : null,
    form: list.slice(-10).map(outcome),
    recent: [...list].reverse().slice(0, 12),
  };
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------
const date = (t, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (t ? new Date(t).toLocaleDateString('fr-FR', opts) : '—');
function ago(t) {
  if (!t) return 'jamais vu';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `vu il y a ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `vu il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `vu il y a ${Math.floor(s / 86400)} j`;
  return 'vu le ' + date(t);
}
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const REASON_SHORT = { mat: 'Échec et mat', abandon: 'Abandon', temps: 'Au temps', accord: 'Accord', pat: 'Pat', repetition: 'Répétition', materiel: 'Matériel', '50coups': '50 coups', 'temps-materiel': 'Temps (matériel)', autre: 'Autre' };

function render(p) {
  const me = p.relation === 'me';
  const presence = p.playing ? 'playing' : p.online ? 'online' : 'offline';
  const presenceTxt = p.playing ? '<span class="status-playing">● en partie</span>' : p.online ? '<span class="status-online">● en ligne</span>' : `<span class="muted">${ago(p.lastSeen)}</span>`;
  const s = p.games ? stats(p.games) : null;

  page.innerHTML = `
    <section class="card pf-hero">
      <div class="pf-pic">${picHtml(p.username, p.avatar, 'profile-avatar', `<i class="presence ${presence}"></i>`)}</div>
      <div class="pf-id">
        <h1>${escapeHtml(p.username)}
          ${p.admin ? '<span class="badge admin">🛡 admin</span>' : ''}
          ${p.isPrivate ? '<span class="badge">🔒 privé</span>' : ''}
          ${p.relation === 'friend' ? '<span class="badge me">ami</span>' : ''}
        </h1>
        <p class="pf-meta">${presenceTxt}<span>Membre depuis ${date(p.createdAt, { month: 'long', year: 'numeric' })}</span>${p.friends ? `<span>${plural(p.friends.length, 'ami')}</span>` : ''}</p>
        ${s ? `<p class="pf-headline">${s.all.n ? `<b>${s.all.rate}%</b> de victoires sur ${plural(s.all.n, 'partie')}` : 'Pas encore de partie jouée'}</p>` : ''}
      </div>
      <div class="pf-actions">${actions(p)}</div>
    </section>

    ${me ? privacyCard(p) : ''}

    ${!p.visible ? `
      <section class="card pf-locked">
        <div class="pf-lock">🔒</div>
        <h2>Ce profil est privé</h2>
        <p class="muted">Seuls les amis de ${escapeHtml(p.username)} voient ses statistiques et ses parties.${p.relation === 'none' ? ' Ajoute-le en ami pour les voir.' : ''}</p>
      </section>` : s.all.n === 0 ? `
      <section class="card pf-empty">
        <img src="img/noa/hmm.svg" alt="" width="80" height="80">
        <h2>Aucune partie pour l’instant</h2>
        <p class="muted">${me ? 'Tes statistiques apparaîtront ici dès ta première partie terminée, contre un ami ou contre Noa.' : `${escapeHtml(p.username)} n’a pas encore terminé de partie.`}</p>
        ${me ? '<a class="btn btn-primary" href="./#jouer">Jouer une partie</a>' : ''}
      </section>` : statsHtml(p, s)}
  `;

  wire(p);
}

function actions(p) {
  if (p.relation === 'me') {
    return `<a class="btn btn-ghost small" href="amis.html">👥 Mes amis</a>
      <a class="btn btn-ghost small" href="amis.html#photo">📷 Changer ma photo</a>`;
  }
  if (p.relation === 'none') return '<button class="btn btn-primary" data-act="add">+ Ajouter en ami</button>';
  if (p.relation === 'sent') return '<span class="search-tag">Demande d’ami envoyée</span>';
  if (p.relation === 'received') return '<button class="btn btn-primary" data-act="accept">Accepter sa demande</button>';
  return `<button class="btn btn-primary" data-act="challenge" ${p.online && !p.playing ? '' : 'disabled'} title="${p.online ? '' : 'Il doit être en ligne'}">⚔ Défier</button>`;
}

function privacyCard(p) {
  return `<section class="card pf-privacy">
    <div>
      <h2>${p.isPrivate ? '🔒 Profil privé' : '🌍 Profil public'}</h2>
      <p class="muted">${p.isPrivate
        ? 'Seuls tes amis voient tes statistiques et tes parties. Les autres joueurs voient juste ton pseudo et ta photo.'
        : 'Tout le monde voit tes statistiques et tes parties. Passe en privé pour les réserver à tes amis.'}</p>
    </div>
    <label class="switch" title="Profil privé">
      <input type="checkbox" id="private-toggle" ${p.isPrivate ? 'checked' : ''}>
      <span class="switch-track"><span class="switch-thumb"></span></span>
      <span class="switch-label">Privé</span>
    </label>
  </section>`;
}

function tile(value, label, cls = '') {
  return `<div class="pf-tile ${cls}"><b>${value}</b><span>${label}</span></div>`;
}

function bar(r) {
  if (!r.n) return '';
  const seg = (k, cls) => (r[k] ? `<span class="${cls}" style="flex:${r[k]}" title="${r[k]}"></span>` : '');
  return `<div class="wdl-bar">${seg('w', 'w')}${seg('d', 'd')}${seg('l', 'l')}</div>
    <div class="wdl-legend"><span class="w">${plural(r.w, 'victoire')}</span><span class="d">${plural(r.d, 'nulle')}</span><span class="l">${plural(r.l, 'défaite')}</span></div>`;
}

function rateRing(rate) {
  const deg = Math.round((rate / 100) * 360);
  return `<div class="rate-ring" style="--deg:${deg}deg"><div><b>${rate}%</b><span>de victoires</span></div></div>`;
}

function howList(c, total) {
  const rows = Object.entries(c).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<p class="muted">—</p>';
  return `<ul class="pf-how">${rows
    .map(([k, n]) => `<li><span>${REASON_SHORT[k] || k}</span><span class="pf-how-bar"><i style="width:${pct(n, total)}%"></i></span><b>${n}</b></li>`)
    .join('')}</ul>`;
}

function statsHtml(p, s) {
  const streakTxt = !s.streak ? '—' : s.streakKind === 'w' ? `🔥 ${plural(s.streak, 'victoire')}` : s.streakKind === 'l' ? `${plural(s.streak, 'défaite')}` : `${plural(s.streak, 'nulle')}`;
  const lvl = s.bestLevel ? LEVELS[s.bestLevel - 1] : null;
  const rival = s.rival;
  return `
    <section class="pf-overview">
      <div class="card pf-ring-card">${rateRing(s.all.rate)}<p class="muted">Score : ${s.all.score}% (une nulle compte ½)</p></div>
      <div class="pf-tiles">
        ${tile(s.all.n, s.all.n > 1 ? 'parties' : 'partie')}
        ${tile(s.all.w, s.all.w > 1 ? 'victoires' : 'victoire', 'w')}
        ${tile(s.all.l, s.all.l > 1 ? 'défaites' : 'défaite', 'l')}
        ${tile(s.all.d, s.all.d > 1 ? 'nulles' : 'nulle', 'd')}
        <div class="pf-tiles-bar">${bar(s.all)}</div>
      </div>
    </section>

    <section class="pf-grid">
      <div class="card pf-card">
        <h2>Forme</h2>
        <div class="form-dots">${s.form.map((o) => `<span class="dot-${o}" title="${o === 'w' ? 'Victoire' : o === 'l' ? 'Défaite' : 'Nulle'}">${o === 'w' ? 'V' : o === 'l' ? 'D' : 'N'}</span>`).join('')}</div>
        <dl class="pf-facts">
          <div><dt>Série en cours</dt><dd>${streakTxt}</dd></div>
          <div><dt>Meilleure série</dt><dd>${s.best ? plural(s.best, 'victoire') + ' d’affilée' : '—'}</dd></div>
        </dl>
      </div>

      <div class="card pf-card">
        <h2>Par couleur</h2>
        <div class="pf-colors">
          <div class="pf-color"><span class="avatar-color white"></span><b>${s.white.rate}%</b><small>avec les Blancs · ${plural(s.white.n, 'partie')}</small></div>
          <div class="pf-color"><span class="avatar-color black"></span><b>${s.black.rate}%</b><small>avec les Noirs · ${plural(s.black.n, 'partie')}</small></div>
        </div>
      </div>

      <div class="card pf-card">
        <h2>Entre amis</h2>
        ${s.friends.n ? `${bar(s.friends)}
        <dl class="pf-facts">
          <div><dt>Taux de victoire</dt><dd>${s.friends.rate}%</dd></div>
          <div><dt>Rival</dt><dd>${rival ? `${rival.id ? `<a href="${profileUrl(rival.id)}">${escapeHtml(rival.name)}</a>` : escapeHtml(rival.name)} <small class="muted">(${rival.rec.w}-${rival.rec.d}-${rival.rec.l})</small>` : '—'}</dd></div>
        </dl>` : '<p class="muted">Aucune partie contre un ami pour l’instant.</p>'}
      </div>

      <div class="card pf-card">
        <h2>Contre Noa</h2>
        ${s.noa.n ? `<div class="pf-noa">
          <img src="img/noa/${lvl ? LEVEL_FACE[lvl.n - 1] : 'frime'}.svg" alt="" width="64" height="64">
          <div><b>${lvl ? `Niveau ${lvl.n} battu` : 'Pas encore battu'}</b><small class="muted">${lvl ? `${lvl.name} · ${lvl.elo}` : 'Noa reste invaincu… pour l’instant'}</small></div>
        </div>
        ${bar(s.noa)}` : '<p class="muted">Aucune partie contre Noa pour l’instant.</p>'}
      </div>

      <div class="card pf-card">
        <h2>Victoires</h2>
        ${howList(s.winsHow, s.all.w)}
      </div>

      <div class="card pf-card">
        <h2>Défaites</h2>
        ${howList(s.lossesHow, s.all.l)}
      </div>

      <div class="card pf-card pf-wide">
        <h2>En bref</h2>
        <dl class="pf-facts pf-facts-3">
          <div><dt>Coups par partie</dt><dd>${s.avgMoves || '—'}</dd></div>
          <div><dt>Victoire la plus rapide</dt><dd>${s.fastest ? `${Math.ceil(plies(s.fastest) / 2)} coups` : '—'}</dd></div>
          <div><dt>Cadence préférée</dt><dd>${s.favCadence || '—'}</dd></div>
        </dl>
      </div>
    </section>

    <section class="card pf-recent">
      <h2>Dernières parties</h2>
      <ul class="pf-games">${s.recent.map((g) => gameLine(p, g)).join('')}</ul>
    </section>`;
}

function gameLine(p, g) {
  const o = outcome(g);
  const oppName = g.me === 'w' ? g.black : g.white;
  const opp = g.mode === 'ia'
    ? `Noa <small class="muted">niv. ${g.level || '?'}</small>`
    : g.opp ? `<a href="${profileUrl(g.opp)}">${escapeHtml(oppName)}</a>` : escapeHtml(oppName);
  const review = p.relation === 'me' ? `bilan.html?partie=${encodeURIComponent(g.id)}` : `bilan.html?partie=${encodeURIComponent(g.id)}&joueur=${encodeURIComponent(p.id)}`;
  return `<li class="pf-game">
    <span class="pf-res ${o}">${o === 'w' ? 'Victoire' : o === 'l' ? 'Défaite' : 'Nulle'}</span>
    <span class="pf-game-main"><span>contre ${opp}</span><small class="muted">${REASON_SHORT[g.reason] || ''} · ${Math.ceil(plies(g) / 2)} coups · ${g.me === 'w' ? 'Blancs' : 'Noirs'}</small></span>
    <span class="pf-game-date muted">${date(g.date, { day: 'numeric', month: 'short' })}</span>
    <a class="btn btn-ghost small" href="${review}">📊 Bilan</a>
  </li>`;
}

function wire(p) {
  page.querySelector('#private-toggle')?.addEventListener('change', async (e) => {
    const on = e.target.checked;
    e.target.disabled = true;
    try {
      await setProfilePrivate(on);
      toast(on ? '🔒 Ton profil est maintenant privé : seuls tes amis voient tes statistiques.' : '🌍 Ton profil est maintenant public.', { cls: 'info' });
      load(p.id);
    } catch (ex) {
      e.target.checked = !on;
      e.target.disabled = false;
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
  });
  page.querySelector('.pf-actions').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    try {
      if (b.dataset.act === 'add') toast(escapeHtml(await addFriend(p.username)), { cls: 'info' });
      if (b.dataset.act === 'accept') await acceptFriend(p.id, p.username);
      if (b.dataset.act === 'challenge') return challenge({ id: p.id, username: p.username });
      load(p.id);
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
  });
}
