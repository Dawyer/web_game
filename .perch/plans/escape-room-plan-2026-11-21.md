# 《雨夜档案馆》密室逃脱原型实施计划

## 目标
做一个纯前端、单机、双端可玩的密室逃脱：找道具 → 组合线索 → 推理密码 → 逃出三间房。本次交付为**未验收原型**，不宣称通过验收、不并入已收录清单。

## 现状与约束（已核查）
- 仓库现有两款游戏；根 `index.html:24` 写“当前收录 1 个游戏”，只列 PvZ；`pocket-bounce/` 仍在待验收（`board.html:87-104`），未进根清单。
- `board.html:82` 原文：“游戏制作仍串行，一个通过全部验收后才做下一个；已终止项目不恢复。” 本次按用户 2026-11-21 直接请求视为开工授权；不改动 pocket-bounce 状态，不宣称串行门禁已解除。
- `board.html:83` 通用标准：每游戏独立目录、零外链/零内嵌图片、双端分别验收、有效计时与首次/重玩分开、规则先定稿、无账号付费广告。
- 看板真源在仓库外 `~/.hermes/los-nightly/board.json`（`tools/task-board/README.md:5`），`build_board.py:10` 默认输出不在本仓库；因此本次只在本仓库 `board.html` 加可见卡片，并标注需维护者回写真源后重生成，否则下次生成会覆盖。
- 推荐骨架参照 `pocket-bounce/`（模块化、Pointer Events、`data-layout`、严格存档/计时），不沿用 PvZ 的横屏拦截（`plants-vs-zombies/index.html:826-834`）。

## 游戏设计（规则先冻结到 escape-room/RULES.md）
三关，统一主题“雨夜档案馆”，原创名称与美术，不借用任何现成 IP。

### 第 1 关 阅览室
- 热点：花瓶、上锁抽屉、书架、挂钟、油画、地毯、密码门。
- 道具：铜钥匙（花瓶）→ 开抽屉得镜片 + 便条上半；地毯下得便条下半 + 铜铃。
- 组合：两张便条合成完整规则：“顺序：钟、画、书、铃；铃之数 = 书之数 − 1。”
- 观察：镜片照钟 → 时针 9；镜片照画 → 4 个人影；书架红书 7 本；铜铃 6 道刻痕（与 7−1 一致）。
- 门密码：`9476`。解锁后取得手电筒，进入第 2 关。

### 第 2 关 暗廊
- 用手电筒照左/中/右三张海报，显出 △、○、□；墙上图例 △=2、○=8、□=5。
- 档案柜三位密码：`285`（按左→中→右）。开柜得旧照片，进入第 3 关。

### 第 3 关 前厅
- 四色按钮绿/红/蓝/黄；旧照片显示人物围巾顺序绿→红→蓝→黄。
- 按顺序点击开门，错误则重置并给反馈；正确后显示逃脱结算与统计。

### 通用机制
- 每关三档提示：思路 / 下一步 / 完整解；提示计入统计但不判失败。
- 撤销上一步、重置本关、返回选关；存档保存当前场景、道具、已用线索、密码盘输入。
- 坏档保留原文备份；schema 版本迁移；导出/导入 JSON 与 CSV 计时。

## 技术骨架
```
escape-room/
  index.html            单页骨架，本地 style.css + src/app.mjs
  style.css             桌面基线 + [data-layout="mobile"]，44px 命中、安全区
  src/app.mjs           启动、动作分派、Pointer Events、键盘、生命周期
  src/controller.mjs    无 DOM 状态机：open/use/combine/undo/reset/settle/hint
  src/engine.mjs        纯规则：热点、道具、组合、密码判定（不 import DOM）
  src/levels.mjs        三关数据 + CONTENT_VERSION
  src/persistence.mjs   SAVE_KEY、严格校验、迁移、备份、导入导出
  src/timing.mjs        PlayClock 分账计时、首次/重玩统计
  src/view.mjs          layoutFor、渲染、命中测试、动效（不改稳定状态）
  src/loader.mjs        art 清单白名单、加载失败重试、拒绝远程 URL
  art/                  原创 SVG：三张场景背景、家具、道具、UI 图标
  RULES.md              唯一规则源（先定稿）
  README.md / ATTRIBUTION.md / LICENSE
  tests/*.test.mjs      node --test 逻辑、存档、计时、提示
  tools/validate_story.js  独立复核三关可解、密码唯一、无死路
  tools/browser-check.cjs  四视口真实输入回放
  PLAYTEST-CHECKLIST.txt   人工试玩清单
```
无构建步骤；本地 `python3 -m http.server` 即可运行。素材只引用本目录 `art/`（独立 SVG 文件，非 data: 内嵌）；音效由 WebAudio 运行时合成，不引入音频文件或外链，ATTRIBUTION 中写明。

## 双端与交互
- 同一页面 `data-layout` 切换：宽度 <800 自动 mobile，支持 `?layout=desktop|mobile` 强制；手机竖屏直接可玩，不弹横屏提示。
- 鼠标/触屏统一走 `pointerdown`，按钮 ≥44px，`touch-action: manipulation`，画布/热点 `touch-action: none`。
- 键盘辅助：Tab/Enter 操作热点，Z 撤销，R 重置，Esc 暂停。

## 计时与统计
- 有效时间只在 play 上下文累计；弹窗、暂停、后台、>5 分钟无输入不计入。
- 每关记录 attempts/resets/hints/firstClearMs/completed；首次通关与重玩分开；localStorage 持久化，可导出 CSV。

## 验收自检（自动结果只算自检，不等于验收）
1. `node --test escape-room/tests/*.test.mjs`：规则、密码、组合、存档往返/坏档/迁移、计时边界、三档提示。
2. `node escape-room/tools/validate_story.js`：独立参考实现复核 9476 / 285 / 颜色顺序唯一可解，线索链无死路。
3. `node escape-room/tools/browser-check.cjs`：1280×720、1920×1080、360×800、390×844 真实点击/tap 通关；0 JS 错误、0 个 ≥400、无横向溢出、刷新续玩、按钮命中 ≥44px。
4. 人工截图：桌面 1280×720 与手机 375×760 各一张；`PLAYTEST-CHECKLIST.txt` 留空待真人填写，不冒称通过。

## 仓库同步
- `board.html`：在“待排期”新增 `data-task-id="escape-room"` 卡片，标注原创、三关、验收要点、用户直接授权开工；注明真源在仓库外需回写。
- 根 `index.html` / `README.md`：新增“未验收原型”条目链接 `./escape-room/`，**不计入**“当前收录 1 个游戏”，避免把原型说成已收录。
- 不改动 `pocket-bounce/`、`plants-vs-zombies/`、`tools/task-board/` 生成逻辑。

## 交付物
`escape-room/` 完整可玩原型 + 三关可通 + 自检记录 + 看板卡片 + 根清单原型入口。明确未验项：实体手机、真人首次盲测、协调方验收、画风用户判定、部署/回滚。