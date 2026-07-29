const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'published', 'atlas');

fs.copyFileSync(path.join(root, 'projects', 'Atlas', 'index_v7.html'), path.join(pub, 'index.html'));
fs.copyFileSync(path.join(root, 'projects', 'Atlas', 'app_v7.js'), path.join(pub, 'app.js'));

let html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
html = html.replace(
  '<title>Atlas v7 — Maquette 3D Territoriale</title>',
  '<title>Atlas — Maquette 3D Territoriale</title>'
);
html = html.replace(/\.\/app_v7\.js\?v=[^"]+/, './app.js?v=1.0.0');
fs.writeFileSync(path.join(pub, 'index.html'), html);

let app = fs.readFileSync(path.join(pub, 'app.js'), 'utf8');
app = app.replace(/\?v=2026[0-9a-z]+/g, '?v=1.0.0');
fs.writeFileSync(path.join(pub, 'app.js'), app);

console.log('published/atlas ready');
