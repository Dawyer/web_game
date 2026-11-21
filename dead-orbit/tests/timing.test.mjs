import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStats, createAutomatedStats, validateStats, PlayClock, minutesText } from '../src/timing.mjs';

/** 可控时钟：now() 返回当前游标。 */
function fakeClock() {
  let t = 0;
  return { now: () => t, advance: ms => { t += ms; } };
}

test('新统计结构合法，自动回放单独标记', () => {
  assert.equal(validateStats(createStats()), true);
  assert.equal(createAutomatedStats().automated, true);
});

test('validateStats 拒绝非法值', () => {
  const s = createStats();
  assert.equal(validateStats(s), true);
  const a = { ...s, activeMs: -1 };
  assert.equal(validateStats(a), false);
  const b = { ...s, attempts: 1.5 };
  assert.equal(validateStats(b), false);
  assert.equal(validateStats(null), false);
});

test('play 上下文时间计入 active', () => {
  const s = createStats();
  const f = fakeClock();
  const c = new PlayClock(s, f.now);
  c.start();
  c.setContext('play');
  f.advance(1000);
  assert.equal(c.activeMs(), 1000);
  assert.equal(s.activeMs, 1000);
});

test('暂停/后台/菜单/结算分账，不计入 active', () => {
  const s = createStats();
  const f = fakeClock();
  const c = new PlayClock(s, f.now);
  c.start();
  for (const [ctx, key] of [['pause', 'pauseMs'], ['hidden', 'hiddenMs'], ['menu', 'menuMs'], ['result', 'resultMs'], ['nonOwner', 'nonOwnerMs']]) {
    c.setContext(ctx);
    f.advance(1000);
    c.tick();
    assert.equal(s[key], 1000, `${ctx} 未计入 ${key}`);
  }
  assert.equal(s.activeMs, 0);
});

test('超过 30s 的间隔计 sleepMs，不补有效时间', () => {
  const s = createStats();
  const f = fakeClock();
  const c = new PlayClock(s, f.now);
  c.start();
  c.setContext('play');
  f.advance(60 * 1000);
  c.tick();
  assert.equal(s.sleepMs, 60 * 1000);
  assert.equal(s.activeMs, 0);
});

test('play 下超过 5 分钟无输入计 idleMs', () => {
  const s = createStats();
  const f = fakeClock();
  const c = new PlayClock(s, f.now);
  c.start();
  c.setContext('play');
  // 前 5 分钟仍算有效（分段推进，每段 <30s 避免被判 sleep）
  for (let i = 0; i < 10; i++) { f.advance(29 * 1000); c.tick(); }
  assert.equal(s.activeMs, 290000);
  assert.equal(s.idleMs, 0);
  // 超过 5 分钟后计挂机
  for (let i = 0; i < 2; i++) { f.advance(29 * 1000); c.tick(); }
  assert.ok(s.idleMs > 0, '挂机时间应计入 idleMs');
});

test('activity() 重置挂机计时', () => {
  const s = createStats();
  const f = fakeClock();
  const c = new PlayClock(s, f.now);
  c.start();
  c.setContext('play');
  // 推进超过 5 分钟，产生挂机时间
  for (let i = 0; i < 12; i++) { f.advance(29 * 1000); c.tick(); }
  const idleBefore = s.idleMs;
  assert.ok(idleBefore > 0);
  // activity() 后，新的一段时间重新计有效，不再计挂机
  c.activity();
  f.advance(1000); c.tick();
  assert.equal(s.idleMs, idleBefore, 'activity 后不应继续计挂机');
  assert.ok(s.activeMs > 290000, 'activity 后的时间应计有效');
});

test('首次通关与重玩分账', () => {
  const s = createStats();
  const f = fakeClock();
  const c = new PlayClock(s, f.now);
  c.start(); c.setContext('play');
  f.advance(5000);
  c.eventComplete();
  assert.equal(s.completed, true);
  assert.equal(s.firstClearMs, 5000);
  assert.equal(s.replays, 0);
  // 重玩
  f.advance(3000);
  c.eventComplete();
  assert.equal(s.replays, 1);
  assert.equal(s.replayMs, 8000);
  assert.equal(s.firstClearMs, 5000);
});

test('事件计数：失败/提示/尝试/重开', () => {
  const s = createStats();
  const c = new PlayClock(s, () => 0);
  c.eventAttempt(); c.eventFailure(); c.eventHint(); c.eventRestart();
  assert.equal(s.attempts, 1);
  assert.equal(s.failures, 1);
  assert.equal(s.hints, 1);
  assert.equal(s.restarts, 1);
});

test('minutesText 格式化', () => {
  assert.equal(minutesText(0), '0 分 00 秒');
  assert.equal(minutesText(65000), '1 分 05 秒');
  assert.equal(minutesText(600000), '10 分 00 秒');
});
