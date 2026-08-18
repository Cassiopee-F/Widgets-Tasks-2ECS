/* =======================================================================
   Module « Suivi » — COCKPIT mensuel unique « d'un coup d'oeil ». Page qui
   defile, sans segment de vues :
     1. COCKPIT (panneau .hero) — cascade calculee du mois selectionne :
        Revenus recurrents − Fixes − A mettre de cote = DISPONIBLE variable,
        puis − Prevu variable = MARGE previsionnelle, enfin la ligne « reel »
        (depense a ce jour / reste reel). Remplace l'ancien hero reste-a-vivre.
     2. ENVELOPPES (ex suivi.html) — modes fixe/auto/flottant + reserve,
        tendance 6 periodes ; mode calendaire vs cycle de paie.
     3. TRAJECTOIRE & OBJECTIF (ex previsionnel.html), REPLIABLE en bas —
        objectif editable, KPIs, courbe SVG cumul reel/objectif/projection,
        grille mois x categories prevu/reel + figement des mois clotures.
   Periode ‹ ›, bascule calendaire/cycle et largeur restent en en-tete.

   Contrat : s'enregistre via BUDGET.register('suivi', { title, access, mount }).
   Donnees partagees (Transactions + Categories) : lues dans ctx.store (deja
   chargees par le shell). Tables propres au module (Parametres, Previsionnel) :
   chargees/creees ici puis re-fetch apres ecriture.

   Invariant d'agregation : TOUTE somme passe par BP.buildIndex(rows, bucketOf)
   qui plafonne la depense PAR CATEGORIE (spent = max(0, -net)). Le total
   depenses / l'epargne reelle = Somme_cat max(0, spent(cat,bk)), JAMAIS un
   max(0, somme globale). Aucun re-scan manuel de store.rows par cat x mois.
   ======================================================================= */
(function () {
  'use strict';

  /* ---- CSS specifique du module (injecte une seule fois) ---------------- */
  function injectCss() {
    if (document.getElementById('suivi-mod-css')) return;
    const s = document.createElement('style');
    s.id = 'suivi-mod-css';
    s.textContent = [
      '.sv-topbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
      '.sv-title{font-size:19px;font-weight:680;letter-spacing:-.01em}',
      '.sv-navwrap{display:flex;align-items:center;gap:3px;background:var(--soft);border-radius:9px;padding:3px}',
      '.sv-navwrap .lbl{min-width:118px;text-align:center;font-size:13px;font-weight:600}',
      '.sv-navbtn{border:none;border-radius:7px;width:30px;height:28px;font-size:16px;line-height:1;cursor:pointer;color:var(--ink);background:var(--card);box-shadow:var(--shadow)}',
      '.sv-navbtn:disabled{color:var(--muted);background:transparent;box-shadow:none;cursor:default}',
      '.sv-modeseg{display:flex;background:var(--soft);border-radius:8px;padding:2px;gap:1px;margin:10px 0}',
      '.sv-modeseg button{flex:1;border:none;border-radius:6px;padding:5px 4px;font-size:11.5px;font-weight:600;cursor:pointer;background:transparent;color:var(--muted)}',
      '.sv-modeseg button.on{background:var(--ink);color:#fff}',
      '.sv-editbtn{margin-left:auto;width:26px;height:26px;border-radius:7px;border:1px solid var(--line);background:var(--soft);color:var(--muted);cursor:pointer;font-size:14px;line-height:1}',
      '.sv-editbtn.on{border-color:var(--indigo);color:var(--indigo)}',
      '.sv-num{width:96px}',
      '.sv-obj{width:132px;font-size:18px;border-color:var(--warn)}',
      '.sv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin-top:12px}',
      '.sv-tbl{width:100%;border-collapse:collapse;font-size:13px}',
      '.sv-tbl th,.sv-tbl td{text-align:right;padding:7px 8px;border-top:1px solid var(--line)}',
      '.sv-tbl th:first-child,.sv-tbl td:first-child{text-align:left}',
      '.sv-tbl th{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-top:none}',
      '.sv-line-real{stroke:var(--indigo)}',
      '.sv-line-obj{stroke:var(--warn)}',
      '.sv-line-proj{stroke:var(--muted)}',
      '.sv-btn-go{background:var(--warn);color:#fff;border:none;border-radius:8px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer}',
      /* cockpit (dans le panneau .hero, fond sombre + texte clair) */
      '.ck{display:flex;flex-direction:column}',
      /* contraste renforce + cascade compacte (interligne reduit) */
      '.ck-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:3px 0}',
      '.ck-row .ck-l{font-size:12.5px;font-weight:500;color:#dfe3ea}',
      '.ck-row .ck-v{font-size:15px;font-weight:600;text-align:right;white-space:nowrap;color:#f2f4f8}',
      '.ck-row.ck-mid{padding:7px 0}',
      '.ck-row.ck-mid .ck-l{font-size:12.5px;font-weight:700;color:#fff}',
      '.ck-row.ck-mid .ck-v{font-size:19px;font-weight:600}',
      '.ck-row.ck-big{padding:9px 0}',
      '.ck-row.ck-big .ck-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#fff}',
      '.ck-row.ck-big .ck-v{font-size:30px;font-weight:600;letter-spacing:-.02em}',
      '.ck-sep{border-top:1px solid rgba(255,255,255,.16);margin:5px 0}',
      '.ck-sep.strong{border-top-width:2px;border-top-color:rgba(255,255,255,.32);margin:9px 0}',
      '.ck-obj{width:104px;background:transparent;border:1px solid var(--warn);color:#fff;border-radius:7px;padding:4px 8px;font-size:14px;text-align:right;outline:none}',
      /* micro-titres de zone PLAN / REEL */
      '.ck-zone{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#b7bdc9;margin:2px 0 7px}',
      /* barre d\'allocation : segmentation du revenu (synthese coup d\'oeil) */
      '.ck-alloc{position:relative;display:flex;width:100%;height:22px;border-radius:7px;overflow:hidden;background:rgba(255,255,255,.08);margin:2px 0 10px}',
      '.ck-alloc .sg{height:100%}',
      '.ck-alloc-over{position:absolute;top:0;height:100%;background:repeating-linear-gradient(45deg,#ff7a7a,#ff7a7a 5px,rgba(255,122,122,.4) 5px,rgba(255,122,122,.4) 10px)}',
      '.ck-alloc-mark{position:absolute;top:-3px;height:28px;width:2px;background:#fff;opacity:.85}',
      '.ck-leg{display:flex;flex-wrap:wrap;gap:7px 16px;margin-bottom:12px}',
      '.ck-leg .it{display:flex;align-items:center;gap:6px;font-size:11px;color:#dfe3ea}',
      '.ck-leg .pt{width:9px;height:9px;border-radius:3px;flex:none}',
      '.ck-leg .amt{font-weight:600;color:#fff}',
      /* verdict REEL vs budget */
      '.ck-verdict{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:9px;padding:8px 11px;border-radius:9px;background:rgba(255,255,255,.06)}',
      '.ck-verdict .lb{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#b7bdc9}',
      '.ck-verdict .vd{font-size:13px;font-weight:600}',
      /* panneau d\'edition d\'enveloppe (deplie via le bouton reglages) */
      '.env-edit{margin-top:10px;border-top:1px solid var(--line);padding-top:10px}',
      /* puce d'alerte imprevu (point rouge + texte, sans emoji) */
      '.chip.sv-imp{background:rgba(209,67,67,.14);color:var(--red)}',
      '.sv-dot{width:7px;height:7px;border-radius:50%;background:var(--red);flex:none}',
      /* en-tetes de groupe d\'enveloppes (par nature) */
      '.sv-grouphead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:16px 0 8px}',
      '.sv-gname{font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink)}',
      '.sv-gtot b{color:var(--ink)}',
      /* section trajectoire repliable */
      '.sv-trajhead{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:12px 15px;font-size:14px;font-weight:680;cursor:pointer}',
      '.sv-caret{color:var(--muted);font-size:12px;width:12px;display:inline-block}'
    ].join('\n');
    document.head.appendChild(s);
  }

  const WIDTHS = { narrow: 380, medium: 820, wide: 1080 };

  BUDGET.register('suivi', {
    title: 'Suivi',
    access: 'full',
    mount(root, ctx) {
      const { BP, store, grist, demo, el } = ctx;

      /* -- mode demo : aucune donnee, message d'accueil ------------------- */
      if (demo || !grist) {
        root.innerHTML = '<div class="msg"><b>Widget Grist — Suivi.</b><br>'
          + 'Ouvre-moi comme widget custom dans un document Grist (acces complet). '
          + 'Je lis les tables <span class="mono">Transactions</span> et '
          + '<span class="mono">Categories</span>, et je gere les enveloppes, '
          + 'l\'objectif d\'epargne et la trajectoire.</div>';
        return;
      }

      injectCss();

      /* -- etat local du module ------------------------------------------ */
      const ST = {
        period: null,       // bucket courant (cle 'YYYY-MM' du decoupage actif)
        mode: 'cal',        // 'cal' (mois calendaire) | 'cycle' (cycle de paie)
        width: 'medium',
        editing: null,      // categorie dont l'editeur de seuil est ouvert
        trajOpen: false,    // section « Trajectoire & objectif » depliee ?
        salaryDay: null,    // jour de paie detecte (null = cycle indisponible)
        _index: null,       // cache BP.buildIndex
        _idxMode: null      // mode ayant servi a construire _index
      };

      // Caches remis a zero a chaque rendu (memoisation intra-rendu) :
      //  _recurCache : detectRecurrents par categorie (cockpit + enveloppes)
      //  _analysis   : nature/imprevu par categorie (analyse ligne + mensuelle)
      let _recurCache = {};
      let _analysis = null;

      // Tables propres au module (le store ne les charge pas).
      let PARAMS = {}, PARAM_ROW = {}, OBJECTIF = 0, PREV_MAP = {};
      // Colonne Transactions.Imprevu (override manuel) si elle existe.
      // IMPREVU_MANUAL[rowId] === true => imprevu force. On ne cree PAS la colonne.
      let IMPREVU_HAS = false, IMPREVU_MANUAL = {};

      // Conteneur propre : recree a chaque mount, il porte la delegation
      // d'evenements (pas de fuite entre navigations de modules).
      const host = el('<div></div>');
      root.appendChild(host);

      /* ================================================================= */
      /* DONNEES PROPRES : Parametres (objectif) + Previsionnel (snapshots) */
      /* ================================================================= */
      async function ensureOwnTables() {
        try { await grist.docApi.fetchTable('Parametres'); }
        catch (e) {
          try { await grist.docApi.applyUserActions([['AddTable', 'Parametres',
            [{ id: 'Cle', type: 'Text' }, { id: 'Valeur', type: 'Text' }]]]); } catch (_) {}
        }
        try { await grist.docApi.fetchTable('Previsionnel'); }
        catch (e) {
          try { await grist.docApi.applyUserActions([['AddTable', 'Previsionnel',
            [{ id: 'Mois', type: 'Text' }, { id: 'Categorie', type: 'Text' },
             { id: 'Prevu', type: 'Numeric' }, { id: 'Fige', type: 'Bool' }]]]); } catch (_) {}
        }
      }

      async function loadOwn() {
        const col = (t, n) => (t && t[n]) || [];
        let par = {}, prev = {};
        try { par = await grist.docApi.fetchTable('Parametres'); } catch (e) {}
        try { prev = await grist.docApi.fetchTable('Previsionnel'); } catch (e) {}
        PARAMS = {}; PARAM_ROW = {};
        (par.id || []).forEach((rowId, i) => {
          const k = col(par, 'Cle')[i];
          if (k) { PARAMS[k] = col(par, 'Valeur')[i]; PARAM_ROW[k] = rowId; }
        });
        OBJECTIF = parseFloat(String(PARAMS['objectif_epargne'] || '').replace(',', '.')) || 0;
        // Override manuel de l'imprevu : lu uniquement si la colonne existe.
        IMPREVU_HAS = false; IMPREVU_MANUAL = {};
        try {
          const tx = await grist.docApi.fetchTable('Transactions');
          if (tx && Object.prototype.hasOwnProperty.call(tx, 'Imprevu')) {
            IMPREVU_HAS = true;
            (tx.id || []).forEach((rowId, i) => { IMPREVU_MANUAL[rowId] = tx.Imprevu[i] === true; });
          }
        } catch (e) {}
        PREV_MAP = {};
        (prev.id || []).forEach((rowId, i) => {
          const m = col(prev, 'Mois')[i], c = col(prev, 'Categorie')[i];
          if (m && c) PREV_MAP[m + '||' + c] = {
            rowId, prevu: +(col(prev, 'Prevu')[i] || 0), fige: !!col(prev, 'Fige')[i]
          };
        });
      }

      // Ecriture sur les tables propres du module (puis re-fetch + rendu).
      async function applyOwn(acts) {
        if (!acts || !acts.length) return;
        try { await grist.docApi.applyUserActions(acts); }
        catch (e) { alert('Ecriture refusee : ' + (e && e.message || e)); }
        await loadOwn(); render();
      }

      /* ================================================================= */
      /* DECOUPAGE : bucketOf (calendaire vs cycle de paie) + index        */
      /* ================================================================= */

      // Jour de paie = jour modal du plus gros revenu recurrent non locatif.
      function detectSalaryDay() {
        const salTx = store.rows
          .filter(r => store.typeOf(r.cat) === 'revenu' && !BP.isLocatif(r.cat) && r.montant > 0 && r.day != null)
          .map(r => ({ key: BP.merchantKey(r.lib), amount: r.montant, ym: r.ym, day: r.day }));
        const rec = BP.detectRecurrents(salTx.map(t => ({ key: t.key, label: t.key, amount: t.amount, ym: t.ym })));
        if (!rec.items.length) return null;
        const topKey = rec.items[0].key;
        const days = salTx.filter(t => t.key === topKey).map(t => t.day);
        if (!days.length) return null;
        const f = {}; days.forEach(d => f[d] = (f[d] || 0) + 1);
        return +Object.keys(f).sort((a, b) => f[b] - f[a])[0];
      }

      // Cle de bucket d'une operation selon le decoupage actif.
      function bucketOf(r) {
        if (ST.mode === 'cal' || !ST.salaryDay) return r.ym;
        const d = BP.gristToDate(r.date); if (!d) return r.ym;
        let y = d.getFullYear(), m = d.getMonth();
        // avant le jour de paie -> l'operation appartient au cycle ouvert le mois precedent.
        if (d.getDate() < ST.salaryDay) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
        return y + '-' + String(m + 1).padStart(2, '0');
      }

      // Index d'agregation (reconstruit uniquement quand le decoupage change).
      function idx() {
        if (ST._index && ST._idxMode === ST.mode) return ST._index;
        ST._index = BP.buildIndex(store.rows, bucketOf);
        ST._idxMode = ST.mode;
        return ST._index;
      }

      /* ---- helpers buckets (sur la liste ordonnee de l'index) ---------- */
      const buckets = () => idx().buckets;
      function prevBk(key, n) { const b = buckets(), i = b.indexOf(key); return i < 0 ? [] : b.slice(Math.max(0, i - n), i); }
      function winBk(key, n) { const b = buckets(), i = b.indexOf(key); return i < 0 ? [key] : b.slice(Math.max(0, i - n + 1), i + 1); }

      // Depense nette d'une categorie sur un bucket : deja plafonnee (>=0).
      const spentCat = (cat, bk) => idx().spent(cat, bk);

      function bucketLabel(key) {
        const parts = String(key).split('-').map(Number);
        const y = parts[0], m = parts[1];
        if (ST.mode === 'cal' || !ST.salaryDay) return BP.MOIS[m - 1].replace('.', '') + ' ' + y;
        const start = new Date(y, m - 1, ST.salaryDay), end = new Date(y, m, ST.salaryDay - 1);
        const f = d => d.getDate() + ' ' + BP.MOIS[d.getMonth()].replace('.', '');
        return f(start) + ' → ' + f(end);
      }
      function bucketSub() {
        return ST.mode === 'cal' ? 'Mois calendaire' : ('Cycle de paie · ouvre le ' + ST.salaryDay + ' du mois');
      }

      /* ================================================================= */
      /* AGREGATIONS (toutes derivees de l'index, O(1) par acces)          */
      /* ================================================================= */

      // Reste-a-vivre / epargne reelle d'un bucket. depenses = Somme_cat spent
      // (plafonnee par categorie), JAMAIS max(0, somme globale).
      function ravOf(bk) {
        const I = idx();
        let rev = 0, dep = 0, epa = 0;
        for (const cat of I.cats) {
          if (BP.isLocatif(cat)) continue;
          const t = store.typeOf(cat);
          if (t === 'revenu') rev += I.net(cat, bk);            // revenu = net signe (>0)
          else if (t === 'depense') dep += I.spent(cat, bk);    // spent = max(0, -net) par cat
          else if (t === 'epargne') epa += Math.abs(I.net(cat, bk));
        }
        return { rev, dep, epa, rav: rev - dep };
      }

      // Categories de depense pertinentes (non locatif) pour le mois affiche :
      //  - filtrees par leur FENETRE D'ACTIVITE (engagements dates, BP.estActif) ;
      //  - retenues si depense sur 6 buckets, OU mode configure, OU engagement
      //    FIXE actif a montant defini (visible des son demarrage, sans operation).
      function activeCats() {
        const win = winBk(ST.period, 6);
        const A = analysisAll();
        return store.catRows
          .filter(c => c.type === 'depense' && !BP.isLocatif(c.cat))
          .filter(c => BP.estActif(c.actifDebut, c.actifFin, ST.period))   // hors fenetre => exclu
          .map(c => {
            let recent = 0; win.forEach(b => recent += spentCat(c.cat, b));
            const fam = A[c.cat] && A[c.cat].famille;
            const isFixe = fam === 'fixe' || c.mode === 'fixe';
            // Engagement fixe a montant defini : se montre meme sans operation ce mois.
            const fixeVisible = isFixe && (c.budget > 0 || envelope(c).seuil > 0);
            return { c, recent, fixeVisible };
          })
          .filter(x => x.recent > 0 || x.c.mode || x.fixeVisible)
          .sort((a, b) => spentCat(b.c.cat, ST.period) - spentCat(a.c.cat, ST.period))
          .map(x => x.c);
      }

      // Recurrents d'une categorie sur 12 buckets (part fixe auto du flottant).
      // Memoise par rendu : _recurCache est vide au debut de render().
      function recurrentsCat(cat) {
        if (_recurCache[cat]) return _recurCache[cat];
        const win = winBk(ST.period, 12);
        const txns = store.rows
          .filter(r => r.cat === cat && !r.exclu && r.montant < 0 && win.includes(bucketOf(r)))
          .map(r => ({ key: BP.merchantKey(r.lib), label: BP.merchantKey(r.lib), amount: r.montant, ym: bucketOf(r) }));
        return (_recurCache[cat] = BP.detectRecurrents(txns));
      }
      // Part fixe recurrente d'une categorie de depense (loyer, credit, abos…).
      function partFixeCat(cat) { return recurrentsCat(cat).sum; }
      // Revenu reel d'un bucket = Somme des cats type revenu non-locatif (net >0).
      function revenusMois(bk) {
        const I = idx();
        let s = 0;
        for (const cat of I.cats) {
          if (!BP.isLocatif(cat) && store.typeOf(cat) === 'revenu') s += I.net(cat, bk);
        }
        return s;
      }

      /* ---- Analyse par categorie (imprevu ligne + nature), fenetre 12 mois.
         Une SEULE passe sur store.rows collecte les lignes de depense par
         categorie ; tout le reste derive de l'index (spent plafonne par cat).
         Memoise par rendu (_analysis). Renvoie map cat -> {
           nature, lines, imprevuRows(Set), imprevuByMonth, medMensuel,
           present, cv, partFixe, seuilOutlier }. */
      function analysisAll() {
        if (_analysis) return _analysis;
        const win = winBk(ST.period, 12), winSet = new Set(win);
        // Passe unique : lignes de depense (montant<0) par categorie, dans la fenetre.
        const linesByCat = Object.create(null);
        for (const r of store.rows) {
          if (r.exclu || r.montant >= 0 || BP.isLocatif(r.cat)) continue;
          if (store.typeOf(r.cat) !== 'depense') continue;
          const bk = bucketOf(r); if (!winSet.has(bk)) continue;
          (linesByCat[r.cat] || (linesByCat[r.cat] = [])).push({ rowId: r.rowId, bk, abs: Math.abs(r.montant) });
        }
        const res = Object.create(null);
        for (const c of store.catRows) {
          if (c.type !== 'depense' || BP.isLocatif(c.cat)) continue;
          const cat = c.cat, lines = linesByCat[cat] || [];
          // Total mensuel (plafonne par cat, via index) pour chaque bucket.
          const monthAll = {}; win.forEach(b => monthAll[b] = spentCat(cat, b));
          const medMensuelAll = BP.median(win.map(b => monthAll[b]).filter(v => v > 0));
          // Seuil d'imprevu au niveau ligne, via le helper du core.
          const seuilOutlier = BP.outlierThreshold(lines.map(l => l.abs), medMensuelAll);
          const imprevuRows = new Set(), imprevuByMonth = {};
          for (const l of lines) {
            // Override manuel prioritaire ; sinon detection auto (ligne > seuil).
            const forced = IMPREVU_HAS && IMPREVU_MANUAL[l.rowId] === true;
            if (forced || l.abs > seuilOutlier) {
              imprevuRows.add(l.rowId);
              imprevuByMonth[l.bk] = (imprevuByMonth[l.bk] || 0) + l.abs;
            }
          }
          // Serie mensuelle du PREVU = total mensuel - imprevu du mois.
          const prevuVals = win.map(b => Math.max(0, (monthAll[b] || 0) - (imprevuByMonth[b] || 0)));
          const pos = prevuVals.filter(v => v > 0);
          const medMensuel = BP.median(pos), present = pos.length;
          const mean = pos.length ? pos.reduce((a, b) => a + b, 0) / pos.length : 0;
          const sd = pos.length ? Math.sqrt(pos.reduce((a, b) => a + (b - mean) * (b - mean), 0) / pos.length) : 0;
          const cv = mean > 0 ? sd / mean : 0;
          const partFixe = partFixeCat(cat);
          // Auto-nature (3 classes) = simple REPLI quand Categories.Nature est vide.
          const natureAuto = BP.natureFrom({ partFixe, medMensuel, present, window: 12, cv });
          // Famille effective (4 classes) : le tag utilisateur (c.nature) prime.
          const famille = BP.familleOf(c.nature, natureAuto);
          res[cat] = { cat, lines, imprevuRows, imprevuByMonth, medMensuel, present, cv,
                       partFixe, natureAuto, famille, seuilOutlier };
        }
        return (_analysis = res);
      }

      // Modele d'affichage d'une enveloppe. Le MODE effectif = override manuel
      // (Categories.Budget_mode) sinon deduit de la NATURE (BP.modeForNature).
      function envelope(c) {
        const cat = c.cat;
        const A = analysisAll()[cat] || { natureAuto: 'courante', famille: 'variable', imprevuByMonth: {} };
        const natureAuto = A.natureAuto;              // 3 classes auto (repli mode)
        const famille = A.famille;                    // 4 familles (regroupement/cockpit)
        const autoMode = BP.modeForNature(natureAuto);// fixe / auto / flottant
        const hasOverride = !!c.mode;                 // Budget_mode renseigne ?
        const mode = hasOverride ? c.mode : autoMode; // override manuel prioritaire
        const spent = spentCat(cat, ST.period);
        const hist = prevBk(ST.period, 6).map(b => spentCat(cat, b));
        const median6 = BP.med10(hist.length ? hist : [spent]);
        let seuil, statusColor, fillColor, note, statusLabel;
        let cushion = null, reserve = 0, partFixe = 0, provision = 0, recur = { items: [], sum: 0 };
        let fillPct = 0, markPct = 0;

        if (mode === 'flottant') {
          recur = recurrentsCat(cat);
          partFixe = c.budget > 0 ? c.budget : recur.sum;         // manuel sinon auto
          const win12 = winBk(ST.period, 12);
          const sbm = {}; win12.forEach(b => sbm[b] = spentCat(cat, b));
          const suggestProv = BP.med10(prevBk(ST.period, 6).map(b => Math.max(0, spentCat(cat, b) - partFixe)));
          provision = c.prov > 0 ? c.prov : suggestProv;
          reserve = BP.deriveReserve(sbm, partFixe, provision, win12);
          seuil = partFixe + provision;
          const over = spent - seuil;
          if (spent <= seuil) { statusColor = 'var(--green)'; fillColor = 'var(--green)'; note = 'dans la provision'; statusLabel = 'reste ' + BP.eur0(seuil - spent); }
          else if (over <= reserve) { statusColor = 'var(--indigo)'; fillColor = 'var(--indigo)'; note = 'reserve mobilisee'; statusLabel = 'puise ' + BP.eur0(over) + ' dans la reserve'; }
          else { statusColor = 'var(--red)'; fillColor = 'var(--red)'; note = 'reserve epuisee'; statusLabel = 'depasse de ' + BP.eur0(over - reserve); }
          const scale = Math.max(spent, seuil + reserve, 1) * 1.1;
          fillPct = Math.min(100, spent / scale * 100); markPct = Math.min(100, seuil / scale * 100);
          const cs = seuil / scale * 100, ce = Math.min(100, (seuil + reserve) / scale * 100);
          cushion = 'left:' + cs + '%;width:' + Math.max(0, ce - cs) + '%';
        } else {
          seuil = mode === 'auto' ? median6 : (c.budget || median6);
          const ratio = seuil > 0 ? spent / seuil : 0;
          statusColor = ratio > 1 ? 'var(--red)' : (ratio > 0.9 ? 'var(--warn)' : 'var(--green)');
          fillColor = statusColor;
          note = mode === 'auto' ? ('mediane 6 m · ' + BP.eur0(median6)) : 'plafond fixe';
          const ecart = seuil - spent;
          statusLabel = ecart >= 0 ? ('reste ' + BP.eur0(ecart)) : ('depasse de ' + BP.eur0(-ecart));
          const scale = Math.max(spent, seuil, 1) * 1.18;
          fillPct = Math.min(100, spent / scale * 100); markPct = Math.min(100, seuil / scale * 100);
        }
        return {
          cat, color: c.color, mode, natureAuto, famille, autoMode, hasOverride,
          imprevuMois: (A.imprevuByMonth && A.imprevuByMonth[ST.period]) || 0,
          spent, seuil, median6, statusColor, fillColor, note, statusLabel,
          fillPct, markPct, cushion, reserve, partFixe, provision, recur,
          editing: ST.editing === cat, budget: c.budget, prov: c.prov, rowId: c.rowId
        };
      }

      /* ---- trajectoire : epargne reelle par bucket + prevu ------------- */
      const surplus = bk => ravOf(bk).rav;

      // Prevu d'une categorie pour un bucket : fige si snapshot present, sinon
      // mediane des 6 buckets precedents.
      function prevuCat(cat, bk) {
        const ex = PREV_MAP[bk + '||' + cat];
        if (ex && ex.fige) return ex.prevu;
        return BP.med10(prevBk(bk, 6).map(b => spentCat(cat, b)));
      }

      // Categories de depense a afficher dans la grille trajectoire.
      function trajCats() {
        const win = winBk(ST.period, 6);
        return store.catRows
          .filter(c => c.type === 'depense' && !BP.isLocatif(c.cat))
          .map(c => { let s = 0; win.forEach(b => s += spentCat(c.cat, b)); return { c, recent: s }; })
          .filter(x => x.recent > 0)
          .sort((a, b) => spentCat(b.c.cat, ST.period) - spentCat(a.c.cat, ST.period))
          .map(x => x.c.cat);
      }

      /* ================================================================= */
      /* ECRITURES SUR CATEGORIES (via le store partage -> reload + notify) */
      /* ================================================================= */
      function setMode(cat, mode) {
        const c = store.catMap[cat]; if (!c) return;
        const f = { Budget_mode: mode };
        if (mode === 'fixe' && !(c.budget > 0)) f.Budget_mensuel = envelope(c).median6;
        ST.editing = cat;
        store.apply([['UpdateRecord', 'Categories', c.rowId, f]]);
      }
      function figer(cat) {
        const c = store.catMap[cat]; if (!c) return;
        ST.editing = cat;
        store.apply([['UpdateRecord', 'Categories', c.rowId, { Budget_mode: 'fixe', Budget_mensuel: envelope(c).median6 }]]);
      }
      function commitNum(cat, field, val) {
        const c = store.catMap[cat]; if (!c) return;
        const v = Math.max(0, Math.round(parseFloat(String(val).replace(',', '.')) || 0));
        store.apply([['UpdateRecord', 'Categories', c.rowId, { [field]: v }]]);
      }

      /* ---- ecritures sur les tables propres (objectif, figement) ------- */
      function setObjectif(val) {
        const v = Math.max(0, Math.round(parseFloat(String(val).replace(',', '.')) || 0));
        if (PARAM_ROW['objectif_epargne'] != null)
          applyOwn([['UpdateRecord', 'Parametres', PARAM_ROW['objectif_epargne'], { Valeur: String(v) }]]);
        else
          applyOwn([['AddRecord', 'Parametres', null, { Cle: 'objectif_epargne', Valeur: String(v) }]]);
      }
      function figerMois() {
        const m = ST.period, acts = [];
        trajCats().forEach(cat => {
          const prevu = Math.round(prevuCat(cat, m));
          const ex = PREV_MAP[m + '||' + cat];
          if (ex) acts.push(['UpdateRecord', 'Previsionnel', ex.rowId, { Prevu: prevu, Fige: true }]);
          else acts.push(['AddRecord', 'Previsionnel', null, { Mois: m, Categorie: cat, Prevu: prevu, Fige: true }]);
        });
        if (acts.length) applyOwn(acts);
      }

      /* ================================================================= */
      /* RENDU                                                             */
      /* ================================================================= */
      const seg = (label, on, act, arg) =>
        '<button class="' + (on ? 'on' : '') + '" data-act="' + act + '" data-arg="' + arg + '">' + label + '</button>';

      function headerHtml() {
        const allB = buckets(), i = allB.indexOf(ST.period);
        const atOldest = i <= 0, atNewest = i >= allB.length - 1;
        const navBtn = (act, sym, off) =>
          '<button class="sv-navbtn" data-act="' + act + '" ' + (off ? 'disabled' : '')
          + ' title="' + (act === 'prevPeriod' ? 'Periode precedente (fleche gauche)' : 'Periode suivante (fleche droite)') + '">' + sym + '</button>';
        const periodNav = '<div class="sv-navwrap">' + navBtn('prevPeriod', '‹', atOldest)
          + '<span class="mono lbl">' + bucketLabel(ST.period) + '</span>' + navBtn('nextPeriod', '›', atNewest) + '</div>';

        const cycleAvail = !!ST.salaryDay;
        const modeSeg = '<div class="seg">' + seg('Calendaire', ST.mode === 'cal', 'mode', 'cal')
          + (cycleAvail ? seg('Cycle de paie', ST.mode === 'cycle', 'mode', 'cycle') : '') + '</div>';
        const widthSeg = '<div class="seg">' + seg('Etroit', ST.width === 'narrow', 'width', 'narrow')
          + seg('Moyen', ST.width === 'medium', 'width', 'medium') + seg('Large', ST.width === 'wide', 'width', 'wide') + '</div>';

        return '<div class="sv-topbar">'
          + '<div style="margin-right:auto">'
          + '<div class="sv-title">Suivi <span style="color:var(--muted)">·</span> <span style="color:var(--indigo)">' + bucketLabel(ST.period) + '</span></div>'
          + '<div class="note">' + bucketSub() + '</div>'
          + '</div>'
          + periodNav + modeSeg + widthSeg
          + '</div>';
      }

      /* ---- COCKPIT : cascade « d'un coup d'oeil » du mois -------------- */
      // Toutes les sommes passent par l'index (net/spent, plafonnees par cat)
      // et par detectRecurrents (part fixe). Aucun re-scan manuel des rows.
      function cockpit(bk, envs) {
        // Revenus recurrents = mediane sur 6 mois des revenus reels mensuels
        // (inclut les cats type revenu, ex. remboursement Simone).
        const revenus = BP.median(winBk(bk, 6).map(revenusMois));
        // Sommes de seuils (prevu) par FAMILLE + etalon total.
        let fixeObl = 0, oblVar = 0, arbPrevu = 0, budgetMoyen = 0, ponctuelMois = 0;
        for (const e of envs) {
          budgetMoyen += e.seuil;
          if (e.famille === 'fixe') fixeObl += e.seuil;
          else if (e.famille === 'variable') oblVar += e.seuil;
          else if (e.famille === 'arbitrable') arbPrevu += e.seuil;
          else if (e.famille === 'ponctuel') ponctuelMois += spentCat(e.cat, bk); // reel, informatif
        }
        const objectif = OBJECTIF;
        const resteApresObl = revenus - fixeObl - oblVar;   // apres charges obligatoires
        const disponibleArb = resteApresObl - objectif;     // apres mise de cote
        const marge = disponibleArb - arbPrevu;             // apres arbitrable prevu
        const H = ravOf(bk);                                // reel : revenus, depense, reste
        const A = analysisAll(); let imprevuMois = 0;
        for (const k in A) imprevuMois += (A[k].imprevuByMonth[bk] || 0);
        return { revenus, fixeObl, oblVar, resteApresObl, objectif, disponibleArb, arbPrevu, marge,
                 ponctuelMois, reelDep: H.dep, reelReste: H.rav, budgetMoyen, reelMois: H.dep, imprevuMois };
      }

      // Barre d'allocation : largeur = revenus, segmentee par poste. Le RESTE est
      // la Marge (vert si >=0, sinon debordement rouge hachure au-dela du revenu).
      function allocBarHtml(ck) {
        const parts = [
          { v: Math.max(0, ck.fixeObl), c: BP.FAMILLE_COLOR.fixe },
          { v: Math.max(0, ck.oblVar), c: BP.FAMILLE_COLOR.variable },
          { v: Math.max(0, ck.objectif), c: '#9aa1ad' },       // a mettre de cote (gris clair)
          { v: Math.max(0, ck.arbPrevu), c: BP.FAMILLE_COLOR.arbitrable }
        ];
        const rev = Math.max(0, ck.revenus);
        const committed = parts.reduce((a, p) => a + p.v, 0);
        const scale = Math.max(rev, committed, 1);
        let segs = parts.map(p => '<div class="sg" style="width:' + (p.v / scale * 100) + '%;background:' + p.c + '"></div>').join('');
        let over = '';
        if (ck.marge >= 0) {
          segs += '<div class="sg" style="width:' + (ck.marge / scale * 100) + '%;background:#46d39a"></div>';
        } else {
          // depassement : bande hachuree rouge du revenu jusqu'au total engage + marqueur.
          const left = rev / scale * 100, w = (committed - rev) / scale * 100;
          over = '<div class="ck-alloc-over" style="left:' + left + '%;width:' + w + '%"></div>'
            + '<div class="ck-alloc-mark" style="left:' + left + '%"></div>';
        }
        const leg = [
          ['Fixe obligatoire', BP.FAMILLE_COLOR.fixe, ck.fixeObl],
          ['Obligatoire variable', BP.FAMILLE_COLOR.variable, ck.oblVar],
          ['A mettre de cote', '#9aa1ad', ck.objectif],
          ['Arbitrable prevu', BP.FAMILLE_COLOR.arbitrable, ck.arbPrevu],
          [ck.marge >= 0 ? 'Marge' : 'Depassement', ck.marge >= 0 ? '#46d39a' : '#ff7a7a', Math.abs(ck.marge)]
        ].map(it => '<div class="it"><span class="pt" style="background:' + it[1] + '"></span>' + it[0]
          + ' <span class="amt mono">' + BP.eur0(it[2]) + '</span></div>').join('');
        return '<div class="ck-alloc">' + segs + over + '</div><div class="ck-leg">' + leg + '</div>';
      }

      function cockpitHtml(envs) {
        const ck = cockpit(ST.period, envs);
        const objField = ck.objectif
          ? '<input class="mono ck-obj" value="' + ck.objectif + '" data-input="objectif"> €'
          : '<input class="mono ck-obj" value="" placeholder="a definir" data-input="objectif"> €';
        const dispColor = ck.disponibleArb >= 0 ? '#fff' : '#ff7a7a';
        const margeColor = ck.marge >= 0 ? '#46d39a' : '#ff7a7a';
        const line = (l, v, vColor) => '<div class="ck-row"><span class="ck-l">' + l + '</span>'
          + '<span class="ck-v mono"' + (vColor ? ' style="color:' + vColor + '"' : '') + '>' + v + '</span></div>';
        const midLine = (l, v, vColor) => '<div class="ck-row ck-mid"><span class="ck-l">' + l + '</span>'
          + '<span class="ck-v mono" style="color:' + vColor + '">' + v + '</span></div>';
        const bigLine = (l, v, vColor) => '<div class="ck-row ck-big"><span class="ck-l">' + l + '</span>'
          + '<span class="ck-v mono" style="color:' + vColor + '">' + v + '</span></div>';
        // Verdict d'execution : reel du mois vs budget etalon (Σ seuils).
        const depasse = ck.reelMois - ck.budgetMoyen;
        const verdict = depasse <= 0
          ? '<span class="vd" style="color:#46d39a">tient · ' + BP.eur0(-depasse) + ' de marge</span>'
          : '<span class="vd" style="color:#ff7a7a">depasse de ' + BP.eur0(depasse) + '</span>';
        const impLine = ck.imprevuMois > 0
          ? '<div class="ck-row"><span class="ck-l" style="color:#ffb4b4">dont imprevu ce mois</span>'
            + '<span class="ck-v mono" style="color:#ffb4b4">' + BP.eur0(ck.imprevuMois) + '</span></div>'
          : '';
        return '<div class="hero" style="display:block">'
          + '<div class="lab" style="margin-bottom:8px">Cockpit du mois <span style="text-transform:none;letter-spacing:0;color:#dfe3ea">· ' + bucketLabel(ST.period) + '</span></div>'
          // ---- ZONE PLAN : barre de synthese + cascade compacte ----
          + '<div class="ck-zone">Plan (previsionnel)</div>'
          + allocBarHtml(ck)
          + '<div class="ck">'
          + line('Revenus (recurrents)', BP.eur0(ck.revenus), '#fff')
          + line('− Fixe obligatoire', BP.eur0(ck.fixeObl))
          + line('− Obligatoire variable', BP.eur0(ck.oblVar))
          + '<div class="ck-sep"></div>'
          + midLine('= Reste apres obligatoire', BP.eur0(ck.resteApresObl), ck.resteApresObl >= 0 ? '#eef0f4' : '#ff9a9a')
          + '<div class="ck-row"><span class="ck-l">− A mettre de cote</span><span class="ck-v mono">' + objField + '</span></div>'
          + '<div class="ck-sep"></div>'
          + bigLine('= Disponible pour l\'arbitrable', BP.eur0(ck.disponibleArb), dispColor)
          + line('− Arbitrable prevu', BP.eur0(ck.arbPrevu))
          + '<div class="ck-sep"></div>'
          + bigLine('= Marge', (ck.marge >= 0 ? '+' : '') + BP.eur0(ck.marge), margeColor)
          + '</div>'
          + '<div class="ck-sep strong"></div>'
          // ---- ZONE REEL : execution du mois + verdict ----
          + '<div class="ck-zone">Reel (ce mois)</div>'
          + '<div class="ck">'
          + line('Ponctuel ce mois (hors flux)', BP.eur0(ck.ponctuelMois), '#dfe3ea')
          + impLine
          + line('Depense a ce jour', '−' + BP.eur0(ck.reelDep).replace('−', ''), '#ff9a9a')
          + line('Reste reel', BP.eur0(ck.reelReste), ck.reelReste >= 0 ? '#eef0f4' : '#ff9a9a')
          + '</div>'
          + '<div class="ck-verdict"><span class="lb">Reel vs budget</span>' + verdict + '</div>'
          + '</div>';
      }

      /* ---- VUE MOIS ---------------------------------------------------- */
      function envEditorHtml(e) {
        if (e.mode === 'fixe') {
          return '<div style="margin-top:10px">'
            + '<label class="note" style="font-weight:600;display:block;margin-bottom:5px">Plafond mensuel</label>'
            + '<div style="display:flex;align-items:center;gap:7px">'
            + '<input class="inp mono sv-num" value="' + (e.budget || Math.round(e.seuil)) + '" data-input="num" data-cat="' + e.cat + '" data-field="Budget_mensuel">'
            + '<span class="note">€ / mois</span></div></div>';
        }
        if (e.mode === 'auto') {
          return '<div style="margin-top:10px">'
            + '<div style="font-size:12px;color:var(--ink);line-height:1.5">Seuil = <b>mediane des 6 derniers mois</b> = '
            + '<span class="mono" style="font-weight:600;color:var(--indigo)">' + BP.eur0(e.median6) + '</span>. Recalcule chaque mois.</div>'
            + '<button class="sv-btn-go" data-act="figer" data-arg="' + e.cat + '" style="margin-top:9px;background:var(--soft);color:var(--indigo)">Figer a ' + BP.eur0(e.median6) + ' (passer en fixe)</button></div>';
        }
        // flottant
        const recurList = e.recur.items.length
          ? e.recur.items.map(r => '<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0">'
              + '<span style="width:6px;height:6px;border-radius:50%;background:var(--indigo);flex:none"></span>'
              + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.label + '</span>'
              + '<span class="mono" style="color:var(--ink)">' + BP.eur0(r.amount) + '</span></div>').join('')
          : '<div class="note">Aucun mouvement recurrent detecte.</div>';
        const partFixeManuel = e.budget > 0;
        return '<div style="margin-top:10px">'
          + '<div class="note" style="font-weight:600;margin-bottom:6px">Part fixe ' + (partFixeManuel ? '(manuelle)' : '(recurrents detectes)') + ' · ' + BP.eur0(e.partFixe) + '</div>'
          + '<div style="background:var(--soft);border:1px solid var(--line);border-radius:9px;padding:9px 11px">' + recurList
          + (e.recur.items.length ? '<div style="border-top:1px dashed var(--line);margin-top:7px;padding-top:7px;font-size:11.5px;color:var(--muted)">= <b class="mono" style="color:var(--indigo)">' + BP.eur0(e.recur.sum) + '</b> de recurrents</div>' : '') + '</div>'
          + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px">'
          + '<div><label class="note" style="font-weight:600;display:block;margin-bottom:5px">Part fixe forcee</label>'
          + '<input class="inp mono sv-num" value="' + (e.budget || '') + '" placeholder="auto" data-input="num" data-cat="' + e.cat + '" data-field="Budget_mensuel"></div>'
          + '<div><label class="note" style="font-weight:600;display:block;margin-bottom:5px">Provision / mois</label>'
          + '<input class="inp mono sv-num" value="' + (e.prov || Math.round(e.provision)) + '" data-input="num" data-cat="' + e.cat + '" data-field="Provision"></div>'
          + '</div>'
          + '<div class="note" style="margin-top:9px;line-height:1.5">Reserve actuelle <b class="mono" style="color:var(--indigo)">' + BP.eur0(e.reserve) + '</b> '
          + '— derivee des 12 derniers mois, jamais stockee. Elle se remplit les mois calmes et absorbe les gros mois.</div>'
          + '</div>';
      }

      function envelopeCardHtml(e) {
        // Pastille = couleur de FAMILLE (coherence avec le regroupement/la barre).
        const famColor = BP.FAMILLE_COLOR[e.famille] || e.color;
        const reserveChip = e.mode === 'flottant' && e.reserve > 0
          ? '<span class="chip" style="background:var(--soft);color:var(--indigo)">reserve ' + BP.eur0(e.reserve) + '</span>' : '';
        // Puce d'alerte si la categorie a de l'imprevu ce mois (point rouge + texte).
        const imprevuChip = e.imprevuMois > 0
          ? '<span class="chip sv-imp"><span class="sv-dot"></span>imprevu ' + BP.eur0(e.imprevuMois) + '</span>' : '';
        // Panneau d'EDITION (deplie via le bouton reglages) : toggle de mode + editeur.
        const modeNote = e.hasOverride ? 'reglage manuel' : ('auto · ' + BP.NATURE_LABEL[e.natureAuto]);
        const editPanel = e.editing
          ? '<div class="env-edit">'
            + '<div class="sv-modeseg">'
            + '<button class="' + (e.mode === 'fixe' ? 'on' : '') + '" data-act="setmode" data-cat="' + e.cat + '" data-arg="fixe">Engagement fixe</button>'
            + '<button class="' + (e.mode === 'auto' ? 'on' : '') + '" data-act="setmode" data-cat="' + e.cat + '" data-arg="auto">Courant</button>'
            + '<button class="' + (e.mode === 'flottant' ? 'on' : '') + '" data-act="setmode" data-cat="' + e.cat + '" data-arg="flottant">Ponctuel</button>'
            + '</div>'
            + '<div class="note" style="margin:2px 0 0">' + modeNote + '</div>'
            + envEditorHtml(e)
            + '</div>'
          : '';
        // Carte compacte : pastille + nom + chip imprevu + bouton reglages ; valeur ;
        // barre fine ; reste. Pas de toggle permanent.
        return '<div class="card">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">'
          + '<span style="width:10px;height:10px;border-radius:3px;background:' + famColor + ';flex:none"></span>'
          + '<span style="font-size:13.5px;font-weight:650;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + e.cat + '">' + e.cat + '</span>'
          + imprevuChip
          + '<button class="sv-editbtn' + (e.editing ? ' on' : '') + '" data-act="edit" data-arg="' + e.cat + '" title="Reglages">⋯</button>'
          + '</div>'
          + '<div style="display:flex;align-items:baseline;gap:7px;margin-bottom:7px;flex-wrap:wrap">'
          + '<span class="mono" style="font-size:20px;font-weight:600;color:' + e.statusColor + '">' + BP.eur0(e.spent) + '</span>'
          + '<span class="note">/ ' + BP.eur0(e.seuil) + '</span>' + reserveChip
          + '<span style="margin-left:auto;font-size:11.5px;font-weight:600;color:' + e.statusColor + '">' + e.statusLabel + '</span></div>'
          + '<div class="bar">' + (e.cushion ? '<div style="position:absolute;top:0;height:100%;' + e.cushion + ';background:repeating-linear-gradient(90deg,var(--indigo),var(--indigo) 3px,transparent 3px,transparent 6px);opacity:.35"></div>' : '')
          + '<div class="fill" style="width:' + e.fillPct + '%;background:' + e.fillColor + '"></div></div>'
          + '<div style="position:relative;height:0"><div style="position:absolute;top:-9px;left:' + e.markPct + '%;width:2px;height:9px;background:var(--ink);border-radius:2px"></div></div>'
          + editPanel
          + '</div>';
      }

      function trendHtml() {
        const bks = winBk(ST.period, 6);
        const vals = bks.map(b => {
          let s = 0;
          store.catRows.forEach(c => { if (c.type === 'depense' && !BP.isLocatif(c.cat)) s += spentCat(c.cat, b); });
          return { b, v: s };
        });
        const max = Math.max.apply(null, vals.map(x => x.v).concat([1])) * 1.1;
        const med = BP.median(vals.map(x => x.v));
        const bars = vals.map((x, i) => {
          const cur = i === vals.length - 1, h = Math.max(4, x.v / max * 84);
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">'
            + '<div class="mono" style="font-size:10.5px;color:' + (cur ? 'var(--indigo)' : 'var(--muted)') + '">' + (Math.round(x.v / 100) / 10) + 'k</div>'
            + '<div style="width:100%;max-width:34px;height:' + h + 'px;border-radius:5px 5px 3px 3px;background:' + (cur ? 'var(--indigo)' : 'var(--line)') + '"></div>'
            + '<div class="note">' + bucketLabel(x.b).split(' ')[0] + '</div></div>';
        }).join('');
        return '<div class="card" style="margin-top:14px">'
          + '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">'
          + '<div style="font-size:13px;font-weight:680">Depenses, 6 periodes</div><div class="note">mediane ' + BP.eur0(med) + '</div></div>'
          + '<div style="display:flex;align-items:flex-end;gap:10px;height:108px">' + bars + '</div></div>';
      }

      // Enveloppes regroupees par FAMILLE (4 sections), sous-totaux budget/reel.
      function envelopesHtml(envs) {
        const groups = {}; BP.FAMILLE_ORDER.forEach(f => groups[f] = []);
        envs.forEach(e => (groups[e.famille] || (groups[e.famille] = [])).push(e));
        let sections = '';
        BP.FAMILLE_ORDER.forEach(fam => {
          const list = (groups[fam] || []).slice().sort((a, b) => b.seuil - a.seuil);
          if (!list.length) return;
          const budget = list.reduce((a, e) => a + e.seuil, 0);
          const reel = list.reduce((a, e) => a + spentCat(e.cat, ST.period), 0);
          sections += '<div class="sv-grouphead">'
            + '<span class="sv-gname"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + (BP.FAMILLE_COLOR[fam] || 'var(--muted)') + ';margin-right:7px;vertical-align:baseline"></span>' + BP.FAMILLE_LABEL[fam] + '</span>'
            + '<span class="note sv-gtot">budget <b class="mono">' + BP.eur0(budget) + '</b> · reel <b class="mono">' + BP.eur0(reel) + '</b></span>'
            + '</div>'
            + '<div class="grid">' + list.map(envelopeCardHtml).join('') + '</div>';
        });
        return '<div style="margin:20px 0 10px">'
          + '<div style="font-size:13px;font-weight:680">Enveloppes <span class="note">· ' + envs.length + ' categories, regroupees par famille</span></div>'
          + '</div>'
          + (sections || '<div class="note">Aucune depense categorisee sur cette periode.</div>')
          + trendHtml();
      }

      /* ---- SECTION TRAJECTOIRE (repliable, en bas de page) ------------ */
      function trajSectionHtml() {
        const open = ST.trajOpen;
        const head = '<button class="sv-trajhead" data-act="trajToggle">'
          + '<span class="sv-caret">' + (open ? '▾' : '▸') + '</span>'
          + 'Trajectoire &amp; objectif'
          + '<span class="note" style="margin-left:auto;font-weight:400">objectif, KPIs, courbe, prevu vs reel</span></button>';
        return '<div style="margin-top:22px">' + head
          + (open ? '<div style="margin-top:12px">' + viewTrajHtml() + '</div>' : '')
          + '</div>';
      }

      function trajectorySVG() {
        const ms = buckets(), obj = OBJECTIF;
        const real = ms.map(surplus); let cum = 0; const cumReal = real.map(v => cum += v);
        const projN = 6, lastCum = cumReal[cumReal.length - 1] || 0;
        const cumObj = ms.map((_, i) => obj * (i + 1));
        const allMax = Math.max.apply(null, cumReal.concat(cumObj, [lastCum + obj * projN, 1])) * 1.05;
        const allMin = Math.min.apply(null, [0].concat(cumReal));
        const N = ms.length + projN;
        const X = i => 10 + i * (580 / Math.max(1, N - 1));
        const Y = v => 8 + (1 - (v - allMin) / ((allMax - allMin) || 1)) * 150;
        const realPts = cumReal.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
        const objPts = ms.map((_, i) => X(i).toFixed(1) + ',' + Y(cumObj[i]).toFixed(1)).join(' ');
        const projPts = [];
        for (let k = 0; k <= projN; k++) projPts.push(X(ms.length - 1 + k).toFixed(1) + ',' + Y(lastCum + obj * k).toFixed(1));
        return '<svg viewBox="0 0 600 170" preserveAspectRatio="none" style="width:100%;height:150px;display:block">'
          + '<polyline class="sv-line-obj" points="' + objPts + '" fill="none" stroke-width="2" stroke-dasharray="5 4"></polyline>'
          + '<polyline class="sv-line-proj" points="' + projPts.join(' ') + '" fill="none" stroke-width="2" stroke-dasharray="2 4"></polyline>'
          + '<polyline class="sv-line-real" points="' + realPts + '" fill="none" stroke-width="2.5"></polyline>'
          + '</svg>';
      }

      function kpiTile(lab, val, color, sub) {
        return '<div class="card" style="padding:12px 14px">'
          + '<div class="lab" style="color:var(--muted)">' + lab + '</div>'
          + '<div class="mono" style="font-size:20px;font-weight:600;margin-top:4px;color:' + (color || 'var(--ink)') + '">' + val + '</div>'
          + '<div class="note">' + (sub || '') + '</div></div>';
      }

      function viewTrajHtml() {
        const m = ST.period, obj = OBJECTIF, real = surplus(m), ecart = real - obj;
        const cats = trajCats();
        const totalPrevu = cats.reduce((a, c) => a + prevuCat(c, m), 0);
        const totalReel = cats.reduce((a, c) => a + spentCat(c, m), 0);

        // KPIs globaux sur toute la serie.
        const allB = buckets();
        const reals = allB.map(surplus);
        const moy = reals.length ? reals.reduce((a, b) => a + b, 0) / reals.length : 0;
        let cum = 0; const cumReal = reals.map(v => cum += v);
        const lastCum = cumReal[cumReal.length - 1] || 0;
        const ecartCum = lastCum - obj * allB.length;
        const projection = lastCum + obj * 6;

        const rowsHtml = cats.map(c => {
          const p = prevuCat(c, m), reel = spentCat(c, m), e = p - reel;
          const fige = PREV_MAP[m + '||' + c] && PREV_MAP[m + '||' + c].fige;
          const color = (store.catMap[c] && store.catMap[c].color) || '#5b6470';
          return '<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + color + ';margin-right:7px"></span>' + c + (fige ? ' <span class="note">· fige</span>' : '') + '</td>'
            + '<td class="mono">' + BP.eur0(p) + '</td><td class="mono">' + BP.eur0(reel) + '</td>'
            + '<td class="mono" style="color:' + (e >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (e >= 0 ? '+' : '') + BP.eur0(e) + '</td></tr>';
        }).join('');
        const totalEcart = totalPrevu - totalReel;

        return '<div class="hero" style="display:flex;gap:26px;flex-wrap:wrap;align-items:flex-end">'
          + '<div><div class="lab">Objectif d\'epargne / mois</div>'
          + '<div style="margin-top:6px"><input class="inp mono sv-obj" value="' + (obj || '') + '" placeholder="0" data-input="objectif"> <span class="note">€</span></div></div>'
          + '<div><div class="lab">Epargne ' + bucketLabel(m) + '</div>'
          + '<div class="mono" style="font-size:30px;font-weight:600;margin-top:4px;color:' + (real < 0 ? '#ff7a7a' : '#fff') + '">' + BP.eur0(real) + '</div>'
          + '<div class="note">reste-a-vivre degage</div></div>'
          + '<div><div class="lab">Ecart a l\'objectif</div>'
          + '<div class="mono" style="font-size:22px;font-weight:600;margin-top:4px;color:' + (ecart >= 0 ? '#46d39a' : '#ff7a7a') + '">' + (ecart >= 0 ? '+' : '') + BP.eur0(ecart) + '</div>'
          + '<div class="note">' + (ecart >= 0 ? 'objectif atteint' : 'sous l\'objectif') + '</div></div>'
          + '</div>'
          + '<div class="sv-kpis">'
          + kpiTile('Epargne reelle moyenne', BP.eur0(moy), moy >= obj ? 'var(--green)' : 'var(--ink)', 'sur ' + allB.length + ' periodes')
          + kpiTile('Ecart cumule / objectif', (ecartCum >= 0 ? '+' : '') + BP.eur0(ecartCum), ecartCum >= 0 ? 'var(--green)' : 'var(--red)', 'depuis le debut')
          + kpiTile('Projection +6 mois', BP.eur0(projection), 'var(--indigo)', 'cumul a l\'objectif')
          + '</div>'
          + '<div class="card" style="margin-top:14px">'
          + '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">'
          + '<div style="font-size:13px;font-weight:680">Trajectoire d\'epargne cumulee</div>'
          + '<div class="note"><span style="color:var(--indigo)">▬</span> reel · <span style="color:var(--warn)">▬</span> objectif · <span style="color:var(--muted)">▬</span> projection</div>'
          + '</div>' + trajectorySVG()
          + '<div style="display:flex;justify-content:space-between;margin-top:2px" class="note"><span>' + bucketLabel(allB[0] || m) + '</span><span>+6 mois projetes</span></div>'
          + '</div>'
          + '<div class="card" style="margin-top:14px">'
          + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px">'
          + '<div style="font-size:13px;font-weight:680">Prevu vs reel · ' + bucketLabel(m) + '</div>'
          + '<button class="sv-btn-go" data-act="figerMois">Figer ce mois</button></div>'
          + '<table class="sv-tbl"><thead><tr><th>Categorie</th><th>Prevu</th><th>Reel</th><th>Ecart</th></tr></thead>'
          + '<tbody>' + (rowsHtml || '<tr><td colspan="4" class="note">Aucune depense ce mois.</td></tr>') + '</tbody>'
          + '<tfoot><tr style="font-weight:680"><td>Total</td><td class="mono">' + BP.eur0(totalPrevu) + '</td><td class="mono">' + BP.eur0(totalReel) + '</td>'
          + '<td class="mono" style="color:' + (totalEcart >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (totalEcart >= 0 ? '+' : '') + BP.eur0(totalEcart) + '</td></tr></tfoot>'
          + '</table>'
          + '<div class="note" style="margin-top:8px">Prevu = mediane 6 mois, ou valeur figee. « Figer » fixe le prevu du mois comme reference (snapshot).</div>'
          + '</div>';
      }

      /* ---- rendu global ----------------------------------------------- */
      function render() {
        if (!host.isConnected) return;
        clampPeriod();
        _recurCache = {}; _analysis = null;  // portee des caches = ce rendu
        const wpx = WIDTHS[ST.width];
        // Enveloppes calculees une fois, partagees cockpit + sections.
        const envs = activeCats().map(envelope);
        // Page unique qui defile : cockpit -> enveloppes -> trajectoire repliable.
        host.innerHTML = '<div class="wrap" style="max-width:' + wpx + 'px">'
          + headerHtml()
          + cockpitHtml(envs)
          + envelopesHtml(envs)
          + trajSectionHtml()
          + '<div class="note" style="margin-top:14px;text-align:right">Lecture de ' + store.rows.length + ' operations · '
          + '<a href="#" data-act="reload" style="color:var(--indigo)">rafraichir</a></div>'
          + '</div>';
      }

      /* ================================================================= */
      /* SYNCHRONISATION + EVENEMENTS                                      */
      /* ================================================================= */
      function clampPeriod() {
        const b = buckets();
        if (!b.length) { ST.period = ST.period || BP.ym(new Date()); return; }
        if (b.indexOf(ST.period) < 0) ST.period = b[b.length - 1];
      }

      // Rafraichissement quand les donnees partagees changent (store.apply, etc.)
      function onShared() {
        if (!host.isConnected) return;         // navigation partie ailleurs : on ignore
        ST.salaryDay = detectSalaryDay();
        if (!ST.salaryDay && ST.mode === 'cycle') ST.mode = 'cal';
        ST._index = null; ST._idxMode = null;  // l'index doit etre reconstruit
        render();
      }
      store.onChange(onShared);

      async function hardReload() {
        try { await store.load(); } catch (e) {}
        await loadOwn();
        ST.salaryDay = detectSalaryDay();
        ST._index = null; ST._idxMode = null;
        render();
      }

      function stepPeriod(dir) {
        const b = buckets(), i = b.indexOf(ST.period);
        if (dir < 0 && i > 0) { ST.period = b[i - 1]; render(); }
        if (dir > 0 && i >= 0 && i < b.length - 1) { ST.period = b[i + 1]; render(); }
      }

      host.addEventListener('click', e => {
        const a = e.target.closest('[data-act]'); if (!a) return;
        const act = a.dataset.act, arg = a.dataset.arg, cat = a.dataset.cat;
        if (act === 'reload') { e.preventDefault(); hardReload(); return; }
        if (act === 'trajToggle') { ST.trajOpen = !ST.trajOpen; render(); return; }
        if (act === 'width') { ST.width = arg; render(); return; }
        if (act === 'mode') { ST.mode = arg; ST._index = null; ST._idxMode = null; render(); return; }
        if (act === 'edit') { ST.editing = ST.editing === arg ? null : arg; render(); return; }
        if (act === 'setmode') { setMode(cat, arg); return; }
        if (act === 'figer') { figer(arg); return; }
        if (act === 'figerMois') { figerMois(); return; }
        if (act === 'prevPeriod') { stepPeriod(-1); return; }
        if (act === 'nextPeriod') { stepPeriod(1); return; }
      });

      host.addEventListener('change', e => {
        const num = e.target.closest('input[data-input="num"]');
        if (num) { commitNum(num.dataset.cat, num.dataset.field, num.value); return; }
        const obj = e.target.closest('input[data-input="objectif"]');
        if (obj) { setObjectif(obj.value); return; }
      });

      // Fleches clavier : navigation de periode (ignore si le focus est un champ).
      document.addEventListener('keydown', e => {
        if (!host.isConnected) return;
        if (e.key === 'Enter' && e.target.matches('input[data-input]')) { e.target.blur(); return; }
        if (e.target.matches('input,select,textarea')) return;
        if (e.key === 'ArrowLeft') stepPeriod(-1);
        else if (e.key === 'ArrowRight') stepPeriod(1);
      });

      /* ================================================================= */
      /* INITIALISATION                                                    */
      /* ================================================================= */
      (async function init() {
        host.innerHTML = '<div class="msg">Chargement…</div>';
        await ensureOwnTables();
        await loadOwn();
        ST.salaryDay = detectSalaryDay();
        if (!ST.salaryDay && ST.mode === 'cycle') ST.mode = 'cal';
        ST._index = null; ST._idxMode = null;
        const b = buckets();
        ST.period = b[b.length - 1] || BP.ym(new Date());
        render();
      })();
    }
  });
})();
