/*
 * ensure-schema.js — Dual du bind : FormDef complet → plan d'actions schéma Grist.
 *
 * Si le binding est complet (colId + type (+ refTable / choices si besoin)), on peut
 * matérialiser la table et/ou les colonnes manquantes. Jamais d'overwrite de type
 * incompatible.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.EnsureSchema = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeGristType(t) {
    if (!t) return 'Text';
    if (t.startsWith('RefList:')) return 'RefList';
    if (t.startsWith('Ref:')) return 'Ref';
    return t;
  }

  function resolveRefTable(field) {
    if (!field) return '';
    if (field.refTable) return field.refTable;
    if (field.options && field.options.refTable) return field.options.refTable;
    return '';
  }

  function fieldToGristType(field) {
    var t = field.type || 'Text';
    var ref = resolveRefTable(field);
    if (t === 'Ref' && ref) return 'Ref:' + ref;
    if (t === 'RefList' && ref) return 'RefList:' + ref;
    return t;
  }

  function typesCompatible(existingType, expectedType) {
    if (normalizeGristType(existingType) !== normalizeGristType(expectedType)) return false;
    if (normalizeGristType(existingType) === 'Ref' || normalizeGristType(existingType) === 'RefList') {
      return existingType === expectedType;
    }
    return true;
  }

  function collectFields(formDef) {
    var fields = [];
    var seen = {};
    (formDef.sections || []).forEach(function (section) {
      (section.fields || []).forEach(function (field) {
        if (!field.colId || seen[field.colId]) return;
        seen[field.colId] = true;
        fields.push(field);
      });
    });
    return fields;
  }

  function choiceListFor(formDef, field) {
    var key = field.colId;
    if (formDef.choices && Array.isArray(formDef.choices[key]) && formDef.choices[key].length) {
      return formDef.choices[key];
    }
    if (field.options && Array.isArray(field.options.choices) && field.options.choices.length) {
      return field.options.choices;
    }
    return null;
  }

  function buildColumnDef(formDef, field) {
    var def = {
      id: field.colId,
      type: fieldToGristType(field)
    };
    if (field.label) def.label = field.label;
    var t = normalizeGristType(field.type);
    if (t === 'Choice' || t === 'ChoiceList') {
      var choices = choiceListFor(formDef, field);
      if (choices) {
        def.widgetOptions = JSON.stringify({ choices: choices });
      }
    }
    if ((t === 'Ref' || t === 'RefList') && field.options && field.options.visibleCol) {
      // Intention runtime (choicesFromRefRecords) ; la méta Grist est posée ensuite
      // via planVisibleColUpdates (id de colonne dans la table référencée).
      var wo = {};
      try {
        if (def.widgetOptions) wo = JSON.parse(def.widgetOptions);
      } catch (e) { wo = {}; }
      wo.widget = t === 'RefList' ? 'ReferenceList' : 'Reference';
      wo.visibleCol = field.options.visibleCol;
      def.widgetOptions = JSON.stringify(wo);
    }
    return def;
  }

  /**
   * Projection pure FormDef → colonnes (inverse conceptuel du bind).
   * Exige un binding complet pour un résultat fiable.
   */
  function columnsFromFormDef(formDef) {
    return collectFields(formDef).map(function (field) {
      return buildColumnDef(formDef, field);
    });
  }

  /**
   * Binding « complet » pour pouvoir driver le schéma depuis le formulaire.
   */
  function isValidGristIdent(id) {
    return typeof id === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(id) && id.length <= 60;
  }

  function bindingIsComplete(formDef) {
    var errors = [];
    if (!formDef || !formDef.tableId) {
      errors.push('tableId manquant');
    } else if (!isValidGristIdent(formDef.tableId)) {
      errors.push('identifiant invalide pour la table « ' + formDef.tableId +
        ' » (lettres, chiffres, _ ; commencer par une lettre)');
    }
    var fields = collectFields(formDef || {});
    if (!fields.length) {
      errors.push('Aucun champ avec colId');
    }
    fields.forEach(function (field) {
      if (!field.colId) {
        errors.push('Champ sans colId');
        return;
      }
      if (!isValidGristIdent(field.colId)) {
        errors.push('identifiant invalide pour la colonne « ' + field.colId + ' »');
        return;
      }
      if (!field.type) {
        errors.push('Champ « ' + field.colId + ' » : type manquant');
        return;
      }
      var t = normalizeGristType(field.type);
      if ((t === 'Ref' || t === 'RefList') && !resolveRefTable(field)) {
        errors.push('Champ « ' + field.colId + ' » : refTable manquant pour ' + t);
      }
      if ((t === 'Choice' || t === 'ChoiceList') && !choiceListFor(formDef, field)) {
        errors.push('Champ « ' + field.colId + ' » : choices manquants pour ' + t);
      }
    });
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @param {object} formDef
   * @param {Array<{id:string,type:string}>} existingColumns — vide si table absente
   * @param {{ tableExists?: boolean }} [opts] — défaut tableExists=true si existingColumns fourni
   */
  function planEnsureSchema(formDef, existingColumns, opts) {
    opts = opts || {};
    var tableExists = opts.tableExists;
    if (tableExists === undefined) {
      tableExists = true;
    }

    var bind = bindingIsComplete(formDef);
    if (!bind.ok) {
      return { ok: false, errors: bind.errors, actions: [] };
    }

    var errors = [];
    var actions = [];
    var tableId = formDef.tableId;
    var columns = columnsFromFormDef(formDef);

    if (!tableExists) {
      actions.push(['AddTable', tableId, columns]);
      return { ok: true, errors: [], actions: actions };
    }

    var existingById = {};
    (existingColumns || []).forEach(function (col) {
      existingById[col.id] = col.type;
    });

    columns.forEach(function (col) {
      var existingType = existingById[col.id];
      if (existingType === undefined) {
        var addDef = { type: col.type };
        if (col.label) addDef.label = col.label;
        if (col.widgetOptions) addDef.widgetOptions = col.widgetOptions;
        actions.push(['AddColumn', tableId, col.id, addDef]);
      } else if (!typesCompatible(existingType, col.type)) {
        errors.push(
          'Colonne « ' + col.id + ' » : type incompatible (existant: ' +
          existingType + ', attendu: ' + col.type + ')'
        );
      }
    });

    return { ok: errors.length === 0, errors: errors, actions: actions };
  }

  /**
   * Après AddTable/AddColumn : pose visibleCol méta Grist (id colonne affichée
   * dans la table référencée) à partir de field.options.visibleCol (nom colId).
   * @param {object} formDef
   * @param {Array<{id:number,tableId:string}>} tables
   * @param {Array<{id:number,parentId:number,colId:string,visibleCol?:number}>} columns
   */
  function planVisibleColUpdates(formDef, tables, columns) {
    var actions = [];
    if (!formDef || !formDef.tableId) return { ok: true, actions: actions };

    var tableRefById = {};
    (tables || []).forEach(function (t) {
      if (t && t.tableId != null) tableRefById[t.tableId] = t.id;
    });
    var colsByParent = {};
    (columns || []).forEach(function (c) {
      if (!c || c.parentId == null) return;
      if (!colsByParent[c.parentId]) colsByParent[c.parentId] = [];
      colsByParent[c.parentId].push(c);
    });

    var targetRef = tableRefById[formDef.tableId];
    if (targetRef == null) return { ok: true, actions: actions };

    collectFields(formDef).forEach(function (field) {
      var t = normalizeGristType(field.type);
      if (t !== 'Ref' && t !== 'RefList') return;
      var visName = field.options && field.options.visibleCol;
      if (!visName || typeof visName !== 'string') return;
      var refTable = resolveRefTable(field);
      var refTableRef = tableRefById[refTable];
      if (refTableRef == null) return;

      var displayCol = (colsByParent[refTableRef] || []).find(function (c) {
        return c.colId === visName;
      });
      var ourCol = (colsByParent[targetRef] || []).find(function (c) {
        return c.colId === field.colId;
      });
      if (!displayCol || !ourCol) return;
      if (ourCol.visibleCol === displayCol.id) return;

      actions.push([
        'UpdateRecord',
        '_grist_Tables_column',
        ourCol.id,
        { visibleCol: displayCol.id }
      ]);
    });

    return { ok: true, actions: actions };
  }

  return {
    planEnsureSchema: planEnsureSchema,
    columnsFromFormDef: columnsFromFormDef,
    bindingIsComplete: bindingIsComplete,
    fieldToGristType: fieldToGristType,
    normalizeGristType: normalizeGristType,
    planVisibleColUpdates: planVisibleColUpdates
  };
}));
