# DSH Creator Mode — 非官方实验改进

本项目基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，版本 `0.2.2-rc.3`。完整上游历史、[MIT 许可证](LICENSE)及[第三方声明](THIRD_PARTY_NOTICES.md)保留；不代表官方发行版。仓库所有者已授权将改动提交到 [`raeqi/dsh-creator-mode`](https://github.com/raeqi/dsh-creator-mode)，不包含插件市场上架或仓库权限调整。

## 需求覆盖

创造模式沿用 DSH 的模式选择器和对话。目标是帮助用户实现自己的能力：先看懂效果和使用方式，再开发；市场只是可选的复用来源。

| 需求 | 当前行为 |
| --- | --- |
| 了解能创造什么 | 输入框下同时展示笔记面板、B 站搜索、代码审查模式、GitHub Issue 接入四个案例；点击填入完整可编辑需求，不自动发送 |
| 开发前了解预期 | 每个新设计先说明效果与用法；显性界面通过位置画布暂停等待确认；纯工具不虚构独立界面 |
| 选择是否搜索市场 | 默认开启“优先检索”；关闭后显示“直接创作”，仍确认界面位置，但不检索或弹出市场候选选择 |
| 复用市场能力 | 有界检索已配置来源，有兼容候选才比较覆盖点、缺口及未知项；无候选或检索不可用时说明局限后继续准备好的设计 |
| 理解候选并决定方向 | 专用卡片把候选的解释与操作放在一起，版本、来源和补充需求默认折叠；方向选择不授权安装 |
| 继续同一个任务 | 设计和选择跨轮次保留；继续实现、安装或验证不会因开始新一轮而强制重新检索；需求明显变化时由模型重新准备 |
| 安装后的体验 | 已应用的在线插件自动同步；模型检查能力和当前界面，仅在明确要求重启或实际加载故障时说明恢复步骤，不例行要求用户刷新并填写验收选择题 |

纯工具的效果预览无需确认；显性界面需求先暂停，在位置画布中确认布局后继续。预选推荐项不会自动提交。确有影响方案的未定需求或必要授权时，模型仍可询问。已有本地能力必须匹配当前需求才能复用；已有笔记入口不能替代新待办的创建、完成与筛选。

## 四个案例的使用预期

| 案例 | 开发前说明 | 后续验证 |
| --- | --- | --- |
| 对话旁笔记面板 | 入口在哪、面板放在哪，如何新建、编辑、删除，内容保存范围 | 核实侧栏 API，检查编辑和保存，关闭重开后读取 |
| B 站搜索 | 在对话中发送搜索请求，返回标题、UP 主、链接和简短摘要；说明访问限制 | 验证真实接口与工具调用，不编造搜索结果；确需登录时走凭据授权 |
| 代码审查模式 | 新会话在哪里选择，输入哪些改动，会得到怎样的审查发现 | 验证模式选择应用了指令，复用当前仓库与已有工具 |
| GitHub Issue 接入 | 对话中的查询方式、目标仓库、只读范围及所需授权 | 复用已有连接，缺少授权时使用凭据设置，验证真实只读请求 |

## 实现与限制

业务由 `ui-agent-preset`、独立的界面扩展位置插件和 [decision review 插件](packages/client/ui-decision-review/README.zh.md)提供。`creator_prepare` 的 `outcome`、`usage` 记录设计预期；界面需求还提供 `location`、`impact`，自动调用独立的 [界面扩展位置插件](packages/client/ui-extension-map/README.zh.md)，读取当前已连接页面实际声明的 Slots、Theme 和相关 Host Config。画布展示完整布局备选，用户可直接改选并确认；右侧面板的正文和入口属于同一方案。数量、CSS 变量和技术清单不在默认界面展开，完成后只留简短位置结果。新任务开始时提供预览和只读位置检查工具，方案记录成功后开放检查工具；显性界面开发还需位置确认，需要市场选择时也等待该决策。取消位置或仅预览均不授权开发，关闭检索也不能绕过。关闭检索时不调用市场服务；过时的 `creator_choose` 不会重新弹出候选，待答市场选择在关闭开关后撤回。

开启检索时，默认最多查询 3 个来源、每来源 3 组独立关键词、每组 5 个结果，合并后提供 3 个兼容默认版本候选。来源详情保留实际查询与失败，查询质量及候选是否满足需求仍由模型判断。索引未配置、访问失败和成功但无匹配分别报告，不把已配置来源的结果当作整个市场。安装继续通过 `plugin_manager` 的独立授权。

`ui-agent-preset.marketFirst` 是配置档偏好，同一配置档的创造会话共享，普通模式不接收创造策略。设置不会自动启用市场或添加来源。设计和选择从现有工具事件恢复，回放不重新搜索或提问，不改变核心循环或 Session 事件格式。位置画布根据已记录的运行时声明生成，建议还需检查具体参数、入口和所属区域 API；已声明或有注册项不代表此刻正在显示。多个页面连接时采用首个有效响应；未知、检查失败和不支持分别处理，Config 没有 schema 不表示未启用。新需求或需求变化的识别、设计质量、访问限制和实际验收仍有模型判断的边界。

本地控件提供中英文，其余语言回退英文。产品外悬浮桌宠、市场分类、投稿审核、私有或公开分发、分润不属于本实验范围。

## 运行

需要 Node ≥24.9、Node 开发头文件和 pnpm：

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm dsh web --no-open
```

使用终端给出的本机登录地址，选择工作区和创造模式。真实模型需要已有提供商配置，不要提交凭据。市场检索另需在“插件 → 实验性插件”启用“自定义插件索引”，再在“发现”配置来源；详见[组合包说明](packages/experimental/plugin-market-bundle/README.zh.md)。

## 验证范围

定向测试覆盖四个案例的开关、预览、检索与候选选择分支，以及继续任务、取消、过时结果和待答期间关闭检索。Web 测试检查实际页面的卡片、字号、窄屏操作与持久记录；提示和工具声明通过已记录会话回放检查。实时市场和真实模型的验证限于说明过的具体场景，不代表已经完成或安装四个案例，也不代表取得外部服务授权。

```sh
pnpm exec vitest run packages/client/ui-agent-preset/tests packages/client/ui-decision-review/tests packages/client/ui-extension-map/tests packages/boot/plugin-manager/tests/tools.spec.ts
DSH_SNAPSHOT=replay pnpm run test:web apps/web/tests/creator-controls.e2e.ts apps/web/tests/creator-policy.e2e.ts apps/web/tests/creator-persona.e2e.ts apps/web/tests/decision-review.e2e.ts apps/web/tests/extension-map.e2e.ts
```

浏览器测试支持 `DSH_PLAYWRIGHT_EXECUTABLE_PATH` 指定已安装的 Chromium；设置 `DSH_CREATOR_EVIDENCE_DIR` 保存案例入口的页面截图。实际界面仍需按具体设计核实，自动回放不能替代产品验收。

全仓 `hygiene` 的 vendor rescope 清单仍有原有问题，不将其列为通过；decision review 的跨插件值导入已通过公共展示插槽消除，展示元数据也已补齐。位置插件的包注册、本地化、定向检查和构建单独验证。
