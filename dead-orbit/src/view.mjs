/**
 * view.mjs — 布局判定 + 场景/热点/物品栏/键盘渲染。DOM + SVG，非 canvas。
 * 热点是真实可点元素，文字清晰、手机原生 touch 命中、按钮 ≥44px。
 * 纯渲染：不修改游戏状态，只读 snapshot。
 */

import { HOTSPOTS, ITEMS, CLUES, AUTHORIZATION_CODE } from './levels.mjs';

/** 布局判定：窄屏走手机布局；override 可强制。 */
export function layoutFor(width, override = 'auto') {
  if (override === 'desktop' || override === 'mobile') return override;
  return width < 800 ? 'mobile' : 'desktop';
}

/**
 * 热点几何（百分比，覆盖在 1000×600 的场景 SVG 上）。
 * 与 art/scene.svg 中的绘制位置对齐。
 */
export const HOTSPOT_GEOMETRY = {
  locker:      { left: 4,  top: 21, width: 16, height: 50 },
  nav:         { left: 24, top: 29, width: 14, height: 31 },
  porthole:    { left: 39, top: 12, width: 22, height: 38 },
  lifesupport: { left: 62, top: 29, width: 15, height: 31 },
  door:        { left: 80, top: 19, width: 17, height: 59 },
  seat:        { left: 40, top: 67, width: 20, height: 28 },
  console:     { left: 23, top: 67, width: 17, height: 28 },
  toolbox:     { left: 62, top: 67, width: 16, height: 28 }
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 单个热点按钮。 */
function hotspotMarkup(id, snap) {
  const g = HOTSPOT_GEOMETRY[id];
  const hs = HOTSPOTS[id];
  const suggest = snap.suggest === id && !snap.complete;
  const viewed = snap.state.viewedHotspots.includes(id);
  const style = `left:${g.left}%;top:${g.top}%;width:${g.width}%;height:${g.height}%`;
  const classes = ['hotspot', `zone-${hs.zone}`];
  if (suggest) classes.push('suggest');
  if (viewed) classes.push('viewed');
  return `<button class="${classes.join(' ')}" style="${style}" data-hotspot="${id}" aria-label="${esc(hs.name)}" title="${esc(hs.name)}"><span class="hotspot-label">${esc(hs.label)}</span></button>`;
}

/** 星图叠加层：信标星按亮度标注（用数字 + 亮度描述，色觉辅助）。 */
export function starChartMarkup(state) {
  if (!state.flags.starchartUsed) return '';
  return `<div class="starchart-overlay" aria-label="信标星读数">
    <div class="beacon beacon-1"><b>4</b><small>最亮</small></div>
    <div class="beacon beacon-2"><b>1</b><small>次亮</small></div>
    <div class="beacon beacon-3"><b>8</b><small>最暗</small></div>
  </div>`;
}

/** 生命维持读数叠加（面板亮起时）。 */
function lifeReadingsMarkup(state) {
  if (!state.flags.fuseFixed) return '';
  return `<div class="life-readings" aria-label="生命维持读数">
    <span>O₂ <b>26</b>%</span><span>舱压 <b>5</b> kPa</span>
  </div>`;
}

/** 场景舞台：本地 SVG 背景 + 热点 + 叠加层。 */
export function sceneMarkup(snap) {
  const hotspots = Object.keys(HOTSPOTS).map(id => hotspotMarkup(id, snap)).join('');
  const escaped = snap.complete ? '<div class="escape-flash" aria-hidden="true"></div>' : '';
  return `<div class="stage" id="stage">
    <img class="scene-bg" src="./art/scene.svg" alt="渡鸦-7 逃生舱前庭" draggable="false">
    ${lifeReadingsMarkup(snap.state)}
    ${starChartMarkup(snap.state)}
    ${hotspots}
    ${escaped}
    <div class="alarm-beacon" aria-hidden="true"></div>
  </div>`;
}

/** 物品栏：已拾取道具；选中态明确高亮；每件带数字+文字双重标识。 */
export function inventoryMarkup(snap) {
  const items = snap.state.inventory;
  if (!items.length) return `<div class="inventory" id="inventory"><p class="inventory-empty">物品栏空 · 点击场景中的物体寻找道具</p></div>`;
  const buttons = items.map((id, i) => {
    const item = ITEMS[id];
    const selected = snap.selectedItem === id;
    return `<button class="item ${selected ? 'selected' : ''}" data-item="${id}" aria-pressed="${selected}" title="${esc(item.name)}">
      <span class="item-glyph" aria-hidden="true">${esc(item.glyph)}</span>
      <span class="item-name">${i + 1}. ${esc(item.name)}</span>
      ${selected ? '<span class="item-hint">已选中 · 点场景目标使用</span>' : ''}
    </button>`;
  }).join('');
  return `<div class="inventory" id="inventory">${buttons}</div>`;
}

/** 详情面板：当前查看的热点文字 + 选中提示 + 可拾取道具按钮。 */
export function detailMarkup(snap, detailText, currentHotspot) {
  let text = detailText || '点击场景中的物体开始探索。';
  if (snap.selectedItem) {
    text = `已选中「${ITEMS[snap.selectedItem].name}」—— 点击场景中的目标使用，或再点一次取消。`;
  }
  // 若当前查看的热点藏有未拾取的道具，给出明确的拾取按钮
  const hs = currentHotspot ? HOTSPOTS[currentHotspot] : null;
  let pickup = '';
  if (hs?.yields && !snap.state.inventory.includes(hs.yields) && !snap.selectedItem) {
    const item = ITEMS[hs.yields];
    pickup = `<button class="pickup-btn" data-action="pickup" data-item-id="${hs.yields}">拾取：${esc(item.name)}</button>`;
  }
  return `<div class="detail" id="detail" role="status" aria-live="polite"><p>${esc(text)}</p>${pickup}</div>`;
}

/** 数字键盘 + 当前输入显示。 */
export function keypadMarkup(snap) {
  const input = snap.state.codeInput;
  const slots = Array.from({ length: 6 }, (_, i) => `<span class="slot ${i < input.length ? 'filled' : ''}">${i < input.length ? esc(input[i]) : '·'}</span>`).join('');
  const err = snap.state.codeError ? '<p class="code-error" role="alert">授权失败，请核对</p>' : '';
  const keys = ['1','2','3','4','5','6','7','8','9'].map(d => `<button class="key" data-digit="${d}">${d}</button>`).join('');
  const done = snap.complete;
  return `<section class="keypad" id="keypad" ${done ? 'aria-disabled="true"' : ''}>
    <h2>发射授权</h2>
    <div class="code-slots" aria-label="当前输入 ${input.length} 位">${slots}</div>
    ${err}
    <div class="key-grid">
      ${keys}
      <button class="key key-fn" data-action="clear">清</button>
      <button class="key" data-digit="0">0</button>
      <button class="key key-fn" data-action="backspace">退</button>
    </div>
    <button class="confirm" data-action="submit" ${done ? 'disabled' : ''}>确认授权</button>
  </section>`;
}

/** 线索簿列表（弹窗内容）。 */
export function clueBookMarkup(snap) {
  const ids = snap.state.discoveredClues;
  if (!ids.length) return '<p>还没有发现任何线索。探索场景吧。</p>';
  return ids.map(id => {
    const c = CLUES[id];
    if (!c) return '';
    return `<article class="clue"><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p></article>`;
  }).join('');
}

/** 顶部 HUD。 */
export function hudMarkup(snap, opts = {}) {
  const pct = progressPercent(snap.state);
  return `<header class="hud">
    <div class="hud-title"><span class="eyebrow">DEAD ORBIT · 静默轨道</span><strong>渡鸦-7 · 逃生舱前庭</strong></div>
    <div class="hud-actions">
      <button data-action="clues" title="线索簿 (J)">线索簿</button>
      <button data-action="hint" title="提示 (H)">提示</button>
      <button data-action="settings" title="设置">设置</button>
    </div>
    <div class="progress" aria-label="进度 ${pct}%"><span style="width:${pct}%"></span></div>
  </header>`;
}

function progressPercent(state) {
  const steps = [
    state.inventory.includes('battery'), state.flags.navPowered,
    state.inventory.includes('starchart'), state.flags.starchartUsed,
    state.inventory.includes('fuse'), state.flags.fuseFixed, state.flags.escaped
  ];
  return Math.round(steps.filter(Boolean).length / steps.length * 100);
}
