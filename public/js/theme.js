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
    desc: 'L’apparence d’origine de ROOOK : damier violet, pièces de l’espace, éclats et confettis.',
    items: {
      board: { name: 'Damier Astrea', desc: 'Cases lavande et violet.' },
      pieces: { name: 'Pièces Astrea', desc: 'Les pièces violettes « espace » de ROOOK.' },
      endAnim: { name: 'Mat Astrea', desc: 'Le roi vacille et tombe, ondes de choc, confettis et grand titre.' },
      capture: { name: 'Prise Astrea', desc: 'La pièce prise éclate en morceaux ; sons synthétiques de ROOOK.' },
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
];
export const DEFAULT = 'astrea';
const IDS = new Set(PACKS.map((p) => p.id));

const LOCAL = 'roque:equip'; // sans compte
const CACHE = 'roque:equip-dernier'; // dernier équipement affiché (pour éviter un « flash » au chargement)

function clean(e) {
  const out = {};
  for (const s of SLOTS) out[s] = e && IDS.has(e[s]) ? e[s] : DEFAULT;
  return out;
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
  const c = clean(e);
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
        const snap = await get(ref(db, `users/${u.uid}/equip`));
        equip = clean(snap.val());
      } catch {
        // hors ligne ou base injoignable : on garde le dernier équipement connu
      }
    } else {
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
