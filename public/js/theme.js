// Inventaire : l'apparence choisie par le joueur (plateau, pièces, fin de partie, prise et son).
// - Avec un compte : enregistrée dans users/{uid}/equip (Firebase), recopiée en local pour s'afficher tout de suite.
// - Sans compte : dans le navigateur (localStorage).
// Ce module pose des classes sur <body> (board-classic, pieces-astrea…) ; le CSS change le damier et les
// pièces selon ces classes, et fx.js / sound.js lisent l'animation et les sons équipés avec getEquip().
import { auth, db, onAuthStateChanged, ref, get, update } from './fb.js';

export const SLOTS = ['board', 'pieces', 'endAnim', 'capture'];
export const SLOT_NAMES = { board: 'Plateau', pieces: 'Pièces', endAnim: 'Fin de partie', capture: 'Prise et son' };

/** Les packs. Tout le monde possède ces deux-là. Astrea est l'apparence d'origine du site. */
export const PACKS = [
  {
    id: 'astrea',
    name: 'Astrea chess',
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
    name: 'Classic chess',
    desc: 'Le noir et blanc de toujours : damier neutre, pièces Staunton, gestes sobres et sons de bois.',
    items: {
      board: { name: 'Damier classique', desc: 'Blanc cassé et gris anthracite.' },
      pieces: { name: 'Pièces Staunton', desc: 'Le jeu « cburnett », le plus classique qui soit.' },
      endAnim: { name: 'Mat classique', desc: 'Le roi se couche doucement ; un titre simple et élégant.' },
      capture: { name: 'Prise classique', desc: 'La pièce s’efface ; petits bruits de bois.' },
    },
  },
  {
    id: 'japon',
    name: 'Sakura chess',
    desc: 'Le Japon : papier washi rose sakura et indigo, pièces de laque, coups de sabre, cerisiers en fleur et sons de taiko et de koto.',
    items: {
      board: { name: 'Damier Washi', desc: 'Rose sakura à étoiles asanoha et indigo à vagues seigaiha, cadre de laque vermillon.' },
      pieces: { name: 'Pièces Edo', desc: 'Rose sakura pour les Blancs, indigo et or pour les Noirs : pion kokeshi, château, éventail, casque de samouraï.' },
      endAnim: { name: 'Hanami', desc: 'Victoire : le roi vaincu est tranché d’un coup de sabre, un soleil rouge se lève dans une tempête de pétales, sceau 勝. Défaite : ton roi se dissout dans l’encre, sceau 負.' },
      capture: { name: 'Iaï', desc: 'Un éclair de sabre tranche la pièce prise en deux, quelques pétales s’envolent ; bois de shogi, taiko et koto.' },
    },
  },
  {
    id: 'western',
    name: 'Western chess',
    desc: 'Le Far West : sable du désert et cuir de selle, planches de saloon, cowboys et shérif, duels au revolver et virevoltants.',
    items: {
      board: { name: 'Damier Saloon', desc: 'Sable du désert et planches de saloon cloutées, cadre de cuir liseré de laiton.' },
      pieces: { name: 'Pièces Frontier', desc: 'Sable pour les Blancs, cuir de selle pour les Noirs : pion cowboy, cactus, fortin, couronne de balles, roi shérif.' },
      endAnim: { name: 'Règlement de comptes', desc: 'Le viseur se resserre, BANG : le roi vaincu tombe dans la poussière, un virevoltant passe, pancarte de saloon et sifflement de western. Défaite : pancarte trouée, vent du désert et harmonica.' },
      capture: { name: 'Duel', desc: 'Coup de revolver sur la pièce prise : éclair du canon, impact, la pièce est projetée, poussière, douille qui tinte ; bottes à éperons et chien qu’on arme à l’échec.' },
    },
  },
  {
    id: 'royal',
    name: 'Royal chess',
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
const IDS = new Set(PACKS.map((p) => p.id));

const LOCAL = 'roque:equip'; // sans compte
const CACHE = 'roque:equip-dernier'; // dernier équipement affiché (pour éviter un « flash » au chargement)
const WINS_CACHE = 'roque:victoires'; // dernier nombre de victoires connu (même raison)
const STAFF_CACHE = 'roque:staff'; // admin ou fondateur (même raison)

// Victoires en ligne du joueur (parties entre amis, vérifiées par l'arbitre) : débloquent des packs
let wins = Number(readLocal(WINS_CACHE)) || 0;
// Admin ou fondateur : certains packs (Royal) sont débloqués d'office
let staff = !!readLocal(STAFF_CACHE);
const packById = (id) => PACKS.find((p) => p.id === id);
/** Un pack est-il débloqué pour ce joueur ? */
export const isUnlocked = (id) => {
  const p = packById(id);
  return !!p && (!p.unlock || wins >= p.unlock.wins || (!!p.unlock.staff && staff));
};
/** Progression vers un pack verrouillé : { wins, need, unlocked }. */
export const unlockProgress = (id) => {
  const need = packById(id)?.unlock?.wins || 0;
  return { wins, need, unlocked: isUnlocked(id) };
};

function clean(e) {
  const out = {};
  for (const s of SLOTS) out[s] = e && IDS.has(e[s]) && isUnlocked(e[s]) ? e[s] : DEFAULT;
  return out;
}

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
  return [`board-${c.board}`, `pieces-${c.pieces}`, `end-${c.endAnim}`, `capture-${c.capture}`];
}
function apply() {
  const b = document.body;
  if (!b) return;
  for (const cls of [...b.classList]) if (/^(board|pieces|end|capture)-[a-z]+$/.test(cls)) b.classList.remove(cls);
  b.classList.add(...themeClasses(equip));
}
function changed() {
  writeLocal(CACHE, equip);
  apply();
  for (const f of listeners) f(equip);
}

export const getEquip = () => ({ ...equip });
export const onEquipChange = (f) => (listeners.add(f), () => listeners.delete(f));

/** Prêt quand on sait si le joueur a un compte (et que son équipement est chargé). */
export const ready = new Promise((resolve) => {
  let first = true;
  onAuthStateChanged(auth, async (u) => {
    uid = u ? u.uid : null;
    if (u) {
      try {
        const [snap] = await Promise.all([get(ref(db, `users/${u.uid}/equip`)), loadWins(u.uid), loadStaff(u.uid)]);
        equip = clean(snap.val());
      } catch {
        // hors ligne ou base injoignable : on garde le dernier équipement connu
      }
    } else {
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

/** Équipe un ou plusieurs éléments, par ex. { pieces: 'classic' } ou un pack entier. */
export async function setEquip(partial) {
  for (const id of Object.values(partial)) {
    if (!isUnlocked(id)) throw new Error('Ce pack est encore verrouillé.');
  }
  const next = clean({ ...equip, ...partial });
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

apply();
