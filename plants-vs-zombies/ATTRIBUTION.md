# 来源、许可与改动说明

## 上游来源

- 仓库：https://github.com/plantsvszombiesjs/plantsvszombiesjs.github.io
- 分支：main。
- 固定提交：edd9496907be1e73ce62eecf2316fdeed0b88368。
- HTML 来源：https://raw.githubusercontent.com/plantsvszombiesjs/plantsvszombiesjs.github.io/edd9496907be1e73ce62eecf2316fdeed0b88368/index.html
- 许可证来源：https://raw.githubusercontent.com/plantsvszombiesjs/plantsvszombiesjs.github.io/edd9496907be1e73ce62eecf2316fdeed0b88368/LICENSE
- 软件许可证：MIT；上游完整原文保存在同目录 LICENSE，字节不变。
- 上游版权行：Copyright (c) 2025 Valentyn Kolesnikov <0009-0003-9608-3364@orcid.org>

## 导入范围与本仓库改动

只通过 curl 导入固定提交的 index.html（上游 81345 字节）与 LICENSE，没有 clone 或下载上游其他文件。

- 将游戏放入 plants-vs-zombies/，遵循“每个游戏一个文件夹”的结构约定。
- 从游戏 HTML 删除唯一一行 favicon.ico 图标声明，未下载或分发该图标；不添加替代图像、data: 图片或外链资源。
- 保留 HTML 开头原有 MIT 与作者版权注释，不修改上游 JavaScript、CSS、英文界面、难度或玩法。
- 新增中文游戏 README.md、本来源说明，以及仓库根游戏列表页、总 README.md 和 .gitignore。
- 本地测试脚本和日志在仓库外；REPORT.md 为忽略的本地执行报告，不属于发行内容。

## 素材与权利边界

固定版本的游戏以 Unicode emoji、文字和 CSS 实现，不包含图片、音频、视频、SVG、canvas 或字体文件，不含 http(s) 外链或 data: 内嵌图片。emoji 的字形来自用户系统字体，本仓库不分发字体。

未下载或纳入 PopCap / EA 原版美术、声音、代码、数据文件、main.pak 或破解文件。上游 favicon.ico 未导入。本次检查基于所导入源码与实际待提交文件，不将 MIT 软件许可扩大解释为对任何第三方专有内容的授权。

本项目非官方，与 PopCap、Electronic Arts（EA）无关；名称、商标及玩法相关权益归其各自权利人。上游 MIT 许可与作者版权行原样保留。


## 本项目新增的原创美术素材（2026-11-12）

- 位置与内容：`plants-vs-zombies/art/` 共 17 个文件——9 种植物（向日葵、豌豆射手、双发射手、寒冰射手、坚果墙、大嘴花、三线射手、火焰豌豆、仙人掌）、5 种僵尸（普通、路障、铁桶、快速、巨型）、阳光、豌豆子弹，以及一张草坪战场背景图（`bg_lawn_v2.jpg`）。
- 生成方式：由本项目自行撰写描述词，用 AI 图像生成模型（OpenAI `gpt-image-2`）生成，随后由本项目脚本完成纯洋红底抠除、裁剪、统一尺寸与压缩。生成用的描述词与处理脚本保留在本项目的工作目录中。
- 与上游及第三方的边界：**未使用、未参考、未提取、未再分发任何 PopCap / EA 原版美术、音频、数据或第三方的素材包**。所有素材均为按上文方式新生成的原创图形，与任何现有商业游戏的素材不存在复制关系。
- 权利声明：本项目对这些生成素材不作排他性主张，随仓库一并提供，供学习与非商业使用；本段不构成对 PopCap / EA 任何名称、商标或素材权利的许可、主张或放弃。
- 上游代码的改动范围：仅在 `index.html` 中新增 `.sprite` 渲染层、emoji→素材的映射表、草坪背景样式与对应的调用（约 3.8 KB），**未改动任何玩法逻辑**（植物/僵尸数值、波次、AI、伤害判定均保持上游原样）。


## 音效素材（CC0，2026-11-12）

- 位置：`plants-vs-zombies/audio/`（13 个 MP3 + `LICENSE-CC0.txt`），共约 108 KB。
- 来源：Kenney 的三个公共领域音效包——UI 音效（按钮/开关/点击）、50 RPG 音效、Digital 音效；经 OpenGameArt 的 Kenney 镜像下载，转成单声道 44.1 kHz / 64 kbps MP3。
- 许可证：**CC0 1.0（公共领域）**，可商用、无需署名；逐文件对应关系写在 `audio/LICENSE-CC0.txt`。
- 边界：这些是公共领域素材，**不含任何 PopCap / EA 原版音频**，与上游素材无任何关系。
- 覆盖的音效：点击、放置植物、豌豆发射、豌豆命中、僵尸受伤/死亡/低吼、僵尸啃食、收集阳光、波次开始、胜利、失败、植物被吃掉。
- 上游代码改动：新增 SFX 播放模块（音效池、按类型音量与冷却、静音开关并记忆到 localStorage）与 12 处触发调用，**玩法逻辑仍未改动**。


## 场景与割草机素材（2026-11-12，原创）

- 位置：`plants-vs-zombies/art/`
- 新增文件：`bg_scene.jpg`（整块场景）、`bg_house.png`、`bg_hedge.png`（可复用部件）、`item_mower.png`（割草机）。
- 来源：与本作其它精灵图一致，均由本项目的描述词用图像生成模型（gpt-image-2）生成，再做抠底 / 拼合 / 对齐处理；**未使用任何原版或第三方素材**。
- 场景合成方式（`tools/build_scene.py` 一类的脚本流程）：房子与绿篱部件抠掉洋红底 → 与草地纹理合成 → 按游戏 5 行格子的实际像素位置绘制割草条纹与行分隔 → 右侧补人行道与路面。因此草坪分道、房子宽度（左边距）与右侧人行道宽度（右边距）都与版面严格对齐。
- 版权归本项目，可自由发布。

## 音效（补充）

- `audio/mower.mp3`（割草机启动）：Kenney「50 RPG 音效」的 beltHandle2，CC0 公共领域。
