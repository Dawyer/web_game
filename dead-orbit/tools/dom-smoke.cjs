/**
 * dom-smoke.cjs — jsdom 冒烟：验证 app.mjs 的 DOM 接线与完整通关流程。
 * 不是浏览器模拟器：不验证 CSS 布局、真实触摸、音频解码。
 * 用法：NODE_PATH=<jsdom所在node_modules> node tools/dom-smoke.cjs
 */
const path = require('node:path');
const fs = require('node:fs');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch {
  try { ({ JSDOM } = require('/tmp/do-browser/node_modules/jsdom')); }
  catch { console.error('JSDOM_UNAVAILABLE'); process.exit(2); }
}

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const errors = [];

const dom = new JSDOM(html, {
  url: 'http://localhost/dead-orbit/',
  pretendToBeVisual: true,
  runScripts: 'outside-only'
});
const { window } = dom;
// 补齐 jsdom 缺失的 API（performance 用 jsdom 自带的）
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
window.confirm = () => true;
window.prompt = () => null;
window.document.execCommand = () => true;
global.window = window;
global.document = window.document;
global.location = window.location;
// 不覆盖 global.performance：app 用 window.performance（jsdom 自带），
// 覆盖成同一个对象会让 jsdom 的 now() 自引用递归。
global.localStorage = window.localStorage;
global.navigator = window.navigator;

process.on('uncaughtException', e => errors.push(String(e)));
process.on('unhandledRejection', e => errors.push(String(e)));

(async () => {
  // 动态 import app.mjs（ESM 在 CJS 中用 import()）
  await import('file://' + path.join(ROOT, 'src', 'app.mjs'));
  await new Promise(r => setTimeout(r, 100));

  const d = window.document;
  const q = s => d.querySelector(s);
  const click = el => {
    if (!el) throw new Error('元素不存在');
    const ev = new window.MouseEvent('pointerdown', { bubbles: true, button: 0 });
    Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
    el.dispatchEvent(ev);
  };
  // data-action 按钮走全局 click 委托；热点/道具/数字键走 pointerdown
  const action = a => {
    const el = q(`[data-action="${a}"]`);
    if (!el) throw new Error(`动作元素不存在: ${a}`);
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  // 开场弹窗
  if (!q('#dialog')) throw new Error('开场弹窗未显示');
  action('start-game');
  await new Promise(r => setTimeout(r, 20));
  if (q('#dialog')) throw new Error('开始后弹窗未关闭');

  // 完整通关（看热点→拾取道具→点道具→点目标）
  click(q('[data-hotspot="locker"]'));
  action('pickup');                       // 拾取应急电池
  click(q('[data-item="battery"]'));
  click(q('[data-hotspot="nav"]'));
  click(q('[data-hotspot="seat"]'));
  action('pickup');                       // 拾取星图仪
  click(q('[data-item="starchart"]'));
  click(q('[data-hotspot="porthole"]'));
  click(q('[data-hotspot="toolbox"]'));
  action('pickup');                       // 拾取保险丝
  click(q('[data-item="fuse"]'));
  click(q('[data-hotspot="lifesupport"]'));
  await new Promise(r => setTimeout(r, 20));

  // 录音弹窗出现 → 关闭
  if (!q('#dialog')) throw new Error('船长录音弹窗未出现');
  action('close');

  // 输入授权码
  for (const ch of '418250') click(q(`[data-digit="${ch}"]`));
  action('submit');
  await new Promise(r => setTimeout(r, 20));

  const ending = q('#dialog');
  const escaped = ending && ending.textContent.includes('替我看看那边的天');
  const save = JSON.parse(window.localStorage.getItem('dead-orbit.save') || '{}');

  const result = {
    escaped: !!escaped,
    savedEscaped: save?.state?.flags?.escaped === true,
    errors,
    pass: !!escaped && errors.length === 0
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
})().catch(e => { console.error('DOM_SMOKE_ERROR:', e); process.exit(3); });
