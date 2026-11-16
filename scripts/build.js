// Construit le site statique dans dist/ : les pages de public/ + les bibliothèques nécessaires.
// C'est ce dossier que GitHub Pages publie (npm run deploy l'envoie sur la branche gh-pages).
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
// Pièces classiques « cburnett » (Chessground, GPL) pour le pack « Classic chess » de l'inventaire.
// Le fichier d'origine pose les images directement sur les pièces ; on le transforme en variables
// (--p-wP, --p-bK…) rangées sous .pieces-classic, pour que chaque joueur choisisse ses pièces.
{
  const src = fs.readFileSync(nm('@lichess-org/chessground/assets/chessground.cburnett.css'), 'utf8');
  const ROLE = { pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' };
  // Les images sont rangées une fois dans --cl-wP… ; .pieces-classic (tout le jeu) et .pc-N-classic (une seule
  // pièce, classe doublée pour passer devant le jeu de base) s'en servent
  const vars = [];
  const use = [];
  const one = {};
  for (const m of src.matchAll(/\.cg-wrap piece\.(\w+)\.(white|black)\s*\{\s*background-image:\s*(url\([^)]*\))/g)) {
    const k = `${m[2][0]}${ROLE[m[1]]}`;
    vars.push(`  --cl-${k}: ${m[3]};`);
    use.push(`  --p-${k}: var(--cl-${k});`);
    (one[ROLE[m[1]]] ||= []).push(`--p-${k}: var(--cl-${k});`);
  }
  if (vars.length !== 12) throw new Error(`cburnett : ${vars.length} pièces trouvées au lieu de 12`);
  const pc = Object.entries(one).map(([t, d]) => `.pc-${t}-classic.pc-${t}-classic { ${d.join(' ')} }`).join('\n');
  const dest = path.join(dist, 'vendor/chessground-assets/chessground.cburnett.css');
  fs.writeFileSync(dest, `/* Pièces « cburnett » de Chessground (lichess, licence GPL), transformées pour ROOOK par scripts/build.js */\n:root {\n${vars.join('\n')}\n}\n.pieces-classic {\n${use.join('\n')}\n}\n${pc}\n`);
}
// Licence du moteur (GPL) distribuée avec lui
fs.copyFileSync(nm('stockfish/Copying.txt'), path.join(dist, 'vendor/stockfish/LICENCE.txt'));
// GitHub Pages : pas de traitement Jekyll
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

// Numéro de version sur chaque script et feuille de style (« ?v=… »), différent à chaque construction.
// Sans ça, un navigateur peut garder d'anciens fichiers en cache (10 min sur GitHub Pages) et mélanger
// une nouvelle page avec d'anciens scripts : la page plante au démarrage.
let commit = 'dev';
try {
  commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch {}
const version = `${commit}-${Date.now().toString(36)}`;
const tag = (url) => `${url}?v=${version}`;
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
let tagged = 0;
for (const file of walk(dist)) {
  const isHtml = file.endsWith('.html');
  const isOurJs = file.endsWith('.js') && file.startsWith(path.join(dist, 'js'));
  if (!isHtml && !isOurJs) continue;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  if (isHtml) src = src.replace(/(src|href)="((?:js|css|vendor)\/[^"?]+\.(?:js|css))"/g, (m, attr, url) => `${attr}="${tag(url)}"`);
  // imports de modules : from './x.js', import('./x.js') (y compris le script de connexion.html)
  src = src.replace(/(from\s*|import\s*\(|import\s+)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g, (m, kw, q, url) => `${kw}${q}${tag(url)}${q}`);
  if (src !== before) {
    fs.writeFileSync(file, src);
    tagged++;
  }
}
console.log(`Version ${version} ajoutée aux scripts de ${tagged} fichiers`);

// Images : une empreinte de leur contenu (« ?h=… »). Une image modifiée (ex. nouvelles couleurs des pièces) change
// d'adresse et le navigateur la télécharge à nouveau ; les autres restent en cache.
const crypto = require('crypto');
const imgHash = {};
const hashOf = (rel) => {
  if (!(rel in imgHash)) {
    const f = path.join(dist, rel);
    imgHash[rel] = fs.existsSync(f) ? crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 10) : null;
  }
  return imgHash[rel];
};
let imgTagged = 0;
for (const file of walk(dist)) {
  const isCss = file.endsWith('.css') && file.startsWith(path.join(dist, 'css'));
  const isOurJs = file.endsWith('.js') && file.startsWith(path.join(dist, 'js'));
  const isHtml = file.endsWith('.html');
  if (!isCss && !isOurJs && !isHtml) continue;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  // url('../img/x.svg') dans le CSS ; "img/x.svg" écrit en clair dans le HTML et les scripts
  src = src.replace(/(['"(])((?:\.\.\/)?img\/[^'"()?$`]+\.(?:svg|png|jpe?g|webp|gif))(?=['")])/g, (m, q, url) => {
    const h = hashOf(url.replace(/^\.\.\//, ''));
    return h ? `${q}${url}?h=${h}` : m;
  });
  if (src !== before) {
    fs.writeFileSync(file, src);
    imgTagged++;
  }
}
console.log(`Empreinte ajoutée aux images de ${imgTagged} fichiers`);

// Mise à jour automatique : GitHub Pages laisse le navigateur garder une page 10 minutes.
// Chaque page compare sa version à version.json (jamais en cache) et se recharge une fois si le site a changé.
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({ v: version }));
const updater = `<script>
(function () {
  var v = '${version}';
  // Après une mise à jour, on retire le petit paramètre « maj » de l'adresse
  try {
    var here = new URL(location.href);
    if (here.searchParams.has('maj')) { here.searchParams.delete('maj'); history.replaceState(history.state, '', here.toString()); }
  } catch (e) {}
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
    if (!d || d.v === v) return;
    var key = 'roook-maj-' + d.v;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) { return; }
    // Recharge vers une adresse neuve (?maj=…) : le navigateur ne peut pas resservir l'ancienne page de son cache
    try {
      var u = new URL(location.href);
      u.searchParams.set('maj', d.v);
      location.replace(u.toString());
    } catch (e) { location.reload(); }
  }).catch(function () {});
})();
</script>`;
for (const file of fs.readdirSync(dist).filter((f) => f.endsWith('.html'))) {
  const p = path.join(dist, file);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('</head>', `${updater}\n</head>`));
}

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Site construit dans dist/ (${(size(dist) / 1e6).toFixed(1)} Mo)`);
