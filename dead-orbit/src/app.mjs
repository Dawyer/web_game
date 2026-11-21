/**
 * app.mjs — 启动接线：渲染、Pointer Events 输入、键盘、生命周期、存档、自动回放。
 */

import { GameController } from './controller.mjs';
import {
  createSave, loadSave, persistSave, resetCurrent, exportSave, importSave,
  OwnerLease, SAVE_KEY, cloneSave
} from './persistence.mjs';
import { minutesText } from './timing.mjs';
import { NARRATIVE, ITEMS, HOTSPOTS, AUTHORIZATION_CODE, currentGoal } from './levels.mjs';
import * as E from './engine.mjs';
import * as V from './view.mjs';
import { AudioKit } from './audio.mjs';

const params = new URLSearchParams(location.search);
const automated = params.get('automated') === '1';
const layoutOverride = ['desktop', 'mobile'].includes(params.get('layout')) ? params.get('layout') : 'auto';
const reducedMotionParam = params.get('reduced') === '1';

const root = document.documentElement;
let storage = null;
try { storage = window.localStorage; } catch { /* 无存储时降级 */ }
const memFallback = (() => {
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
})();
const store = storage || memFallback;

const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const lease = new OwnerLease(store, tabId);
const audio = new AudioKit();

let save = null;
let controller = null;
let dialog = null;          // 'intro' | 'clues' | 'hint' | 'settings' | 'stats' | 'narrative' | 'ending' | 'pause' | null
let dialogData = null;
let detailText = '';
let currentHotspot = null;
let isOwner = true;
let idleTimer = null;
let lastInputAt = Date.now();
let saveTimer = null;
let introDismissed = false;

/** 应用布局属性。 */
function applyLayout() {
  const layout = V.layoutFor(window.innerWidth, save?.settings.layout || layoutOverride);
  root.dataset.layout = layout;
  root.dataset.reduced = String(!!(save?.settings.reducedMotion || reducedMotionParam));
}

/** 当前是否应显示开场（首次进入且未看过）。 */
function shouldShowIntro() {
  return !save.state.flags.introSeen && !introDismissed && !automated;
}

/** 渲染整页。 */
function render() {
  applyLayout();
  const snap = controller.snapshot();
  const app = document.getElementById('app');
  app.innerHTML = `
    ${V.hudMarkup(snap)}
    <main class="game-main">
      ${V.sceneMarkup(snap)}
      ${V.inventoryMarkup(snap)}
      ${V.detailMarkup(snap, detailText, currentHotspot)}
      ${V.keypadMarkup(snap)}
    </main>
    ${dialogMarkup(snap)}
  `;
  bindDynamic();
}

/** 弹窗内容。 */
function dialogMarkup(snap) {
  if (!dialog && !shouldShowIntro()) return '';
  const d = dialog || (shouldShowIntro() ? 'intro' : null);
  let body = '';
  let title = '';
  if (d === 'intro') {
    title = '静默轨道 · DEAD ORBIT';
    body = `<p class="story">${NARRATIVE.intro}</p>
      <ol class="howto">
        <li>点击场景中的物体查看线索</li>
        <li>点物品栏道具选中，再点场景目标使用</li>
        <li>线索会存进「线索簿」，随时可回看</li>
        <li>推理出六位授权码，在控制台输入并确认</li>
      </ol>
      <p class="small">无倒计时、无死亡。输错不锁死。卡住了点「提示」。</p>`;
  } else if (d === 'clues') {
    title = '线索簿';
    body = V.clueBookMarkup(snap);
  } else if (d === 'hint') {
    title = `提示 · 第 ${dialogData?.tier || 1} 层`;
    body = `<p class="story">${dialogData?.text || ''}</p><p class="small">提示不惩罚，可反复查看。目标推进后提示会重置。</p>`;
  } else if (d === 'settings') {
    title = '设置';
    body = `<div class="setting-list">
      <button data-action="toggle-mute" aria-pressed="${save.settings.muted}">声音：${save.settings.muted ? '静音' : '开启'}</button>
      <button data-action="toggle-motion" aria-pressed="${save.settings.reducedMotion}">减弱动效：${save.settings.reducedMotion ? '开' : '关'}</button>
      <button data-action="toggle-layout">布局：${save.settings.layout === 'auto' ? '自动' : save.settings.layout === 'desktop' ? '电脑' : '手机'}</button>
      <button data-action="stats">游玩统计</button>
      <button data-action="export">导出存档</button>
      <button data-action="import-prompt">导入存档</button>
      <button data-action="reset" class="danger">重置当前局</button>
    </div><p class="small">存档只保存在本浏览器。清理浏览器数据前请先导出。</p>`;
  } else if (d === 'stats') {
    const s = save.stats;
    title = '游玩统计';
    body = `<div class="stats">
      <p>累计有效：<b>${minutesText(s.activeMs)}</b></p>
      <p>首次通关：<b>${s.completed ? minutesText(s.firstClearMs) : '尚未通关'}</b></p>
      <p>重玩通关：<b>${s.replays} 次</b>（累计 ${minutesText(s.replayMs)}）</p>
      <p>进入对局 ${s.attempts} 次 · 重开 ${s.restarts} 次 · 输错 ${s.failures} 次 · 提示 ${s.hints} 次</p>
      <p class="small">暂停、后台、挂机不计入有效时长。${s.automated ? '本份为自动回放统计，不计入真人记录。' : ''}</p>
    </div>`;
  } else if (d === 'narrative') {
    title = '舱内广播';
    body = `<p class="story">${dialogData?.text || ''}</p>`;
  } else if (d === 'ending') {
    title = '脱离轨道';
    body = `<p class="story ending">${NARRATIVE.ending}</p>
      <p class="small">你用了 ${minutesText(save.stats.firstClearMs)} 逃出渡鸦-7。</p>`;
  } else if (d === 'pause') {
    title = '已暂停';
    body = `<p>计时已暂停。继续后才恢复操作与有效计时。</p>`;
  }
  const actions = d === 'intro'
    ? '<button class="primary" data-action="start-game">开始探索</button>'
    : '<button class="primary" data-action="close">返回</button>';
  return `<div class="overlay" id="overlay"><div class="dialog" id="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <h2 id="dialog-title">${title}</h2><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div>
  </div></div>`;
}

/** 事件委托：给动态生成的元素绑点击（Pointer Events 统一鼠标/触屏）。 */
function bindDynamic() {
  document.querySelectorAll('[data-hotspot]').forEach(el => {
    el.addEventListener('pointerdown', onHotspot);
  });
  document.querySelectorAll('[data-item]').forEach(el => {
    el.addEventListener('pointerdown', onItem);
  });
  document.querySelectorAll('[data-digit]').forEach(el => {
    el.addEventListener('pointerdown', onDigit);
  });
}

/** 全局动作委托（一次绑定，覆盖所有 data-action）。 */
function onActionDelegated(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  e.preventDefault();
  handleAction(btn.dataset.action, btn);
}

function onHotspot(e) {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  e.preventDefault();
  const id = e.currentTarget.dataset.hotspot;
  const r = controller.inspect(id);
  currentHotspot = id;
  detailText = r.text || '';
  consumeEvents();
  render();
}

function onItem(e) {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  e.preventDefault();
  controller.selectItem(e.currentTarget.dataset.item);
  consumeEvents();
  render();
}

function onDigit(e) {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  e.preventDefault();
  controller.inputDigit(e.currentTarget.dataset.digit);
  consumeEvents();
  render();
}

/** 处理 data-action。 */
function handleAction(action, btn = null) {
  switch (action) {
    case 'start-game':
      introDismissed = true;
      dialog = null;
      audio.unlock();
      audio.setMuted(save.settings.muted);
      controller.start();
      detailText = NARRATIVE.intro;
      consumeEvents();
      persist();
      render();
      break;
    case 'close':
      dialog = null;
      dialogData = null;
      if (controller && save.state.flags.escaped) dialog = 'ending';
      setPlayContext();
      render();
      break;
    case 'clues':
      dialog = 'clues';
      setMenuContext();
      render();
      break;
    case 'hint': {
      const h = controller.hint();
      dialog = 'hint';
      dialogData = h;
      consumeEvents();
      persist();
      render();
      break;
    }
    case 'settings':
      dialog = 'settings';
      setMenuContext();
      render();
      break;
    case 'stats':
      dialog = 'stats';
      render();
      break;
    case 'toggle-mute':
      save.settings.muted = !save.settings.muted;
      audio.setMuted(save.settings.muted);
      persist(); render();
      break;
    case 'toggle-motion':
      save.settings.reducedMotion = !save.settings.reducedMotion;
      persist(); render();
      break;
    case 'toggle-layout': {
      const order = ['auto', 'desktop', 'mobile'];
      save.settings.layout = order[(order.indexOf(save.settings.layout) + 1) % order.length];
      persist(); render();
      break;
    }
    case 'export': {
      const text = exportSave(save);
      // 用隐藏 textarea + execCommand 兼容无剪贴板 API 的环境
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        detailText = '存档已复制到剪贴板。';
      } catch { detailText = '复制失败，请手动导出。'; }
      render();
      break;
    }
    case 'import-prompt': {
      const text = window.prompt('粘贴之前导出的存档 JSON：');
      if (text) {
        const r = importSave(text);
        if (r.ok) {
          save = r.save;
          controller = new GameController({ save, automated });
          detailText = '存档已导入。';
          dialog = null;
          persist(); render();
        } else {
          detailText = '存档格式无效，未导入。';
          render();
        }
      }
      break;
    }
    case 'reset': {
      if (!window.confirm('重置当前局？已找到的道具和线索会清空，累计统计保留。')) break;
      const keepStats = { ...save.stats };
      save = resetCurrent(save);
      save.stats = keepStats;
      controller = new GameController({ save, automated });
      controller.noteRestart();
      introDismissed = true;
      dialog = null;
      detailText = '';
      persist(); render();
      break;
    }
    case 'pickup': {
      const itemId = btn?.dataset.itemId;
      if (!itemId) break;
      const r = controller.pickup(itemId);
      detailText = r.text || '';
      consumeEvents(); persist(); render();
      break;
    }
    case 'backspace':
      controller.backspace(); consumeEvents(); render();
      break;
    case 'clear':
      controller.clearInput(); consumeEvents(); render();
      break;
    case 'submit': {
      const r = controller.submitCode();
      consumeEvents();
      if (r.ok) {
        dialog = 'ending';
        // 通关是关键时刻，立即落盘，不等节流
        clearTimeout(saveTimer);
        persistSave(store, save);
      } else {
        persist();
      }
      render();
      break;
    }
    case 'pause':
      dialog = 'pause'; setPauseContext(); render();
      break;
    default: break;
  }
}

/** 消费事件队列：播音 + 叙事弹窗。 */
function consumeEvents() {
  const events = controller.drainEvents();
  for (const ev of events) {
    // 音效映射
    const soundMap = { inspect: 'inspect', select: 'select', cancel: 'cancel', pickup: 'pickup', key: 'key',
      backspace: 'backspace', clear: 'clear', failure: 'failure', use: 'use', clue: 'clue', hint: 'hint', escape: 'escape' };
    if (soundMap[ev.type]) audio.play(soundMap[ev.type]);
    if (ev.type === 'use' && ev.event === 'power-on') audio.play('power');
    if (ev.type === 'narrative') {
      dialog = 'narrative';
      dialogData = { text: ev.text };
    }
    if (ev.type === 'escape') {
      dialog = 'ending';
    }
  }
}

function setPlayContext() { if (controller) controller.setContext('play'); }
function setPauseContext() { if (controller) controller.setContext('pause'); }
function setMenuContext() { if (controller) controller.setContext('menu'); }

/** 持久化存档（节流）。 */
function persist() {
  if (!isOwner) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { persistSave(store, save); }, 120);
}

/** 键盘输入。 */
function onKey(e) {
  if (e.key >= '0' && e.key <= '9') {
    if (dialog) return;
    controller.inputDigit(e.key); consumeEvents(); render(); return;
  }
  if (e.key === 'Enter') {
    if (dialog === 'intro') { handleAction('start-game'); return; }
    if (dialog) { handleAction('close'); return; }
    handleAction('submit'); return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    if (!dialog) { controller.backspace(); consumeEvents(); render(); }
    return;
  }
  if (e.key === 'Escape') {
    if (dialog && dialog !== 'intro' && dialog !== 'ending') { handleAction('close'); }
    else if (!dialog) { controller.cancelSelection(); render(); }
    return;
  }
  if (e.key === 'h' || e.key === 'H') { if (!dialog) handleAction('hint'); return; }
  if (e.key === 'j' || e.key === 'J') { if (!dialog) handleAction('clues'); return; }
  if (e.key === 'm' || e.key === 'M') { handleAction('toggle-mute'); return; }
}

/** 生命周期：后台暂停、回前台恢复、存储跨页同步、挂机检测。 */
function bindLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      controller?.setContext('hidden');
      audio.suspend();
      lease.release();
    } else {
      audio.resume();
      reclaimOwner();
      if (!dialog) setPlayContext();
    }
  });
  window.addEventListener('pagehide', () => {
    persistSave(store, save);
    lease.release();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY && !isOwner) {
      const r = loadSave(store);
      if (r.status === 'ok' || r.status === 'migrated') {
        save = r.save;
        controller = new GameController({ save, automated });
        render();
      }
    }
  });
  window.addEventListener('resize', applyLayout);
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onActionDelegated);
  // 挂机检测：5 分钟无输入暂停
  idleTimer = setInterval(() => {
    if (Date.now() - lastInputAt > 5 * 60 * 1000 && !dialog && !automated) {
      dialog = 'pause';
      setPauseContext();
      render();
    }
  }, 30000);
  ['pointerdown', 'keydown'].forEach(evt => document.addEventListener(evt, () => { lastInputAt = Date.now(); }, { passive: true }));
}

/** 重新抢占 owner。 */
function reclaimOwner() {
  isOwner = lease.acquire();
  if (isOwner) {
    controller.stats.automated = automated;
    setPlayContext();
  } else {
    controller.setContext('nonOwner');
  }
}

/** 自动回放模式：按固定解法走完全程，供 browser-check 用。 */
async function runAutomated() {
  await new Promise(r => setTimeout(r, 100));
  const steps = [
    () => controller.inspect('locker'),
    () => controller.pickup('battery'),
    () => controller.useItem('battery', 'nav'),
    () => controller.pickup('starchart'),
    () => controller.useItem('starchart', 'porthole'),
    () => controller.pickup('fuse'),
    () => controller.useItem('fuse', 'lifesupport')
  ];
  for (const step of steps) {
    step(); consumeEvents();
    if (dialog === 'narrative') { dialog = null; }
    render();
    await new Promise(r => setTimeout(r, 40));
  }
  for (const d of AUTHORIZATION_CODE) {
    controller.inputDigit(d); consumeEvents(); render();
    await new Promise(r => setTimeout(r, 20));
  }
  const r = controller.submitCode();
  consumeEvents();
  persistSave(store, save);
  render();
  document.body.dataset.automatedDone = String(r.ok);
}

/** 启动。 */
function boot() {
  const loaded = loadSave(store);
  save = loaded.save;
  if (loaded.status === 'corrupt') {
    // 坏档：明确中文提示，已由 loadSave 备份原文
    introDismissed = false;
  }
  if (automated) {
    save = createSave();
    save.stats.automated = true;
  }
  save.settings.layout = layoutOverride !== 'auto' ? layoutOverride : save.settings.layout;
  if (reducedMotionParam) save.settings.reducedMotion = true;

  controller = new GameController({ save, automated });
  isOwner = lease.acquire();

  root.dataset.layout = V.layoutFor(window.innerWidth, save.settings.layout);
  root.dataset.reduced = String(!!save.settings.reducedMotion);

  bindLifecycle();
  render();

  if (automated) {
    controller.start();
    runAutomated();
  } else if (loaded.status === 'corrupt') {
    detailText = '检测到损坏的存档，已保留备份并重新开始。';
    render();
  }
}

boot();
