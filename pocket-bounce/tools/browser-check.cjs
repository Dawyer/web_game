const { chromium } = require('/root/tools/pocket-browser/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/root/tools/chrome-158.0.8127.18/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const rows = [];
  try {
    for (const viewport of [{ width:1280, height:720 }, { width:1920, height:1080 }, { width:360, height:800 }, { width:390, height:844 }]) {
      const mobile = viewport.width < 500;
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
      const page = await context.newPage(), errors = [], badResponses = [];
      page.on('pageerror', e => errors.push(String(e))); page.on('response', r => { if (r.status() >= 400) badResponses.push({ status:r.status(), url:r.url() }); });
      await page.goto(process.argv[2] + '?automated=1&layout=' + (mobile ? 'mobile' : 'desktop'), { waitUntil:'networkidle' });
      const click = async action => { const inDialog = await page.locator('#overlay').isVisible().catch(() => false); const el = page.locator(`${inDialog ? '#dialog ' : ''}[data-action="${action}"]:visible`).first(); if (mobile) await el.tap(); else await el.click(); };
      await click('levels'); await page.locator('[data-level="01"]').click(); await click('close'); await click('resume');
      const levels = await page.evaluate(async () => (await import('./src/levels.mjs')).LEVELS), checks = [];
      for (const level of levels) {
        if (await page.locator('#overlay').isVisible()) { await click('close'); await click('resume'); }
        const solution = await page.evaluate(async id => { const { LEVELS } = await import('./src/levels.mjs'); const { solve } = await import('./src/solver.mjs'); return solve(LEVELS.find(l => l.id === id)).solution; }, level.id);
        for (const id of solution) {
          const point = await page.evaluate(async id => {
            const { boardGeometry } = await import('./src/view.mjs'), { LEVELS } = await import('./src/levels.mjs');
            const current = JSON.parse(localStorage.getItem('pocket-bounce.save')).current, l = LEVELS.find(l => l.id === current.levelId), b = current.state.balls.find(b => b.id === id);
            const box = document.querySelector('#board').getBoundingClientRect(), g = boardGeometry(box.width, box.height, l), p = g.center(b.x,b.y);
            return { x:box.left+p.x, y:box.top+p.y, cell:g.cell };
          }, id);
          if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
          await page.waitForFunction(() => document.querySelector('#board-state').hidden);
        }
        await page.waitForFunction(() => document.querySelector('#dialog').textContent.includes('全部入袋'));
        const data = await page.evaluate(() => { const s=JSON.parse(localStorage.getItem('pocket-bounce.save')); return { state:s.current.state, progress:s.progress[s.current.levelId], scrollWidth:document.documentElement.scrollWidth, width:innerWidth }; });
        if (data.state.status !== 'won' || data.progress.stars !== 3 || data.scrollWidth > data.width) throw new Error(level.id + ' result or overflow ' + JSON.stringify(data));
        checks.push({ id:level.id, moves:data.state.moves, stars:data.progress.stars });
        if (level.id === '03') {
          await page.screenshot({ path:path.join(out, `${viewport.width}-result.png`), fullPage:true });
          await click('undo'); await click('restart');
          await page.reload({ waitUntil:'networkidle' });
          await page.waitForSelector('#dialog'); await click('resume');
          const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-bounce.save')).current);
          if (checkpoint.state.moves !== 0) throw new Error('reload checkpoint mismatch');
          await page.screenshot({ path:path.join(out, `${viewport.width}-board.png`), fullPage:true });
          // Complete the reset table again with actual board input.
          for (const id of solution) {
            const p = await page.evaluate(async id => { const { boardGeometry }=await import('./src/view.mjs'),{ LEVELS }=await import('./src/levels.mjs'); const c=JSON.parse(localStorage.getItem('pocket-bounce.save')).current, b=c.state.balls.find(b=>b.id===id),box=document.querySelector('#board').getBoundingClientRect(),p=boardGeometry(box.width,box.height,LEVELS.find(l=>l.id===c.levelId)).center(b.x,b.y); return {x:box.left+p.x,y:box.top+p.y}; },id);
            if(mobile) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y); await page.waitForFunction(()=>document.querySelector('#board-state').hidden);
          }
        }
        if (level !== levels.at(-1)) { await click('next'); }
      }
      await click('levels'); await click('settings');
      const [download] = await Promise.all([page.waitForEvent('download'), click('export')]); await download.saveAs(path.join(out, `${viewport.width}-save.json`));
      const imported = JSON.parse(fs.readFileSync(path.join(out, `${viewport.width}-save.json`),'utf8'));
      if (imported.stats.activeMs !== 0 || imported.stats.automated.activeMs <= 0) throw new Error('automated ledger leak');
      if (mobile) { // 44px touch target applies to touch viewports, not a mouse desktop
        const buttons = await page.locator('button:visible').evaluateAll(nodes => nodes.map(n=>({ text:n.textContent, height:n.getBoundingClientRect().height })).filter(n=>n.height<44));
        if(buttons.length) throw new Error('small controls '+JSON.stringify(buttons));
      }
      if(errors.length || badResponses.length) throw new Error(JSON.stringify({errors,badResponses}));
      rows.push({ viewport, mobileSimulation:mobile, levels:checks, errors, badResponses, humanTimeMs:imported.stats.activeMs, automatedTimeMs:imported.stats.automated.activeMs });
      await context.close();
    }
    fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({ status:'passed', chromium:browser.version(), checks:rows, scope:'Actual headless Chromium mouse/touch delivery; no DOM fixture. NOT real phone, visual approval, human playtime or independent acceptance.' },null,2));
    console.log(JSON.stringify({status:'passed',viewports:rows.map(r=>({viewport:r.viewport,levels:r.levels.length})),errors:rows.flatMap(r=>r.errors)},null,2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode=1; });
