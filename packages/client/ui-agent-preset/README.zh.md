---
description: "在 Web 中选择 Agent preset 和新任务默认值，查看各模式的说明与声明的配置。创建与修改引导至创造模式。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-agent-preset

[English](README.md) | 中文

## 概述

在 Web 中选择 Agent preset 和新任务默认值，查看各模式的说明与声明的配置。创建与修改引导至创造模式。

## 目录

- [使用此包](#use-this-package)
- [实验性创造模式控件](#experimental-creator-controls)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

设置页显示内置与自定义卡片分组、默认项高亮和点击卡片选择；没有 preset 的分组不显示，但自定义分组会保留其创造入口。粗指针设备完整显示卡片描述；其他设备最多显示四行描述，悬停可查看全文。每张卡片都提供「查看配置」，以只读 YAML 打开该 preset 声明的插件列表，使用 Loader 自己的方言（含 `!!js` 条件）；加载失败的 preset 同样可读，因为其诊断信息正指向这份 YAML。Escape 只关闭查看器并将焦点还给卡片；离开设置页会清空查看器，迟到的读取结果不会重新打开它。本页不编辑任何内容：创造入口启动一个创造模式任务，以 bundle 形式创建或覆盖 preset；当 `cordis` preset 在列表中且存在会话流程时提供。

关闭通用设置中的代码工作工具后，新会话选择器和设置页列表提供标准、创造和自定义预设；开启后还提供 PTC 和极简模式。两种状态下均保留默认值选择和创造入口。选择健康定义作为默认值也会同步当前新任务页面的空白会话。Creator 入口开启一个使用 `cordis` preset 的新任务。

关闭代码工作工具时，沿用现有 Developer tools 订阅清空所有尚未应用的选择。关闭状态被接受后，每个已认证浏览器都会将已保存的内置 PTC 或极简默认值回退为标准模式。已保存的标准、创造和自定义默认值（包括有名称的 PTC 或极简覆盖项）保持不变。关闭后用户仍可重新选择可用预设。已有会话保留所选模式；新会话使用当前默认值。即使已有会话的模式不在菜单中，其标签仍会显示。重新开启代码工作工具不会恢复原默认值或已清除的选择。标准模式缺失或损坏时，默认值保持不变，并显示错误。

已知的内置预设提供只读的模式说明与使用示例对话框。极简模式指南介绍图片读取、自动历史压缩以及会话空闲时的 `/compact` 命令。各页签保留各自的滚动位置；关闭后焦点回到打开它的操作。帮助不会改变新任务默认值。默认徽标取代卡片的分组徽标，预设 id 显示在标题旁。指南文案与示例归本包所有。

插件页**添加插件**箭头菜单中的**让 Agent 创建插件**进入与设置页相同的创造流程，不发送消息，并保留未发送的草稿。读取预设列表或创造模式不可用时，菜单项禁用并说明原因。Host 拒绝切换预设时，两处入口均通过 Toast 显示原因。

进入创造模式会为接收该选择的空白 Session 选择 `cordis`，不改变新任务默认值或代码工作工具设置。尚未绑定工作区或空白 Session 时，选择等待绑定完成后应用。应用后，创造 Session 保留该预设；之后真正创建的新 Session 使用配置的默认值，例如标准模式。

在桌面端，模式选择器中的直接选择切换到另一个内置 preset 时，可选的[产品埋点](../product-analytics/README.zh.md)服务会收到 `agent_preset_switch`：未绑定 Session 的选择在暂存给下一个 Session 时计入，已绑定空白 Session 的选择在 Host 应用后计入。事件携带按 preset id 映射的来源与目标类别（`cordis` 记为 `creator`；`ptc`、`minimal`、`standard` 保持原 id；其他 id 记为 `other`），以及选择时已知的代码工作工具设置。选择自定义目标、被拒绝的选择、Host 最终落在其他 preset 的选择、默认值修改及其空白 Session 同步均不报告；来源模式或代码工作工具设置未知时做出的选择同样不报告。不采集自定义 preset 的 id 和名称。

<a id="experimental-creator-controls"></a>
## 实验性创造模式控件

创造模式沿用现有的模式选择器和对话界面。尚未开始对话的创造会话在输入框下方同时显示四个启发案例。点击后填入包含具体目标和验证要求的完整示例需求，可编辑，不自动发送。案例分别涉及笔记面板、B 站搜索、代码审查模式和 GitHub Issue 读取。

默认开启的**优先检索**位于输入框工具行，悬停显示说明。它保存当前配置档所有者的 `ui-agent-preset.marketFirst` 偏好，同一配置档的已认证客户端共享；提示策略在保存成功后组装的创造模式请求中生效；准备步骤开始时读取已接受值，开始后不随开关变化。保存被拒绝时保留已接受值并显示错误。关闭后请求直接创造，没有单独的跳过操作。

市场搜索需要可选的[自定义插件索引组合包](../../experimental/plugin-market-bundle/README.zh.md)和已配置的索引源。开关不会启用组合包或添加源。市场设置不可用或没有索引源时，**配置插件搜索**打开插件页，其帮助提示指向实验性插件和发现页。此提示检查已保存的配置，不验证索引可访问性或搜索是否成功。

| 体验 | 当前实现 |
| --- | --- |
| 解释 UI 需求对应的改动位置及影响 | 按任务展示拟定页面、对话、输入框或右侧栏区域及影响说明的卡片；模型仍须核实扩展 API |
| 创造前检索，说明匹配与差距，再提供复用、改造或创建选项 | `creator_prepare` 检索已配置来源，`creator_choose` 展示模型的比较并询问复用、改造或新建；接受选择前阻止实现工具 |
| 处理工具不可用、未配置源、索引失败或无匹配 | 配置提示加已记录的检索状态与来源错误；选择中提供重新检索、先配置或明确新建，不把失败当作无匹配 |
| 保持轻量入口 | 沿用对话和模式选择器，四个案例同时展示，没有轮播或常驻架构图 |

每次准备最多搜索 `discoverySourceLimit` 个来源（默认 3），每来源最多搜索 `discoveryQueryLimit` 组独立关键词（默认 3），每组请求 `discoveryResultLimit` 个结果（默认 5），提供 `discoveryCandidateLimit` 个具有兼容默认版本的候选（默认 3）。`query` 指定主要能力，`alternatives` 提供简短同义词或中英文关键词。结果按包名合并，以各组结果排名的倒数之和排序。多词查询无结果时，会在同一查询预算内逐词扩大检索。来源详情记录实际查询和部分失败。`preparationReadTools` 允许选择前的只读检查，实现仍需等待选择。成功检索但无匹配时提供重试或新建；仅在市场缺失或访问失败时提供配置选项。工具的可选 `indexes` 参数用于在用户要求扩大检索时选择已配置来源。Host 专用 `creatorPreparation` 投影从工具事件恢复当前轮次的放行状态；回放不重新搜索或提问。新轮次或新的人类输入需要重新准备。重试、配置和跳过是正常结果，仍阻止实现；配置和跳过会等待新的用户输入。关闭优先检索后直接进入开发，不强制调用准备工具或再做选择。开启时仅在有兼容候选时比较；市场不可用或无结果时说明原因后继续开发，不强迫配置市场或再次确认新建。安装授权保持不变。

这些控件不新增会话格式或修改核心循环。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

`agentPresets/list` 提供列表并标记当前默认值，`agentPresets/read` 为查看器提供一条声明的 YAML；默认值的修改写入 `agent-preset-registry` settings 命名空间。选择器、空白会话同步和只读会话标签使用记录的 preset 标识。连接重置和设置更新会刷新列表。

`CreatePluginMenuItem` 使用共享的预设列表 store，向 `plugins.add.actions` 贡献菜单项。选择时先调用页面传入的 `onDismiss()`，再调用与设置页 `creatorDraft` 相同的 `startCreatorDraft` 回调。该回调通过 `AgentPresetSeatController` 暂存 `cordis`（主区空白 Session 列出其他 preset 时不暂存，因为导航会打开另一个空白 Session，原空白 Session 保持不变），再通过显式保留草稿并传入 `agentPreset: 'cordis'` 的 `uiWorkspace.startSession` 调用打开任务，由 Host 以创造模式组合被复用的空白 Session 或新 Session；没有目标工作区时，暂存选择在 Session 绑定可用时应用。暂存选择应用后即清除。代码工作工具开启或关闭时均使用同一个选择器和选择 store，`AgentPresetSeat` 通过共享的 `Toast` 组件显示拒绝原因。

`AgentPresetSeatController.select()` 与 `apply()` 返回本次尝试的结果：Host 提交暂存 preset 时为 `applied`；没有当前 Session 时为 `staged`；忙碌、没有暂存选择、Session 已开始或已使用该 preset，或 Host 最终落在其他 preset 时为 `unchanged`；Host 拒绝时为携带原始原因的 `refused`。选择器注入的 `select` 根据该结果报告 `agent_preset_switch`，并且只返回拒绝原因。

</details>

<a id="further-exploration"></a>
## 延伸阅读

- [Scope](../../core/scope/README.zh.md) — 注册隔离。
- [Agent](../../core/agent/README.zh.md) — 会话运行时。
- [Cordis](../../../docs/cordis-primer.zh.md) — 插件配置与生命周期。

<a id="model-experience"></a>

创造模式通过专用的[方案决策插件](../ui-decision-review/README.zh.md)展示候选，把覆盖点、缺口和操作放在一起，元数据折叠收起。`creator_choose.assessments` 提供每个候选的结构化比较，`comparison` 只保留一句摘要。成功结果在对话中保留只读决策记录，其他客户端使用可读的普通问题兜底。

## 模型体验

### 创造前准备

#### What the model sees

[`creator_prepare` 与 `creator_choose` 工具](../../../docs/tool-catalog.zh.md#deepseek-aidsh-client-ui-agent-preset)返回已记录的检索状态、来源错误、兼容候选及用户选择的路径，安装仍未获授权。[创造策略](src/creator-policy.ts)要求模型在选择前说明覆盖与差距。普通预设不接收这些工具或创造策略。

#### Token effect

准备流程为创造请求增加两个小型工具 schema 和有界检索输出。模型的比较仍需一次模型请求，不保证固定 token 节省率。

#### KV Cache effect

更改偏好会改变下一次创造模式的系统提示，可能使缓存前缀失效；不声称固定 token 节省率。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- 开启检索时，工具执行层仅在发现兼容候选后要求选择；查询质量、候选比较和 API 核实仍由模型完成。默认不配置市场索引。
- 已用笔记请求验证实时索引检索和真实模型候选选择；尚未验证候选的安装和复用，配置提示本身不能证明检索成功。
- 区域卡片是示意，不对真实应用做高亮。待答选择使用现有阻塞提问流程；中断后需重新准备。产品外悬浮桌宠、市场分类、投稿、私有或公开分发、审核及分润不属于本包职责。
- 新控件提供中文和英文，其他语言暂回退到英文。


- Web 不创建也不编辑 preset：配置查看器是只读的；通过创造模式安装的 bundle 声明新 preset，或按行 id 覆盖内置 preset，覆盖会替换整个子插件列表。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
