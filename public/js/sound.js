// Bruitages synthétisés avec Web Audio (aucun fichier audio à télécharger).
// Chaque son est fabriqué à partir de petits « tocs » de bruit filtré et de notes courtes.
// Deux jeux de sons, choisis dans l'inventaire (js/theme.js) :
// - « Prise et son » : déplacement, prise, roque, promotion, échec ;
// - « Fin de partie » : le son de l'échec et mat.
import { getEquip } from './theme.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
try {
  muted = localStorage.getItem('roque:son') === 'off';
} catch {}

export const isMuted = () => muted;
/** Volume général (0 à 1), réglé dans la page Paramètres. */
let volume = 1;
try {
  const v = Number(localStorage.getItem('roque:volume'));
  if (localStorage.getItem('roque:volume') !== null && v >= 0 && v <= 1) volume = v;
} catch {}
const MASTER = 0.9; // niveau de sortie à 100 %
export const getVolume = () => volume;
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  try {
    localStorage.setItem('roque:volume', String(volume));
  } catch {}
  if (master && ctx) master.gain.setTargetAtTime(MASTER * volume, ctx.currentTime, 0.02);
}
export function setMuted(v) {
  muted = !!v;
  try {
    localStorage.setItem('roque:son', muted ? 'off' : 'on');
  } catch {}
}

let comp = null;

/**
 * Coupe net tous les sons en cours ET ceux déjà programmés (une fin de partie, un accord, la musique…) :
 * tout passe par « master », qu'on éteint en un éclair puis qu'on remplace par un neuf pour les sons suivants.
 * Sert quand on ferme ou passe une animation, ou qu'on en lance une autre (inventaire, coffres).
 */
export function stopAllSounds() {
  if (!ctx || !master) return;
  const old = master;
  const now = ctx.currentTime;
  old.gain.cancelScheduledValues(now);
  old.gain.setValueAtTime(old.gain.value, now);
  old.gain.linearRampToValueAtTime(0, now + 0.04);
  setTimeout(() => old.disconnect(), 80);
  master = ctx.createGain();
  master.gain.value = MASTER * volume;
  master.connect(comp);
  // La musique, l'eau (Océan) et l'écho du canyon (Western) étaient branchés sur l'ancien « master » :
  // on les oublie, ils seront recréés sur le nouveau (avant, les sons Océan et Western devenaient muets)
  stopMusicNow();
  seaBus = null;
  canyonIn = null;
}

function audio() {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Un compresseur évite que les sons forts (mat) saturent
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = MASTER * volume;
      master.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Note : fréquence (glissant éventuellement vers endFreq), enveloppe rapide. */
function tone({ freq, endFreq, type = 'sine', at = 0, dur = 0.1, vol = 0.2, attack = 0.004 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Souffle de bruit filtré : le « toc » du bois, l'éclat d'une prise, le fracas du mat. */
function burst({ at = 0, dur = 0.05, vol = 0.3, type = 'bandpass', freq = 1500, endFreq, q = 1 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// --- Sons de base ------------------------------------------------------------
function tok(at = 0, pitch = 1) {
  burst({ at, dur: 0.035, vol: 0.55, freq: 2300 * pitch, q: 2.2 });
  tone({ freq: 200 * pitch, endFreq: 120 * pitch, at, dur: 0.07, vol: 0.32 });
}

function capture() {
  // Choc plus lourd + éclats aigus
  burst({ at: 0, dur: 0.07, vol: 0.7, freq: 1100, q: 1.3 });
  tone({ freq: 150, endFreq: 55, at: 0, dur: 0.16, vol: 0.5 });
  burst({ at: 0.025, dur: 0.22, vol: 0.13, type: 'highpass', freq: 4500 });
  tone({ freq: 2100, endFreq: 1300, type: 'triangle', at: 0.02, dur: 0.09, vol: 0.05 });
}

function castle() {
  tok(0, 1);
  tok(0.1, 0.9);
}

function promote() {
  tok(0);
  [784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', at: 0.06 + i * 0.05, dur: 0.22, vol: 0.07 }));
}

function check() {
  // Alerte métallique en deux temps
  tone({ freq: 988, type: 'triangle', at: 0.06, dur: 0.16, vol: 0.16 });
  tone({ freq: 1976, type: 'sine', at: 0.06, dur: 0.12, vol: 0.05 });
  tone({ freq: 1319, type: 'triangle', at: 0.15, dur: 0.32, vol: 0.15 });
  tone({ freq: 2637, type: 'sine', at: 0.15, dur: 0.2, vol: 0.04 });
}

// --- Sons « Classic » : bois, feutre, rien de synthétique -----------------
function wood(at = 0, { pitch = 1, vol = 1 } = {}) {
  // Pièce de bois posée sur l'échiquier : un toc court et mat, sans résonance métallique
  burst({ at, dur: 0.025, vol: 0.42 * vol, freq: 1300 * pitch, q: 3.5 });
  burst({ at, dur: 0.05, vol: 0.3 * vol, type: 'lowpass', freq: 600 * pitch, q: 0.8 });
  tone({ freq: 340 * pitch, endFreq: 230 * pitch, type: 'sine', at, dur: 0.05, vol: 0.18 * vol });
}
const classic = {
  move: () => wood(),
  capture: () => {
    // Deux bois qui se touchent, puis la pièce posée
    wood(0, { pitch: 0.85, vol: 1.1 });
    wood(0.055, { pitch: 1.12, vol: 0.75 });
  },
  castle: () => {
    wood(0);
    wood(0.12, { pitch: 0.92 });
  },
  promote: () => {
    wood(0);
    tone({ freq: 880, type: 'sine', at: 0.06, dur: 0.35, vol: 0.05 });
  },
  check: () => {
    // Petit « ding » discret
    tone({ freq: 1175, type: 'sine', at: 0.05, dur: 0.4, vol: 0.07 });
  },
};
function classicMate(outcome) {
  // Le roi couché, puis un accord simple au piano (majeur si on gagne, mineur sinon)
  wood(0, { pitch: 0.8, vol: 1.1 });
  wood(0.42, { pitch: 0.7 });
  const chord = outcome === 'loss' ? [220, 261.6, 329.6] : [261.6, 329.6, 392];
  chord.forEach((f, i) => {
    tone({ freq: f, type: 'triangle', at: 0.6 + i * 0.07, dur: 1.6, vol: 0.09 });
    tone({ freq: f * 2, type: 'sine', at: 0.6 + i * 0.07, dur: 1.1, vol: 0.025 });
  });
}

/** Cuivre (fanfare) : deux dents de scie désaccordées, filtre qui s'ouvre puis se referme. */
function brass({ freq, at = 0, dur = 0.4, vol = 0.1 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(450, t);
  f.frequency.linearRampToValueAtTime(2800, t + 0.07);
  f.frequency.exponentialRampToValueAtTime(1200, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.035);
  g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.06, dur - 0.1));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);
  f.connect(g).connect(master);
  for (const det of [-7, 7]) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.25);
  }
}

/** Timbale : coup grave et rond. */
function timpani(at, vol = 0.45) {
  tone({ freq: 104, endFreq: 74, at, dur: 0.9, vol, attack: 0.003 });
  burst({ at, dur: 0.18, vol: vol * 0.5, type: 'lowpass', freq: 380, endFreq: 140, q: 0.8 });
}

/** Cloche claire (la couronne qui se pose). */
function bell(freq, at, vol = 0.07) {
  [1, 2.01, 2.76, 4.07].forEach((m, i) => tone({ freq: freq * m, type: 'sine', at, dur: 2.4 - i * 0.45, vol: vol / (i + 1), attack: 0.002 }));
}

/**
 * Échec et mat « Royal » (le Couronnement) : roulement de timbales, fanfare de cuivres,
 * puis une cloche quand la couronne se pose sur le roi vainqueur. Défaite : cadence grave et solennelle.
 */
function royalMate(outcome) {
  // Scintillement doré au début
  [1568, 2093, 2637, 3136].forEach((f, i) => tone({ freq: f, type: 'sine', at: 0.12 + i * 0.05, dur: 0.6, vol: 0.025 }));
  // Roulement de timbales qui monte
  for (let i = 0; i < 10; i++) timpani(0.15 + i * 0.075, 0.08 + i * 0.022);
  if (outcome === 'loss') {
    // Cadence mineure, lente et digne
    timpani(1.0, 0.5);
    [[220, 0.55], [174.6, 0.55], [164.8, 1.6]].forEach(([f, d], i) => {
      const at = 1.0 + i * 0.6;
      brass({ freq: f, at, dur: d, vol: 0.09 });
      brass({ freq: f / 2, at, dur: d, vol: 0.06 });
    });
    timpani(2.2, 0.45);
    bell(659.3, 3.45, 0.04);
    return;
  }
  // Fanfare : appel en triolet, puis la tonique tenue, puis l'accord final
  timpani(1.0, 0.55);
  const call = [[392, 0.13], [392, 0.13], [392, 0.13], [523.3, 0.55]];
  let at = 1.0;
  for (const [f, d] of call) {
    brass({ freq: f, at, dur: d, vol: 0.1 });
    brass({ freq: f * 0.75, at, dur: d, vol: 0.05 }); // quarte en dessous
    at += d + 0.02;
  }
  at += 0.05;
  timpani(at, 0.6);
  // Accord de do majeur, avec le mi aigu au-dessus
  for (const f of [261.6, 329.6, 392, 523.3, 659.3]) brass({ freq: f, at, dur: 1.7, vol: f > 500 ? 0.07 : 0.06 });
  timpani(at + 0.5, 0.35);
  // La couronne se pose : cloche et étincelles
  bell(1318.5, 3.45, 0.07);
  bell(1975.5, 3.5, 0.04);
  [2637, 3136, 3951].forEach((f, i) => tone({ freq: f, type: 'sine', at: 3.5 + i * 0.07, dur: 0.5, vol: 0.02 }));
}

// --- Sons « Astrea » (espace) ---------------------------------------------------
/** Petit écho : la même note répétée, plus douce, comme dans le vide spatial. */
function echo(opts, { times = 2, gap = 0.14, decay = 0.45 } = {}) {
  for (let i = 0; i <= times; i++) tone({ ...opts, at: (opts.at || 0) + i * gap, vol: opts.vol * Math.pow(decay, i) });
}

/** Nappe de synthé (dents de scie désaccordées, filtre qui s'ouvre). */
function pad(freqs, { at = 0, dur = 1.6, vol = 0.05, open = 2200 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(open, t + dur * 0.5);
  f.frequency.exponentialRampToValueAtTime(400, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(master);
  for (const fr of freqs) {
    for (const det of [-9, 9]) {
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr, t);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
}

const space = {
  // Déplacement : un « blip » doux qui monte
  move() {
    tone({ freq: 520, endFreq: 760, at: 0, dur: 0.07, vol: 0.13 });
    tone({ freq: 1560, endFreq: 2280, at: 0, dur: 0.05, vol: 0.025 });
    burst({ at: 0, dur: 0.02, vol: 0.12, freq: 3000, q: 2 });
  },
  // Prise : la pièce aspirée par le trou de ver (glissando qui plonge), puis un scintillement
  capture() {
    tone({ freq: 900, endFreq: 70, at: 0.05, dur: 0.42, vol: 0.28, attack: 0.01 });
    tone({ freq: 450, endFreq: 40, type: 'triangle', at: 0.05, dur: 0.42, vol: 0.14, attack: 0.01 });
    burst({ at: 0.04, dur: 0.4, vol: 0.22, type: 'bandpass', freq: 3200, endFreq: 260, q: 1.4 });
    tone({ freq: 70, endFreq: 40, at: 0.42, dur: 0.25, vol: 0.3 });
    echo({ freq: 2637, type: 'sine', at: 0.48, dur: 0.12, vol: 0.05 }, { times: 2, gap: 0.09 });
    echo({ freq: 3520, type: 'sine', at: 0.52, dur: 0.1, vol: 0.03 }, { times: 1, gap: 0.09 });
  },
  castle() {
    space.move();
    tone({ freq: 600, endFreq: 880, at: 0.11, dur: 0.07, vol: 0.12 });
  },
  // Promotion : montée « power-up » qui scintille
  promote() {
    [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, endFreq: f * 1.02, type: 'triangle', at: i * 0.045, dur: 0.18, vol: 0.06 }));
    echo({ freq: 2093, type: 'sine', at: 0.25, dur: 0.3, vol: 0.05 }, { times: 2, gap: 0.12 });
  },
  // Échec : ping de sonar, avec son écho
  check() {
    echo({ freq: 1244.5, type: 'sine', at: 0.05, dur: 0.35, vol: 0.16, attack: 0.003 }, { times: 2, gap: 0.2, decay: 0.4 });
    tone({ freq: 2489, type: 'sine', at: 0.05, dur: 0.15, vol: 0.03 });
  },
};

/**
 * Échec et mat « Astrea ».
 * Victoire : montée d'hyperespace, l'explosion de la supernova, puis une pluie d'étoiles qui scintille.
 * Défaite : grondement du trou noir qui aspire ton roi, puis un accord sombre.
 */
function spaceMate(outcome) {
  if (outcome === 'loss') {
    tone({ freq: 55, at: 0.1, dur: 2.6, vol: 0.32, attack: 0.4 }); // grondement
    tone({ freq: 82.4, type: 'triangle', at: 0.1, dur: 2.4, vol: 0.12, attack: 0.5 });
    tone({ freq: 500, endFreq: 45, at: 0.7, dur: 1.4, vol: 0.2, attack: 0.05 }); // aspiration
    burst({ at: 0.6, dur: 1.5, vol: 0.2, type: 'bandpass', freq: 2400, endFreq: 120, q: 1.2 });
    burst({ at: 2.05, dur: 0.5, vol: 0.45, type: 'lowpass', freq: 500, endFreq: 60, q: 0.8 }); // le trou se referme
    tone({ freq: 60, endFreq: 28, at: 2.05, dur: 0.8, vol: 0.45 });
    pad([110, 130.8, 164.8], { at: 1.6, dur: 2.6, vol: 0.05, open: 1200 }); // la mineur
    echo({ freq: 659.3, type: 'sine', at: 2.3, dur: 0.5, vol: 0.05 }, { times: 3, gap: 0.22 });
    return;
  }
  // Montée d'hyperespace
  burst({ at: 0, dur: 0.95, vol: 0.16, type: 'highpass', freq: 600, endFreq: 7000, q: 0.7 });
  tone({ freq: 180, endFreq: 1400, type: 'sawtooth', at: 0, dur: 0.9, vol: 0.05, attack: 0.3 });
  tone({ freq: 90, endFreq: 700, at: 0, dur: 0.9, vol: 0.12, attack: 0.3 });
  // Supernova
  tone({ freq: 110, endFreq: 30, at: 0.9, dur: 1.4, vol: 0.7, attack: 0.002 });
  burst({ at: 0.9, dur: 0.9, vol: 0.6, type: 'lowpass', freq: 1400, endFreq: 90, q: 0.7 });
  burst({ at: 0.92, dur: 1.6, vol: 0.14, type: 'highpass', freq: 4000, endFreq: 9000 });
  // Pluie d'étoiles : arpège pentatonique avec écho, sur une nappe lumineuse
  pad([261.6, 329.6, 392, 523.3], { at: 1.1, dur: 2.8, vol: 0.045, open: 3200 });
  [1046.5, 1318.5, 1568, 2093, 2349.3, 2637, 3136].forEach((f, i) =>
    echo({ freq: f, type: 'sine', at: 1.25 + i * 0.09, dur: 0.35, vol: 0.06 }, { times: 2, gap: 0.16 }),
  );
  // Comètes : deux souffles qui passent
  burst({ at: 2.1, dur: 0.9, vol: 0.12, type: 'bandpass', freq: 800, endFreq: 4200, q: 2 });
  burst({ at: 2.9, dur: 0.9, vol: 0.1, type: 'bandpass', freq: 4200, endFreq: 700, q: 2 });
  // Fanfare de synthé : arpège qui monte, puis la note finale tenue, sur une grande nappe
  const lead = [[392, 0.16], [523.3, 0.16], [659.3, 0.16], [784, 0.3], [1046.5, 1.3]];
  let t = 2.15;
  for (const [f, d] of lead) {
    tone({ freq: f, type: 'sawtooth', at: t, dur: d + 0.1, vol: 0.045, attack: 0.01 });
    tone({ freq: f, type: 'triangle', at: t, dur: d + 0.15, vol: 0.08, attack: 0.01 });
    echo({ freq: f * 2, type: 'sine', at: t + 0.05, dur: 0.2, vol: 0.025 }, { times: 2, gap: 0.15 });
    t += d + 0.03;
  }
  pad([261.6, 329.6, 392, 523.3, 659.3], { at: 2.7, dur: 2.6, vol: 0.05, open: 4200 });
  tone({ freq: 65.4, at: 2.7, dur: 2.2, vol: 0.18, attack: 0.08 });
}

// Royal : garde les sons d'origine (avant Astrea « espace ») pour les coups, prises et échecs
// --- Sons « Sakura » (Japon) : bois de shogi, sabre, taiko, koto, shakuhachi, cloche de temple -------
/** Pièce de shogi claquée sur un plateau en bois de kaya : un « pachi » sec et clair. */
function pachi(at = 0, { pitch = 1, vol = 1 } = {}) {
  burst({ at, dur: 0.018, vol: 0.55 * vol, freq: 3400 * pitch, q: 5 });
  burst({ at, dur: 0.04, vol: 0.28 * vol, type: 'lowpass', freq: 900 * pitch, q: 1 });
  tone({ freq: 620 * pitch, endFreq: 520 * pitch, type: 'sine', at, dur: 0.06, vol: 0.12 * vol });
}

/** Taiko : grand tambour, coup grave et rond. */
function taiko(at = 0, vol = 0.5, pitch = 1) {
  tone({ freq: 120 * pitch, endFreq: 58 * pitch, at, dur: 0.55, vol, attack: 0.002 });
  tone({ freq: 240 * pitch, endFreq: 110 * pitch, at, dur: 0.12, vol: vol * 0.3 });
  burst({ at, dur: 0.12, vol: vol * 0.55, type: 'lowpass', freq: 500, endFreq: 150, q: 0.7 });
}

/** Koto : corde pincée, harmoniques qui s'éteignent vite, petit glissé vers la note. */
function koto(freq, at = 0, vol = 0.09, dur = 1.4) {
  tone({ freq: freq * 1.012, endFreq: freq, type: 'triangle', at, dur, vol, attack: 0.002 });
  tone({ freq: freq * 2, type: 'sine', at, dur: dur * 0.5, vol: vol * 0.45, attack: 0.002 });
  tone({ freq: freq * 3.01, type: 'sine', at, dur: dur * 0.25, vol: vol * 0.25, attack: 0.002 });
  burst({ at, dur: 0.02, vol: vol * 1.2, freq: freq * 4, q: 4 });
}

/** Souffle filtré qui enfle puis retombe (la lame qui fend l'air), filtre qui balaie f0 → f1 → f2. */
function noiseSweep({ at = 0, dur = 0.2, type = 'bandpass', f = [500, 4000, 900], q = 2, vol = 0.3, peak = 0.5 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const fl = a.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f[0], t);
  fl.frequency.exponentialRampToValueAtTime(f[1], t + dur * peak);
  fl.frequency.exponentialRampToValueAtTime(f[2], t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * peak);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

/**
 * Katana : « fwish » de la lame qui fend l'air, le « tchak » de la coupe, puis l'acier qui chante
 * (frottement métallique « shiiing » et résonance d'une lame : partiels inharmoniques un peu désaccordés).
 */
function katana(at = 0, vol = 1) {
  // La lame fend l'air
  noiseSweep({ at, dur: 0.2, f: [450, 3800, 1200], q: 2.2, vol: 0.55 * vol, peak: 0.55 });
  noiseSweep({ at: at + 0.02, dur: 0.16, type: 'highpass', f: [2500, 6000, 3500], q: 0.7, vol: 0.12 * vol, peak: 0.6 });
  // La coupe
  const cut = at + 0.11;
  burst({ at: cut, dur: 0.03, vol: 0.5 * vol, freq: 2600, q: 3 });
  burst({ at: cut, dur: 0.05, vol: 0.25 * vol, type: 'lowpass', freq: 700, q: 0.8 });
  // « Shiiing » : l'acier qui frotte
  noiseSweep({ at: cut, dur: 0.42, f: [4200, 7600, 6200], q: 9, vol: 0.2 * vol, peak: 0.25 });
  // La lame qui résonne (rapports d'une barre métallique 1 : 2,76 : 5,40, chacun doublé et désaccordé : ça miroite)
  const base = 1480;
  [[1, 1.3, 0.05], [2.756, 0.9, 0.035], [5.404, 0.55, 0.022], [8.93, 0.3, 0.012]].forEach(([m, d, v]) => {
    tone({ freq: base * m, type: 'sine', at: cut + 0.01, dur: d, vol: v * vol, attack: 0.004 });
    tone({ freq: base * m + 5 + m * 2, type: 'sine', at: cut + 0.01, dur: d * 0.9, vol: v * 0.7 * vol, attack: 0.004 });
  });
}

/** Shakuhachi : flûte de bambou, attaque soufflée et vibrato qui s'installe. */
function shakuhachi(freq, at = 0, dur = 0.8, vol = 0.07, endFreq = null) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * 0.96, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
  if (endFreq) {
    o.frequency.setValueAtTime(freq, t + dur * 0.6);
    o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  }
  const lfo = a.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = a.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(freq * 0.012, t + dur * 0.6);
  lfo.connect(depth).connect(o.frequency);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.14);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
  burst({ at, dur: Math.min(0.5, dur * 0.6), vol: vol * 0.6, type: 'bandpass', freq: freq * 2, q: 2.5 }); // le souffle
}

/** Cloche de temple (bonshō) : grave, longue, aux harmoniques irrégulières. */
function templeBell(at = 0, vol = 0.12) {
  [[1, 4.5], [2.32, 3.2], [3.01, 2.4], [4.17, 1.6], [5.43, 1.1]].forEach(([m, d], i) => tone({ freq: 98 * m, type: 'sine', at, dur: d, vol: vol / (i + 1), attack: 0.004 }));
  burst({ at, dur: 0.08, vol, type: 'lowpass', freq: 400, q: 0.7 });
}

const sakura = {
  move: () => pachi(),
  // Le sabre fend l'air au moment où l'éclair traverse la case, puis la pièce se pose
  capture: () => {
    katana(0);
    pachi(0.18, { pitch: 0.9, vol: 0.6 });
  },
  castle: () => {
    pachi(0);
    pachi(0.12, { pitch: 0.92 });
  },
  promote: () => {
    pachi(0);
    [587.3, 659.3, 880, 987.8].forEach((f, i) => koto(f, 0.08 + i * 0.07, 0.07, 0.9));
  },
  // Échec (王手) : deux coups de taiko
  check: () => {
    taiko(0.04, 0.45);
    pachi(0.04, { pitch: 1.4, vol: 0.6 });
    taiko(0.2, 0.3, 1.08);
  },
};

/**
 * Échec et mat « Hanami ». Victoire : taiko qui s'accélère pendant que le roi tremble, coup de sabre,
 * arpège de koto (gamme yo, lumineuse), coup de tambour quand le sceau 勝 s'appose.
 * Défaite : cloche de temple, shakuhachi qui descend (gamme in, mélancolique), sceau 負.
 */
function sakuraMate(outcome) {
  if (outcome === 'loss') {
    templeBell(0.15, 0.13);
    shakuhachi(440, 0.7, 0.7, 0.06);
    shakuhachi(349.2, 1.35, 0.6, 0.06);
    shakuhachi(329.6, 1.9, 1.7, 0.065, 311.1);
    taiko(1.62, 0.35, 0.85); // le sceau
    templeBell(2.8, 0.07);
    return;
  }
  [0.14, 0.4, 0.58, 0.7, 0.78].forEach((t, i) => taiko(t, 0.22 + i * 0.06));
  katana(0.8, 1.3);
  taiko(0.92, 0.7, 0.9);
  [293.7, 329.6, 392, 440, 493.9, 587.3, 659.3, 784].forEach((f, i) => koto(f, 1.05 + i * 0.075, 0.08, 1.6));
  taiko(1.5, 0.6); // le sceau 勝
  pachi(1.5, { pitch: 0.7, vol: 1.2 });
  [587.3, 784, 880].forEach((f) => koto(f, 1.95, 0.06, 2.2));
  shakuhachi(880, 2.0, 1.7, 0.045);
}

// --- Sons « Western » : bottes et éperons, revolver, ricochet, douille, sifflement, guitare, harmonica, vent ---
/** Pas de botte sur le plancher du saloon, avec le tintement de l'éperon. */
function boot(at = 0, { pitch = 1, vol = 1, spur = true } = {}) {
  burst({ at, dur: 0.035, vol: 0.5 * vol, freq: 750 * pitch, q: 1.8 });
  burst({ at, dur: 0.07, vol: 0.32 * vol, type: 'lowpass', freq: 320 * pitch, q: 0.8 });
  tone({ freq: 180 * pitch, endFreq: 120 * pitch, at, dur: 0.08, vol: 0.18 * vol });
  if (spur) [4180, 5260, 6320].forEach((f, i) => tone({ freq: f, type: 'sine', at: at + 0.03 + i * 0.025, dur: 0.12, vol: 0.018 * vol, attack: 0.002 }));
}

/** Réverbération de canyon (créée une seule fois) : réponse impulsionnelle de bruit qui décroît, assombrie,
 *  plus un écho qui revient de la falaise. Renvoie l'entrée où envoyer un son. */
let canyonIn = null;
function canyon() {
  const a = audio();
  if (!a) return null;
  if (canyonIn) return canyonIn;
  const len = Math.floor(a.sampleRate * 1.9);
  const ir = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
  }
  const conv = a.createConvolver();
  conv.buffer = ir;
  const dark = a.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = 2400;
  const wet = a.createGain();
  wet.gain.value = 0.5;
  conv.connect(dark).connect(wet).connect(master);
  // Écho de la falaise
  const delay = a.createDelay(1);
  delay.delayTime.value = 0.34;
  const echoTone = a.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 1400;
  const feedback = a.createGain();
  feedback.gain.value = 0.3;
  const echoOut = a.createGain();
  echoOut.gain.value = 0.32;
  delay.connect(echoTone);
  echoTone.connect(feedback).connect(delay);
  echoTone.connect(echoOut).connect(master);
  canyonIn = a.createGain();
  canyonIn.connect(conv);
  canyonIn.connect(delay);
  return canyonIn;
}

/** Saturation douce (donne le grain d'une détonation). */
function saturator(a, drive = 3) {
  const ws = a.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i * 2) / curve.length - 1) * drive);
  ws.curve = curve;
  return ws;
}

/**
 * Coup de revolver : déclic du chien, claquement sec et saturé (attaque instantanée), souffle grave,
 * puis la réverbération et l'écho du canyon.
 */
function gunshot(at = 0, vol = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  // Le chien qui tombe, juste avant
  if (at >= 0.015) burst({ at: at - 0.014, dur: 0.012, vol: 0.35 * vol, freq: 3800, q: 6 });
  const out = a.createGain();
  out.gain.value = vol * 0.45; // volume de base du coup de feu
  out.connect(master);
  const send = canyon();
  if (send) {
    const s = a.createGain();
    s.gain.value = 0.6;
    out.connect(s).connect(send);
  }
  const sat = saturator(a, 3.2);
  sat.connect(out);
  // 1. Le claquement : bruit large bande, attaque instantanée, chute très rapide
  const crack = a.createBufferSource();
  crack.buffer = noiseBuf;
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 350;
  const cg = a.createGain();
  cg.gain.setValueAtTime(1.8, t);
  cg.gain.exponentialRampToValueAtTime(0.35, t + 0.012);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  crack.connect(hp).connect(cg).connect(sat);
  crack.start(t, Math.random() * 0.5);
  crack.stop(t + 0.2);
  // 2. Le souffle grave de la détonation
  const boom = a.createOscillator();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(160, t);
  boom.frequency.exponentialRampToValueAtTime(42, t + 0.2);
  const bg = a.createGain();
  bg.gain.setValueAtTime(1.3, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  boom.connect(bg).connect(sat);
  boom.start(t);
  boom.stop(t + 0.3);
  const thump = a.createBufferSource();
  thump.buffer = noiseBuf;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, t);
  lp.frequency.exponentialRampToValueAtTime(180, t + 0.35);
  const tg = a.createGain();
  tg.gain.setValueAtTime(1, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  thump.connect(lp).connect(tg).connect(sat);
  thump.start(t, Math.random() * 0.5);
  thump.stop(t + 0.45);
}

/** Ricochet : la balle qui siffle en s'éloignant. */
function ricochet(at = 0, vol = 1) {
  tone({ freq: 3600, endFreq: 1150, type: 'sine', at, dur: 0.55, vol: 0.045 * vol, attack: 0.004 });
  tone({ freq: 3640, endFreq: 1180, type: 'sine', at: at + 0.005, dur: 0.5, vol: 0.03 * vol, attack: 0.004 });
}

/** Le chien du revolver qu'on arme : deux déclics métalliques. */
function hammer(at = 0, vol = 1) {
  burst({ at, dur: 0.018, vol: 0.55 * vol, freq: 3200, q: 6 });
  tone({ freq: 2400, type: 'square', at, dur: 0.015, vol: 0.03 * vol });
  burst({ at: at + 0.11, dur: 0.022, vol: 0.7 * vol, freq: 4300, q: 7 });
  tone({ freq: 3100, type: 'square', at: at + 0.11, dur: 0.02, vol: 0.035 * vol });
}

/** Douille qui tombe et rebondit sur le plancher. */
function shell(at = 0, vol = 1) {
  [[0, 1], [0.11, 0.6], [0.18, 0.35], [0.22, 0.2]].forEach(([dt, v]) => {
    tone({ freq: 5200, type: 'sine', at: at + dt, dur: 0.07, vol: 0.03 * v * vol, attack: 0.001 });
    tone({ freq: 6900, type: 'sine', at: at + dt, dur: 0.05, vol: 0.02 * v * vol, attack: 0.001 });
  });
}

/** Sifflement à la western : sinusoïde pure, petit glissé et vibrato. */
function whistle(freq, at, dur, vol = 0.05, from = null) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(from || freq * 0.94, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
  const lfo = a.createOscillator();
  lfo.frequency.value = 6;
  const depth = a.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(freq * 0.015, t + dur * 0.7);
  lfo.connect(depth).connect(o.frequency);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
  g.gain.setValueAtTime(vol, t + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
}

/** Guitare « twang » : corde pincée, brillante, qui glisse un peu vers la note. */
function twang(freq, at = 0, vol = 0.07, dur = 1.2) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const fl = a.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.setValueAtTime(4200, t);
  fl.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fl.connect(g).connect(master);
  for (const [type, m, v] of [['sawtooth', 1, 1], ['triangle', 2, 0.5]]) {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq * m * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(freq * m, t + 0.06);
    const og = a.createGain();
    og.gain.value = v;
    o.connect(og).connect(fl);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** Harmonica : anche un peu nasillarde (dents de scie filtrées) et vibrato. */
function harmonica(freq, at, dur, vol = 0.05, bend = null) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const fl = a.createBiquadFilter();
  fl.type = 'bandpass';
  fl.frequency.value = freq * 2.2;
  fl.Q.value = 1.2;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fl.connect(g).connect(master);
  const lfo = a.createOscillator();
  lfo.frequency.value = 5;
  const depth = a.createGain();
  depth.gain.value = freq * 0.012;
  lfo.connect(depth);
  for (const det of [-6, 6]) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(bend, t + dur);
    o.detune.value = det;
    depth.connect(o.frequency);
    o.connect(fl);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
}

/** Vent du désert : souffle filtré qui monte et retombe. */
function desertWind(at = 0, dur = 2.6, vol = 0.12) {
  noiseSweep({ at, dur, f: [260, 900, 380], q: 7, vol, peak: 0.45 });
  noiseSweep({ at: at + 0.4, dur: dur * 0.8, f: [500, 1300, 600], q: 9, vol: vol * 0.5, peak: 0.5 });
}

const western = {
  move: () => boot(),
  // Le coup de feu (au moment où l'éclair du canon apparaît), parfois un ricochet, puis la douille
  capture: () => {
    // La prise : réglée au même niveau que les prises des autres packs (mesuré), le BANG de fin reste plus fort
    gunshot(0.1, 0.3);
    if (Math.random() < 0.35) ricochet(0.2, 0.5);
    shell(0.45, 0.6);
  },
  castle: () => {
    boot(0);
    boot(0.16, { pitch: 0.92, spur: false });
  },
  promote: () => {
    boot(0, { spur: false });
    whistle(1760, 0.08, 0.16, 0.04, 1300);
    whistle(2350, 0.26, 0.35, 0.045, 1760);
  },
  check: () => hammer(0.06),
};

/**
 * Mat « Règlement de comptes ». Victoire : on arme le chien, BANG (avec ricochet), la douille tombe,
 * puis un sifflement de western sur une guitare « twang ». Défaite : BANG, le vent du désert et un harmonica triste.
 */
function westernMate(outcome) {
  hammer(0.18);
  gunshot(1.0, 1.1);
  shell(1.5);
  if (outcome === 'loss') {
    desertWind(1.3, 3.2, 0.11);
    [[392, 0.7], [349.2, 0.6], [293.7, 0.6], [261.6, 1.5, 246.9]].reduce((t, [f, d, b]) => {
      harmonica(f, t, d, 0.045, b || null);
      return t + d * 0.92;
    }, 1.9);
    twang(98, 1.9, 0.06, 2.4);
    return;
  }
  ricochet(1.12);
  // Sifflement : petite mélodie en la mineur qui finit en majeur, sur des accords de guitare
  [[880, 0.22], [1174.7, 0.22], [880, 0.22], [1174.7, 0.5], [1318.5, 0.3], [1108.7, 0.9]].reduce((t, [f, d]) => {
    whistle(f, t, d, 0.05);
    return t + d + 0.03;
  }, 1.75);
  twang(110, 1.7, 0.07, 1.4);
  twang(164.8, 1.72, 0.05, 1.3);
  twang(146.8, 2.45, 0.07, 1.3);
  twang(110, 3.15, 0.08, 2.2);
  twang(138.6, 3.17, 0.06, 2.1);
  twang(164.8, 3.19, 0.05, 2.0);
}

// --- Sons « Océan » : sous l'eau (bulles, tourbillon, battements graves, baleine) ----------------
let seaBus = null;
/** Sortie « sous l'eau » : un peu étouffée, avec un écho qui se répète (créée une seule fois). */
function sea() {
  const a = audio();
  if (!a) return null;
  if (!seaBus) {
    seaBus = a.createGain();
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const delay = a.createDelay();
    delay.delayTime.value = 0.22;
    const fb = a.createGain();
    fb.gain.value = 0.36;
    const wet = a.createGain();
    wet.gain.value = 0.32;
    seaBus.connect(lp);
    lp.connect(master);
    lp.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);
  }
  return a;
}
/** Note douce envoyée sous l'eau. */
function seaTone(type, f0, f1, at, dur, vol, attack = 0.01) {
  const a = sea();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(seaBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
const bubble = (at, f = 500, vol = 0.12) => seaTone('sine', f, f * 2.4, at, 0.09, vol, 0.005);
const bubbles = (at, n = 8, span = 0.8, vol = 0.1) => {
  for (let i = 0; i < n; i++) bubble(at + Math.random() * span, 380 + Math.random() * 720, vol * (0.5 + Math.random() * 0.5));
};
/** « Bloup » : une pièce posée sous l'eau. */
const bloop = (at = 0, pitch = 1) => {
  seaTone('sine', 260 * pitch, 120 * pitch, at, 0.16, 0.34, 0.005);
  bubble(at + 0.05, 700 * pitch, 0.06);
};
/** L'eau qui tourbillonne et s'engouffre (bruit qui boucle, filtre qui descend). */
function swirl(at = 0, dur = 1.1, vol = 0.32) {
  const a = sea();
  if (!a) return;
  const t = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = a.createBiquadFilter();
  fl.type = 'bandpass';
  fl.Q.value = 2.2;
  fl.frequency.setValueAtTime(1500, t);
  fl.frequency.exponentialRampToValueAtTime(200, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl).connect(g).connect(seaBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}
const thump = (at = 0, vol = 0.55) => seaTone('sine', 90, 38, at, 0.45, vol, 0.005);
const heartbeat = (at = 0) => {
  thump(at, 0.5);
  thump(at + 0.24, 0.38);
};
/** Chant de baleine : deux longues plaintes qui glissent, avec un léger vibrato. */
function whale(at = 0, vol = 0.15) {
  const a = sea();
  if (!a) return;
  for (const [d, f0, f1, f2, len] of [[0, 220, 470, 300, 2.4], [1.9, 330, 260, 410, 2]]) {
    const t = a.currentTime + at + d;
    const o = a.createOscillator();
    const g = a.createGain();
    const lfo = a.createOscillator();
    const lg = a.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.45);
    o.frequency.exponentialRampToValueAtTime(f2, t + len);
    lfo.frequency.value = 5.5;
    lg.gain.value = 7;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + len * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(seaBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + len + 0.05);
    lfo.stop(t + len + 0.05);
  }
}
/** Notes cristallines qui montent (la nacre). */
const chimes = (at = 0, n = 6) =>
  [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].slice(0, n).forEach((f, i) => {
    seaTone('sine', f, f, at + i * 0.11, 1.6, 0.07);
    seaTone('triangle', f * 2, f * 2, at + i * 0.11, 0.6, 0.02);
  });
/** Grondement des profondeurs qui descend. */
function drone(at = 0, dur = 3.5, vol = 0.18) {
  const a = sea();
  if (!a) return;
  const t = a.currentTime + at;
  for (const det of [0, 7]) {
    const o = a.createOscillator();
    const fl = a.createBiquadFilter();
    const g = a.createGain();
    o.type = 'sawtooth';
    o.detune.value = det;
    o.frequency.setValueAtTime(98, t);
    o.frequency.exponentialRampToValueAtTime(41, t + dur);
    fl.type = 'lowpass';
    fl.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl).connect(g).connect(seaBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
const ocean = {
  move: () => bloop(),
  capture: () => {
    swirl(0, 1.1);
    bubbles(0.3, 6, 0.7, 0.08);
    bloop(0.62, 0.9);
  },
  castle: () => {
    bloop(0);
    bloop(0.15, 0.9);
  },
  promote: () => {
    bloop(0);
    chimes(0.08, 4);
  },
  check: () => heartbeat(0.05),
};
/** Grondement du kraken : une voix grave qui ondule, filtrée pour s'entendre aussi sur un petit haut-parleur. */
function krakenGroan(at = 0, dur = 2.2) {
  const a = sea();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(62, t);
  o.frequency.linearRampToValueAtTime(48, t + dur);
  const lfo = a.createOscillator();
  const lg = a.createGain();
  lfo.frequency.value = 5.5;
  lg.gain.value = 4;
  lfo.connect(lg).connect(o.frequency);
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2.2;
  f.frequency.setValueAtTime(380, t);
  f.frequency.linearRampToValueAtTime(620, t + dur * 0.4);
  f.frequency.linearRampToValueAtTime(300, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.35);
  g.gain.setValueAtTime(0.32, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(seaBus);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}
/** Mat « Les Abysses ». Victoire : notes de nacre, chant de baleine, bulles. Défaite : grondement, cœur qui bat, bulles lentes. */
function oceanMate(outcome) {
  if (outcome === 'loss') {
    thump(0.3, 0.6);
    drone(0.3, 4.5);
    // Le noir se referme : deux notes graves et tristes qui descendent (ré, la bémol : un triton)
    seaTone('triangle', 293.7, 277.2, 0.35, 2.2, 0.09, 0.08);
    seaTone('triangle', 207.7, 196, 0.5, 2.4, 0.08, 0.1);
    // L'œil du kraken s'ouvre : grondement qu'on entend (des harmoniques, pas seulement des basses)
    krakenGroan(0.9);
    heartbeat(1.2);
    heartbeat(2.0);
    // Les tentacules : remous, puis le roi est entraîné vers le fond (glissando grave et bulles)
    swirl(2.0, 1.4, 0.26);
    seaTone('sine', 330, 82, 2.4, 1.8, 0.1, 0.05);
    bubbles(2.5, 12, 2, 0.09);
    heartbeat(3.0);
    return;
  }
  chimes(0.4);
  whale(0.8);
  bubbles(0.9, 14, 2.5, 0.08);
}

const royalSet = { move: () => tok(), capture, castle, promote, check };
const SETS = { astrea: space, classic, royal: royalSet, japon: sakura, western, ocean };
const MATES = { astrea: spaceMate, classic: classicMate, royal: royalMate, japon: sakuraMate, western: westernMate, ocean: oceanMate };

/**
 * Son d'un coup (objet « verbose » de chess.js).
 * outcome : 'win' | 'loss' | 'neutral', utilisé pour l'échec et mat.
 * style : { capture, endAnim } pour forcer un jeu de sons (aperçus de l'inventaire) ; sinon l'équipement du joueur.
 */
export function playSound(move, outcome = 'neutral', style = null) {
  if (!move || muted) return;
  const eq = { ...getEquip(), ...(style || {}) };
  const set = SETS[eq.capture] || space;
  if (move.san.includes('#')) {
    if (move.captured) set.capture();
    else set.move();
    (MATES[eq.endAnim] || spaceMate)(outcome);
    return;
  }
  if (move.captured) set.capture();
  else if (move.san.startsWith('O-O')) set.castle();
  else if (move.promotion) set.promote();
  else set.move();
  if (move.san.includes('+')) set.check();
}

/**
 * Petit son de notification : défi reçu (« invite »), demande d'ami (« request »), revanche proposée (« rematch »).
 * Deux ou trois notes claires, comme une clochette.
 */
export function notifySound(kind = 'invite') {
  if (muted) return;
  const notes = kind === 'rematch' ? [784, 988, 1319] : kind === 'request' ? [1047, 1319] : [880, 1175];
  notes.forEach((f, i) => {
    tone({ freq: f, type: 'triangle', at: i * 0.11, dur: 0.38, vol: 0.12, attack: 0.006 });
    tone({ freq: f * 2, type: 'sine', at: i * 0.11, dur: 0.22, vol: 0.03, attack: 0.004 });
  });
}

/** Petit bip quand il reste peu de temps. */
export function lowTimeBeep() {
  tone({ freq: 1760, type: 'square', dur: 0.06, vol: 0.04 });
}

// --- Coffre (page « Mes box ») : arrivée, coups de suspense, ouverture, révélation ---------
// Un coffre de bois cerclé de fer : sons de bois sourds, ferrures qui tintent, grincement des charnières.
// Les raretés montent comme une gamme : chaque palier rejoue un accord plus haut et plus large.
// Accords des raretés, dans la tonalité de la musique (ré mineur) : Fa, La, Si♭, puis Ré majeur (triomphe)
const TIER_ROOT = { commun: 349.23, rare: 440, epique: 466.16, jeu: 587.33 };
const TIER_LEVEL = { commun: 0, rare: 1, epique: 2, jeu: 3 };

/** Choc de bois sourd (le coffre qu'on pose, qu'on frappe). */
function woodThud(at = 0, vol = 1, pitch = 1) {
  burst({ at, dur: 0.09, vol: 0.32 * vol, type: 'lowpass', freq: 520 * pitch, q: 0.9 });
  burst({ at, dur: 0.035, vol: 0.14 * vol, freq: 1100 * pitch, q: 2.5 });
  tone({ freq: 105 * pitch, endFreq: 58 * pitch, at, dur: 0.22, vol: 0.3 * vol });
}
/** Ferrures qui tintent (petits partiels métalliques, discrets). */
function ironRattle(at = 0, vol = 1) {
  [1240, 1790, 2630].forEach((f, i) => tone({ freq: f * (0.97 + Math.random() * 0.06), type: 'sine', at: at + i * 0.012, dur: 0.16 - i * 0.03, vol: 0.018 * vol, attack: 0.002 }));
}
/** Grincement de charnière : une dent de scie filtrée qui glisse. */
function creak(at = 0, dur = 0.5, vol = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t);
  o.frequency.linearRampToValueAtTime(130, t + dur * 0.6);
  o.frequency.linearRampToValueAtTime(95, t + dur);
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 6;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.05);
  g.gain.setValueAtTime(0.05 * vol, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/**
 * Pendant qu'on attend de frapper : la gemme scintille de temps en temps, quelques notes cristallines et douces
 * (gamme pentatonique, avec un léger écho), très discrètes. Plus la rareté monte, plus c'est aigu et fréquent.
 * Renvoie de quoi l'arrêter.
 */
function boxHum(level = 0) {
  if (!audio()) return () => {};
  const scale = [0, 3, 5, 7, 10, 12, 15]; // ré mineur pentatonique (comme la musique)
  const base = 587.33 * Math.pow(2, (level >= 2 ? 12 : 0) / 12);
  let timer = 0;
  let stopped = false;
  const twinkle = () => {
    if (stopped) return;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const f = base * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
      const at = k * 0.13;
      tone({ freq: f, type: 'sine', at, dur: 1.1, vol: 0.009, attack: 0.03 });
      tone({ freq: f * 2.01, type: 'sine', at, dur: 0.5, vol: 0.003, attack: 0.02 });
      tone({ freq: f, type: 'sine', at: at + 0.22, dur: 0.9, vol: 0.004, attack: 0.03 }); // écho
    }
    timer = setTimeout(twinkle, (1500 + Math.random() * 1600) / (1 + level * 0.35));
  };
  timer = setTimeout(twinkle, 500);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
export const boxSfx = {
  hum: boxHum,
  /** Un coup sur le coffre (n : 0, 1, 2… un peu plus fort et plus aigu). */
  hit(n = 0) {
    const p = 1 + n * 0.07;
    woodThud(0, 0.85 + n * 0.08, p);
    ironRattle(0.03, 0.9 + n * 0.15);
    // Une petite note claire qui monte à chaque coup : on sent que ça approche
    tone({ freq: 587.33 * Math.pow(2, [0, 3, 5, 7, 10, 12][Math.min(5, n)] / 12), type: 'triangle', at: 0.04, dur: 0.35, vol: 0.03, attack: 0.008 });
  },
  /** La rareté monte d'un cran : montée douce, puis accord. */
  tierUp(tier) {
    const lvl = TIER_LEVEL[tier] || 0;
    const r = TIER_ROOT[tier] || 392;
    noiseSweep({ at: 0, dur: 0.45, type: 'bandpass', f: [600, 5000, 7000], q: 2, vol: 0.05 + lvl * 0.015, peak: 0.9 });
    [1, 1.25, 1.5, 2].forEach((m, i) => tone({ freq: r * m, type: 'triangle', at: 0.38 + i * 0.04, dur: 0.9, vol: 0.045, attack: 0.012 }));
    if (lvl >= 2) tone({ freq: 65, endFreq: 40, at: 0.38, dur: 0.8, vol: 0.3 });
    if (lvl >= 3) [2, 2.5, 3, 4].forEach((m, i) => bell(r * m, 0.45 + i * 0.07, 0.035));
  },
  /** Le couvercle s'ouvre : grincement, souffle de lumière, étincelles. */
  open(tier) {
    const lvl = TIER_LEVEL[tier] || 0;
    creak(0, 0.42, 0.9);
    woodThud(0.36, 0.7, 0.8);
    noiseSweep({ at: 0.1, dur: 0.9 + lvl * 0.2, type: 'bandpass', f: [400, 3800, 1500], q: 0.8, vol: 0.09 + lvl * 0.02, peak: 0.35 });
    tone({ freq: 80, endFreq: 36, at: 0.1, dur: 0.7 + lvl * 0.2, vol: 0.32 + lvl * 0.06 });
    const n = 5 + lvl * 4;
    for (let i = 0; i < n; i++) tone({ freq: 1600 + Math.random() * 2400, type: 'sine', at: 0.2 + Math.random() * (0.6 + lvl * 0.25), dur: 0.16, vol: 0.016 + Math.random() * 0.014 });
  },
  /** Accord tenu quand l'objet apparaît (plus riche selon la rareté). */
  reveal(tier, isNew = true) {
    const lvl = TIER_LEVEL[tier] || 0;
    const r = TIER_ROOT[tier] || 392;
    const chord = lvl >= 2 ? [1, 1.25, 1.5, 1.875, 2, 2.5] : lvl === 1 ? [1, 1.25, 1.5, 2] : [1, 1.5, 2];
    if (lvl >= 1) pad(chord.map((m) => (r * m) / 2), { at: 0, dur: 1.8 + lvl * 0.5, vol: 0.028 + lvl * 0.008, open: 2400 + lvl * 700 });
    chord.forEach((m, i) => tone({ freq: r * m, type: 'triangle', at: i * 0.06, dur: 1.2 + lvl * 0.3, vol: 0.04, attack: 0.012 }));
    if (isNew) [2, 2.5, 3, 4, 5].slice(0, 2 + lvl).forEach((m, i) => bell(r * m, 0.35 + i * 0.09, 0.035));
  },
  /** Doublon : la carte se change en poussière d'étoile. */
  dust(n = 1) {
    for (let i = 0; i < Math.min(12, 3 + n); i++) tone({ freq: 2200 + i * 180, type: 'sine', at: i * 0.05, dur: 0.12, vol: 0.022 });
    noiseSweep({ at: 0, dur: 0.6, type: 'highpass', f: [5000, 9000, 6000], q: 0.7, vol: 0.04, peak: 0.4 });
  },
  /** Petit clic quand on équipe. */
  thunk() {
    tok(0, 0.8);
  },
};

// --- Musique de fond des coffres --------------------------------------------------------------
// Composée à la volée (aucun fichier), en ré mineur, deux morceaux qui s'enchaînent en fondu :
//  - « attente » (calme, 72 à la noire) tant qu'on n'a pas frappé le coffre : nappe de cordes, basse, harpe en écho ;
//  - « combat » dès le premier coup : ostinato de cordes graves en doubles croches, tambours taiko, et de plus en
//    plus épique avec la rareté : caisse claire et nappe (rare), cuivres et chœur (épique), tempo qui s'emballe,
//    cymbales et mélodie de cuivres (jeu complet) ;
//  - à l'ouverture, retour à « attente », en majeur et plus riche pour les gros drops.
// On peut la couper (bouton 🎵). Le volume reste discret.
const MUSIC_PREF = 'roque:musique';
let musicOn = true;
try {
  musicOn = localStorage.getItem(MUSIC_PREF) !== 'off';
} catch {}
export const isMusicOn = () => musicOn;
export function setMusicOn(v) {
  musicOn = !!v;
  try {
    localStorage.setItem(MUSIC_PREF, musicOn ? 'on' : 'off');
  } catch {}
  if (!musicOn) boxMusic.stop(0.4);
}

/**
 * Débloque le son sur téléphone : à appeler pendant un toucher (un clic), avant toute attente. Sur iPhone, le son
 * ne démarre que dans le geste lui-même, et la musique doit passer même avec le bouton « silencieux ».
 */
export function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {}
  const a = audio();
  if (!a) return;
  // Un son vide, joué tout de suite : certains téléphones l'exigent pour ouvrir la sortie audio
  const b = a.createBuffer(1, 1, a.sampleRate);
  const s = a.createBufferSource();
  s.buffer = b;
  s.connect(a.destination);
  s.start(0);
  a.resume?.();
}

/**
 * Prépare le moteur de son et la musique à l'avance (page calme) : leur création prend un moment, qu'on ne veut
 * pas au moment où le joueur tape. Le son reste en pause jusqu'au premier geste (unlockAudio).
 */
export function warmAudio() {
  const a = audio();
  if (a) musicBus(a);
}

// Téléphones : musique plus légère à calculer (pas de réverbération, moins de voix), même règle que js/coffre3d.js
const LOW_POWER = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 760);
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const music = { bus: null, timer: 0, playing: false, next: 0, step: 0, level: 0, track: 'calm', bright: false, gains: {} };

/** Bus de la musique : sortie, réverbération légère (1,4 s, mono : peu coûteuse), écho de la harpe. */
function musicBus(a) {
  if (music.bus) return music.bus;
  const out = a.createGain();
  out.gain.value = 0;
  out.connect(master);
  const input = a.createGain();
  input.connect(out);
  if (!LOW_POWER) {
    const conv = a.createConvolver();
    const len = Math.floor(a.sampleRate * 1.4);
    const ir = a.createBuffer(1, len, a.sampleRate);
    const d = ir.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    conv.buffer = ir;
    const wet = a.createGain();
    wet.gain.value = 0.35;
    input.connect(conv).connect(wet).connect(out);
  }
  const delay = a.createDelay(1);
  delay.delayTime.value = 0.62;
  const fb = a.createGain();
  fb.gain.value = 0.3;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  delay.connect(lp).connect(fb).connect(delay);
  lp.connect(input);
  // Un gain par morceau, pour passer de l'un à l'autre en fondu
  for (const k of ['calm', 'battle']) {
    music.gains[k] = a.createGain();
    music.gains[k].gain.value = 0;
    music.gains[k].connect(input);
  }
  music.bus = { out, input, delay };
  return music.bus;
}
/** Une note, à l'instant absolu t. */
function mnote(a, dest, { freq, type = 'sine', t, dur, vol, attack = 0.01, release = 0.3, detune = 0, filter = 0, fenv = 0 }) {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.value = detune;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filter, t);
    if (fenv) {
      // Filtre qui s'ouvre puis se referme : le « wah » des cuivres
      f.frequency.exponentialRampToValueAtTime(fenv, t + 0.06);
      f.frequency.exponentialRampToValueAtTime(filter * 1.5, t + dur);
    }
    node = o.connect(f);
  }
  node.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}
/** Taiko : coup grave (pitch qui tombe) et peau (bruit filtré). */
function mtaiko(a, dest, t, vol, pitch = 1) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.setValueAtTime(120 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(45 * pitch, t + 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.5);
  mnoise(a, dest, t, { type: 'lowpass', freq: 900 * pitch, dur: 0.08, vol: vol * 0.5 });
}
function mnoise(a, dest, t, { type = 'highpass', freq = 6000, q = 0.8, dur = 0.08, vol = 0.02, swell = false }) {
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  if (swell) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// Morceau « attente » : 72 à la noire, Ré m – Si♭ – Fa – Do (deux mesures chacun)
const CALM = [
  { pad: [50, 53, 57, 62], bright: [50, 54, 57, 62], bass: 38, arp: [62, 65, 69, 74, 69, 65], arpB: [62, 66, 69, 74, 69, 66] },
  { pad: [46, 50, 53, 58], bass: 34, arp: [58, 62, 65, 70, 65, 62] },
  { pad: [45, 48, 53, 57], bass: 41, arp: [57, 60, 65, 69, 65, 60] },
  { pad: [45, 49, 52, 57], bass: 33, arp: [57, 61, 64, 69, 64, 61] }, // La (dominante) : ça appelle la suite
];
function calmStep(a, t, s, dest) {
  const lvl = music.level;
  const bright = music.bright;
  const sd = 60 / 72 / 4;
  const ch = CALM[Math.floor(s / 32) % CALM.length];
  const pad = bright && ch.bright ? ch.bright : ch.pad;
  const arp = bright && ch.arpB ? ch.arpB : ch.arp;
  if (s % 32 === 0) {
    const len = sd * 32 + 1;
    for (const m of LOW_POWER ? pad.slice(0, 3) : pad) mnote(a, dest, { freq: midi(m), type: 'sawtooth', t, dur: len, vol: 0.006, attack: 1.4, release: 1.2, filter: 750 + lvl * 300 });
    mnote(a, dest, { freq: midi(ch.bass), t, dur: len, vol: 0.05, attack: 0.4, release: 1 });
    if (lvl >= 2 || Math.random() < 0.4) {
      const bf = midi(arp[3] + 12);
      [1, 2.01, 2.76].forEach((m, i) => mnote(a, dest, { freq: bf * m, t, dur: 2 - i * 0.5, vol: 0.012 / (i + 1), attack: 0.003, release: 1.8 - i * 0.5 }));
    }
  }
  // Harpe en croches (doubles croches pour les gros drops), une partie dans l'écho
  const every = bright && lvl >= 2 ? 1 : 2;
  if (s % every === 0 && (lvl >= 1 || bright || Math.random() < (s % 4 === 0 ? 0.85 : 0.4))) {
    const f = midi(arp[(s / every) % arp.length] + (bright && lvl >= 2 && s % 4 === 2 ? 12 : 0));
    mnote(a, dest, { freq: f, type: 'triangle', t, dur: 0.85, vol: 0.02, attack: 0.004, release: 0.8 });
    if (s % 4 === 0) {
      const eg = a.createGain();
      eg.gain.value = 0.4;
      eg.connect(music.bus.delay);
      mnote(a, eg, { freq: f, type: 'triangle', t, dur: 0.4, vol: 0.02, attack: 0.004, release: 0.35 });
    }
  }
  if (bright && lvl >= 1 && s % 8 === 0) mtaiko(a, dest, t, 0.05 + lvl * 0.02, 0.8);
}

// Morceau « combat » : Ré m – Ré m – Si♭ – Do (une mesure chacun), ostinato de cordes graves
const BATTLE = [
  { root: 38, pad: [50, 53, 57], brass: [62, 65, 69] },
  { root: 38, pad: [50, 53, 57], brass: [62, 65, 69] },
  { root: 34, pad: [46, 50, 53], brass: [58, 62, 65] },
  { root: 36, pad: [48, 52, 55], brass: [60, 64, 67] },
];
const OSTINATO = [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 7, 10];
const MELODY = [74, 72, 70, 69, 70, 72, 74, 77]; // cuivres du jeu complet, une note par temps sur deux mesures
function battleStep(a, t, s, dest) {
  const lvl = music.level;
  const sd = 60 / music.bpm / 4;
  const bar = Math.floor(s / 16);
  const ch = BATTLE[bar % BATTLE.length];
  const i = s % 16;
  // Ostinato (toujours) ; doublé à l'octave à partir d'épique
  const accent = i % 4 === 0 ? 1.4 : 1;
  mnote(a, dest, { freq: midi(ch.root + OSTINATO[i]), type: 'sawtooth', t, dur: sd * 0.9, vol: 0.022 * accent, attack: 0.004, release: sd * 0.6, filter: 900 + lvl * 350 });
  if (lvl >= 2 && !LOW_POWER) mnote(a, dest, { freq: midi(ch.root + 12 + OSTINATO[i]), type: 'sawtooth', t, dur: sd * 0.8, vol: 0.01 * accent, attack: 0.004, release: sd * 0.5, filter: 1600 });
  // Taikos : la pulsation, de plus en plus chargée
  const taiko = lvl === 0 ? [0, 8] : lvl === 1 ? [0, 6, 8, 11] : [0, 3, 6, 8, 10, 11, 14];
  if (taiko.includes(i)) mtaiko(a, dest, t, (i === 0 ? 0.16 : 0.1) + lvl * 0.02, i % 8 === 0 ? 0.85 : 1.1);
  // Caisse claire (rare et plus)
  if (lvl >= 1 && (i === 4 || i === 12)) mnoise(a, dest, t, { type: 'bandpass', freq: 1800, q: 0.7, dur: 0.14, vol: 0.05 + lvl * 0.01 });
  // Nappe de cordes (rare et plus)
  if (lvl >= 1 && i === 0) for (const m of ch.pad) mnote(a, dest, { freq: midi(m), type: 'sawtooth', t, dur: sd * 16 + 0.3, vol: 0.006 + lvl * 0.002, attack: 0.3, release: 0.4, filter: 900 + lvl * 300 });
  // Cuivres en accords sur les temps forts, et chœur « aah » (épique et plus)
  if (lvl >= 2 && (i === 0 || i === 10)) {
    for (const m of ch.brass) mnote(a, dest, { freq: midi(m - 12), type: 'sawtooth', t, dur: i === 0 ? 0.55 : 0.3, vol: 0.016, attack: 0.02, release: 0.2, filter: 500, fenv: 2600 + lvl * 400 });
  }
  if (lvl >= 2 && i === 0 && !LOW_POWER) {
    for (const m of ch.pad) {
      const f = a.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 800;
      f.Q.value = 1.5;
      f.connect(dest);
      mnote(a, f, { freq: midi(m + 12), type: 'sawtooth', t, dur: sd * 16 + 0.4, vol: 0.02, attack: 0.5, release: 0.5, detune: (Math.random() - 0.5) * 14 });
    }
  }
  // Jeu complet : charleston en doubles croches, cymbale qui monte, mélodie de cuivres
  if (lvl >= 3) {
    if (!LOW_POWER || i % 2 === 0) mnoise(a, dest, t, { freq: 8000, dur: 0.04, vol: i % 2 ? 0.006 : 0.012 });
    if (i === 0 && bar % 2 === 1) mnoise(a, dest, t, { freq: 5000, dur: sd * 16, vol: 0.05, swell: true });
    if (i % 4 === 0) {
      const n = MELODY[((bar % 2) * 4 + i / 4) % MELODY.length];
      mnote(a, dest, { freq: midi(n), type: 'sawtooth', t, dur: sd * 3.6, vol: 0.016, attack: 0.03, release: 0.25, filter: 700, fenv: 3200 });
    }
  }
}
const TRACKS = { calm: calmStep, battle: battleStep };
const bpmFor = () => (music.track === 'calm' ? 72 : [96, 104, 112, 124][music.level]);

function fadeTrack(a, name, to, time = 0.6) {
  const g = music.gains[name].gain;
  const now = a.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.exponentialRampToValueAtTime(Math.max(to, 0.0001), now + time);
}
/** Passe à un morceau (fondu croisé), en recommençant au début d'une mesure. */
function switchTrack(name) {
  const a = audio();
  if (!a || !music.bus) return;
  if (music.track !== name) {
    fadeTrack(a, music.track, 0, 0.5);
    music.track = name;
    music.step = 0;
    music.next = a.currentTime + 0.06;
  }
  fadeTrack(a, name, 1, 0.4);
}
function stopMusicNow() {
  if (typeof music === 'undefined') return;
  music.playing = false;
  clearInterval(music.timer);
  music.bus = null;
  music.gains = {};
}
export const boxMusic = {
  /** Morceau « attente » (calme). À appeler dans le geste de l'utilisateur (le clic sur « Ouvrir »). */
  start() {
    music.level = 0;
    music.bright = false;
    if (!musicOn) return;
    const a = audio();
    if (!a) return;
    const bus = musicBus(a);
    const now = a.currentTime;
    bus.out.gain.cancelScheduledValues(now);
    bus.out.gain.setValueAtTime(Math.max(bus.out.gain.value, 0.0001), now);
    bus.out.gain.exponentialRampToValueAtTime(0.6, now + 1.5);
    if (!music.playing) {
      music.playing = true;
      fadeTrack(a, 'battle', 0, 0.05);
      music.track = 'calm';
      music.step = 0;
      music.next = now + 0.1;
      clearInterval(music.timer);
      music.timer = setInterval(() => {
        if (!music.playing) return;
        // Programme les doubles croches qui tombent dans les 0,3 prochaines secondes
        while (music.next < a.currentTime + 0.3) {
          music.bpm = bpmFor();
          TRACKS[music.track](a, music.next, music.step, music.gains[music.track]);
          music.next += 60 / music.bpm / 4;
          music.step++;
        }
      }, 70);
    }
    switchTrack('calm');
  },
  /** Premier coup sur le coffre : place au morceau épique. */
  battle() {
    if (music.playing) switchTrack('battle');
  },
  /** Intensité selon la rareté (0 commun … 3 jeu complet). */
  setLevel(n) {
    music.level = Math.max(0, Math.min(3, n));
  },
  /** Le coffre s'ouvre : retour au calme, en majeur et plus riche pour un gros drop. */
  resolve(n) {
    if (!music.playing) return;
    music.level = Math.max(0, Math.min(3, n));
    music.bright = n >= 1;
    switchTrack('calm');
  },
  /** Coupe la musique en fondu. */
  stop(fade = 1.2) {
    if (!music.playing || !music.bus || !ctx) return;
    const now = ctx.currentTime;
    const g = music.bus.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.exponentialRampToValueAtTime(0.0001, now + fade);
    music.playing = false;
    clearInterval(music.timer);
  },
};
