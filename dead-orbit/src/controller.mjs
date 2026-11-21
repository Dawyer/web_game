/**
 * controller.mjs — 无 DOM 局状态机。编排 engine / timing / persistence。
 * 所有公开方法返回 { ok, events[], ... } 供 app 层渲染与播音，不直接碰 DOM。
 */

import * as E from './engine.mjs';
import { currentGoal, ITEMS, HOTSPOTS } from './levels.mjs';
import { PlayClock } from './timing.mjs';

/**
 * @param {object} deps
 *   deps.save      当前存档（会被原地更新 state/stats）
 *   deps.now       单调时钟
 *   deps.automated 是否自动回放
 */
export class GameController {
  constructor({ save, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), automated = false }) {
    this.save = save;
    this.state = save.state;
    this.stats = save.stats;
    this.automated = automated;
    if (this.stats.automated !== automated) this.stats.automated = automated;
    this.clock = new PlayClock(this.stats, now);
    this.selectedItem = null;      // UI 选中态（不进存档）
    this.lastMessage = '';
    this.lastNarrative = null;
    this.pendingEvents = [];       // 供 app 消费的事件队列（音效/动效）
    this.started = false;
  }

  /** 开始对局：启动时钟、进入 play 上下文、记一次 attempt。 */
  start() {
    if (this.started) return;
    this.started = true;
    this.clock.start();
    this.clock.setContext('play');
    this.clock.eventAttempt();
    this.push('start');
  }

  /** 把 engine 结果合并进状态，收集新线索事件。 */
  applyResult(result, extraEvents = []) {
    if (result.state) this.state = result.state;
    this.save.state = this.state;
    if (result.newClues?.length) {
      for (const id of result.newClues) this.push('clue', { id });
    }
    for (const e of extraEvents) this.push(e[0], e[1] || {});
    if (result.text) this.lastMessage = result.text;
    if (result.narrative) this.lastNarrative = result.narrative;
    return result;
  }

  push(type, data = {}) { this.pendingEvents.push({ type, ...data }); }

  /** 取出并清空事件队列。 */
  drainEvents() {
    const e = this.pendingEvents;
    this.pendingEvents = [];
    return e;
  }

  /** 查看热点。 */
  inspect(id) {
    if (!HOTSPOTS[id]) return { ok: false, text: '这里没什么可看的。' };
    const r = E.inspect(this.state, id);
    // 若当前选中道具，优先视为「使用道具于该热点」
    if (this.selectedItem) return this.useSelectedOn(id, r);
    this.applyResult(r);
    this.push('inspect', { id });
    this.clock.activity();
    return { ok: true, text: r.text, newClues: r.newClues || [] };
  }

  /** 选中/取消选中道具。 */
  selectItem(id) {
    if (!this.state.inventory.includes(id)) return { ok: false };
    this.selectedItem = this.selectedItem === id ? null : id;
    this.push('select', { id, selected: !!this.selectedItem });
    this.clock.activity();
    return { ok: true, selected: this.selectedItem };
  }

  /** 取消当前选择。 */
  cancelSelection() {
    const had = !!this.selectedItem;
    this.selectedItem = null;
    if (had) this.push('cancel');
    return had;
  }

  /** 拾取道具（点热点里可直接拿的东西）。 */
  pickup(itemId) {
    const r = E.pickup(this.state, itemId);
    this.applyResult(r);
    if (r.ok) this.push('pickup', { id: itemId });
    this.clock.activity();
    return { ok: r.ok, text: r.text };
  }

  /** 把当前选中道具用于目标热点。 */
  useSelectedOn(targetId) {
    const itemId = this.selectedItem;
    this.selectedItem = null;
    const r = E.useItem(this.state, itemId, targetId);
    this.applyResult(r);
    if (r.ok) {
      this.push('use', { itemId, targetId, event: r.event });
      if (r.narrative) this.push('narrative', { text: r.narrative });
    } else {
      this.push('invalid', { text: r.text });
    }
    this.clock.activity();
    return { ok: r.ok, text: r.text, narrative: r.narrative };
  }

  /** 直接用道具（供自动回放/测试；不需要先选中）。 */
  useItem(itemId, targetId) {
    const r = E.useItem(this.state, itemId, targetId);
    this.applyResult(r);
    if (r.ok) {
      this.push('use', { itemId, targetId, event: r.event });
      if (r.narrative) this.push('narrative', { text: r.narrative });
    }
    this.clock.activity();
    return { ok: r.ok, text: r.text, narrative: r.narrative };
  }

  /** 数字键盘输入。 */
  inputDigit(d) {
    const before = this.state.codeInput.length;
    const r = E.inputDigit(this.state, d);
    this.state = r.state;
    this.save.state = this.state;
    if (this.state.codeInput.length !== before) this.push('key', { digit: d });
    this.clock.activity();
    return { ok: true, full: r.full };
  }

  backspace() {
    const r = E.backspace(this.state);
    this.state = r.state;
    this.save.state = this.state;
    this.push('backspace');
    this.clock.activity();
    return { ok: true };
  }

  clearInput() {
    const r = E.clearInput(this.state);
    this.state = r.state;
    this.save.state = this.state;
    this.push('clear');
    this.clock.activity();
    return { ok: true };
  }

  /** 提交授权码。 */
  submitCode() {
    const r = E.submitCode(this.state);
    this.state = r.state;
    this.save.state = this.state;
    this.clock.activity();
    if (r.ok) {
      this.clock.eventComplete();
      this.clock.setContext('result');
      this.clock.stop();
      this.push('escape', {});
      if (r.narrative) this.push('narrative', { text: r.narrative });
    } else {
      this.clock.eventFailure();
      this.push('failure', { text: r.text });
    }
    return { ok: r.ok, text: r.text, narrative: r.narrative };
  }

  /** 取提示。 */
  hint() {
    const r = E.hint(this.state);
    this.state = r.state;
    this.save.state = this.state;
    this.clock.eventHint();
    this.clock.activity();
    this.push('hint', { goal: r.goal, tier: r.tier, text: r.text });
    return { ok: true, goal: r.goal, tier: r.tier, text: r.text };
  }

  /** 当前提示目标。 */
  currentGoal() { return currentGoal(this.state); }

  /** 建议高亮的热点（首屏 30 秒引导用）。 */
  suggestHotspot() {
    const g = this.currentGoal();
    if (g === 'locker') return 'locker';
    if (g === 'seat') return 'seat';
    if (g === 'toolbox') return 'toolbox';
    if (g === 'useBattery') return 'nav';
    if (g === 'useStarchart') return 'porthole';
    if (g === 'useFuse') return 'lifesupport';
    if (g === 'code') return 'console';
    return null;
  }

  /** 上下文切换（app 层在暂停/后台/菜单时调用）。 */
  setContext(ctx) { this.clock.setContext(ctx); }

  /** 有效时长。 */
  activeMs() { return this.clock.activeMs(); }

  /** 记录手动重开。 */
  noteRestart() { this.clock.eventRestart(); }

  /** 当前状态快照（只读引用，app 渲染用）。 */
  snapshot() {
    return {
      state: this.state,
      stats: this.stats,
      selectedItem: this.selectedItem,
      goal: this.currentGoal(),
      suggest: this.suggestHotspot(),
      complete: E.isComplete(this.state)
    };
  }
}
