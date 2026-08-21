#!/usr/bin/env node
/**
 * Met a jour, sur le forum, le message d'annonce d'un widget.
 *
 * Il REECRIT un message existant. Il ne sait pas en creer, et c'est
 * deliberé : ouvrir un fil est un geste qu'on pose une fois, en connaissance de
 * cause. Une erreur de configuration ne doit pas pouvoir deposer dix sujets sur
 * un forum communautaire — l'automatisation entretient ce qui existe, elle ne
 * publie pas a la place de quelqu'un.
 *
 * Par defaut il ne fait rien d'autre que montrer ce qu'il enverrait. Il faut
 * `--publier` pour que la requete parte.
 *
 * Usage :
 *   node scripts/publish-post.js atlas              # simulation
 *   node scripts/publish-post.js atlas --publier    # ecrit vraiment
 *
 * Identifiants, jamais dans le code :
 *   DISCOURSE_URL           https://forum.grist.libre.sh
 *   DISCOURSE_API_KEY       cle utilisateur (secret du depot)
 *   DISCOURSE_API_USERNAME  le compte au nom duquel on edite
 */

const fs = require('fs');
const path = require('path');
const { rendre } = require('./generate-post.js');

const PUBLIE = path.join(__dirname, '..', 'published');

/** Ou publier, et sous quelle identite. Rien de tout cela n'est ecrit ici. */
function identifiants() {
  const base = (process.env.DISCOURSE_URL || 'https://forum.grist.libre.sh').replace(/\/+$/, '');
  const cle = process.env.DISCOURSE_API_KEY;
  const compte = process.env.DISCOURSE_API_USERNAME;
  return { base, cle, compte };
}

/**
 * Le message a reecrire, designe par la fiche.
 *
 * Sans `forum.postId`, on s'arrete : deviner quel message mettre a jour
 * reviendrait a ecrire dans celui de quelqu'un d'autre.
 */
function cible(projet) {
  const f = path.join(PUBLIE, projet, 'vitrine.json');
  if (!fs.existsSync(f)) throw new Error(`fiche introuvable pour « ${projet} »`);
  const fiche = JSON.parse(fs.readFileSync(f, 'utf8'));
  const forum = fiche.forum || {};
  if (!forum.postId) {
    throw new Error(
      `« ${projet} » n'a pas de \`forum.postId\` dans sa fiche.\n`
      + '  Ce script ne crée pas de sujet : ouvrez le fil à la main, puis notez\n'
      + '  l\'identifiant du premier message dans `vitrine.json`.');
  }
  return { postId: forum.postId, url: forum.url };
}

async function envoyer(projet, { publier, raison }) {
  const { base, cle, compte } = identifiants();
  const { postId, url } = cible(projet);
  const markdown = rendre(projet);

  console.log(`Projet   : ${projet}`);
  console.log(`Message  : ${base}/p/${postId}${url ? `  (${url})` : ''}`);
  console.log(`Contenu  : ${markdown.length} caractères, ${(markdown.match(/^## /gm) || []).length} sections`);
  console.log(`Raison   : ${raison}`);

  if (!publier) {
    console.log('\nSIMULATION — rien n\'a été envoyé.');
    console.log('Ajoutez --publier pour écrire réellement.');
    return { simule: true };
  }
  if (!cle || !compte) {
    throw new Error('DISCOURSE_API_KEY et DISCOURSE_API_USERNAME sont requis pour publier.');
  }

  const r = await fetch(`${base}/posts/${postId}.json`, {
    method: 'PUT',
    headers: {
      'Api-Key': cle,
      'Api-Username': compte,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ post: { raw: markdown, edit_reason: raison } }),
  });

  const corps = await r.text();
  if (!r.ok) {
    throw new Error(`le forum a refusé (HTTP ${r.status}) : ${corps.slice(0, 300)}`);
  }
  let version = '?';
  try { version = JSON.parse(corps).post_number ? JSON.parse(corps).version : '?'; } catch (_) { /* peu importe */ }
  console.log(`\nMessage mis à jour (version ${version}).`);
  return { simule: false };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const projet = args.find((a) => !a.startsWith('--'));
  const publier = args.includes('--publier');
  const raison = (args.find((a) => a.startsWith('--raison=')) || '').slice(9)
    || 'Mise à jour depuis la fiche du dépôt';

  if (!projet) {
    console.error('Usage : node scripts/publish-post.js <projet> [--publier] [--raison="…"]');
    process.exit(1);
  }
  envoyer(projet, { publier, raison }).catch((e) => {
    console.error('\n' + e.message);
    process.exit(1);
  });
}

module.exports = { cible, identifiants };
