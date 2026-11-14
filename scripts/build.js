// Construit le site statique dans dist/ : les pages de public/ + les bibliothèques nécessaires.
// C'est ce dossier que GitHub Pages publie (voir .github/workflows/pages.yml).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const nm = (p) => path.join(root, 'node_modules', p);

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });

const copies = [
  [nm('chess.js/dist/esm/chess.js'), 'vendor/chess.js/chess.js'],
  [nm('@lichess-org/chessground/dist/chessground.min.js'), 'vendor/chessground/chessground.min.js'],
  [nm('@lichess-org/chessground/assets/chessground.base.css'), 'vendor/chessground-assets/chessground.base.css'],
  [nm('stockfish/bin/stockfish-19-lite-single.js'), 'vendor/stockfish/stockfish-19-lite-single.js'],
  [nm('stockfish/bin/stockfish-19-lite-single.wasm'), 'vendor/stockfish/stockfish-19-lite-single.wasm'],
];
for (const [from, to] of copies) {
  const dest = path.join(dist, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(from, dest);
}
// Licence du moteur (GPL) distribuée avec lui
fs.copyFileSync(nm('stockfish/Copying.txt'), path.join(dist, 'vendor/stockfish/LICENCE.txt'));
// GitHub Pages : pas de traitement Jekyll
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Site construit dans dist/ (${(size(dist) / 1e6).toFixed(1)} Mo)`);
