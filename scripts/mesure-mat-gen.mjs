// Mesure le générateur « Mat à l'infini » (public/js/mat-gen.js) avec Stockfish lancé par Node :
// combien d'essais et de temps pour trouver un mat en 1, 2 ou 3, et quelques positions à regarder.
// Utilisation : node scripts/mesure-mat-gen.mjs [nombre par catégorie]
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Chess } from '../node_modules/chess.js/dist/esm/chess.js';

const src = readFileSync(new URL('../public/js/mat-gen.js', import.meta.url), 'utf8');
const { findMate } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const sf = spawn(process.execPath, [new URL('../node_modules/stockfish/bin/stockfish-19-lite-single.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')]);
let buf = '';
let waiter = null;
sf.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    waiter?.(line);
  }
});
const send = (s) => sf.stdin.write(s + '\n');
const until = (pred, onLine) => new Promise((res) => (waiter = (l) => (onLine?.(l), pred(l) && res(l))));
send('uci');
await until((l) => l === 'uciok');
send('setoption name Hash value 32');

async function analyse(fen, depth = 14) {
  let mate;
  send(`position fen ${fen}`);
  send(`go depth ${depth}`);
  await until((l) => l.startsWith('bestmove'), (l) => {
    const m = l.match(/ score mate (-?\d+)/);
    if (m && !l.includes('bound')) mate = Number(m[1]);
    else if (l.includes(' score cp ')) mate = undefined;
  });
  return { mate };
}

const N = Number(process.argv[2]) || 12;
for (const n of [1, 2, 3]) {
  let tries = 0;
  let found = 0;
  const t0 = Date.now();
  const samples = [];
  for (let k = 0; k < N; k++) {
    const r = await findMate(Chess, analyse, n, { maxTries: 1500 });
    if (!r) continue;
    found++;
    tries += r.tries;
    if (samples.length < 4) samples.push(r.fen);
  }
  const ms = Date.now() - t0;
  console.log(`Mat en ${n} : ${found}/${N} trouvés, ${(tries / Math.max(found, 1)).toFixed(0)} essais et ${(ms / Math.max(found, 1)).toFixed(0)} ms en moyenne`);
  for (const f of samples) console.log('   ', f);
}
sf.kill();
