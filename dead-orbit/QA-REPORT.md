# 静默轨道 DEAD ORBIT · 公开上线 5 方面核验报告

生成日期：2026-11-21 ｜ 内容版本 1.0.0

> 本报告区分「已自动验证」「静态配置检查」「未验」。自动检查不等于真人验收，手机模拟不等于实体机。
> 浏览器环境说明：本环境无系统 Chrome，通过 npm 包 `@sparticuz/chromium` 取得 Chromium 二进制并配合 Playwright 完成四视口真实浏览器回放。截图字体为测试环境额外安装的 Noto Sans SC，游戏本身不加载任何外部字体。

## 方面 1：首屏 30 秒可上手（零说明开局）

| 项 | 状态 | 证据 |
|---|---|---|
| 开场直接给目标 | 已验证 | `NARRATIVE.intro` 含「发射码校验失败，需三组授权」；DOM 冒烟确认开场弹窗显示 |
| 首个热点呼吸高亮引导 | 已验证 | `controller.suggestHotspot()` 初始返回 `locker`；CSS `.hotspot.suggest` 有 `breathe` 动画 |
| 3 步交互教学 | 已验证 | `app.mjs` intro 弹窗 `<ol class="howto">` 四条：点物体→拾取→选中道具使用→推理输入 |
| 找 3 人盲测 2 分钟找到第一件道具 | 未验 | 需真人，见 PLAYTEST-CHECKLIST.txt |

## 方面 2：双端真机可玩

| 项 | 状态 | 证据 |
|---|---|---|
| 竖屏直接可玩、不横屏提示 | 静态通过 | `layoutFor()` 窄屏返回 mobile；`[data-layout=mobile]` 单列布局；无横屏遮挡层 |
| 按钮 ≥44px | 静态通过 | `style.css` `min-height/min-width:44px`；layout-check PASS |
| 安全区适配 | 静态通过 | `env(safe-area-inset-*)` 用于 HUD/主区；viewport-fit=cover |
| 横竖切换不破版 | 静态通过 | `resize` 事件调用 `applyLayout()`；CSS 媒体查询兜底 |
| 桌面鼠标 + 键盘 | 已验证 | DOM 冒烟用 pointerdown 走完全程；onKey 支持数字/Enter/Backspace/Esc/H/J/M |
| 四视口真实浏览器回放 | 已验证 | `tools/browser-check.cjs` 实跑：1280×720 / 1920×1080 / 360×800 / 390×844 四视口全部通关，0 JS 错误、0 个 ≥400、无横向溢出、移动端按钮 ≥44px（`evidence/summary.json` allPass=true） |
| 实体手机真机试玩 | 未验 | 需真人真机；手机模拟器不等于实体机 |
| 桌面/手机验收截图 | 已产出 | `evidence/desktop-1280x720.png`、`mobile-390x844.png` 等四张，已人工查看画面完整、中文正常、结局弹窗标题正确 |

## 方面 3：存档续玩与版本回退

| 项 | 状态 | 证据 |
|---|---|---|
| 刷新/关闭后续玩 | 已验证 | persistence 往返测试通过；DOM 冒烟确认通关后存档立即落盘（savedEscaped=true） |
| localStorage 严格校验 | 已验证 | `validateSave/validateState/validateStats`；非法字段被拒测试通过 |
| 坏档保留原文备份 + 明确中文提示 | 已验证 | `retainBackup()` 测试通过；app 对 corrupt 状态显示中文提示 |
| 版本迁移旧档不崩 | 已验证 | `migrateKnown()` 测试通过（schema 1 版本更新） |
| 导出/导入 | 已验证 | 往返测试通过；app 有导出/导入动作 |
| 多标签页防重复计时 | 已验证 | OwnerLease 测试通过 |

## 方面 4：加载性能与稳定性

| 项 | 状态 | 证据 |
|---|---|---|
| 纯本地静态资源、无构建 | 已验证 | 无 package.json；入口只引本地 css/mjs/svg |
| 零 http(s) 外链、零内嵌图片 | 已验证 | `resources.test.mjs` 5 项全过（页面/CSS/源码/SVG 均无外链与 data:image） |
| 0 console 报错 | 已验证 | DOM 冒烟 `errors: []`；四视口真实浏览器回放每个视口 `errors: 0` |
| 0 个 404 | 已验证 | 四视口真实浏览器网络监听每个视口 `badResponses: 0`；12 个资源 HTTP 全部 200 |
| 资源加载失败有重试提示 | 部分 | 场景 SVG 为本地单文件，失败时 alt 文本显示；无专门重试按钮 |
| 不依赖外部字体/CDN | 已验证 | CSS 用系统字体栈；无 @import |

## 方面 5：无障碍与零死局

| 项 | 状态 | 证据 |
|---|---|---|
| 三层提示、输错不锁死 | 已验证 | engine 测试：提示逐层封顶、错误码后仍可输入正确码 |
| 声音线索有视觉对应 | 已验证 | 信标星用数字+亮度文字标注；生维读数文字显示；声音只做氛围反馈 |
| 减弱动效开关 | 静态通过 | `[data-reduced=true] * { animation:none }`；设置可切换 |
| 数字+文字双重标识 | 已验证 | 信标星 `4/1/8` + 「最亮/次亮/最暗」；物品栏带序号 |
| 键盘全程可达 | 静态通过 | onKey 覆盖全部功能；按钮为原生 button 可 Tab |
| 关声音完整通关 | 已验证（逻辑层） | 通关不依赖任何声音信息；DOM 冒烟在无音频环境通关成功 |

## 自检汇总

- 纯逻辑单测：47 pass / 0 fail（5 文件）
- jsdom DOM 接线冒烟：完整通关成功，0 报错，存档正确落盘，结局弹窗标题正确
- 布局/无障碍静态配置检查：18/18 通过
- 四视口真实浏览器回放：4/4 视口通关，0 JS 错误、0 个 ≥400、无横向溢出、移动端按钮 ≥44px
- 双端验收截图：4 张已产出并人工查看
- 实体手机 / 真人盲测 / 画风判定：**未验**

## 结论

游戏逻辑、存档、计时、DOM 接线、资源合规、双端配置、四视口真实浏览器回放与双端截图均已实现并验证通过。公开上线前仍需完成真人盲测与实体手机试玩、由用户判定画风与体验。这些未验项不构成「已完成验收」，见 PLAYTEST-CHECKLIST.txt。
