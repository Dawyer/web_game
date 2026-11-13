import test from 'node:test';
import assert from 'node:assert/strict';
import { createSave, loadSave, persistSave, SAVE_KEY, importSave } from '../src/persistence.mjs';
import { LEVELS } from '../src/levels.mjs';
import { initialState, strike } from '../src/engine.mjs';
test('known inherited schema-two version migrates with exact old backup and stable checkpoint', () => {
  const old = createSave();
  old.gameVersion = old.stats.gameVersion = '0.1.0-candidate.1'; old.contentVersion = old.stats.contentVersion = '2026.11.12.1';
  old.current = { levelId: '01', state: initialState(LEVELS[0]), history: [], actions: [], hintTier: 0 };
  const raw = JSON.stringify(old), data = new Map([[SAVE_KEY, raw]]), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const loaded = loadSave(storage, LEVELS); assert.match(loaded.warnings.join(''), /迁移/); assert.deepEqual(loaded.save.current, old.current);
  assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(persistSave(storage, loaded.save).ok, true); assert.equal(storage.getItem(SAVE_KEY + '.backup'), raw);
  assert.deepEqual(loadSave(storage, LEVELS).warnings, []);
});
test('import replays each atomic transition, rejects fabricated legal-looking checkpoints', () => {
  const level = LEVELS[2], before = initialState(level), after = strike(level, before, 'a').state;
  const s = createSave(); s.current = { levelId: level.id, state: after, history: [before], actions: ['a'], hintTier: 0 };
  assert.doesNotThrow(() => importSave(JSON.stringify(s), LEVELS));
  s.current.state.balls[0].dir = 'N'; assert.throws(() => importSave(JSON.stringify(s), LEVELS), /transition/);
});