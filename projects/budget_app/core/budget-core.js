/* budget-core.js — cœur partagé de la suite Budget perso (Grist).
   SOURCE UNIQUE de la taxonomie FR, des helpers communs et de l'index d'agrégation.
   Inliné dans chaque module entre les marqueurs // <budget-core> / // <end-budget-core>
   par scripts/build-budget.js (mode --check en CI). Expose l'objet global BP. */
(function (root) {
  // <budget-core>

  /* ---- Taxonomie FR : motif (regex, toujours /i) -> famille [, exclu] -----
     Source canonique. Toute évolution se fait ICI puis est ré-inlinée par build. */
  const TAXO = [
    [/SALAIRE|REMUNERATION|\bPAYE\b|BULLETIN|TRAITEMENT/i, 'Revenus'],
    [/POLE EMPLOI|FRANCE TRAVAIL|\bCAF\b|ALLOCATION|CPAM|ASSURANCE MALADIE|RETRAITE|PENSION/i, 'Revenus'],
    [/CARREFOUR|LECLERC|\bAUCHAN\b|INTERMARCHE|\bLIDL\b|\bALDI\b|MONOPRIX|FRANPRIX|\bCASINO\b|SUPER ?U|MAGASIN U|\bU EXPRESS|PICARD|GRAND FRAIS|NATURALIA|\bBIO\b|PRIMEUR|BOUCHERIE|BOULANGERIE|MARCHE|EPICERIE/i, 'Alimentation'],
    [/MC ?DO|MCDONALD|BURGER|\bKFC\b|\bRESTO|RESTAURANT|PIZZ|SUSHI|BRASSERIE|\bCAFE\b|\bBAR\b|TABAC|UBER ?EATS|DELIVEROO|JUST EAT|FOODORA/i, 'Restaurants & sorties'],
    [/\bSNCF\b|\bTER\b|\bTGV\b|\bRATP\b|\bRTM\b|TRANSILIEN|NAVIGO|BLABLA|\bUBER\b|\bBOLT\b|\bFREE ?NOW|TAXI|VELIB/i, 'Transports'],
    [/TOTAL|\bESSO\b|\bSHELL\b|\bBP\b|AVIA|\bENI\b|STATION|CARBURANT|ESSENCE|PEAGE|VINCI|AUTOROUTE|ESCOTA|\bASF\b|SANEF|APRR|PARKING|STATIONNEMENT/i, 'Transports'],
    [/\bLOYER\b|SYNDIC|COPRO|FONCIA|NEXITY|SERGIC|SOGIMA|BAILLEUR|\bHLM\b/i, 'Logement'],
    [/\bEDF\b|ENGIE|TOTALENERGIES|\bGAZ\b|ELECTRICITE|\bEAU\b|VEOLIA|\bSUEZ\b|ENERGIE/i, 'Logement'],
    [/\bFREE\b|ORANGE|\bSFR\b|BOUYGUES|\bSOSH\b|RED BY|\bB&YOU|INTERNET|TELEPHONIE|MOBILE/i, 'Logement'],
    [/ASSURANCE HABITAT|\bMAIF\b|\bMACIF\b|MATMUT|GMF|AXA|ALLIANZ|\bMMA\b|GENERALI|LUKO|LEMONADE/i, 'Assurances'],
    [/PHARMACIE|\bDOCTEUR\b|MEDECIN|MEDICAL|HOPITAL|CLINIQUE|LABORATOIRE|DENTAIRE|DENTISTE|OPTIC|MUTUELLE|KINE|OSTEO|DOCTOLIB/i, 'Santé'],
    [/AMAZON|\bFNAC\b|DARTY|BOULANGER|\bZARA\b|\bH&M\b|UNIQLO|DECATHLON|\bIKEA\b|LEROY MERLIN|CASTORAMA|WELDOM|BRICO|ZALANDO|VINTED|ASOS|SHEIN|CDISCOUNT|\bACTION\b/i, 'Shopping'],
    [/COIFF|BARBIER|INSTITUT|BEAUTE|ESTHETIC|\bSPA\b/i, 'Soins'],
    [/NETFLIX|SPOTIFY|DEEZER|DISNEY|CANAL|\bOCS\b|PRIME VIDEO|CINEMA|\bUGC\b|PATHE|GAUMONT|STEAM|PLAYSTATION|XBOX|NINTENDO|CULTURA|\bFNAC SPECT|BILLETT|CONCERT|MUSEE|THEATRE/i, 'Loisirs'],
    [/GOOGLE|\bAPPLE\b|MICROSOFT|\bOVH\b|HOSTINGER|GANDI|ADOBE|OPENAI|ANTHROPIC|MISTRAL|GITHUB|NOTION|FIGMA|DROPBOX|ICLOUD|\bAWS\b/i, 'Abonnements & numérique'],
    [/DGFIP|FINANCES PUBLIQUES|TRESOR PUBLIC|\bIMPOT|TAXE FONCIERE|TAXE HABITATION|\bURSSAF\b|PRELEVEMENT A LA SOURCE/i, 'Impôts & taxes'],
    [/FRAIS BANCAIRE|COTISATION|COMMISSION|\bAGIOS\b|FRAIS DE TENUE|FRAIS ACHAT ETRANGER|FRAIS RETR/i, 'Frais bancaires'],
    [/RETRAIT|\bDAB\b|DISTRIBUTEUR|\bATM\b|RET ?DAB/i, "Retrait d'espèces"],
    [/LIVRET|\bLDDS\b|\bLEP\b|\bPEL\b|\bCEL\b|EPARGNE|ASSURANCE VIE|\bPEA\b|\bPER\b|TRADE REPUBLIC|BOURSORAMA VIE|PARTS SOCIALES/i, 'Épargne', true],
    [/VIREMENT INTERNE|VIR INTERNE|VERS COMPTE|VERS LIVRET|VERS EPARGNE|VIREMENT DE COMPTE/i, 'Virement interne', true],
    [/REMBOURSEMENT|\bREMB\b|\bRBT\b/i, 'Remboursement', true]
  ];

  /* ---- Catégories de départ : [nom, type, couleur] ----------------------- */
  const CAT_SEED = [
    ['Revenus', 'revenu', '#0f8a5f'], ['Alimentation', 'depense', '#3d5afe'], ['Restaurants & sorties', 'depense', '#7c4dff'],
    ['Transports', 'depense', '#00a8a8'], ['Logement', 'depense', '#d14343'], ['Assurances', 'depense', '#b9742a'],
    ['Santé', 'depense', '#e85d75'], ['Shopping', 'depense', '#5b6470'], ['Soins', 'depense', '#c77b9a'],
    ['Loisirs', 'depense', '#f0883e'], ['Abonnements & numérique', 'depense', '#6b7280'], ['Impôts & taxes', 'depense', '#8a5a00'],
    ['Frais bancaires', 'depense', '#a0524d'], ["Retrait d'espèces", 'depense', '#9b8a5f'], ['Épargne', 'epargne', '#2f8f5b'],
    ['Virement interne', 'exclu', '#8a8f99'], ['Remboursement', 'exclu', '#8a8f99'], ['Famille', 'depense', '#c0508a'],
    ['Loyer (vie commune)', 'depense', '#d14343'], ['À catégoriser', 'depense', '#b9742a']
  ];

  /* ---- Sous-catégories de départ : famille -> [sous-catégories] ----------- */
  const SOUS_SEED = {
    'Alimentation': ['Supermarché', 'Boulangerie', 'Primeur / marché', 'Boucherie', 'Épicerie', 'Bio'],
    'Restaurants & sorties': ['Restaurant', 'Fast-food', 'Bar', 'Café', 'Livraison'],
    'Transports': ['Carburant', 'Train', 'Transports en commun', 'Péage / parking', 'VTC / taxi', 'Vélo', 'Avion'],
    'Logement': ['Loyer', 'Crédit immobilier', 'Électricité / gaz', 'Eau', 'Internet / téléphone', 'Charges / copropriété', 'Assurance habitation', 'Entretien'],
    'Santé': ['Pharmacie', 'Médecin', 'Mutuelle', 'Dentiste', 'Optique', 'Hôpital'],
    'Shopping': ['Vêtements', 'High-tech', 'Maison / déco', 'Bricolage', 'Sport', 'Beauté', 'Divers'],
    'Soins': ['Coiffeur', 'Institut', 'Spa'],
    'Loisirs': ['Streaming', 'Cinéma / spectacle', 'Jeux vidéo', 'Sport / loisir', 'Voyage', 'Livres'],
    'Abonnements & numérique': ['Logiciels / SaaS', 'Cloud / hébergement', 'IA', 'Téléphonie'],
    'Impôts & taxes': ['Impôt sur le revenu', 'Taxe foncière', "Taxe d'habitation", 'Prélèvement à la source', 'URSSAF'],
    'Revenus': ['Salaire', 'Prime', 'Aides / allocations', 'Intérêts', 'Remboursement', 'Autre'],
    'Assurances': ['Habitation', 'Auto / moto', 'Santé', 'Prévoyance'],
    'Frais bancaires': ['Cotisation', 'Commission', 'Agios', 'Frais étranger'],
    "Retrait d'espèces": ['Retrait DAB'],
    'Épargne': ['Livret', 'Assurance-vie', 'PEA / bourse', 'Autre'],
    'Famille': ['Don', 'Aide', 'Cadeau', 'Prêt', 'Remboursement'],
    'Loyer (vie commune)': ['Loyer mensuel'],
    'Virement interne': ['Vers épargne', 'Entre comptes']
  };

  /* ---- Helpers texte / format ------------------------------------------- */
  // norm : normalisation "métier" (MAJUSCULES sans accents) — matching taxonomie/marchands.
  const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  // normHeader : normalisation des EN-TÊTES CSV (minuscules) — usage import uniquement.
  // Nommée distinctement pour ne PAS entrer en collision avec `norm` (contrat opposé).
  const normHeader = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const eur = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €';
  const eur0 = v => eur(v, 0);

  /* ---- Dates / périodes ------------------------------------------------- */
  const gristToDate = ts => ts ? new Date(ts * 1000) : null;
  const dateToGrist = d => d ? Math.floor(d.getTime() / 1000) : null;
  // clé année-mois 'YYYY-MM' (heure locale, cohérente entre tous les modules).
  const ym = d => { const x = (d instanceof Date) ? d : new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  // libellé lisible d'un bucket 'YYYY-MM' -> "juin 2026".
  const moisLabel = key => { const [y, m] = String(key).split('-').map(Number); return (MOIS[m - 1] || '?').replace('.', '') + ' ' + y; };

  /* ---- Parsing relevés (import) ----------------------------------------- */
  function parseDate(v) {
    v = (v || '').trim(); if (!v) return null;
    let m = v.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000;
    m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return Date.UTC(y, +m[2] - 1, +m[1]) / 1000; }
    const t = Date.parse(v); return isNaN(t) ? null : Math.floor(t / 1000);
  }
  // Montant SIGNÉ (négatif = débit). Gère décimale FR, signe en suffixe ("12,50-")
  // et parenthèses comptables ("(12,50)") = débit.
  function parseAmount(v) {
    if (v == null) return null; v = v.toString().trim(); if (!v) return null;
    let s = v.replace(/\s| |€|EUR/gi, '');
    let neg = false;
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    else if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    s = s.replace(/[^0-9.\-+]/g, ''); const n = parseFloat(s); if (isNaN(n)) return null;
    return neg ? -Math.abs(n) : n;
  }

  /* ---- Clé marchand (regroupement du classement) ------------------------ */
  function merchantKey(lib) {
    let s = norm(lib);
    s = s.replace(/\bPRLV SEPA\b|\bVIR INST\b|\bVIR\b|\bPRLV\b|\bPAIEMENT\b|\bACHAT\b|\bFACTURE\b|\bSEPA\b|\bCB\b|\bCARTE\b/g, ' ');
    s = s.replace(/\*+\d+/g, ' ').replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ').replace(/\b\d{6,}\b/g, ' ');
    s = s.replace(/\d+[.,]\d{2}\s?EUR/g, ' ').replace(/\bEUR\b/g, ' ');
    s = s.replace(/\b\d{2,5}[A-Z][A-Z]{2,}\b/g, ' ');
    s = s.replace(/[^A-Z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim();
    const toks = s.split(' ').filter(t => t.length > 1);
    return toks.slice(0, 2).join(' ') || s || norm(lib).slice(0, 12);
  }

  /* ---- Typage : le contrat partagé -------------------------------------- */
  // cats : map { [categorie]: { type } }. Fallback 'depense'.
  const makeTypeOf = cats => cat => (cats[cat] && cats[cat].type) || 'depense';

  /* ---- Lentille perso : exclure le sous-ensemble Locatif -----------------
     Convention : catégories préfixées "Locatif -" = lentille immo/LMNP, ignorées
     par le budget perso (RAV, enveloppes) SANS toucher à leur Type. */
  const isLocatif = cat => /^locatif\b/i.test((cat || '').toString().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''));

  /* ---- Catégorisation par taxonomie ------------------------------------- */
  // Renvoie la 1re famille dont le motif matche le libellé, sinon null.
  function guessCategory(lib) {
    const L = norm(lib);
    for (const [re, cat] of TAXO) if (re.test(L)) return cat;
    return null;
  }

  /* ---- Statistiques ----------------------------------------------------- */
  function median(a) { const s = [...a].sort((x, y) => x - y); const n = s.length; if (!n) return 0; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  const med10 = a => Math.round(median(a) / 10) * 10;

  /* ---- Index d'agrégation (LE remplaçant des re-scans spentCat/surplus) --
     Une seule passe O(n) sur les opérations -> somme SIGNÉE par catégorie et par
     bucket, plus la liste ordonnée des buckets. Tout le reste en dérive en O(1).

     rows     : [{ cat, montant, exclu, ... }] déjà normalisées (montant signé).
     bucketOf : (row) -> clé de bucket (ex. r.ym, ou cycle de paie). Injectée par
                le module car le découpage (calendaire vs cycle) lui appartient.

     Renvoie { net(cat,bk), spent(cat,bk), buckets, cats, forEachCatBucket } :
       net   = Σ montant signé (revenu>0, dépense<0) — non plafonné.
       spent = Math.max(0, -net) = dépense nette plafonnée PAR CATÉGORIE
               (refunds déduits, jamais négatif). C'est l'invariant du contrat :
               on plafonne toujours par catégorie, jamais une somme globale. */
  function buildIndex(rows, bucketOf) {
    const idx = Object.create(null);   // cat -> (bucket -> somme signée)
    const bset = new Set();
    for (const r of rows) {
      if (r.exclu) continue;
      const bk = bucketOf(r); if (bk == null) continue;
      bset.add(bk);
      const m = idx[r.cat] || (idx[r.cat] = Object.create(null));
      m[bk] = (m[bk] || 0) + r.montant;
    }
    const buckets = [...bset].sort();
    const net = (cat, bk) => (idx[cat] && idx[cat][bk]) || 0;
    const spent = (cat, bk) => Math.max(0, -net(cat, bk));
    return { idx, buckets, cats: Object.keys(idx), net, spent };
  }

  /* ---- Nature d'une catégorie (fixe / courante / ponctuelle) ------------
     Classée depuis les stats de dépense calculées sur le PRÉVU (hors imprévu) :
       partFixe   = somme des charges récurrentes détectées (detectRecurrents)
       medMensuel = médiane des dépenses mensuelles (>0)
       present    = nb de mois avec dépense sur la fenêtre
       window     = taille de la fenêtre (mois)
       cv         = coefficient de variation (écart-type / moyenne) des mois
     - 'fixe'       : dominée par une charge récurrente (loyer, abo, assurance) —
                      couverture >= 0.7 et présente presque tous les mois.
     - 'ponctuelle' : irrégulière ou à gros pics (vacances, santé) — présente < moitié
                      des mois, ou forte variabilité.
     - 'courante'   : récurrente mais montant qui bouge (alimentation, transport). */
  function natureFrom(stats) {
    const { partFixe = 0, medMensuel = 0, present = 0, window = 12, cv = 0 } = stats || {};
    const couverture = partFixe / Math.max(medMensuel, 1);
    if (couverture >= 0.7 && present >= 0.7 * window) return 'fixe';
    if (present < 0.5 * window || cv > 0.6) return 'ponctuelle';
    return 'courante';
  }
  // Mode d'enveloppe par défaut déduit de la nature (surchargé par Budget_mode si défini).
  const modeForNature = n => n === 'fixe' ? 'fixe' : n === 'ponctuelle' ? 'flottant' : 'auto';
  // Libellé lisible de la nature auto (3 classes détectées depuis la donnée).
  const NATURE_LABEL = { fixe: 'Engagement fixe', courante: 'Dépense courante', ponctuelle: 'Ponctuelle / provisionnée' };

  /* ---- Familles de budget (modèle utilisateur, 4 classes) ---------------
     Portées par Categories.Nature (piloté par l'utilisateur). L'auto (3 classes)
     ne sert que de suggestion quand Nature est vide. 'arbitrable' n'est jamais
     déduit automatiquement (c'est un jugement de valeur : subi vs choisi). */
  const FAMILLE_LABEL = { fixe: 'Fixe obligatoire', variable: 'Obligatoire variable', arbitrable: 'Arbitrable', ponctuel: 'Ponctuel' };
  const FAMILLE_ORDER = ['fixe', 'variable', 'arbitrable', 'ponctuel'];
  // Couleurs de famille (barre d'allocation, pastilles de section/carte).
  const FAMILLE_COLOR = { fixe: '#3d5afe', variable: '#0f8a5f', arbitrable: '#b9742a', ponctuel: '#7c4dff' };
  // Famille effective : Nature explicite sinon repli sur l'auto (fixe→fixe, courante→variable, ponctuelle→ponctuel).
  function familleOf(nature, autoNature) {
    if (nature && FAMILLE_LABEL[nature]) return nature;
    return autoNature === 'courante' ? 'variable' : autoNature === 'ponctuelle' ? 'ponctuel' : 'fixe';
  }

  /* ---- Période d'activité d'une catégorie (engagements datés) -----------
     Un engagement fixe (crédit conso, moto…) n'est actif que dans sa fenêtre
     Actif_debut..Actif_fin (bornes 'YYYY-MM' incluses, comparaison lexicale ;
     bornes vides = pas de limite). Un crédit soldé disparaît des mois suivants. */
  function estActif(debut, fin, bk) {
    if (!bk) return true;
    if (debut && bk < debut) return false;
    if (fin && bk > fin) return false;
    return true;
  }
  // Seuil au-delà duquel une ligne est un imprévu (choc) dans sa catégorie :
  // le plus grand entre la dépense mensuelle médiane et 3x la ligne médiane.
  function outlierThreshold(lineAmounts, medMensuel) {
    const med = median((lineAmounts || []).map(Math.abs));
    return Math.max(medMensuel || 0, 3 * med);
  }

  /* ---- Détection des récurrents (part fixe auto du mode Flottant) ------- */
  function detectRecurrents(txns) {
    const byKey = {};
    for (const t of txns) { (byKey[t.key] = byKey[t.key] || []).push(t); }
    const recur = [];
    for (const k in byKey) {
      const g = byKey[k];
      const months = new Set(g.map(t => t.ym));
      if (months.size < 3) continue;
      const amts = g.map(t => Math.abs(t.amount));
      const mean = amts.reduce((a, b) => a + b, 0) / amts.length;
      if (mean <= 0) continue;
      const sd = Math.sqrt(amts.reduce((a, b) => a + (b - mean) * (b - mean), 0) / amts.length);
      if (sd / mean > 0.35) continue;
      recur.push({ key: k, label: g[0].label || k, amount: median(amts), months: months.size });
    }
    recur.sort((a, b) => b.amount - a.amount);
    return { items: recur, sum: recur.reduce((a, r) => a + r.amount, 0) };
  }

  /* ---- Réserve dérivée (mode Flottant) — jamais stockée ----------------- */
  function deriveReserve(spendsByMonth, partFixe, provision, windowYM) {
    let r = 0;
    for (const m of windowYM) {
      const spent = spendsByMonth[m] || 0;
      const variable = Math.max(0, spent - partFixe);
      r = Math.max(0, r + provision - variable);
    }
    return r;
  }

  // <end-budget-core>
  root.BP = {
    TAXO, CAT_SEED, SOUS_SEED,
    norm, normHeader, eur, eur0,
    gristToDate, dateToGrist, ym, MOIS, moisLabel,
    parseDate, parseAmount, merchantKey,
    makeTypeOf, isLocatif, guessCategory,
    median, med10, buildIndex, detectRecurrents, deriveReserve,
    natureFrom, modeForNature, NATURE_LABEL, outlierThreshold,
    FAMILLE_LABEL, FAMILLE_ORDER, FAMILLE_COLOR, familleOf, estActif
  };
})(typeof window !== 'undefined' ? window : globalThis);
