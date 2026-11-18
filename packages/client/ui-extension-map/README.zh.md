---
description: "暂停并选择已核实的界面布局，或只读浏览运行时扩展位置。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-extension-map

[English](README.md) | 中文

## 概述

开发显性界面功能前，先选择它会出现在哪里。创造模式调用此独立插件，不受市场检索开关影响；模型暂停，等待用户直接在画布中确认布局。

## 目录

- [使用此包](#use-this-package)

- [开发备注](#dev-note)

- [模型体验](#model-experience)

- [已知限制与待办](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用此包

与 Cordis 检查注册表及 Host/Client 提供方一起挂载。`ctx.extensionMap.inspect(region, execution)` 发现提供方，读取 Client 的 `Slots.listSubTree`、`Theme.listTokens` 及主题、布局、右侧栏所有者对应的 Host `Config.listConfigs`。配置检查只读 schema 字段和状态，不读已保存值。`slotLimit` 限制声明数（默认 512）；`recommendationLimit` 限制建议与精确根查询数（默认 3）。

`ctx.extensionMap.review(map, design, execution)` 依赖用户提问服务，等待一次阻塞式布局决策。右侧面板同时包含正文与打开入口，两者是同一方案的部件，不是互斥选项。主要备选包括对话卡片、独立页面和输入框附近的小面板；标题栏、左侧栏、设置和插件页入口收在其他位置中。确认后返回所选区域及全部所需展位标识；暂不决定返回 `cancelled`，不授权开发。卸载或调用方取消会中止等待。

位置面板只展示简短效果、空间选项、推荐项和固定确认栏；使用方式默认折叠。不展示展位数量、CSS 变量，也不需要把引用带入输入框再发送。预选不会提交答案。桌面面板最多 55vh / 460px，窄屏最多 60vh，正文独立滚动。

`ui_extension_map` 用于独立的只读浏览。清单默认折叠，不提供决策按钮，也不暂停等待选择。精确标识与风险仅在各位置详情中展示；主题和配置数据保留在工具元数据中，不铺在用户画布上。

工具所有者通过 `ctx.uiExtensionMap.registerProducer(name)` 注册原生生产工具，并随自身上下文释放返回的注册。成功结果携带版本化 `extensionMap` 元数据，可附加 `placementChoice`。创造模式注册 `creator_prepare`，本插件注册 `ui_extension_map`。准备期间对话里只显示普通工具状态；已确认布局只留一行结果，不重复画布。回放使用已记录元数据，不重新查询提供方或执行操作。

<a id="dev-note"></a>
## 开发备注

Host 负责有界检查和等待提问；提问所有者保留通道状态、提交与取消，本插件渲染 keyed 的 `conversation.question.presentation`。注册和字典随 Cordis 上下文释放；使用已有工具元数据记录位置结果，不新增 Session 事件。

<a id="model-experience"></a>
## 模型体验

### 位置发现

#### 模型看到什么

`ui_extension_map` 返回有界声明和来源失败；`creator_prepare` 只返回所选布局的声明。已有注册项是相邻界面，不代表能力匹配；具体参数和所属区域 API 仍通过 Cordis 检查获取。调用工作流负责开发和权限决策。

#### Token 影响

增加一个只读工具声明。完整清单保留在展示元数据中，不发送给模型；用户选择返回紧凑布局，不发送整棵树。

#### KV Cache 影响

配置不变时工具声明稳定。检查结果和已接受的位置结果追加到对话；本地调整选项不增加模型输入。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与待办

- 声明不证明当前可见或已正确接入；开发前仍需核实精确参数、导航和所属区域 API。Config 的 `absent` 表示没有原生 schema，不表示插件已关闭。

- 检查使用已连接页面的第一个有效响应。示意图记录声明，不记录像素坐标；部分失败保留在元数据中，缺失信息不能证明不支持。

- 布局方案必须包含全部所需真实展位，keyed 布局必须使用全新唯一 key，覆盖警告针对已占用 key；选择不安装插件、不注册界面，也不授权覆盖已有渲染器。缺少专用 Client 渲染时回退为普通问题选项。

- 区域指应用文档内部；操作系统级窗口需单独核实能力。阻塞式位置提问遵循已有提问服务的中断行为。
