// Vérifie le contenu de la page « Apprendre » (public/js/apprendre-data.js) avec chess.js :
// chaque leçon et chaque exercice doit avoir une solution, et les coups prévus doivent être légaux.
// Utilisation : node scripts/verif-apprendre.mjs
import { Chess } from '../node_modules/chess.js/dist/esm/chess.js';
import { readFileSync } from 'node:fs';
// Le fichier de données est un module du navigateur : on le charge tel quel (le projet est en CommonJS).
const src = readFileSync(new URL('../public/js/apprendre-data.js', import.meta.url), 'utf8');
const { LESSONS, PUZZLES } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

let ok = 0;
let bad = 0;
const report = (good, label, extra = '') => {
  good ? ok++ : bad++;
  console.log(`${good ? '✔' : '✘'} ${label}${extra ? ' — ' + extra : ''}`);
};
const load = (fen) => new Chess(fen, { skipValidation: true });
const uci = (m) => m.from + m.to + (m.promotion || '');
/** Même position avec les Blancs (le joueur) au trait : les pièces noires ne bougent pas dans les leçons. */
const playerTurn = (c, color) => {
  const f = c.fen().split(' ');
  f[1] = color;
  f[3] = '-';
  return load(f.join(' '));
};
const allowed = (c, step) => c.moves({ verbose: true }).filter((m) => !step.only || step.only.includes(m.piece));

/** Leçons « targets » et « capture » : recherche en largeur jusqu'à avoir tout visité / tout pris. */
function solvable(step) {
  const color = step.fen.split(' ')[1];
  const startBlack = (c) => c.board().flat().filter((p) => p && p.color !== color).length;
  const key = (c, seen) => c.fen().split(' ')[0] + '|' + [...seen].sort().join(',');
  let frontier = [{ c: load(step.fen), seen: new Set(), n: 0 }];
  const visited = new Set();
  for (let depth = 0; depth < 10 && frontier.length; depth++) {
    const next = [];
    for (const { c, seen } of frontier) {
      for (const m of allowed(c, step)) {
        const d = load(c.fen());
        d.move(m);
        const s = new Set(seen);
        if (step.targets?.includes(m.to)) s.add(m.to);
        const done = step.goal === 'targets' ? s.size === step.targets.length : startBlack(d) === 0;
        if (done) return depth + 1;
        const e = playerTurn(d, color);
        const k = key(e, s);
        if (!visited.has(k)) {
          visited.add(k);
          next.push({ c: e, seen: s });
        }
      }
    }
    frontier = next;
  }
  return 0;
}

/** Position impossible : le camp qui ne joue pas est déjà en échec. */
function otherSideInCheck(fen) {
  const f = fen.split(' ');
  f[1] = f[1] === 'w' ? 'b' : 'w';
  f[3] = '-';
  const c = load(f.join(' '));
  return c.board().flat().some((p) => p && p.type === 'k' && p.color === f[1]) && c.inCheck();
}
for (const [label, fen] of [...LESSONS.flatMap((l) => l.steps.map((s, i) => [`Leçon ${l.title} ${i + 1}`, s.fen])), ...PUZZLES.map((p) => [`Exercice ${p.id}`, p.fen])]) {
  if (otherSideInCheck(fen)) report(false, label, 'le camp qui ne joue pas est déjà en échec');
}

const mates = (c) => c.moves({ verbose: true }).filter((m) => {
  const d = load(c.fen());
  d.move(m);
  return d.isCheckmate();
});
const stalemates = (c) => c.moves({ verbose: true }).filter((m) => {
  const d = load(c.fen());
  d.move(m);
  return d.isStalemate();
});
/** Coups qui mènent au mat en 2 (pour chaque réponse adverse, un mat existe). */
function mateIn2(c) {
  return c.moves({ verbose: true }).filter((m) => {
    const d = load(c.fen());
    d.move(m);
    if (d.isGameOver()) return d.isCheckmate();
    return d.moves({ verbose: true }).every((r) => {
      const e = load(d.fen());
      e.move(r);
      return mates(e).length > 0;
    });
  });
}
/** Coups qui empêchent le mat en 1 adverse. */
function defenses(c) {
  return c.moves({ verbose: true }).filter((m) => {
    const d = load(c.fen());
    d.move(m);
    return d.isCheckmate() || mates(d).length === 0;
  });
}

for (const l of LESSONS) {
  l.steps.forEach((s, i) => {
    const label = `Leçon ${l.title} ${i + 1}`;
    try {
      const c = load(s.fen);
      if (s.goal === 'targets' || s.goal === 'capture') {
        const n = solvable(s);
        report(n > 0, label, n ? `${n} coup(s)` : 'impossible');
      } else if (s.goal === 'move') {
        if (s.pre) c.move({ from: s.pre.slice(0, 2), to: s.pre.slice(2, 4) });
        const legal = s.moves.every((u) => c.moves({ verbose: true }).some((m) => uci(m) === u));
        report(legal, label, s.moves.join(','));
      } else if (s.goal === 'castle') {
        const ms = c.moves({ verbose: true }).filter((m) => m.flags.includes('k') || m.flags.includes('q'));
        report(ms.some((m) => m.flags.includes(s.side)), label, ms.map((m) => m.san).join(','));
      } else if (s.goal === 'promote') {
        report(solvable({ ...s, goal: 'targets', targets: [] }) >= 0 && c.moves({ verbose: true }).length > 0, label);
      } else if (s.goal === 'check') {
        const ms = c.moves({ verbose: true }).filter((m) => m.san.includes('+') || m.san.includes('#'));
        report(ms.length > 0, label, ms.map((m) => m.san).join(','));
      } else if (s.goal === 'escape') {
        const inCheck = c.inCheck();
        const ms = c.moves({ verbose: true });
        const fit = ms.filter((m) => (s.how === 'king' ? m.piece === 'k' : s.how === 'capture' ? !!m.captured : m.piece !== 'k' && !m.captured));
        report(inCheck && fit.length > 0, label, `${inCheck ? 'en échec' : 'PAS en échec'} ; ${fit.map((m) => m.san).join(',')}`);
      } else if (s.goal === 'mate') {
        const ms = mates(c);
        const st = stalemates(c);
        report(ms.length > 0, label, `mat : ${ms.map((m) => m.san).join(',')}${st.length ? ` ; pat : ${st.map((m) => m.san).join(',')}` : ''}`);
      } else report(false, label, 'objectif inconnu ' + s.goal);
    } catch (e) {
      report(false, label, e.message);
    }
  });
}

for (const p of PUZZLES) {
  const label = `Exercice ${p.id}`;
  try {
    const c = new Chess(p.fen); // les exercices sont des positions de vraie partie
    if (p.goal === 'mate1') {
      const ms = mates(c);
      report(ms.length > 0, label, ms.map((m) => m.san).join(','));
    } else if (p.goal === 'mate2') {
      const m1 = mates(c);
      const ms = mateIn2(c);
      report(m1.length === 0 && ms.length > 0, label, `mat en 1 : ${m1.length} ; premiers coups : ${ms.map((m) => m.san).join(',')}`);
    } else if (p.goal === 'defend') {
      // la menace existe : si l'adversaire jouait maintenant, il aurait un mat
      const f = c.fen().split(' ');
      f[1] = f[1] === 'w' ? 'b' : 'w';
      f[3] = '-';
      const threat = mates(new Chess(f.join(' ')));
      const ds = defenses(c);
      const all = c.moves().length;
      report(threat.length > 0 && ds.length > 0 && ds.length < all, label, `menace : ${threat.map((m) => m.san).join(',')} ; défenses ${ds.length}/${all} : ${ds.map((m) => m.san).join(',')}`);
    } else if (p.goal === 'line') {
      const sans = [];
      for (const u of p.line) {
        const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        sans.push(m.san);
      }
      const last = c.history({ verbose: true }).at(-1);
      report(!!last.captured, label, sans.join(' '));
    } else report(false, label, 'objectif inconnu ' + p.goal);
  } catch (e) {
    report(false, label, e.message);
  }
}
console.log(`\n${ok} bons, ${bad} à corriger`);
process.exit(bad ? 1 : 0);
