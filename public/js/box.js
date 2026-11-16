// Box : on en gagne une à chaque victoire en ligne (contre un ami ou un adversaire au hasard).
// Une box classique donne un élément de pack, tiré au sort par rareté : un plateau, une pièce (pion, tour,
// cavalier, fou, dame ou roi : chacune se trouve à part), une fin de partie, une prise et son.
//  - Commun (Astrea, Classic) : déjà à tout le monde, il se change en poussière d'étoile ✨ ;
//  - Rare (Sakura, Western), Épique (Océan) : l'élément est débloqué (déjà obtenu : il se change en ✨) ;
//  - Jeu complet : très rare, les 6 pièces d'un pack d'un coup.
// Les packs entiers ne sont pas dans les box (boutique à venir). Royal chess (légendaire) non plus : c'est une
// mission spéciale (100 victoires).
// 10 ✨ ouvrent une box de plus. Les admins peuvent s'offrir des box de test.
// Tout est dans la base : loot/{uid} (box ouvertes, éléments, ✨) et lootGrants/{uid} (box offertes).
import { db, ref, update, push, set, onValue, serverTimestamp } from './fb.js';
import { PACKS, PIECE_TYPES, PACK_ITEMS, packHas } from './theme.js';

/** Types de box (d'autres viendront plus tard). */
export const BOX_TYPES = {
  classique: { name: 'Box classique', desc: 'Un élément de pack au hasard : plateau, pièces, fin de partie ou prise et son.' },
};
/** Taux de drop de la box classique, en pourcentage. */
export const RATES = [
  { id: 'jeu', name: 'Jeu complet', pct: 0.3 },
  { id: 'epique', name: 'Épique', pct: 11.7 },
  { id: 'rare', name: 'Rare', pct: 33 },
  { id: 'commun', name: 'Commun', pct: 55 },
];
/** Poussière d'étoile donnée par un doublon, selon sa rareté. */
export const DUST = { commun: 1, rare: 3, epique: 6, jeu: 20 };
export const DUST_PER_BOX = 10;

const isWin = (g) => !!g && !!g.game && ((g.result === '1-0' && g.me === 'w') || (g.result === '0-1' && g.me === 'b'));

/**
 * Suit en direct les box d'un joueur. cb({ ready, keys, opened, owned, dust }) :
 * keys = identifiants des box pas encore ouvertes (victoires puis box offertes).
 */
export function watchBoxes(uid, cb) {
  const st = { history: null, grants: null, loot: null };
  const emit = () => {
    if (st.history === null || st.grants === null || st.loot === null) return;
    const opened = st.loot.opened || {};
    const wins = Object.entries(st.history)
      .filter(([, g]) => isWin(g))
      .sort((a, b) => (a[1].date || 0) - (b[1].date || 0))
      .map(([k]) => k);
    const keys = [...wins, ...Object.keys(st.grants)].filter((k) => !opened[k]);
    cb({ ready: true, keys, opened, owned: st.loot.owned || {}, dust: st.loot.dust || 0 });
  };
  const offs = [
    onValue(ref(db, `history/${uid}`), (s) => ((st.history = s.val() || {}), emit()), () => ((st.history = {}), emit())),
    onValue(ref(db, `lootGrants/${uid}`), (s) => ((st.grants = s.val() || {}), emit()), () => ((st.grants = {}), emit())),
    onValue(ref(db, `loot/${uid}`), (s) => ((st.loot = s.val() || {}), emit()), () => ((st.loot = {}), emit())),
  ];
  return () => offs.forEach((f) => f());
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
/** Tire une rareté selon les taux. */
function rollRarity() {
  let r = Math.random() * 100;
  for (const t of RATES) {
    if (r < t.pct) return t.id;
    r -= t.pct;
  }
  return 'commun';
}

/**
 * Tire le contenu d'une box. owned : éléments déjà trouvés.
 * Renvoie { rarity, pack, slots: [élément…], fresh: [élément…] (nouveaux), dust (gagnée en doublons) }.
 * Un élément : board, endAnim, capture, ou une pièce (P, R, N, B, Q, K).
 */
export function drawBox(owned) {
  const rarity = rollRarity();
  const has = (p, s) => p.rarity === 'commun' || !!owned[p.id]?.[s] || (PIECE_TYPES.includes(s) && !!owned[p.id]?.pieces);
  if (rarity === 'jeu') {
    const missing = PACKS.filter((p) => p.box && PIECE_TYPES.some((t) => !has(p, t)));
    if (!missing.length) {
      // Toutes les pièces sont déjà trouvées : on donne la poussière d'un jeu complet
      const p = pick(PACKS.filter((x) => x.box));
      return { rarity, pack: p.id, slots: [...PIECE_TYPES], fresh: [], dust: DUST.jeu };
    }
    const p = pick(missing);
    return { rarity, pack: p.id, slots: [...PIECE_TYPES], fresh: PIECE_TYPES.filter((t) => !has(p, t)), dust: 0 };
  }
  const pool = PACKS.filter((p) => p.rarity === rarity).flatMap((p) => PACK_ITEMS.filter((s) => packHas(p, s)).map((s) => [p, s]));
  const [p, s] = pick(pool);
  const fresh = has(p, s) ? [] : [s];
  return { rarity, pack: p.id, slots: [s], fresh, dust: fresh.length ? 0 : DUST[rarity] };
}

/**
 * Ouvre une box (key : une victoire, une box offerte, ou null pour une box payée en ✨).
 * Enregistre tout d'un coup : la box ouverte, les nouveaux éléments, la poussière.
 */
export async function openBox(uid, key, state) {
  const fromDust = !key;
  if (fromDust && state.dust < DUST_PER_BOX) throw new Error(`Il te faut ${DUST_PER_BOX} ✨ pour ouvrir une box.`);
  const boxKey = key || 'dust-' + push(ref(db, `loot/${uid}/opened`)).key;
  const res = drawBox(state.owned);
  const dust = state.dust - (fromDust ? DUST_PER_BOX : 0) + res.dust;
  const up = {
    [`loot/${uid}/opened/${boxKey}`]: {
      at: serverTimestamp(),
      item: res.rarity === 'jeu' ? `jeu.${res.pack}` : `${res.pack}.${res.slots[0]}`,
      rarity: res.rarity,
      ...(res.dust ? { dust: res.dust } : {}),
    },
    [`loot/${uid}/dust`]: dust,
  };
  for (const s of res.fresh) up[`loot/${uid}/owned/${res.pack}/${s}`] = true;
  await update(ref(db), up);
  return res;
}

/** Box de test (admins et fondateur). */
export async function grantTestBox(uid) {
  await set(push(ref(db, `lootGrants/${uid}`)), true);
}
