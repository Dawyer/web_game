# 检查点 1：规则可运行原型，未交付

继承13文件已归档并保存外层哈希。新增四向六拍内核、10项独立手写预期、串行有界 BFS、四个教学关、独立参考规则/搜索及模块串联。17张原图按哈希原样复制。无重绘、无其他游戏改动。

真实运行：tools/run_tests.py 每次仅一个文件，Node 192MB堆，--test-concurrency=1。默认 Node 测试子进程模式首次卡住，外层停止；evidence/engine.test.mjs.log 保留首次无结果命令，不计通过。改用 Node 官方 --test-isolation=none 后逐文件正常完成；这只是此应用测试的低进程执行方式，不能证明网关根因已修复。logs/core-direct.log（外层）为额外直跑成功证据。

证据：evidence/*test.mjs*.log，规则/solver/继承controller/loader/timing/persistence，全部退出0、取消0。随后 integration.test.mjs 与 tools/validate_levels.js 另行执行。最新状态以外层 REPORT.md / RESULT.json 为准。

剩余：音效及许可接线、应用实际DOM启动测试、存档迁移与严校验、完整60个非同构内容、HTTP资源检查、全流程回归；双端真实浏览器/真机/美术/60fps/新手盲测/三小时首次有效内容均未验证，交协调方。4关原型不得冒称60关/三小时。