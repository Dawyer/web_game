# 网页游戏合集

本仓库按“每个游戏一个文件夹”的结构约定整理独立网页游戏。根目录只提供游戏列表与仓库说明；各游戏的代码、许可证、来源及玩法说明均放在自己的文件夹内。

## 游戏清单（当前 1 个）

- [Plants vs Zombies：非官方粉丝塔防实现](./plants-vs-zombies/)：纯静态 HTML/CSS/JavaScript，美术为项目自有的原创卡通精灵图（`plants-vs-zombies/art/`），音效为 CC0 公共领域素材（`plants-vs-zombies/audio/`）；代码采用 MIT 许可证。详见 [玩法与运行说明](./plants-vs-zombies/README.md)、[来源与改动](./plants-vs-zombies/ATTRIBUTION.md) 和 [许可证原文](./plants-vs-zombies/LICENSE)。

## 目录约定

    index.html                    游戏列表页
    README.md                     仓库说明与游戏清单
    .gitignore                    忽略本地执行产物等
    plants-vs-zombies/
        index.html                游戏入口
        LICENSE                   上游许可证
        ATTRIBUTION.md            来源、固定版本与改动说明
        README.md                 中文玩法、运行说明与免责声明

新增游戏必须新建独立文件夹，不把游戏实现、素材或游戏专属许可证堆放在根目录。各游戏的许可独立说明，不将某个游戏的许可证视为整个合集的统一许可。

## 本地运行

在仓库根目录执行：

    python3 -m http.server 8000 --bind 127.0.0.1

打开 http://127.0.0.1:8000/ 查看游戏列表，点击游戏进入。终端按 Ctrl+C 停止服务。无需 npm、构建步骤或外链依赖。

## 权利与免责声明

当前收录的是非官方开源粉丝实现，与 PopCap、Electronic Arts（EA）无关，未获其背书。本仓库不含任何原版 PvZ 素材，包括原版美术、音频、代码、数据文件、main.pak 或破解文件。相关名称、商标与玩法权益归各自权利人；MIT 软件许可不转授第三方专有权利。

REPORT.md 为本地执行报告，由 .gitignore 排除，不属于游戏发行文件。

## 开发板

`board.html` 是全部游戏任务与排期的看板（已上线 / 待验收 / 开发中 / 计划中 / 待排期），另含可合法使用原版素材的老游戏候补与明确不做的清单。页面自包含，不引用任何外部资源。
