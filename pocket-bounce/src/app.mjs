import { GameController, OwnerLease } from './controller.mjs';
import { CanvasView, layoutFor, SYMBOLS, COLOR_NAMES, DIRECTION_NAMES } from './view.mjs';
import { loadResources } from './loader.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const button = (action, text, extra = '') => `<button data-action="${action}" ${extra}>${text}</button>`;
const starsMarkup = (count, result = false) => `<div class="${result ? 'result-stars' : 'level-stars'}" aria-label="${count} 星">${[1, 2, 3].map(n => `<img src="./art/star.png" alt="" class="${n > count ? 'dim-star' : ''}">`).join('')}</div>`;
const minutes = ms => `${String(Math.floor((ms || 0) / 60000)).padStart(2, '0')}:${String(Math.floor((ms || 0) / 1000) % 60).padStart(2, '0')}`;

/** All text is escaped; only local original images supply interface art. */
export function screenMarkup(screen, model) {
  const { save, levels, chapters, level, state } = model, current = save.current;
  const actions = html => `<div class="actions">${html}</div>`;
  if (screen === 'home') return `<section class="home panel"><p class="eyebrow">一次点击 · 六拍思考</p><h1>弹球入袋</h1><p>看准箭头，借反弹与接力，让每颗球找到同色袋口。</p><div class="actions vertical">${current ? button('continue', '继续上次对局') : ''}${button('levels', '开始选关')}${button('tutorial', '一分钟认识球桌')}${button('settings', '设置与本地数据')}</div><p class="small">候选版 · 仅本机存档，无账号或联网排行。<br>双端体验、美术与三小时真人盲测待验收。</p></section>`;
  if (screen === 'levels') return `<header class="menu-heading panel"><div><p class="eyebrow">六章旅程 · 每击六拍</p><h1>选择球桌</h1></div>${button('home', '返回')}</header>${chapters.map(chapter => `<section class="chapter panel" data-chapter="${escape(chapter.id)}"><h2>${escape(chapter.title)}</h2><p>${escape(chapter.description)}</p><div class="level-grid">${levels.filter(l => l.chapter === chapter.id).map(l => {
    const index = levels.indexOf(l), progress = save.progress[l.id], unlocked = index === 0 || save.progress[levels[index - 1].id]?.completed || progress?.completed || current?.levelId === l.id;
    return button('level', `<strong>${escape(l.id)} · ${escape(l.title)}</strong><small>${escape(l.intent)}</small>${starsMarkup(progress?.stars ?? 0)}<small>${unlocked ? progress ? `最佳 ${progress.bestMoves} 步` : `目标 ${l.par} 步` : '先完成前一关'}</small>`, `class="level-button" data-level="${escape(l.id)}" ${unlocked ? '' : 'disabled'}`);
  }).join('')}</div></section>`).join('')}`;
  if (screen === 'settings') return `<h2 id="dialog-title">设置与本地数据</h2><p>仅保存在当前浏览器；清理浏览器数据前请先导出。</p><div class="setting-grid">${button('muted', `声音：${save.settings.muted ? '静音' : '开启'}`, `aria-pressed="${save.settings.muted}"`)}${button('reducedMotion', `减弱动效：${save.settings.reducedMotion ? '开' : '关'}`, `aria-pressed="${save.settings.reducedMotion}"`)}${button('symbols', `A–F 辅助辨色：${save.settings.symbols ? '开' : '关'}`, `aria-pressed="${save.settings.symbols}"`)}${button('auto', '自动布局')}${button('desktop', '电脑版')}${button('mobile', '手机版')}${button('export', '导出存档 JSON')}${button('import', '校验并导入存档')}${button('csv', '导出计时 CSV')}${button('diagnostic', '导出问题记录')}${button('stats', '查看本地统计')}${button('reset', '重置本地数据')}</div><p class="small">暂停、后台、菜单与 5 分钟无输入后的疑似挂机不计有效游玩；恢复需主动操作。自动测试另列，不证明真人三小时。</p><p class="small">游戏 ${escape(model.gameVersion)}<br>关卡 ${escape(model.contentVersion)} · 候选版</p>${actions(button('close', '返回'))}`;
  if (screen === 'pause') return `<h2 id="dialog-title">球桌已暂停</h2><p>${escape(model.pauseReason || '休息一下。棋盘已停在最近的稳定检查点。')}</p><p>继续后才恢复操作与有效计时。</p>${actions(button('resume', '继续对局') + button('tutorial', '操作教学') + button('settings', '设置') + button('levels', '返回选关'))}`;
  if (screen === 'tutorial') return `<h2 id="dialog-title">一击六拍，不用抢时间</h2><ul class="rule-list"><li>点静止球，沿球上箭头前进；每击最多六拍，再次点球前会停稳。</li><li>同色袋才进袋。撞墙、木箱或异色袋会原地反向，消耗一拍。</li><li>球碰球：来球停下并反向，冲量交给被撞球，余拍继续。</li><li>进入 / 或反向镜面时转 90°；只有上下左右，没有斜走。</li><li>清空即胜；未清空而达到限步则失败，可直接撤销或重试。</li><li>A 红 / B 黄 / C 蓝 / D 绿 / E 紫 / F 橙；球与袋字母一致。</li><li>提示由思路、下一击到完整解法；后两层从当前局面搜索。</li></ul>${level?.tutorial ? `<p>${escape(level.tutorial)}</p>` : ''}<p class="small">键盘可辅助：方向键选球，Enter / 空格击球，Z 撤销，R 重试，Esc 暂停；每个功能都有按钮。</p>${actions(button('close', '知道了，返回'))}`;
  if (screen === 'result') {
    const won = state.status === 'won', stars = won ? state.moves <= level.par ? 3 : state.moves <= level.par + 2 ? 2 : 1 : 0;
    return `<div class="${won ? 'result-win' : 'result-lose'}"><p class="eyebrow">球桌 ${escape(level.id)} · ${escape(level.title)}</p><h2 id="dialog-title">${won ? '全部入袋' : '本次限步已用完'}</h2>${starsMarkup(stars, true)}<p>${won ? `用了 ${state.moves} 步。三星目标 ${level.par} 步，二星不超过 ${level.par + 2} 步。` : `已用 ${state.moves} / ${level.limit} 步，仍有 ${state.balls.length} 颗球。可撤销重新分析，也可立即重试。`}</p><p class="small">成绩已在逻辑完成时保存。撤销不会删除完成记录。</p>${actions((won ? button('next', levels.indexOf(level) === levels.length - 1 ? '查看主线结果' : '下一关') : '') + button('undo', '撤销分析') + button('restart', '立即重试') + button('levels', '返回选关'))}</div>`;
  }
  if (screen === 'hint') return `<h2 id="dialog-title">分层提示 · ${escape(model.hint?.tier || 1)} / 3</h2><p>${escape(model.hint?.text || '正在根据当前局面搜索……')}</p><p class="small">第二层与第三层会重新搜索当前棋盘。预算耗尽只表示未验证，不会冒称无解。</p>${actions(button('more-hint', '主动查看下一层') + button('close', '返回棋盘'))}`;
  if (screen === 'reset') return `<h2 id="dialog-title">确认重置本地数据？</h2><p>这会清除本机进度、当前对局、设置与计时。无法自动恢复。建议先导出存档。</p>${actions(button('export', '先导出备份') + button('confirm-reset', '确认清除') + button('cancel', '取消，保留数据'))}`;
  if (screen === 'import-confirm') return `<h2 id="dialog-title">存档校验通过</h2><p>导入会替换当前本机进度、对局、设置与计时。尚未覆盖任何数据。</p>${actions(button('export', '先导出当前备份') + button('confirm-import', '确认导入替换') + button('cancel', '取消'))}`;
  if (screen === 'stats') {
    const s = save.stats, rows = Object.entries(s.levels || {});
    return `<h2 id="dialog-title">本地游玩记录</h2><p>累计有效 ${minutes(s.activeMs)} · 首次主线 ${minutes(s.firstMainMs)}<br>重玩刷星 ${minutes(s.replayMs)} · 疑似挂机 ${minutes(s.idleMs)}</p><p>${rows.length ? rows.map(([id, r]) => `关 ${escape(id)}：${minutes(r.activeMs)}，尝试 ${r.attempts}，重开 ${r.restarts}，撤销 ${r.undos}，提示 ${r.hints}`).join('<br>') : '还没有对局记录。'}</p><p class="small">自动测试有效时间 ${minutes(s.automated?.activeMs)}，不混入真人记录。<br>目标三小时尚无真人首次盲测证据，待验证。</p>${actions(button('csv', '导出完整计时 CSV') + button('close', '返回'))}`;
  }
  if (screen === 'main-result') return `<h2 id="dialog-title">主线全部完成</h2>${starsMarkup(3, true)}<p>首次主线有效游玩 ${minutes(save.stats.firstFinishMs ?? save.stats.firstMainMs)}。可返回选关继续研究更短路线。</p><p class="small">这份本机记录不是独立真人盲测结论；三小时内容、美术与双端验收仍待验证。</p>${actions(button('levels', '回到六章球桌') + button('csv', '导出计时 CSV'))}`;
  return `<h2 id="dialog-title">暂时无法继续</h2><p>${escape(model.error || '请重试。')}</p>${actions(button('close', '返回'))}`;
}

export function statsCSV(stats) {
  const columns = ['levelId', 'activeMs', 'firstMainMs', 'replayMs', 'attempts', 'restarts', 'undos', 'hints', 'failures', 'completions', 'firstClearMs', 'successfulAttemptMs', 'firstAttempts', 'firstRestarts', 'firstUndos', 'firstHints', 'firstFailures', 'levelVersion'];
  const csv = value => /[",\r\n]/.test(String(value ?? '')) ? `"${String(value).replaceAll('"', '""')}"` : String(value ?? '');
  const rows = [columns.join(',')];
  for (const [id, record] of Object.entries(stats.levels || {})) rows.push(columns.map(key => csv(key === 'levelId' ? id : record[key])).join(','));
  rows.push('', 'category,ms');
  for (const key of ['activeMs', 'firstMainMs', 'replayMs', 'pauseMs', 'hiddenMs', 'menuMs', 'loadingMs', 'resultMs', 'animationMs', 'idleMs', 'sleepMs', 'nonOwnerMs', 'firstFinishMs']) rows.push(`${key},${csv(stats[key])}`);
  rows.push('', 'automatedLevelId,activeMs,attempts,restarts,undos,hints');
  for (const [id, r] of Object.entries(stats.automated?.levels || {})) rows.push([id, r.activeMs, r.attempts, r.restarts, r.undos, r.hints].map(csv).join(','));
  rows.push('', 'sessionId,device,automated,gameVersion,contentVersion');
  for (const s of stats.sessions || []) rows.push([s.id, s.device, s.automated, s.gameVersion, s.contentVersion].map(csv).join(','));
  return '\uFEFF' + rows.join('\r\n');
}

/** Browser wiring is explicit and imported only after module loading succeeds. */
export async function boot(doc = document, win = window) {
  const $ = selector => doc.querySelector(selector);
  const loading = $('#loading'), loadingTitle = $('#loading-title'), loadingProgress = $('#loading-progress'), loadError = $('#loading-error'), retry = $('#load-retry');
  const cache = {}, errors = []; let starting = false, runtime = null;
  const notice = text => { $('#notice').textContent = text; };
  const fail = error => { const message = error?.message || String(error); errors.push({ type: error?.name || 'Error', message }); notice(message); };
  win.addEventListener('error', event => { if (runtime) fail(event.error || new Error(event.message)); });
  win.addEventListener('unhandledrejection', event => { if (runtime) fail(event.reason); });

  async function start() {
    if (starting || runtime) return;
    starting = true; retry.hidden = true; loadError.textContent = ''; loadingTitle.textContent = '正在铺好球桌';
    try {
      const assets = await loadResources({ cache, onProgress: p => { loadingProgress.textContent = `读取本地原图 ${p.loaded} / ${p.total}${p.failed ? `，失败 ${p.failed}` : ''}`; } });
      const engine = await import('./engine.mjs');
      const content = await import('./levels.mjs');
      const persistence = await import('./persistence.mjs');
      const timing = await import('./timing.mjs');
      const { solve } = await import('./solver.mjs');
      if (!Array.isArray(content.LEVELS) || content.LEVELS.length === 0 || content.CHAPTERS.length !== 6) throw new Error('关卡内容未准备完整，请重试。');
      runtime = await wire({ assets, engine, content, persistence, timing, solve });
      loading.hidden = true;
    } catch (error) {
      loadingTitle.textContent = '加载未完成'; loadError.textContent = `${error.message}。不会使用替代素材。`; loadingProgress.textContent = '本地资源或模块读取失败'; retry.hidden = false; errors.push({ type: 'loading', message: error.message });
    } finally { starting = false; }
  }

  async function wire({ assets, engine, content, persistence: p, timing, solve }) {
    const { LEVELS: levels, CHAPTERS: chapters } = content;
    let storage;
    try { storage = win.localStorage; } catch { storage = { getItem: () => null, setItem() { throw new Error('浏览器拒绝本地存储'); }, removeItem() {} }; }
    const loaded = p.loadSave(storage, levels); let save = loaded.save;
    const params = new URLSearchParams(win.location.search), automated = params.get('automated') === '1';
    let override = ['desktop', 'mobile'].includes(params.get('layout')) ? params.get('layout') : save.settings.layout;
    const device = () => layoutFor({ width: win.innerWidth, override });
    const sessionId = win.crypto?.randomUUID?.() ?? `local-${Math.floor(win.performance.now())}`;
    const lease = new OwnerLease({ storage, id: sessionId }); let owner = !doc.hidden && lease.claim();
    let clock = new timing.PlayClock({ stats: save.stats, sessionId, automated, device: device() });
    let screen = 'home', dialog = null, selected = null, hint = null, pendingImport = null, pauseReason = '', returnDialog = null, refreshCount = 0;
    let lastActivityPaint = 0, lastSaveError = '', audioStarted = false, hintRequest = 0, idlePaused = false;
    const audio = new Map();
    const view = new CanvasView($('#board'), assets, { onSound: sound });
    const controller = new GameController({ levels, engine, save, solve, onSave: persist, onEvent: event });

    function sound(type) {
      if (save.settings.muted || !audioStarted) return;
      // Optional local audio pack; failures are visible and never block the game.
      let player = audio.get(type);
      if (!player) {
        player = new win.Audio(`./audio/${type}.mp3`); player.preload = 'none'; player.volume = type === 'roll' ? .18 : .45;
        player.addEventListener('error', () => { if (!player.reported) { player.reported = true; notice(`本地音效 ${type}.mp3 未就绪，可继续静音游玩。`); errors.push({ type: 'audio', file: `${type}.mp3` }); } });
        audio.set(type, player);
      }
      try { player.currentTime = 0; const playing = player.play(); playing?.catch(() => {}); } catch { /* Browser may still require a new trusted gesture. */ }
    }
    function context() {
      const currentLevel = controller.level;
      const mode = doc.hidden ? 'hidden' : controller.mode === 'menu' ? (dialog ? 'pause' : 'menu') : idlePaused ? 'idle' : dialog || controller.mode === 'pause' ? 'pause' : controller.locked ? 'animation' : controller.state?.status !== 'playing' ? 'result' : 'play';
      clock.setContext({ mode, levelId: currentLevel?.id ?? null, completed: !!save.progress[currentLevel?.id]?.completed, owner });
    }
    function persist() {
      save.stats = clock.snapshot();
      if (!owner || !lease.owns()) return;
      const result = p.persistSave(storage, save);
      if (!result.ok && result.error !== lastSaveError) { lastSaveError = result.error; fail(new Error(`本地保存失败：${result.error}。请导出备份。`)); }
      if (result.ok) lastSaveError = '';
    }
    function event(type, detail) {
      const levelId = detail.levelId;
      if (type === 'attempt' || type === 'restart' || type === 'undo') clock.setContext({ mode: 'play', levelId, completed: !!save.progress[levelId]?.completed, owner }, { newAttempt: type === 'attempt' });
      clock.event(type === 'replayComplete' ? 'complete' : type, { ...detail, mainCompleted: type === 'complete' && levels.every(l => save.progress[l.id]?.completed) });
    }
    function model() { return { save, levels, chapters, level: controller.level, state: controller.state, settings: save.settings, selected, gameVersion: p.GAME_VERSION, contentVersion: content.CONTENT_VERSION ?? p.CONTENT_VERSION, hint, pauseReason }; }
    function applyLayout() {
      doc.documentElement.dataset.layout = device(); doc.documentElement.dataset.reduced = String(save.settings.reducedMotion);
      $('#version').textContent = `候选版 ${p.GAME_VERSION} · 关卡 ${content.CONTENT_VERSION ?? p.CONTENT_VERSION} · ${automated ? '自动测试计时单列' : '双端 / 美术 / 三小时真人盲测待验收'}`;
    }
    function selectBall(delta = 1) {
      const balls = controller.state?.balls ?? []; if (!balls.length) { selected = null; return; }
      selected = balls[(Math.max(-1, balls.findIndex(b => b.id === selected)) + delta + balls.length) % balls.length].id;
    }
    function paint() {
      applyLayout();
      const playing = controller.mode !== 'menu' && !!controller.state;
      $('#game-shell').hidden = !playing; $('#menu-area').hidden = playing;
      if (!playing) $('#menu-area').innerHTML = screenMarkup(screen, model());
      else {
        const l = controller.level, state = controller.state;
        if (!state.balls.some(b => b.id === selected)) selected = state.balls[0]?.id ?? null;
        $('#chapter-label').textContent = `第 ${l.chapter} 章 · 每击六拍`;
        $('#level-title').textContent = `${l.id} · ${l.title}`; $('#intent').textContent = l.intent;
        $('#moves').textContent = `${state.moves} / ${l.limit}`; $('#par').textContent = `${l.par} 步`; $('#remaining').textContent = `${state.balls.length} 球`;
        const ball = state.balls.find(b => b.id === selected);
        $('#selected-ball').textContent = ball ? `选中 ${SYMBOLS[ball.color]} ${COLOR_NAMES[ball.color]}球 ${ball.id} · 朝${DIRECTION_NAMES[ball.dir]}` : '所有球已入袋';
        $('#board').setAttribute('aria-label', `球桌 ${l.id}，步数 ${state.moves}/${l.limit}，${state.balls.length} 颗球。${ball ? `选中 ${SYMBOLS[ball.color]} 球 ${ball.id} 朝${DIRECTION_NAMES[ball.dir]}` : ''}`);
        const blocked = controller.mode !== 'play' || controller.locked || !owner;
        for (const action of ['strike', 'select', 'undo', 'hint']) $(`[data-action="${action}"]`).disabled = action === 'undo' ? controller.locked || !save.current.history.length : blocked || !state.balls.length;
        $('#board-state').hidden = !controller.locked; $('#board-state').textContent = '六拍执行中 · 其他点击不会排队';
        view.paint(model());
      }
      if (controller.mode === 'result' && !dialog && playing) dialog = 'result';
      $('#overlay').hidden = !dialog;
      if (dialog) $('#dialog').innerHTML = screenMarkup(dialog, model());
      context(); updateClock();
    }
    function updateClock() { $('#clock-line').textContent = `有效 ${minutes(clock.stats.activeMs)} · 首次主线 ${minutes(clock.stats.firstMainMs)}${automated ? ' · 自动回放单列' : ''}`; }
    function showDialog(name) { dialog = name; paint(); $('#dialog').focus(); }
    function pause(reason = '', { idle = false } = {}) {
      if (controller.mode === 'menu') return;
      idlePaused = idle; pauseReason = reason; view.cancel(); controller.pause(); dialog = 'pause'; paint();
    }
    function claim() {
      const previousOwner = owner && lease.owns();
      owner = !doc.hidden && lease.claim();
      if (owner && !previousOwner) {
        const latest = p.loadSave(storage, levels);
        save = latest.save; controller.save = save;
        clock = new timing.PlayClock({ stats: save.stats, sessionId, automated, device: device() });
        if (save.current) controller.restore(); else controller.menu();
      }
      if (!owner) notice('另一标签页正在使用此存档，或本地存储不可用。请关闭另一页后再点继续。');
      return owner;
    }
    function openLevel(id) {
      if (!claim()) return;
      idlePaused = false; dialog = null; screen = 'home'; view.cancel(); controller.open(id); selected = controller.state.balls[0]?.id ?? null; hint = null; clock.activity();
      paint();
      if (controller.level.tutorial) { pauseReason = controller.level.tutorial; controller.pause(); showDialog('tutorial'); }
    }
    async function strike(id = selected) {
      if (dialog) return;
      if (!owner || !lease.owns()) { owner = false; pause('此标签页已失去计时与存档使用权，请显式继续。'); return; }
      const result = controller.strike(id);
      if (!result.accepted) { if (!controller.locked) notice('请点一颗静止球；暂停或结算时不能击球。'); return; }
      clock.activity(); paint();
      const completed = await view.animate(result, model());
      if (!completed || !controller.finishAnimation(result.token)) return;
      if (controller.state.status !== 'playing') sound(controller.state.status === 'won' ? 'win' : 'lose');
      dialog = controller.mode === 'result' ? 'result' : null; paint();
    }
    async function requestHint() {
      if (controller.mode === 'pause') { dialog = null; controller.resume(); }
      if (controller.mode !== 'play' || controller.locked || !owner) return;
      const request = ++hintRequest, token = controller.token;
      hint = null;
      // Paint a message before the bounded synchronous solver gets its turn.
      notice('正在分析当前局面……'); await new Promise(resolve => win.setTimeout(resolve, 16));
      if (request !== hintRequest || token !== controller.token || controller.mode !== 'play' || dialog || !owner) return;
      const result = await controller.hint();
      if (result.status === 'stale' || result.status === 'blocked') { notice(result.text); return; }
      hint = result; controller.pause(); showDialog('hint'); notice('提示不会自动替你操作。');
    }
    function closeDialog() {
      if (dialog === 'settings' && returnDialog) { const target = returnDialog; returnDialog = null; showDialog(target); return; }
      dialog = null;
      if (controller.mode === 'pause') { dialog = 'pause'; pauseReason = '已保存稳定棋盘，点击继续恢复。'; }
      paint();
    }
    function download(name, text, mime = 'application/json') {
      const blob = new win.Blob([text], { type: mime }), url = win.URL.createObjectURL(blob), link = doc.createElement('a');
      link.href = url; link.download = name; doc.body.append(link); link.click(); link.remove(); win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
      notice('已请求下载；请在浏览器下载列表确认文件。');
    }
    function diagnostic() {
      return { gameVersion: p.GAME_VERSION, contentVersion: content.CONTENT_VERSION ?? p.CONTENT_VERSION, candidate: true, layout: device(), viewport: { width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio || 1 }, levelId: save.current?.levelId ?? null, state: save.current?.state ?? null, actions: save.current?.actions ?? [], hintTier: save.current?.hintTier ?? 0, errorCategories: errors, automated, sessionId, owner, seed: null };
    }
    function replaceSave(next) {
      view.cancel(); controller.menu(); save = next; controller.save = next; pendingImport = null; selected = null;
      clock = new timing.PlayClock({ stats: save.stats, sessionId, automated, device: device() });
      override = save.settings.layout; dialog = null; screen = 'home';
      if (save.current) { controller.restore(); dialog = 'pause'; pauseReason = '已载入存档的稳定检查点，请继续。'; }
      persist(); paint();
    }

    async function action(name, target) {
      if (name === 'load-retry') return;
      const readOnly = ['home', 'levels', 'settings', 'stats', 'tutorial', 'close', 'cancel', 'export', 'csv', 'diagnostic', 'continue', 'resume', 'desktop', 'mobile', 'auto'];
      if (!readOnly.includes(name) && !owner && !claim()) return;
      switch (name) {
        case 'home': view.cancel(); controller.menu(); dialog = null; screen = 'home'; break;
        case 'levels': view.cancel(); controller.menu(); dialog = null; screen = 'levels'; break;
        case 'level': return openLevel(target.dataset.level);
        case 'continue':
        case 'resume': if (!claim()) return; if (save.current) { view.cancel(); controller.restore(); controller.resume(); idlePaused = false; dialog = null; clock.activity(); } break;
        case 'pause': return pause();
        case 'settings': returnDialog = dialog || (controller.mode === 'play' ? 'pause' : null); if (controller.mode === 'play') { view.cancel(); controller.pause(); } return showDialog('settings');
        case 'tutorial': if (controller.mode === 'play') { view.cancel(); controller.pause(); } return showDialog('tutorial');
        case 'stats': if (controller.mode === 'play') controller.pause(); save.stats = clock.snapshot(); return showDialog('stats');
        case 'close': return closeDialog();
        case 'cancel': pendingImport = null; return showDialog('settings');
        case 'select': selectBall(); break;
        case 'strike': return strike();
        case 'undo': view.cancel(); if (controller.undo()) { dialog = null; sound('undo'); notice('已撤销完整一击，历史完成成绩保留。'); } break;
        case 'restart': view.cancel(); controller.restart(); dialog = null; hint = null; break;
        case 'hint':
        case 'more-hint': return requestHint();
        case 'next': { const index = levels.indexOf(controller.level); if (index + 1 < levels.length) return openLevel(levels[index + 1].id); return showDialog('main-result'); }
        case 'muted': save.settings.muted = !save.settings.muted; if (save.settings.muted) for (const player of audio.values()) player.pause(); break;
        case 'reducedMotion': save.settings.reducedMotion = !save.settings.reducedMotion; break;
        case 'symbols': save.settings.symbols = !save.settings.symbols; break;
        case 'desktop':
        case 'mobile':
        case 'auto': {
          override = name; save.settings.layout = name;
          const url = new win.URL(win.location.href); if (name === 'auto') url.searchParams.delete('layout'); else url.searchParams.set('layout', name);
          win.history.replaceState(null, '', url); break;
        }
        case 'export': save.stats = clock.snapshot(); download('pocket-bounce-save.json', p.exportSave(save)); return;
        case 'csv': download('pocket-bounce-time.csv', statsCSV(clock.snapshot()), 'text/csv;charset=utf-8'); return;
        case 'diagnostic': download('pocket-bounce-diagnostic.json', JSON.stringify(diagnostic(), null, 2)); return;
        case 'import': $('#import-file').value = ''; $('#import-file').click(); return;
        case 'confirm-import': if (pendingImport && claim()) { replaceSave(pendingImport); notice('存档已导入。恢复局面需显式继续。'); } return;
        case 'reset': return showDialog('reset');
        case 'confirm-reset': if (claim()) { replaceSave(p.createSave()); notice('本地数据已重置；若有备份，可重新导入。'); } return;
        default: return;
      }
      persist(); paint();
    }
    doc.addEventListener('click', event => {
      const target = event.target.closest?.('[data-action]'); if (!target || target.disabled) return;
      audioStarted = event.isTrusted || audioStarted;
      if (event.isTrusted) clock.activity(); sound('click');
      action(target.dataset.action, target).catch(fail);
    });
    $('#board').addEventListener('pointerdown', event => {
      event.preventDefault(); if (dialog || controller.mode !== 'play' || controller.locked || event.button !== 0 && event.pointerType === 'mouse') return;
      audioStarted = event.isTrusted || audioStarted; if (event.isTrusted) clock.activity();
      const box = $('#board').getBoundingClientRect(), ball = view.hit(event.clientX - box.left, event.clientY - box.top);
      if (ball) { selected = ball.id; strike(ball.id).catch(fail); } else notice('这里没有静止球。请点带箭头的球。');
    });
    doc.addEventListener('keydown', event => {
      if (event.isTrusted) { clock.activity(); audioStarted = true; }
      if (event.key === 'Tab' && dialog) {
        const buttons = [...$('#dialog').querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && (doc.activeElement === first || doc.activeElement === $('#dialog'))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.target.closest?.('button, input, a') && event.key !== 'Escape') return;
      if (event.key === 'Escape') { event.preventDefault(); if (!dialog && controller.mode === 'play') pause(); else if (dialog !== 'pause' && dialog !== 'result') closeDialog(); return; }
      if (dialog || controller.mode !== 'play' || event.repeat) return;
      const key = event.key.toLowerCase();
      if (['arrowright','arrowdown','arrowleft','arrowup'].includes(key)) { event.preventDefault(); selectBall(key === 'arrowleft' || key === 'arrowup' ? -1 : 1); paint(); }
      if (key === 'enter' || key === ' ') { event.preventDefault(); strike().catch(fail); }
      if (key === 'z') { event.preventDefault(); action('undo', {}).catch(fail); }
      if (key === 'r') { event.preventDefault(); action('restart', {}).catch(fail); }
    });
    $('#import-file').addEventListener('change', async () => {
      const file = $('#import-file').files[0]; if (!file) return;
      try {
        if (file.size > 2000000) throw new Error('存档超过 2MB，拒绝导入。');
        pendingImport = p.importSave(await file.text(), levels); showDialog('import-confirm');
      } catch (error) { pendingImport = null; fail(new Error(`导入未覆盖原存档：${error.message}`)); }
    });
    win.addEventListener('resize', () => { if (!view.animation) paint(); });
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) {
        view.cancel(); if (controller.mode !== 'menu') { controller.pause(); dialog = 'pause'; pauseReason = '离开页面后已暂停；离开时间不计有效游玩。'; }
        clock.setContext({ mode: 'hidden', owner }); persist(); lease.release(); owner = false;
      } else { claim(); clock.setContext({ mode: controller.mode === 'menu' ? 'menu' : 'pause', owner }); paint(); }
    });
    win.addEventListener('pagehide', () => { view.cancel(); clock.setContext({ mode: 'hidden', owner }); persist(); lease.release(); owner = false; });
    win.addEventListener('pageshow', event => { if (event.persisted) { claim(); if (controller.state) pause('页面已恢复，请继续稳定棋盘。'); } });
    win.addEventListener('storage', event => {
      if (event.key === lease.key && owner && !lease.owns()) { owner = false; pause('另一标签页获得了使用权；此页已暂停，不会重复累计。'); }
      if (event.key === p.SAVE_KEY && !owner) {
        const next = p.loadSave(storage, levels); save = next.save; controller.save = save;
        clock = new timing.PlayClock({ stats: save.stats, sessionId, automated, device: device() });
        if (save.current) { controller.restore(); dialog = 'pause'; } else { controller.menu(); dialog = null; }
        notice('已接收另一标签页的最新稳定存档。'); paint();
      }
    });
    win.setInterval(() => {
      if (owner && !lease.renew()) { owner = false; pause('本机使用权已过期，请继续以重新获取。'); }
      context(); clock.tick(); updateClock();
      const idle = win.performance.now() - clock.lastActivity;
      if (controller.mode === 'play' && !dialog && idle >= 300000) pause('超过 5 分钟无输入，已标记疑似挂机。点击继续恢复计时。', { idle: true });
      if (++refreshCount % 5 === 0) persist();
      if (win.performance.now() - lastActivityPaint > 1000) lastActivityPaint = win.performance.now();
    }, 1000);
    controller.restore();
    if (save.current) { dialog = 'pause'; pauseReason = '检测到上次稳定棋盘。点击继续，不补计离开时间。'; }
    if (loaded.warnings.length) notice(loaded.warnings.join('；'));
    if (!owner) notice('另一标签页正使用此存档，或本地存储不可用；请处理后显式继续。');
    paint();
    return { controller, view, get clock() { return clock; } };
  }
  retry.addEventListener('click', start);
  await start();
  return runtime;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  boot().catch(error => {
    const target = document.querySelector('#loading-error'); if (target) target.textContent = `启动失败：${error.message}`;
    const retry = document.querySelector('#load-retry'); if (retry) retry.hidden = false;
  });
}
