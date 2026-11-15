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
}

// Royal : garde les sons d'origine (avant Astrea « espace ») pour les coups, prises et échecs
const royalSet = { move: () => tok(), capture, castle, promote, check };
const SETS = { astrea: space, classic, royal: royalSet };
const MATES = { astrea: spaceMate, classic: classicMate, royal: royalMate };

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
