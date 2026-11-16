// Prépare la banque de « Problèmes » (public/data/problemes.json) à partir de la base ouverte de lichess
// (https://database.lichess.org/#puzzles, licence CC0 : domaine public).
// On ne lit que le début du fichier (il est mélangé), en continu, et on s'arrête dès que chaque tranche de
// classement est remplie. On ne garde que les problèmes fiables : très joués, bien notés, classement stable.
// Utilisation : node scripts/problemes.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { createZstdDecompress } from 'node:zlib';
import { Readable } from 'node:stream';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_DB = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const MIN = 400;
const MAX = 2800;
const STEP = 100; // tranches de 100 points
const PER = 170; // problèmes par tranche
const MAX_BYTES = 40 * 1024 * 1024; // jamais plus de 40 Mo compressés lus

// Thèmes gardés (les autres, trop techniques, sont ignorés)
const THEMES = new Set([
  'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mate', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck',
  'hangingPiece', 'trappedPiece', 'sacrifice', 'deflection', 'attraction', 'clearance', 'interference', 'xRayAttack',
  'backRankMate', 'smotheredMate', 'promotion', 'advancedPawn', 'quietMove', 'defensiveMove', 'zugzwang',
  'endgame', 'middlegame', 'opening', 'rookEndgame', 'pawnEndgame', 'queenEndgame', 'bishopEndgame', 'knightEndgame',
  'crushing', 'advantage', 'equality', 'oneMove', 'short', 'long', 'veryLong', 'kingsideAttack', 'queensideAttack', 'exposedKing',
]);

const buckets = new Map();
for (let r = MIN; r < MAX; r += STEP) buckets.set(r, []);
const full = () => [...buckets.values()].every((b) => b.length >= PER);

const res = await fetch(URL_DB);
if (!res.ok) throw new Error(`Téléchargement impossible : ${res.status}`);
let bytes = 0;
const counted = new TransformStream({
  transform(chunk, ctrl) {
    bytes += chunk.byteLength;
    ctrl.enqueue(chunk);
  },
});
const zstd = createZstdDecompress();
const text = Readable.fromWeb(res.body.pipeThrough(counted)).pipe(zstd).setEncoding('utf8');

let rest = '';
let lines = 0;
let kept = 0;
let header = true;
outer: for await (const chunk of text) {
  const parts = (rest + chunk).split('\n');
  rest = parts.pop();
  for (const line of parts) {
    if (header) {
      header = false;
      continue;
    }
    lines++;
    // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const [id, fen, moves, rating, dev, pop, plays, themes] = line.split(',');
    const r = Number(rating);
    if (!(r >= MIN && r < MAX) || Number(dev) > 85 || Number(pop) < 85 || Number(plays) < 800) continue;
    const mv = moves.split(' ');
    if (mv.length < 2 || mv.length > 10) continue;
    const b = buckets.get(Math.floor(r / STEP) * STEP);
    if (b.length >= PER) continue;
    b.push([id, fen, moves, r, themes.split(' ').filter((t) => THEMES.has(t)).join(' ')]);
    kept++;
    if (full()) break outer;
  }
  if (bytes > MAX_BYTES) break;
}
res.body.cancel?.().catch(() => {});

const all = [...buckets.values()].flat().sort((a, b) => a[3] - b[3]);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public/data/problemes.json');
mkdirSync(dirname(out), { recursive: true });
const json = JSON.stringify({
  source: 'Base ouverte des problèmes de lichess.org (CC0, domaine public) — https://database.lichess.org/#puzzles',
  format: ['id', 'fen', 'coups (uci ; le 1er est joué par l’adversaire)', 'classement', 'thèmes'],
  problemes: all,
});
writeFileSync(out, json + '\n');
const short = [...buckets.entries()].filter(([, b]) => b.length < PER).map(([r, b]) => `${r}:${b.length}`);
console.log(`${kept} problèmes gardés sur ${lines} lus (${(bytes / 1048576).toFixed(1)} Mo compressés lus), ${(json.length / 1024).toFixed(0)} Ko écrits dans public/data/problemes.json`);
if (short.length) console.log('Tranches incomplètes :', short.join(' '));
process.exit(0);
