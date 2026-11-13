import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../src/app.mjs';
import { fixture } from './dom-fixture.mjs';
import { LEVELS } from '../src/levels.mjs';
import { createSave, SAVE_KEY, importSave } from '../src/persistence.mjs';
import { initialState } from '../src/engine.mjs';

test('returning hidden tab reads latest checkpoint before it can overwrite peer progress', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win);
    await f.click('level', { level: '01' }); await f.click('resume');
    f.doc.hidden = true; f.doc.dispatch('visibilitychange');
    const peer = createSave(); peer.progress['01'] = { stars: 3, bestMoves: 1, completed: true };
    peer.current = { levelId: '03', state: initialState(LEVELS[2]), actions: [], history: [], hintTier: 0 };
    f.data.set(SAVE_KEY, JSON.stringify(peer));
    f.doc.hidden = false; f.doc.dispatch('visibilitychange'); await f.flush();
    assert.equal(r.controller.level.id, '03'); assert.equal(r.controller.mode, 'pause');
    await f.click('resume');
    assert.equal(importSave(f.data.get(SAVE_KEY), LEVELS).progress['01'].stars, 3);
  } finally { f.cleanup(); }
});

test('hint request cancelled by menu during paint delay cannot open a stale modal', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: '03' }); await f.click('resume');
    const pending = f.click('hint'); await f.click('levels'); await pending;
    assert.equal(r.controller.mode, 'menu'); assert.equal(f.get('#overlay').hidden, true);
  } finally { f.cleanup(); }
});

test('sound unlock, mute persistence and undo are connected to local licensed files', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win);
    f.doc.dispatch('click', { target: { dataset: { action: 'level', level: '03' }, closest() { return this; } }, isTrusted: true }); await f.flush();
    await f.click('resume'); await f.click('strike'); await f.click('undo');
    assert.ok(f.audio.some(a => a.src === './audio/undo.mp3'));
    assert.ok(f.audio.some(a => a.src === './audio/bounce.mp3'));
    await f.click('settings'); await f.click('muted');
    assert.ok(f.audio.every(a => a.paused));
    assert.equal(importSave(f.data.get(SAVE_KEY), LEVELS).settings.muted, true);
    assert.equal(r.controller.state.moves, 0);
  } finally { f.cleanup(); }
});
