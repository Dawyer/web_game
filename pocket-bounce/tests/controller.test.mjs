import test from 'node:test';
import assert from 'node:assert/strict';

const moduleURL = new URL('../src/controller.mjs', import.meta.url);
const level = { id: '01', chapter: 1, title: '试击', intent: '观察路径', hints: ['先看袋口'], w: 3, h: 1, par: 1, limit: 9, balls: [{ id: 'a', color: 'red', x: 0, y: 0, dir: 'E' }] };
const engine = {
  initialState(l) { return { balls: structuredClone(l.balls), moves: 0, status: 'playing' }; },
  strike(l, state, id) {
    if (!state.balls.some(b => b.id === id) || state.status !== 'playing') return { accepted: false, state, events: [] };
    const next = structuredClone(state); next.moves++; next.balls[0].x = (next.balls[0].x + 1) % l.w;
    return { accepted: true, state: next, events: [{ type: 'move', id, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, dir: 'E', tick: 1 }] };
  }
};
async function make(options = {}) {
  const { GameController } = await import(moduleURL);
  const writes = [], events = [];
  const controller = new GameController({ levels: [level], engine, save: { schema: 2, progress: {}, current: null, settings: {}, stats: {} }, onSave: s => writes.push(structuredClone(s)), onEvent: (type, detail) => events.push({ type, detail }), ...options });
  return { controller, writes, events };
}

test('accepted strike persists the stable result before animation and locks rapid input', async () => {
  const { controller: c, writes } = await make();
  c.open('01');
  const before = structuredClone(c.state);
  const result = c.strike('a');
  assert.equal(result.accepted, true);
  assert.equal(c.state.moves, 1);
  assert.deepEqual(writes.at(-1).current.state, c.state);
  assert.deepEqual(writes.at(-1).current.history[0], before);
  assert.deepEqual(writes.at(-1).current.actions, ['a']);
  assert.equal(c.strike('a').accepted, false);
  assert.equal(c.state.moves, 1);
  c.finishAnimation(result.token);
  assert.equal(c.strike('a').accepted, true);
});

test('undo retains at least fifty atomic states and retry restores the initial board', async () => {
  const { controller: c, events } = await make(); c.open('01');
  for (let i = 0; i < 60; i++) { const r = c.strike('a'); c.finishAnimation(r.token); }
  assert.equal(c.state.moves, 60);
  for (let i = 0; i < 55; i++) assert.equal(c.undo(), true);
  assert.equal(c.state.moves, 5);
  assert.equal(c.save.current.actions.length, 5);
  c.restart();
  assert.deepEqual(c.state, engine.initialState(level));
  assert.equal(c.save.current.history.length, 0);
  assert.equal(events.filter(e => e.type === 'restart').length, 1);
});

test('pause and restored checkpoints require explicit resume and stale animations cannot unlock a new action', async () => {
  const { controller: c } = await make(); c.open('01');
  const r = c.strike('a'); c.pause();
  assert.equal(c.strike('a').accepted, false);
  c.resume();
  const next = c.strike('a');
  assert.equal(c.finishAnimation(r.token), false);
  assert.equal(c.locked, true); c.finishAnimation(next.token);
  const { controller: restored } = await make({ save: structuredClone(c.save) });
  assert.equal(restored.restore(), true);
  assert.equal(restored.mode, 'pause');
  assert.equal(restored.strike('a').accepted, false);
  restored.resume(); assert.equal(restored.state.moves, 2);
});

test('completion awards stars once even after result undo and replay', async () => {
  const winning = { ...engine, strike(l, s, id) { return { accepted: true, state: { balls: [], moves: s.moves + 1, status: 'won' }, events: [] }; } };
  const { controller: c, events, writes } = await make({ engine: winning }); c.open('01');
  const result = c.strike('a');
  assert.deepEqual(writes.at(-1).progress['01'], { bestMoves: 1, stars: 3, completed: true });
  assert.equal(events.filter(e => e.type === 'complete').length, 1);
  c.finishAnimation(result.token); c.finishAnimation(result.token);
  assert.equal(c.mode, 'result'); assert.equal(c.strike('a').accepted, false);
  c.undo(); c.finishAnimation(c.strike('a').token);
  assert.equal(events.filter(e => e.type === 'complete').length, 1);
  assert.equal(c.save.progress['01'].bestMoves, 1);
});

test('failure is reported once and invalid input never consumes a move', async () => {
  const losing = { ...engine, strike(l, s, id) { return { accepted: true, state: { ...s, moves: l.limit, status: 'lost' }, events: [] }; } };
  const { controller: c, events } = await make({ engine: losing }); c.open('01');
  const r = c.strike('a'); c.finishAnimation(r.token); c.finishAnimation(r.token);
  assert.equal(c.mode, 'result'); assert.equal(events.filter(e => e.type === 'failure').length, 1);
  c.restart();
  const { controller: normal } = await make(); normal.open('01');
  assert.equal(normal.strike('missing').accepted, false); assert.equal(normal.state.moves, 0);
});

test('hints reveal intent first then solve the current stable state with a bounded budget', async () => {
  const calls = [];
  const { controller: c, events } = await make({ solve(l, s, budget) { calls.push({ s: structuredClone(s), budget }); return { status: 'solved', solution: ['a', 'a'], visited: 3 }; } });
  c.open('01'); assert.equal((await c.hint()).tier, 1); assert.equal(calls.length, 0);
  c.finishAnimation(c.strike('a').token);
  const next = await c.hint(); assert.equal(next.tier, 2); assert.equal(next.id, 'a'); assert.equal(next.dir, 'E');
  assert.equal(calls[0].s.moves, 1); assert.ok(calls[0].budget.maxMs <= 100);
  const full = await c.hint(); assert.equal(full.tier, 3); assert.deepEqual(full.solution, ['a', 'a']);
  assert.equal(calls.length, 2); assert.equal(events.filter(e => e.type === 'hint').length, 3);
});

test('hint timeout and stale solver responses never pretend to prove a solution', async () => {
  const { controller: timed } = await make({ solve() { return { status: 'unverified', solution: [], visited: 100 }; } });
  timed.open('01'); await timed.hint(); const timeout = await timed.hint();
  assert.equal(timeout.status, 'unverified'); assert.match(timeout.text, /未验证|预算/);
  const { controller: impossible } = await make({ solve() { return { status: 'unsolvable', solution: [] }; } });
  impossible.open('01'); await impossible.hint(); assert.match((await impossible.hint()).text, /撤销|重开/);
  let resolve;
  const { controller: stale } = await make({ solve() { return new Promise(r => { resolve = r; }); } });
  stale.open('01'); await stale.hint(); const pending = stale.hint(); stale.restart(); resolve({ status: 'solved', solution: ['a'] });
  assert.equal((await pending).status, 'stale');
});

test('desktop and mobile mapping keep the same logical board and reject empty hits', async () => {
  const { layoutFor, boardGeometry, hitBall } = await import('../src/view.mjs');
  assert.equal(layoutFor({ width: 360 }), 'mobile'); assert.equal(layoutFor({ width: 1280 }), 'desktop');
  assert.equal(layoutFor({ width: 360, override: 'desktop' }), 'desktop');
  assert.equal(layoutFor({ width: 1280, override: 'mobile' }), 'mobile');
  const state = engine.initialState(level);
  for (const [w, h] of [[340, 370], [820, 600]]) {
    const geometry = boardGeometry(w, h, level);
    const p = geometry.center(0, 0);
    assert.equal(hitBall(p.x, p.y, geometry, state)?.id, 'a');
    assert.equal(hitBall(-1, -1, geometry, state), null);
    assert.ok(geometry.left >= 0 && geometry.top >= 0);
    assert.ok(geometry.right <= w && geometry.bottom <= h);
  }
});

test('event animation rolls in movement direction and scales a pocketed ball without mutating stable state', async () => {
  const { animationFrame } = await import('../src/view.mjs');
  const before = engine.initialState(level), copy = structuredClone(before);
  const events = [{ type: 'move', id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, dir: 'E', tick: 1 }, { type: 'pocket', id: 'a', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, dir: 'E', tick: 2 }];
  const moving = animationFrame(before, events, 50, 100, false).balls[0];
  assert.ok(moving.x > 0 && moving.x < 1); assert.ok(moving.rotation > 0); assert.ok(moving.ghosts.length > 0);
  const pocketing = animationFrame(before, events, 150, 100, false).balls[0];
  assert.ok(pocketing.scale < 1 && pocketing.scale > 0);
  const reduced = animationFrame(before, events, 5, 100, true);
  assert.equal(reduced.done, true); assert.equal(reduced.balls.length, 0); assert.deepEqual(before, copy);
});

test('canvas uses DPR and original art for every board object with letter accessibility codes', async () => {
  const { renderCanvas } = await import('../src/view.mjs');
  const images = [], texts = [], transforms = [];
  const ctx = new Proxy({ drawImage(image) { images.push(image.name); }, fillText(text) { texts.push(text); }, setTransform(...args) { transforms.push(args); }, measureText() { return { width: 20 }; } }, { get(target, key) { return target[key] ?? (() => {}); }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { style: {}, getContext: () => ctx };
  const names = ['felt','wood','ball_red','arrow','pocket','ring','mirror','block'];
  const assets = Object.fromEntries(names.map(name => [name, { name, width: 320, height: 320 }]));
  const board = { ...level, blocks: [{ x: 2, y: 0 }], mirrors: [{ x: 1, y: 0, kind: '/' }], exits: [{ edge: 'N', index: 0, color: 'red' }] };
  renderCanvas(canvas, assets, { level: board, state: engine.initialState(level), selected: 'a', settings: { symbols: true } }, { width: 360, height: 300, dpr: 2 });
  assert.equal(canvas.width, 720); assert.equal(canvas.height, 600);
  assert.deepEqual(transforms[0], [2, 0, 0, 2, 0, 0]);
  assert.ok(names.every(name => images.includes(name))); assert.ok(texts.includes('A'));
});

test('single-owner lease prevents two visible tabs from owning human time', async () => {
  const { OwnerLease } = await import('../src/controller.mjs');
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  let time = 0;
  const a = new OwnerLease({ storage, id: 'a', now: () => time });
  const b = new OwnerLease({ storage, id: 'b', now: () => time });
  assert.equal(a.claim(), true); assert.equal(b.claim(), false);
  time = 2000; assert.equal(a.renew(), true); assert.equal(b.owns(), false);
  a.release(); assert.equal(b.claim(), true); assert.equal(a.owns(), false);
  time += 20000; assert.equal(a.claim(), true); assert.equal(b.renew(), false);
});

test('Chinese product screens expose six chapters, settings, confirmation, outcomes and no fake win controls', async () => {
  const { screenMarkup, statsCSV } = await import('../src/app.mjs');
  const model = { levels: [level], chapters: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, title: `第${i + 1}章`, description: '观察与练习' })), save: { progress: {}, current: null, settings: { muted: false, reducedMotion: false, symbols: true, layout: 'auto' }, stats: { activeMs: 1000, firstMainMs: 1000, replayMs: 0, levels: { '01': { activeMs: 1000, attempts: 1, restarts: 0, undos: 0, hints: 0 } } } }, level, state: engine.initialState(level), gameVersion: '候选1', contentVersion: 'v1' };
  const menu = screenMarkup('levels', model);
  assert.equal((menu.match(/data-chapter=/g) ?? []).length, 6); assert.match(menu, /观察路径/);
  const settings = screenMarkup('settings', model);
  for (const action of ['muted', 'reducedMotion', 'symbols', 'desktop', 'mobile', 'export', 'import', 'csv', 'diagnostic', 'reset']) assert.ok(settings.includes(`data-action="${action}"`));
  const pause = screenMarkup('pause', model); assert.match(pause, /data-action="resume"/);
  const confirm = screenMarkup('reset', model); assert.match(confirm, /data-action="confirm-reset"/); assert.match(confirm, /data-action="cancel"/);
  const win = screenMarkup('result', { ...model, state: { balls: [], moves: 1, status: 'won' } }); assert.match(win, /star\.png/); assert.match(win, /data-action="next"/);
  const loss = screenMarkup('result', { ...model, state: { balls: level.balls, moves: 9, status: 'lost' } }); assert.match(loss, /限步/); assert.match(loss, /data-action="undo"/);
  const csv = statsCSV(model.save.stats); assert.match(csv, /levelId/); assert.match(csv, /01,1000/);
  assert.doesNotMatch([menu, settings, pause, win, loss].join(''), /data-action="(?:win|solve|autoplay)"/);
});

test('entry has one accessible canvas and image-backed mobile controls with explicit desktop route support', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.equal((html.match(/<canvas\b/g) ?? []).length, 1); assert.match(html, /aria-label/); assert.match(html, /viewport-fit=cover/);
  for (const action of ['pause', 'undo', 'restart', 'hint', 'select', 'strike']) assert.ok(html.includes(`data-action="${action}"`));
  assert.match(css, /min-height:\s*44px/); assert.match(css, /art\/button\.png/); assert.match(css, /art\/panel\.png/);
  assert.match(css, /data-layout="mobile"/); assert.match(css, /safe-area-inset-bottom/);
  assert.doesNotMatch(html + css, /https?:\/\/|linear-gradient|radial-gradient/);
});
