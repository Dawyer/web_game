/**
 * timing.mjs — 有效计时与统计分账。单调时钟，暂停/后台/菜单/挂机不计。
 * 纯逻辑，不碰 DOM；performance.now() 由调用方注入 now()，便于测试。
 */

/** 统计分类。只有 active 计入有效时长，其余都是排除分账。 */
export const CATEGORIES = [
  'activeMs',       // 有效游玩
  'pauseMs',        // 主动暂停
  'hiddenMs',       // 切后台
  'menuMs',         // 菜单/弹窗
  'resultMs',       // 结算页
  'idleMs',         // 挂机（>5 分钟无输入）
  'nonOwnerMs',     // 非 owner 标签页
  'sleepMs'         // 长间隔（>30s，视为休眠，不补有效时间）
];

const IDLE_THRESHOLD = 5 * 60 * 1000;   // 5 分钟无输入视为挂机
const SLEEP_THRESHOLD = 30 * 1000;      // 超过 30s 的 tick 间隔视为休眠

/** 创建一份空统计。 */
export function createStats() {
  const s = {};
  for (const c of CATEGORIES) s[c] = 0;
  Object.assign(s, {
    attempts: 0,        // 进入对局次数
    restarts: 0,        // 手动重开次数
    failures: 0,        // 密码输错次数
    hints: 0,           // 查看提示次数
    completed: false,   // 是否首次通关
    firstClearMs: 0,    // 首次通关时的有效时长
    firstFinishMs: 0,   // 首次完成主线的墙钟有效时长（同 firstClearMs）
    replays: 0,         // 重玩通关次数
    replayMs: 0,        // 重玩累计有效时长
    automated: false    // 本份统计是否来自自动回放
  });
  return s;
}

/** 创建自动回放分账统计。 */
export function createAutomatedStats() {
  const s = createStats();
  s.automated = true;
  return s;
}

/** 校验统计对象结构（供 persistence 复用）。 */
export function validateStats(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  for (const c of CATEGORIES) {
    if (typeof s[c] !== 'number' || !Number.isFinite(s[c]) || s[c] < 0) return false;
  }
  const ints = ['attempts', 'restarts', 'failures', 'hints', 'replays'];
  for (const k of ints) {
    if (!Number.isInteger(s[k]) || s[k] < 0) return false;
  }
  if (typeof s.completed !== 'boolean') return false;
  if (typeof s.automated !== 'boolean') return false;
  for (const k of ['firstClearMs', 'firstFinishMs', 'replayMs']) {
    if (typeof s[k] !== 'number' || !Number.isFinite(s[k]) || s[k] < 0) return false;
  }
  return true;
}

/**
 * PlayClock：把时间按 context 分账。
 * context ∈ 'play' | 'pause' | 'hidden' | 'menu' | 'result' | 'nonOwner'
 */
export class PlayClock {
  /**
   * @param {object} stats 目标统计对象（会被原地累加）
   * @param {() => number} now 单调时钟，默认 performance.now()
   */
  constructor(stats, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.stats = stats;
    this.now = now;
    this.context = 'menu';
    this.last = now();
    this.lastActivity = now();
    this.running = false;
  }

  /** 启动时钟。 */
  start() {
    this.last = this.now();
    this.lastActivity = this.last;
    this.running = true;
  }

  /** 停止时钟（结算后调用）。 */
  stop() {
    this.tick();
    this.running = false;
  }

  /** 切换上下文；切换前先把已流逝时间结算到旧上下文。 */
  setContext(ctx) {
    this.tick();
    this.context = ctx;
  }

  /** 标记一次有效输入，重置挂机计时。 */
  activity() {
    const t = this.now();
    // 先结算从 last 到现在的间隔，避免输入前的时间被算错
    this.tick();
    this.lastActivity = t;
    this.last = t;
  }

  /**
   * 结算从 last 到现在的间隔到当前 context。
   * 规则：>30s 间隔计 sleepMs（不补有效）；play 下 >5 分钟无输入计 idleMs。
   */
  tick() {
    if (!this.running) { this.last = this.now(); return; }
    const t = this.now();
    let delta = t - this.last;
    this.last = t;
    if (delta <= 0) return;
    if (delta > SLEEP_THRESHOLD) {
      this.stats.sleepMs += delta;
      return;
    }
    if (this.context === 'play' && t - this.lastActivity > IDLE_THRESHOLD) {
      this.stats.idleMs += delta;
      return;
    }
    const key = this.context === 'play' ? 'activeMs'
      : this.context === 'pause' ? 'pauseMs'
      : this.context === 'hidden' ? 'hiddenMs'
      : this.context === 'result' ? 'resultMs'
      : this.context === 'nonOwner' ? 'nonOwnerMs'
      : 'menuMs';
    this.stats[key] += delta;
  }

  /** 当前有效时长（毫秒）。 */
  activeMs() {
    this.tick();
    return this.stats.activeMs;
  }

  /** 记录一次失败（密码输错）。 */
  eventFailure() { this.stats.failures += 1; }

  /** 记录一次提示。 */
  eventHint() { this.stats.hints += 1; }

  /** 记录进入对局。 */
  eventAttempt() { this.stats.attempts += 1; }

  /** 记录手动重开。 */
  eventRestart() { this.stats.restarts += 1; }

  /**
   * 记录通关。首次通关写 firstClearMs / firstFinishMs / completed；
   * 之后记 replays / replayMs。
   */
  eventComplete() {
    const ms = this.activeMs();
    if (!this.stats.completed) {
      this.stats.completed = true;
      this.stats.firstClearMs = ms;
      this.stats.firstFinishMs = ms;
    } else {
      this.stats.replays += 1;
      this.stats.replayMs += ms;
    }
  }
}

/** 毫秒转「X 分 Y 秒」中文。 */
export function minutesText(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} 分 ${String(s).padStart(2, '0')} 秒`;
}
