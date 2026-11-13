import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayClock } from '../src/timing.mjs';
let api;
try { api = await import('../src/persistence.mjs'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const levels = [{ id: 'L01', version: '1', w: 3, h: 2, limit: 12, balls: [{ id: 'a', x: 0, y: 0, dir: 'E', color: 'red' }], obstacles: [], mirrors: [], pockets: [] }];
function memory(entries = {}) {
  const data = new Map(Object.entries(entries));
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
function state(moves = 0) { return { balls: structuredClone(levels[0].balls), moves, status: 'playing' }; }
function current() { return { levelId: 'L01', state: state(), history: [], actions: [], hintTier: 0 }; }

test('stable current board and complete undo history reject inconsistent IDs and states', () => {
  const good = api.createSave(); good.current = current();
  assert.deepEqual(api.importSave(api.exportSave(good), levels), good);
  good.current.history = [state()]; good.current.actions = ['a']; good.current.state = state(1);
  assert.doesNotThrow(() => api.validateSave(good, levels));
  const mutations = [s => { s.current.levelId = 'missing'; }, s => { s.current.extra = 1; },
    s => { s.current.state.balls[0].id = 'unknown'; }, s => { s.current.state.balls[0].color = 'blue'; },
    s => { s.current.state.balls[0].x = 3; }, s => { s.current.state.balls[0].x = 0.5; },
    s => { s.current.state.balls[0].dir = 'NE'; }, s => { s.current.state.balls.push(s.current.state.balls[0]); },
    s => { s.current.state.status = 'won'; }, s => { s.current.state.status = 'lost'; },
    s => { s.current.state.moves = -1; }, s => { s.current.state.moves = 13; },
    s => { s.current.history[0].balls[0].color = 'blue'; }, s => { s.current.history[0].moves = 1; },
    s => { s.current.history[0].balls[0].x = 1; }, s => { s.current.actions = ['absent']; },
    s => { s.current.actions = []; }, s => { s.current.history = []; },
    s => { s.current.hintTier = 4; }, s => { s.current.state.extra = 'bad'; },
    s => { s.current.state.balls[0].extra = 'bad'; }, s => { s.current.history = Array(513).fill(state()); }];
  for (const change of mutations) {
    const s = structuredClone(good); change(s);
    assert.throws(() => api.validateSave(s, levels), undefined, change.toString());
  }
  const wallLevel = structuredClone(levels); wallLevel[0].obstacles = [{ x: 1, y: 0 }];
  const wallSave = structuredClone(good); wallSave.current.state.balls[0].x = 1;
  assert.throws(() => api.validateSave(wallSave, wallLevel), /obstacle/);
  const won = structuredClone(good); won.current.state.balls = []; won.current.state.status = 'won';
  assert.doesNotThrow(() => api.validateSave(won, levels));
  const lost = structuredClone(good); lost.current.state.moves = 12;
  lost.current.state.status = 'lost'; lost.current.actions = Array(12).fill('a');
  lost.current.history = Array.from({ length: 12 }, (_, i) => state(i));
  assert.doesNotThrow(() => api.validateSave(lost, levels));
});

test('storage roundtrip verifies writes and surfaces access quota and verification errors', () => {
  const storage = memory();
  const s = api.createSave(); s.current = current();
  assert.deepEqual(api.loadSave(storage, levels), { save: api.createSave(), warnings: [] });
  assert.deepEqual(api.persistSave(storage, s), { ok: true });
  assert.deepEqual(api.loadSave(storage, levels), { save: s, warnings: [] });
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.match(api.loadSave(denied, levels).warnings.join(' '), /denied/);
  assert.equal(api.persistSave(denied, s).ok, false);
  const quota = { getItem: storage.getItem, setItem() { throw new Error('quota'); } };
  assert.match(api.persistSave(quota, s).error, /quota/);
  assert.equal(storage.getItem(api.SAVE_KEY), api.exportSave(s));
  const noWrite = { getItem: () => null, setItem() {} };
  assert.match(api.persistSave(noWrite, s).error, /verification/i);
  s.settings.muted = NaN;
  assert.equal(api.persistSave(storage, s).ok, false);
});

test('corrupt and incompatible saves remain recoverable and cannot be overwritten without backup', () => {
  for (const raw of ['{broken', JSON.stringify({ schema: 99 }), JSON.stringify({ ...api.createSave(), contentVersion: 'future' })]) {
    const storage = memory({ [api.SAVE_KEY]: raw });
    const result = api.loadSave(storage, levels);
    assert.equal(result.backup, raw);
    assert.ok(result.warnings.length);
    assert.equal(storage.getItem(api.SAVE_KEY), raw, 'load must not erase bad data');
    assert.equal(api.persistSave(storage, api.createSave()).ok, true);
    assert.equal(storage.getItem(`${api.SAVE_KEY}.backup`), raw);
    assert.deepEqual(api.loadSave(storage, levels).save, api.createSave());
  }
  const storage = memory({ [api.SAVE_KEY]: '{corrupt', [`${api.SAVE_KEY}.backup`]: 'precious older backup' });
  assert.equal(api.persistSave(storage, api.createSave()).ok, true);
  assert.equal(storage.getItem(`${api.SAVE_KEY}.backup`), 'precious older backup');
  assert.equal(storage.getItem(`${api.SAVE_KEY}.backup.1`), '{corrupt');
  const denied = memory({ [api.SAVE_KEY]: '{corrupt' });
  const limited = { getItem: denied.getItem, setItem(key, text) {
    if (key !== api.SAVE_KEY) throw new Error('backup quota');
    denied.setItem(key, text);
  } };
  const failure = api.persistSave(limited, api.createSave());
  assert.equal(failure.ok, false);
  assert.match(failure.error, /backup quota/);
  assert.equal(denied.getItem(api.SAVE_KEY), '{corrupt');
});

test('schema, version, settings and progress enforce strict bounded allowlists', () => {
  const valid = api.createSave();
  valid.progress.L01 = { stars: 3, bestMoves: 4 };
  assert.doesNotThrow(() => api.validateSave(valid, levels));
  const cases = [s => { s.schema = 3; }, s => { s.gameVersion = 'old'; }, s => { s.contentVersion = 'old'; },
    s => { s.unknown = 1; }, s => { s.settings.muted = 'false'; }, s => { s.settings.layout = 'invalid'; },
    s => { s.settings.__proto__ = { polluted: true }; }, s => { s.settings.extra = 1; },
    s => { s.progress.noSuchLevel = { stars: 1, bestMoves: 1 }; }, s => { s.progress.L01.stars = 4; },
    s => { s.progress.L01.bestMoves = -1; }, s => { s.progress.L01.extra = true; },
    s => { s.stats.activeMs = Infinity; }, s => { s.stats.automated.hiddenMs = NaN; }];
  for (const change of cases) {
    const s = structuredClone(valid); change(s);
    assert.throws(() => api.validateSave(s, levels), undefined, change.toString());
  }
  assert.throws(() => api.importSave('{"__proto__":{"polluted":true}}', levels));
  assert.throws(() => api.importSave('x'.repeat(2_000_001), levels), /size/);
  assert.throws(() => api.importSave('null', levels));
  assert.equal({}.polluted, undefined);
});

test('fresh schema-two save exports and imports detached without losing initialized stats', () => {
  assert.equal(typeof api?.createSave, 'function', 'persistence API must exist');
  const s = api.createSave();
  assert.equal(api.GAME_VERSION, '0.1.0-candidate.1');
  assert.equal(api.CONTENT_VERSION, '2026.11.12.1');
  assert.equal(api.SAVE_KEY, 'pocket-bounce.save');
  assert.equal(s.schema, 2);
  assert.equal(s.gameVersion, api.GAME_VERSION);
  assert.equal(s.contentVersion, api.CONTENT_VERSION);
  assert.equal(s.current, null);
  assert.deepEqual(s.progress, {});
  assert.deepEqual(s.settings, { muted: false, reducedMotion: false, symbols: true, layout: 'auto' });
  assert.equal(s.stats.activeMs, 0);
  assert.deepEqual(api.validateSave(s, levels), s);
  const restored = api.importSave(api.exportSave(s), levels);
  assert.deepEqual(restored, s);
  restored.settings.muted = true;
  assert.equal(s.settings.muted, false);
});
