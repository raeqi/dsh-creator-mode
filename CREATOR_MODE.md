# DSH Creator Mode — 非官方实验改进

本项目基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 `master`：`39163dd30f703a79079e2d2446545cff3c453738`，版本 `0.2.2-rc.3`。开始开发时通过 `git ls-remote` 核对了该上游分支。原始完整 Git 历史、[MIT 许可证](LICENSE)及[第三方声明](THIRD_PARTY_NOTICES.md)均保留；不代表 DeepSeek 官方发行版，不发布到插件市场，不调整 GitHub 仓库公开权限。

仓库为 [`raeqi/dsh-creator-mode`](https://github.com/raeqi/dsh-creator-mode)，基于完整上游历史。仓库所有者已明确同意将本次创造模式改动提交到公开仓库；公开源码不代表插件市场上架或 DeepSeek 官方认可。

## 已实现

- 保留原模式切换、设置菜单联动和聊天页面。选择工作区、绑定空白创造会话后，输入框下面显示四个案例；点击仅调用 `setDraft` 和 `focus`，不自动发送，可继续编辑。普通模式及已开始的对话不显示案例。
- 在原输入框左侧工具行、权限控制的右侧，通过 `conversation.input.left` 放入默认开启的「优先检索」开关。使用可键盘操作的原生按钮、`role=switch`、`aria-checked`、焦点提示与完整说明，保存失败时保留 Host 已接受的值并显示错误。
- 使用原 Host settings 保存 `ui-agent-preset.marketFirst`，作用域是当前配置档所有者；该配置档的已认证客户端共享偏好。只有下次组装的创造模式请求读取它，普通模式不会收到检索策略。不是按浏览器全局 localStorage 保存，也不是跨配置档的偏好。
- 原 UI 插件的 Host 半部贡献 `creator:reuse-policy` 系统提示章节；真实 Agent 请求将其记录在 `system/message`。开启时引导模型先检查已有能力和真实 `plugin_market` 的 `list_indexes`，仅搜索已配置来源。默认每次查询 5 个结果，初始最多 3 个来源、每来源 2 个查询，必要时才查询候选的 3 个版本。更多搜索应先说明范围并征求用户选择。
- 对话策略区分未配置、工具不可用、搜索失败、部分结果、无匹配和有匹配，要求说明实际来源、覆盖与差距，按直接使用/配置、局部改造、新建的顺序给用户选择；搜索不授权安装，安装继续走独立 `plugin_manager.install_bundle` 授权。关闭开关时直接进入创造，无额外跳过按钮。
- 仅涉及 UI 的需求才按需解释真实扩展位置；提示模型核查页面、对话视图、输入框、右侧栏 API。明确产品外悬浮桌宠需要额外 Electron/操作系统能力，不承诺原生 UI slot。
- 新控件有中英文词条；其他现有语言暂回退到英文。案例使用桌面两列、480px 以下一列的 CSS，尚未完成视觉验收。

## 最小核心修改与实现边界

业务代码留在现有 `ui-agent-preset` 插件。唯一核心行为调整是在 `ui-conversation` 的 `InputBar` 中取消下方 `conversation.composer.dock` 仅限活跃对话的条件，使它也能服务欢迎输入框；已增加 hero/composer 两种布局的单元回归。原统计条目自行根据有无数据决定是否显示，插槽声明及生成目录同步更新。没有修改 agent loop、工具执行器、安装授权或 Session 事件格式。

市场优先是接入真实请求的模型对话策略，并非强制检索状态机。模型可能偏离策略；尚未用真实提供商评估匹配解释、结果选择和搜索预算的遵循程度。本实现没有假装提供自动检索结果卡、确定性的搜索前置拦截、自动安装或 token 节省率。上游市场服务默认关闭且没有官方默认索引；不配置时无法搜索市场。真实只读市场工具的匹配、无配置、失败和卸载路径由现有工具测试覆盖，不等于所有对话分支已完成浏览器验收。

## 运行

需要 Node ≥24.9 且安装带开发头文件的 Node，以及 pnpm。标准环境中执行：

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm dsh web --patch apps/web/tests/pin-browse-picker.overlay.yml --no-open
```

启动器的 `--patch` 参数放在应用参数 `--no-open` 之前。打开终端给出的本机登录地址，选择一个工作区，再使用原模式菜单选择创造模式。使用正常模型需要自己已有的提供商配置；本项目不索取或提交凭据。

如需启用上游已有的自定义市场来源界面，可在当前配置档使用插件管理器启用 custom plugin indexes bundle，或按上游说明加载 `packages/experimental/plugin-market-bundle/cordis.patch.yml` 并在插件设置中配置索引。只会搜索用户配置的来源；没有官方默认索引。

本次云环境完成了等价分步构建：以 `node --import tsx/esm` 调用脚本，运行 Host/Client 编译与 tsdown 打包，并在 `apps/web` 使用其自身锁定的 Vite 6 构建。原生 flock addon 使用官方 Node `24.22.1` 头文件及原脚本的编译参数构建，未更改原生源码。正式 `dsh web` profile 曾在隔离的 Harness home 成功打印启动地址；执行沙箱内的端口未能被外部云浏览器访问。

## 验证结果与未完成检查

- 相关单元测试：11 个文件、390 项通过；覆盖原 preset 行为、新开关默认值/拒绝/异常、案例仅填入、普通模式隐藏、输入框 hero/composer 两种布局，以及上游真实市场工具。后续新插槽卸载断言也单独复查。
- 真实 Loader Web 组合的 keyless 集成测试：3 项通过，真实 Agent 使用已有录制输出；分别验证开启、关闭、普通模式的实际系统提示和持久会话日志。完整创造模式提示与上游 owning oracle 比较，新增 on/off 文本快照。此回放不代表真实模型已做市场搜索。
- 受影响 Host/Client 包的严格 TypeScript 构建通过；新增 Host 测试单独使用同等严格设置检查。代码 lint、UI 词条、相关双语配对、生成目录及依赖检查的最终状态见交付摘要。
- 全仓类型聚合：Host 聚合在并行和串行运行均被系统 `SIGKILL`，不能声明完整 `typecheck` 或 `build:check` 通过；Client 聚合在该次 typecheck 中通过。标准 `pnpm run build:artifacts` 与 `doc-sync` 的 tsx 辅助 Unix socket 被执行环境拒绝（`listen EPERM`），因此采用分步构建并保留限制记录。
- 浏览器集成用例已经加入，覆盖案例填入不发送、键盘空格切换、刷新恢复、390px 布局及截图导出。当前系统 Chromium 启动时因 `process_singleton` Unix socket 被拒绝而中止；Playwright 浏览器下载也未得到有效压缩包。外部云浏览器访问本机预览返回 `ERR_CONNECTION_REFUSED`。这些用例未通过，未取得实际页面截图，深浅主题、真实焦点、工具条窄屏排列、tooltip 和模式切换尚未视觉验收。
- 没有使用静态原型图替代截图；没有改动其他旅行地图项目或用户本机，没有市场发布或公开权限变更。

复查命令：

```sh
pnpm exec vitest run packages/client/ui-agent-preset/tests packages/client/ui-conversation/tests/input-bar.client.spec.tsx packages/boot/plugin-market/tests/tools.spec.ts
pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/creator-policy.e2e.ts
pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/creator-controls.e2e.ts
```

已安装可用系统 Chromium 时，浏览器测试支持 `DSH_PLAYWRIGHT_EXECUTABLE_PATH`；设置 `DSH_CREATOR_EVIDENCE_DIR` 可保存实际页面截图。完整 GUI 测试通过后仍需对实际页面进行产品/设计复查，当前未获得该项验收。
