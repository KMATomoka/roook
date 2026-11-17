// Inventaire : l'apparence choisie par le joueur (plateau, pièces, fin de partie, prise et son).
// - Avec un compte : enregistrée dans users/{uid}/equip (Firebase), recopiée en local pour s'afficher tout de suite.
// - Sans compte : dans le navigateur (localStorage).
// Ce module pose des classes sur <body> (board-classic, pieces-astrea…) ; le CSS change le damier et les
// pièces selon ces classes, et fx.js / sound.js lisent l'animation et les sons équipés avec getEquip().
import { auth, db, onAuthStateChanged, ref, get, update, onValue } from './fb.js';

export const SLOTS = ['board', 'pieces', 'endAnim', 'capture'];
export const SLOT_NAMES = { board: 'Plateau', pieces: 'Pièces', endAnim: 'Fin de partie', capture: 'Prise et son' };

/**
 * Chaque pièce (pion, tour…) a son propre skin : on peut prendre le cavalier d'un pack et la dame d'un autre.
 * Dans les box, les pièces se trouvent une par une (owned/{pack}/N…) ; « pieces » = le jeu complet d'un coup.
 */
export const PIECE_TYPES = ['P', 'R', 'N', 'B', 'Q', 'K'];
export const PIECE_NAMES = { P: 'Pion', R: 'Tour', N: 'Cavalier', B: 'Fou', Q: 'Dame', K: 'Roi' };
export const PIECE_ROLE = { P: 'pawn', R: 'rook', N: 'knight', B: 'bishop', Q: 'queen', K: 'king' };
export const PIECE_ICON = { P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚' };
/** Tous les éléments à trouver dans un pack : plateau, les 6 pièces, fin de partie, prise et son. */
export const PACK_ITEMS = ['board', ...PIECE_TYPES, 'endAnim', 'capture'];
const isPieceType = (s) => PIECE_TYPES.includes(s);

/**
 * Raretés. Seuls Astrea et Classic (free: true) sont à tout le monde dès le début ; les autres communs (Bois) se trouvent dans les box. Rare et épique : chaque élément se trouve dans les box (js/box.js).
 * Légendaire : une mission spéciale (Royal chess, 100 victoires), jamais dans les box.
 */
export const RARITY = {
  commun: { name: 'Commun', color: '#c4c8d0' },
  rare: { name: 'Rare', color: '#4fa8ff' },
  epique: { name: 'Épique', color: '#b26bff' },
  legendaire: { name: 'Légendaire', color: '#f5b83d' },
};

/** Les packs. Astrea est l'apparence d'origine du site. */
export const PACKS = [
  {
    id: 'astrea',
    pieceTag: 'Astrea', // « Cavalier Astrea »
    name: 'Astrea chess',
    rarity: 'commun',
    free: true, // à tout le monde dès le début
    desc: 'L’apparence d’origine de ROOOK, version espace : damier violet, pièces de l’espace, trous de ver, supernova et sons de vaisseau.',
    items: {
      board: { name: 'Damier Astrea', desc: 'Cases lavande et violet.' },
      pieces: { name: 'Pièces Astrea', desc: 'Les pièces violettes « espace » de ROOOK.' },
      endAnim: { name: 'Supernova', desc: 'Victoire : hyperespace, le roi vaincu explose en nébuleuse d’étoiles. Défaite : ton roi est aspiré par un trou noir.' },
      capture: { name: 'Trou de ver', desc: 'La pièce prise est aspirée par un petit trou de ver qui se referme en étoiles ; blips, sonar et sons de l’espace.' },
    },
  },
  {
    id: 'classic',
    pieceTag: 'Staunton', // « Cavalier Staunton »
    name: 'Classic chess',
    rarity: 'commun',
    free: true, // à tout le monde dès le début
    desc: 'Le noir et blanc de toujours : damier neutre, pièces Staunton, gestes sobres et sons de bois.',
    items: {
      board: { name: 'Damier classique', desc: 'Blanc cassé et gris anthracite.' },
      pieces: { name: 'Pièces Staunton', desc: 'Le jeu « cburnett », le plus classique qui soit.' },
      endAnim: { name: 'Mat classique', desc: 'Le roi se couche doucement ; un titre simple et élégant.' },
      capture: { name: 'Prise classique', desc: 'La pièce s’efface ; petits bruits de bois.' },
    },
  },
  {
    id: 'bois',
    pieceTag: 'en bois', // « Cavalier en bois »
    name: 'Bois',
    rarity: 'commun',
    box: true, // pas débloqué d'office : le plateau et chaque pièce se trouvent dans les box
    // Pas un pack complet : seulement un plateau et des pièces (absent de l'onglet Packs, de Fin de partie, de Prise)
    only: ['board', 'pieces'],
    desc: 'Un vrai jeu en bois : damier d’érable clair et de noyer foncé avec le grain du bois, pièces tournées en buis et en ébène.',
    items: {
      board: { name: 'Damier noyer et érable', desc: 'Cases d’érable clair et de noyer foncé, chacune avec son grain, cadre de bois sombre.' },
      pieces: { name: 'Pièces tournées', desc: 'Des pièces Staunton tournées : buis clair pour les Blancs, ébène pour les Noirs, avec le grain du bois.' },
    },
  },
  {
    id: 'japon',
    pieceTag: 'Edo', // « Cavalier Edo »
    name: 'Sakura chess',
    rarity: 'rare',
    box: true,
    desc: 'Le Japon : papier washi rose sakura et indigo, pièces de laque, coups de sabre, cerisiers en fleur et sons de taiko et de koto.',
    items: {
      board: { name: 'Damier Washi', desc: 'Rose sakura à étoiles asanoha blanches, comme un papier washi, et bleu à vagues seigaiha, cadre de laque vermillon.' },
      pieces: { name: 'Pièces Edo', desc: 'Rose sakura pour les Blancs, indigo et or pour les Noirs : pion kokeshi, château, éventail, casque de samouraï.' },
      endAnim: { name: 'Hanami', desc: 'Victoire : le roi vaincu est tranché d’un coup de sabre, un soleil rouge se lève dans une tempête de pétales, sceau 勝. Défaite : ton roi se dissout dans l’encre, sceau 負.' },
      capture: { name: 'Iaï', desc: 'Un éclair de sabre tranche la pièce prise en deux, quelques pétales s’envolent ; bois de shogi, taiko et koto.' },
    },
  },
  {
    id: 'western',
    pieceTag: 'Frontier', // « Cavalier Frontier »
    name: 'Western chess',
    rarity: 'rare',
    box: true,
    desc: 'Le Far West : turquoise et terre cuite du Sud-Ouest, motifs navajos, étoile de shérif, duels au revolver et virevoltants.',
    items: {
      board: { name: 'Damier Canyon', desc: 'Turquoise pâle et terre cuite à motif navajo, cadre de cuir liseré de cuivre.' },
      pieces: { name: 'Pièces Frontier', desc: 'Turquoise pour les Blancs, terre cuite pour les Noirs : tour en coffre-fort, cheval géométrique navajo, étoiles de shérif, dame à couronne de balles.' },
      endAnim: { name: 'Règlement de comptes', desc: 'Le viseur se resserre, BANG : le roi vaincu tombe dans la poussière, un virevoltant passe, pancarte de saloon et sifflement de western. Défaite : pancarte trouée, vent du désert et harmonica.' },
      capture: { name: 'Duel', desc: 'Coup de revolver sur la pièce prise : éclair du canon, impact, la pièce est projetée, poussière, douille qui tinte ; bottes à éperons et chien qu’on arme à l’échec.' },
    },
  },
  {
    id: 'ocean',
    pieceTag: 'des Abysses', // « Cavalier des Abysses »
    name: 'Océan',
    rarity: 'epique',
    box: true,
    desc: 'Une partie au fond de la mer : eau claire et eau profonde, pièces de nacre et des abysses, siphon, aileron de requin, baleine et kraken.',
    items: {
      board: { name: 'Grand Bleu', desc: 'Eau claire traversée de reflets et eau profonde, des reflets de lumière qui ondulent ; cadre bleu nuit cerclé de nacre.' },
      pieces: { name: 'Nacre et Abysses', desc: 'Nacre irisée pour les Blancs, bleu des abysses aux contours qui luisent pour les Noirs : perle, corail, coquillage, hippocampe mythique, couronne de perles, trident.' },
      endAnim: { name: 'Les Abysses', desc: 'Victoire : la lumière descend de la surface, une baleine passe en chantant, un banc de poissons, le roi vaincu coule. Défaite : le noir se referme, l’œil du kraken s’ouvre et ses tentacules entraînent ton roi.' },
      capture: { name: 'Siphon', desc: 'Un petit tourbillon s’ouvre sur la case et aspire la pièce prise, quelques bulles remontent ; un aileron de requin tourne autour du roi à l’échec.' },
    },
  },
  {
    id: 'dragon',
    pieceTag: 'du Dragon', // « Cavalier du Dragon »
    name: 'Epic Dragon',
    rarity: 'epique',
    box: true,
    desc: 'L’antre du dragon : marbre d’or et d’obsidienne, braises qui montent, pièces d’or et d’obsidienne, souffle de feu et dragon qui survole le plateau.',
    items: {
      board: { name: 'Trésor du Dragon', desc: 'Marbre d’or et marbre d’obsidienne veiné de braise, chaque case sertie d’un filet d’or ; des braises montent sur tout le plateau.' },
      pieces: { name: 'Or et Obsidienne', desc: 'Or et ivoire pour les Blancs, obsidienne aux contours de braise pour les Noirs : œuf de dragon, forteresse volcanique, mitre de flammes, tête de dragon, reine ailée, roi à cornes.' },
      endAnim: { name: 'Le Souffle du Dragon', desc: 'Victoire : le ciel rougit, un dragon traverse le plateau et crache un torrent de feu, le roi vaincu tombe en cendres. Défaite : le plateau se fend, la lave engloutit ton roi sous le regard du dragon.' },
      capture: { name: 'Souffle de feu', desc: 'Un jet de flammes s’abat sur la pièce prise, qui s’embrase et part en cendres et en braises ; un anneau de feu entoure le roi à l’échec.' },
    },
  },
  {
    id: 'royal',
    pieceTag: 'royal', // « Cavalier royal »
    name: 'Royal chess',
    rarity: 'legendaire',
    desc: 'Or et crème, esprit chevalier : plateau ivoire et brun liseré d’or, pièces couronnées et joyaux.',
    // Se débloque avec 100 victoires en ligne contre des amis (parties vérifiées par l'arbitre) ;
    // débloqué d'office pour les admins et le fondateur (staff)
    unlock: { wins: 100, staff: true },
    items: {
      board: { name: 'Damier royal', desc: 'Ivoire et brun profond, liseré d’or.' },
      pieces: { name: 'Pièces royales', desc: 'Crème pour les Blancs, or pour les Noirs : couronnes, joyaux, cavalier en armure.' },
      endAnim: { name: 'Le Couronnement', desc: 'Le roi vaincu s’incline et se pétrifie, sa couronne s’envole sur la tête du vainqueur ; rayons et poussière d’or, fanfare de cuivres.' },
      capture: { name: 'Prise royale', desc: 'Comme Astrea, avec des particules d’or ou de crème selon la pièce prise ; mêmes sons.' },
    },
  },
];
export const DEFAULT = 'astrea';
/** Couleur de chaque pack (cartes de l'inventaire et de la collection) : Sakura rouge vermillon, Océan turquoise… */
export const PACK_COLOR = { astrea: '#9b7bff', classic: '#c4c8d0', bois: '#c08a55', japon: '#e8553f', western: '#d27b4f', ocean: '#46e6d4', dragon: '#ff5a1f', royal: '#e2b64e' };
const IDS = new Set(PACKS.map((p) => p.id));

const LOCAL = 'roque:equip'; // sans compte
const CACHE = 'roque:equip-dernier'; // dernier équipement affiché (pour éviter un « flash » au chargement)
const WINS_CACHE = 'roque:victoires'; // dernier nombre de victoires connu (même raison)
const STAFF_CACHE = 'roque:staff'; // admin ou fondateur (même raison)
const OWNED_CACHE = 'roque:objets'; // éléments trouvés dans les box (même raison)

// Victoires en ligne du joueur (parties entre amis, vérifiées par l'arbitre) : débloquent des packs
let wins = Number(readLocal(WINS_CACHE)) || 0;
// Admin ou fondateur : certains packs (Royal) sont débloqués d'office
let staff = !!readLocal(STAFF_CACHE);
const packById = (id) => PACKS.find((p) => p.id === id);
// Éléments trouvés dans les box : { japon: { board: true, … }, … } (loot/{uid}/owned)
let owned = readLocal(OWNED_CACHE) || {};
/** Mission spéciale (Royal) accomplie ? */
const missionDone = (p) => wins >= p.unlock.wins || (!!p.unlock.staff && staff);
/** Un élément (plateau, pièces…) d'un pack est-il à ce joueur ? */
/** Ce pack a-t-il cet élément ? (Bois : seulement un plateau et des pièces) */
export const packHas = (p, slot) => !p.only || p.only.includes(PIECE_TYPES.includes(slot) ? 'pieces' : slot);
// slot : board, endAnim, capture, une pièce (P, R, N…), ou « pieces » (les 6 pièces)
export const isItemUnlocked = (id, slot) => {
  const p = packById(id);
  if (!p || !packHas(p, slot)) return false;
  if (p.free) return true;
  if (p.unlock) return missionDone(p);
  if (slot === 'pieces') return PIECE_TYPES.every((t) => isItemUnlocked(id, t));
  // owned[id].pieces : le jeu complet trouvé d'un coup
  if (isPieceType(slot)) return !!(owned[id]?.[slot] || owned[id]?.pieces);
  return !!owned[id]?.[slot];
};
/** Le pack entier est-il débloqué (tous ses éléments) ? */
export const isUnlocked = (id) => PACK_ITEMS.every((s) => isItemUnlocked(id, s));
/** Nombre d'éléments débloqués dans un pack (0 à 9). */
export const unlockedCount = (id) => PACK_ITEMS.filter((s) => isItemUnlocked(id, s)).length;
/** Nombre de pièces débloquées dans un pack (0 à 6). */
export const piecesCount = (id) => PIECE_TYPES.filter((t) => isItemUnlocked(id, t)).length;
/** Nom d'un élément : « Cavalier des Abysses », « Damier Washi »… */
export const itemName = (id, slot) => {
  const p = packById(id);
  return isPieceType(slot) ? `${PIECE_NAMES[slot]} ${p.pieceTag}` : p.items[slot].name;
};
/** Progression vers un pack verrouillé : { wins, need, unlocked }. */
export const unlockProgress = (id) => {
  const need = packById(id)?.unlock?.wins || 0;
  return { wins, need, unlocked: isUnlocked(id) };
};

// equip = { board, pieces, endAnim, capture, piece: { P, R, N, B, Q, K } }
// « pieces » est le jeu de base (classe pieces-… sur <body>) ; « piece » dit le skin de chaque pièce.
function clean(e) {
  const out = {};
  for (const s of SLOTS) out[s] = e && IDS.has(e[s]) && isItemUnlocked(e[s], s) ? e[s] : DEFAULT;
  // Anciens équipements (sans « piece ») : les 6 pièces viennent du jeu de base
  const pc = (e && e.piece) || {};
  const base = e && IDS.has(e.pieces) ? e.pieces : out.pieces;
  out.piece = {};
  for (const t of PIECE_TYPES) {
    const id = IDS.has(pc[t]) ? pc[t] : base;
    out.piece[t] = isItemUnlocked(id, t) ? id : out.pieces;
  }
  return out;
}
/** Les 6 pièces viennent-elles du même pack ? Renvoie son id, sinon null. */
export const piecesPack = (e) => {
  const first = e?.piece?.[PIECE_TYPES[0]];
  return first && PIECE_TYPES.every((t) => e.piece[t] === first) ? first : null;
};

/** Rôle du joueur : admin ou fondateur ? */
async function loadStaff(u) {
  try {
    const role = (await get(ref(db, `roles/${u}`))).val();
    staff = role === 'admin' || role === 'fondateur';
    writeLocal(STAFF_CACHE, staff);
  } catch {
    // hors ligne : on garde la dernière valeur connue
  }
}

/** Compte les victoires en ligne dans l'historique du joueur (les parties contre Noa ne comptent pas). */
async function loadWins(u) {
  try {
    const snap = await get(ref(db, `history/${u}`));
    let n = 0;
    for (const g of Object.values(snap.val() || {})) {
      if (g.mode === 'ia') continue;
      if ((g.result === '1-0' && g.me === 'w') || (g.result === '0-1' && g.me === 'b')) n++;
    }
    wins = n;
    writeLocal(WINS_CACHE, n);
  } catch {
    // hors ligne : on garde le dernier nombre connu
  }
}
function readLocal(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function writeLocal(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

let equip = clean(readLocal(CACHE) || readLocal(LOCAL));
let uid = null;
const listeners = new Set();

/** Classes « slot-pack » sur un élément (body, ou un aperçu de l'inventaire). */
export function themeClasses(e) {
  // Pas de vérification du verrou ici : les aperçus de l'inventaire montrent aussi les packs verrouillés.
  // (L'équipement réel, lui, est déjà filtré par clean() avant d'arriver ici.)
  const c = {};
  for (const s of SLOTS) c[s] = e && IDS.has(e[s]) ? e[s] : DEFAULT;
  const out = [`board-${c.board}`, `pieces-${c.pieces}`, `end-${c.endAnim}`, `capture-${c.capture}`];
  // Une pièce d'un autre pack que le jeu de base : classe pc-N-ocean (le CSS change seulement cette pièce)
  for (const t of PIECE_TYPES) {
    const id = e?.piece?.[t];
    if (IDS.has(id) && id !== c.pieces) out.push(`pc-${t}-${id}`);
  }
  return out;
}
/** Retire les classes de thème d'un élément (avant d'en poser d'autres). */
export const THEME_CLASS = /^(board|pieces|end|capture|pc-[PRNBQK])-[a-z]+$/;
// Polices des animations de packs (bannières de fin, « échec ») : chargées seulement si le pack équipé en a
// besoin. Elles pesaient 115 Ko de CSS bloquant sur chaque page (surtout la police japonaise).
// Yuji Syuku : seulement les caractères utilisés (勝 負 王 手 et le français), grâce à « text= ».
const FR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÉÈÀÂÇéèêëàâîïôûùç’!?.,- ';
const PACK_FONTS = {
  royal: 'family=Cinzel:wght@600;700',
  japon: `family=Yuji+Syuku&text=${encodeURIComponent('勝負王手' + FR)}`,
  western: 'family=Rye',
  ocean: 'family=Cinzel:wght@700;900',
  dragon: 'family=Cinzel+Decorative:wght@700;900',
};
const fontsLoaded = new Set();
/** Charge la police d'un pack (une seule fois). */
export function loadPackFont(id) {
  if (!PACK_FONTS[id] || fontsLoaded.has(id) || !document.head) return;
  fontsLoaded.add(id);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?${PACK_FONTS[id]}&display=swap`;
  document.head.appendChild(l);
}

function apply() {
  const b = document.body;
  if (!b) return;
  loadPackFont(equip.endAnim);
  loadPackFont(equip.capture);
  for (const cls of [...b.classList]) if (THEME_CLASS.test(cls)) b.classList.remove(cls);
  b.classList.add(...themeClasses(equip));
}
function changed() {
  writeLocal(CACHE, equip);
  apply();
  for (const f of listeners) f(equip);
}

export const getEquip = () => ({ ...equip, piece: { ...equip.piece } });
export const onEquipChange = (f) => (listeners.add(f), () => listeners.delete(f));

/** Éléments trouvés dans les box, suivis en direct (une box ouverte débloque tout de suite l'élément partout). */
let ownedOff = null;
function watchOwned(u) {
  ownedOff?.();
  ownedOff = null;
  if (!u) return;
  ownedOff = onValue(
    ref(db, `loot/${u}/owned`),
    (s) => {
      owned = s.val() || {};
      writeLocal(OWNED_CACHE, owned);
      equip = clean(equip);
      changed();
    },
    () => {},
  );
}

/** Prêt quand on sait si le joueur a un compte (et que son équipement est chargé). */
export const ready = new Promise((resolve) => {
  let first = true;
  onAuthStateChanged(auth, async (u) => {
    uid = u ? u.uid : null;
    if (u) {
      try {
        const [snap, own] = await Promise.all([get(ref(db, `users/${u.uid}/equip`)), get(ref(db, `loot/${u.uid}/owned`)).catch(() => null), loadWins(u.uid), loadStaff(u.uid)]);
        if (own) {
          owned = own.val() || {};
          writeLocal(OWNED_CACHE, owned);
        }
        equip = clean(snap.val());
      } catch {
        // hors ligne ou base injoignable : on garde le dernier équipement connu
      }
      watchOwned(u.uid);
    } else {
      watchOwned(null);
      owned = {};
      writeLocal(OWNED_CACHE, {});
      wins = 0; // sans compte, pas de victoires en ligne
      staff = false;
      writeLocal(STAFF_CACHE, false);
      equip = clean(readLocal(LOCAL));
    }
    changed();
    if (first) {
      first = false;
      resolve({ signedIn: !!u });
    }
  });
});

/**
 * Équipe un ou plusieurs éléments, par ex. { board: 'classic' }, une pièce { N: 'ocean' },
 * toutes les pièces { pieces: 'japon' } ou un pack entier.
 */
export async function setEquip(partial) {
  const piece = { ...equip.piece };
  const rest = {};
  for (const [slot, id] of Object.entries(partial)) {
    if (!isItemUnlocked(id, slot)) throw new Error('Cet élément est encore verrouillé : trouve-le dans une box.');
    if (isPieceType(slot)) piece[slot] = id;
    else rest[slot] = id;
    // Changer tout le jeu d'un coup : les 6 pièces suivent
    if (slot === 'pieces') for (const t of PIECE_TYPES) piece[t] = id;
  }
  const next = clean({ ...equip, ...rest, piece });
  equip = next;
  changed();
  if (uid) {
    await update(ref(db, `users/${uid}`), { equip: next });
  } else {
    writeLocal(LOCAL, next);
  }
}

/** Équipe tout un pack d'un clic. */
export const equipPack = (id) => setEquip(Object.fromEntries(SLOTS.map((s) => [s, id])));

/** Équipe toutes les pièces d'un pack qu'on a déjà trouvées (les autres ne changent pas). */
export const equipOwnedPieces = (id) => {
  const ok = PIECE_TYPES.filter((t) => isItemUnlocked(id, t));
  return setEquip(ok.length === PIECE_TYPES.length ? { pieces: id } : Object.fromEntries(ok.map((t) => [t, id])));
};

apply();
