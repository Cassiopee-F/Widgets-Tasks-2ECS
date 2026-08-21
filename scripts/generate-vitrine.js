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
/**
 * Le code que Google demande pour prouver qu'on tient ce site.
 *
 * Sur une « project page », le domaine appartient a GitHub : on ne peut donc
 * declarer qu'un prefixe d'URL, et le prouver par une balise posee sur sa page
 * d'accueil. Ce code n'est pas un secret — c'est un identifiant de propriete —
 * d'ou le fichier versionne plutot qu'une variable d'environnement que la CI
 * devrait porter.
 */
function verification() {
  const f = path.join(PUBLIE, 'verification.json');
  if (!fs.existsSync(f)) return '';
  try {
    const code = JSON.parse(fs.readFileSync(f, 'utf8')).google;
    return code ? `
<meta name="google-site-verification" content="${echapper(code)}">` : '';
  } catch (_) { return ''; }
}

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
const PEAU_MAISON = {
  clair: { papier: '#FAF7F0', surface: '#FFFFFF', encre: '#1A1814', plume: '#6B6355', filet: '#E6DFD1' },
  sombre: { papier: '#14120F', surface: '#1D1A16', encre: '#F2EDE3', plume: '#9A9184', filet: '#2E2A23' },
  display: 'Georgia, "Times New Roman", serif',
  accent: '#8B5E3C',
};

/** Les variables d'une palette, sur une ligne. */
function variables(p) {
  return Object.entries(p).map(([k, v]) => `--${k}: ${v};`).join(' ');
}

/**
 * Le socle visuel — structure commune, peau du produit.
 *
 * La page d'un widget prend la palette et la typographie de ce widget : une
 * presentation qui ne ressemble pas au produit ment sur le produit, et c'est la
 * seule chose que le visiteur en voit avant de l'ouvrir. TaskFlow est dense et
 * bleute, Atlas creme et vermillon — leurs pages doivent l'etre aussi.
 *
 * Ce qui ne change pas : la grille, la hierarchie, le fil d'Ariane, le pied. On
 * doit sentir qu'on est toujours sur le meme site, sinon revenir a l'accueil
 * ressemble a un depart.
 *
 * Une peau qui declare ses deux versions suit le theme du visiteur ; une peau
 * qui n'en declare qu'une l'impose — c'est le cas d'un produit dont l'identite
 * est un parti pris.
 */
function socle(accent, peau = {}) {
  const clair = { ...PEAU_MAISON.clair, ...(peau.clair || {}) };
  const sombre = peau.clair && !peau.sombre ? null : { ...PEAU_MAISON.sombre, ...(peau.sombre || {}) };
  const display = peau.display || PEAU_MAISON.display;
  return `
:root { ${variables(clair)} --accent: ${accent || peau.accent || PEAU_MAISON.accent}; }
${sombre ? `@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { ${variables(sombre)}${peau.accentSombre ? ` --accent: ${peau.accentSombre};` : ''} }
}` : ''}
* { box-sizing: border-box; }
body { margin: 0; background: var(--papier); color: var(--encre);
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased; }
a { color: inherit; }
main { max-width: 60rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
h1, h2, h3 { font-family: ${display}; font-weight: 500;
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
function page({ titre, description, accent, peau, corps, css = '', meta = '', ld = '' }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description || '')}">${meta}${ld}
<style>${socle(accent, peau)}${css}</style>
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
          <p>${echapper(v.pitch || principalDe(p).description || '')}</p>
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
    meta: verification() + (base ? entete({ url: base, titre, description }) : ''),
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
/* Les blocs d'une page produit                                        */
/* ------------------------------------------------------------------ */

/**
 * Ces blocs sont facultatifs, et c'est le point.
 *
 * Une page produit — accroche, images, sequence d'usage, chiffres — ne merite
 * pas un gabarit a part : ce serait du code qui ne sert qu'a un projet, et que
 * le suivant devrait reecrire. Chaque bloc s'affiche quand la fiche le remplit,
 * et disparait sinon. Atlas les remplit tous ; un widget qui n'a rien de plus a
 * montrer garde exactement la page qu'il avait.
 */

/** Les chiffres qui disent l'echelle, quand il y en a de vrais a donner. */
function blocChiffres(produit) {
  const l = produit.chiffres || [];
  if (!l.length) return '';
  return `  <section class="chiffres reveler">
${l.map((c) => `    <div><b>${echapper(c.valeur)}</b><span>${echapper(c.libelle)}</span></div>`).join('\n')}
  </section>`;
}

/**
 * Ou le produit tourne, et pourquoi chaque endroit existe.
 *
 * Une capture sans son pourquoi ne fait que remplir la page : le lecteur se
 * demande pourquoi on lui montre trois fois la meme interface. Chaque contexte
 * dit donc ce qu'il apporte que les autres n'apportent pas.
 *
 * Le cadre de telephone n'est pas un ornement — sans lui, une capture verticale
 * se lit comme une image mal recadree au milieu du texte.
 */
function blocContextes(produit) {
  const l = produit.contextes || [];
  if (!l.length) return '';
  const figure = (i, mobile) => (mobile
    ? `        <figure class="telephone">
          <div class="ecran"><img src="${echapper(i.image)}" alt="${echapper(i.legende)}" loading="lazy"></div>
          <figcaption>${echapper(i.legende)}</figcaption>
        </figure>`
    : `        <figure class="large">
          <img src="${echapper(i.image)}" alt="${echapper(i.legende)}" loading="lazy">
          <figcaption>${echapper(i.legende)}</figcaption>
        </figure>`);
  const article = (c) => `    <article class="contexte">
      <div class="dit">
        <h3>${echapper(c.titre)}</h3>
        <p>${echapper(c.texte)}</p>
        ${c.pourquoi ? `<p class="pourquoi">${echapper(c.pourquoi)}</p>` : ''}
      </div>
      <div class="montre${c.format === 'mobile' ? ' telephones' : ''}">
${(c.images || []).map((i) => figure(i, c.format === 'mobile')).join('\n')}
      </div>
    </article>`;
  return `  <section class="contextes reveler">
    <h2>${echapper(produit.titreContextes || 'Où ça tourne')}</h2>
${l.map(article).join('\n')}
  </section>`;
}

/**
 * Comment on s'en sert.
 *
 * Numerote, parce que l'ordre porte ici une information : on ne symbolise pas
 * une couche avant de l'avoir ajoutee. Ailleurs, numeroter serait un ornement.
 */
function blocSequence(produit) {
  const l = produit.sequence || [];
  if (!l.length) return '';
  return `  <section class="sequence reveler">
    <h2>${echapper(produit.titreSequence || 'Comment on s’en sert')}</h2>
    <ol>
${l.map((e) => `      <li>
        <b>${echapper(e.titre)}</b>
        <p>${echapper(e.texte)}</p>
      </li>`).join('\n')}
    </ol>
  </section>`;
}

/** Le style des blocs produit, et les revelations au defilement. */
const CSS_PRODUIT = `
.chiffres { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  padding: 1.6rem 0; border-top: 1px solid var(--filet); border-bottom: 1px solid var(--filet); }
.chiffres b { display: block; font-family: var(--display-f, inherit); font-size: 2rem;
  line-height: 1; color: var(--accent); font-weight: 500; }
.chiffres span { font-size: .88rem; color: var(--plume); }
.contexte { display: grid; gap: 1.4rem; margin-bottom: 2.8rem;
  grid-template-columns: minmax(0, 1fr); }
@media (min-width: 52rem) { .contexte { grid-template-columns: 17rem minmax(0, 1fr); gap: 2.2rem; } }
.contexte h3 { font-size: 1.12rem; margin-bottom: .4rem; }
.contexte p { font-size: .94rem; margin: 0 0 .7rem; }
/* Ce que ce contexte apporte que les autres n'apportent pas : c'est la seule
   raison de montrer une capture de plus. */
.contexte .pourquoi { font-size: .88rem; padding-left: .85rem;
  border-left: 2px solid var(--accent); margin-bottom: 0; }
.contexte figure { margin: 0 0 1rem; }
.contexte .large img { width: 100%; height: auto; display: block; border-radius: 12px;
  border: 1px solid var(--filet); }
.contexte figcaption { font-size: .85rem; color: var(--plume); margin-top: .6rem; }
.telephones { display: grid; gap: 1.6rem; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); }
/* Un cadre : sans lui, une capture verticale se lit comme une image mal recadree. */
.telephone .ecran { border: 8px solid var(--encre); border-radius: 26px; overflow: hidden;
  background: var(--encre); box-shadow: 0 10px 30px rgba(0,0,0,.18); }
/* Le cadre suit l image, au lieu de lui imposer un rapport : une capture prise
   sur un autre appareil se trouvait rognee, et c est le haut de l ecran — la
   barre du produit — qui disparaissait. */
.telephone .ecran img { width: 100%; height: auto; display: block; }
.telephone figcaption { text-align: center; }
.sequence ol { list-style: none; counter-reset: pas; padding: 0; margin: 0;
  display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
.sequence li { counter-increment: pas; padding-top: 2.6rem; position: relative; }
.sequence li::before { content: counter(pas); position: absolute; top: 0; left: 0;
  width: 1.9rem; height: 1.9rem; border-radius: 50%; display: grid; place-items: center;
  font-size: .85rem; font-weight: 600; color: #fff; background: var(--accent); }
.sequence li b { display: block; margin-bottom: .3rem; }
.sequence li p { font-size: .93rem; margin: 0; }
/* La revelation accompagne le defilement ; elle ne le commande pas. */
.reveler { opacity: 0; transform: translateY(14px);
  transition: opacity .5s ease, transform .5s ease; }
.reveler.vu { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .reveler { opacity: 1; transform: none; transition: none; }
}
`;

/**
 * Le script de revelation.
 *
 * Sans JavaScript — ou s'il echoue — les blocs doivent rester lisibles : ils
 * sont donc reveles des le chargement par ce meme script, qui n'a plus qu'a
 * retarder ceux qu'on n'a pas encore atteints. Une page dont le contenu depend
 * d'une animation est une page vide pour qui ne l'execute pas.
 */
const JS_REVELER = `
<script>
  (function () {
    var blocs = document.querySelectorAll('.reveler');
    if (!('IntersectionObserver' in window)) {
      blocs.forEach(function (b) { b.classList.add('vu'); });
      return;
    }
    var o = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vu'); o.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    blocs.forEach(function (b) { o.observe(b); });
  })();
</` + `script>`;

/* ------------------------------------------------------------------ */
/* La page d'un projet                                                 */
/* ------------------------------------------------------------------ */

const CSS_PROJET = `
.retour { display: inline-block; font-size: .88rem; color: var(--plume);
  text-decoration: none; margin-bottom: 2rem; }
.retour:hover { color: var(--accent); }
.chapeau { font-size: 1.15rem; line-height: 1.55; color: var(--encre);
  max-width: 40rem; margin: 1rem 0 0; }
.accroche { max-width: 40rem; margin: .8rem 0 0; font-size: 1rem; }
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
/* Une version precedente reste atteignable — son adresse vit dans des
   documents — mais elle ne se presente plus comme le chemin a prendre. */
.vue.passee { opacity: .62; }
.vue.passee em { font-style: normal; font-weight: 400; font-size: .78rem;
  color: var(--plume); }
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
.apercu { margin-top: 0; }
.cadre { position: relative; border: 1px solid var(--filet); border-radius: 12px;
  overflow: hidden; background: var(--surface); aspect-ratio: 1200 / 630; }
.cadre img { display: block; width: 100%; height: 100%; object-fit: cover; }
.cadre iframe { display: block; width: 100%; height: 100%; border: 0; }
.cadre.vivant { aspect-ratio: auto; height: 70vh; min-height: 26rem; }
.lancer { position: absolute; inset: 0; margin: auto; width: max-content; height: max-content;
  padding: .8rem 1.4rem; border-radius: 999px; border: 0; cursor: pointer;
  font: inherit; font-weight: 600; color: #fff; background: var(--accent);
  box-shadow: 0 6px 24px rgba(0,0,0,.28); }
.lancer:hover { filter: brightness(1.08); }
.mention { font-size: .85rem; margin-top: .7rem; }
`;

/**
 * L'image d'apercu d'un projet, si elle existe.
 *
 * Une capture du widget en fonctionnement : elle sert deux fois — en tete de la
 * page, et comme vignette quand le lien est partage. Sans elle, un lien colle
 * sur un forum n'affiche qu'un titre.
 *
 * PNG pour les interfaces (aplats, texte net), JPEG quand la capture est une
 * carte : le meme rendu 3D pesait 1,3 Mo en PNG contre 350 Ko en JPEG, pour une
 * difference invisible a l'oeil.
 */
function apercuDe(id) {
  for (const ext of ['png', 'jpg']) {
    if (fs.existsSync(path.join(PUBLIE, 'w', id, `apercu.${ext}`))) return `apercu.${ext}`;
  }
  return '';
}

/**
 * Un cadre : une image, et le widget derriere si on le demande.
 *
 * Le widget n'est pas charge d'emblee — une carte tire une bibliotheque, des
 * tuiles et un rendu 3D, et l'imposer a qui passe lire une page serait le faire
 * payer pour rien. L'image tient lieu d'apercu, le clic lance, a cet instant
 * seulement.
 */
function cadre({ url, image, alt, libelle = 'Lancer l’aperçu' }) {
  return `    <div class="cadre" data-widget="${echapper(url)}">
      <img src="${echapper(image)}" alt="${echapper(alt)}" loading="lazy">
      <button type="button" class="lancer">${echapper(libelle)}</button>
    </div>`;
}

/**
 * Le script qui anime les cadres, pose une fois par page.
 *
 * Il vivait dans la section d'apercu ; une demonstration placee ailleurs — dans
 * un contexte, plus bas — se serait donc retrouvee sans lui le jour ou la page
 * n'a pas d'apercu en tete.
 */
const JS_CADRES = `
<script>
  document.querySelectorAll('.cadre').forEach(function (cadre) {
    var bouton = cadre.querySelector('.lancer');
    if (!bouton) return;
    bouton.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = cadre.dataset.widget;
      f.title = 'Aperçu';
      f.loading = 'lazy';
      f.allow = 'fullscreen';
      cadre.innerHTML = '';
      cadre.appendChild(f);
      cadre.classList.add('vivant');
    });
  });
</` + `script>`;

/**
 * L'apercu en tete de page.
 *
 * Il montre le widget seul, et c'est deliberé : une page publique ne doit pas
 * dependre d'un document de travail, dont les droits, le contenu ou l'existence
 * peuvent changer sans qu'elle le sache. Une fiche peut viser une autre adresse
 * si elle en a une qui lui appartient.
 */
function sectionApercu(p, image) {
  if (!image) return '';
  // Celui qu'on met en avant, pas le premier venu du manifeste : sur
  // qgis2grist, l'apercu lancait la v1 que la page annonce comme depassee.
  const principal = principalDe(p);
  const demo = (p.presentation.produit || {}).apercu || {};
  const url = demo.url || `${principal.url}${principal.url.includes('?') ? '&' : '?'}vitrine=1`;
  const mention = demo.mention
    || 'L’aperçu s’exécute dans votre navigateur, sans document Grist : les données y sont fictives.';
  return `  <section class="apercu">
${cadre({ url, image, alt: `Aperçu du widget ${p.presentation.nom || p.id}` })}
    <p class="mention">${echapper(mention)}</p>
  </section>`;
}

/**
 * Le widget mis en avant.
 *
 * Ce n'est pas forcement le premier du manifeste : une v2 y arrive apres la v1
 * qu'elle remplace, sans que l'ordre le dise. Et l'URL de la v1 ne peut pas
 * etre reprise — elle est enregistree dans des documents. C'est donc la fiche
 * qui designe ce qu'on montre d'abord.
 */
function principalDe(p) {
  const vise = p.presentation && p.presentation.principal;
  return p.widgets.find((w) => w.widgetId === vise) || p.widgets[0];
}

/** Les vues qu'on ne met plus en avant, sans les retirer : leur URL vit ailleurs. */
function estArchive(p, w) {
  const liste = (p.presentation && p.presentation.archives) || [];
  return liste.includes(w.widgetId);
}

/** Une vue du projet, avec l'adresse a coller dans Grist. */
function ligneWidget(w, archive = false) {
  return `      <div class="vue${archive ? ' passee' : ''}">
        <b>${echapper(w.name)}${archive ? ' <em>version précédente</em>' : ''}</b>
        <span>${echapper(w.description || '')}</span>
        <a href="${echapper(w.url)}" target="_blank" rel="noopener">ouvrir</a>
      </div>`;
}

function rendreProjet(p, maintenant, base = '') {
  const v = p.presentation;
  const maj = majProjet(p);
  const nom = v.nom || p.widgets[0].name || p.id;
  const principal = principalDe(p);
  const acces = principal.accessLevel === 'full' ? 'lecture et écriture'
    : principal.accessLevel === 'read table' ? 'lecture seule' : 'aucun accès aux données';

  const image = apercuDe(p.id);
  const produit = v.produit || {};
  const sections = [];

  const ap = sectionApercu(p, image);
  if (ap) sections.push(ap);
  for (const bloc of [blocChiffres(produit), blocContextes(produit)]) if (bloc) sections.push(bloc);

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
${p.widgets.map((w) => ligneWidget(w, estArchive(p, w))).join('\n')}
    </div>
  </section>`);
  }

  const seq = blocSequence(produit);
  if (seq) sections.push(seq);

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
    peau: v.peau,
    meta: url ? entete({ url, titre, description, image }) : '',
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
    css: CSS_PROJET + (Object.keys(produit).length ? CSS_PRODUIT : ''),
    corps: `<main>
  <a class="retour" href="../../">← Tous les widgets</a>
  <p class="eyebrow">Widget Grist</p>
  <h1>${echapper(nom)}</h1>
  <p class="chapeau">${echapper(v.pitch || principal.description || '')}</p>
  ${produit.accroche ? `<p class="accroche">${echapper(produit.accroche)}</p>` : ''}
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
</main>${sections.some((x) => x.includes('class="cadre"')) ? JS_CADRES : ''}${Object.keys(produit).length ? JS_REVELER : ''}
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
