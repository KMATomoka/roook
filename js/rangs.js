// Mode classé : Elo par cadence (Blitz 5 min, Rapide 10 min, Classique 30 min, Long 60 min), rangs, et mise à jour de l'Elo en fin de partie.
// Pas de serveur : les règles de la base (scripts/rules.js, « ratings ») vérifient que chaque nouvel Elo
// est exactement celui que donne la formule ci-dessous, pour une vraie partie classée terminée.
import { db, ref, get, update, query, orderByChild, orderByKey, limitToLast, startAt, serverTimestamp } from './fb.js?v=f4cd128-mwquidh7';

export const START = 800; // Elo de départ
export const PLACEMENT = 5; // parties de placement (coefficient fort, rang affiché après)
export const MAX_GAP = 200; // écart d'Elo maximal entre deux adversaires
export const SHIELD = 3; // parties sans redescendre de rang après une montée

export const CATS = { blitz: 'Blitz', rapide: 'Rapide', classique: 'Classique', long: 'Long' };
/** Cadences de la file classée (« min+s ») et leur catégorie d'Elo. Le 30 min reste en partie normale. */
export const RANKED_CADENCES = [
  ['5+0', 'blitz', 'Blitz · 5 min'],
  ['10+0', 'rapide', 'Rapide · 10 min'],
  ['30+0', 'classique', 'Classique · 30 min'],
  ['60+0', 'long', 'Long · 60 min'],
];
// Cadences de « Adversaire au hasard » en partie normale : les mêmes qu'en classée
export const RANDOM_CADENCES = RANKED_CADENCES.map(([k, , label]) => [k, label]);
export const catOfCadence = (c) => (RANKED_CADENCES.find(([k]) => k === c) || [])[1] || null;
/** Clé de la file classée dans la base : « r-<base ms>-<inc ms> ». */
export const rankedKey = (base, inc) => `r-${base}-${inc}`;

/** Les huit rangs, du plus bas au plus haut (divisions III, II, I de 100 points, sauf le dernier). */
export const RANKS = [
  { k: 'cendre', name: 'Pion de Cuivre', min: 0, col: '#d9925a' },
  { k: 'fer', name: 'Écuyer de Fer', min: 600, col: '#c3cedc' },
  { k: 'marees', name: 'Cavalier des Marées', min: 900, col: '#52d4ff' },
  { k: 'emeraude', name: 'Fou d’Émeraude', min: 1200, col: '#3cf2a3' },
  { k: 'amethyste', name: 'Tour d’Améthyste', min: 1500, col: '#c4a0ff' },
  { k: 'or', name: 'Dame d’Or', min: 1800, col: '#ffd36b' },
  { k: 'dragon', name: 'Roi-Dragon', min: 2100, col: '#ff8a4d' },
  { k: 'astral', name: 'Souverain Astral', min: 2400, col: '#8fe8ff' },
];
export const logoUrl = (k) => `img/rangs/${k}.svg`;
/** Pas encore de rang (placement, ou jamais joué) : un badge neutre, jamais le logo d'un rang. */
export const noRankHtml = (size, label = 'Pas encore de rang') => `<span class="rk-none" style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.42)}px" role="img" aria-label="${label}" title="${label}">?</span>`;
export const fmt = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Divisions d'un rang : [nom, min, max]. Pion de Cuivre : III jusqu'à 399. */
export function divisions(i) {
  const r = RANKS[i];
  if (r.k === 'astral') return [];
  const top = RANKS[i + 1].min - 1;
  if (r.k === 'cendre') return [['III', 0, 399], ['II', 400, 499], ['I', 500, 599]];
  return [['III', r.min, r.min + 99], ['II', r.min + 100, r.min + 199], ['I', r.min + 200, top]];
}
export const rangeLabel = (i) => (RANKS[i + 1] ? `${fmt(RANKS[i].min)} – ${fmt(RANKS[i + 1].min - 1)}` : `${fmt(RANKS[i].min)} et plus`);

const rankIndex = (r) => {
  let i = 0;
  while (i + 1 < RANKS.length && r >= RANKS[i + 1].min) i++;
  return i;
};

/**
 * Rang affiché pour une fiche d'Elo { r, n, floor, shield } :
 * { i, rank, div, name, placement, next (Elo du palier suivant ou null), progress (0–1 dans la division) }.
 */
export function rankOf(e) {
  const r = e?.r ?? START;
  const n = e?.n ?? 0;
  let i = rankIndex(r);
  // Bouclier : juste après une montée, on ne redescend pas de rang
  const shielded = (e?.shield || 0) > 0 && typeof e?.floor === 'number' && e.floor > i;
  if (shielded) i = e.floor;
  const rank = RANKS[i];
  const divs = divisions(i);
  const d = shielded ? divs[0] : divs.find(([, lo, hi]) => r >= lo && r <= hi) || null;
  const next = d ? d[2] + 1 : null;
  const lo = d ? d[1] : rank.min;
  const progress = d ? Math.max(0, Math.min(1, (r - lo) / (d[2] + 1 - lo))) : 1;
  return {
    i, rank, div: d ? d[0] : null, name: rank.name + (d ? ` ${d[0]}` : ''),
    placement: n < PLACEMENT, games: n, r, next, lo, progress, shielded,
  };
}

// --- Calcul de l'Elo (le même que dans les règles de la base) ---------------
/** Coefficient : fort pendant le placement (on te connaît mal), puis 16. */
export const kFactor = (n) => (n < PLACEMENT ? 40 : 16);
/** Chances de gagner selon l'écart (approximation linéaire de la courbe Elo, exacte à ±1 % jusqu'à 200 d'écart). */
export const expected = (me, opp) => 0.5 + (me - opp) / 800;
export const delta = (me, opp, score, n) => Math.round(kFactor(n) * (score - expected(me, opp)));

/** Écart d'Elo accepté selon le temps d'attente (ms) : ±50 au départ, ±200 au maximum après une minute. */
export function windowFor(ms) {
  const s = ms / 1000;
  return s < 10 ? 50 : s < 20 ? 75 : s < 30 ? 100 : s < 45 ? 125 : s < 60 ? 150 : MAX_GAP;
}

// --- Lecture ----------------------------------------------------------------
export async function getRating(uid, cat) {
  const v = await get(ref(db, `ratings/${cat}/${uid}`)).then((s) => s.val()).catch(() => null);
  return v && typeof v.r === 'number' ? v : { r: START, n: 0, best: START };
}
export async function getRatings(uid) {
  const out = {};
  await Promise.all(Object.keys(CATS).map(async (c) => (out[c] = await getRating(uid, c))));
  return out;
}

/** Classement d'une catégorie : les meilleurs, placement terminé. */
export async function leaderboard(cat, n = 50) {
  const s = await get(query(ref(db, `ratings/${cat}`), orderByChild('r'), limitToLast(n + 20)));
  const list = [];
  s.forEach((c) => {
    const v = c.val();
    if (v && v.n >= PLACEMENT) list.push({ id: c.key, ...v });
  });
  return list.sort((a, b) => b.r - a.r).slice(0, n);
}
/** Place d'un joueur dans sa catégorie (1 = premier), parmi ceux qui ont fini leur placement. */
export async function placeOf(cat, r) {
  const s = await get(query(ref(db, `ratings/${cat}`), orderByChild('r'), startAt(r + 1))).catch(() => null);
  let above = 0;
  s?.forEach((c) => {
    if ((c.val()?.n || 0) >= PLACEMENT) above++;
  });
  return above + 1;
}

// --- Fin de partie classée ----------------------------------------------------
/** Nouvelle fiche d'un joueur après la partie (même calcul que les règles). */
function nextEntry(old, me, opp, score, gameId, name) {
  const n = old?.n || 0;
  const r = me + delta(me, opp, score, n);
  const before = rankIndex(me);
  const after = rankIndex(r);
  const e = { r, n: n + 1, best: Math.max(old?.best || r, r), last: gameId, name, at: serverTimestamp() };
  // Bouclier : posé à chaque montée de rang (hors placement), il s'use d'une partie à chaque fois
  if (n + 1 > PLACEMENT && after > before) {
    e.floor = after;
    e.shield = SHIELD;
  } else if ((old?.shield || 0) > 0) {
    e.floor = old.floor;
    e.shield = old.shield - 1;
  }
  return e;
}

/**
 * Applique le résultat d'une partie classée terminée aux DEUX joueurs (le premier navigateur qui écrit gagne ;
 * l'autre écriture est refusée par les règles, ce qui est normal). Renvoie la fiche de `meId` avant et après.
 */
export async function applyResult(gameId, game, meId) {
  if (!game?.ranked || !game.cat || !game.elo || game.status !== 'over' || game.result === '*') return null;
  const cat = game.cat;
  const seats = { w: game.white, b: game.black };
  const score = { w: game.result === '1-0' ? 1 : game.result === '0-1' ? 0 : 0.5 };
  score.b = 1 - score.w;
  const olds = {};
  await Promise.all(['w', 'b'].map(async (c) => (olds[c] = await get(ref(db, `ratings/${cat}/${seats[c]}`)).then((s) => s.val()).catch(() => null))));
  const meSeat = seats.w === meId ? 'w' : 'b';
  const beforeMe = olds[meSeat];
  for (const c of ['w', 'b']) {
    const old = olds[c];
    if (old?.last === gameId) continue; // déjà appliqué
    const other = c === 'w' ? 'b' : 'w';
    const e = nextEntry(old, game.elo[c], game.elo[other], score[c], gameId, game.names[c]);
    // Fiche d'Elo + ligne d'historique (derniers résultats, courbe du profil), en une seule écriture
    const log = {
      r: e.r, d: e.r - game.elo[c], res: score[c] === 1 ? 'v' : score[c] === 0 ? 'd' : 'n',
      opp: seats[other], on: game.names[other], oe: game.elo[other], opl: !!game.pl?.[other], at: serverTimestamp(),
    };
    await update(ref(db), { [`ratings/${cat}/${seats[c]}`]: e, [`ratingLog/${cat}/${seats[c]}/${gameId}`]: log }).catch(() => {}); // refusé si l'autre l'a déjà fait
  }
  const after = await get(ref(db, `ratings/${cat}/${meId}`)).then((s) => s.val()).catch(() => null);
  const before = beforeMe?.last === gameId ? null : beforeMe;
  return {
    cat,
    before: before || { r: game.elo[meSeat], n: 0 },
    after: after?.last === gameId ? after : null,
    oppElo: game.elo[meSeat === 'w' ? 'b' : 'w'],
    myElo: game.elo[meSeat],
  };
}

/** Parties classées entre deux mêmes joueurs : au plus PAIR_MAX sur PAIR_SPAN (vérifié par les règles, rankedPairs). */
export const PAIR_MAX = 3;
export const PAIR_SPAN = 86400000;
export const pairKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/**
 * Preuve des 5 parties en ligne terminées pour entrer dans la file classée : 5 clés de l'historique (vérifié par
 * les règles), rangées par date strictement croissante. null s'il n'y en a pas assez.
 */
export function onlineProof(historySnap) {
  const rows = [];
  historySnap?.forEach((s) => {
    const d = s.val()?.date;
    if (typeof d === 'number') rows.push([s.key, d]);
  });
  rows.sort((a, b) => a[1] - b[1]);
  const keys = [];
  let last = -Infinity;
  for (const [k, d] of rows) {
    if (d <= last) continue;
    keys.push(k);
    last = d;
    if (keys.length === MIN_GAMES) break;
  }
  return keys.length === MIN_GAMES ? Object.fromEntries(keys.map((k, i) => [`p${i}`, k])) : null;
}

/** Nombre de parties en ligne terminées (pour ouvrir la file classée : 5 parties normales d'abord). */
export const MIN_GAMES = 5;

/**
 * Historique classé d'un joueur dans une catégorie, du plus ancien au plus récent :
 * [{ id, r, d, res ('v'|'n'|'d'), opp, on (pseudo), oe (Elo adverse), opl (adversaire en placement), at }].
 */
export async function getLog(uid, cat, n = 30) {
  const s = await get(query(ref(db, `ratingLog/${cat}/${uid}`), orderByKey(), limitToLast(n))).catch(() => null);
  const out = [];
  s?.forEach((c) => {
    const v = c.val();
    if (v && typeof v.r === 'number') out.push({ id: c.key, ...v, cat });
  });
  return out.sort((a, b) => (a.at || 0) - (b.at || 0));
}
