/**
 * generate-manifest.js
 *
 * Génère le manifest.json pour le catalogue de widgets Grist
 * en scannant les package.json dans published/
 *
 * Usage: node scripts/generate-manifest.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Compte et depot proprietaires des URLs publiees.
 *
 * La CI les fournit (`github.repository_owner`). En local, personne ne les
 * exporte : le repli historique `VOTRE_USER` produisait alors un manifest ou
 * les quinze widgets pointaient vers un compte inexistant — un fichier
 * parfaitement valide, donc silencieux, qu'un `npm run manifest` de routine
 * suffisait a commiter. On deduit donc le compte du remote git, et on refuse
 * d'ecrire plutot que d'inventer une URL.
 */
function origineGit() {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    }).trim();
    // git@github.com:owner/repo.git | https://github.com/owner/repo.git
    const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
    return m ? { user: m[1], repo: m[2] } : null;
  } catch {
    return null;
  }
}

const origine = origineGit();
const GITHUB_USER = process.env.GITHUB_USER || origine?.user;
const REPO_NAME = process.env.REPO_NAME || origine?.repo || 'Widgets-Grist';
if (!GITHUB_USER) {
  console.error('Compte GitHub introuvable : ni GITHUB_USER, ni remote git.');
  console.error('Relancez avec GITHUB_USER=<compte> node scripts/generate-manifest.js');
  process.exit(1);
}
const BASE_URL = `https://${GITHUB_USER}.github.io/${REPO_NAME}`;
const PUBLISHED_DIR = path.join(__dirname, '..', 'published');
const OUTPUT_FILE = path.join(PUBLISHED_DIR, 'manifest.json');

console.log('Generating Grist widget manifest...');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Scanning: ${PUBLISHED_DIR}`);

const widgets = [];

// Vérifier que le dossier published existe
if (!fs.existsSync(PUBLISHED_DIR)) {
    console.log('Creating published/ directory...');
    fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
}

// Scanner les sous-dossiers de published/
const entries = fs.readdirSync(PUBLISHED_DIR, { withFileTypes: true });

for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const widgetDir = path.join(PUBLISHED_DIR, entry.name);
    const packagePath = path.join(widgetDir, 'package.json');

    if (!fs.existsSync(packagePath)) {
        console.log(`  Skipping ${entry.name}/ (no package.json)`);
        continue;
    }

    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

        if (!pkg.grist) {
            console.log(`  Skipping ${entry.name}/ (no grist config)`);
            continue;
        }

        // Supporter à la fois un objet unique ou un tableau de widgets
        const gristConfigs = Array.isArray(pkg.grist) ? pkg.grist : [pkg.grist];

        for (const config of gristConfigs) {
            // Construire l'URL complète
            // Si config.url est relative (pas http), la préfixer avec BASE_URL/entry.name/
            let widgetUrl;
            if (config.url && config.url.startsWith('http')) {
                widgetUrl = config.url;
            } else if (config.url) {
                widgetUrl = `${BASE_URL}/${entry.name}/${config.url}`;
            } else {
                widgetUrl = `${BASE_URL}/${entry.name}/`;
            }

            const widget = {
                widgetId: config.widgetId || pkg.name,
                name: config.name || pkg.name,
                url: widgetUrl,
                published: true,
                accessLevel: config.accessLevel || 'none',
                renderAfterReady: config.renderAfterReady !== false,
                description: config.description || pkg.description || '',
                lastUpdatedAt: new Date().toISOString(),
                ...(config.authors && { authors: config.authors }),
                ...(pkg.authors && !config.authors && { authors: pkg.authors }),
            };

            widgets.push(widget);
            console.log(`  + ${widget.name} (${widget.widgetId})`);
        }
    } catch (err) {
        // Un package.json illisible faisait disparaître son widget du manifest
        // sans que rien ne s'y oppose : le catalogue partait amputé en
        // production, et les utilisateurs perdaient le widget de leur sélecteur.
        // C'est arrivé — des marqueurs de conflit laissés dans
        // published/qgis2grist/package.json ont retiré deux widgets du
        // manifest. Mieux vaut ne pas générer de catalogue qu'en générer un faux.
        console.error(`\nÉchec : ${entry.name}/package.json illisible — ${err.message}`);
        console.error('Le manifest n\'a pas été régénéré (il serait amputé de ce widget).');
        process.exit(1);
    }
}

// Écrire le manifest
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(widgets, null, 2));
console.log(`\nGenerated ${OUTPUT_FILE}`);
console.log(`Total widgets: ${widgets.length}`);

// Afficher l'URL du manifest pour Grist
console.log(`\nPour configurer Grist, utilisez:`);
console.log(`GRIST_WIDGET_LIST_URL=${BASE_URL}/manifest.json`);
