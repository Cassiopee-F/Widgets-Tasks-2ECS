/**
 * Rassemble Atlas et ses dependances pour l'application installee.
 *
 * Dans un widget, MapLibre, three.js et SunCalc viennent de CDN : la page est
 * servie en ligne, le reseau est la. Une application de terrain doit demarrer
 * sans reseau — ces fichiers sont donc telecharges une fois et embarques, et
 * le HTML est reecrit pour les viser localement.
 *
 * Rien n'est modifie dans `projects/Atlas/` : la source reste la meme pour les
 * trois cibles (widget, navigateur, application).
 */
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..', '..', '..');
const src = join(racine, 'projects', 'Atlas');
const out = join(ici, '..', 'www');

/** Chaque dependance CDN, et ou elle atterrit dans le paquet. */
const VENDOR = [
  ['https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js',  'vendor/maplibre-gl.js'],
  ['https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css', 'vendor/maplibre-gl.css'],
  ['https://unpkg.com/suncalc@1.8.0/suncalc.js',               'vendor/suncalc.js'],
  ['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', 'vendor/three.module.js'],
];

/**
 * three.js charge ses extensions par le chemin `three/addons/`. La carte
 * d'import doit donc pointer le dossier local, sinon GLTFLoader repartirait
 * chercher le CDN au premier modele — et echouerait hors reseau.
 */
const ADDONS = ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js'];

async function telecharger(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} — HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

async function main() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  // 1. Atlas lui-meme
  await cp(join(src, 'lib'), join(out, 'lib'), { recursive: true });
  await cp(join(src, 'app_v7.js'), join(out, 'app_v7.js'));
  const modeles = join(racine, 'published', 'atlas', 'models');
  if (existsSync(modeles)) await cp(modeles, join(out, 'models'), { recursive: true });

  // 2. Les dependances
  let total = 0;
  for (const [url, rel] of VENDOR) {
    total += await telecharger(url, join(out, rel));
    console.log('  ' + rel);
  }
  for (const a of ADDONS) {
    total += await telecharger(
      `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/${a}`,
      join(out, 'vendor/three-addons', a));
    console.log('  vendor/three-addons/' + a);
  }

  // 3. Le HTML, reecrit pour viser le local
  let html = await readFile(join(src, 'index_v7.html'), 'utf8');
  html = html
    .replace(/https:\/\/unpkg\.com\/maplibre-gl@[\d.]+\/dist\/maplibre-gl\.js/g, './vendor/maplibre-gl.js')
    .replace(/https:\/\/unpkg\.com\/maplibre-gl@[\d.]+\/dist\/maplibre-gl\.css/g, './vendor/maplibre-gl.css')
    .replace(/https:\/\/unpkg\.com\/suncalc@[\d.]+\/suncalc\.js/g, './vendor/suncalc.js')
    .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/build\/three\.module\.js/g, './vendor/three.module.js')
    .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/examples\/jsm\//g, './vendor/three-addons/');

  // Le script du plugin Grist n'a aucun sens dans l'application, et sa presence
  // brouillait justement la detection de mode : on le retire du paquet.
  html = html.replace(/\s*<script[^>]*grist-plugin-api\.js[^>]*><\/script>/g, '');

  // Le catalogue 3D est embarque : viser le dossier local plutot que le CDN.
  html = html.replace(/<\/head>/,
    '    <script>window.__ATLAS_MODELES__ = "./models/";</script>\n</head>');

  await writeFile(join(out, 'index.html'), html);

  console.log(`\nwww/ pret — ${(total / 1048576).toFixed(1)} Mo de dependances`);
}

main().catch((e) => { console.error('Vendorisation :', e.message); process.exit(1); });
