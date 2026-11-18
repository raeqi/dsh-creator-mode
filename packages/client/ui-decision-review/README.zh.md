---
description: "用候选卡片和决策记录呈现结构化人工选择。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-decision-review

[English](README.md) | 中文

## 概述

用候选卡片呈现需要人工决定的方案，把操作、简短比较与可展开的元数据放在一起。Host 适配器复用提问服务；浏览器插件只接管单题的 `decision-review` 请求，普通问题保留现有展示。

## 目录

- [使用此包](#use-this-package)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用此包

在 `dsh-user-questions` 和 `dsh-client-ui-user-questions` 旁挂载本插件。调用 `ctx.decisionReviews.ask()`，提供调用方问题 id、Agent、取消信号、结构化候选、其他路径及可读的兜底说明。每个操作分别声明本地化按钮名称和返回调用方的选项值，选项值与候选标题必须各自唯一。没有专用渲染器的客户端使用普通问题兜底展示。

卡片把覆盖点、缺口和操作放在一起，版本和来源按需展开。面板收起期间，补充需求按会话保存。提交期间冻结操作；失败保留草稿并允许重试。取消和作用域卸载沿用现有提问生命周期。选定方向不授予安装权限。

调用方可以在成功的已记录工具结果中附带 `decisionReview` 对象，包含 `title`、`choice`、`summary`、`custom` 四个字符串。客户端仅为显式注册的原生工具调用重建决策记录，任意工具输出不能生成决策卡片。默认注册创造模式的选择工具；其他客户端集成可从本包 `/client` 导出注册 `createDecisionRecordDefinition(toolName)`，并在 `dsh.client.external` 声明该模块。回放不发起请求，也不执行操作。

候选渲染器在 `conversation.question.presentation` 下注册 `decision-review`，由提问所有者管理待答载体和提交状态。其他插件可通过 `intent.view.renderer` 与 JSON `data` 提供自己的 keyed 展示，同时保留普通答案选项。

<a id="dev-note"></a>
## 开发备注

Host 通过提问服务拥有操作校验，客户端只负责展示和草稿。服务注册、词典和输入区接管项随插件上下文释放。

<a id="model-experience"></a>
## 模型体验

间接通过创造准备和选择工具：本插件展示其结构化比较，不新增模型工具。

#### KV Cache 影响

模型可见的工具声明和结果记录由调用方负责；渲染和草稿编辑不增加模型输入。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延后工作

- 当前一次处理一个阻塞式单选决策，不接受计时等待，不验证第三方声明、不安装候选、不实施方案，也不替代权限审批。其他客户端需要自己的渲染器，或使用普通问题兜底。阻塞请求仍受提问服务的中断行为约束。

面板在桌面端最多占 48vh / 440px，窄屏最多占 55vh / 480px；空间足够时并排比较候选，补充需求默认收起。
