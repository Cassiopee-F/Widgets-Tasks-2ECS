/** Lit un booléen Grist (Bool peut arriver en 0/1 ou chaîne True/False). */
export function parseGristBool(value, defaultValue = true) {
  if (value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'false' || s === 'f' || s === 'no' || s === '0') return false;
    if (s === 'true' || s === 't' || s === 'yes' || s === '1') return true;
  }
  if (value == null) return defaultValue;
  return defaultValue;
}
