import { createStats, validateStats } from './timing.mjs';
import { strike } from './engine.mjs';
import { GAME_VERSION, CONTENT_VERSION } from './versions.mjs';
export { GAME_VERSION, CONTENT_VERSION } from './versions.mjs';
export const SAVE_KEY = 'pocket-bounce.save';
export function createSave() {
  return { schema: 2, gameVersion: GAME_VERSION, contentVersion: CONTENT_VERSION, progress: {}, current: null,
    settings: { muted: false, reducedMotion: false, symbols: true, layout: 'auto' }, stats: createStats() };
}
const MAX_TEXT = 2_000_000;
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
function requireThat(condition, message) { if (!condition) throw new Error(`Invalid save: ${message}`); }
function object(value, allowed, required = allowed) {
  requireThat(value && Object.getPrototypeOf(value) === Object.prototype, 'plain object required');
  requireThat(Reflect.ownKeys(value).every(k => typeof k === 'string' && allowed.includes(k)) && required.every(k => Object.hasOwn(value, k)), 'unknown or missing field');
}
function catalog(levels) {
  if (levels === undefined) return null;
  const list = levels instanceof Map ? [...levels.values()] : Array.isArray(levels) ? levels : Object.values(levels);
  return new Map(list.map(level => [level.id, level]));
}
function validateState(state, level) {
  object(state, ['balls', 'moves', 'status']);
  requireThat(integer(state.moves, level?.limit ?? 10_000) && ['playing', 'won', 'lost'].includes(state.status), 'state moves/status');
  requireThat(Array.isArray(state.balls) && state.balls.length <= 64, 'balls bound');
  const ids = new Set(), cells = new Set();
  for (const ball of state.balls) {
    object(ball, ['id', 'x', 'y', 'dir', 'color']);
    requireThat(safeId(ball.id) && !ids.has(ball.id) && integer(ball.x, level ? level.w - 1 : 63) && integer(ball.y, level ? level.h - 1 : 63) &&
      ['N', 'E', 'S', 'W'].includes(ball.dir) && safeId(ball.color), 'ball');
    const cell = `${ball.x},${ball.y}`;
    requireThat(!cells.has(cell), 'overlapping balls');
    ids.add(ball.id); cells.add(cell);
    if (level) {
      const initial = level.balls.find(b => b.id === ball.id);
      requireThat(initial && initial.color === ball.color, 'ball identity/color');
      requireThat(!(level.blocks ?? level.obstacles ?? []).some(o => o.x === ball.x && o.y === ball.y), 'ball on obstacle');
    }
  }
  requireThat((state.status === 'won') === (state.balls.length === 0), 'won consistency');
  if (level && state.balls.length) requireThat(state.status === (state.moves === level.limit ? 'lost' : 'playing'), 'limit/status');
}
function validateCurrent(current, byId) {
  if (current === null) return;
  object(current, ['levelId', 'state', 'history', 'actions', 'hintTier']);
  requireThat(safeId(current.levelId) && (!byId || byId.has(current.levelId)), 'unknown current level');
  const level = byId?.get(current.levelId);
  validateState(current.state, level);
  requireThat(integer(current.hintTier, 3) && Array.isArray(current.history) && current.history.length <= 512 &&
    Array.isArray(current.actions) && current.actions.length === current.state.moves && current.history.length === current.actions.length, 'history/actions bounds');
  for (let i = 0; i < current.history.length; i++) {
    const before = current.history[i], after = current.history[i + 1] ?? current.state;
    validateState(before, level);
    requireThat(before.moves === i && before.status === 'playing', 'history sequence');
    requireThat(safeId(current.actions[i]) && before.balls.some(b => b.id === current.actions[i]), 'action id');
    requireThat(after.balls.every(b => before.balls.some(old => old.id === b.id && old.color === b.color)), 'history ball identity');
    if (level?.blocks && level?.exits) {
      const expected = strike(level, before, current.actions[i]).state;
      requireThat(JSON.stringify(expected) === JSON.stringify(after), 'history transition');
    }
  }
  if (level) {
    const first = current.history[0] ?? current.state;
    requireThat(first.moves === 0 && first.balls.length === level.balls.length && first.balls.every(b =>
      level.balls.some(initial => ['id', 'x', 'y', 'dir', 'color'].every(k => initial[k] === b[k]))), 'initial checkpoint');
  }
}
export function validateSave(value, levels) {
  object(value, ['schema', 'gameVersion', 'contentVersion', 'progress', 'current', 'settings', 'stats']);
  requireThat(value.schema === 2, 'schema incompatible');
  requireThat(value.gameVersion === GAME_VERSION && value.contentVersion === CONTENT_VERSION, 'version incompatible');
  object(value.settings, ['muted', 'reducedMotion', 'symbols', 'layout']);
  requireThat(['muted', 'reducedMotion', 'symbols'].every(k => typeof value.settings[k] === 'boolean') && ['auto', 'desktop', 'mobile'].includes(value.settings.layout), 'settings');
  const byId = catalog(levels);
  requireThat(value.progress && Object.getPrototypeOf(value.progress) === Object.prototype && Object.keys(value.progress).length <= 1000, 'progress');
  for (const [id, record] of Object.entries(value.progress)) {
    requireThat(safeId(id) && (!byId || byId.has(id)), 'unknown progress level');
    object(record, ['stars', 'bestMoves', 'completed'], ['stars', 'bestMoves']);
    requireThat(integer(record.stars, 3) && integer(record.bestMoves, 10_000) && (record.completed === undefined || typeof record.completed === 'boolean'), 'progress values');
  }
  validateCurrent(value.current, byId);
  validateStats(value.stats, byId && new Set(byId.keys()));
  return value;
}
function migrateKnown(value, levels) {
  // The only older real format is the inherited candidate. Keep its four exact
  // teaching tables; never guess what an unknown future schema means.
  if (value?.schema !== 2 || value.gameVersion !== '0.1.0-candidate.1' || value.contentVersion !== '2026.11.12.1') return value;
  const next = structuredClone(value);
  next.gameVersion = GAME_VERSION; next.contentVersion = CONTENT_VERSION;
  next.stats.gameVersion = GAME_VERSION; next.stats.contentVersion = CONTENT_VERSION;
  for (const s of next.stats.sessions ?? []) { s.gameVersion = GAME_VERSION; s.contentVersion = CONTENT_VERSION; }
  if (levels) {
    const byId = catalog(levels), known = new Set(['01', '02', '03', '04']);
    for (const id of Object.keys(next.progress)) requireThat(known.has(id) && byId.has(id), 'migration unknown old level');
    if (next.current) requireThat(known.has(next.current.levelId), 'migration unknown checkpoint');
  }
  return next;
}
export function importSave(text, levels) {
  requireThat(typeof text === 'string' && text.length <= MAX_TEXT, 'import size');
  return validateSave(migrateKnown(JSON.parse(text), levels), levels);
}
export function exportSave(save) { return JSON.stringify(validateSave(save), null, 2); }
const message = error => error instanceof Error ? error.message : String(error);
const protectedStores = new WeakMap();
function retainBackup(storage, raw) {
  for (let i = 0; i < 100; i++) {
    const key = `${SAVE_KEY}.backup${i ? `.${i}` : ''}`;
    const previous = storage.getItem(key);
    if (previous === raw) return key;
    if (previous !== null) continue;
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) throw new Error('Backup verification failed');
    return key;
  }
  throw new Error('Backup slots full; export old data before replacing');
}
export function loadSave(storage, levels) {
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
    const save = raw === null ? createSave() : importSave(raw, levels);
    if (raw !== null && JSON.parse(raw).gameVersion !== GAME_VERSION) {
      protectedStores.set(storage, raw);
      return { save, warnings: ['旧候选存档已迁移；首次写入前会保留原文备份。'] };
    }
    protectedStores.delete(storage);
    return { save, warnings: [] };
  } catch (error) {
    if (typeof raw === 'string') protectedStores.set(storage, raw);
    return { save: createSave(), warnings: [message(error)], ...(typeof raw === 'string' ? { backup: raw } : {}) };
  }
}
export function persistSave(storage, save) {
  try {
    const raw = exportSave(save);
    const previous = storage.getItem(SAVE_KEY);
    let protect = protectedStores.get(storage);
    if (previous !== null && previous !== raw && protect === undefined) {
      try { importSave(previous); } catch { protect = previous; }
    }
    if (protect !== undefined) retainBackup(storage, protect);
    storage.setItem(SAVE_KEY, raw);
    if (storage.getItem(SAVE_KEY) !== raw) throw new Error('Storage verification failed');
    protectedStores.delete(storage);
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}
