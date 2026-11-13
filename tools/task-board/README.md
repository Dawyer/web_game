# 任务看板

`board.html` 是公开的只读任务看板，保留原地址。游戏与运维、验证、工具任务统一登记。

- 本机唯一真源：`~/.hermes/los-nightly/board.json` 的 `tasks`；`games` 保留旧游戏队列兼容，关联游戏任务修改状态时须同步两处。
- 状态：backlog（待排期）、planned（待开始）、active（进行中）、blocked（阻塞）、verifying（待验收）、shipped（已完成）、cancelled（已取消）。
- 每项任务有 id/name/pitch/kind/state/owner；按需填写 progress/blocker/next_step/evidence/acceptance/done/updated。
- 完成必须有真实核验记录 `evidence`。程序结束、文件存在、测试通过不等同整体交付。游戏仍遵守各自授权与验收标准。
- 构建：`python3 tools/task-board/build_board.py`（默认使用上述本机源和原输出路径；也可在Python中设置模块的 BOARD / OUT 后调用main）。
- 单测：`python3 -m unittest discover -s tools/task-board -p 'test_task_*.py'`。
- `task_notify.py` 是无模型通知器：新任务、待排期任务正式发布、验收完成各通知一次；无变化输出 `[SILENT]`。首次运行只建立快照，不把全部历史任务刷屏；缺少核验记录的完成状态发异常提示，不当作已完成。
- 状态快照：`~/.hermes/los-nightly/task-notify-state.json`；定时任务使用当前QQ对话作目标，不让模型每分钟轮询。
- 看板文件无CDN/外部字体/图片等运行依赖；电脑和手机都能浏览、搜索和按任务类型筛选。
