import test from 'node:test';
import assert from 'node:assert/strict';
import { BEATS, DIRECTIONS, initialState, strike } from '../src/engine.mjs';
import { referenceStrike } from '../tools/reference.mjs';
import { boot } from '../src/app.mjs';
import { fixture } from './dom-fixture.mjs';
import { LEVELS } from '../src/levels.mjs';

// Each sample is hand-written from RULES.md section "独立输入—预期结果案例".
// For every rule the expected board is asserted directly AND differentially
// against tools/reference.mjs, an independent engine that never imports src/engine.mjs.
const ball = (id, x, y, dir = 'E', color = 'red') => ({ id, x, y, dir, color });
const level = (w, h, balls, extra = {}) => ({ id: 'sample', w, h, balls, blocks: [], mirrors: [], exits: [], limit: 20, ...extra });
const run = (l, id = 'a') => strike(l, initialState(l), id);
const pos = s => s.balls.map(b => `${b.id}:${b.x},${b.y},${b.dir}`).sort().join('|');
// Engine vs reference must agree for the chosen action and for every other legal action.
function identicalToReference(l, state) {
  for (const b of state.balls) assert.deepEqual(strike(l, state, b.id).state, referenceStrike(l, state, b.id), `engine/reference mismatch on ${b.id}`);
}

test('rule 1: four directions and every strike is exactly six beats', () => {
  assert.deepEqual(Object.keys(DIRECTIONS), ['N', 'E', 'S', 'W']); // no diagonal
  const l = level(4, 1, [ball('a', 2, 0)]);
  const r = run(l);
  assert.equal(r.events.length, BEATS);
  assert.deepEqual(r.state.balls, [ball('a', 0, 0, 'E')]); // 到3、撞东墙转W、到2、到1、到0、撞西墙转E
  identicalToReference(l, initialState(l));
  const once = run(level(3, 1, [ball('a', 1, 0)])); // case 6: six beats return to the same stable cell
  assert.equal(once.events.length, BEATS);
  assert.deepEqual(once.state.balls, [ball('a', 1, 0, 'E')]);
  assert.equal(once.state.moves, 1); // returning to the same state still costs exactly one step
});

test('rule 2: wall, box and wrong-color pocket all reflect 180 degrees in place', () => {
  const wall = run(level(4, 1, [ball('a', 3, 0)])); // single east rail hit, stays in place
  assert.deepEqual(wall.events[0], { type: 'bounce', reason: 'rail', id: 'a', from: { x: 3, y: 0 }, to: { x: 3, y: 0 }, dir: 'W', tick: 1 });
  const box = level(3, 1, [ball('a', 1, 0)], { blocks: [{ x: 2, y: 0 }] });
  const boxed = run(box);
  assert.equal(boxed.events.length, BEATS);
  assert.deepEqual(boxed.state.balls, [ball('a', 0, 0, 'W')]);
  assert.deepEqual([...new Set(boxed.events.filter(e => e.type === 'bounce').map(e => e.reason))].sort(), ['block', 'rail']);
  identicalToReference(box, initialState(box));
  const wrong = level(3, 1, [ball('a', 1, 0)], { exits: [{ edge: 'E', index: 0, color: 'blue' }] });
  const bounced = run(wrong);
  assert.equal(bounced.state.balls.length, 1); // wrong color never pockets the ball
  assert.equal(bounced.events[1].type, 'bounce');
  assert.equal(bounced.events[1].reason, 'wrong-color');
  identicalToReference(wrong, initialState(wrong));
});

test('rule 3: mirrors turn exactly 90 degrees in all four entries', () => {
  const table = { '/': { N: 'E', E: 'N', S: 'W', W: 'S' }, '\\': { N: 'W', W: 'N', S: 'E', E: 'S' } };
  const starts = { N: [1, 2], E: [0, 1], S: [1, 0], W: [2, 1] };
  for (const [kind, mapping] of Object.entries(table)) for (const [dir, expected] of Object.entries(mapping)) {
    const [x, y] = starts[dir], l = level(3, 3, [ball('a', x, y, dir)], { mirrors: [{ x: 1, y: 1, kind }], exits: [{ edge: expected, index: 1, color: 'red' }] });
    const r = run(l);
    assert.equal(r.events[0].type, 'mirror');
    assert.equal(r.events[0].dir, expected, `${kind} from ${dir}`);
    assert.equal(r.events.length, 3);
    assert.equal(r.state.status, 'won');
    identicalToReference(l, initialState(l));
  }
});

test('rule 4: ball collision transfers the remaining beats to the struck ball', () => {
  const l = level(5, 1, [ball('a', 0, 0), ball('b', 2, 0, 'W', 'blue')], { exits: [{ edge: 'E', index: 0, color: 'blue' }] });
  const r = run(l);
  assert.deepEqual(r.state.balls, [ball('a', 1, 0, 'W')]); // striking ball stops reflected, blue relays into its own pocket
  assert.deepEqual(r.events.map(e => e.type), ['move', 'transfer', 'move', 'move', 'pocket']);
  identicalToReference(l, initialState(l));
  const relay = level(6, 1, [ball('a', 0, 0), ball('b', 2, 0, 'N', 'blue'), ball('c', 4, 0, 'W', 'green')], { exits: [{ edge: 'E', index: 0, color: 'green' }] });
  const r3 = run(relay);
  assert.deepEqual(r3.state.balls, [ball('a', 1, 0, 'W'), ball('b', 3, 0, 'W', 'blue')]);
  assert.equal(r3.events.filter(e => e.type === 'transfer').length, 2);
  assert.equal(r3.events.length, BEATS);
  identicalToReference(relay, initialState(relay));
});

test('rule 5: pocketing ends the impulse early; otherwise the sixth beat stops the ball', () => {
  const brief = run(level(3, 1, [ball('a', 1, 0)], { exits: [{ edge: 'E', index: 0, color: 'red' }] }));
  assert.equal(brief.state.status, 'won');
  assert.deepEqual(brief.events.map(e => e.type), ['move', 'pocket']); // two beats, remaining beats discarded
  assert.equal(brief.state.moves, 1);
  for (const l of [level(4, 1, [ball('a', 2, 0)]), level(6, 1, [ball('a', 0, 0), ball('b', 2, 0, 'N', 'blue'), ball('c', 4, 0, 'W', 'green')])]) {
    assert.ok(run(l).events.length <= BEATS); // never exceeds six beats, never keeps rolling
  }
});

test('rule 6: empty taps and pause cost no step; undo restores the checkpoint without rolling back stats', async () => {
  // Engine side: an empty cell / missing ball / non-playing state is not a legal action and costs nothing.
  const l = level(3, 1, [ball('a', 1, 0)]);
  const s = initialState(l);
  assert.equal(strike(l, s, 'missing').accepted, false);
  assert.equal(strike(l, s, 'missing').state.moves, 0);
  assert.equal(strike(l, { ...s, status: 'lost' }, 'a').accepted, false);
  // App side: real pointer delivery via the DOM fixture (NOT a browser acceptance).
  const f = fixture();
  try {
    const r = await boot(f.doc, f.win); await f.click('level', { level: '03' }); await f.click('resume');
    assert.equal(r.controller.state.moves, 0);
    const empty = r.view.geometry.center(4, 0); // a cell with no ball
    f.get('#board').dispatch('pointerdown', { clientX: empty.x, clientY: empty.y, button: 0, pointerType: 'touch' }); await f.flush();
    assert.equal(r.controller.state.moves, 0); // tapping an empty cell costs no step
    await f.click('pause'); assert.equal(r.controller.state.moves, 0); // pause costs no step
    await f.click('resume');
    const row = () => r.clock.stats.automated.levels['03'];
    await f.click('strike'); f.advance(1000);
    assert.equal(r.controller.state.moves, 1);
    const undos = row().undos, attempts = row().attempts;
    await f.click('undo');
    assert.deepEqual(r.controller.state, initialState(LEVELS[2])); // stable checkpoint restored
    assert.equal(row().undos, undos + 1); // stats are NOT rolled back by undo
    assert.equal(row().attempts, attempts);
  } finally { f.cleanup(); }
});

// Keep the differential helper honest: it must actually detect a wrong reference.
test('differential control is not vacuous', () => {
  const l = level(3, 1, [ball('a', 1, 0)]), s = initialState(l);
  const fake = { ...referenceStrike(l, s, 'a'), moves: 99 };
  assert.throws(() => assert.deepEqual(strike(l, s, 'a').state, fake));
});
