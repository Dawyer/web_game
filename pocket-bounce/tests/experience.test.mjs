import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../src/app.mjs';
import { fixture } from './dom-fixture.mjs';
import { createSave, importSave } from '../src/persistence.mjs';
import { LEVELS } from '../src/levels.mjs';
import { PlayClock } from '../src/timing.mjs';

test('idle pause keeps subsequent time in idle, not ordinary pause; explicit resume restores play', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: '03' }); await f.click('resume');
    for (let i = 0; i < 301; i++) f.advance(1000);
    assert.equal(r.controller.mode, 'pause');
    const before = r.clock.stats.automated.idleMs;
    f.advance(1000);
    assert.equal(r.clock.stats.automated.idleMs, before + 1000);
    await f.click('resume'); f.advance(1000);
    assert.equal(r.controller.mode, 'play');
  } finally { f.cleanup(); }
});

test('opening the same unfinished table again begins a new attempt without losing first-main total', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: '03' }); await f.click('resume');
    f.advance(2000); await f.click('levels'); await f.click('level', { level: '03' }); await f.click('resume');
    assert.equal(r.clock.stats.automated.levels['03'].attempts, 2);
    assert.equal(r.clock.stats.automated.levels['03'].attemptMs, 0);
    assert.equal(r.clock.stats.automated.levels['03'].firstMainMs, 2000);
  } finally { f.cleanup(); }
});

test('legacy migration rejects mismatched nested/session versions instead of laundering them', () => {
  for (const corrupt of [s => s.stats.contentVersion = 'future', s => s.stats.sessions.push({ id: 'old', device: 'desktop', automated: false, gameVersion: 'future', contentVersion: 'future' })]) {
    const s = createSave(); s.gameVersion = s.stats.gameVersion = '0.1.0-candidate.1'; s.contentVersion = s.stats.contentVersion = '2026.11.12.1';
    corrupt(s); assert.throws(() => importSave(JSON.stringify(s), LEVELS));
  }
});

test('animation intervals are separately accounted, not first-main active time', () => {
  let time = 0; const c = new PlayClock({ now: () => time });
  c.setContext({ mode: 'play', levelId: '03' }); time = 1000; c.setContext({ mode: 'animation' });
  time = 1500; c.setContext({ mode: 'play' }); time = 2500; c.tick();
  assert.equal(c.stats.activeMs, 2000); assert.equal(c.stats.animationMs, 500);
});

test('a dialog blocks board pointer input even when underlying controller mode is play', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: '03' }); await f.click('resume');
    await f.click('reset');
    const b = r.controller.state.balls[0], p = r.view.geometry.center(b.x, b.y);
    f.get('#board').dispatch('pointerdown', { clientX: p.x, clientY: p.y, button: 0, pointerType: 'touch' }); await f.flush();
    assert.equal(r.controller.state.moves, 0);
  } finally { f.cleanup(); }
});
