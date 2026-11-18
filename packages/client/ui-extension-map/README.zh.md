---
description: "只读展示运行时声明的界面扩展位置、位置建议和主题配置能力。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-extension-map

[English](README.md) | 中文

## 概述

开发显性界面功能前，先查看运行时真实声明的 UI 扩展位置。独立插件读取与 `cordis_inspect_list`、`cordis_inspect_query` 相同的注册表；不搜索市场、不安装插件，也不要求审批。

## 目录

- [使用此包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use-this-package"></a>
## 使用此包

与 Cordis 检查注册表及 Host/Client 提供方一起挂载。`ui_extension_map` 展示全局概览或指定 `region` 的建议。工具所有者可通过 `ctx.extensionMap.inspect(region, execution)` 复用检查。它先发现提供方方法，再查询 Client 的 `Slots.listSubTree`、`Theme.listTokens`，以及主题、布局、右侧栏所有者对应的 Host `Config.listConfigs`。配置检查只读 schema 字段名和状态，不读已保存值。对建议展位按精确根节点查询具名注册项。

创造模式准备显性 UI 新增方案时调用此服务，不受优先检索开关影响。纯工具、模式和服务接入不进行位置检查。两处均有声明时，侧栏建议同时包括面板正文和打开入口。仅建议没有覆盖风险的真实 list/keyed 展位；keyed 渲染器还需所属区域的数据和导航入口配合。其他位置仍可浏览，并明确标注覆盖或包装风险。

Client 展示紧凑的位置画布、简短建议和可展开的技术明细。点击区域浏览其展位。“把位置带入对话”把精确展位标识作为引用添加到原 Session 草稿中，保留已有文字和附件，不发送消息。用户也可直接在对话里描述其他位置，无需强制填写选择题。展位列表单独限高滚动。

其他工具所有者通过 `ctx.uiExtensionMap.registerProducer(name)` 注册原生生产工具，并随自身上下文释放返回的注册。成功结果携带版本化 `extensionMap` 展示元数据；模型内容只含建议、数量和来源失败。创造模式注册 `creator_prepare`，本插件注册 `ui_extension_map`。回放根据对应调用和元数据恢复快照，不重新检查运行时或执行操作。

`slotLimit` 限制保留的展位声明数（默认 512），明确报告省略数量；`recommendationLimit` 限制建议和精确根查询数（默认 3）。提供方缺失、响应无效和查询失败会分别显示，不影响成功来源的事实。卸载会取消正在进行的读取。

<a id="dev-note"></a>
## 开发备注

Host 服务负责有界读取和取消；Client 负责空间浏览和草稿反馈。注册和字典随 Cordis 上下文释放；可恢复事实使用现有工具元数据，不新增 Session 事件。

<a id="model-experience"></a>
## 模型体验

### 位置发现

#### 模型看到什么

只读 `ui_extension_map` 声明说明何时检查界面位置。结果包括指定区域建议、已声明展位数量、主题变量名、公开配置字段名和来源失败。创造策略归调用方所有。完整清单保留在已记录的展示元数据和交互卡片中。

#### Token 影响

可见时增加一个工具声明。结果只含有界建议，不发送整个展位树；具体参数仍可通过精确检查查询获取。

#### KV Cache 影响

配置不变时工具声明稳定，检查结果追加到对话。浏览画布不增加模型输入；发送位置引用时增加普通用户消息。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与待办

- 声明和注册项不能证明此刻可见、兼容或完整可用；实现前需检查精确参数和所属区域 API。Config 的 `absent` 表示没有原生 schema，不表示插件未启用。
- Client 检查采用已连接页面的首个有效响应。卡片是记录快照，不是持续刷新的窗口覆盖层；未知或新增展位保留技术标识。区域按所属名称前缀分组，自定义位置可能归入“窗口与页面”；示意图不报告像素坐标。
- 区域表示应用文档内的位置。没有某个展位不能证明能力不可能实现；系统窗口需另行核实。组件工厂与可挂载展位分别计数。
- 来源失败不授权实现，也不证明位置不受支持。恢复和验证归调用流程负责；插件不注册界面、不安装插件，也不决定市场路径。
