// Petite surcouche autour de Stockfish (WebAssembly), qui tourne dans le navigateur.
import { Chess } from '../vendor/chess.js/chess.js';

const ENGINE_URL = 'vendor/stockfish/stockfish-19-lite-single.js';

// Niveaux de l'IA : de très faible à la force maximale de Stockfish.
export const LEVELS = [
  { n: 1, name: 'Débutant', elo: '≈ 400', skill: 0, depth: 1, random: 0.35 },
  { n: 2, name: 'Novice', elo: '≈ 700', skill: 1, depth: 2, random: 0.18 },
  { n: 3, name: 'Amateur', elo: '≈ 1000', skill: 4, depth: 4, random: 0.06 },
  { n: 4, name: 'Joueur de club', elo: '≈ 1300', skill: 7, depth: 6, random: 0 },
  { n: 5, name: 'Confirmé', elo: '≈ 1600', skill: 10, depth: 8, random: 0 },
  { n: 6, name: 'Expert', elo: '≈ 1900', skill: 14, depth: 11, random: 0 },
  { n: 7, name: 'Maître', elo: '≈ 2300', skill: 18, movetime: 1000, random: 0 },
  { n: 8, name: 'Grand maître', elo: '3000+', skill: 20, movetime: 2000, random: 0 },
];

export class Engine {
  constructor() {
    this.worker = new Worker(ENGINE_URL);
    this.listeners = new Set();
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const l of [...this.listeners]) l(line);
    };
    this.queue = Promise.resolve();
    this.skill = null;
    this.ready = this._init();
  }

  send(cmd) {
    this.worker.postMessage(cmd);
  }

  _waitFor(pred, onLine) {
    return new Promise((resolve) => {
      const l = (line) => {
        if (onLine) onLine(line);
        if (pred(line)) {
          this.listeners.delete(l);
          resolve(line);
        }
      };
      this.listeners.add(l);
    });
  }

  async _init() {
    this.send('uci');
    await this._waitFor((l) => l === 'uciok');
    this.send('setoption name Hash value 32');
    this.send('isready');
    await this._waitFor((l) => l === 'readyok');
  }

  // Les recherches passent une par une dans une file d'attente.
  _run(fn) {
    const p = this.queue.then(() => this.ready).then(fn);
    this.queue = p.catch(() => {});
    return p;
  }

  newGame() {
    return this._run(async () => {
      this.send('ucinewgame');
      this.send('isready');
      await this._waitFor((l) => l === 'readyok');
    });
  }

  /**
   * Analyse une position.
   * Le score est donné du point de vue du camp qui doit jouer.
   * @returns {Promise<{bestmove: string|null, lines: {multipv:number, cp?:number, mate?:number, pv:string[], depth:number}[]}>}
   */
  analyse(fen, { depth, movetime, multipv = 1, skill = 20 } = {}) {
    if (!depth && !movetime) depth = 12;
    return this._run(async () => {
      if (this.skill !== skill) {
        this.send(`setoption name Skill Level value ${skill}`);
        this.skill = skill;
      }
      this.send(`setoption name MultiPV value ${multipv}`);
      this.send(`position fen ${fen}`);
      const lines = new Map();
      const onLine = (line) => {
        if (!line.startsWith('info ') || !line.includes(' pv ')) return;
        if (line.includes('lowerbound') || line.includes('upperbound')) return;
        const tok = line.split(' ');
        const get = (k) => tok[tok.indexOf(k) + 1];
        const mpv = tok.includes('multipv') ? Number(get('multipv')) : 1;
        const entry = { multipv: mpv, depth: Number(get('depth')), pv: tok.slice(tok.indexOf('pv') + 1) };
        const si = tok.indexOf('score');
        if (tok[si + 1] === 'cp') entry.cp = Number(tok[si + 2]);
        else entry.mate = Number(tok[si + 2]);
        lines.set(mpv, entry);
      };
      // Avec les deux limites, Stockfish s'arrête à la première atteinte
      this.send('go' + (depth ? ` depth ${depth}` : '') + (movetime ? ` movetime ${Math.round(movetime)}` : ''));
      const done = await this._waitFor((l) => l.startsWith('bestmove'), onLine);
      const bm = done.split(' ')[1];
      return {
        bestmove: bm && bm !== '(none)' ? bm : null,
        lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
      };
    });
  }

  /**
   * Choisit un coup pour l'IA au niveau demandé (objet de LEVELS).
   * maxTime : temps maximum de réflexion en ms (quand il y a une pendule).
   */
  async play(fen, level, maxTime) {
    const chess = new Chess(fen);
    const legal = chess.moves({ verbose: true });
    if (!legal.length) return null;
    if (level.random && Math.random() < level.random) {
      // Les petits niveaux jouent parfois un coup au hasard, comme un vrai débutant.
      const m = legal[Math.floor(Math.random() * legal.length)];
      await new Promise((r) => setTimeout(r, 250));
      return m.from + m.to + (m.promotion || '');
    }
    let movetime = level.movetime;
    if (maxTime) movetime = Math.min(movetime || Infinity, maxTime);
    const res = await this.analyse(fen, { depth: level.depth, movetime, skill: level.skill });
    return res.bestmove;
  }

  stop() {
    this.send('stop');
  }

  destroy() {
    this.worker.terminate();
  }
}

// --- Outils d'évaluation ---------------------------------------------------

/** Convertit un score (cp ou mat) en centipions, du point de vue des Blancs. */
export function toWhiteCp(line, turn) {
  if (!line) return 0;
  let cp = line.mate !== undefined ? (line.mate > 0 ? 10000 - line.mate : line.mate < 0 ? -10000 - line.mate : -10000) : line.cp;
  return turn === 'w' ? cp : -cp;
}

/** Probabilité de gain (0-100) pour les Blancs à partir des centipions (formule de Lichess). */
export function winPercent(cp) {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

export function formatEval(cp) {
  if (Math.abs(cp) >= 9000) {
    const n = 10000 - Math.abs(cp);
    return (cp > 0 ? '#' : '#-') + Math.max(n, 0);
  }
  const v = cp / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}
