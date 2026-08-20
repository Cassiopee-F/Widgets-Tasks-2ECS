import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  rendre, encoderPNG, poserIcones, DENSITES, ENCRE, VERMILLON,
} from './icones.mjs';

const pixel = ({ pixels, largeur }, x, y) => {
  const i = (y * largeur + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
};
const proche = (a, b, marge = 6) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= marge);

test('la marque se detache de son fond', () => {
  const img = rendre(256);
  assert.ok(proche(pixel(img, 2, 2), ENCRE), 'les coins sont l’encre d’Atlas');
  assert.equal(pixel(img, 2, 2)[3], 255, 'le fond est opaque');
  // A gauche de l'arete, sous le sommet : en plein flanc, quelle que soit
  // l'echelle retenue.
  assert.ok(proche(pixel(img, 90, 154), VERMILLON), 'le flanc est vermillon');
});

test('la marque occupe la place annoncee', () => {
  // `echelle` est une promesse : a 0.62, la pyramide couvre 62 % du cote. Si le
  // cadrage derive, l'icone retrecit sans que rien ne le signale.
  const cote = 256;
  const img = rendre(cote, { fond: null, echelle: 0.62 });
  let min = cote; let max = 0;
  for (let y = 0; y < cote; y++) {
    for (let x = 0; x < cote; x++) {
      if (pixel(img, x, y)[3] > 128) { min = Math.min(min, x); max = Math.max(max, x); }
    }
  }
  const largeur = (max - min + 1) / cote;
  assert.ok(Math.abs(largeur - 0.62) < 0.02, `largeur ${largeur.toFixed(3)}, attendu 0.62`);
  assert.ok(Math.abs((min + max) / 2 - cote / 2) < 2, 'la marque est centree');
});

test('l’arete eclairee traverse la pyramide', () => {
  // Sans elle, la marque n'est qu'un triangle : c'est ce trait qui donne le
  // volume, et il doit survivre a la reduction.
  const img = rendre(64);
  const centre = pixel(img, 32, 40);
  assert.ok(centre[0] > VERMILLON[0] + 20, `attendu plus clair que le flanc, obtenu ${centre}`);
});

test('l’avant-plan adaptatif est transparent', () => {
  // Le fond est une couleur qu'Android anime seule ; un avant-plan opaque
  // l'ecraserait et supprimerait le relief au survol.
  const img = rendre(216, { fond: null, echelle: 0.40 });
  assert.equal(pixel(img, 3, 3)[3], 0);
});

test('l’avant-plan tient dans la zone qu’Android ne rogne pas', () => {
  // Une icone adaptative de 108 dp n'en montre que 72 au centre : le reste est
  // rogne par la forme du lanceur. Une marque dessinee trop grande y perdrait
  // sa base — invisible ici, visible sur le telephone de quelqu'un d'autre.
  const cote = 216;
  const img = rendre(cote, { fond: null, echelle: 0.40 });
  const marge = Math.floor((cote * (108 - 72)) / 108 / 2);   // 18 dp de chaque bord
  let debord = 0;
  for (let y = 0; y < cote; y++) {
    for (let x = 0; x < cote; x++) {
      const dedans = x >= marge && x < cote - marge && y >= marge && y < cote - marge;
      if (!dedans && pixel(img, x, y)[3] > 8) debord++;
    }
  }
  assert.equal(debord, 0, `${debord} pixels hors de la zone sure`);
});

test('le PNG produit est lisible', () => {
  const png = encoderPNG(rendre(48));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(png.readUInt32BE(16), 48, 'largeur declaree');
  assert.equal(png.readUInt32BE(20), 48, 'hauteur declaree');
  assert.equal(png.subarray(png.length - 8, png.length - 4).toString('ascii'), 'IEND');
});

test('toutes les densites qu’Android reclame sont posees', () => {
  // Il en manque une, et le lanceur remonte a la densite superieure : l'icone
  // parait floue sur les appareils concernes, sans qu'aucune erreur ne le dise.
  const res = mkdtempSync(join(tmpdir(), 'atlas-res-'));
  poserIcones(res);
  for (const densite of Object.keys(DENSITES)) {
    const fichiers = readdirSync(join(res, `mipmap-${densite}`));
    assert.deepEqual(fichiers.sort(),
      ['ic_launcher.png', 'ic_launcher_foreground.png', 'ic_launcher_round.png']);
  }
  const xml = readFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), 'utf8');
  assert.match(xml, /adaptive-icon/);
  assert.match(xml, /@mipmap\/ic_launcher_foreground/);
  assert.match(readFileSync(join(res, 'values', 'ic_launcher_background.xml'), 'utf8'), /#1F1B14/);
});

test('chaque densite est rendue a sa taille, pas mise a l’echelle', () => {
  const res = mkdtempSync(join(tmpdir(), 'atlas-res-'));
  poserIcones(res);
  for (const [densite, cote] of Object.entries(DENSITES)) {
    const png = readFileSync(join(res, `mipmap-${densite}`, 'ic_launcher.png'));
    assert.equal(png.readUInt32BE(16), cote, `${densite} devrait faire ${cote} px`);
  }
});
