/**
 * promote-grist-forms.js — Copie projects/grist_forms → published/grist_forms
 *
 * Usage: node scripts/promote-grist-forms.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'projects', 'grist_forms');
const DEST = path.join(ROOT, 'published', 'grist_forms');

const COPY_DIRS = ['shared', 'runtime'];
const COPY_FILES = ['builder.html'];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(SRC)) {
  console.error('Source introuvable:', SRC);
  process.exit(1);
}

if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}
fs.mkdirSync(DEST, { recursive: true });

COPY_FILES.forEach(function (f) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
});
COPY_DIRS.forEach(function (d) {
  copyDir(path.join(SRC, d), path.join(DEST, d));
});

const pkg = {
  name: 'grist-forms',
  version: '1.0.0',
  description: 'Form Builder Grist — composer, prévisualiser et publier des formulaires intra-doc',
  authors: [{ name: 'nic01asfr', url: 'https://github.com/nic01asfr' }],
  grist: {
    widgetId: 'grist-forms-builder',
    name: 'Form Builder — essence formulaires Grist',
    url: 'builder.html',
    accessLevel: 'full',
    description: 'Questionnaires liés aux tables Grist : conditions, audience, chemins, publication figée intra-doc'
  }
};
fs.writeFileSync(path.join(DEST, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

console.log('Promu : projects/grist_forms → published/grist_forms/');
console.log('Fichiers : builder.html, shared/, runtime/');
console.log('Exécutez : npm run manifest');
