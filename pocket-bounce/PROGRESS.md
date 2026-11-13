# 检查点 1：规则可运行原型，未交付

继承13文件已归档并保存外层哈希。新增四向六拍内核、10项独立手写预期、串行有界 BFS、四个教学关、独立参考规则/搜索及模块串联。17张原图按哈希原样复制。无重绘、无其他游戏改动。

真实运行：tools/run_tests.py 每次仅一个文件，Node 192MB堆，--test-concurrency=1。默认 Node 测试子进程模式首次卡住，外层停止；evidence/engine.test.mjs.log 保留首次无结果命令，不计通过。改用 Node 官方 --test-isolation=none 后逐文件正常完成；这只是此应用测试的低进程执行方式，不能证明网关根因已修复。logs/core-direct.log（外层）为额外直跑成功证据。

证据：evidence/*test.mjs*.log，规则/solver/继承controller/loader/timing/persistence，全部退出0、取消0。随后 integration.test.mjs 与 tools/validate_levels.js 另行执行。最新状态以外层 REPORT.md / RESULT.json 为准。

剩余：完整60个非同构内容、HTTP资源检查、全流程回归；双端真实浏览器/真机/美术/60fps/新手盲测/三小时首次有效内容均未验证，交协调方。4关原型不得冒称60关/三小时。

## run2 检查点 2（2026-11-13）

本次同模型调用已成功；未启动任何模型子进程、未循环探测。严格串行重跑 engine / solver / controller / loader / timing / persistence / integration，随后 migration / app，全部退出0、取消0；原始输出新增 evidence/*.attempt*.log，不覆盖 run1。DOM fixture 四种尺寸鼠标/模拟触控接线通过，不等于真实浏览器/真机。沿用未提交的应用/音效/迁移改动，7个本地许可音效及来源已保存。

现场与输入说明有差异：初始 HEAD=2dd49dd，但旧 origin/main 仍是1a99645，fdd92ba 未在本地对象库；实际 fetch 后 origin/main=fdd92ba，与本地各领先1提交。将合并该协调方提交而非重写/覆盖 board。身份以命令级 -c 指定 Dawyer，不更改配置。

接续：先保存推送此四关原型，再加固提示失效边界、音效和迁移测试；之后有界搜索复核内容，最后列出真实设备与盲测未验项。

## 检查点 3（2026-11-14，HW/cline 续做）

本轮模型 cline（cline-pass/deepseek-v4.1-flash）。从 4349f24 + 继承未提交改动续做。

- 规则基线冻结：RULES.md 去掉“候选规则”，六个小节为唯一规则源；新增 tests/rules-baseline.test.mjs（每条规则手写样例 + tools/reference.mjs 差分，含非空洞对照）。commit 5bd748e。
- 修补已知缺口：index.html 声明本地 favicon（真实 Chromium 零 4xx）；tools/validate_levels.js 自动创建被忽略的 evidence/（干净检出不再 ENOENT）；收尾 product-boundaries.test.mjs / browser-check.cjs / PLAYTEST-CHECKLIST.txt。commit 26451e7。
- 体验门禁加强（只加不减）：减弱动效立即收敛动画、A–F 字母为真实渲染开关、版本在 UI 可定位、CSV 与计数账本对账、导入导出为严格不动点、开关落到 document。
- 关卡扩展：新增 05–10（第 2 章木箱 3 关、第 3 章接力 2 关、第 4 章双镜 2 关中的 09/10），每关 par 由独立参考 BFS 证明，差分回放一致。第 5、6 章仍空。
- 实测：串行 13 文件 / 69 测试全绿；validate_levels 10 关 VERIFIED；真实无头 Chromium 双端（1280/1920/360/390）每端 10 关 3 星、0 脚本错误、0 个 4xx、自动账本与真人账本分离。原始证据在 evidence/（被 .gitignore 忽略，未冒称入库）。
- 未验证：实体手机、用户画风认可、三小时真人首次主线、协调方独立验收、第 5/6 章内容与 60 关目标。未推送、未部署。