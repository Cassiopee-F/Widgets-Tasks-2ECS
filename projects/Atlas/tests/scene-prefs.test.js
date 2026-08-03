/**
 * Tests scene-prefs Atlas.
 * node --test "projects/Atlas/tests/scene-prefs.test.js"
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { viewerControlsFromPrefsRow, prefsPayloadFromViewerControls } from '../lib/scene-prefs.js';
import { createDefaultViewerControls, setViewerExposed } from '../lib/viewer-controls.js';

describe('scene-prefs payload', () => {
  it('round-trip ViewerJSON', () => {
    const list = createDefaultViewerControls();
    setViewerExposed(list, 'sun', true);
    const payload = prefsPayloadFromViewerControls(list);
    assert.equal(typeof payload.ViewerJSON, 'string');
    const back = viewerControlsFromPrefsRow({ ViewerJSON: [payload.ViewerJSON] }, 0);
    assert.equal(back.find((c) => c.id === 'sun').exposed, true);
  });
});
