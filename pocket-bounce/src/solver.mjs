import { initialState, strike, stateKey } from './engine.mjs';

/** Serial breadth-first proof, bounded in states and monotonic wall time. No workers. */
export function solve(level, state = initialState(level), { maxStates = 50000, maxMs = 1500, maxDepth = level.limit - state.moves, now = () => performance.now() } = {}) {
  if (!Number.isInteger(maxStates) || maxStates < 1 || maxStates > 200000 || !Number.isFinite(maxMs) || maxMs < 0 || maxMs > 30000 || !Number.isInteger(maxDepth) || maxDepth < 0) throw new Error('Invalid search budget');
  const start = now(), nodes = [{ state, parent: -1, action: null, depth: 0 }], seen = new Set([stateKey(state)]);
  let cursor = 0, expanded = 0;
  const report = (status, extra = {}) => ({ status, visited: nodes.length, expanded, elapsedMs: now() - start, ...extra });
  if (!state.balls.length) return report('solved', { solution: [], shortest: true });
  const depthLimit = Math.min(maxDepth, level.limit - state.moves);
  while (cursor < nodes.length) {
    if (now() - start >= maxMs) return report('unverified', { reason: 'time-budget' });
    const index = cursor++, node = nodes[index];
    if (node.depth + node.state.balls.length > depthLimit || node.state.status !== 'playing') continue;
    expanded++;
    for (const ball of node.state.balls) {
      if (now() - start >= maxMs) return report('unverified', { reason: 'time-budget' });
      const next = strike(level, node.state, ball.id).state;
      const child = { state: next, parent: index, action: ball.id, depth: node.depth + 1 };
      if (!next.balls.length) {
        const solution = [ball.id]; let p = index;
        while (nodes[p].parent !== -1) { solution.push(nodes[p].action); p = nodes[p].parent; }
        return report('solved', { solution: solution.reverse(), shortest: true });
      }
      const key = stateKey(next);
      if (seen.has(key)) continue;
      if (nodes.length >= maxStates) return report('unverified', { reason: 'state-budget' });
      seen.add(key); nodes.push(child);
    }
  }
  return report('unsolvable', { withinMoves: depthLimit });
}