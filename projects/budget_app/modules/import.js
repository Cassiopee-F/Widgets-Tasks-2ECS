/* modules/import.js — Import de relevés CSV multi-banques vers Transactions.
   Module de la suite Budget (contrat BUDGET.register du shell app.html).
   Le parsing, la taxonomie et les helpers viennent du coeur partage (window.BP) :
   on NE reimplemente NI parseDate/parseAmount, NI la categorisation, NI la taxonomie.
   - En-tetes CSV : BP.normHeader (minuscules).
   - Logique metier (marchand, categorisation, dedup) : BP.norm (MAJUSCULES).
   Le fichier est inline dans un <script> par build-budget.js. */
(function () {
  'use strict';

  /* ---- Schema bootstrappe (widget maitre d'un document neuf) ------------ */
  const SCHEMA = {
    Transactions: [
      { id: 'Date', type: 'Date' }, { id: 'Libelle', type: 'Text' }, { id: 'Montant', type: 'Numeric' },
      { id: 'Categorie', type: 'Text' }, { id: 'Sous_categorie', type: 'Text' }, { id: 'Compte', type: 'Text' },
      { id: 'Banque', type: 'Text' }, { id: 'Reference', type: 'Text' }, { id: 'Exclu', type: 'Bool' }, { id: 'Notes', type: 'Text' }
    ],
    Regles: [
      { id: 'Motif', type: 'Text' }, { id: 'Categorie', type: 'Text' }, { id: 'Sous_categorie', type: 'Text' },
      { id: 'Exclu', type: 'Bool' }, { id: 'Priorite', type: 'Int' }
    ],
    Categories: [{ id: 'Categorie', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'Couleur', type: 'Text' }],
    Sous_categories: [{ id: 'Categorie', type: 'Text' }, { id: 'Sous_categorie', type: 'Text' }]
  };

  /* ---- Presets de formats FR : signature d'en-tetes -> roles de colonnes -- */
  const PRESETS = [
    {
      bank: 'LCL / CIC / Credit Mutuel', sep: ';',
      sig: ['date de comptabilisation', 'libelle simplifie', 'debit', 'credit'],
      map: { date: 'Date de comptabilisation', label: 'Libelle simplifie', label2: 'Informations complementaires', debit: 'Debit', credit: 'Credit', ref: 'Reference' }
    },
    {
      bank: 'Boursorama', sep: ';',
      sig: ['dateop', 'label', 'amount'],
      map: { date: 'dateOp', label: 'label', amount: 'amount', cat: 'category' }
    },
    {
      bank: 'Credit Agricole', sep: ';',
      sig: ['date', 'libelle', 'debit euros', 'credit euros'],
      map: { date: 'Date', label: 'Libelle', debit: 'Debit euros', credit: 'Credit euros' }
    },
    {
      bank: 'Societe Generale', sep: ';',
      sig: ['date de l', 'libelle', 'montant'],
      map: { date: "Date de l'operation", label: 'Libelle', amount: 'Montant de l’operation' }
    },
    {
      bank: 'BNP Paribas', sep: ';',
      sig: ['date operation', 'libelle', 'montant'],
      map: { date: 'Date operation', label: 'Libelle operation', amount: 'Montant' }
    },
    {
      bank: 'Caisse d’Epargne / Banque Populaire', sep: ';',
      sig: ['date', 'libelle', 'debit', 'credit'],
      map: { date: 'Date', label: 'Libelle', debit: 'Debit', credit: 'Credit' }
    },
    {
      bank: 'Revolut', sep: ',',
      sig: ['type', 'started date', 'description', 'amount'],
      map: { date: 'Started Date', label: 'Description', amount: 'Amount' }
    },
    {
      bank: 'N26', sep: ',',
      sig: ['date', 'payee', 'amount'],
      map: { date: 'Date', label: 'Payee', amount: 'Amount (EUR)' }
    }
  ];

  /* ---- CSS specifique au module (tokens du shell, clair/sombre herites) --- */
  function injectCss() {
    if (document.getElementById('imp-css')) return;
    const st = document.createElement('style');
    st.id = 'imp-css';
    st.textContent = [
      '.imp-lede{color:var(--muted);font-size:13px;margin:0 0 16px;max-width:640px}',
      '.imp-step{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:13px}',
      '.imp-step .n{display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:var(--ink);color:var(--paper);font-size:11px;font-weight:700}',
      '.imp-drop{border:1.5px dashed var(--line);border-radius:10px;padding:24px;text-align:center;transition:.15s;cursor:pointer;background:var(--soft)}',
      '.imp-drop:hover,.imp-drop.over{border-color:var(--indigo)}',
      '.imp-drop strong{color:var(--indigo)}',
      '.imp-drop p{margin:6px 0 0;color:var(--muted);font-size:12.5px}',
      '.imp-or{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:11px;margin:14px 0;text-transform:uppercase;letter-spacing:.08em}',
      '.imp-or::before,.imp-or::after{content:"";flex:1;height:1px;background:var(--line)}',
      '.imp-ta{width:100%;min-height:82px;font-family:ui-monospace,Menlo,monospace;font-size:12px;border:1px solid var(--line);border-radius:9px;padding:10px;resize:vertical;color:var(--ink);background:var(--card)}',
      '.imp-ta:focus{outline:none;border-color:var(--indigo)}',
      '.imp-chip{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:20px;font-size:12.5px;font-weight:600;background:var(--soft);color:var(--indigo)}',
      '.imp-chip.guess{color:var(--warn)}',
      '.imp-chip .dot{width:7px;height:7px;border-radius:50%;background:currentColor}',
      '.imp-map{display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:center;margin-bottom:9px}',
      '.imp-map label{font-size:12.5px;color:var(--muted)}',
      '.imp-sel{width:100%;font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}',
      '.imp-sel:focus{outline:none;border-color:var(--indigo)}',
      '.imp-stats{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:14px}',
      '.imp-stat .v{font-family:ui-monospace,Menlo,monospace;font-size:21px;font-weight:600;letter-spacing:-.02em}',
      '.imp-stat .k{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}',
      '.imp-stat.dup .v{color:var(--warn)}',
      '.imp-scroll{max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:9px}',
      '.imp-ledger{width:100%;border-collapse:collapse;font-size:12.5px}',
      '.imp-ledger th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600;padding:7px 8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card)}',
      '.imp-ledger td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:middle}',
      '.imp-ledger tr.dup{opacity:.45}',
      '.imp-ledger .date{font-family:ui-monospace,Menlo,monospace;color:var(--muted);white-space:nowrap}',
      '.imp-ledger .lib{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.imp-ledger .amt{font-family:ui-monospace,Menlo,monospace;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.imp-ledger .amt.pos{color:var(--green)} .imp-ledger .amt.neg{color:var(--red)}',
      '.imp-ledger .imp-sel.cat{font-size:11.5px;padding:3px 6px;max-width:180px}',
      '.imp-badge{display:inline-block;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;border-radius:5px;background:var(--soft);color:var(--muted)}',
      '.imp-badge.new{color:var(--green)}',
      '.imp-badge.exq{color:var(--red)}',
      '.imp-actions{display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap}',
      '.imp-btn{font-family:inherit;font-size:13.5px;font-weight:600;border:none;border-radius:9px;padding:10px 18px;cursor:pointer;transition:.12s}',
      '.imp-btn.primary{background:var(--indigo);color:#fff}',
      '.imp-btn.primary:hover{filter:brightness(1.07)}',
      '.imp-btn.primary:disabled{background:var(--line);color:var(--muted);cursor:default;filter:none}',
      '.imp-btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}',
      '.imp-btn.ghost:hover{border-color:var(--ink);color:var(--ink)}',
      '.imp-setup{background:var(--soft);border:1px solid var(--warn);border-radius:9px;padding:13px 15px;font-size:12.5px;color:var(--ink);margin-bottom:16px}',
      '.imp-setup .imp-btn{margin-top:9px;background:var(--warn);color:#fff;padding:7px 14px;font-size:12.5px}',
      '.imp-hidden{display:none}',
      '.imp-msg{font-size:12.5px;margin-top:2px}',
      '.imp-msg.ok{color:var(--green)} .imp-msg.err{color:var(--red)}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---- Robustesse CSV : separateur detecte, guillemets, BOM ------------- */
  function detectSep(line) {
    const cand = [[';', 0], ['\t', 0], [',', 0]];
    cand.forEach(c => { c[1] = line.split(c[0]).length; });
    cand.sort((a, b) => b[1] - a[1]);
    return cand[0][1] > 1 ? cand[0][0] : ';';
  }

  function parseCSV(text) {
    text = (text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    const lines = text.split('\n').filter(l => l.trim().length);
    if (!lines.length) return { head: [], rows: [], sep: ';' };
    const sep = detectSep(lines[0]);
    const split = line => {
      const out = []; let cur = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
          else cur += ch;
        } else {
          if (ch === '"') q = true;
          else if (ch === sep) { out.push(cur); cur = ''; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out.map(c => c.trim());
    };
    const head = split(lines[0]);
    const rows = lines.slice(1).map(split).filter(r => r.length >= Math.max(2, head.length - 2));
    return { head, rows, sep };
  }

  /* ---- Detection format : preset par signature, sinon mapping devine ---- */
  function detect(head, sampleRows) {
    const H = head.map(h => BP.normHeader(h));
    for (const p of PRESETS) {
      if (p.sig.every(s => H.some(h => h.includes(s)))) {
        const map = {};
        for (const role in p.map) {
          const want = BP.normHeader(p.map[role]);
          const idx = H.findIndex(h => h === want || h.includes(want) || want.includes(h));
          if (idx > -1) map[role] = idx;
        }
        return { bank: p.bank, map, guess: false };
      }
    }
    // heuristique generique
    const map = {};
    const score = re => head.findIndex(h => re.test(BP.normHeader(h)));
    let i;
    if ((i = score(/date.*compta|date.*op|^date$|dateop|date.*valeur/)) > -1) map.date = i;
    else if ((i = score(/date/)) > -1) map.date = i;
    if ((i = score(/debit/)) > -1) map.debit = i;
    if ((i = score(/credit/)) > -1) map.credit = i;
    if (map.debit == null && map.credit == null) { if ((i = score(/montant|amount/)) > -1) map.amount = i; }
    if ((i = score(/libell|label|description|payee|nature|motif|detail/)) > -1) map.label = i;
    if ((i = score(/reference|^ref/)) > -1) map.ref = i;
    if ((i = score(/categor/)) > -1) map.cat = i;
    const sample = sampleRows.slice(0, 8);
    const enough = Math.min(3, sample.length);
    if (map.date == null) {
      for (let c = 0; c < head.length; c++) {
        if (sample.filter(r => BP.parseDate(r[c])).length >= enough) { map.date = c; break; }
      }
    }
    if (map.amount == null && map.debit == null) {
      for (let c = 0; c < head.length; c++) {
        if (c === map.date) continue;
        const ok = sample.filter(r => BP.parseAmount(r[c]) != null && /[.,]\d|^-?\d+$/.test((r[c] || '').replace(/\s/g, ''))).length;
        if (ok >= enough) { map.amount = c; break; }
      }
    }
    if (map.label == null) {
      let best = -1, bl = 0;
      for (let c = 0; c < head.length; c++) {
        if (c === map.date) continue;
        const avg = sample.reduce((a, r) => a + (r[c] || '').length, 0) / Math.max(1, sample.length);
        if (avg > bl) { bl = avg; best = c; }
      }
      if (best > -1) map.label = best;
    }
    return { bank: 'Format inconnu', map, guess: true };
  }

  /* ---- Enregistrement du module ----------------------------------------- */
  BUDGET.register('import', {
    title: 'Import',
    access: 'full',
    mount(root, ctx) {
      const BP = ctx.BP, store = ctx.store, el = ctx.el;

      // Mode demo : le module ne fonctionne qu'attache a un document Grist.
      if (ctx.demo) {
        root.appendChild(el(
          '<div class="msg">' +
          '<strong>Import de releves bancaires.</strong><br>' +
          'Ce module s’execute a l’interieur d’un document Grist : ajoute-le comme widget ' +
          'personnalise (acces <em>Full</em>), puis colle ou depose le CSV de ta banque. ' +
          'Il detecte le format, categorise les operations et les ecrit dans la table ' +
          '<code>Transactions</code> (qu’il cree au besoin).' +
          '</div>'
        ));
        return;
      }

      injectCss();

      /* --- etat local (reconstruit a chaque montage) --- */
      let HEAD = [], ROWS = [], MAP = {}, BANK = '', PARSED = [];

      /* --- squelette DOM --- */
      const wrap = el('<div class="wrap"></div>');
      wrap.innerHTML =
        '<h1 style="font-size:19px;font-weight:680;letter-spacing:-.01em;margin:0 0 3px">Importateur de releves</h1>' +
        '<p class="imp-lede">Depose le releve CSV de ta banque. Le format est detecte, les colonnes mappees, ' +
        'les operations categorisees — tu valides, et tout part dans ta table <code>Transactions</code>.</p>' +

        '<div id="imp-setup" class="imp-setup imp-hidden">' +
        'Ce document n’a pas encore la structure du template. Je peux creer les tables ' +
        '<strong>Transactions</strong>, <strong>Regles</strong>, <strong>Categories</strong> et ' +
        '<strong>Sous_categories</strong> (avec la taxonomie francaise de depart) en un clic.' +
        '<div><button id="imp-boot" class="imp-btn">Creer la structure du template</button></div>' +
        '</div>' +

        '<div class="card" style="margin-bottom:16px">' +
        '<div class="imp-step"><span class="n">1</span> Charger le releve</div>' +
        '<div id="imp-drop" class="imp-drop"><strong>Choisir un fichier CSV</strong> ou glisse-le ici' +
        '<p>LCL · CIC · Credit Mutuel · Boursorama · BNP · Credit Agricole · Societe Generale · Caisse d’Epargne · Revolut · N26 — ou n’importe quel CSV</p>' +
        '<input id="imp-file" type="file" accept=".csv,.txt" class="imp-hidden"></div>' +
        '<div class="imp-or">ou coller le contenu</div>' +
        '<textarea id="imp-paste" class="imp-ta" placeholder="Date;Libelle;Debit;Credit&#10;…colle ici les lignes de ton export…"></textarea>' +
        '<div class="imp-actions"><button id="imp-parse" class="imp-btn ghost">Analyser</button></div>' +
        '</div>' +

        '<div id="imp-mapcard" class="card imp-hidden" style="margin-bottom:16px">' +
        '<div class="imp-step"><span class="n">2</span> Format detecte</div>' +
        '<div id="imp-detect" style="margin-bottom:14px"></div>' +
        '<div id="imp-mapgrid"></div>' +
        '<div class="note" style="margin-top:6px">Corrige un role si la detection s’est trompee — le tableau se met a jour en direct.</div>' +
        '</div>' +

        '<div id="imp-prevcard" class="card imp-hidden">' +
        '<div class="imp-step"><span class="n">3</span> Verifier et importer</div>' +
        '<div class="imp-stats" id="imp-statsbox"></div>' +
        '<div class="imp-scroll"><table class="imp-ledger"><thead><tr>' +
        '<th>Date</th><th>Libelle</th><th class="amt">Montant</th><th>Categorie</th><th></th>' +
        '</tr></thead><tbody id="imp-rows"></tbody></table></div>' +
        '<div class="imp-actions">' +
        '<button id="imp-commit" class="imp-btn primary">Importer</button>' +
        '<button id="imp-reset" class="imp-btn ghost">Recommencer</button>' +
        '<span id="imp-msg" class="imp-msg"></span>' +
        '</div>' +
        '</div>';
      root.appendChild(wrap);

      const $ = id => wrap.querySelector('#' + id);

      /* --- helpers d'affichage --- */
      const esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const fdate = ts => { const d = new Date(ts * 1000); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); };
      const catList = () => {
        const fromStore = (store.catRows || []).map(c => c.cat).filter(Boolean);
        const base = fromStore.length ? fromStore : BP.CAT_SEED.map(c => c[0]);
        return [...new Set([...base, 'A categoriser'])];
      };

      /* --- categorisation : Regles utilisateur puis taxonomie (core) ------
         L'attribut Exclu derive du Type de la categorie (contrat partage),
         jamais devine d'un nom de categorie en dur. */
      function categorize(lib) {
        const L = BP.norm(lib);
        for (const r of store.regles) {
          if (r.motif && L.includes(BP.norm(r.motif))) {
            const cat = r.cat || 'A categoriser';
            return { cat, sous: r.sous || '', exclu: store.typeOf(cat) === 'exclu' };
          }
        }
        const g = BP.guessCategory(lib);
        if (g) return { cat: g, sous: '', exclu: store.typeOf(g) === 'exclu' };
        return { cat: 'A categoriser', sous: '', exclu: false };
      }

      /* --- construction des operations depuis le mapping courant --------- */
      function build() {
        PARSED = [];
        const m = MAP;
        for (const r of ROWS) {
          const date = BP.parseDate(r[m.date]);
          let montant = null;
          if (m.amount != null) montant = BP.parseAmount(r[m.amount]);
          else {
            const d = BP.parseAmount(r[m.debit]);
            const c = BP.parseAmount(r[m.credit]);
            if (d != null && d !== 0) montant = -Math.abs(d);
            else if (c != null && c !== 0) montant = Math.abs(c);
            else montant = 0;
          }
          let lib = (r[m.label] || '').trim();
          if (m.label2 != null && r[m.label2]) lib += (lib ? ' — ' : '') + r[m.label2].trim();
          if (date == null || montant == null || !lib) continue;
          if (montant === 0) continue;                 // lignes de solde / montant nul : pas des operations
          montant = Math.round(montant * 100) / 100;
          const cat = categorize(lib);
          PARSED.push({
            Date: date, Libelle: lib, Montant: montant,
            Categorie: cat.cat, Sous_categorie: cat.sous, Exclu: cat.exclu,
            Banque: (BANK && BANK !== 'Format inconnu') ? BANK : '',
            Reference: (m.ref != null ? r[m.ref] : '') || '',
            dup: false
          });
        }
      }

      /* --- dedoublonnage : contre la table (store.rows) ET intra-fichier -- */
      const compositeKey = (date, montant, lib) => 'K:' + date + '|' + Math.round((montant || 0) * 100) + '|' + BP.norm(lib).slice(0, 18);
      function flagDuplicates() {
        const existing = new Set();
        for (const row of store.rows) existing.add(compositeKey(row.date, row.montant, row.lib));
        const seen = new Set();                         // dedup intra-fichier
        for (const p of PARSED) {
          const ck = compositeKey(p.Date, p.Montant, p.Libelle);
          const fk = p.Reference ? ('R:' + p.Reference) : ck;
          const tableDup = existing.has(ck);
          const fileDup = seen.has(fk);
          p.dup = tableDup || fileDup;
          seen.add(fk);
        }
      }

      /* --- rendu du mapping (roles corrigeables a la main) --------------- */
      function renderMapping(det) {
        BANK = det.bank; MAP = det.map;
        $('imp-detect').innerHTML = '<span class="imp-chip ' + (det.guess ? 'guess' : '') + '"><span class="dot"></span>' +
          (det.guess ? 'Format non reconnu — mapping devine' : 'Detecte : ' + esc(det.bank)) + '</span>';
        const roles = [['date', 'Date'], ['label', 'Libelle'], ['amount', 'Montant (signe)'], ['debit', 'Debit'], ['credit', 'Credit'], ['ref', 'Reference'], ['cat', 'Categorie source']];
        const opts = role => ['<option value="">— aucune —</option>']
          .concat(HEAD.map((h, j) => '<option value="' + j + '"' + (MAP[role] === j ? ' selected' : '') + '>' + esc(h || ('Colonne ' + (j + 1))) + '</option>')).join('');
        $('imp-mapgrid').innerHTML = roles.map(([k, lab]) =>
          '<div class="imp-map"><label>' + lab + '</label><select class="imp-sel" data-role="' + k + '">' + opts(k) + '</select></div>').join('');
        $('imp-mapgrid').querySelectorAll('select').forEach(sel => {
          sel.onchange = () => {
            const v = sel.value;
            if (v === '') delete MAP[sel.dataset.role]; else MAP[sel.dataset.role] = +v;
            refresh();
          };
        });
        $('imp-mapcard').classList.remove('imp-hidden');
      }

      /* --- recalcul + rendu de l'apercu ---------------------------------- */
      function refresh() {
        build();
        flagDuplicates();
        const nNew = PARSED.filter(p => !p.dup).length;
        const nDup = PARSED.filter(p => p.dup).length;
        const sum = PARSED.filter(p => !p.dup).reduce((a, p) => a + p.Montant, 0);
        $('imp-statsbox').innerHTML =
          '<div class="imp-stat"><div class="v">' + nNew + '</div><div class="k">a importer</div></div>' +
          (nDup ? '<div class="imp-stat dup"><div class="v">' + nDup + '</div><div class="k">doublons ignores</div></div>' : '') +
          '<div class="imp-stat"><div class="v" style="color:' + (sum < 0 ? 'var(--red)' : 'var(--green)') + '">' + BP.eur(sum) + '</div><div class="k">solde net</div></div>';

        const cats = catList();
        const catOpts = cur => cats.map(c => '<option' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
        $('imp-rows').innerHTML = PARSED.map((p, i) =>
          '<tr class="' + (p.dup ? 'dup' : '') + '">' +
          '<td class="date">' + fdate(p.Date) + '</td>' +
          '<td class="lib" title="' + esc(p.Libelle) + '">' + esc(p.Libelle) + '</td>' +
          '<td class="amt ' + (p.Montant < 0 ? 'neg' : 'pos') + '">' + BP.eur(p.Montant) + '</td>' +
          '<td>' + (p.dup ? '<span class="imp-badge">doublon</span>' : '<select class="imp-sel cat" data-i="' + i + '">' + catOpts(p.Categorie) + '</select>') + '</td>' +
          '<td>' + (p.dup ? '' : (p.Exclu ? '<span class="imp-badge exq">exclu</span>' : '<span class="imp-badge new">nouveau</span>')) + '</td>' +
          '</tr>').join('');
        $('imp-rows').querySelectorAll('select.cat').forEach(s => {
          s.onchange = () => {
            const p = PARSED[+s.dataset.i];
            p.Categorie = s.value;
            p.Exclu = store.typeOf(s.value) === 'exclu';
            refresh();
          };
        });

        const commit = $('imp-commit');
        commit.disabled = nNew === 0;
        commit.textContent = nNew ? ('Importer ' + nNew + ' operation' + (nNew > 1 ? 's' : '')) : 'Rien a importer';
        $('imp-prevcard').classList.remove('imp-hidden');
        $('imp-prevcard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      /* --- ecriture des operations (batch) via le Store ------------------ */
      async function commit() {
        const todo = PARSED.filter(p => !p.dup);
        if (!todo.length) return;
        const commitBtn = $('imp-commit'), msg = $('imp-msg');
        commitBtn.disabled = true; msg.className = 'imp-msg'; msg.textContent = 'Import en cours…';
        const cols = { Date: [], Libelle: [], Montant: [], Categorie: [], Sous_categorie: [], Compte: [], Banque: [], Reference: [], Exclu: [], Notes: [] };
        todo.forEach(p => {
          cols.Date.push(p.Date); cols.Libelle.push(p.Libelle); cols.Montant.push(p.Montant);
          cols.Categorie.push(p.Categorie); cols.Sous_categorie.push(p.Sous_categorie); cols.Compte.push('');
          cols.Banque.push(p.Banque); cols.Reference.push(p.Reference); cols.Exclu.push(p.Exclu); cols.Notes.push('');
        });
        try {
          await store.apply([['BulkAddRecord', 'Transactions', todo.map(() => null), cols]]);
          // store.apply a recharge Transactions : refresh re-marque les operations comme doublons.
          refresh();
          msg.className = 'imp-msg ok';
          msg.textContent = todo.length + ' operation' + (todo.length > 1 ? 's' : '') + ' importee' + (todo.length > 1 ? 's' : '') + ' dans Transactions.';
        } catch (e) {
          console.error('[import] echec de l’ecriture des transactions', e);
          msg.className = 'imp-msg err';
          msg.textContent = 'Echec : ' + (e && e.message || e);
          commitBtn.disabled = false;
        }
      }

      /* --- bootstrap du schema (tables + taxonomie de depart) ------------ */
      async function ensureSchema() {
        const need = [];
        for (const t in SCHEMA) {
          try { await ctx.grist.docApi.fetchTable(t); }
          catch (e) { need.push(t); }                   // fetchTable jette si la table est absente : signal attendu
        }
        $('imp-setup').classList.toggle('imp-hidden', need.length === 0);
      }

      async function bootstrap() {
        const btn = $('imp-boot');
        btn.disabled = true; btn.textContent = 'Creation…';
        try {
          for (const t in SCHEMA) {
            let exists = true;
            try { await ctx.grist.docApi.fetchTable(t); }
            catch (e) { exists = false; }
            if (!exists) await ctx.grist.docApi.applyUserActions([['AddTable', t, SCHEMA[t]]]);
          }
          // Semences (uniquement si la table est vide).
          const cats = await ctx.grist.docApi.fetchTable('Categories');
          if (!(cats.id && cats.id.length)) {
            await ctx.grist.docApi.applyUserActions([['BulkAddRecord', 'Categories', BP.CAT_SEED.map(() => null),
              { Categorie: BP.CAT_SEED.map(x => x[0]), Type: BP.CAT_SEED.map(x => x[1]), Couleur: BP.CAT_SEED.map(x => x[2]) }]]);
          }
          const reg = await ctx.grist.docApi.fetchTable('Regles');
          if (!(reg.id && reg.id.length)) {
            const seed = [
              ['CARREFOUR', 'Alimentation', '', false, 5], ['NETFLIX', 'Loisirs', '', false, 5],
              ['EDF', 'Logement', '', false, 5], ['LOYER', 'Logement', 'Loyer', false, 9]
            ];
            await ctx.grist.docApi.applyUserActions([['BulkAddRecord', 'Regles', seed.map(() => null),
              { Motif: seed.map(s => s[0]), Categorie: seed.map(s => s[1]), Sous_categorie: seed.map(s => s[2]), Exclu: seed.map(s => s[3]), Priorite: seed.map(s => s[4]) }]]);
          }
          const sc = await ctx.grist.docApi.fetchTable('Sous_categories');
          if (!(sc.id && sc.id.length)) {
            const pairs = [];
            for (const cat in BP.SOUS_SEED) for (const s of BP.SOUS_SEED[cat]) pairs.push([cat, s]);
            await ctx.grist.docApi.applyUserActions([['BulkAddRecord', 'Sous_categories', pairs.map(() => null),
              { Categorie: pairs.map(p => p[0]), Sous_categorie: pairs.map(p => p[1]) }]]);
          }
          await store.load();                            // recharge le Store partage (Regles/Categories/...)
          $('imp-setup').classList.add('imp-hidden');
          if (PARSED.length) refresh();                  // re-categorise l'apercu avec les nouvelles regles
        } catch (e) {
          console.error('[import] echec du bootstrap du schema', e);
          btn.disabled = false; btn.textContent = 'Reessayer';
          alert('Erreur lors de la creation du template : ' + (e && e.message || e));
        }
      }

      /* --- ingestion d'un CSV (fichier, glisser-deposer, coller) --------- */
      function ingest(text) {
        const p = parseCSV(text);
        if (!p.head.length) { alert('CSV illisible.'); return; }
        HEAD = p.head; ROWS = p.rows;
        renderMapping(detect(p.head, ROWS));
        refresh();
      }

      /* --- cablage des controles ---------------------------------------- */
      const drop = $('imp-drop'), file = $('imp-file');
      drop.onclick = () => file.click();
      file.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => ingest(r.result);
        r.onerror = () => { console.error('[import] lecture de fichier impossible', r.error); alert('Lecture du fichier impossible.'); };
        r.readAsText(f, 'utf-8');
      };
      ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => {
        const f = e.dataTransfer.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => ingest(r.result);
        r.onerror = () => { console.error('[import] lecture de fichier impossible', r.error); alert('Lecture du fichier impossible.'); };
        r.readAsText(f, 'utf-8');
      });
      $('imp-parse').onclick = () => {
        const t = $('imp-paste').value.trim();
        if (t) ingest(t); else alert('Colle d’abord le contenu du releve.');
      };
      $('imp-commit').onclick = commit;
      $('imp-reset').onclick = () => {
        HEAD = []; ROWS = []; PARSED = []; MAP = {}; BANK = '';
        $('imp-paste').value = ''; file.value = '';
        $('imp-mapcard').classList.add('imp-hidden');
        $('imp-prevcard').classList.add('imp-hidden');
        $('imp-msg').textContent = '';
      };
      $('imp-boot').onclick = bootstrap;

      // Verifie la presence du schema au montage (affiche l'aide au besoin).
      ensureSchema().catch(e => console.error('[import] verification du schema impossible', e));
    }
  });
})();
