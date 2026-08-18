#!/usr/bin/env node
/* build-budget.js — génère les widgets Budget depuis app.html + core + modules.
   Un seul codebase, deux formes de sortie :
     - single-page  : published/budget/index.html          (nav Suivi|Classement|Import)
     - per-module   : published/budget/<id>/index.html      (pinné via window.__BUDGET_VIEW__)
   Le core et les modules sont inlinés entre les marqueurs <budget-inline:*> d'app.html,
   de sorte que chaque sortie est un fichier HTML autonome (déployable seul).

   Usage :
     node build-budget.js           construit dans published/budget
     node build-budget.js --check   reconstruit en mémoire et échoue si ça diffère (CI)
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;                                   // projects/budget_app
const OUT = path.resolve(ROOT, '../../published/budget'); // <repo>/published/budget
const APP = path.join(ROOT, 'app.html');
const CORE = path.join(ROOT, 'core', 'budget-core.js');
const MODDIR = path.join(ROOT, 'modules');

const read = p => fs.readFileSync(p, 'utf8');
// neutralise tout </script> littéral qui casserait l'inlining
const safe = js => js.replace(/<\/script>/gi, '<\\/script>');
const scriptTag = js => '<script>\n' + safe(js.replace(/\s+$/, '')) + '\n</script>';

function replaceBlock(html, name, replacement) {
  const re = new RegExp('<!-- <budget-inline:' + name + '> -->[\\s\\S]*?<!-- </budget-inline> -->');
  if (!re.test(html)) throw new Error('Marqueur <budget-inline:' + name + '> introuvable dans app.html');
  return html.replace(re, replacement);
}

function listModules() {
  return fs.readdirSync(MODDIR).filter(f => f.endsWith('.js')).sort()
    .map(f => ({ id: path.basename(f, '.js'), file: path.join(MODDIR, f) }));
}

/* Construit le HTML final.
   pin = null -> single-page (tous les modules, nav active)
   pin = id   -> per-module (uniquement ce module, vue pinnée) */
function buildHtml(mods, pin) {
  let html = read(APP);
  html = replaceBlock(html, 'core', scriptTag(read(CORE)));
  const chosen = pin ? mods.filter(m => m.id === pin) : mods;
  let modBlock = '';
  if (pin) modBlock += '<script>window.__BUDGET_VIEW__=' + JSON.stringify(pin) + ';</script>\n';
  modBlock += chosen.map(m => scriptTag(read(m.file))).join('\n');
  html = replaceBlock(html, 'modules', modBlock);
  return html;
}

function outputs() {
  const mods = listModules();
  if (!mods.length) throw new Error('Aucun module dans ' + MODDIR);
  const out = [{ rel: 'index.html', html: buildHtml(mods, null) }];   // single-page
  mods.forEach(m => out.push({ rel: path.join(m.id, 'index.html'), html: buildHtml(mods, m.id) }));
  return out;
}

function build() {
  const out = outputs();
  out.forEach(o => {
    const dest = path.join(OUT, o.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, o.html);
    console.log('  écrit  ' + path.relative(process.cwd(), dest));
  });
  console.log('OK — ' + out.length + ' fichier(s) généré(s) dans ' + path.relative(process.cwd(), OUT));
}

function check() {
  const out = outputs();
  let diff = 0;
  out.forEach(o => {
    const dest = path.join(OUT, o.rel);
    const cur = fs.existsSync(dest) ? read(dest) : null;
    if (cur !== o.html) { diff++; console.error('  DIFFÈRE  ' + o.rel + (cur == null ? ' (absent)' : '')); }
  });
  if (diff) { console.error('--check : ' + diff + ' fichier(s) hors sync. Lance `node build-budget.js`.'); process.exit(1); }
  console.log('--check : tout est à jour (' + out.length + ' fichiers).');
}

(process.argv.includes('--check') ? check : build)();
