/* modules/classement.js — Classement des operations non categorisees.
   Regroupe les operations « A categoriser » par marchand (BP.merchantKey) et, pour
   chaque groupe, propose UNE combobox intelligente « tape un terme » qui filtre en
   direct les paires Famille > Sous-categorie existantes, classees par pertinence
   (historique du marchand > taxonomie > correspondance du terme). Selectionner une
   entree applique famille + sous-categorie d'un coup (BulkUpdateRecord). La combobox
   sait aussi CREER une sous-categorie ou une famille a la volee (dedup insensible
   casse/accents) et le module apprend une Regle quand c'est pertinent.

   Contrat shell : BUDGET.register(id, { title, access, mount(root, ctx) }).
   Donnees deja chargees dans ctx.store ; ecritures via ctx.store.apply(actions). */
(function () {
  'use strict';
  if (!window.BUDGET || typeof window.BUDGET.register !== 'function') return;

  // Etat au niveau module (le shell rappelle mount() a chaque navigation).
  let _ctx = null, _root = null, _bound = false;
  let _closeOpen = null;                 // ferme le menu combobox actuellement ouvert

  const CSS_ID = 'cls-module-css';
  const TYPES = [['depense', 'Depense'], ['revenu', 'Revenu'], ['epargne', 'Epargne'], ['exclu', 'Exclu']];
  const SRC_META = {
    'appris': 'var(--green)', 'regle': 'var(--indigo)',
    'connu': 'var(--warn)', 'a confirmer': 'var(--muted)'
  };
  const SRC_LABEL = { 'appris': 'appris', 'regle': 'regle', 'connu': 'connu', 'a confirmer': 'a confirmer' };

  /* ---- Styles propres au module (tokens du shell, clair/sombre herites) ---- */
  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.cls-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:14px}',
      '.cls-grp{margin-bottom:10px}',
      '.cls-gh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
      '.cls-dot{width:10px;height:10px;border-radius:3px;flex:none}',
      '.cls-name{font-size:14px;font-weight:700}',
      '.cls-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.cls-cb{position:relative;flex:1;min-width:240px}',
      '.cls-cb .inp{width:100%}',
      '.cls-menu{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:40;background:var(--card);',
      '  border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);max-height:300px;overflow:auto;padding:4px}',
      '.cls-menu[hidden]{display:none}',
      '.cls-opt{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;cursor:pointer;font-size:13px}',
      '.cls-opt.hi{background:var(--soft)}',
      '.cls-opt .odot{width:9px;height:9px;border-radius:3px;flex:none}',
      '.cls-opt .osub{color:var(--muted)}',
      '.cls-opt .osep{color:var(--muted)}',
      '.cls-opt.create{color:var(--indigo);font-weight:600}',
      '.cls-opt .grow{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cls-opt .seg{margin-left:auto}',
      '.cls-empty{padding:10px;color:var(--muted);font-size:12.5px}',
      '.cls-sug{border:none;background:var(--soft);color:var(--ink);border-radius:8px;padding:6px 11px;',
      '  font-size:12.5px;font-weight:600;cursor:pointer}',
      '.cls-more{border:none;background:transparent;color:var(--muted);font-size:12px;cursor:pointer;padding:4px 2px}',
      '.cls-detail{margin-top:8px}',
      '.cls-line{display:flex;align-items:center;gap:10px;padding:5px 0;border-top:1px solid var(--line);font-size:12.5px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---- Une operation est « non classee » si vide ou « A categoriser » ------ */
  function isUncat(cat, norm) {
    if (!cat) return true;
    const n = norm(cat);
    return n === '' || n === 'A CATEGORISER';
  }

  const mk = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  /* ===================================================================== */
  /* Rendu complet (rejoue a chaque store.onChange, apres chaque ecriture). */
  /* ===================================================================== */
  function render() {
    if (!_ctx || !_root) return;
    const ctx = _ctx, root = _root, store = ctx.store, BP = ctx.BP;
    const norm = BP.norm;
    _closeOpen = null;                   // les anciens menus viennent d'etre detruits

    /* --- Precalcul : cle marchand par ligne (une seule fois) -------------- */
    const keyOf = new Map();
    const histCount = new Map();         // cle -> Map(label -> {cat,sous,n})
    for (const r of store.rows) {
      const k = BP.merchantKey(r.lib);
      keyOf.set(r.rowId, k);
      if (isUncat(r.cat, norm)) continue;
      let hm = histCount.get(k);
      if (!hm) { hm = new Map(); histCount.set(k, hm); }
      const lbl = r.cat + '||' + (r.sous || '');
      const cur = hm.get(lbl) || { cat: r.cat, sous: r.sous || '', n: 0 };
      cur.n++; hm.set(lbl, cur);
    }
    // Marchand -> classement le plus frequent dans l'historique.
    const histByMerchant = new Map();
    histCount.forEach((hm, k) => {
      let best = null;
      hm.forEach(v => { if (!best || v.n > best.n) best = v; });
      if (best) histByMerchant.set(k, { cat: best.cat, sous: best.sous });
    });

    /* --- Precalcul : paires Famille > Sous existantes (hors revenu/epargne) - */
    const pairs = [];
    store.catRows.forEach(c => {
      if (isUncat(c.cat, norm)) return;
      const t = store.typeOf(c.cat);
      if (t === 'revenu' || t === 'epargne') return;
      const color = c.color || '#c2c7d0';
      pairs.push({ cat: c.cat, sous: '', normFam: norm(c.cat), normSous: '', normLabel: norm(c.cat), color });
      (store.sousMap[c.cat] || []).forEach(s => {
        pairs.push({ cat: c.cat, sous: s, normFam: norm(c.cat), normSous: norm(s), normLabel: norm(c.cat + ' ' + s), color });
      });
    });

    /* --- Groupes de marchands non classes (indexes par cle) --------------- */
    const gmap = new Map();
    for (const r of store.rows) {
      if (!isUncat(r.cat, norm)) continue;
      const k = keyOf.get(r.rowId);
      let g = gmap.get(k);
      if (!g) { g = { key: k, items: [], libs: [] }; gmap.set(k, g); }
      g.items.push(r); g.libs.push(r.lib);
    }
    const groups = [...gmap.values()].sort((a, b) => b.items.length - a.items.length);

    /* --- Suggestion de pre-remplissage : Appris > Regle > Connu > confirmer  */
    function suggestFor(g) {
      const h = histByMerchant.get(g.key);
      if (h && h.cat) return { cat: h.cat, sous: h.sous || '', src: 'appris' };
      for (const rg of store.regles) {
        const m = norm(rg.motif);
        if (!m) continue;
        if (norm(g.key).includes(m) || g.libs.some(l => norm(l).includes(m)))
          return { cat: rg.cat, sous: rg.sous || '', src: 'regle' };
      }
      const guess = BP.guessCategory(g.libs[0] || g.key);
      if (guess) return { cat: guess, sous: '', src: 'connu' };
      return { cat: '', sous: '', src: 'a confirmer' };
    }

    /* --- Ecritures ------------------------------------------------------- */
    // N'apprend une regle que si le marchand est specifique (pas 1 token trop court)
    // et qu'aucune regle existante ne le couvre deja.
    function maybeRuleAction(g, famille, sous) {
      const key = g.key;
      if (!key) return null;
      const toks = key.split(' ').filter(Boolean);
      const compact = key.replace(/\s+/g, '');
      if (toks.length < 2 && compact.length < 4) return null;   // trop generique -> sur-matching
      const covered = store.regles.some(rg => {
        const m = norm(rg.motif);
        if (!m) return false;
        return norm(key).includes(m) || g.libs.some(l => norm(l).includes(m));
      });
      if (covered) return null;
      return ['AddRecord', 'Regles', null, { Motif: key, Categorie: famille, Sous_categorie: sous || '', Priorite: 10 }];
    }

    // Applique famille + sous a tout le groupe, + apprentissage regle, en un seul lot atomique.
    async function classify(g, famille, sous, extra) {
      if (!famille) return;
      const ids = g.items.map(i => i.rowId);
      const acts = (extra || []).slice();
      acts.push(['BulkUpdateRecord', 'Transactions', ids, {
        Categorie: ids.map(() => famille),
        Sous_categorie: ids.map(() => sous || '')
      }]);
      const rule = maybeRuleAction(g, famille, sous);
      if (rule) acts.push(rule);
      await store.apply(acts);           // recharge + notifie -> render()
    }

    // Dedup insensible casse/accents : reutilise l'existant sinon prepare l'AddRecord.
    function ensureSous(famille, term) {
      const nt = norm(term);
      const existing = (store.sousMap[famille] || []).find(s => norm(s) === nt);
      if (existing) return { sous: existing, acts: [] };
      return { sous: term, acts: [['AddRecord', 'Sous_categories', null, { Categorie: famille, Sous_categorie: term }]] };
    }
    function ensureFamille(term, type) {
      const nt = norm(term);
      const existing = store.catRows.find(c => norm(c.cat) === nt);
      if (existing) return { fam: existing.cat, acts: [] };
      return { fam: term, acts: [['AddRecord', 'Categories', null, { Categorie: term, Type: type || 'depense', Couleur: '#5b6470' }]] };
    }

    /* --- Etat vide / rien a classer -------------------------------------- */
    root.innerHTML = '';
    const wrap = mk('div', 'wrap');
    root.appendChild(wrap);

    if (!store.rows.length) {
      wrap.appendChild(el(ctx,
        '<div class="msg"><b>Aucune operation.</b><br><span class="note">Importe d\'abord un releve : le classement lit la table Transactions.</span></div>'));
      return;
    }
    if (!groups.length) {
      wrap.appendChild(el(ctx,
        '<div class="msg"><b>Tout est categorise.</b><br><span class="note">' + store.rows.length +
        ' operations, aucune en attente. Le classement reprendra au prochain import.</span></div>'));
      return;
    }

    /* --- En-tete --------------------------------------------------------- */
    const nOps = groups.reduce((a, g) => a + g.items.length, 0);
    const head = mk('div', 'cls-head');
    const hTitle = mk('div', null);
    hTitle.appendChild(mk('div', null, 'Classement'));
    hTitle.querySelector('div').style.cssText = 'font-size:19px;font-weight:700';
    const hNote = mk('div', 'note',
      nOps + ' operation' + (nOps > 1 ? 's' : '') + ' a categoriser · ' +
      groups.length + ' marchand' + (groups.length > 1 ? 's' : ''));
    head.appendChild(hTitle);
    head.appendChild(hNote);
    wrap.appendChild(head);

    /* --- Une carte par marchand ------------------------------------------ */
    groups.forEach(g => wrap.appendChild(buildGroupCard(g)));

    /* ---- Construction d'une carte de groupe ----------------------------- */
    function buildGroupCard(g) {
      const sug = suggestFor(g);
      const guessFam = (BP.guessCategory(g.libs[0] || g.key)) || '';
      const total = g.items.reduce((a, i) => a + i.montant, 0);

      const card = mk('div', 'card cls-grp');

      // Ligne de titre marchand + chip source + montant.
      const gh = mk('div', 'cls-gh');
      const dot = mk('span', 'cls-dot');
      dot.style.background = (store.catMap[sug.cat] && store.catMap[sug.cat].color) || '#c2c7d0';
      gh.appendChild(dot);
      gh.appendChild(mk('span', 'cls-name', g.key || '(marchand inconnu)'));
      gh.appendChild(mk('span', 'note',
        g.items.length + ' op. · ' + BP.eur0(total)));
      const chip = mk('span', 'chip', SRC_LABEL[sug.src] || sug.src);
      chip.style.cssText = 'margin-left:auto;background:var(--soft);color:' + (SRC_META[sug.src] || 'var(--muted)');
      gh.appendChild(chip);
      card.appendChild(gh);

      // Ligne d'action : combobox + suggestion rapide + detail.
      const rowEl = mk('div', 'cls-row');
      rowEl.appendChild(buildCombobox(g, sug, guessFam));

      if (sug.cat && sug.src !== 'a confirmer') {
        const sugBtn = mk('button', 'cls-sug',
          'Classer « ' + sug.cat + (sug.sous ? ' › ' + sug.sous : '') + ' »');
        sugBtn.onclick = () => classify(g, sug.cat, sug.sous, []);
        rowEl.appendChild(sugBtn);
      }

      const moreBtn = mk('button', 'cls-more', '▸ detail');
      const detail = mk('div', 'cls-detail');
      detail.hidden = true;
      moreBtn.onclick = () => {
        detail.hidden = !detail.hidden;
        moreBtn.textContent = detail.hidden ? '▸ detail' : '▾ replier';
        if (!detail.childElementCount) fillDetail(detail, g);
      };
      rowEl.appendChild(moreBtn);
      card.appendChild(rowEl);
      card.appendChild(detail);
      return card;
    }

    function fillDetail(box, g) {
      g.items.forEach(r => {
        const line = mk('div', 'cls-line');
        const d = BP.gristToDate(r.date);
        const dEl = mk('span', 'note', d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '');
        dEl.style.width = '52px';
        const lib = mk('span', 'grow', r.lib);
        lib.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const amt = mk('span', 'mono', BP.eur(r.montant));
        amt.style.color = r.montant < 0 ? 'var(--red)' : 'var(--green)';
        line.appendChild(dEl); line.appendChild(lib); line.appendChild(amt);
        box.appendChild(line);
      });
    }

    /* ---- Combobox intelligente ------------------------------------------ */
    function buildCombobox(g, sug, guessFam) {
      const cb = mk('div', 'cls-cb');
      const input = mk('input', 'inp');
      input.type = 'text';
      input.placeholder = 'tape un terme (ex. courses, restaurant, EDF…)';
      const menu = mk('div', 'cls-menu');
      menu.hidden = true;
      cb.appendChild(input);
      cb.appendChild(menu);

      let entries = [];                  // entrees courantes du menu
      let hi = 0;                        // index surligne

      const close = () => { menu.hidden = true; };
      const open = () => {
        if (_closeOpen && _closeOpen !== close) _closeOpen();
        _closeOpen = close;
        menu.hidden = false;
      };

      // Pertinence d'une paire : historique/taxo d'abord, puis qualite du terme.
      function score(p, nt) {
        let s = 0;
        if (sug.cat && p.cat === sug.cat) s += (p.sous === sug.sous) ? 1000 : 600;
        if (guessFam && p.cat === guessFam) s += 300;
        if (nt) {
          const fp = p.normFam.indexOf(nt), sp = p.normSous.indexOf(nt);
          if (fp === 0 || sp === 0) s += 200;
          else if (fp >= 0 || sp >= 0) s += 100;
        }
        return s;
      }

      function build(term) {
        const t = (term || '').trim();
        const nt = norm(t);
        let list = pairs;
        if (nt) list = pairs.filter(p => p.normLabel.includes(nt));
        const scored = list.map(p => ({ p, s: score(p, nt) }))
          .sort((a, b) => b.s - a.s
            || a.p.cat.localeCompare(b.p.cat, 'fr')
            || a.p.normSous.localeCompare(b.p.normSous, 'fr'));

        const exact = nt && pairs.some(p => p.normFam === nt || p.normSous === nt);
        entries = [];
        menu.innerHTML = '';

        // Options de creation en tete quand le terme ne matche pas exactement.
        if (nt && !exact) {
          const ctxFam = (scored[0] && scored[0].p.cat) || sug.cat || guessFam || '';
          if (ctxFam) entries.push({ type: 'csous', term: t, fam: ctxFam });
          entries.push({ type: 'cfam', term: t });
        }
        scored.slice(0, 50).forEach(x => entries.push({ type: 'pair', pair: x.p }));

        if (!entries.length) {
          menu.appendChild(mk('div', 'cls-empty', 'Aucune categorie — tape un nom pour la creer.'));
        } else {
          hi = 0;
          entries.forEach((en, i) => menu.appendChild(renderEntry(en, i)));
          paintHi();
        }
      }

      function renderEntry(en, i) {
        const opt = mk('div', 'cls-opt');
        opt.dataset.i = i;
        if (en.type === 'pair') {
          const d = mk('span', 'odot'); d.style.background = en.pair.color;
          opt.appendChild(d);
          opt.appendChild(mk('span', 'grow', en.pair.cat));
          if (en.pair.sous) {
            opt.appendChild(mk('span', 'osep', '›'));
            opt.appendChild(mk('span', 'osub', en.pair.sous));
          }
        } else if (en.type === 'csous') {
          opt.classList.add('create');
          opt.appendChild(mk('span', 'grow',
            '+ Creer sous-categorie « ' + en.term + ' » dans ' + en.fam));
        } else {
          opt.classList.add('create');
          opt.appendChild(mk('span', 'grow', '+ Nouvelle famille « ' + en.term + ' »'));
          // Choix du Type (defaut : depense).
          const seg = mk('div', 'seg');
          TYPES.forEach(([val, lbl]) => {
            const b = mk('button', val === 'depense' ? 'on' : null, lbl);
            b.onmousedown = ev => { ev.preventDefault(); ev.stopPropagation(); doCreateFam(en.term, val); };
            seg.appendChild(b);
          });
          opt.appendChild(seg);
        }
        opt.onmouseenter = () => { hi = i; paintHi(); };
        opt.onmousedown = ev => { ev.preventDefault(); activate(en); };
        return opt;
      }

      function paintHi() {
        const opts = menu.querySelectorAll('.cls-opt');
        opts.forEach((o, i) => o.classList.toggle('hi', i === hi));
        const cur = opts[hi];
        if (cur) cur.scrollIntoView({ block: 'nearest' });
      }

      function activate(en) {
        if (en.type === 'pair') classify(g, en.pair.cat, en.pair.sous, []);
        else if (en.type === 'csous') doCreateSous(en.fam, en.term);
        else doCreateFam(en.term, 'depense');
      }
      function doCreateSous(fam, term) {
        const r = ensureSous(fam, term);
        classify(g, fam, r.sous, r.acts);
      }
      function doCreateFam(term, type) {
        const r = ensureFamille(term, type);
        classify(g, r.fam, '', r.acts);
      }

      input.addEventListener('focus', () => { build(input.value); open(); });
      input.addEventListener('input', () => { build(input.value); open(); });
      input.addEventListener('keydown', ev => {
        if (ev.key === 'ArrowDown') { ev.preventDefault(); if (menu.hidden) { build(input.value); open(); } else if (entries.length) { hi = (hi + 1) % entries.length; paintHi(); } }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (entries.length) { hi = (hi - 1 + entries.length) % entries.length; paintHi(); } }
        else if (ev.key === 'Enter') { ev.preventDefault(); if (menu.hidden) { build(input.value); open(); } else if (entries[hi]) activate(entries[hi]); }
        else if (ev.key === 'Escape') { close(); }
      });

      return cb;
    }
  }

  // Template -> Element (reprend ctx.el du shell si dispo, sinon fallback local).
  function el(ctx, html) {
    if (ctx && typeof ctx.el === 'function') return ctx.el(html);
    const t = document.createElement('template');
    t.innerHTML = (html || '').trim();
    return t.content.firstElementChild;
  }

  /* ===================================================================== */
  BUDGET.register('classement', {
    title: 'Classement',
    access: 'full',
    mount(root, ctx) {
      _ctx = ctx; _root = root;
      if (ctx.demo) {
        root.innerHTML = '<div class="wrap"><div class="msg"><b>Classement — apercu.</b><br>' +
          'Ouvre ce widget dans un document Grist (acces complet) : il regroupe les operations ' +
          'non categorisees par marchand et propose une recherche intelligente Famille › Sous-categorie ' +
          'avec creation a la volee.</div></div>';
        return;
      }
      injectCss();
      if (!_bound) {
        ctx.store.onChange(render);
        _bound = true;
        if (!window.__clsDocBound) {
          window.__clsDocBound = true;
          document.addEventListener('mousedown', e => {
            const inside = e.target && e.target.closest && e.target.closest('.cls-cb');
            if (_closeOpen && !inside) _closeOpen();
          });
        }
      }
      render();
    }
  });
})();
