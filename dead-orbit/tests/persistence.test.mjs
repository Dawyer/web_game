import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSave, validateSave, validateState, validateSettings, loadSave, persistSave,
  retainBackup, resetCurrent, exportSave, importSave, OwnerLease, memoryStorage,
  SAVE_KEY, BACKUP_KEY, SCHEMA
} from '../src/persistence.mjs';
import { validateStats } from '../src/timing.mjs';

test('新存档结构合法', () => {
  const save = createSave();
  assert.equal(validateSave(save), true);
  assert.equal(save.schema, SCHEMA);
  assert.equal(validateState(save.state), true);
  assert.equal(validateStats(save.stats), true);
  assert.equal(validateSettings(save.settings), true);
});

test('存档往返：写入后读回一致', () => {
  const st = memoryStorage();
  const save = createSave();
  save.state.inventory.push('battery');
  save.stats.hints = 3;
  assert.equal(persistSave(st, save), true);
  const r = loadSave(st);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.save.state.inventory, ['battery']);
  assert.equal(r.save.stats.hints, 3);
});

test('空存档返回初始局面', () => {
  const r = loadSave(memoryStorage());
  assert.equal(r.status, 'empty');
  assert.deepEqual(r.save.state.inventory, []);
});

test('非法 JSON 被判坏档，原文保留备份', () => {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, '{not json');
  const r = loadSave(st);
  assert.equal(r.status, 'corrupt');
  assert.equal(st.getItem(BACKUP_KEY), '{not json');
  assert.deepEqual(r.save.state.inventory, []);
});

test('字段非法的存档被拒并备份', () => {
  const st = memoryStorage();
  const bad = createSave();
  bad.state.inventory = ['not-an-item'];
  st.setItem(SAVE_KEY, JSON.stringify(bad));
  const r = loadSave(st);
  assert.equal(r.status, 'corrupt');
  assert.ok(st.getItem(BACKUP_KEY));
});

test('validateState 拒绝越界字段', () => {
  const s = createSave().state;
  assert.equal(validateState(s), true);
  const a = structuredClone(s); a.codeInput = '1234567';
  assert.equal(validateState(a), false);
  const b = structuredClone(s); b.hintTier = 9;
  assert.equal(validateState(b), false);
  const c = structuredClone(s); c.inventory = ['battery', 'battery'];
  assert.equal(validateState(c), false);
  const d = structuredClone(s); d.flags.escaped = 'yes';
  assert.equal(validateState(d), false);
});

test('版本迁移：schema 1 内容版本不同只更新版本号', () => {
  const st = memoryStorage();
  const old = createSave();
  old.version = '0.9.0';
  st.setItem(SAVE_KEY, JSON.stringify(old));
  const r = loadSave(st);
  assert.equal(r.status, 'migrated');
  // migrateKnown 把版本更新为当前 CONTENT_VERSION
  assert.equal(r.save.version, '1.0.0');
  assert.notEqual(r.save.version, '0.9.0');
});

test('persistSave 拒绝非法存档', () => {
  const st = memoryStorage();
  const bad = createSave();
  bad.settings.layout = 'tablet';
  assert.equal(persistSave(st, bad), false);
});

test('导出导入往返', () => {
  const save = createSave();
  save.state.inventory = ['battery', 'fuse'];
  const text = exportSave(save);
  const r = importSave(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.save.state.inventory, ['battery', 'fuse']);
  assert.equal(importSave('garbage').ok, false);
});

test('重置当前局保留设置，统计由调用方决定', () => {
  const save = createSave();
  save.state.inventory.push('battery');
  save.settings.muted = true;
  const next = resetCurrent(save);
  assert.deepEqual(next.state.inventory, []);
  assert.equal(next.settings.muted, true);
});

test('OwnerLease：同一时刻只有一个 owner，可续租与释放', () => {
  const st = memoryStorage();
  const a = new OwnerLease(st, 'A', 1000);
  const b = new OwnerLease(st, 'B', 1000);
  assert.equal(a.acquire(1000), true);
  assert.equal(b.acquire(1000), false);
  assert.equal(a.isOwner(1500), true);
  assert.equal(b.acquire(2500), true); // 租约过期后 B 可抢占
  assert.equal(a.isOwner(2500), false);
  b.release();
  assert.equal(b.isOwner(2500), false);
});
