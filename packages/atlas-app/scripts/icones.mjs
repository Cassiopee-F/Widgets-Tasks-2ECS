/**
 * Les icones de l'application, dessinees a partir de la marque Atlas.
 *
 * `cap add android` pose des icones Capacitor generiques : dans un tiroir
 * d'applications, rien ne distingue Atlas d'une autre enveloppe. Ce script
 * redessine la marque — la meme pyramide que la barre du widget — a toutes les
 * densites qu'Android demande.
 *
 * Aucune dependance : le rendu est un remplissage de polygone surechantillonne,
 * l'encodage un PNG sans filtre passe a `zlib`. Une icone n'a pas besoin de
 * `sharp` ni d'un telechargement pour exister, et un build hors ligne doit
 * rester possible.
 *
 * Le fond est l'encre d'Atlas plutot que son creme : sur un ecran d'accueil,
 * une icone claire se perd dans les fonds clairs, et c'est le contraste qui la
 * rend reconnaissable a 48 px.
 */

import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/* La marque, dans son repere d'origine (viewBox 32x32 du widget). */
export const MARQUE = {
  boite: 32,
  corps: [[4, 24], [16, 6], [28, 24], [16, 28]],   // la pyramide vue de biais
  arete: { x: 16, y1: 6, y2: 28, largeur: 1.2 },   // l'arete eclairee
};

export const ENCRE = [0x1F, 0x1B, 0x14];
export const VERMILLON = [0xC4, 0x45, 0x36];
export const CREME = [0xF4, 0xEF, 0xE3];

const SUPER = 4;   // 16 echantillons par pixel : assez pour des bords nets a 48 px

/** Un point est-il dans le polygone ? Lancer de rayon, suffisant pour un convexe. */
function dansPolygone(x, y, points) {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/**
 * Dessine la marque en RGBA.
 *
 * @param {number} largeur en pixels
 * @param {{fond: number[]|null, echelle: number, hauteur: number}} o `fond` nul
 *   = transparent (l'avant-plan d'une icone adaptative) ; `echelle` est la part
 *   du plus petit cote occupee par la marque — Android rogne jusqu'au tiers
 *   d'une icone adaptative, donc son avant-plan doit rester en deca du bord.
 *   `hauteur` permet un format non carre (l'ecran de lancement) : la marque y
 *   garde ses proportions, seul le fond s'etend.
 */
export function rendre(largeur, { fond = ENCRE, echelle = 0.62, hauteur = largeur } = {}) {
  const px = new Uint8Array(largeur * hauteur * 4);
  if (fond) {
    for (let i = 0; i < largeur * hauteur; i++) {
      px[i * 4] = fond[0]; px[i * 4 + 1] = fond[1]; px[i * 4 + 2] = fond[2]; px[i * 4 + 3] = 255;
    }
  }

  // La marque n'occupe pas tout son viewBox : on la cadre sur son etendue reelle,
  // sinon elle paraitrait decentree et plus petite qu'annonce.
  const xs = MARQUE.corps.map((p) => p[0]);
  const ys = MARQUE.corps.map((p) => p[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs);
  const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const etendue = Math.max(x1 - x0, y1 - y0);
  const k = (Math.min(largeur, hauteur) * echelle) / etendue;
  const dx = largeur / 2 - ((x0 + x1) / 2) * k;
  const dy = hauteur / 2 - ((y0 + y1) / 2) * k;

  const corps = MARQUE.corps.map(([x, y]) => [x * k + dx, y * k + dy]);
  const a = MARQUE.arete;
  const ax = a.x * k + dx;
  const demi = Math.max(0.5, (a.largeur * k) / 2);
  const ay1 = a.y1 * k + dy;
  const ay2 = a.y2 * k + dy;

  const pas = 1 / SUPER;
  const n = SUPER * SUPER;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      let nCorps = 0; let nArete = 0;
      for (let sy = 0; sy < SUPER; sy++) {
        for (let sx = 0; sx < SUPER; sx++) {
          const ex = x + (sx + 0.5) * pas;
          const ey = y + (sy + 0.5) * pas;
          if (!dansPolygone(ex, ey, corps)) continue;
          nCorps++;
          if (Math.abs(ex - ax) <= demi && ey >= ay1 && ey <= ay2) nArete++;
        }
      }
      if (!nCorps) continue;
      const partArete = nArete / nCorps;
      const teinte = [0, 1, 2].map((c) => VERMILLON[c] * (1 - partArete) + CREME[c] * partArete);
      poser(px, largeur, x, y, teinte, nCorps / n);
    }
  }
  return { largeur, hauteur, pixels: px };
}

/** Compose une couleur sur le pixel existant, selon sa couverture. */
function poser(px, taille, x, y, couleur, alpha) {
  const i = (y * taille + x) * 4;
  const aFond = px[i + 3] / 255;
  const aSortie = alpha + aFond * (1 - alpha);
  for (let c = 0; c < 3; c++) {
    px[i + c] = aSortie === 0 ? 0
      : Math.round((couleur[c] * alpha + px[i + c] * aFond * (1 - alpha)) / aSortie);
  }
  px[i + 3] = Math.round(aSortie * 255);
}

/* ------------------------------------------------------------------ */
/* Encodage PNG                                                        */
/* ------------------------------------------------------------------ */

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function morceau(type, donnees) {
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const taille = Buffer.alloc(4); taille.writeUInt32BE(donnees.length);
  const somme = Buffer.alloc(4); somme.writeUInt32BE(crc32(corps));
  return Buffer.concat([taille, corps, somme]);
}

/** PNG 8 bits RGBA, sans filtre : la compression fait le reste. */
export function encoderPNG({ largeur, hauteur, pixels }) {
  const brut = Buffer.alloc(hauteur * (1 + largeur * 4));
  const src = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  for (let y = 0; y < hauteur; y++) {
    const d = y * (1 + largeur * 4);
    brut[d] = 0;   // filtre « aucun »
    src.copy(brut, d + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8;    // 8 bits par canal
  ihdr[9] = 6;    // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    morceau('IHDR', ihdr),
    morceau('IDAT', deflateSync(brut, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Ce qu'Android attend                                                */
/* ------------------------------------------------------------------ */

/** Cotes de `ic_launcher` par densite, en pixels. */
export const DENSITES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

/** L'avant-plan adaptatif fait 108 dp la ou l'icone legacy en fait 48. */
const FACTEUR_ADAPTATIF = 108 / 48;

const ADAPTATIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

const COULEURS_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1F1B14</color>
</resources>
`;

function ecrire(chemin, contenu) {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu);
  return chemin;
}

/** Ecrit toutes les icones sous `res/`, et rend la liste des fichiers poses. */
export function poserIcones(res) {
  const faits = [];
  for (const [densite, cote] of Object.entries(DENSITES)) {
    const dossier = join(res, `mipmap-${densite}`);
    const carre = encoderPNG(rendre(cote));
    faits.push(ecrire(join(dossier, 'ic_launcher.png'), carre));
    // Le lanceur decoupe lui-meme le cercle a partir de l'icone adaptative ;
    // la version « round » ne sert que de repli, ou un carre suffit.
    faits.push(ecrire(join(dossier, 'ic_launcher_round.png'), carre));
    // Avant-plan transparent : le fond est la couleur, qu'Android anime seule.
    const av = rendre(Math.round(cote * FACTEUR_ADAPTATIF), { fond: null, echelle: 0.40 });
    faits.push(ecrire(join(dossier, 'ic_launcher_foreground.png'), encoderPNG(av)));
  }
  faits.push(ecrire(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), ADAPTATIVE_XML));
  faits.push(ecrire(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), ADAPTATIVE_XML));
  faits.push(ecrire(join(res, 'values', 'ic_launcher_background.xml'), COULEURS_XML));
  faits.push(...poserSplash(res));
  return faits;
}

/** Largeur et hauteur declarees par l'entete d'un PNG. */
function dimensionsPNG(chemin) {
  const t = readFileSync(chemin).subarray(16, 24);
  return { largeur: t.readUInt32BE(0), hauteur: t.readUInt32BE(4) };
}

/**
 * L'ecran de lancement, pour qu'Atlas ne s'ouvre pas sur un blanc qu'on ne
 * retrouve nulle part ailleurs dans l'application.
 *
 * `cap add` pose un `splash.png` par orientation et par densite. Ecrire le seul
 * `drawable/splash.png` ne servirait a rien : Android prefere toujours la
 * variante la plus specifique, et l'ecran resterait celui de Capacitor. On
 * reprend donc chaque variante presente, a ses dimensions exactes — le theme
 * de lancement etire son fond sans egard pour les proportions, et un carre
 * mis a la place aplatirait la pyramide.
 */
function poserSplash(res) {
  const faits = [];
  const variantes = readdirSync(res)
    .filter((d) => d.startsWith('drawable'))
    .map((d) => join(res, d, 'splash.png'))
    .filter((f) => existsSync(f));
  for (const fichier of variantes) {
    const { largeur, hauteur } = dimensionsPNG(fichier);
    faits.push(ecrire(fichier, encoderPNG(rendre(largeur, { hauteur, echelle: 0.28 }))));
  }
  if (!faits.length) {   // avant `cap add` : un carre de reference suffit
    faits.push(ecrire(join(res, 'drawable', 'splash.png'), encoderPNG(rendre(1024, { echelle: 0.28 }))));
  }
  return faits;
}

/* Appel direct : `node scripts/icones.mjs [chemin/vers/res]` */
if (process.argv[1] && process.argv[1].endsWith('icones.mjs')) {
  const res = process.argv[2] || 'android/app/src/main/res';
  const faits = poserIcones(res);
  // Une copie carree de reference, pour la page d'installation et l'article.
  ecrire('assets/icon.png', encoderPNG(rendre(1024)));
  console.log(`${faits.length + 1} fichiers ecrits (${res}, assets/icon.png)`);
}
