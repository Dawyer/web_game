import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, strike, validateLevel } from '../src/engine.mjs';
const ball = (id, x, y, dir = 'E', color = 'red') => ({ id, x, y, dir, color });
const level = (w, h, balls, extra = {}) => ({ id: 'test', w, h, balls, blocks: [], mirrors: [], exits: [], limit: 20, ...extra });
const run = (l, id = 'a') => strike(l, initialState(l), id);
test('handwritten: straight pocket takes two beats and wins', () => {
  const r = run(level(3, 1, [ball('a', 1, 0)], { exits: [{ edge: 'E', index: 0, color: 'red' }] }));
  assert.deepEqual(r.state, { balls: [], moves: 1, status: 'won' });
  assert.deepEqual(r.events.map(e => e.type), ['move', 'pocket']);
});
test('handwritten: wall consumes a beat; six beats finish at zero facing east', () => {
  const r = run(level(4, 1, [ball('a', 2, 0)]));
  assert.deepEqual(r.state.balls, [ball('a', 0, 0)]);
  assert.deepEqual(r.events.map(e => e.type), ['move', 'bounce', 'move', 'move', 'move', 'bounce']);
});
test('handwritten: both mirrors reflect all four directions', () => {
  const table = { '/': { N: 'E', E: 'N', S: 'W', W: 'S' }, '\\': { N: 'W', W: 'N', S: 'E', E: 'S' } };
  const starts = { N: [1, 2], E: [0, 1], S: [1, 0], W: [2, 1] };
  for (const [kind, mapping] of Object.entries(table)) for (const [dir, expected] of Object.entries(mapping)) {
    const [x, y] = starts[dir], l = level(3, 3, [ball('a', x, y, dir)], { mirrors: [{ x: 1, y: 1, kind }], exits: [{ edge: expected, index: 1, color: 'red' }] });
    const r = run(l); assert.equal(r.events[0].dir, expected); assert.equal(r.events[0].type, 'mirror'); assert.equal(r.events.length, 3); assert.equal(r.state.status, 'won');
  }
});
test('handwritten: impulse transfer pockets blue; red stays reflected at one', () => {
  const r = run(level(5, 1, [ball('a', 0, 0), ball('b', 2, 0, 'W', 'blue')], { exits: [{ edge: 'E', index: 0, color: 'blue' }] }));
  assert.deepEqual(r.state.balls, [ball('a', 1, 0, 'W')]);
  assert.deepEqual(r.events.map(e => e.type), ['move', 'transfer', 'move', 'move', 'pocket']);
});
test('handwritten: three-ball relay uses exactly six beats, not simultaneous movement', () => {
  const r = run(level(6, 1, [ball('a', 0, 0), ball('b', 2, 0, 'N', 'blue'), ball('c', 4, 0, 'W', 'green')], { exits: [{ edge: 'E', index: 0, color: 'green' }] }));
  assert.deepEqual(r.state.balls, [ball('a', 1, 0, 'W'), ball('b', 3, 0, 'W', 'blue')]); assert.equal(r.events.length, 6);
});
test('handwritten: repeat state stops after six beats and still counts a move', () => {
  const r = run(level(3, 1, [ball('a', 1, 0)])); assert.deepEqual(r.state.balls, [ball('a', 1, 0)]); assert.equal(r.state.moves, 1); assert.equal(r.events.length, 6);
});
test('handwritten: block and wrong color reflect in place, victory wins on last allowed move', () => {
  const l = level(4, 2, [ball('a', 0, 0)], { blocks: [{ x: 1, y: 0 }], exits: [{ edge: 'W', index: 0, color: 'blue' }], limit: 1 });
  const r = run(l); assert.deepEqual(r.state.balls, [ball('a', 0, 0)]); assert.equal(r.state.status, 'lost');
  assert.deepEqual(r.events.map(e => e.reason), ['block', 'wrong-color', 'block', 'wrong-color', 'block', 'wrong-color']);
  assert.equal(run(level(1, 1, [ball('a', 0, 0)], { limit: 1, exits: [{ edge: 'E', index: 0, color: 'red' }] })).state.status, 'won');
});
test('handwritten: occupied mirror is not entered on transfer', () => {
  const l = level(5, 2, [ball('a', 0, 0), ball('b', 1, 0, 'S', 'blue')], { mirrors: [{ x: 1, y: 0, kind: '/' }], exits: [{ edge: 'E', index: 0, color: 'blue' }] });
  const r = run(l); assert.equal(r.events[0].type, 'transfer'); assert.deepEqual(r.state.balls, [ball('a', 0, 0, 'W')]);
});
test('immutable inputs, missing ball and terminal input rejected', () => {
  const l = level(3, 1, [ball('a', 1, 0)]), s = initialState(l), copy = structuredClone({ l, s }); strike(l, s, 'a'); assert.deepEqual({ l, s }, copy);
  assert.equal(strike(l, s, 'missing').accepted, false); assert.equal(strike(l, { ...s, status: 'lost' }, 'a').accepted, false);
});
test('invalid data cannot enter the engine', () => {
  const good = level(3, 3, [ball('a', 1, 1)]);
  const bad = [l => l.balls.push({ ...l.balls[0] }), l => l.balls[0].dir = 'NE', l => l.balls[0].color = 'cyan', l => l.balls[0].x = -1, l => l.blocks.push({ x: 1, y: 1 }), l => l.mirrors.push({ x: 0, y: 0, kind: 'x' }), l => l.exits.push({ edge: 'N', index: 3, color: 'red' }), l => l.w = 8];
  for (const change of bad) { const l = structuredClone(good); change(l); assert.throws(() => validateLevel(l), /Invalid level/); }
});