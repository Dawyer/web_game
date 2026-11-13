// Deliberately separate rules implementation, for offline differential checks only.
// Uses direction indices, integer positions, and a tick loop, never imports engine.
const directions = 'NESW';
export function referenceStrike(level, input, id) {
  const balls = structuredClone(input.balls);
  let at = balls.findIndex(b => b.id === id);
  if (at < 0 || input.status !== 'playing' || input.moves >= level.limit) return input;
  for (let fuel = 6; fuel > 0; fuel--) {
    const b = balls[at], d = directions.indexOf(b.dir);
    const nx = b.x + [0, 1, 0, -1][d], ny = b.y + [-1, 0, 1, 0][d];
    if (nx < 0 || ny < 0 || nx === level.w || ny === level.h) {
      const matches = level.exits.some(p => p.edge === b.dir && p.index === (d % 2 ? b.y : b.x) && p.color === b.color);
      if (matches) { balls.splice(at, 1); break; }
      b.dir = directions[(d + 2) % 4]; continue;
    }
    if (level.blocks.some(p => p.x === nx && p.y === ny)) { b.dir = directions[(d + 2) % 4]; continue; }
    const target = balls.findIndex(p => p.x === nx && p.y === ny);
    if (target !== -1) { balls[target].dir = b.dir; b.dir = directions[(d + 2) % 4]; at = target; continue; }
    b.x = nx; b.y = ny;
    const mirror = level.mirrors.find(p => p.x === nx && p.y === ny);
    if (mirror) b.dir = directions[(mirror.kind === '/' ? [1, 0, 3, 2] : [3, 2, 1, 0])[d]];
  }
  const moves = input.moves + 1;
  return { balls, moves, status: balls.length === 0 ? 'won' : moves === level.limit ? 'lost' : 'playing' };
}
export function referenceSolve(level, maxDepth, maxStates = 60000, maxMs = 1500) {
  const started = performance.now(), queue = [{ balls: structuredClone(level.balls), moves: 0, status: 'playing' }], seen = new Set();
  const key = s => s.balls.map(b => `${b.id}:${b.x}:${b.y}:${b.dir}`).sort().join(';');
  seen.add(key(queue[0]));
  for (let i = 0; i < queue.length; i++) {
    if (performance.now() - started > maxMs) return { status: 'unverified', reason: 'time-budget' };
    const s = queue[i]; if (s.moves >= maxDepth || s.status !== 'playing') continue;
    for (const b of s.balls) {
      const next = referenceStrike(level, s, b.id);
      if (!next.balls.length) return { status: 'solved', par: next.moves, visited: queue.length };
      const k = key(next); if (seen.has(k)) continue;
      if (queue.length >= maxStates) return { status: 'unverified', reason: 'state-budget' };
      seen.add(k); queue.push(next);
    }
  }
  return { status: 'unsolvable', visited: queue.length };
}