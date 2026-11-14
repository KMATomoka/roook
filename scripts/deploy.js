// Publie le site construit (dist/) sur la branche gh-pages, que GitHub Pages affiche.
// Utilisation : npm run deploy
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const run = (cmd, cwd = dist) => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim();
const commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();

run('git init -q -b gh-pages');
run('git add -A');
run(`git -c user.name="ROOOK" -c user.email="roook@users.noreply.github.com" commit -q -m "Publication du site (${commit})"`);
run(`git push -q -f ${remote} gh-pages`);
console.log('Site publié sur la branche gh-pages : https://kmatomoka.github.io/roook/ (en ligne dans une minute environ)');
