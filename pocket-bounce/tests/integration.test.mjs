import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/engine.mjs';
import { LEVELS } from '../src/levels.mjs';
import { solve } from '../src/solver.mjs';
import { GameController } from '../src/controller.mjs';
import { createSave, persistSave, loadSave, exportSave, importSave } from '../src/persistence.mjs';
import { PlayClock } from '../src/timing.mjs';
test('real engine → controller → save → reload → undo → retry → complete', async () => {
  let time = 0; const clock = new PlayClock({ now: () => time, automated: true });
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const save = createSave();
  const c = new GameController({ levels: LEVELS, engine, solve, save, onSave(s) { s.stats = clock.snapshot(); assert.equal(persistSave(storage, s).ok, true); } });
  for (const level of LEVELS) {
    c.open(level.id); clock.setContext({ mode: 'play', levelId: level.id }); time += 1000;
    for (const id of solve(level).solution) {
      const r = c.strike(id); assert.equal(r.accepted, true); assert.equal(c.strike(id).accepted, false);
      const restored = loadSave(storage, LEVELS); assert.deepEqual(restored.warnings, []); assert.deepEqual(restored.save.current.state, c.state);
      c.finishAnimation(r.token);
    }
    assert.equal(c.state.status, 'won'); assert.equal(save.progress[level.id].stars, 3);
    assert.equal(c.undo(), true); c.restart(); assert.deepEqual(c.state, engine.initialState(level));
  }
  assert.deepEqual(importSave(exportSave(save), LEVELS), save);
});