// Dependency-free ESM, supported by Node >=22. Run from pocket-bounce/.
import { LEVELS, CONTENT_VERSION } from '../src/levels.mjs';
import { initialState, strike, validateLevel } from '../src/engine.mjs';
import { solve } from '../src/solver.mjs';
import { referenceStrike, referenceSolve } from './reference.mjs';
import { isDeepStrictEqual } from 'node:util';
import { writeFileSync } from 'node:fs';
const results = [];
for (const level of LEVELS) {
  validateLevel(level);
  const result = solve(level, undefined, { maxStates: 60000, maxMs: 1500 });
  if (result.status !== 'solved') throw new Error(`${level.id}: UNVERIFIED ${result.reason ?? result.status}`);
  const reference = referenceSolve(level, result.solution.length);
  if (reference.status !== 'solved' || reference.par !== result.solution.length || level.par !== reference.par) throw new Error(`${level.id}: par/reference mismatch or unverified`);
  let state = initialState(level), events = [];
  for (const id of result.solution) {
    // Check every available action along the certified route, not just the chosen one.
    for (const ball of state.balls) if (!isDeepStrictEqual(strike(level, state, ball.id).state, referenceStrike(level, state, ball.id))) throw new Error(`${level.id}: independent rules mismatch`);
    const next = strike(level, state, id); state = next.state; events.push(...next.events);
  }
  if (state.status !== 'won') throw new Error(`${level.id}: replay failed`);
  const record = { id: level.id, par: reference.par, solution: result.solution, visited: result.visited, referenceVisited: reference.visited, elapsedMs: result.elapsedMs, transfers: events.filter(e => e.type === 'transfer').length, mirrors: events.filter(e => e.type === 'mirror').length, bounces: events.filter(e => e.type === 'bounce').length };
  results.push(record); console.log(JSON.stringify(record));
}
const report = { contentVersion: CONTENT_VERSION, status: 'verified', levelCount: results.length, method: 'serial BFS + independent reference BFS, then differential replay', budgetPerSearch: { maxStates: 60000, maxMs: 1500 }, levels: results };
writeFileSync(new URL('../evidence/levels.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`VERIFIED ${results.length} levels; shortest pars independently matched. Browser/human tests NOT performed.`);