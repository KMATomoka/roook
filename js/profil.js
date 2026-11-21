// Page « Profil » : statistiques d'un joueur en ligne (victoires, défaites, taux, séries, couleurs, rival…),
// ses dernières parties, et pour son propre profil : le choix public / privé.
import { $, escapeHtml } from './common.js?v=f4cd128-mwquidh7';
import { ICONS, ico } from './icons.js?v=f4cd128-mwquidh7'; // icônes dessinées (à la place des emojis)
import {
  session, toast, picHtml, loadProfile, setProfilePrivate, profileUrl, addFriend, acceptFriend, challenge, cadenceLabel, logout,
  setAvatar, removeAvatar, myEmail, changeEmail, setBio, BIO_MAX,
  BADGES, ROYAL_WINS, badgeHtml, badgeIcon, ownedBadges, winKeys, chooseBadge,
} from './compte.js?v=f4cd128-mwquidh7';
import { getRatings, getLog, rankOf, logoUrl, noRankHtml, fmt, placeOf, CATS, PLACEMENT, RANKS } from './rangs.js?v=f4cd128-mwquidh7';

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
const plies = (g) => (typeof g.ply === 'number' ? g.ply : g.moves ? g.moves.split(' ').filter(Boolean).length : 0);

function record(list) {
  const r = { n: list.length, w: 0, l: 0, d: 0 };
  for (const g of list) r[outcome(g)]++;
  r.rate = pct(r.w, r.n);
  r.score = r.n ? Math.round(((r.w + r.d / 2) / r.n) * 100) : 0;
  return r;
}

function stats(games) {
  const sorted = [...games].sort((a, b) => (a.date || 0) - (b.date || 0)); // du plus ancien au plus récent
  // Seulement les parties en ligne contre des amis (vérifiées par l'arbitre de la base) ; les parties contre Noa ne comptent pas.
  const list = sorted.filter((g) => g.mode !== 'ia');
  const all = record(list);
  const friends = list;

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


  // Longueur des parties, cadence préférée, victoire la plus rapide
  const lengths = list.map(plies);
  const avgMoves = list.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / list.length / 2) : 0;
  const wins = list.filter((g) => outcome(g) === 'w' && plies(g) > 0);
  const fastest = wins.length ? wins.reduce((a, b) => (plies(b) < plies(a) ? b : a)) : null;
  const cad = new Map();
  for (const g of list) if (g.base) cad.set(`${g.base}|${g.inc || 0}`, (cad.get(`${g.base}|${g.inc || 0}`) || 0) + 1);
  const favCad = [...cad.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    all, friends: record(friends), white, black,
    best, cur, streak, streakKind,
    winsHow: how('w'), lossesHow: how('l'),
    rival: rival && { ...rival, rec: record(rival.games) },
    avgMoves, fastest,
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
const REASON_SHORT = { mat: 'Échec et mat', abandon: 'Abandon', temps: 'Au temps', accord: 'Accord', pat: 'Pat', repetition: 'Répétition', materiel: 'Matériel', '50coups': '50 coups', 'temps-materiel': 'Temps (matériel)', deconnexion: 'Abandon (parti)', absent: 'Annulée', autre: 'Autre' };

function render(p) {
  const me = p.relation === 'me';
  const presence = p.playing ? 'playing' : p.online ? 'online' : 'offline';
  const presenceTxt = p.playing ? '<span class="status-playing">● en partie</span>' : p.online ? '<span class="status-online">● en ligne</span>' : `<span class="muted">${ago(p.lastSeen)}</span>`;
  const s = p.games ? stats(p.games) : null;

  page.innerHTML = `
    <section class="card pf-hero">
      ${me
        ? `<label class="pf-pic pf-pic-edit" title="Changer ma photo">${picHtml(p.username, p.avatar, 'profile-avatar', `<i class="presence ${presence}"></i>`)}<span class="profile-pic-edit" aria-hidden="true">${ICONS.camera}</span><input type="file" id="pic-input" accept="image/*" hidden></label>`
        : `<div class="pf-pic">${picHtml(p.username, p.avatar, 'profile-avatar', `<i class="presence ${presence}"></i>`)}</div>`}
      <div class="pf-id">
        <h1>${escapeHtml(p.username)}
          ${badgesRow(p, me)}
          ${p.isPrivate ? `<span class="badge">${ico('lock')} privé</span>` : ''}
          ${p.relation === 'friend' ? '<span class="badge me">ami</span>' : ''}
        </h1>
        <p class="pf-meta">${presenceTxt}<span>Membre depuis ${date(p.createdAt, { month: 'long', year: 'numeric' })}</span>${p.friends ? `<span>${plural(p.friends.length, 'ami')}</span>` : ''}</p>
        ${bioHtml(p, me)}
        ${s ? `<p class="pf-headline">${s.all.n ? `<b>${s.all.rate}%</b> de victoires sur ${plural(s.all.n, 'partie')} en ligne` : 'Pas encore de partie en ligne'}</p>` : ''}
      </div>
      <div class="pf-actions">${actions(p)}</div>
    </section>

    <section class="pf-ranked" id="pf-ranked" hidden></section>

    ${me ? badgeCard(p) + privacyCard(p) + accountCard() : ''}

    ${!p.visible ? `
      <section class="card pf-locked">
        <div class="pf-lock">${ico('lock')}</div>
        <h2>Ce profil est privé</h2>
        <p class="muted">Seuls les amis de ${escapeHtml(p.username)} voient ses statistiques et ses parties.${p.relation === 'none' ? ' Ajoute-le en ami pour les voir.' : ''}</p>
      </section>` : s.all.n === 0 ? `
      <section class="card pf-empty">
        <img src="img/noa/hmm.svg?h=a5d6e4dc0b" alt="" width="80" height="80">
        <h2>Aucune partie pour l’instant</h2>
        <p class="muted">${me ? 'Tes statistiques apparaîtront ici dès ta première partie en ligne contre un ami.' : `${escapeHtml(p.username)} n’a pas encore joué de partie en ligne.`}</p>
        ${me ? '<a class="btn btn-primary" href="amis.html">Défier un ami</a>' : ''}
      </section>` : statsHtml(p, s)}
  `;

  wire(p);
  rankedSection(p);
}

/** Mode classé : rang et Elo dans chaque cadence (Blitz, Rapide, Classique, Long), même avant la première partie. */
async function rankedSection(p) {
  const box = $('#pf-ranked');
  const r = await getRatings(p.id).catch(() => null);
  if (!r || !box) return;
  const logs = {};
  await Promise.all(Object.keys(CATS).map(async (c) => (logs[c] = r[c].n ? await getLog(p.id, c, 30).catch(() => []) : [])));
  // Rang le plus haut (hors placement) : à côté du pseudo
  const ranked = Object.keys(CATS).filter((c) => r[c].n && !rankOf(r[c]).placement);
  const top = ranked.sort((a, b) => r[b].r - r[a].r)[0];
  const totalGames = Object.values(r).reduce((a, e) => a + (e.n || 0), 0);
  const h1 = page.querySelector('.pf-id h1');
  if (top && h1 && !h1.querySelector('.pf-hero-rank')) {
    const rk = rankOf(r[top]);
    h1.firstChild.after(Object.assign(document.createElement('img'), { className: 'pf-hero-rank', src: logoUrl(rk.rank.k), alt: rk.name, title: `${rk.name} en ${CATS[top]}`, width: 40, height: 40 }));
  }
  const meta = page.querySelector('.pf-meta');
  if (meta && totalGames && !meta.querySelector('.pf-meta-ranked')) meta.insertAdjacentHTML('beforeend', `<span class="pf-meta-ranked">${totalGames} partie${totalGames > 1 ? 's' : ''} classée${totalGames > 1 ? 's' : ''}</span>`);
  // Meilleur rang (sous le pseudo) et place au classement dans cette cadence
  if (top && meta && !page.querySelector('.pf-best-rank')) {
    const rk = rankOf(r[top]);
    meta.insertAdjacentHTML('afterend', `<p class="pf-best-rank">Meilleur rang : <b style="color: ${rk.rank.col}">${rk.name}</b> en ${CATS[top]}</p>`);
    placeOf(top, r[top].r)
      .then((n) => {
        if (n && !meta.querySelector('.pf-meta-place')) meta.insertAdjacentHTML('beforeend', `<span class="pf-meta-place">${n}${n === 1 ? 'er' : 'e'} en ${CATS[top]}</span>`);
      })
      .catch(() => {});
  }
  // Courbe : la catégorie la plus jouée
  const chartCat = totalGames ? Object.keys(CATS).sort((a, b) => (r[b].n || 0) - (r[a].n || 0))[0] : 'rapide';
  const recent = Object.values(logs).flat().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 6);
  const LABELS = { blitz: 'Blitz · 5 min', rapide: 'Rapide · 10 min', classique: 'Classique · 30 min', long: 'Long · 60 min' };
  box.hidden = false;
  box.innerHTML = `<div class="pf-ranked-head"><h2>Classé</h2><a href="classe.html">Voir les rangs</a></div>
    <div class="pf-ranked-tiles">${Object.keys(CATS).map((cat) => {
      const e = r[cat];
      const rk = rankOf(e);
      if (!e.n) return `<div class="card pf-rk">${noRankHtml(60)}<div><p class="pf-rk-cat">${LABELS[cat]}</p><p class="muted">Pas encore joué</p></div></div>`;
      return `<div class="card pf-rk${cat === top ? ' best' : ''}" style="--rk: ${rk.placement ? 'var(--muted)' : rk.rank.col}">
        ${rk.placement ? noRankHtml(60) : `<img src="${logoUrl(rk.rank.k)}" alt="${rk.name}" width="60" height="60">`}
        <div style="flex: 1; min-width: 0"><p class="pf-rk-cat">${LABELS[cat]}</p><p class="pf-rk-elo">${fmt(e.r)}</p>
        <p class="pf-rk-name">${rk.placement ? `Placement ${rk.games} / ${PLACEMENT}` : rk.name}</p>
        ${rk.placement ? '' : `<div class="rk-bar" style="--rk: ${rk.rank.col}"><i style="width: ${Math.max(3, Math.round(rk.progress * 100))}%; background: ${rk.rank.col}"></i></div>`}
        <p class="muted pf-rk-best">Meilleur : ${fmt(e.best || e.r)} · ${e.n} partie${e.n > 1 ? 's' : ''}</p></div>
      </div>`;
    }).join('')}</div>
    <div class="pf-ranked-grid">
      <section class="card pf-rk-chart">${chartHtml(logs[chartCat], CATS[chartCat])}</section>
      <section class="card pf-rk-games"><h3>Dernières parties classées</h3>
        ${recent.length ? `<ul>${recent.map((g) => {
          const ork = rankOf({ r: g.oe, n: g.opl ? 0 : PLACEMENT });
          return `<li><span class="rk-res ${g.res}">${g.res.toUpperCase()}</span>
            ${g.opl ? noRankHtml(26) : `<img src="${logoUrl(ork.rank.k)}" alt="${ork.name}" title="${ork.name}" width="26" height="26">`}
            <a href="${profileUrl(g.opp)}">${escapeHtml(g.on || '?')}</a> <span class="muted rk-num">${fmt(g.oe)}</span>
            <span class="cat">${CATS[g.cat]}</span><span class="dl ${g.d >= 0 ? 'up' : 'down'}">${g.d >= 0 ? '+' : '−'}${Math.abs(g.d)}</span></li>`;
        }).join('')}</ul>` : '<p class="muted">Les parties classées apparaîtront ici.</p>'}
      </section>
    </div>`;
}

/** Courbe d'Elo sur les 30 derniers jours (SVG), avec les rangs en fond et le bilan V / N / D. */
function chartHtml(log = [], catName) {
  const since = Date.now() - 30 * 86400000;
  const pts = log.filter((g) => (g.at || 0) >= since);
  const w = { v: 0, n: 0, d: 0 };
  pts.forEach((g) => w[g.res]++);
  const gain = pts.length ? pts[pts.length - 1].r - (pts[0].r - pts[0].d) : 0;
  const head = `<h3>Elo ${catName} · 30 derniers jours ${pts.length ? `<span class="${gain >= 0 ? 'rk-up' : 'rk-down'} rk-num" style="color: var(${gain >= 0 ? '--mint' : '--danger'})">${gain >= 0 ? '+' : '−'}${Math.abs(gain)}</span>` : ''}</h3>`;
  if (pts.length < 2) return `${head}<p class="muted">Joue encore quelques parties classées pour voir ta courbe.</p>`;
  const values = [pts[0].r - pts[0].d, ...pts.map((g) => g.r)];
  const lo = Math.floor((Math.min(...values) - 30) / 50) * 50;
  const hi = Math.ceil((Math.max(...values) + 30) / 50) * 50;
  const W = 600, H = 220;
  const X = (i) => 44 + (i / (values.length - 1)) * (W - 56);
  const Y = (v) => H - 20 - ((v - lo) / (hi - lo)) * (H - 36);
  const step = hi - lo > 300 ? 100 : 50;
  const grid = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v);
  const bands = RANKS.map((rk, i) => ({ rk, a: rk.min, b: RANKS[i + 1]?.min ?? 9999 })).filter((x) => x.b > lo && x.a < hi);
  const last = values[values.length - 1];
  const lastRk = rankOf({ r: last, n: PLACEMENT });
  return `${head}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elo ${catName} : de ${fmt(values[0])} à ${fmt(last)}">
      ${bands.map((x) => `<rect x="44" width="${W - 56}" y="${Y(Math.min(x.b, hi)).toFixed(1)}" height="${(Y(Math.max(x.a, lo)) - Y(Math.min(x.b, hi))).toFixed(1)}" fill="${x.rk.col}" opacity=".07"></rect>`).join('')}
      ${grid.map((v) => `<line x1="44" x2="${W - 12}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${RANKS.some((r) => r.min === v) ? RANKS.find((r) => r.min === v).col : '#2f2950'}" stroke-dasharray="${RANKS.some((r) => r.min === v) ? '4 4' : '0'}" opacity="${RANKS.some((r) => r.min === v) ? 0.7 : 1}"></line><text x="0" y="${(Y(v) + 4).toFixed(1)}" fill="#9a94b2" font-size="12">${fmt(v)}</text>`).join('')}
      <polyline points="${values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="#3cf2a3" stroke-width="2.5" stroke-linejoin="round"></polyline>
      <circle cx="${X(values.length - 1).toFixed(1)}" cy="${Y(last).toFixed(1)}" r="5" fill="${lastRk.rank.col}" stroke="#0c0a16" stroke-width="2"></circle>
    </svg>
    <div class="pf-rk-wdl"><div><b class="rk-num" style="color: var(--mint)">${w.v}</b><span>Victoires</span></div><div><b class="rk-num" style="color: #f2cf4d">${w.n}</b><span>Nulles</span></div><div><b class="rk-num" style="color: var(--danger)">${w.d}</b><span>Défaites</span></div></div>`;
}

/** Bio : affichée à tous ; sur son propre profil, un bouton pour l'écrire ou la modifier. */
function bioHtml(p, me) {
  const text = p.bio ? `<p class="pf-bio">${escapeHtml(p.bio)}</p>` : me ? '<p class="pf-bio empty">Pas encore de bio. Présente-toi en quelques mots !</p>' : '';
  if (!me) return text;
  return `<div class="pf-bio-box" id="bio-box">
    ${text}
    <button class="link-btn" type="button" data-bio="edit">${ico('pencil')} ${p.bio ? 'Modifier ma bio' : 'Écrire ma bio'}</button>
    <form class="pf-bio-form" id="bio-form" hidden>
      <textarea name="bio" maxlength="${BIO_MAX}" rows="3" placeholder="Ex. : Joueur du dimanche, fan des ouvertures risquées. Défie-moi en blitz !">${escapeHtml(p.bio || '')}</textarea>
      <div class="pf-bio-bar">
        <span class="muted" id="bio-count"></span>
        <span>
          <button class="btn btn-ghost small" type="button" data-bio="cancel">Annuler</button>
          <button class="btn btn-primary small">Enregistrer</button>
        </span>
      </div>
    </form>
  </div>`;
}

/** Victoires en ligne de mon historique (pour le badge Royal). */
const myWins = (p) => (p.games ? winKeys(Object.fromEntries(p.games.map((g) => [g.id, g]))).length : 0);
/** Badges possédés : pour soi, Royal compte dès 100 victoires (la preuve est jointe en le choisissant). */
const badgesOf = (p, me) => ownedBadges({ role: p.role, royal: p.hasRoyalProof || (me && myWins(p) >= ROYAL_WINS) });

/** Les badges du joueur, avec leur nom ; celui affiché en partie est marqué. */
function badgesRow(p, me) {
  // Sur le profil : les badges de rôle (Fondateur, Admin) toujours, les autres seulement si le joueur les porte
  const owned = badgesOf(p, me).filter((id) => BADGES[id].role || id === p.badge);
  if (!owned.length) return '';
  return `<span class="pf-badges">${owned
    .map((id) => `<span class="pf-badge ${id === p.badge ? 'worn' : ''}" title="${id === p.badge ? 'Badge affiché en partie' : ''}">${badgeHtml(id)}</span>`)
    .join('')}</span>`;
}

/** Mon profil : choisir LE badge affiché à côté de mon pseudo en partie. */
function badgeCard(p) {
  const owned = badgesOf(p, true);
  const wins = myWins(p);
  // Les badges qu'on possède d'abord, puis « Aucun », puis ceux à débloquer
  const option = ([id, b]) => {
    const has = owned.includes(id);
    if (!has && id !== 'royal') return ''; // les badges de rôle ne s'affichent que si on les a
    const on = p.badge === id;
    const lock = !has ? `<span class="pf-badge-lock">${ico('lock')} ${Math.min(wins, ROYAL_WINS)} / ${ROYAL_WINS} victoires</span>` : '';
    return `<button type="button" class="pf-badge-opt ${b.cls} ${on ? 'on' : ''} ${has ? '' : 'locked'}" data-badge="${id}" ${has ? '' : 'disabled'} aria-pressed="${on}">
      <span class="pf-badge-emoji">${badgeIcon(b)}</span><span class="pf-badge-name">${b.name}</span>${lock || `<span class="pf-badge-state">${on ? '✓ Affiché' : 'Afficher'}</span>`}
    </button>`;
  };
  const all = Object.entries(BADGES);
  const mine = all.filter(([id]) => owned.includes(id)).map(option).join('');
  const locked = all.filter(([id]) => !owned.includes(id)).map(option).join('');
  return `<section class="card pf-badge-card">
    <div>
      <h2>${ico('medal')} Badge affiché en partie</h2>
      <p class="muted">Tu peux en porter un seul : son emoji s’affiche à côté de ton pseudo pendant tes parties.</p>
    </div>
    <div class="pf-badge-opts">
      ${mine}
      <button type="button" class="pf-badge-opt none ${p.badge ? '' : 'on'}" data-badge="" aria-pressed="${!p.badge}"><span class="pf-badge-emoji">∅</span><span class="pf-badge-name">Aucun</span><span class="pf-badge-state">${p.badge ? 'Choisir' : '✓ Choisi'}</span></button>
      ${locked}
    </div>
  </section>`;
}

function actions(p) {
  if (p.relation === 'me') {
    return `<a class="btn btn-ghost small btn-ico" href="amis.html">${ICONS.friends}Mes amis</a>
      <a class="btn btn-ghost small btn-ico" href="inventaire.html">${ICONS.bag}Inventaire</a>
      <button class="btn btn-ghost small btn-ico" data-act="photo">${ICONS.camera}Changer ma photo</button>
      ${p.avatar ? `<button class="btn btn-ghost small btn-ico" data-act="nophoto">${ICONS.noPhoto}Retirer la photo</button>` : ''}
      ${p.admin ? `<a class="btn btn-ghost small btn-ico" href="admin.html">${ICONS.shield}Administration</a>` : ''}
      <button class="btn btn-ghost small btn-ico" data-act="logout">${ICONS.logout}Se déconnecter</button>`;
  }
  if (p.relation === 'none') return '<button class="btn btn-primary" data-act="add">+ Ajouter en ami</button>';
  if (p.relation === 'sent') return '<span class="search-tag">Demande d’ami envoyée</span>';
  if (p.relation === 'received') return '<button class="btn btn-primary" data-act="accept">Accepter sa demande</button>';
  return `<button class="btn btn-primary" data-act="challenge" ${p.online && !p.playing ? '' : 'disabled'} title="${p.online ? '' : 'Il doit être en ligne'}">${ico('swords')} Défier</button>`;
}

/** Mon compte : adresse e-mail (privée), pour se connecter et récupérer son mot de passe. */
function accountCard() {
  const email = myEmail();
  return `<section class="card pf-account">
    <div>
      <h2>${ico('mail')} Adresse e-mail</h2>
      <p class="muted">${email ? `${escapeHtml(email)} · visible par toi seul. Elle sert à te connecter et à récupérer ton mot de passe.` : '<span class="warn">Pas d’adresse e-mail : ajoute-en une pour pouvoir récupérer ton mot de passe.</span>'}</p>
      <form class="email-form" id="email-form" hidden novalidate>
        <input name="email" type="email" maxlength="200" placeholder="nouvelle.adresse@exemple.fr" autocomplete="email" required>
        <button class="btn btn-primary small">Envoyer le lien</button>
        <button class="btn btn-ghost small" type="button" data-act="email-cancel">Annuler</button>
      </form>
    </div>
    <button class="btn btn-ghost small" type="button" data-act="email">${email ? 'Changer' : 'Ajouter mon e-mail'}</button>
  </section>`;
}

function privacyCard(p) {
  return `<section class="card pf-privacy">
    <div>
      <h2>${p.isPrivate ? `${ico('lock')} Profil privé` : `${ico('globe')} Profil public`}</h2>
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
  const streakTxt = !s.streak ? '—' : s.streakKind === 'w' ? `${ico('fire')} ${plural(s.streak, 'victoire')}` : s.streakKind === 'l' ? `${plural(s.streak, 'défaite')}` : `${plural(s.streak, 'nulle')}`;
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
        <h2>Rival</h2>
        ${rival ? `<p class="pf-rival">${rival.id ? `<a href="${profileUrl(rival.id)}">${escapeHtml(rival.name)}</a>` : escapeHtml(rival.name)}</p>
        <p class="muted">L’adversaire le plus affronté : ${plural(rival.rec.n, 'partie')}</p>
        ${bar(rival.rec)}` : '<p class="muted">—</p>'}
      </div>

      <div class="card pf-card">
        <h2>Victoires</h2>
        ${howList(s.winsHow, s.all.w)}
      </div>

      <div class="card pf-card">
        <h2>Défaites</h2>
        ${howList(s.lossesHow, s.all.l)}
      </div>

      <div class="card pf-card">
        <h2>En bref</h2>
        <dl class="pf-facts pf-facts-1">
          <div><dt>Coups par partie</dt><dd>${s.avgMoves || '—'}</dd></div>
          <div><dt>Victoire la plus rapide</dt><dd>${s.fastest ? `${Math.ceil(plies(s.fastest) / 2)} coups` : '—'}</dd></div>
          <div><dt>Cadence préférée</dt><dd>${s.favCadence || '—'}</dd></div>
        </dl>
      </div>
    </section>

    ${recentHtml(p, s)}`;
}

function recentHtml(p, s) {
  return `<section class="card pf-recent">
      <h2>Dernières parties</h2>
      <ul class="pf-games">${s.recent.map((g) => gameLine(p, g)).join('')}</ul>
    </section>`;
}

function gameLine(p, g) {
  const o = outcome(g);
  const oppName = g.me === 'w' ? g.black : g.white;
  const opp = g.opp ? `<a href="${profileUrl(g.opp)}">${escapeHtml(oppName)}</a>` : escapeHtml(oppName);
  const review = p.relation === 'me' ? `bilan.html?partie=${encodeURIComponent(g.id)}` : `bilan.html?partie=${encodeURIComponent(g.id)}&joueur=${encodeURIComponent(p.id)}`;
  return `<li class="pf-game">
    <span class="pf-res ${o}">${o === 'w' ? 'Victoire' : o === 'l' ? 'Défaite' : 'Nulle'}</span>
    <span class="pf-game-main"><span>contre ${opp}</span><small class="muted">${REASON_SHORT[g.reason] || ''} · ${Math.ceil(plies(g) / 2)} coups · ${g.me === 'w' ? 'Blancs' : 'Noirs'}</small></span>
    <span class="pf-game-date muted">${date(g.date, { day: 'numeric', month: 'short' })}</span>
    <a class="btn btn-ghost small" href="${review}">${ico('chart')} Bilan</a>
  </li>`;
}

function wire(p) {
  // Choix du badge affiché en partie
  page.querySelector('.pf-badge-card')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-badge]');
    if (!b || b.disabled) return;
    const id = b.dataset.badge || null;
    try {
      await chooseBadge(id);
      toast(id ? `Badge ${badgeIcon(BADGES[id])} <b>${BADGES[id].name}</b> affiché en partie.` : 'Plus aucun badge affiché en partie.', { cls: 'info' });
      load(p.id);
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
  });
  // Bio (son propre profil)
  const bioForm = page.querySelector('#bio-form');
  if (bioForm) {
    const area = bioForm.bio;
    const count = () => (page.querySelector('#bio-count').textContent = `${area.value.length} / ${BIO_MAX}`);
    page.querySelector('#bio-box').addEventListener('click', (e) => {
      const a = e.target.closest('[data-bio]')?.dataset.bio;
      if (a === 'edit') {
        bioForm.hidden = false;
        e.target.closest('[data-bio]').hidden = true;
        count();
        area.focus();
        area.setSelectionRange(area.value.length, area.value.length);
      }
      if (a === 'cancel') load(p.id);
    });
    area.addEventListener('input', count);
    bioForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await setBio(area.value);
        toast(`Bio enregistrée ${ico('dust')}`, { cls: 'info' });
        load(p.id);
      } catch (ex) {
        toast(escapeHtml(ex.message), { cls: 'error' });
      }
    });
  }
  // Photo de profil : clic sur la photo ou sur « Changer ma photo »
  page.querySelector('#pic-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      await setAvatar(file);
      toast(`Photo de profil mise à jour ${ico('dust')}`, { cls: 'info' });
      load(p.id);
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
  });
  // Adresse e-mail
  const emailForm = page.querySelector('#email-form');
  page.querySelector('.pf-account')?.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'email') {
      emailForm.hidden = false;
      emailForm.email.focus();
    }
    if (a === 'email-cancel') emailForm.hidden = true;
  });
  emailForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailForm.email.value.trim();
    try {
      await changeEmail(email);
      emailForm.hidden = true;
      emailForm.reset();
      toast(`${ico('mail')} Un lien de confirmation a été envoyé à <b>${escapeHtml(email)}</b>. Clique dessus, puis reconnecte-toi avec cette adresse.`, { cls: 'info', duration: 12000 });
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
  });
  page.querySelector('#private-toggle')?.addEventListener('change', async (e) => {
    const on = e.target.checked;
    e.target.disabled = true;
    try {
      await setProfilePrivate(on);
      toast(on ? `${ico('lock')} Ton profil est maintenant privé : seuls tes amis voient tes statistiques.` : `${ico('globe')} Ton profil est maintenant public.`, { cls: 'info' });
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
      if (b.dataset.act === 'logout') return logout();
      if (b.dataset.act === 'photo') return page.querySelector('#pic-input').click();
      if (b.dataset.act === 'nophoto') {
        await removeAvatar();
        toast('Photo retirée.', { cls: 'info' });
      }
      load(p.id);
    } catch (ex) {
      toast(escapeHtml(ex.message), { cls: 'error' });
    }
  });
}
