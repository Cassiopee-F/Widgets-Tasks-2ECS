#!/usr/bin/env node
/**
 * La vitrine : ce que `published/` montre a un humain.
 *
 * `manifest.json` s'adresse a Grist — un catalogue de widgets, lisible par une
 * machine. Rien, jusqu'ici, ne presentait ce travail a quelqu'un qui arrive :
 * le forum et l'article pointaient vers des URLs de widgets bruts, et l'APK
 * vers un pod temporaire.
 *
 * Deux niveaux, et pas trois : une page d'accueil ou chaque *projet* tient une
 * carte, et une page par projet ou ses widgets sont detailles. TaskFlow n'est
 * pas huit produits, c'est un produit a huit vues ; huit cartes qui se
 * ressemblent noieraient l'accueil.
 *
 * CONTRAINTE QUI COMMANDE L'ARBORESCENCE — `published/<projet>/index.html` EST
 * le widget : c'est l'URL declaree dans le manifeste, celle qu'ont enregistree
 * les instances Grist. La vitrine ne peut donc pas s'y loger. Elle vit sous
 * `/w/<projet>/`, et l'accueil est le seul `published/index.html`.
 *
 * Rien n'est ecrit a la main : les pages sont regenerees depuis le manifeste et
 * un `vitrine.json` par projet. C'est la lecon du manifeste lui-meme, edite une
 * fois a la main et parti en URLs « VOTRE_USER » que personne n'a vues.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const PUBLIE = path.join(RACINE, 'published');
const MANIFESTE = path.join(PUBLIE, 'manifest.json');

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/** Le premier segment du chemin nomme le projet : `/taskflow/kanban/` → `taskflow`. */
function projetDe(url) {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean);
    return p[1] || null;   // [0] = nom du depot sur GitHub Pages
  } catch (_) { return null; }
}

/** Regroupe les widgets du manifeste par projet, en gardant l'ordre du manifeste. */
function grouper(widgets) {
  const projets = new Map();
  for (const w of widgets) {
    const nom = projetDe(w.url);
    if (!nom) continue;
    if (!projets.has(nom)) projets.set(nom, { id: nom, widgets: [] });
    projets.get(nom).widgets.push(w);
  }
  return [...projets.values()];
}

/**
 * Ce que le manifeste ne porte pas.
 *
 * Il donne un nom, une URL, une description courte — assez pour une carte, pas
 * pour presenter. Le reste (pitch, ce que ca fait, journal, couleur) vit dans
 * un `vitrine.json` a cote du widget, ecrit une fois.
 */
function presentation(projet) {
  const f = path.join(PUBLIE, projet.id, 'vitrine.json');
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
    console.warn(`  ! ${projet.id}/vitrine.json illisible : ${e.message}`);
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Fraicheur relative plutot que date ISO : devant une liste, « il y a 3 j »
 * situe mieux qu'un horodatage, et dit d'un coup d'oeil ce qui vit.
 */
function depuis(iso, maintenant = Date.now()) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const j = Math.floor((maintenant - t) / 86400000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  if (j < 31) return `il y a ${j} j`;
  const mo = Math.floor(j / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const an = Math.floor(mo / 12);
  return `il y a ${an} an${an > 1 ? 's' : ''}`;
}

/**
 * Quand ce projet a-t-il bouge ?
 *
 * Pas ce que dit le manifeste : il pose `new Date()` a chaque generation, donc
 * tous les widgets y sont « mis a jour aujourd'hui », y compris celui qui n'a
 * pas ete touche depuis mai. Une vitrine qui affiche cela ne renseigne sur
 * rien. La verite est dans l'historique.
 *
 * Repli sur le manifeste si l'historique n'est pas disponible — un checkout
 * superficiel de CI n'a pas les dates (`fetch-depth: 0` les ramene).
 */
function majProjet(projet) {
  try {
    // La fiche de presentation est exclue : elle vit dans le dossier du widget,
    // et l'y avoir ajoutee datait tous les projets du jour ou la vitrine est
    // nee — « mis a jour aujourd'hui » partout, donc nulle part.
    const d = execFileSync('git', ['log', '-1', '--format=%cI', '--',
      `published/${projet.id}`, `:(exclude)published/${projet.id}/vitrine.json`],
      { cwd: RACINE, encoding: 'utf8' }).trim();
    if (d) return d;
  } catch (_) { /* pas d'historique ici : on retombe sur le manifeste */ }
  const dates = projet.widgets.map((w) => Date.parse(w.lastUpdatedAt || '')).filter(Number.isFinite);
  return dates.length ? new Date(Math.max(...dates)).toISOString() : '';
}

/** Un projet qui a bouge dans la semaine merite qu'on le remarque. */
function estRecent(iso, maintenant = Date.now()) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) && (maintenant - t) < 7 * 86400000;
}


/* ------------------------------------------------------------------ */
/* Ce que les moteurs et les partages lisent                           */
/* ------------------------------------------------------------------ */

/**
 * L'adresse publique de la vitrine, deduite du manifeste.
 *
 * Elle n'est ecrite nulle part ailleurs : les URLs du manifeste la portent
 * deja, et la CI les construit a partir du depot. La coder en dur ici la ferait
 * mentir le jour ou le depot est renomme ou publie sous un autre compte.
 */
function baseDe(widgets) {
  for (const w of widgets) {
    try {
      const u = new URL(w.url);
      const depot = u.pathname.split('/').filter(Boolean)[0];
      return `${u.origin}/${depot}/`;
    } catch (_) { /* url inexploitable : on essaie la suivante */ }
  }
  return '';
}

/**
 * Ce qu'un moteur, un forum ou une messagerie affichent du lien.
 *
 * Sans ces balises, une adresse collee sur le forum Grist ou le bureau
 * numerique s'affiche nue : ni titre, ni resume. C'est la premiere impression,
 * et elle se joue avant que quiconque ait ouvert la page.
 *
 * Le lien canonique evite qu'une meme page soit comptee deux fois — atteinte
 * avec ou sans barre finale, ou suivie d'un parametre de campagne.
 */
function entete({ url, titre, description, image }) {
  const abs = image && url ? new URL(image, url).href : '';
  const lignes = [
    `<link rel="canonical" href="${echapper(url)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Widgets Grist">',
    '<meta property="og:locale" content="fr_FR">',
    `<meta property="og:url" content="${echapper(url)}">`,
    `<meta property="og:title" content="${echapper(titre)}">`,
    `<meta property="og:description" content="${echapper(description)}">`,
    abs ? `<meta property="og:image" content="${echapper(abs)}">` : '',
    `<meta name="twitter:card" content="${abs ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${echapper(titre)}">`,
    `<meta name="twitter:description" content="${echapper(description)}">`,
  ].filter(Boolean);
  return '\n' + lignes.join('\n');
}

/**
 * Les donnees structurees, en JSON-LD.
 *
 * `SoftwareApplication` decrit ce qu'est reellement un widget : un logiciel
 * gratuit qui tourne dans un navigateur. Sans ce vocabulaire, un moteur ne voit
 * qu'une page de texte parmi d'autres et ne peut rien en presenter de plus.
 *
 * Le JSON est insere tel quel : il ne peut pas contenir de balise fermante,
 * `JSON.stringify` echappant deja ce qui pourrait en former une.
 */
function donneesStructurees(objet) {
  const json = JSON.stringify(objet).split('<').join('\\u003c');
  return `\n<script type="application/ld+json">${json}</` + `script>`;
}

/* ------------------------------------------------------------------ */
/* Le rendu                                                            */
/* ------------------------------------------------------------------ */

/**
 * Le socle visuel, partage par toutes les pages.
 *
 * `--accent` est la seule variable qui change d'une page a l'autre : chaque
 * projet porte sa couleur, celle de son widget. Une page de presentation qui ne
 * ressemble pas au produit ment sur le produit — mais l'accueil, lui, reste
 * neutre pour laisser les cartes se distinguer entre elles.
 */
function socle(accent) {
  return `
:root {
  --papier: #FAF7F0; --surface: #FFFFFF; --encre: #1A1814; --plume: #6B6355;
  --filet: #E6DFD1; --accent: ${accent || '#8B5E3C'};
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --papier: #14120F; --surface: #1D1A16; --encre: #F2EDE3; --plume: #9A9184;
    --filet: #2E2A23;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--papier); color: var(--encre);
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased; }
a { color: inherit; }
main { max-width: 60rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 500;
  line-height: 1.15; text-wrap: balance; margin: 0; }
h1 { font-size: clamp(2.2rem, 6vw, 3.4rem); letter-spacing: -.01em; }
h2 { font-size: 1.5rem; margin-bottom: 1rem; }
p { margin: 0 0 1rem; color: var(--plume); }
.eyebrow { font-size: .78rem; letter-spacing: .12em; text-transform: uppercase;
  color: var(--plume); margin-bottom: 1.4rem; }
.tags { display: flex; flex-wrap: wrap; gap: .4rem; margin: 1rem 0; }
.tag { font-size: .78rem; padding: .2rem .6rem; border-radius: 999px;
  border: 1px solid var(--filet); color: var(--plume); }
.faits { display: flex; flex-wrap: wrap; gap: 1.4rem; align-items: baseline;
  font-size: .88rem; color: var(--plume); margin: 1.4rem 0 2rem; }
.faits b { color: var(--encre); font-weight: 600; }
.vif { display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #4E9A5B; margin-right: .4rem; vertical-align: middle; }
.pied { max-width: 60rem; margin: 0 auto; padding: 2rem 1.5rem 4rem;
  border-top: 1px solid var(--filet); font-size: .85rem; color: var(--plume); }
code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: .85em;
  background: var(--surface); border: 1px solid var(--filet); border-radius: 4px;
  padding: .1rem .35rem; }
`;
}

/** Ouverture et fermeture d'un document — un seul endroit ou elles vivent. */
function page({ titre, description, accent, corps, css = '', meta = '', ld = '' }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description || '')}">${meta}${ld}
<style>${socle(accent)}${css}</style>
</head>
<body>
${corps}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* L'accueil                                                           */
/* ------------------------------------------------------------------ */

const CSS_ACCUEIL = `
.grille { display: grid; gap: 1.1rem; margin-top: 2.5rem;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); }
.carte { display: block; text-decoration: none; background: var(--surface);
  border: 1px solid var(--filet); border-radius: 14px; overflow: hidden;
  transition: border-color .15s, transform .15s; }
.carte:hover { border-color: var(--teinte); transform: translateY(-2px); }
.carte .filet { height: 3px; background: var(--teinte); }
.carte .dedans { padding: 1.3rem 1.4rem 1.5rem; }
.carte h2 { font-size: 1.22rem; margin: 0 0 .4rem; }
.carte p { font-size: .92rem; margin: 0 0 .9rem; }
.carte .bas { display: flex; justify-content: space-between; align-items: center;
  font-size: .8rem; color: var(--plume); padding-top: .9rem;
  border-top: 1px solid var(--filet); }
.intro { max-width: 34rem; }
`;

function carteProjet(p, v, maintenant) {
  const maj = majProjet(p);
  const teinte = v.couleur || 'var(--accent)';
  const n = p.widgets.length;
  return `      <a class="carte" href="w/${p.id}/" style="--teinte:${echapper(teinte)}">
        <div class="filet"></div>
        <div class="dedans">
          <h2>${echapper(v.nom || p.widgets[0].name || p.id)}</h2>
          <p>${echapper(v.pitch || p.widgets[0].description || '')}</p>
          ${(v.tags || []).length ? `<div class="tags">${(v.tags || []).slice(0, 3)
            .map((t) => `<span class="tag">${echapper(t)}</span>`).join('')}</div>` : ''}
          <div class="bas">
            <span>${n} widget${n > 1 ? 's' : ''}</span>
            <span>${estRecent(maj, maintenant) ? '<span class="vif"></span>' : ''}${echapper(depuis(maj, maintenant))}</span>
          </div>
        </div>
      </a>`;
}

function rendreAccueil(projets, maintenant, base = '') {
  const cartes = projets.map((p) => carteProjet(p, p.presentation, maintenant)).join('\n');
  const titre = 'Widgets Grist — cartographie 3D, gestion de projet, formulaires';
  const description = 'Widgets libres pour Grist : maquette territoriale 3D, suite de gestion de projet, questionnaires liés aux tables, import de projets QGIS.';
  return page({
    titre,
    description,
    meta: base ? entete({ url: base, titre, description }) : '',
    // Une liste, decrite comme une liste : c'est ce qui relie l'accueil aux
    // pages qu'il annonce, au lieu de laisser un moteur les decouvrir une a une.
    ld: base ? donneesStructurees({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: titre,
      description,
      url: base,
      inLanguage: 'fr',
      hasPart: projets.map((pr) => ({
        '@type': 'SoftwareApplication',
        name: pr.presentation.nom || pr.widgets[0].name,
        url: `${base}w/${pr.id}/`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
      })),
    }) : '',
    corps: `<main>
  <p class="eyebrow">Widgets pour Grist</p>
  <h1>Des outils qui vivent dans vos documents</h1>
  <p class="intro">Chacun de ces widgets s’ajoute à un document Grist et travaille
     sur ses tables — la donnée ne bouge pas, elle change de forme.</p>
  <div class="grille">
${cartes}
  </div>
</main>
<footer class="pied">
  <p>Pour ajouter ces widgets à une instance auto-hébergée, pointez
     <code>GRIST_WIDGET_LIST_URL</code> vers <a href="manifest.json">manifest.json</a>.</p>
</footer>`,
    css: CSS_ACCUEIL,
  });
}

/* ------------------------------------------------------------------ */
/* La page d'un projet                                                 */
/* ------------------------------------------------------------------ */

const CSS_PROJET = `
.retour { display: inline-block; font-size: .88rem; color: var(--plume);
  text-decoration: none; margin-bottom: 2rem; }
.retour:hover { color: var(--accent); }
.chapeau { font-size: 1.15rem; line-height: 1.55; color: var(--encre);
  max-width: 40rem; margin: 1rem 0 0; }
.boutons { display: flex; flex-wrap: wrap; gap: .7rem; margin: 2rem 0 3rem; }
.bouton { display: inline-block; padding: .8rem 1.3rem; border-radius: 10px;
  font-size: .95rem; font-weight: 600; text-decoration: none;
  background: var(--accent); color: #fff; border: 1px solid var(--accent); }
.bouton.creux { background: none; color: var(--encre); border-color: var(--filet);
  font-weight: 500; }
.bouton.creux:hover { border-color: var(--accent); }
section { margin: 0 0 3rem; }
.liste { display: flex; flex-direction: column; gap: .6rem; }
.vue { display: flex; gap: 1rem; align-items: baseline; padding: .9rem 1.1rem;
  background: var(--surface); border: 1px solid var(--filet); border-radius: 10px; }
.vue b { font-weight: 600; min-width: 8.5rem; }
.vue span { color: var(--plume); font-size: .9rem; flex: 1; }
.vue a { font-size: .82rem; color: var(--accent); text-decoration: none;
  white-space: nowrap; }
.points { list-style: none; padding: 0; margin: 0; display: grid; gap: .8rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.points li { padding-left: 1.1rem; position: relative; color: var(--plume);
  line-height: 1.55; }
.points li::before { content: ''; position: absolute; left: 0; top: .55em;
  width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.points li b { color: var(--encre); font-weight: 600; }
.journal { border-left: 2px solid var(--filet); padding-left: 1.2rem; }
.journal div { margin-bottom: 1.1rem; }
.journal b { font-family: ui-monospace, Menlo, monospace; font-size: .85rem; }
.journal p { margin: .2rem 0 0; font-size: .92rem; }
.encart { background: var(--surface); border: 1px solid var(--filet);
  border-left: 3px solid var(--accent); border-radius: 10px; padding: 1.3rem 1.4rem; }
.encart h2 { font-size: 1.2rem; margin-bottom: .5rem; }
`;

/** Une vue du projet, avec l'adresse a coller dans Grist. */
function ligneWidget(w) {
  return `      <div class="vue">
        <b>${echapper(w.name)}</b>
        <span>${echapper(w.description || '')}</span>
        <a href="${echapper(w.url)}" target="_blank" rel="noopener">ouvrir</a>
      </div>`;
}

function rendreProjet(p, maintenant, base = '') {
  const v = p.presentation;
  const maj = majProjet(p);
  const nom = v.nom || p.widgets[0].name || p.id;
  const principal = p.widgets[0];
  const acces = principal.accessLevel === 'full' ? 'lecture et écriture'
    : principal.accessLevel === 'read table' ? 'lecture seule' : 'aucun accès aux données';

  const sections = [];

  if ((v.points || []).length) {
    sections.push(`  <section>
    <h2>Ce qu’il fait</h2>
    <ul class="points">
${v.points.map((pt) => `      <li>${pt.titre ? `<b>${echapper(pt.titre)}</b> — ` : ''}${echapper(pt.texte || pt)}</li>`).join('\n')}
    </ul>
  </section>`);
  }

  if (p.widgets.length > 1) {
    sections.push(`  <section>
    <h2>Les vues</h2>
    <div class="liste">
${p.widgets.map(ligneWidget).join('\n')}
    </div>
  </section>`);
  }

  if (v.encart) {
    sections.push(`  <section>
    <div class="encart">
      <h2>${echapper(v.encart.titre)}</h2>
      <p>${echapper(v.encart.texte)}</p>
      ${v.encart.lien ? `<a class="bouton" href="${echapper(v.encart.lien.url)}">${echapper(v.encart.lien.libelle)}</a>` : ''}
    </div>
  </section>`);
  }

  if ((v.journal || []).length) {
    sections.push(`  <section>
    <h2>Journal</h2>
    <div class="journal">
${v.journal.map((e) => `      <div><b>${echapper(e.version)}</b><p>${echapper(e.texte)}</p></div>`).join('\n')}
    </div>
  </section>`);
  }

  const titre = `${nom} — widget Grist`;
  const description = v.pitch || principal.description || '';
  const url = base ? `${base}w/${p.id}/` : '';
  return page({
    titre,
    description,
    accent: v.couleur,
    meta: url ? entete({ url, titre, description }) : '',
    ld: url ? donneesStructurees({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: nom,
      description,
      url,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: 'fr',
      // Gratuit, et dit comme tel plutot que laisse a deviner.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      ...(v.depot ? { codeRepository: v.depot } : {}),
      ...(maj ? { dateModified: maj.slice(0, 10) } : {}),
    }) : '',
    css: CSS_PROJET,
    corps: `<main>
  <a class="retour" href="../../">← Tous les widgets</a>
  <p class="eyebrow">Widget Grist</p>
  <h1>${echapper(nom)}</h1>
  <p class="chapeau">${echapper(v.pitch || principal.description || '')}</p>
  ${(v.tags || []).length ? `<div class="tags">${v.tags.map((t) => `<span class="tag">${echapper(t)}</span>`).join('')}</div>` : ''}
  <div class="faits">
    <span><b>${p.widgets.length}</b> widget${p.widgets.length > 1 ? 's' : ''}</span>
    <span>Accès <b>${echapper(acces)}</b></span>
    ${maj ? `<span>${estRecent(maj, maintenant) ? '<span class="vif"></span>' : ''}Mis à jour ${echapper(depuis(maj, maintenant))}</span>` : ''}
  </div>
  <div class="boutons">
    <a class="bouton" href="${echapper(principal.url)}" target="_blank" rel="noopener">Ouvrir le widget</a>
    ${v.depot ? `<a class="bouton creux" href="${echapper(v.depot)}" target="_blank" rel="noopener">Le code</a>` : ''}
  </div>
${sections.join('\n')}
</main>
<footer class="pied">
  <p>Dans Grist : <em>Ajouter un widget</em> → <em>Custom</em> → collez l’adresse
     <code>${echapper(principal.url)}</code>, et donnez l’accès
     <b>${echapper(acces)}</b>.</p>
</footer>`,
  });
}

/**
 * Le plan du site.
 *
 * Il n'y a pas de `robots.txt` a poser : les moteurs le lisent a la racine du
 * domaine, qui appartient au depot de profil, pas a celui-ci. Le plan reste
 * donc a soumettre une fois dans la console de recherche — apres quoi il se
 * met a jour tout seul a chaque publication.
 *
 * La date de derniere modification est celle du projet, pas celle de la
 * generation : annoncer que tout a change a chaque deploiement apprend a un
 * moteur a ne plus croire ces dates.
 */
function rendreSitemap(projets, base) {
  const pages = [
    { url: base, maj: '' },
    ...projets.map((p) => ({ url: `${base}w/${p.id}/`, maj: majProjet(p) })),
  ];
  const lignes = pages.map(({ url, maj }) => [
    '  <url>',
    `    <loc>${echapper(url)}</loc>`,
    maj ? `    <lastmod>${maj.slice(0, 10)}</lastmod>` : '',
    '  </url>',
  ].filter(Boolean).join('\n'));
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...lignes, '</urlset>', ''].join('\n');
}

/* ------------------------------------------------------------------ */
/* Ecriture                                                            */
/* ------------------------------------------------------------------ */

function ecrire(chemin, contenu) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, contenu);
  return path.relative(PUBLIE, chemin).split(String.fromCharCode(92)).join(String.fromCharCode(47));
}

function generer(maintenant = Date.now()) {
  const brut = JSON.parse(fs.readFileSync(MANIFESTE, 'utf8'));
  const widgets = Array.isArray(brut) ? brut : (brut.widgets || []);
  const projets = grouper(widgets);
  for (const p of projets) p.presentation = presentation(p);

  const base = baseDe(widgets);
  const faits = [ecrire(path.join(PUBLIE, 'index.html'), rendreAccueil(projets, maintenant, base))];
  for (const p of projets) {
    faits.push(ecrire(path.join(PUBLIE, 'w', p.id, 'index.html'), rendreProjet(p, maintenant, base)));
  }
  if (base) faits.push(ecrire(path.join(PUBLIE, 'sitemap.xml'), rendreSitemap(projets, base)));
  return { projets, faits, base };
}

if (require.main === module) {
  const { projets, faits } = generer();
  console.log(`Vitrine — ${projets.length} projets, ${faits.length} pages :`);
  for (const f of faits) console.log('  ' + f);
  const sans = projets.filter((p) => !Object.keys(p.presentation).length).map((p) => p.id);
  if (sans.length) console.log(`\nSans vitrine.json (presentation minimale) : ${sans.join(', ')}`);
}

module.exports = { projetDe, grouper, depuis, majProjet, estRecent, generer, rendreAccueil, rendreProjet, rendreSitemap, baseDe };
