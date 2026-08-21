#!/usr/bin/env node
/**
 * Le brouillon d'annonce d'un widget sur le forum.
 *
 * Un post et une page de presentation disent la meme chose a deux publics :
 * celui qui lit la page cherche deja un widget, celui qui lit le forum a un
 * probleme. Les ecrire separement les fait diverger — et c'est la page qui
 * perd, parce qu'on annonce plus souvent qu'on ne met a jour.
 *
 * Ce script rend donc le Markdown depuis la meme fiche, en y ajoutant les trois
 * choses que le forum exige et que la page n'a pas : le constat qui precede
 * l'outil, les usages par metier, et le statut.
 *
 * IL NE PUBLIE RIEN. Il ecrit un fichier a relire, puis a coller. Un message
 * sur un forum public sous le nom de quelqu'un ne se rattrape pas.
 *
 * Le brouillon sort dans `.forum/`, hors de la zone publiee et hors de git. Ce
 * qui se transmet d'un agent au suivant, c'est ce script et la fiche qu'il lit —
 * pas leur sortie, qui se refait en une commande.
 *
 * Usage : node scripts/generate-post.js atlas
 */

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const PUBLIE = path.join(RACINE, 'published');
// Hors de `published/`, et ignore par git : le rendu se refait par une commande,
// il ne se conserve pas. Publie sur Pages il ferait un troisieme exemplaire
// indexable du meme texte — apres la page et apres le forum — au detriment du
// fil qu'on veut justement voir remonter. Versionne, il produirait un diff a
// chaque regeneration sans jamais porter de decision : celles-ci sont dans
// `vitrine.json`, et c'est ce diff-la qu'on relit.
const BROUILLONS = path.join(RACINE, '.forum');
const SEPARATEUR = '\n---\n';

/** L'adresse publique, deduite du manifeste comme le fait la vitrine. */
function baseDe(widgets) {
  for (const w of widgets) {
    try {
      const u = new URL(w.url);
      return `${u.origin}/${u.pathname.split('/').filter(Boolean)[0]}/`;
    } catch (_) { /* suivante */ }
  }
  return '';
}

/** Ce qui est publie sous ce projet, dans l'ordre du manifeste. */
function widgetsDe(id) {
  const brut = JSON.parse(fs.readFileSync(path.join(PUBLIE, 'manifest.json'), 'utf8'));
  const tous = Array.isArray(brut) ? brut : (brut.widgets || []);
  return tous.filter((w) => {
    try { return new URL(w.url).pathname.split('/').filter(Boolean)[1] === id; }
    catch (_) { return false; }
  });
}

/** Le widget mis en avant : la fiche tranche, pas l'ordre du manifeste. */
function principalDe(widgets, fiche) {
  return widgets.find((w) => w.widgetId === fiche.principal) || widgets[0];
}

const acces = (niveau) => (niveau === 'full' ? 'lecture et écriture'
  : niveau === 'read table' ? 'lecture seule' : 'aucun accès aux données');

/**
 * Les images sont pointees, pas televersees.
 *
 * Discourse affiche les images distantes, et celles-ci vivent deja sur la
 * vitrine : les joindre au post en ferait une seconde copie, qui vieillirait
 * separement.
 */
function image(base, id, fichier, legende) {
  return `![${legende}](${base}w/${id}/${fichier})\n*${legende}*`;
}

function rendre(id) {
  const fiche = JSON.parse(fs.readFileSync(path.join(PUBLIE, id, 'vitrine.json'), 'utf8'));
  const widgets = widgetsDe(id);
  if (!widgets.length) throw new Error(`aucun widget publié sous « ${id} »`);
  const base = baseDe(widgets);
  const principal = principalDe(widgets, fiche);
  const nom = fiche.nom || principal.name;
  const produit = fiche.produit || {};
  const bloc = [];

  /* ---- en-tete ---------------------------------------------------- */
  // Ce qu'on vient chercher sur un forum, c'est l'adresse a coller et le niveau
  // d'acces a donner. Le reste peut attendre : on le met donc en premier, avant
  // meme d'expliquer pourquoi le widget existe.
  // Pas de titre de niveau 1 : Discourse affiche deja le titre du sujet
  // au-dessus du message, et le repeter fait deux titres l'un sur l'autre.
  bloc.push(`${fiche.pitch || principal.description || ''}\n`);
  bloc.push('**À coller dans un widget personnalisé :**');
  bloc.push(`\`\`\`\n${principal.url}\n\`\`\``);
  bloc.push(`Accès à donner : **${acces(principal.accessLevel)}**. C'est un fichier HTML autonome — il fonctionne sur n'importe quelle instance Grist, y compris auto-hébergée.`);
  if (fiche.statut) {
    bloc.push(`\n*${fiche.statut.niveau} — ${fiche.statut.texte}*`);
  }

  /* ---- le constat -------------------------------------------------- */
  if (fiche.constat) {
    bloc.push(SEPARATEUR, '## Le constat\n', fiche.constat);
  }

  /* ---- ce que fait le widget --------------------------------------- */
  if ((fiche.points || []).length) {
    bloc.push(SEPARATEUR, `## Ce que fait ${nom}\n`);
    for (const p of fiche.points) {
      bloc.push(`- **${p.titre}** — ${p.texte}`);
    }
  }

  /* ---- en images ---------------------------------------------------- */
  const contextes = produit.contextes || [];
  if (contextes.length) {
    bloc.push(SEPARATEUR, `## ${produit.titreContextes || 'Où ça tourne'}\n`);
    for (const c of contextes) {
      bloc.push(`### ${c.titre}\n`);
      bloc.push(c.texte);
      if (c.pourquoi) bloc.push(`\n> ${c.pourquoi}`);
      // Une capture prise dans un document de travail montre ses tables et ses
      // donnees. Sur une page qu'on maitrise c'est discutable ; dans un message
      // public, ca ne se retire plus. `prive: true` la garde pour la vitrine et
      // l'ecarte du post.
      for (const i of (c.images || [])) {
        if (i.prive) continue;
        bloc.push('', image(base, id, i.image, i.legende));
      }
      // Sans cette ligne vide, l'intertitre suivant colle au paragraphe
      // precedent et Markdown cesse de le voir comme un titre.
      bloc.push('');
    }
  } else {
    const ap = ['apercu.png', 'apercu.jpg'].find((f) => fs.existsSync(path.join(PUBLIE, 'w', id, f)));
    if (ap) bloc.push(SEPARATEUR, image(base, id, ap, `${nom} en fonctionnement`));
  }

  /* ---- les usages ---------------------------------------------------- */
  if ((fiche.usages || []).length) {
    bloc.push(SEPARATEUR, '## À quoi ça sert\n');
    for (const u of fiche.usages) bloc.push(`- **${u.titre}** — ${u.texte}`);
  }

  /* ---- les vues, s'il y en a plusieurs -------------------------------- */
  if (widgets.length > 1) {
    bloc.push(SEPARATEUR, '## Les widgets de la suite\n');
    for (const w of widgets) {
      const passe = (fiche.archives || []).includes(w.widgetId);
      bloc.push(`- **${w.name}**${passe ? ' *(version précédente)*' : ''} — ${w.description || ''}\n  ${w.url}`);
    }
  }

  // Le journal de versions n'a pas sa place ici : un fil de forum se lit dans
  // l'ordre, et l'historique d'un widget appartient a sa page. On ne garde du
  // depot que ce qu'on ne peut pas obtenir autrement — le fichier de
  // l'application, et une ligne pour le code. Un post n'est pas une vitrine :
  // ramener du monde vers son propre depot n'est pas ce qu'on vient y faire.
  const liens = [];
  if (fiche.encart && fiche.encart.lien) {
    liens.push(`**${fiche.encart.lien.libelle}** : ${fiche.encart.lien.url}`);
  }
  if (fiche.depot) liens.push(`Le code, sous licence MIT : ${fiche.depot}`);
  if (liens.length) bloc.push(SEPARATEUR, ...liens);

  /* ---- l'appel a retours ------------------------------------------------ */
  bloc.push(SEPARATEUR, '## Vos retours\n');
  bloc.push([
    'Il marche sur les cas que j’ai pu tester, et je ne connais que les miens.',
    'Si quelque chose échoue ou vous surprend, dites-le dans ce fil — en précisant :',
    '',
    '- ce que vous avez ouvert (quel document, quelles tables) ;',
    '- le message d’erreur exact, s’il y en a un ;',
    '- ou simplement ce qui vous a paru bizarre.',
    '',
    'C’est ce qui permet de couvrir des usages au-delà des miens.',
  ].join('\n'));

  // Ce message sera reecrit sans prevenir chaque fois que la fiche change. Le
  // dire evite qu'une edition passe pour une retouche discrete : Discourse en
  // garde l'historique, autant annoncer d'ou elle vient.
  bloc.push(SEPARATEUR);
  bloc.push('<sub>Ce message est rédigé automatiquement à partir de la fiche du projet, versionnée avec son code. Il est remis à jour depuis cette même source quand le widget évolue — les modifications restent visibles dans l’historique du message.</sub>');

  return bloc.join('\n') + '\n';
}

if (require.main === module) {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage : node scripts/generate-post.js <projet>');
    console.error('Projets : ' + fs.readdirSync(PUBLIE)
      .filter((d) => fs.existsSync(path.join(PUBLIE, d, 'vitrine.json'))).join(', '));
    process.exit(1);
  }
  const sortie = path.join(BROUILLONS, id + '.md');
  const md = rendre(id);
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(sortie, md);
  console.log(`Brouillon écrit : ${path.relative(RACINE, sortie).replace(/\\/g, '/')}`);
  console.log(`  ${md.length} caractères, ${(md.match(/^#/gm) || []).length} sections`);
  console.log('\nÀ relire avant de coller. Ce script ne publie rien.');
}

module.exports = { rendre, baseDe, widgetsDe, principalDe };
