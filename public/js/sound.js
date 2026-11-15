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
export function setMuted(v) {
  muted = !!v;
  try {
    localStorage.setItem('roque:son', muted ? 'off' : 'on');
  } catch {}
}

function audio() {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Un compresseur évite que les sons forts (mat) saturent
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
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
  out.gain.value = vol;
  out.connect(master);
  const send = canyon();
  if (send) {
    const s = a.createGain();
    s.gain.value = 0.9;
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
    gunshot(0.1);
    if (Math.random() < 0.35) ricochet(0.2);
    shell(0.45);
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
  gunshot(1.0, 1.2);
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

const royalSet = { move: () => tok(), capture, castle, promote, check };
const SETS = { astrea: space, classic, royal: royalSet, japon: sakura, western };
const MATES = { astrea: spaceMate, classic: classicMate, royal: royalMate, japon: sakuraMate, western: westernMate };

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

/** Petit bip quand il reste peu de temps. */
export function lowTimeBeep() {
  tone({ freq: 1760, type: 'square', dur: 0.06, vol: 0.04 });
}
