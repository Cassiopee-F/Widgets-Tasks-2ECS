/**
 * Promotion Atlas : projects/Atlas -> published/atlas
 *
 * index_v7.html -> index.html, app_v7.js -> app.js, et TOUS les modules lib/.
 * Oublier un module ne casse rien au build mais fait tomber la page publiee en
 * 404 au premier import : d'ou le controle final.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'projects', 'Atlas');
const pub = path.join(root, 'published', 'atlas');

const VERSION = '1.0.0';
/** Les query strings de cache de dev (?v=2026...) deviennent la version publiee. */
const normaliserVersions = (code) => code.replace(/\?v=2026[0-9a-z]+/g, `?v=${VERSION}`);

let html = fs.readFileSync(path.join(src, 'index_v7.html'), 'utf8');
html = html.replace(
  '<title>Atlas v7 — Maquette 3D Territoriale</title>',
  '<title>Atlas — Maquette 3D Territoriale</title>'
);
html = html.replace(/\.\/app_v7\.js\?v=[^"]+/, `./app.js?v=${VERSION}`);
fs.writeFileSync(path.join(pub, 'index.html'), html);

fs.writeFileSync(
  path.join(pub, 'app.js'),
  normaliserVersions(fs.readFileSync(path.join(src, 'app_v7.js'), 'utf8'))
);

const libSrc = path.join(src, 'lib');
const libPub = path.join(pub, 'lib');
fs.mkdirSync(libPub, { recursive: true });
let modules = 0;
for (const f of fs.readdirSync(libSrc)) {
  if (!f.endsWith('.js')) continue;
  fs.writeFileSync(path.join(libPub, f), normaliserVersions(fs.readFileSync(path.join(libSrc, f), 'utf8')));
  modules++;
}

// Controle : tout module importe doit exister dans la copie publiee.
const publie = fs.readFileSync(path.join(pub, 'app.js'), 'utf8');
const requis = [...new Set([...publie.matchAll(/\.\/lib\/([a-z0-9-]+\.js)/g)].map((m) => m[1]))];
const absents = requis.filter((m) => !fs.existsSync(path.join(libPub, m)));
if (absents.length) {
  console.error('Echec : modules importes mais absents de published/atlas/lib —', absents.join(', '));
  process.exit(1);
}

console.log(`published/atlas pret — ${modules} modules lib/, ${requis.length} importes par app.js`);
