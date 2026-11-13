import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../src/app.mjs';
import { LEVELS } from '../src/levels.mjs';
import { solve } from '../src/solver.mjs';
import { SAVE_KEY, importSave } from '../src/persistence.mjs';
import { fixture } from './dom-fixture.mjs';

test('application boot and all tables via DOM fixture pointer mapping; NOT browser acceptance', async () => {
  for (const [width, height, type] of [[1280,720,'mouse'],[1920,1080,'mouse'],[360,800,'touch'],[390,844,'touch']]) {
    const f = fixture({ width, height });
    try {
      const runtime = await boot(f.doc, f.win); assert.ok(runtime); assert.equal(f.get('#loading').hidden, true);
      for (const level of LEVELS) {
        await f.click('level', { level: level.id }); if (runtime.controller.mode === 'pause') await f.click('resume');
        for (const id of solve(level).solution) {
          const b = runtime.controller.state.balls.find(b => b.id === id), p = runtime.view.geometry.center(b.x, b.y);
          f.get('#board').dispatch('pointerdown', { clientX: p.x, clientY: p.y, button: 0, pointerType: type, isTrusted: false }); await f.flush();
        }
        assert.equal(runtime.controller.state.status, 'won', `${width} ${level.id}`); assert.equal(runtime.controller.mode, 'result');
        assert.equal(runtime.controller.save.progress[level.id].stars, 3);
        const imported = importSave(f.data.get(SAVE_KEY), LEVELS); assert.deepEqual(imported.current.state, runtime.controller.state);
        await f.click('undo'); assert.equal(runtime.controller.state.status, 'playing'); await f.click('restart'); assert.equal(runtime.controller.state.moves, 0);
      }
      await f.click('settings'); await f.click('muted'); await f.click('reducedMotion'); assert.equal(runtime.controller.save.settings.muted, true);
      await f.click('export'); await f.click('csv'); await f.click('diagnostic'); assert.equal(f.downloads.length, 3);
      await f.click('reset'); await f.click('cancel'); assert.ok(Object.keys(runtime.controller.save.progress).length);
      await f.click('reset'); await f.click('confirm-reset'); assert.deepEqual(runtime.controller.save.progress, {});
      assert.equal(f.get('#notice').textContent.includes('保存失败'), false);
    } finally { f.cleanup(); }
  }
});
test('application hints, result replay timing, hidden pause and reload stable checkpoint', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: LEVELS[2].id }); await f.click('resume');
    f.advance(1000); await f.click('hint'); assert.match(f.get('#dialog').innerHTML, /1 \/ 3/);
    await f.click('more-hint'); assert.match(f.get('#dialog').innerHTML, /下一击/);
    await f.click('more-hint'); assert.match(f.get('#dialog').innerHTML, /当前解法/);
    await f.click('resume'); await f.click('strike');
    const checkpoint = structuredClone(r.controller.state); f.doc.hidden = true; f.doc.dispatch('visibilitychange'); assert.equal(r.controller.mode, 'pause');
    f.advance(1000); f.doc.hidden = false; f.doc.dispatch('visibilitychange'); assert.equal(r.controller.mode, 'pause');
    await f.click('resume'); assert.deepEqual(r.controller.state, checkpoint);
    for (const id of solve(r.controller.level, r.controller.state).solution) { await f.click('strike'); }
    assert.equal(r.controller.state.status, 'won');
    await f.click('restart'); f.advance(1000);
    for (const id of solve(r.controller.level).solution) { r.controller.save.current.hintTier = 0; const b = r.controller.state.balls.find(b => b.id === id), p = r.view.geometry.center(b.x, b.y); f.get('#board').dispatch('pointerdown', { clientX: p.x, clientY: p.y, pointerType: 'touch', button: 0 }); await f.flush(); }
    const active = r.clock.stats.automated.activeMs; f.advance(1000); assert.equal(r.clock.stats.automated.activeMs, active);
    assert.equal(r.clock.stats.automated.levels['03'].completions, 2);
  } finally { f.cleanup(); }
});