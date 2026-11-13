import { GAME_VERSION, CONTENT_VERSION } from './versions.mjs';
const CATEGORIES = ['activeMs', 'firstMainMs', 'replayMs', 'pauseMs', 'hiddenMs', 'menuMs', 'loadingMs', 'resultMs', 'animationMs', 'idleMs', 'sleepMs', 'nonOwnerMs'];
function ledger() {
  return { ...Object.fromEntries(CATEGORIES.map(key => [key, 0])), levels: {}, mainCompleted: false, firstFinishMs: null };
}
export function createStats() {
  return { schema: 1, gameVersion: GAME_VERSION, contentVersion: CONTENT_VERSION,
    ...ledger(), sessions: [], automated: ledger(), mainCompleted: false, firstFinishMs: null };
}
function levelRecord() {
  return { levelVersion: '1', activeMs: 0, firstMainMs: 0, replayMs: 0, attemptMs: 0,
    attempts: 0, restarts: 0, undos: 0, hints: 0, failures: 0, completions: 0,
    hintTiers: [0, 0, 0], firstAttempts: 0, firstRestarts: 0, firstUndos: 0, firstHints: 0, firstFailures: 0,
    firstHintTiers: [0, 0, 0], cleared: false, attemptOpen: false, firstClearMs: null, successfulAttemptMs: null };
}
function count(record, key) {
  record[key]++;
  if (!record.cleared) record[`first${key[0].toUpperCase()}${key.slice(1)}`]++;
}

const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
function exact(value, keys) {
  return value && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
}
/** Strict, bounded JSON stats contract shared by persistence. Returns value or throws. */
export function validateStats(value, levelIds) {
  const fail = () => { throw new Error('Invalid stats'); };
  const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e12;
  const counter = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e9;
  const checkLedger = (data, root = false) => {
    const keys = Object.keys(ledger());
    if (root) keys.push('schema', 'gameVersion', 'contentVersion', 'sessions', 'automated');
    if (!exact(data, keys) || !CATEGORIES.every(k => finite(data[k])) || typeof data.mainCompleted !== 'boolean' ||
      !(data.firstFinishMs === null || finite(data.firstFinishMs)) || data.mainCompleted !== (data.firstFinishMs !== null)) fail();
    if (Math.abs(data.activeMs - data.firstMainMs - data.replayMs) > 0.001 || data.firstFinishMs > data.firstMainMs) fail();
    if (!data.levels || Object.getPrototypeOf(data.levels) !== Object.prototype || Object.keys(data.levels).length > 1000) fail();
    for (const [id, r] of Object.entries(data.levels)) {
      if (!safeId(id) || levelIds && !levelIds.has(id) || !exact(r, Object.keys(levelRecord()))) fail();
      for (const [key, sample] of Object.entries(levelRecord())) {
        const n = r[key];
        if (key === 'levelVersion') { if (!safeId(n)) fail(); }
        else if (typeof sample === 'number') { if (!(key.endsWith('Ms') ? finite(n) : counter(n))) fail(); }
        else if (typeof sample === 'boolean') { if (typeof n !== 'boolean') fail(); }
        else if (sample === null) { if (!(n === null || finite(n))) fail(); }
        else if (!Array.isArray(n) || n.length !== 3 || !n.every(counter)) fail();
      }
      if (Math.abs(r.activeMs - r.firstMainMs - r.replayMs) > 0.001 || r.attemptMs > r.activeMs ||
        r.cleared !== (r.firstClearMs !== null) || r.cleared !== (r.successfulAttemptMs !== null) ||
        r.firstClearMs > r.firstMainMs || r.successfulAttemptMs > r.firstClearMs) fail();
      for (const key of ['attempts', 'restarts', 'undos', 'hints', 'failures']) if (r[`first${key[0].toUpperCase()}${key.slice(1)}`] > r[key]) fail();
    }
  };
  checkLedger(value, true);
  if (value.schema !== 1 || value.gameVersion !== GAME_VERSION || value.contentVersion !== CONTENT_VERSION ||
    !Array.isArray(value.sessions) || value.sessions.length > 10_000) fail();
  const ids = new Set();
  for (const s of value.sessions) {
    if (!exact(s, ['id', 'device', 'automated', 'gameVersion', 'contentVersion']) || !safeId(s.id) || ids.has(s.id) ||
      !['desktop', 'mobile', 'tablet', 'unknown'].includes(s.device) || typeof s.automated !== 'boolean' ||
      s.gameVersion !== value.gameVersion || s.contentVersion !== value.contentVersion) fail();
    ids.add(s.id);
  }
  checkLedger(value.automated);
  return value;
}

/** Pure monotonic counter. Call tick() at least once/second; snapshot() flushes it. */
export class PlayClock {
  constructor({ now = () => performance.now(), stats, sessionId = 'local', automated = false, device = 'desktop' } = {}) {
    if (typeof now !== 'function' || !safeId(sessionId) || !['desktop', 'mobile', 'tablet', 'unknown'].includes(device) || typeof automated !== 'boolean') throw new Error('Invalid clock metadata');
    if (stats) validateStats(stats);
    this.now = now;
    this.stats = stats ? structuredClone(stats) : createStats();
    this.context = { mode: 'menu', levelId: null, completed: false, owner: true };
    this.last = now();
    if (!Number.isFinite(this.last)) throw new Error('Clock must be finite');
    this.lastActivity = this.last;
    this.target = automated ? this.stats.automated : this.stats;
    if (!this.stats.sessions.some(s => s.id === sessionId)) this.stats.sessions.push({ id: sessionId, device, automated,
      gameVersion: this.stats.gameVersion, contentVersion: this.stats.contentVersion });
  }
  setContext(context, { newAttempt = false } = {}) {
    if (!context || Object.keys(context).some(k => !['mode', 'levelId', 'completed', 'owner', 'levelVersion'].includes(k))) throw new Error('Invalid context');
    const next = { ...this.context, ...context };
    if (!['play', 'pause', 'hidden', 'menu', 'loading', 'result', 'animation', 'idle'].includes(next.mode)) throw new Error('Invalid mode');
    if (next.mode === 'play' && !safeId(next.levelId) || next.levelId !== null && !safeId(next.levelId)) throw new Error('Invalid levelId');
    if (typeof next.completed !== 'boolean' || typeof next.owner !== 'boolean') throw new Error('Invalid context flags');
    if (context.levelVersion !== undefined && !safeId(context.levelVersion)) throw new Error('Invalid levelVersion');
    this.tick();
    const resumed = this.context.mode !== 'play' || !this.context.owner || this.context.levelId !== context.levelId && context.levelId !== undefined;
    this.context = { ...this.context, ...context };
    if (resumed && this.context.mode === 'play' && this.context.owner) this.lastActivity = this.last;
    if (this.context.mode === 'play' && this.context.levelId && this.context.owner) {
      const record = this.target.levels[this.context.levelId] ??= levelRecord();
      if (context.levelVersion !== undefined) record.levelVersion = context.levelVersion;
      if (newAttempt || !record.attemptOpen) { record.attemptOpen = true; record.attemptMs = 0; count(record, 'attempts'); }
    }
  }
  tick() {
    const time = this.now();
    if (!Number.isFinite(time)) throw new Error('Clock must be finite');
    let delta = Math.max(0, time - this.last);
    const start = this.last;
    this.last = Math.max(this.last, time);
    if (!this.context.owner) { this.target.nonOwnerMs += delta; return; }
    if (delta > 30_000) { this.target.sleepMs += delta; this.lastActivity = this.last; return; }
    if (this.context.mode !== 'play') { this.target[`${this.context.mode}Ms`] += delta; return; }
    const effective = Math.max(0, Math.min(time, this.lastActivity + 300_000) - start);
    this.target.idleMs += delta - effective;
    delta = effective;
    if (this.context.levelId) {
      const r = this.target.levels[this.context.levelId];
      this.target.activeMs += delta;
      r.activeMs += delta;
      r.attemptMs += delta;
      const category = r.cleared || this.context.completed ? 'replayMs' : 'firstMainMs';
      this.target[category] += delta;
      r[category] += delta;
    }
  }
  activity() { this.tick(); this.lastActivity = this.last; }
  event(type, detail = {}) {
    if (!['attempt', 'restart', 'undo', 'hint', 'failure', 'complete'].includes(type)) throw new Error('Invalid event');
    if (type === 'hint' && ![1, 2, 3].includes(detail.tier ?? 1)) throw new Error('Invalid hint tier');
    this.activity();
    if (!this.context.owner || !this.context.levelId) return;
    const r = this.target.levels[this.context.levelId];
    if (!r) return;
    if (type === 'restart' || type === 'attempt') {
      if (type === 'restart') count(r, 'restarts');
      if (type === 'restart' || !r.attemptOpen) { count(r, 'attempts'); r.attemptMs = 0; r.attemptOpen = true; }
      this.context.mode = 'play';
    } else if (type === 'undo') count(r, 'undos');
    else if (type === 'hint') {
      count(r, 'hints'); r.hintTiers[(detail.tier ?? 1) - 1]++;
      if (!r.cleared) r.firstHintTiers[(detail.tier ?? 1) - 1]++;
    }
    else if (type === 'failure' && r.attemptOpen) { count(r, 'failures'); r.attemptOpen = false; this.context.mode = 'result'; }
    else if (type === 'complete' && r.attemptOpen) {
      r.completions++;
      r.attemptOpen = false;
      this.context.mode = 'result';
      if (!r.cleared) { r.firstClearMs = r.firstMainMs; r.successfulAttemptMs = r.attemptMs; r.cleared = true; }
      if (detail.mainCompleted && !this.target.mainCompleted) {
        this.target.mainCompleted = true;
        this.target.firstFinishMs = this.target.firstMainMs;
      }
    }
  }
  snapshot() { this.tick(); return structuredClone(this.stats); }
}
