import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, statsCSV, screenMarkup } from '../src/app.mjs';
import { fixture } from './dom-fixture.mjs';
import { createSave, importSave, exportSave, SAVE_KEY } from '../src/persistence.mjs';
import { LEVELS } from '../src/levels.mjs';
import { animationFrame, renderCanvas } from '../src/view.mjs';
import { PlayClock } from '../src/timing.mjs';
import { initialState } from '../src/engine.mjs';

test('restart after a limit failure counts exactly one new attempt', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: '03' }); await f.click('resume');
    // Repeatedly click blue; it bounces vertically and cannot enter its east bag.
    for (let i = 0; i < LEVELS[2].limit; i++) {
      const b = r.controller.state.balls.find(b => b.id === 'b'), p = r.view.geometry.center(b.x, b.y);
      f.get('#board').dispatch('pointerdown', { clientX: p.x, clientY: p.y, pointerType: 'touch', button: 0 }); await f.flush();
    }
    assert.equal(r.controller.state.status, 'lost');
    await f.click('restart');
    const row = r.clock.stats.automated.levels['03'];
    assert.equal(row.attempts, 2); assert.equal(row.restarts, 1); assert.equal(row.failures, 1);
  } finally { f.cleanup(); }
});

test('result waiting uses result ledger and animation never increases effective play', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: '01' }); await f.click('resume');
    f.advance(1000); await f.click('strike');
    const active = r.clock.stats.automated.activeMs, animation = r.clock.stats.automated.animationMs;
    assert.equal(active, 1000); assert.ok(animation > 0);
    const result = r.clock.stats.automated.resultMs; f.advance(2000);
    assert.equal(r.clock.stats.automated.resultMs, result + 2000);
    assert.equal(r.clock.stats.automated.activeMs, active);
    assert.match(f.get('#clock-line').textContent, /00:01/);
  } finally { f.cleanup(); }
});

test('pre-animation-ledger candidates migrate additively, unknown fields still reject', () => {
  const save = createSave(); delete save.stats.animationMs; delete save.stats.automated.animationMs;
  const next = importSave(JSON.stringify(save), LEVELS);
  assert.equal(next.stats.animationMs, 0); assert.equal(next.stats.automated.animationMs, 0);
  save.stats.unknown = 0; assert.throws(() => importSave(JSON.stringify(save), LEVELS));
});

test('CSV preserves attempt, tier counters and complete automated category ledger', () => {
  const s = createSave().stats;
  const fields = ['attemptMs', 'firstHintTiers', 'hintTiers', 'cleared', 'attemptOpen'];
  const csv = statsCSV(s);
  for (const field of fields) assert.ok(csv.includes(field), field);
  assert.match(csv, /automatedCategory,ms/);
  assert.match(csv, /animationMs,0/);
});

// A canvas context that records the letter labels drawn by view.renderCanvas.
function recordingCanvas() {
  const labels = [], base = {};
  const ctx = new Proxy(base, {
    get(t, k) { if (k === 'fillText') return text => labels.push(text); if (k === 'strokeText') return () => {}; return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; }
  });
  return { labels, canvas: { style: {}, getContext: () => ctx } };
}
const fakeAssets = new Proxy({}, { get: () => ({ width: 100, height: 100 }) });
const symbolModel = symbols => ({ level: LEVELS[0], state: initialState(LEVELS[0]), selected: null, settings: { symbols } });

test('reduced motion collapses the animation immediately and letters are a real render toggle', () => {
  const before = { balls: [{ id: 'a', x: 0, y: 0, dir: 'E', color: 'red' }] };
  const events = [{ type: 'move', id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, dir: 'E' }];
  const full = animationFrame(before, events, 0, 100, false);
  assert.equal(full.done, false); assert.equal(full.balls[0].ghosts.length, 2);
  const reduced = animationFrame(before, events, 0, 100, true);
  assert.equal(reduced.done, true); assert.deepEqual(reduced.balls[0].ghosts, []); assert.equal(reduced.balls[0].x, 1);
  const on = recordingCanvas(); renderCanvas(on.canvas, fakeAssets, symbolModel(true), { width: 300, height: 300, dpr: 1 });
  const off = recordingCanvas(); renderCanvas(off.canvas, fakeAssets, symbolModel(false), { width: 300, height: 300, dpr: 1 });
  assert.ok(on.labels.includes('A')); assert.equal(off.labels.length, 0);
});

test('game and content versions are located in the UI; CSV reconciles with the ledger; import/export is a fixed point', () => {
  const s = createSave();
  const markup = screenMarkup('settings', { save: s, levels: LEVELS, chapters: [], level: null, state: null, gameVersion: 'GAME-X', contentVersion: 'CONTENT-Y' });
  assert.match(markup, /GAME-X/); assert.match(markup, /CONTENT-Y/);
  let t = 0; const c = new PlayClock({ now: () => t });
  c.setContext({ mode: 'play', levelId: '01' }); t = 1500; c.tick();
  const stats = c.snapshot();
  assert.equal(stats.activeMs, 1500);
  const csv = statsCSV(stats), human = csv.split('automatedCategory')[0];
  const val = key => Number(human.match(new RegExp(`^${key},([0-9.]+)$`, 'm'))[1]);
  assert.equal(val('activeMs'), 1500);
  assert.equal(val('activeMs'), val('firstMainMs') + val('replayMs')); // CSV totals reconcile with the counter invariant
  assert.ok(csv.includes('local,desktop,false')); // session provenance is exported with the totals
  assert.deepEqual(importSave(exportSave(s), LEVELS), s); // strict import/export is an exact fixed point
});

test('experience toggles persist and take effect on the live document', async () => {
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win);
    await f.click('settings'); await f.click('reducedMotion'); await f.click('symbols'); await f.click('muted');
    assert.equal(r.controller.save.settings.reducedMotion, true);
    assert.equal(f.get('html').dataset.reduced, 'true'); // reduced motion reaches the rendered document
    assert.equal(r.controller.save.settings.symbols, false);
    assert.equal(r.controller.save.settings.muted, true); // audio muting is bound to persistence
    const imported = importSave(f.data.get(SAVE_KEY), LEVELS);
    assert.deepEqual(imported.settings, { muted: true, reducedMotion: true, symbols: false, layout: 'auto' });
  } finally { f.cleanup(); }
});
