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
