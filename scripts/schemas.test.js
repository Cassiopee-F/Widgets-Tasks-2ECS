/**
 * Les schémas publiés valident-ils les données réelles ?
 *
 * Un contrat qui rejette ce que ses propres producteurs émettent ne contraint
 * rien : il ment. On le vérifie donc contre les fixtures attestées — celles qui
 * viennent de vrais imports — plutôt que contre des exemples écrits pour lui.
 *
 * Le validateur est minimal et fait maison : le dépôt tient à n'avoir aucune
 * dépendance de build, et on n'utilise qu'une part réduite de draft-07 —
 * type, required, enum, const, properties, items, oneOf, $ref local.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SCHEMAS = path.join(RACINE, 'published', 'schemas');

/* ------------------------------------------------------------------ */
/* Un validateur juste assez complet                                   */
/* ------------------------------------------------------------------ */

function resoudre(ref, racine) {
  if (!ref.startsWith('#/')) throw new Error('référence externe non gérée : ' + ref);
  return ref.slice(2).split('/').reduce((o, k) => o && o[k], racine);
}

const typeDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** Retourne la liste des écarts. Vide = conforme. */
function valider(valeur, schema, racine, chemin = '') {
  if (!schema || schema === true) return [];
  const ecarts = [];
  const ou = (m) => ecarts.push(`${chemin || '(racine)'} : ${m}`);

  if (schema.$ref) return valider(valeur, resoudre(schema.$ref, racine), racine, chemin);

  if (schema.const !== undefined && valeur !== schema.const) {
    ou(`attendu ${JSON.stringify(schema.const)}, reçu ${JSON.stringify(valeur)}`);
  }

  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(valeur))) {
    ou(`valeur hors énumération : ${JSON.stringify(valeur)}`);
  }

  if (schema.type) {
    const attendus = [].concat(schema.type);
    const t = typeDe(valeur);
    // Un entier est un nombre ; l'inverse n'est vrai que s'il n'a pas de décimale.
    const ok = attendus.some((a) => a === t
      || (a === 'integer' && t === 'number' && Number.isInteger(valeur))
      || (a === 'number' && t === 'number'));
    if (!ok) ou(`type ${t}, attendu ${attendus.join(' ou ')}`);
  }

  if (schema.oneOf) {
    const passants = schema.oneOf.filter((s) => valider(valeur, s, racine, chemin).length === 0);
    if (passants.length !== 1) {
      ou(`oneOf : ${passants.length} branche(s) satisfaite(s), une seule attendue`);
    }
  }

  if (typeDe(valeur) === 'object') {
    for (const requis of schema.required || []) {
      if (!(requis in valeur)) ou(`propriété requise absente : ${requis}`);
    }
    for (const [cle, sousSchema] of Object.entries(schema.properties || {})) {
      if (cle in valeur) {
        ecarts.push(...valider(valeur[cle], sousSchema, racine, chemin ? `${chemin}.${cle}` : cle));
      }
    }
    if (schema.additionalProperties === false) {
      for (const cle of Object.keys(valeur)) {
        if (!(schema.properties || {})[cle]) ou(`propriété non déclarée : ${cle}`);
      }
    }
  }

  if (typeDe(valeur) === 'array' && schema.items) {
    valeur.forEach((v, i) => {
      ecarts.push(...valider(v, schema.items, racine, `${chemin}[${i}]`));
    });
    if (schema.minItems != null && valeur.length < schema.minItems) ou('trop peu d’éléments');
    if (schema.maxItems != null && valeur.length > schema.maxItems) ou('trop d’éléments');
  }

  if (typeDe(valeur) === 'number') {
    if (schema.minimum != null && valeur < schema.minimum) ou(`${valeur} < ${schema.minimum}`);
    if (schema.maximum != null && valeur > schema.maximum) ou(`${valeur} > ${schema.maximum}`);
  }

  return ecarts;
}

const lire = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/* ------------------------------------------------------------------ */

test('chaque schéma publié est un JSON valide et se désigne par une adresse atteignable', () => {
  const fichiers = fs.readdirSync(SCHEMAS).filter((f) => f.endsWith('.schema.json'));
  assert.ok(fichiers.length >= 2, 'au moins deux contrats publiés');

  for (const f of fichiers) {
    const s = lire(path.join(SCHEMAS, f));
    assert.ok(s.$schema, `${f} : doit déclarer sa version de JSON Schema`);
    // Un $id qui pointe dans le vide interdit toute résolution de référence,
    // et c'est précisément ce qu'on corrige ici.
    assert.match(s.$id || '', /^https:\/\/[a-z0-9.-]+\.(io|org|fr|com|net)\//,
      `${f} : $id doit être une adresse réelle, pas un domaine fictif`);
    assert.ok(s.$id.endsWith(f), `${f} : le $id doit finir par le nom du fichier servi`);
    assert.match(s.$id, /-\d+\.\d+(\.\d+)?\.schema\.json$/,
      `${f} : le $id doit porter une version, pour qu'un agent puisse la cibler`);
    assert.ok(s.description, `${f} : un agent lit la description avant le schéma`);
  }
});

test('le Scene Manifest valide les scènes réellement produites', () => {
  const schema = lire(path.join(SCHEMAS, 'scene-manifest-0.2.2.schema.json'));
  const dossier = path.join(RACINE, 'projects', 'Atlas', 'tests', 'fixtures');
  const fixtures = fs.readdirSync(dossier).filter((f) => /^scene-manifest.*\.json$/.test(f));

  assert.ok(fixtures.length >= 2, 'des scènes attestées doivent exister');

  for (const f of fixtures) {
    let scene = lire(path.join(dossier, f));
    scene = scene.scene || scene.manifest || scene;
    const ecarts = valider(scene, schema, schema);
    assert.deepEqual(ecarts, [], `${f} rejetée par le schéma :\n  ${ecarts.join('\n  ')}`);
  }
});

test('le schéma refuse ce qui n’est pas une scène', () => {
  const schema = lire(path.join(SCHEMAS, 'scene-manifest-0.2.2.schema.json'));
  // Sans cette vérification, un schéma tout permissif passerait le test
  // précédent sans rien garantir.
  assert.ok(valider({}, schema, schema).length > 0, 'un objet vide doit être refusé');
  assert.ok(valider({ version: '9.9', layers: [] }, schema, schema).length > 0,
    'une version inconnue doit être refusée');
  assert.ok(valider({ version: '0.2.2', layers: [{}] }, schema, schema).length > 0,
    'une couche sans nom doit être refusée');
  assert.ok(
    valider({ version: '0.2.2', layers: [{ name: 'x', controls: [{ field: 'f', type: 'zigzag' }] }] },
      schema, schema).length > 0,
    'un type de contrôle inconnu doit être refusé');
});

test('FormDef publié reste identique à celui que lit le widget', () => {
  const publie = lire(path.join(SCHEMAS, 'formdef-1.0.schema.json'));
  const source = lire(path.join(RACINE, 'projects', 'grist_forms', 'runtime', 'formdef.schema.json'));
  // Deux copies d'un contrat qui divergent, c'est deux contrats. Seul le $id
  // peut différer : la copie servie porte son adresse publique.
  const sansId = (o) => { const c = { ...o }; delete c.$id; return c; };
  assert.deepEqual(sansId(publie), sansId(source),
    'le schéma servi et le schéma lu par le widget doivent rester le même');
});

test('l’index porte une empreinte juste de chaque contrat', () => {
  // Un consommateur qui garde une copie locale n'a pas d'autre moyen de savoir
  // qu'elle a divergé — sauf à rapatrier le schéma entier à chaque usage.
  // L'empreinte doit donc suivre le fichier servi, sinon elle ment.
  const crypto = require('crypto');
  const idx = lire(path.join(SCHEMAS, 'index.json'));
  assert.ok(idx.contrats?.length, 'l’index doit lister des contrats');

  for (const c of idx.contrats) {
    const nom = c.schema.split('/').pop();
    const chemin = path.join(SCHEMAS, nom);
    assert.ok(fs.existsSync(chemin), `${nom} : cité par l’index mais absent`);

    const contenu = fs.readFileSync(chemin);
    const attendu = 'sha256:' + crypto.createHash('sha256').update(contenu).digest('hex').slice(0, 16);
    assert.equal(c.empreinte, attendu,
      `${nom} : empreinte périmée — l’index n’a pas été régénéré après modification`);
    assert.equal(c.octets, contenu.length, `${nom} : taille périmée`);
  }
});

module.exports = { valider };
