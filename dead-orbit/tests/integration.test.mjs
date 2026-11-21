import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../src/controller.mjs';
import { createSave } from '../src/persistence.mjs';
import { AUTHORIZATION_CODE, currentGoal } from '../src/levels.mjs';

/** 用控制器完整走一遍（模拟「点道具→点目标」）。 */
function playThrough(c) {
  c.start();
  c.inspect('locker'); c.pickup('battery');
  c.selectItem('battery'); c.inspect('nav');
  c.pickup('starchart');
  c.selectItem('starchart'); c.inspect('porthole');
  c.pickup('fuse');
  c.selectItem('fuse');
  const r = c.inspect('lifesupport');
  return r;
}

test('完整通关：找齐道具→读线索→输入授权码→逃脱', () => {
  const save = createSave();
  const c = new GameController({ save, now: () => 1000 });
  const r = playThrough(c);
  assert.ok(r.narrative, '供电恢复应触发录音');
  assert.equal(c.currentGoal(), 'code');
  for (const d of AUTHORIZATION_CODE) c.inputDigit(d);
  const sub = c.submitCode();
  assert.equal(sub.ok, true);
  assert.equal(c.snapshot().complete, true);
  assert.equal(save.state.flags.escaped, true);
  assert.equal(save.stats.completed, true);
});

test('错误授权码不锁死，可继续输入正确码', () => {
  const save = createSave();
  const c = new GameController({ save, now: () => 1000 });
  playThrough(c);
  for (const d of '999999') c.inputDigit(d);
  const bad = c.submitCode();
  assert.equal(bad.ok, false);
  assert.equal(save.state.flags.escaped, false);
  assert.equal(save.stats.failures, 1);
  for (const d of AUTHORIZATION_CODE) c.inputDigit(d);
  assert.equal(c.submitCode().ok, true);
});

test('提示按进度给出对应目标', () => {
  const c = new GameController({ save: createSave(), now: () => 1000 });
  assert.equal(c.hint().goal, 'locker');
  c.pickup('battery');
  assert.equal(c.hint().goal, 'useBattery');
  c.useItem('battery', 'nav');
  assert.equal(c.hint().goal, 'seat');
});

test('建议高亮热点随进度推进', () => {
  const c = new GameController({ save: createSave(), now: () => 1000 });
  assert.equal(c.suggestHotspot(), 'locker');
  c.pickup('battery');
  assert.equal(c.suggestHotspot(), 'nav');
  c.useItem('battery', 'nav');
  assert.equal(c.suggestHotspot(), 'seat');
});

test('选中道具后点错误目标：不消耗道具、给出提示', () => {
  const c = new GameController({ save: createSave(), now: () => 1000 });
  c.pickup('battery');
  c.selectItem('battery');
  const r = c.inspect('porthole');
  assert.equal(r.ok, false);
  assert.ok(c.state.inventory.includes('battery'));
  assert.equal(c.selectedItem, null);
});

test('事件队列可被消费且清空', () => {
  const c = new GameController({ save: createSave(), now: () => 1000 });
  c.start();
  c.pickup('battery');
  const events = c.drainEvents();
  assert.ok(events.some(e => e.type === 'pickup'));
  assert.ok(events.some(e => e.type === 'clue'));
  assert.equal(c.drainEvents().length, 0);
});

test('自动回放统计单独记账', () => {
  const save = createSave();
  const c = new GameController({ save, now: () => 1000, automated: true });
  assert.equal(save.stats.automated, true);
});

test('进度百分比单调递增至 100', () => {
  const c = new GameController({ save: createSave(), now: () => 1000 });
  const values = [c.snapshot().state && pct(c)];
  c.pickup('battery'); values.push(pct(c));
  c.useItem('battery', 'nav'); values.push(pct(c));
  c.pickup('starchart'); values.push(pct(c));
  c.useItem('starchart', 'porthole'); values.push(pct(c));
  c.pickup('fuse'); values.push(pct(c));
  c.useItem('fuse', 'lifesupport'); values.push(pct(c));
  for (const d of AUTHORIZATION_CODE) c.inputDigit(d);
  c.submitCode(); values.push(pct(c));
  assert.equal(values[values.length - 1], 100);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] >= values[i - 1]);
});

function pct(c) {
  const s = c.state;
  const steps = [s.inventory.includes('battery'), s.flags.navPowered,
    s.inventory.includes('starchart'), s.flags.starchartUsed,
    s.inventory.includes('fuse'), s.flags.fuseFixed, s.flags.escaped];
  return Math.round(steps.filter(Boolean).length / steps.length * 100);
}
