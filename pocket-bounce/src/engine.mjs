export const DIRECTIONS = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });
export const COLORS = Object.freeze(['red', 'yellow', 'blue', 'green', 'purple', 'orange']);
export const BEATS = 6;
const opposite = { N: 'S', E: 'W', S: 'N', W: 'E' };
const reflection = { '/': { N: 'E', E: 'N', S: 'W', W: 'S' }, '\\': { N: 'W', W: 'N', S: 'E', E: 'S' } };
const idOK = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(id) && !['constructor', 'prototype', '__proto__'].includes(id);
function requireThat(ok, reason) { if (!ok) throw new Error(`Invalid level: ${reason}`); }
export function validateLevel(level) {
  requireThat(level && Number.isInteger(level.w) && level.w >= 1 && level.w <= 7 && Number.isInteger(level.h) && level.h >= 1 && level.h <= 8, 'dimensions');
  requireThat(idOK(level.id) && Number.isInteger(level.limit) && level.limit >= 1 && level.limit <= 512, 'id/limit');
  const inside = p => Number.isInteger(p.x) && p.x >= 0 && p.x < level.w && Number.isInteger(p.y) && p.y >= 0 && p.y < level.h;
  for (const key of ['balls', 'blocks', 'mirrors', 'exits']) requireThat(Array.isArray(level[key]) && level[key].length <= 64, key);
  requireThat(level.balls.length > 0, 'empty initial board');
  const solid = new Set(), mirrors = new Set(), occupied = new Set(), ids = new Set(), exits = new Set();
  const cell = p => `${p.x},${p.y}`;
  for (const p of level.blocks) { requireThat(inside(p) && !solid.has(cell(p)), 'block overlap/bounds'); solid.add(cell(p)); }
  for (const p of level.mirrors) { requireThat(inside(p) && !solid.has(cell(p)) && !mirrors.has(cell(p)) && Object.hasOwn(reflection, p.kind), 'mirror'); mirrors.add(cell(p)); }
  for (const p of level.balls) {
    requireThat(inside(p) && !solid.has(cell(p)) && !occupied.has(cell(p)) && idOK(p.id) && !ids.has(p.id) && Object.hasOwn(DIRECTIONS, p.dir) && COLORS.includes(p.color), 'ball');
    occupied.add(cell(p)); ids.add(p.id);
  }
  for (const p of level.exits) {
    const key = `${p.edge}:${p.index}`;
    requireThat(Object.hasOwn(DIRECTIONS, p.edge) && Number.isInteger(p.index) && p.index >= 0 && p.index < (p.edge === 'N' || p.edge === 'S' ? level.w : level.h) && COLORS.includes(p.color) && !exits.has(key), 'exit'); exits.add(key);
  }
  if (level.par !== undefined) requireThat(Number.isInteger(level.par) && level.par >= level.balls.length && level.limit >= level.par + 4, 'par/limit');
  return level;
}
export function initialState(level) {
  validateLevel(level);
  return { balls: level.balls.map(b => ({ ...b })), moves: 0, status: 'playing' };
}
export function stateKey(state) {
  return [...state.balls].sort((a, b) => a.id.localeCompare(b.id)).map(b => `${b.id}:${b.x},${b.y},${b.dir}`).join('|');
}
/** One atomic impulse. Neither the input board nor level data is mutated. */
export function strike(level, state, id) {
  if (state.status !== 'playing' || state.moves >= level.limit || !state.balls.some(b => b.id === id)) return { accepted: false, state, events: [] };
  const balls = state.balls.map(b => ({ ...b })), events = [];
  let active = balls.find(b => b.id === id);
  for (let tick = 1; tick <= BEATS; tick++) {
    const from = { x: active.x, y: active.y }, incomingDir = active.dir, [dx, dy] = DIRECTIONS[active.dir];
    const to = { x: from.x + dx, y: from.y + dy };
    const outside = to.x < 0 || to.y < 0 || to.x >= level.w || to.y >= level.h;
    if (outside) {
      const exit = level.exits.find(e => e.edge === incomingDir && e.index === (dx ? from.y : from.x));
      if (exit?.color === active.color) {
        events.push({ type: 'pocket', id: active.id, from, to, dir: incomingDir, tick }); balls.splice(balls.indexOf(active), 1); break;
      }
      active.dir = opposite[incomingDir];
      events.push({ type: 'bounce', reason: exit ? 'wrong-color' : 'rail', id: active.id, from, to: from, dir: active.dir, tick }); continue;
    }
    if (level.blocks.some(p => p.x === to.x && p.y === to.y)) {
      active.dir = opposite[incomingDir]; events.push({ type: 'bounce', reason: 'block', id: active.id, from, to: from, dir: active.dir, tick }); continue;
    }
    const other = balls.find(b => b !== active && b.x === to.x && b.y === to.y);
    if (other) {
      active.dir = opposite[incomingDir]; other.dir = incomingDir;
      events.push({ type: 'transfer', id: active.id, otherId: other.id, from, to: from, dir: incomingDir, reflectedDir: active.dir, tick }); active = other; continue;
    }
    active.x = to.x; active.y = to.y;
    const mirror = level.mirrors.find(p => p.x === to.x && p.y === to.y);
    if (mirror) active.dir = reflection[mirror.kind][incomingDir];
    events.push({ type: mirror ? 'mirror' : 'move', id: active.id, from, to, dir: active.dir, tick });
  }
  const moves = state.moves + 1;
  return { accepted: true, state: { balls, moves, status: !balls.length ? 'won' : moves >= level.limit ? 'lost' : 'playing' }, events };
}