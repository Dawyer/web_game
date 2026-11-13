import test from 'node:test';
import assert from 'node:assert/strict';

// Dynamic import keeps the first RED an assertion about missing behavior.
let api;
try { api = await import('../src/timing.mjs'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
function clock(options = {}) {
  let time = 0;
  const instance = new api.PlayClock({ now: () => time, sessionId: 'test-session', ...options });
  return { instance, advance(ms, heartbeat = true) {
    const end = time + ms;
    if (heartbeat) while (time + 1000 < end) { time += 1000; instance.tick(); }
    time = end; instance.tick();
  }, setTime(value) { time = value; } };
}

test('normal thinking counts as first-main effective time without input', () => {
  assert.equal(typeof api?.PlayClock, 'function', 'PlayClock must be implemented');
  const { instance: c, advance } = clock();
  c.setContext({ mode: 'play', levelId: 'L01' });
  advance(90_000);
  assert.equal(c.stats.activeMs, 90_000);
  assert.equal(c.stats.firstMainMs, 90_000);
  assert.equal(c.stats.replayMs, 0);
  assert.equal(c.stats.levels.L01.attempts, 1);
  assert.equal(c.stats.levels.L01.attemptMs, 90_000);
  const copy = c.snapshot();
  copy.activeMs = 0;
  assert.equal(c.stats.activeMs, 90_000, 'snapshot must be detached');
});

test('idle begins exactly after five minutes of thought and input resumes it', () => {
  const { instance: c, advance } = clock();
  c.setContext({ mode: 'play', levelId: 'L01' });
  advance(299_500);
  advance(1000, false);
  assert.equal(c.stats.activeMs, 300_000);
  assert.equal(c.stats.idleMs, 500);
  advance(2500);
  assert.equal(c.stats.idleMs, 3000);
  c.activity(); advance(1500);
  assert.equal(c.stats.activeMs, 301_500);
  assert.equal(c.stats.idleMs, 3000);
});

test('suspension gaps over thirty seconds cannot inject active time', () => {
  const { instance: c, advance, setTime } = clock();
  c.setContext({ mode: 'play', levelId: 'L01' });
  advance(1000);
  advance(60_000, false);
  assert.equal(c.stats.sleepMs, 60_000);
  assert.equal(c.stats.activeMs, 1000);
  advance(1000);
  assert.equal(c.stats.activeMs, 2000);
  setTime(-5000); c.tick(); c.activity();
  setTime(62_000); c.tick();
  assert.equal(c.stats.activeMs, 2000, 'backwards clocks neither subtract nor repeat');
  setTime(63_000); c.tick();
  assert.equal(c.stats.activeMs, 3000);
  const dateNow = Date.now;
  try { Date.now = () => 9e15; advance(1000); }
  finally { Date.now = dateNow; }
  assert.equal(c.stats.activeMs, 4000, 'wall clock never participates');
});

test('first clearance retains all attempts and successful-attempt time across replay', () => {
  const { instance: c, advance } = clock();
  c.setContext({ mode: 'play', levelId: 'L01' }); advance(10_000);
  c.event('failure'); c.event('restart'); advance(20_000);
  c.event('undo'); c.event('hint', { tier: 2 });
  c.event('complete', { mainCompleted: true });
  const record = c.stats.levels.L01;
  assert.equal(record.firstClearMs, 30_000);
  assert.equal(record.successfulAttemptMs, 20_000);
  assert.equal(record.attempts, 2);
  assert.equal(record.restarts, 1);
  assert.equal(record.failures, 1);
  assert.equal(record.undos, 1);
  assert.equal(record.hints, 1);
  assert.deepEqual(record.hintTiers, [0, 1, 0]);
  assert.equal(c.stats.firstFinishMs, 30_000);
  c.event('complete', { mainCompleted: true });
  assert.equal(record.completions, 1, 'duplicate finish is idempotent');
  c.event('restart'); advance(4000); c.event('complete');
  assert.equal(record.firstClearMs, 30_000);
  assert.equal(record.successfulAttemptMs, 20_000);
  assert.equal(c.stats.firstMainMs, 30_000);
  assert.equal(c.stats.replayMs, 4000);
  assert.equal(c.stats.firstFinishMs, 30_000);
});

test('result waits stop automatically and first-clear counters cannot be changed by replay', () => {
  const { instance: c, advance } = clock();
  c.setContext({ mode: 'play', levelId: 'L01' }); advance(1000);
  c.event('failure'); advance(4000);
  assert.equal(c.stats.activeMs, 1000);
  assert.equal(c.stats.resultMs, 4000);
  c.event('restart'); advance(2000); c.event('hint', { tier: 3 }); c.event('complete');
  assert.equal(c.stats.levels.L01.firstAttempts, 2);
  assert.equal(c.stats.levels.L01.firstHints, 1);
  advance(3000);
  c.event('restart'); c.event('hint'); advance(1000); c.event('complete');
  assert.equal(c.stats.levels.L01.firstAttempts, 2);
  assert.equal(c.stats.levels.L01.firstHints, 1);
  assert.equal(c.stats.levels.L01.attempts, 3);
  assert.equal(c.stats.levels.L01.hints, 2);
});

test('reload restores checkpoint totals without offline injection or another attempt', () => {
  const { instance: c, advance } = clock();
  c.setContext({ mode: 'play', levelId: 'L01' }); advance(5000);
  const saved = c.snapshot();
  const resumed = clock({ stats: saved, sessionId: 'new-session' });
  resumed.advance(80_000);
  resumed.instance.setContext({ mode: 'play', levelId: 'L01' });
  resumed.advance(2000);
  assert.equal(resumed.instance.stats.activeMs, 7000);
  assert.equal(resumed.instance.stats.levels.L01.attempts, 1);
  assert.equal(resumed.instance.stats.levels.L01.attemptMs, 7000);
  assert.equal(saved.activeMs, 5000);
  assert.equal(resumed.instance.stats.sessions.length, 2);
});

test('automated completion remains in a separate ledger and nonowner cannot start attempts', () => {
  const { instance: c, advance } = clock({ automated: true, device: 'mobile' });
  c.setContext({ mode: 'play', levelId: 'L01', owner: false });
  advance(2000); c.event('complete', { mainCompleted: true });
  assert.equal(c.stats.automated.levels.L01, undefined);
  c.setContext({ owner: true }); advance(3000); c.event('complete', { mainCompleted: true });
  assert.equal(c.stats.activeMs, 0);
  assert.deepEqual(c.stats.levels, {});
  assert.equal(c.stats.firstFinishMs, null);
  assert.equal(c.stats.automated.activeMs, 3000);
  assert.equal(c.stats.automated.firstFinishMs, 3000);
  assert.equal(c.stats.sessions[0].automated, true);
  assert.equal(c.stats.sessions[0].device, 'mobile');
});

test('invalid context, metadata, hint tiers and nonfinite clocks are rejected before mutation', () => {
  const { instance: c, setTime } = clock();
  assert.throws(() => c.setContext({ mode: 'bogus' }), /mode/);
  assert.throws(() => c.setContext({ mode: 'play' }), /levelId/);
  assert.throws(() => c.setContext({ mode: 'play', levelId: '__proto__' }), /levelId/);
  c.setContext({ mode: 'play', levelId: 'L01', levelVersion: 'v2' });
  assert.equal(c.stats.levels.L01.levelVersion, 'v2');
  assert.throws(() => c.event('hint', { tier: 4 }), /tier/);
  assert.throws(() => c.event('invalid'), /event/);
  setTime(Infinity); assert.throws(() => c.tick(), /finite/);
  assert.equal(c.stats.activeMs, 0);
  const bad = api.createStats(); bad.activeMs = NaN;
  assert.throws(() => clock({ stats: bad }), /stats/);
});

test('noninteractive context and nonowner intervals have distinct ledgers', () => {
  const { instance: c, advance } = clock();
  c.setContext({ mode: 'play', levelId: 'L01' });
  advance(1000);
  for (const mode of ['pause', 'hidden', 'menu', 'loading', 'result']) {
    c.setContext({ mode }); advance(2000);
    assert.equal(c.stats[`${mode}Ms`], 2000, mode);
  }
  c.setContext({ mode: 'play', owner: false }); advance(3000);
  assert.equal(c.stats.nonOwnerMs, 3000);
  assert.equal(c.stats.activeMs, 1000);
  c.setContext({ owner: true }); advance(1000);
  assert.equal(c.stats.activeMs, 2000);
});
