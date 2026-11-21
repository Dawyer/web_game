/**
 * persistence.mjs — localStorage 存档：严格字段白名单校验、版本迁移、坏档备份、导入导出。
 * 纯逻辑，storage 由调用方注入（浏览器传 localStorage，测试传 Map 适配器）。
 */

import { CONTENT_VERSION } from './levels.mjs';
import { createState, cloneState } from './engine.mjs';
import { createStats, validateStats } from './timing.mjs';

export const SAVE_KEY = 'dead-orbit.save';
export const BACKUP_KEY = 'dead-orbit.save.backup';
export const OWNER_KEY = 'dead-orbit.owner';
export const SCHEMA = 1;

/** 创建一份全新存档。 */
export function createSave() {
  return {
    schema: SCHEMA,
    version: CONTENT_VERSION,
    state: createState(),
    stats: createStats(),
    settings: { muted: false, reducedMotion: false, layout: 'auto' }
  };
}

/** 校验局面状态（结构 + 值域）。 */
export function validateState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  if (!Array.isArray(s.inventory) || s.inventory.some(x => typeof x !== 'string')) return false;
  const validItems = ['battery', 'starchart', 'fuse'];
  if (s.inventory.some(x => !validItems.includes(x))) return false;
  if (new Set(s.inventory).size !== s.inventory.length) return false;

  if (!s.flags || typeof s.flags !== 'object') return false;
  const flagKeys = ['introSeen', 'navPowered', 'starchartUsed', 'fuseFixed', 'recordingPlayed', 'escaped'];
  for (const k of flagKeys) if (typeof s.flags[k] !== 'boolean') return false;

  if (!Array.isArray(s.discoveredClues) || s.discoveredClues.some(x => typeof x !== 'string')) return false;
  if (!Array.isArray(s.viewedHotspots) || s.viewedHotspots.some(x => typeof x !== 'string')) return false;
  if (typeof s.codeInput !== 'string' || !/^[0-9]{0,6}$/.test(s.codeInput)) return false;
  if (typeof s.codeError !== 'boolean') return false;
  if (!Number.isInteger(s.hintTier) || s.hintTier < 0 || s.hintTier > 3) return false;
  if (s.hintGoal !== null && typeof s.hintGoal !== 'string') return false;
  return true;
}

/** 校验设置。 */
export function validateSettings(x) {
  if (!x || typeof x !== 'object') return false;
  if (typeof x.muted !== 'boolean') return false;
  if (typeof x.reducedMotion !== 'boolean') return false;
  if (!['auto', 'desktop', 'mobile'].includes(x.layout)) return false;
  return true;
}

/** 完整存档校验。 */
export function validateSave(save) {
  if (!save || typeof save !== 'object') return false;
  if (!Number.isInteger(save.schema) || save.schema < 1) return false;
  if (typeof save.version !== 'string') return false;
  if (!validateState(save.state)) return false;
  if (!validateStats(save.stats)) return false;
  if (!validateSettings(save.settings)) return false;
  return true;
}

/** 已知版本迁移。当前只有 schema 1；保留钩子以便将来升级。 */
export function migrateKnown(save) {
  if (!save || typeof save !== 'object') return null;
  if (!Number.isInteger(save.schema)) return null;
  // schema 1 → 1：内容版本不同但结构相同，只更新版本号
  if (save.schema === 1 && validateSave(save)) {
    return { ...save, version: CONTENT_VERSION };
  }
  return null;
}

/** 读取存档。返回 { save, status, raw }：status ∈ ok | empty | migrated | corrupt。 */
export function loadSave(storage) {
  let raw;
  try { raw = storage.getItem(SAVE_KEY); } catch { return { save: createSave(), status: 'empty', raw: null }; }
  if (!raw) return { save: createSave(), status: 'empty', raw: null };

  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    retainBackup(storage, raw);
    return { save: createSave(), status: 'corrupt', raw };
  }

  if (parsed.version === CONTENT_VERSION && validateSave(parsed)) return { save: parsed, status: 'ok', raw };
  const migrated = migrateKnown(parsed);
  if (migrated && validateSave(migrated)) return { save: migrated, status: 'migrated', raw };

  retainBackup(storage, raw);
  return { save: createSave(), status: 'corrupt', raw };
}

/** 保留坏档原文备份（不覆盖已有备份，除非为空）。 */
export function retainBackup(storage, raw) {
  try {
    if (!storage.getItem(BACKUP_KEY)) storage.setItem(BACKUP_KEY, raw);
  } catch { /* 存储不可用时静默 */ }
}

/** 写入存档；写后回读校验，失败返回 false。 */
export function persistSave(storage, save) {
  if (!validateSave(save)) return false;
  try {
    const json = JSON.stringify(save);
    storage.setItem(SAVE_KEY, json);
    return storage.getItem(SAVE_KEY) === json;
  } catch { return false; }
}

/** 重置当前局（保留设置与累计统计的 completed 标记由调用方决定）。 */
export function resetCurrent(save) {
  const next = createSave();
  next.settings = { ...save.settings };
  return next;
}

/** 导出存档为 JSON 字符串。 */
export function exportSave(save) {
  return JSON.stringify(save);
}

/** 导入存档字符串。返回 { save, ok }。 */
export function importSave(text) {
  try {
    const parsed = JSON.parse(text);
    if (!validateSave(parsed)) return { save: null, ok: false };
    return { save: parsed, ok: true };
  } catch { return { save: null, ok: false }; }
}

/**
 * OwnerLease：多标签页防重复计时/写档。
 * storage 需支持 getItem/setItem/removeItem；id 为本标签页唯一标识。
 */
export class OwnerLease {
  constructor(storage, id, ttl = 7000) {
    this.storage = storage;
    this.id = id;
    this.ttl = ttl;
  }

  /** 尝试取得或续租 owner。 */
  acquire(now = Date.now()) {
    try {
      const raw = this.storage.getItem(OWNER_KEY);
      if (raw) {
        const owner = JSON.parse(raw);
        if (owner.id !== this.id && now - owner.ts < this.ttl) return false;
      }
      this.storage.setItem(OWNER_KEY, JSON.stringify({ id: this.id, ts: now }));
      return true;
    } catch { return true; }
  }

  /** 是否仍为 owner。 */
  isOwner(now = Date.now()) {
    try {
      const raw = this.storage.getItem(OWNER_KEY);
      if (!raw) return false;
      const owner = JSON.parse(raw);
      return owner.id === this.id && now - owner.ts < this.ttl;
    } catch { return false; }
  }

  /** 释放 owner（仅当自己是 owner）。 */
  release() {
    try {
      const raw = this.storage.getItem(OWNER_KEY);
      if (raw && JSON.parse(raw).id === this.id) this.storage.removeItem(OWNER_KEY);
    } catch { /* 静默 */ }
  }
}

/** 内存 storage 适配器（测试用）。 */
export function memoryStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m
  };
}

/** 深拷贝存档（避免共享引用）。 */
export function cloneSave(save) {
  return {
    schema: save.schema,
    version: save.version,
    state: cloneState(save.state),
    stats: { ...save.stats },
    settings: { ...save.settings }
  };
}
