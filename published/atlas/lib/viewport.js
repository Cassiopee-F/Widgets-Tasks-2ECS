/**
 * Centrage initial carte Atlas — session caméra par projet.
 */

export function cameraStorageKey(projectName, docMode = 'standalone') {
  const scope = String(projectName || docMode || 'standalone')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
  return `atlas_v7_camera_${scope}`;
}

/** Caméra session proche de l'emprise données (sinon considérée stale / défaut Toulouse). */
export function savedCameraNearBounds(bounds, storageKey, storage = sessionStorage) {
  if (!bounds || !storageKey) return false;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return false;
    const cam = JSON.parse(raw);
    if (typeof cam.lng !== 'number' || typeof cam.lat !== 'number') return false;
    const cx = (bounds[0][0] + bounds[1][0]) / 2;
    const cy = (bounds[0][1] + bounds[1][1]) / 2;
    const span = Math.max(
      Math.abs(bounds[1][0] - bounds[0][0]),
      Math.abs(bounds[1][1] - bounds[0][1]),
      0.01,
    );
    const tol = Math.max(span * 3, 0.05);
    return Math.abs(cam.lng - cx) <= tol && Math.abs(cam.lat - cy) <= tol;
  } catch (_) {
    return false;
  }
}

/**
 * fitBounds au premier chargement sauf si l'utilisateur a déjà navigué près des données.
 * Les prefs couche (Atlas_LayerPrefs) ne bloquent pas le centrage.
 */
export function shouldAutoFitInitialBounds(bounds, storageKey, storage = sessionStorage) {
  if (!bounds) return false;
  return !savedCameraNearBounds(bounds, storageKey, storage);
}
