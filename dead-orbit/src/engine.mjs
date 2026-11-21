/**
 * engine.mjs — 纯规则引擎：无 DOM、无 localStorage、无随机。
 * 所有状态转移都是纯函数，返回新状态；controller 负责编排与持久化。
 */

import {
  ITEMS, COMBINATIONS, HOTSPOTS, CLUES, NARRATIVE, HINTS,
  AUTHORIZATION_CODE, currentGoal
} from './levels.mjs';

/** 创建一个全新的初始局面。 */
export function createState() {
  return {
    inventory: [],          // 已拾取道具 id 列表
    flags: {
      introSeen: false,
      navPowered: false,
      starchartUsed: false,
      fuseFixed: false,
      recordingPlayed: false,
      escaped: false
    },
    discoveredClues: [],    // 已加入线索簿的线索 id
    viewedHotspots: [],     // 已查看过的热点 id（用于引导高亮）
    codeInput: '',          // 控制台当前输入（最多 6 位）
    codeError: false,       // 上次校验是否失败
    hintTier: 0,            // 当前目标已解锁的提示层数 0..3
    hintGoal: null          // 提示对应的目标（目标变化时重置 tier）
  };
}

/** 深拷贝状态（结构只有数组与扁平对象，够用且快）。 */
export function cloneState(s) {
  return {
    inventory: [...s.inventory],
    flags: { ...s.flags },
    discoveredClues: [...s.discoveredClues],
    viewedHotspots: [...s.viewedHotspots],
    codeInput: s.codeInput,
    codeError: s.codeError,
    hintTier: s.hintTier,
    hintGoal: s.hintGoal
  };
}

/**
 * 查看热点。返回 { state, text, newClues[], event }。
 * 查看会把热点标记为已看，并把该热点可发现的线索加入线索簿。
 */
export function inspect(s, hotspotId) {
  const hs = HOTSPOTS[hotspotId];
  if (!hs) return { state: s, text: '这里没什么可看的。', newClues: [], event: null };

  const next = cloneState(s);
  if (!next.viewedHotspots.includes(hotspotId)) next.viewedHotspots.push(hotspotId);
  if (!next.flags.introSeen) next.flags.introSeen = true;

  const newClues = [];
  for (const [clueId, clue] of Object.entries(CLUES)) {
    if (clue.when(next) && !next.discoveredClues.includes(clueId)) {
      next.discoveredClues.push(clueId);
      newClues.push(clueId);
    }
  }
  return { state: next, text: hs.text(next), newClues, event: 'inspect' };
}

/**
 * 拾取道具。返回 { state, ok, text, event }。
 * 道具必须存在于该热点且尚未拾取。
 */
export function pickup(s, itemId) {
  const item = ITEMS[itemId];
  if (!item) return { state: s, ok: false, text: '这里没有可拿的东西。', event: null };
  if (s.inventory.includes(itemId)) return { state: s, ok: false, text: '你已经拿过它了。', event: null };

  const next = cloneState(s);
  next.inventory.push(itemId);
  if (!next.flags.introSeen) next.flags.introSeen = true;

  const newClues = [];
  for (const [clueId, clue] of Object.entries(CLUES)) {
    if (clue.when(next) && !next.discoveredClues.includes(clueId)) {
      next.discoveredClues.push(clueId);
      newClues.push(clueId);
    }
  }
  return { state: next, ok: true, text: `拾取：${item.name}。${item.desc}`, newClues, event: 'pickup' };
}

/**
 * 使用道具于热点。返回 { state, ok, text, event, narrative? }。
 * 只有 COMBINATIONS 中登记的组合有效，其余一律「用不上」，不消耗道具。
 */
export function useItem(s, itemId, targetId) {
  const key = `${itemId}>${targetId}`;
  const combo = COMBINATIONS[key];
  if (!combo) {
    return { state: s, ok: false, text: '这里用不上。', event: null };
  }
  if (!s.inventory.includes(itemId)) {
    return { state: s, ok: false, text: '你还没有这件道具。', event: null };
  }
  if (s.flags[combo.flag]) {
    return { state: s, ok: false, text: '这里已经处理过了。', event: null };
  }

  const next = cloneState(s);
  next.flags[combo.flag] = true;
  const newClues = [];
  for (const [clueId, clue] of Object.entries(CLUES)) {
    if (clue.when(next) && !next.discoveredClues.includes(clueId)) {
      next.discoveredClues.push(clueId);
      newClues.push(clueId);
    }
  }

  // 供电恢复时触发船长录音（只触发一次）
  let narrative = null;
  if (combo.flag === 'fuseFixed' && !next.flags.recordingPlayed) {
    next.flags.recordingPlayed = true;
    narrative = NARRATIVE.recording;
  }
  return { state: next, ok: true, text: combo.text, newClues, event: combo.event, narrative };
}

/** 数字键盘输入一位。返回 { state, full }。 */
export function inputDigit(s, digit) {
  if (!/^[0-9]$/.test(String(digit))) return { state: s, full: false };
  if (s.flags.escaped) return { state: s, full: false };
  const next = cloneState(s);
  if (next.codeInput.length >= 6) return { state: s, full: true };
  next.codeInput += String(digit);
  next.codeError = false;
  return { state: next, full: next.codeInput.length === 6 };
}

/** 退格。 */
export function backspace(s) {
  if (!s.codeInput) return { state: s };
  const next = cloneState(s);
  next.codeInput = next.codeInput.slice(0, -1);
  next.codeError = false;
  return { state: next };
}

/** 清空输入。 */
export function clearInput(s) {
  const next = cloneState(s);
  next.codeInput = '';
  next.codeError = false;
  return { state: next };
}

/**
 * 校验授权码。返回 { state, ok, text, narrative? }。
 * 错误只标记 codeError 并清空输入，不锁死、不扣次数。
 */
export function submitCode(s) {
  if (s.flags.escaped) return { state: s, ok: false, text: '授权已完成。' };
  if (s.codeInput.length !== 6) return { state: s, ok: false, text: '请输入完整的六位授权码。' };

  const next = cloneState(s);
  if (next.codeInput === AUTHORIZATION_CODE) {
    next.flags.escaped = true;
    next.codeError = false;
    next.codeInput = '';
    return { state: next, ok: true, text: '授权通过。', narrative: NARRATIVE.ending };
  }
  next.codeError = true;
  next.codeInput = '';
  return { state: next, ok: false, text: '授权失败，请核对。' };
}

/**
 * 取提示。返回 { state, goal, tier, text }。
 * 目标变化则 tier 归零；同一目标逐层升级到 3 层封顶。
 */
export function hint(s) {
  const goal = currentGoal(s);
  const next = cloneState(s);
  if (next.hintGoal !== goal) {
    next.hintGoal = goal;
    next.hintTier = 0;
  }
  next.hintTier = Math.min(next.hintTier + 1, 3);
  const tiers = HINTS[goal] || HINTS.done;
  return { state: next, goal, tier: next.hintTier, text: tiers[next.hintTier - 1] };
}

/** 当前局是否已完成。 */
export function isComplete(s) {
  return s.flags.escaped;
}

/** 统计提示次数（供 timing 记录用，从 hintTier 无法还原总次数，controller 单独计数）。 */
export function progressPercent(s) {
  const steps = [
    s.inventory.includes('battery'), s.flags.navPowered,
    s.inventory.includes('starchart'), s.flags.starchartUsed,
    s.inventory.includes('fuse'), s.flags.fuseFixed, s.flags.escaped
  ];
  return Math.round(steps.filter(Boolean).length / steps.length * 100);
}
