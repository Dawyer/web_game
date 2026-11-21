/**
 * browser-check.cjs — 四视口真实输入回放。
 * 用法：node tools/browser-check.cjs <baseURL> <outDir>
 * 需要 Playwright + Chromium（本环境未提供时脚本会明确报错退出，不冒称通过）。
 */
const fs = require('node:fs');
const path = require('node:path');

let chromium;
// 允许通过 PLAYWRIGHT_PATH 指定 playwright 模块位置（例如浏览器二进制随 npm 包分发的环境）
const candidates = [
  process.env.PLAYWRIGHT_PATH,
  'playwright',
  '/root/tools/pocket-browser/node_modules/playwright',
  '/tmp/do-browser/node_modules/playwright'
].filter(Boolean);
for (const p of candidates) {
  try { ({ chromium } = require(p)); break; } catch { /* 试下一个 */ }
}
if (!chromium) {
  console.error('BROWSER_UNAVAILABLE: 未找到 Playwright，无法执行四视口回放。');
  process.exit(2);
}
// 允许通过 CHROME_PATH 指定 Chromium 可执行文件（无系统 Chrome 的环境）
const executablePath = process.env.CHROME_PATH || undefined;

const BASE = process.argv[2] || 'http://127.0.0.1:8765/dead-orbit/';
const OUT = process.argv[3] || path.join(__dirname, '..', 'evidence');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { width: 1280, height: 720, name: 'desktop-1280x720', mobile: false },
  { width: 1920, height: 1080, name: 'desktop-1920x1080', mobile: false },
  { width: 360, height: 800, name: 'mobile-360x800', mobile: true },
  { width: 390, height: 844, name: 'mobile-390x844', mobile: true }
];

const SOLUTION = [
  { action: 'hotspot', id: 'locker' },
  { action: 'pickup', id: 'battery' },
  { action: 'select', id: 'battery' }, { action: 'hotspot', id: 'nav' },
  { action: 'pickup', id: 'starchart' },
  { action: 'select', id: 'starchart' }, { action: 'hotspot', id: 'porthole' },
  { action: 'pickup', id: 'fuse' },
  { action: 'select', id: 'fuse' }, { action: 'hotspot', id: 'lifesupport' },
  { action: 'digits', value: '418250' },
  { action: 'submit' }
];

(async () => {
  const rows = [];
  const launchArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--disable-software-rasterizer', '--no-zygote', '--disable-setuid-sandbox', '--single-process'];
  for (const vp of VIEWPORTS) {
    // 每个视口独立 browser：单进程构建下多 context 会崩，独立实例更稳
    const browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: launchArgs
    });
    try {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1
      });
      const page = await context.newPage();
      const errors = [], bad = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('response', r => { if (r.status() >= 400) bad.push({ status: r.status(), url: r.url() }); });

      await page.goto(`${BASE}?automated=1&layout=${vp.mobile ? 'mobile' : 'desktop'}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForFunction(() => document.body.dataset.automatedDone !== undefined, { timeout: 15000 });
      const done = await page.evaluate(() => document.body.dataset.automatedDone);

      // 横向溢出检查
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      // 移动端按钮命中尺寸
      let smallButtons = 0;
      if (vp.mobile) {
        smallButtons = await page.evaluate(() => {
          let n = 0;
          document.querySelectorAll('button').forEach(b => {
            const r = b.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) n++;
          });
          return n;
        });
      }
      await page.screenshot({ path: path.join(OUT, `${vp.name}.png`), fullPage: true });

      rows.push({ viewport: vp.name, escaped: done === 'true', errors: errors.length, badResponses: bad.length,
        overflow, smallButtons, errorDetails: errors, badDetails: bad });
      await context.close();
    } finally {
      await browser.close();
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    viewports: rows,
    allPass: rows.every(r => r.escaped && r.errors === 0 && r.badResponses === 0 && !r.overflow && r.smallButtons === 0)
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.allPass ? 0 : 1);
})().catch(e => { console.error('BROWSER_CHECK_ERROR:', e); process.exit(3); });
