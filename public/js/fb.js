// Connexion à Firebase (comptes + base temps réel), chargé depuis le CDN officiel de Google.
// La configuration (firebase-config.js) n'est pas secrète : la sécurité vient des règles
// de la base (database.rules.json), qui disent qui peut lire et écrire quoi.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
  deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onChildRemoved,
  onDisconnect,
  serverTimestamp,
  runTransaction,
  query,
  limitToLast,
  limitToFirst,
  orderByKey,
  orderByChild,
  startAt,
  endAt,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'fr'; // e-mails de Firebase (mot de passe oublié…) en français
export const db = getDatabase(app);

export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
  deleteUser,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onChildRemoved,
  onDisconnect,
  serverTimestamp,
  runTransaction,
  query,
  limitToLast,
  limitToFirst,
  orderByKey,
  orderByChild,
  startAt,
  endAt,
};

// Écart entre l'horloge de cet ordinateur et celle de Firebase (pour des pendules justes)
let serverOffset = 0;
onValue(ref(db, '.info/serverTimeOffset'), (s) => (serverOffset = s.val() || 0));
export const serverNow = () => Date.now() + serverOffset;

/** Firebase identifie les comptes par e-mail : on fabrique une adresse à partir du pseudo (jamais utilisée pour écrire). */
export const pseudoEmail = (username) => `${username.toLowerCase()}@joueurs.roook-echecs.invalid`;
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Anciens comptes : l'adresse était fabriquée à partir du pseudo (pas de vraie adresse). */
export const isLegacyEmail = (email) => !email || email.endsWith('.roook-echecs.invalid');
