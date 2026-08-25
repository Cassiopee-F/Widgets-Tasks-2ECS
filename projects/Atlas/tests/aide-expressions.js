/**
 * Le sous-ensemble d'expressions MapLibre qu'Atlas produit — évalué ici.
 *
 * Écrit plutôt que de tirer MapLibre en dépendance de test : le dépôt n'en a
 * aucune, et l'enjeu n'est pas de réimplémenter le moteur mais de vérifier
 * qu'une entité tombe du bon côté. Les règles reproduites sont celles de la
 * spécification :
 *
 * - `coalesce` rend la première valeur **non nulle** ;
 * - `to-number` essaie chaque argument jusqu'à une conversion réussie, et
 *   convertit `null`/`false` en 0 — d'où le `coalesce` qui l'enveloppe partout
 *   dans le code, pour qu'une absence n'arrive jamais jusqu'à lui ;
 * - `case` rend la première sortie dont la condition est vraie ;
 * - `step` change de sortie à chaque seuil atteint, en `>=`.
 *
 * Un opérateur non couvert **lève** au lieu de rendre une valeur : un
 * évaluateur qui devine serait pire qu'aucun, puisqu'il validerait des
 * expressions qu'il ne comprend pas.
 */
export function evaluer(expr, props, lie = {}) {
  if (!Array.isArray(expr)) return expr;
  const [op, ...args] = expr;
  const ev = (e) => evaluer(e, props, lie);

  if (op === 'literal') return args[0];
  if (op === 'get') return props[args[0]] ?? null;
  if (op === 'var') return lie[args[0]];
  if (op === 'let') {
    const porte = { ...lie };
    for (let i = 0; i < args.length - 1; i += 2) porte[args[i]] = evaluer(args[i + 1], props, lie);
    return evaluer(args[args.length - 1], props, porte);
  }
  if (op === 'coalesce') {
    for (const a of args) { const v = ev(a); if (v !== null && v !== undefined) return v; }
    return null;
  }
  if (op === 'to-number') {
    for (const a of args) {
      const v = ev(a);
      if (v === null || v === undefined || v === false) return 0;
      if (v === true) return 1;
      const n = Number(v);
      if (Number.isFinite(n) && String(v).trim() !== '') return n;
    }
    throw new Error('to-number : aucune conversion possible');
  }
  if (op === 'to-string') { const v = ev(args[0]); return v == null ? '' : String(v); }
  if (op === 'downcase') return String(ev(args[0])).toLowerCase();
  if (op === 'in') {
    const aiguille = ev(args[0]);
    const botte = ev(args[1]);
    return Array.isArray(botte) ? botte.includes(aiguille) : String(botte).includes(String(aiguille));
  }
  if (op === 'all') return args.every((a) => !!ev(a));
  if (op === 'any') return args.some((a) => !!ev(a));
  if (op === '!') return !ev(args[0]);
  if (op === '==') return ev(args[0]) === ev(args[1]);
  if (op === '!=') return ev(args[0]) !== ev(args[1]);
  if (op === '<') return ev(args[0]) < ev(args[1]);
  if (op === '<=') return ev(args[0]) <= ev(args[1]);
  if (op === '>') return ev(args[0]) > ev(args[1]);
  if (op === '>=') return ev(args[0]) >= ev(args[1]);
  if (op === 'case') {
    for (let i = 0; i < args.length - 1; i += 2) if (ev(args[i])) return ev(args[i + 1]);
    return ev(args[args.length - 1]);
  }
  if (op === 'step') {
    const v = ev(args[0]);
    let sortie = args[1];
    for (let i = 2; i < args.length; i += 2) { if (v >= args[i]) sortie = args[i + 1]; else break; }
    return sortie;
  }
  if (op === 'match') {
    const v = ev(args[0]);
    for (let i = 1; i < args.length - 1; i += 2) {
      const cles = Array.isArray(args[i]) ? args[i] : [args[i]];
      if (cles.includes(v)) return args[i + 1];
    }
    return args[args.length - 1];
  }
  throw new Error(`opérateur non couvert par l’évaluateur de test : ${op}`);
}
