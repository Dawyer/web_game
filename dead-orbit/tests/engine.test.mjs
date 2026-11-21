import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.mjs';
import { AUTHORIZATION_CODE, ITEMS, COMBINATIONS, currentGoal, HINTS } from '../src/levels.mjs';

function solvedPreCode() {
  let s = E.createState();
  s = E.inspect(s, 'locker').state;
  s = E.pickup(s, 'battery').state;
  s = E.useItem(s, 'battery', 'nav').state;
  s = E.pickup(s, 'starchart').state;
  s = E.useItem(s, 'starchart', 'porthole').state;
  s = E.pickup(s, 'fuse').state;
  return E.useItem(s, 'fuse', 'lifesupport').state;
}

test('初始状态干净，目标从储物柜开始', () => {
  const s = E.createState();
  assert.deepEqual(s.inventory, []);
  assert.equal(s.flags.escaped, false);
  assert.equal(currentGoal(s), 'locker');
  assert.equal(E.progressPercent(s), 0);
});

test('三件道具各有唯一用途，错误组合不消耗道具', () => {
  let s = E.createState();
  s = E.pickup(s, 'battery').state;
  const bad = E.useItem(s, 'battery', 'porthole');
  assert.equal(bad.ok, false);
  assert.match(bad.text, /用不上/);
  assert.deepEqual(bad.state.inventory, ['battery']);
  assert.equal(bad.state.flags.navPowered, false);
});

test('每件道具只能拾取一次', () => {
  let s = E.createState();
  s = E.pickup(s, 'battery').state;
  const again = E.pickup(s, 'battery');
  assert.equal(again.ok, false);
  assert.equal(again.state.inventory.length, 1);
});

test('有效组合推进对应 flag，重复用同一组合被拒', () => {
  let s = E.createState();
  s = E.pickup(s, 'battery').state;
  const r = E.useItem(s, 'battery', 'nav');
  assert.equal(r.ok, true);
  assert.equal(r.state.flags.navPowered, true);
  const again = E.useItem(r.state, 'battery', 'nav');
  assert.equal(again.ok, false);
});

test('供电恢复触发船长录音，且只触发一次', () => {
  let s = solvedPreCode();
  const r = E.useItem(
    (() => { let t = E.createState(); t = E.pickup(t, 'fuse').state; return t; })(),
    'fuse', 'lifesupport'
  );
  assert.ok(r.narrative);
  assert.match(r.narrative, /小满|对不起|感染/);
  const again = E.useItem(r.state, 'fuse', 'lifesupport');
  assert.ok(!again.narrative);
  // solvedPreCode 里录音也已触发
  assert.equal(s.flags.recordingPlayed, true);
});

test('线索随进度逐步发现，全部关键线索齐备', () => {
  const s = solvedPreCode();
  for (const id of ['crewList', 'navWarning', 'logRule', 'beacons', 'lifeReadings', 'crewStatus', 'checksumRule']) {
    assert.ok(s.discoveredClues.includes(id), `缺少线索 ${id}`);
  }
});

test('授权码唯一：正确码通过，错误码只报错不锁死', () => {
  let s = solvedPreCode();
  // 错误码
  for (const d of '000000') s = E.inputDigit(s, d).state;
  const bad = E.submitCode(s);
  assert.equal(bad.ok, false);
  assert.equal(bad.state.flags.escaped, false);
  assert.equal(bad.state.codeError, true);
  assert.equal(bad.state.codeInput, '');
  s = bad.state; // 关键：错误码提交后状态已清空输入，须推进到新状态
  // 正确码
  for (const d of AUTHORIZATION_CODE) s = E.inputDigit(s, d).state;
  const good = E.submitCode(s);
  assert.equal(good.ok, true);
  assert.equal(good.state.flags.escaped, true);
  assert.ok(good.narrative);
  assert.match(good.narrative, /替我看看那边的天/);
});

test('输入最多六位，退格与清空正确', () => {
  let s = E.createState();
  for (const d of '1234567') s = E.inputDigit(s, d).state;
  assert.equal(s.codeInput, '123456');
  s = E.backspace(s).state;
  assert.equal(s.codeInput, '12345');
  s = E.clearInput(s).state;
  assert.equal(s.codeInput, '');
});

test('非数字输入被忽略', () => {
  const s = E.createState();
  assert.equal(E.inputDigit(s, 'x').state.codeInput, '');
  assert.equal(E.inputDigit(s, '').state.codeInput, '');
});

test('三层提示逐层升级并封顶，目标变化后重置', () => {
  let s = E.createState();
  let h = E.hint(s);
  assert.equal(h.tier, 1);
  assert.equal(h.goal, 'locker');
  s = h.state;
  h = E.hint(s); s = h.state; assert.equal(h.tier, 2);
  h = E.hint(s); s = h.state; assert.equal(h.tier, 3);
  h = E.hint(s); s = h.state; assert.equal(h.tier, 3); // 封顶
  // 目标推进后重置
  s = E.pickup(s, 'battery').state;
  h = E.hint(s);
  assert.equal(h.goal, 'useBattery');
  assert.equal(h.tier, 1);
});

test('每个目标都有三层提示文案', () => {
  const goals = ['locker', 'useBattery', 'seat', 'useStarchart', 'toolbox', 'useFuse', 'code', 'done'];
  for (const g of goals) {
    assert.equal(HINTS[g].length, 3, `${g} 提示层数不足`);
    assert.ok(HINTS[g].every(x => typeof x === 'string' && x.length > 0));
  }
});

test('授权码校验位规则自洽', () => {
  const first5 = AUTHORIZATION_CODE.slice(0, 5).split('').reduce((a, d) => a + Number(d), 0);
  assert.equal(Number(AUTHORIZATION_CODE[5]), first5 % 10);
});

test('道具与组合表一一对应，无摆设', () => {
  const usedTargets = new Set(Object.keys(COMBINATIONS).map(k => k.split('>')[1]));
  for (const item of Object.values(ITEMS)) {
    assert.equal(COMBINATIONS[`${item.id}>${item.useOn}`]?.flag !== undefined, true, `${item.id} 无有效用途`);
    assert.ok(usedTargets.has(item.useOn));
  }
});
