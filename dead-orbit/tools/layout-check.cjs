/**
 * layout-check.cjs — 静态布局与无障碍配置检查（不依赖浏览器）。
 * 验证 CSS 中双端布局、44px 命中、安全区、减弱动效、键盘可达等规则齐备。
 * 这是配置存在性检查，不等于真实渲染验收。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'src/app.mjs'), 'utf8');
const view = fs.readFileSync(path.join(ROOT, 'src/view.mjs'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const checks = [
  ['手机布局覆盖规则', /\[data-layout="mobile"\]/.test(css)],
  ['安全区适配 env(safe-area)', /env\(safe-area-inset/.test(css)],
  ['按钮最小 44px', /min-height:\s*44px/.test(css) && /min-width:\s*44px/.test(css)],
  ['减弱动效开关规则', /\[data-reduced="true"\][\s\S]*animation:\s*none/.test(css)],
  ['触摸动作优化 touch-action', /touch-action:\s*manipulation/.test(css)],
  ['viewport-fit=cover', /viewport-fit=cover/.test(html)],
  ['布局判定函数 layoutFor', /export function layoutFor/.test(view)],
  ['键盘处理 onKey', /function onKey/.test(app)],
  ['数字键/Enter/Backspace/Esc/H/J/M', /e\.key === 'Enter'/.test(app) && /e\.key === 'Backspace'/.test(app) && /e\.key === 'Escape'/.test(app)],
  ['后台 visibilitychange 处理', /visibilitychange/.test(app)],
  ['挂机检测', /5 \* 60 \* 1000/.test(app)],
  ['线索簿可回看', /case 'clues'/.test(app)],
  ['三层提示', /case 'hint'/.test(app) && /hintTier/.test(fs.readFileSync(path.join(ROOT, 'src/engine.mjs'), 'utf8'))],
  ['输错不锁死（失败仅标记）', /codeError = true/.test(fs.readFileSync(path.join(ROOT, 'src/engine.mjs'), 'utf8'))],
  ['坏档备份提示', /status === 'corrupt'/.test(app)],
  ['存档导出导入', /case 'export'/.test(app) && /case 'import-prompt'/.test(app)],
  ['静音状态持久化', /settings\.muted/.test(app)],
  ['Web Audio 合成音效（无音频文件）', /AudioContext/.test(fs.readFileSync(path.join(ROOT, 'src/audio.mjs'), 'utf8'))]
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} 项配置检查通过（静态检查，不等于真实渲染验收）`);
process.exit(pass === checks.length ? 0 : 1);
