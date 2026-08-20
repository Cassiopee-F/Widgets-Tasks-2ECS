/**
 * L'accueil d'Atlas hors de Grist — le rendu des ecrans decrits par `hote.js`.
 *
 * Ce module ne decide de rien : il affiche ce que `ecranInitial` a choisi et
 * rend la main a Atlas des qu'une scene est ouverte. Toute la logique — quel
 * ecran, quelle configuration est valable, comment presenter une date — vit
 * dans `hote.js`, ou elle se teste sans navigateur.
 *
 * Il se pose en plein ecran PAR-DESSUS l'interface d'Atlas, qui existe deja dans
 * la page mais n'a pas encore demarre. Une fois la scene choisie, le voile est
 * retire et `init()` prend le relais.
 */

import { capacites, creerClient } from './data-client.js?v=20260820b';
import { installerAdaptateur } from './grist-adapter.js?v=20260820a';
import { listerScenesAtlas } from './decouverte.js?v=20260820a';
import {
  ECRANS, ecranInitial, validerConfig, lireConfig, ecrireConfig, oublier,
  depuis, situer,
} from './hote.js?v=20260820b';

export const VERSION = '1.0.0';

const CSS = `
.hote { position: fixed; inset: 0; z-index: 9000; overflow-y: auto;
  background: var(--bg, #F4EFE3); color: var(--text, #2D2820);
  font-family: var(--sans, system-ui, sans-serif); }
.hote-boite { max-width: 30rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem;
  display: flex; flex-direction: column; gap: 1.1rem; }
.hote-marque { display: flex; align-items: center; gap: .55rem;
  font-family: var(--serif, Georgia, serif); font-size: 1.35rem;
  color: var(--ink, #1F1B14); margin-bottom: .3rem; }
.hote h2 { font-family: var(--serif, Georgia, serif); font-weight: 500;
  font-size: 1.5rem; line-height: 1.2; margin: 0; color: var(--ink, #1F1B14); }
.hote p { margin: 0; font-size: .95rem; line-height: 1.55; color: var(--muted, #7A6F5E); }
.hote label { display: block; font-size: .8rem; letter-spacing: .04em;
  text-transform: uppercase; color: var(--muted, #7A6F5E); margin-bottom: .35rem; }
.hote input { width: 100%; padding: .8rem .9rem; font-size: 1rem; font-family: inherit;
  color: var(--ink, #1F1B14); background: var(--surface, #fff);
  border: 1px solid var(--hairline-strong, #C9C0A8); border-radius: 8px; }
.hote input:focus { outline: 2px solid var(--accent, #C44536); outline-offset: 1px; }
.hote-btn { width: 100%; padding: .85rem 1rem; font-size: 1rem; font-family: inherit;
  font-weight: 600; color: #fff; background: var(--ink, #1F1B14);
  border: 0; border-radius: 8px; cursor: pointer; }
.hote-btn:disabled { opacity: .55; cursor: default; }
.hote-lien { background: none; border: 0; padding: .35rem 0; font: inherit;
  font-size: .87rem; color: var(--accent, #C44536); cursor: pointer; text-align: left; }
.hote-avis { padding: .75rem .9rem; border-radius: 8px; font-size: .9rem; line-height: 1.5;
  background: var(--accent-soft, #F5E9DC); border-left: 3px solid var(--accent, #C44536);
  color: var(--ink, #1F1B14); }
.hote-liste { display: flex; flex-direction: column; gap: .5rem; }
.hote-scene { display: block; width: 100%; text-align: left; cursor: pointer;
  padding: .85rem .95rem; font: inherit; color: var(--ink, #1F1B14);
  background: var(--surface, #fff); border: 1px solid var(--hairline, #E2DBC8);
  border-radius: 10px; }
.hote-scene:hover, .hote-scene:focus-visible { border-color: var(--accent, #C44536); }
.hote-scene b { display: block; font-weight: 600; font-size: 1rem; margin-bottom: .15rem; }
.hote-scene span { font-size: .8rem; color: var(--muted, #7A6F5E); }
.hote-progres { font-size: .85rem; color: var(--muted, #7A6F5E);
  font-family: var(--mono, monospace); }
`;

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MARQUE = `<div class="hote-marque">
  <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M4 24 16 6l12 18-12 4z" fill="#C44536"/><path d="M16 6v22" stroke="#F4EFE3" stroke-width="1.2"/>
  </svg><span>Atlas</span></div>`;

/**
 * Affiche l'accueil et ne rend la main que lorsqu'une scene est ouverte.
 *
 * @returns {Promise<boolean>} `true` si Atlas peut demarrer, `false` si l'hote
 *   garde l'ecran (rien a proposer, ou l'utilisateur n'a pas encore choisi).
 */
export async function accueillir({ portee = globalThis, document: doc = document } = {}) {
  const caps = capacites(portee);
  const stockage = (() => { try { return portee.localStorage; } catch (_) { return null; } })();
  let config = lireConfig(stockage);

  const ecran = ecranInitial(caps, config);
  if (ecran === ECRANS.WIDGET) return true;   // dans Grist : l'hote n'a rien a faire

  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  const voile = doc.createElement('div');
  voile.className = 'hote';
  voile.innerHTML = '<div class="hote-boite"></div>';
  doc.body.appendChild(voile);
  const boite = voile.querySelector('.hote-boite');

  const fermer = () => { voile.remove(); style.remove(); };

  // Navigateur : la connexion echouerait, mais Atlas reste utilisable en local.
  // On explique, et on laisse continuer — barrer la route serait une regression.
  if (ecran === ECRANS.LOCAL) {
    return new Promise((resoudre) => {
      montrerLocal(boite, caps, () => { fermer(); resoudre(true); });
    });
  }

  // Une scene deja retenue : on ouvre sans rien demander. C'est le cas courant,
  // l'application ayant vocation a s'ouvrir sur le dernier projet consulte.
  if (ecran === ECRANS.ATLAS) {
    const pret = await ouvrirScene(config, portee, boite);
    if (pret) { fermer(); return true; }
    config = { ...config, docId: '' };   // scene devenue illisible : on repropose la liste
  }

  return new Promise((resoudre) => {
    const versConnexion = (message) => montrerConnexion(boite, config, message, (c) => {
      config = c;
      ecrireConfig(stockage, config);
      versScenes();
    });

    const versScenes = () => montrerScenes(boite, config, portee, {
      onChoix: async (scene) => {
        const conf = { ...config, docId: scene.id };
        const pret = await ouvrirScene(conf, portee, boite);
        if (!pret) return;
        ecrireConfig(stockage, conf);
        fermer();
        resoudre(true);
      },
      onChanger: () => { oublier(stockage); versConnexion(); },
    });

    if (ecran === ECRANS.CONNEXION) versConnexion();
    else versScenes();
  });
}

/* ------------------------------------------------------------------ */

function montrerLocal(boite, caps, onContinuer) {
  boite.innerHTML = `${MARQUE}
    <h2>Vos scènes Grist sont hors de portée ici</h2>
    <p>${echapper(caps.raison || '')}</p>
    <p>Installez l’application pour retrouver vos scènes sur ce téléphone, ou
       ouvrez Atlas depuis un document Grist sur ordinateur.</p>
    <button class="hote-btn" id="h-local">Continuer sans se connecter</button>
    <p>Vous pourrez charger un fichier, importer depuis OpenStreetMap et
       travailler localement — sans enregistrer dans Grist.</p>`;
  boite.querySelector('#h-local').onclick = onContinuer;
}

function montrerConnexion(boite, config, message, onValider) {
  boite.innerHTML = `${MARQUE}
    <h2>Se connecter</h2>
    <p>L’adresse de votre instance Grist et votre clé API. Elles sont conservées
       sur cet appareil : vous ne les saisirez qu’une fois.</p>
    ${message ? `<div class="hote-avis">${echapper(message)}</div>` : ''}
    <div>
      <label for="h-base">Adresse de l’instance</label>
      <input id="h-base" inputmode="url" autocapitalize="off" autocorrect="off"
             spellcheck="false" placeholder="grist.numerique.gouv.fr"
             value="${echapper(config?.baseUrl || '')}">
    </div>
    <div>
      <label for="h-cle">Clé API</label>
      <input id="h-cle" type="password" autocapitalize="off" autocorrect="off"
             spellcheck="false" placeholder="collez votre clé"
             value="${echapper(config?.jeton || '')}">
    </div>
    <button class="hote-btn" id="h-ok">Se connecter</button>
    <p>La clé se copie depuis votre profil Grist, rubrique « Clé API ».</p>`;

  const valider = () => {
    const r = validerConfig({
      baseUrl: boite.querySelector('#h-base').value,
      jeton: boite.querySelector('#h-cle').value,
    });
    if (!r.ok) return montrerConnexion(boite, config, r.message, onValider);
    onValider(r.config);
  };
  boite.querySelector('#h-ok').onclick = valider;
  boite.querySelector('#h-cle').onkeydown = (e) => { if (e.key === 'Enter') valider(); };
}

async function montrerScenes(boite, config, portee, { onChoix, onChanger }) {
  boite.innerHTML = `${MARQUE}
    <h2>Vos scènes</h2>
    <div class="hote-progres" id="h-progres">Recherche…</div>
    <div class="hote-liste" id="h-liste"></div>
    <button class="hote-lien" id="h-changer">Changer d’instance ou de clé</button>`;

  const liste = boite.querySelector('#h-liste');
  const progres = boite.querySelector('#h-progres');
  boite.querySelector('#h-changer').onclick = onChanger;

  let n = 0;
  const ajouter = (scene) => {
    n++;
    const b = document.createElement('button');
    b.className = 'hote-scene';
    b.innerHTML = `<b>${echapper(scene.nom || 'Sans titre')}</b>
      <span>${echapper([situer(scene), depuis(scene.maj)].filter(Boolean).join(' — '))}</span>`;
    b.onclick = () => onChoix(scene);
    liste.appendChild(b);
  };

  try {
    await listerScenesAtlas(config.baseUrl, config.jeton, {
      fetchFn: portee.fetch?.bind(portee),
      onTrouve: ajouter,
      // L'avancement se compte en documents sondes : sur un compte fourni, la
      // recherche dure, et une page muette laisserait croire a une panne.
      onProgres: (fait, total) => {
        progres.textContent = fait < total
          ? `${fait} / ${total} documents examinés — ${n} scène${n > 1 ? 's' : ''}`
          : (n ? `${n} scène${n > 1 ? 's' : ''}` : '');
      },
    });
    if (!n) {
      progres.textContent = '';
      liste.innerHTML = `<div class="hote-avis">Aucune scène Atlas trouvée sur ce compte.
        Une scène est un document contenant un import qgis2grist, des préférences
        de couches ou un récit.</div>`;
    }
  } catch (e) {
    progres.textContent = '';
    liste.innerHTML = `<div class="hote-avis">Connexion impossible : ${echapper(e.message)}.
      Vérifiez l’adresse et la clé.</div>`;
  }
}

/**
 * Branche Atlas sur une scene : cree le client, verifie qu'elle repond, puis
 * installe l'adaptateur. La verification evite d'ouvrir sur un ecran vide quand
 * le document a ete supprime ou les droits retires depuis la derniere fois.
 */
async function ouvrirScene(config, portee, boite) {
  try {
    const client = await creerClient({
      mode: 'rest', baseUrl: config.baseUrl, docId: config.docId, jeton: config.jeton,
      fetch: portee.fetch?.bind(portee),
    });
    await client.listTables();
    installerAdaptateur(client, {}, portee);
    return true;
  } catch (e) {
    if (boite) {
      const avis = document.createElement('div');
      avis.className = 'hote-avis';
      avis.textContent = `Scène inaccessible : ${e.message}`;
      boite.prepend(avis);
    }
    return false;
  }
}
