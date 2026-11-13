import test from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../src/solver.mjs';
import { initialState, strike } from '../src/engine.mjs';
import { LEVELS } from '../src/levels.mjs';
test('minimal teaching content has proven pars and real engine replay wins', () => {
  for (const l of LEVELS) { const r = solve(l); assert.equal(r.status, 'solved', l.id); assert.equal(r.solution.length, l.par, l.id); let s = initialState(l); for (const id of r.solution) s = strike(l, s, id).state; assert.equal(s.status, 'won', l.id); }
});
test('budget exhaustion is unverified, not unsolvable; remaining moves bound hints', () => {
  const l = LEVELS[2]; assert.equal(solve(l, undefined, { maxStates: 1 }).status, 'unverified'); assert.equal(solve(l, undefined, { maxMs: 0 }).status, 'unverified');
  assert.equal(solve(l, { ...initialState(l), moves: l.limit - 1 }).status, 'unsolvable');
  assert.throws(() => solve(l, undefined, { maxStates: Infinity }), /budget/);
});