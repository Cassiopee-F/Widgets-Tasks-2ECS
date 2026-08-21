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
 * Usage : node scripts/generate-post.js atlas
 */

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const PUBLIE = path.join(RACINE, 'published');
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
  bloc.push(`# ${nom}\n`);
  if (fiche.statut) {
    bloc.push(`**${fiche.statut.niveau}** — ${fiche.statut.texte}\n`);
  }
  bloc.push(`${fiche.pitch || principal.description || ''}\n`);
  bloc.push(`:link: **${principal.url}**`);
  bloc.push(`:page_facing_up: Présentation détaillée : ${base}w/${id}/`);
  if (fiche.depot) bloc.push(`:open_file_folder: Le code : ${fiche.depot}`);

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
    bloc.push(SEPARATEUR, '## Où ça tourne\n');
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

  /* ---- comment l'essayer ---------------------------------------------- */
  bloc.push(SEPARATEUR, '## Comment l’essayer\n');
  bloc.push(`Dans un document Grist : **Ajouter un widget** → **Custom** → coller l’adresse`);
  bloc.push(`\`\`\`\n${principal.url}\n\`\`\``);
  bloc.push(`et donner l’accès **${acces(principal.accessLevel)}**.`);
  bloc.push('');
  bloc.push('Le widget est un fichier HTML autonome : il fonctionne sur n’importe quelle instance Grist, y compris auto-hébergée.');
  if (fiche.encart && fiche.encart.lien) {
    bloc.push(`\n${fiche.encart.titre} — ${fiche.encart.texte}\n\n:arrow_down: ${fiche.encart.lien.url}`);
  }

  /* ---- le journal ------------------------------------------------------ */
  if ((fiche.journal || []).length) {
    bloc.push(SEPARATEUR, '## Ce qui a changé\n');
    for (const e of fiche.journal) bloc.push(`- **${e.version}** — ${e.texte}`);
  }

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
  const sortie = path.join(PUBLIE, 'w', id, 'post-forum.md');
  const md = rendre(id);
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(sortie, md);
  console.log(`Brouillon écrit : ${path.relative(RACINE, sortie).replace(/\\/g, '/')}`);
  console.log(`  ${md.length} caractères, ${(md.match(/^#/gm) || []).length} sections`);
  console.log('\nÀ relire avant de coller. Ce script ne publie rien.');
}

module.exports = { rendre, baseDe, widgetsDe, principalDe };
