const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const V = require('./generate-vitrine.js');

const W = (id, url, extra = {}) => ({ widgetId: id, name: id, url, ...extra });

/* ---------- a quel projet appartient un widget ---------- */

test('le projet se lit dans le chemin, apres le nom du depot', () => {
  assert.equal(V.projetDe('https://x.github.io/Widgets-Grist/taskflow/kanban/'), 'taskflow');
  assert.equal(V.projetDe('https://x.github.io/Widgets-Grist/atlas/'), 'atlas');
});

test('une URL inexploitable n’invente pas de projet', () => {
  // Mieux vaut ne pas presenter un widget que de creer une page fantome.
  assert.equal(V.projetDe(''), null);
  assert.equal(V.projetDe('pas une url'), null);
  assert.equal(V.projetDe('https://x.github.io/Widgets-Grist/'), null);
});

test('les widgets d’un meme projet se rangent ensemble, dans l’ordre du manifeste', () => {
  const g = V.grouper([
    W('taskflow', 'https://x.io/r/taskflow/'),
    W('atlas', 'https://x.io/r/atlas/'),
    W('taskflow-gantt', 'https://x.io/r/taskflow/gantt/'),
  ]);
  assert.deepEqual(g.map((p) => p.id), ['taskflow', 'atlas']);
  assert.deepEqual(g[0].widgets.map((w) => w.widgetId), ['taskflow', 'taskflow-gantt']);
});

/* ---------- ce que la page annonce ---------- */

test('la fraicheur se lit en francais, pas en ISO', () => {
  const T = Date.parse('2026-08-21T12:00:00Z');
  const q = (iso) => V.depuis(iso, T);
  assert.equal(q('2026-08-21T09:00:00Z'), "aujourd'hui");
  assert.equal(q('2026-08-20T09:00:00Z'), 'hier');
  assert.equal(q('2026-08-18T12:00:00Z'), 'il y a 3 j');
  assert.equal(q('2026-05-09T12:00:00Z'), 'il y a 3 mois');
  assert.equal(q(''), '');
  assert.equal(q('la semaine derniere'), '');
});

test('« recemment » veut dire moins d’une semaine', () => {
  const T = Date.parse('2026-08-21T12:00:00Z');
  assert.equal(V.estRecent('2026-08-18T12:00:00Z', T), true);
  assert.equal(V.estRecent('2026-08-10T12:00:00Z', T), false);
  assert.equal(V.estRecent('', T), false);
});

test('sans historique, la date retombe sur le manifeste', () => {
  // En CI, un checkout superficiel n'a pas les dates de commit. La page doit
  // rester juste plutot que vide.
  const p = { id: 'projet-qui-n-existe-pas-dans-git', widgets: [W('a', 'https://x.io/r/a/', { lastUpdatedAt: '2026-01-02T00:00:00Z' })] };
  assert.equal(V.majProjet(p).slice(0, 10), '2026-01-02');
});

/* ---------- la contrainte cardinale ---------- */

test('la vitrine n’ecrit jamais par-dessus un widget', () => {
  // `published/<projet>/index.html` EST le widget : c'est l'adresse enregistree
  // dans les instances Grist. Ecrire la presentation la casserait toutes les
  // installations, sans que rien ne le signale.
  const { faits } = V.generer();
  const permis = new Set(['index.html', 'sitemap.xml']);
  for (const f of faits) {
    assert.ok(permis.has(f) || f.startsWith('w/'), `${f} sort de la vitrine`);
  }
});

test('chaque projet du manifeste a sa page, et une seule', () => {
  const { projets, faits } = V.generer();
  const pages = faits.filter((f) => f.startsWith('w/'));
  assert.equal(pages.length, projets.length);
  for (const p of projets) {
    assert.ok(pages.includes(`w/${p.id}/index.html`), `page manquante pour ${p.id}`);
  }
});

test('la page d’un projet mene au widget et revient a l’accueil', () => {
  const { projets } = V.generer();
  const atlas = projets.find((p) => p.id === 'atlas');
  const html = fs.readFileSync(path.join(__dirname, '..', 'published', 'w', 'atlas', 'index.html'), 'utf8');
  assert.match(html, /href="\.\.\/\.\.\/"/, 'retour vers l’accueil');
  assert.ok(html.includes(atlas.widgets[0].url), 'lien vers le widget');
  assert.match(html, /<title>Atlas — widget Grist<\/title>/);
});

test('un projet sans fiche reste presentable', () => {
  // La fiche est facultative : sans elle, la description du manifeste suffit a
  // produire une page correcte, plutot qu'une page vide ou un plantage.
  const html = V.rendreProjet({
    id: 'nu',
    widgets: [W('nu', 'https://x.io/r/nu/', { description: 'Fait quelque chose', accessLevel: 'read table' })],
    presentation: {},
  }, Date.now());
  assert.match(html, /Fait quelque chose/);
  assert.match(html, /lecture seule/);
  assert.doesNotMatch(html, /undefined|\[object/);
});

test('le texte d’une fiche est echappe, pas injecte', () => {
  const html = V.rendreProjet({
    id: 'x',
    widgets: [W('x', 'https://x.io/r/x/')],
    presentation: { nom: '<script>alert(1)</script>', pitch: 'a & b' },
  }, Date.now());
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /a &amp; b/);
});

test('la fiche de presentation ne date pas le projet', () => {
  // Elle vit dans le dossier du widget : l'y avoir ajoutee avait date tous les
  // projets du jour ou la vitrine est nee. « Mis a jour aujourd'hui » partout
  // ne renseigne sur rien — c'est le defaut meme qu'on voulait corriger.
  const { projets } = V.generer();
  const dates = projets.map((p) => V.majProjet(p).slice(0, 10));
  assert.ok(new Set(dates).size > 1,
    `toutes les dates sont identiques (${dates[0]}) — la fiche les ecrase`);
});

/* ---------- ce que lisent les moteurs et les partages ---------- */

test('l’adresse publique se deduit du manifeste, jamais codee en dur', () => {
  // Le jour ou le depot change de nom ou de compte, une adresse ecrite ici
  // mentirait sans que rien ne le signale.
  assert.equal(V.baseDe([W('a', 'https://qui.github.io/Le-Depot/atlas/')]), 'https://qui.github.io/Le-Depot/');
  assert.equal(V.baseDe([W('a', 'pas une url'), W('b', 'https://x.io/r/t/')]), 'https://x.io/r/');
  assert.equal(V.baseDe([]), '');
});

test('chaque page se declare canonique et se presente aux partages', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'published', 'w', 'atlas', 'index.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+\/w\/atlas\/">/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:description"/);
  assert.match(html, /<meta name="twitter:card"/);
});

test('un widget se decrit comme un logiciel, pas comme une page', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'published', 'w', 'atlas', 'index.html'), 'utf8');
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'donnees structurees absentes');
  const ld = JSON.parse(m[1]);
  assert.equal(ld['@type'], 'SoftwareApplication');
  assert.equal(ld.inLanguage, 'fr');
  assert.ok(ld.url.endsWith('/w/atlas/'));
  assert.equal(ld.offers.price, '0');
});

test('le plan du site liste l’accueil et chaque projet, une seule fois', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'published', 'sitemap.xml'), 'utf8');
  const { projets, base } = V.generer();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, projets.length + 1);
  assert.equal(new Set(locs).size, locs.length, 'une URL apparait deux fois');
  assert.ok(locs.includes(base));
  for (const p of projets) assert.ok(locs.includes(`${base}w/${p.id}/`), `${p.id} absent du plan`);
});

test('le plan date les pages d’apres le projet, pas d’apres la generation', () => {
  // Annoncer que tout a change a chaque deploiement apprend a un moteur a ne
  // plus croire ces dates.
  const xml = fs.readFileSync(path.join(__dirname, '..', 'published', 'sitemap.xml'), 'utf8');
  const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  assert.ok(dates.length >= 2);
  assert.ok(new Set(dates).size > 1, 'toutes les dates du plan sont identiques');
});
