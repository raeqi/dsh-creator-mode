/** Creator implementation is gated by a logged discovery and an explicit decision, including after recovery. */
import { Context, Service } from '@deepseek-ai/cordis'
import { expect, it, onTestFinished, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createToolResultMessage, createUserMessage, type ToolCallId } from '@deepseek-ai/dsh-llm'
import { SessionLogOffset } from '@deepseek-ai/dsh-session'
import { preparationProjection } from '../src/creator-workflow.ts'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { PlacementChoice } from '@deepseek-ai/dsh-client-ui-extension-map'
import type { AskUserQuestionRequest } from '@deepseek-ai/dsh-user-questions'
import * as host from '../src/index.ts'

const design = { outcome: '在对话旁保存和管理笔记', usage: '打开笔记入口，新建后输入内容，关闭再打开仍可查看' }

async function fixture(marketFirst = true, preset = 'cordis') {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  const harness = await mountAgentLoopTestHarness(ctx)
  class Presets extends Service {
    constructor(inner: Context) { super(inner, 'agentPresets') }
    presetForSession() { return preset }
  }
  let selected: string | undefined = '创建新插件'
  let custom: string | undefined
  const requests: AskUserQuestionRequest[] = []
  class Questions extends Service {
    constructor(inner: Context) { super(inner, 'userQuestions') }
    ask(request: AskUserQuestionRequest) {
      requests.push(request)
      return Promise.resolve({ answers: [{ id: 'creator-path', selected: selected === undefined ? [] : [selected], ...custom === undefined ? {} : { custom } }] })
    }
  }
  const inspectedRegions: string[] = []
  let placement: Promise<PlacementChoice> = Promise.resolve({ status: 'chosen' as const, region: 'right-sidebar' as const, label: '右侧面板', slots: ['sidebar.right.pane.tab', 'conversation.session.header.utilities'] })
  class Maps extends Service {
    constructor(inner: Context) { super(inner, 'extensionMap') }
    review() { return placement }
    inspect(region: string) {
      inspectedRegions.push(region)
      return Promise.resolve({ version: 1, region, slots: [{ name: 'sidebar.right.pane.tab', kind: 'keyed',
        scope: 'session', purpose: 'Panel body', risk: 'none', region: 'right-sidebar', recommended: true, occupants: [] }],
      factories: 0, omitted: 0, theme: [], config: [], issues: [] })
    }
  }
  await ctx.plugin(Maps)
  await ctx.plugin(Presets)
  await ctx.plugin(Questions)
  const workflow = await ctx.plugin({ ...host, apply: (inner: Context, config: host.Config) => {
    host.apply(inner, { marketFirst: { get: () => marketFirst }, discoverySourceLimit: config.discoverySourceLimit,
      discoveryQueryLimit: config.discoveryQueryLimit, discoveryResultLimit: config.discoveryResultLimit,
      discoveryCandidateLimit: config.discoveryCandidateLimit, preparationReadTools: config.preparationReadTools })
  } }, { marketFirst })
  const approvalCalls: string[] = []
  ctx.on('tools/pre-execute', async (exec, next) => { approvalCalls.push(exec.name); return next() })
  ctx.tools.register(defineTool({ name: 'write_test', description: 'Write fixture', parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: () => Promise.resolve('written') }))
  ctx.tools.register(defineTool({ name: 'read', description: 'Read fixture', parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: () => Promise.resolve('read') }))
  const agent = await harness.create(brandString<SessionId>('creator-workflow'))
  agent.session.append('turn/start', { turn: 1 })
  let index = 0
  let turn = 1
  const run = async (name: string, args: object = {}, signal = new AbortController().signal) => {
    const callId = brandString<ToolCallId>(`call-${++index}`)
    agent.session.append('tool/call', { turn, step: index, callId, name, arguments: JSON.stringify(args) })
    const toolSet = await ctx.tools.resolve({ agent, modelSelection: { provider: 'mock', model: 'mock' }, signal })
    const result = await executeToolFixture(ctx, { name, arguments: args, callId, agent, signal, toolSet })
    toolSet.dispose()
    agent.session.append('tool/result', { turn, step: index,
      message: createToolResultMessage({ callId, content: result.content, isError: result.isError }) }, { surfaceOp: 'append' })
    return result
  }
  return { ctx, workflow, agent, run, requests, approvalCalls, inspectedRegions,
    deferPlacement: (value: typeof placement) => { placement = value },
    setPreset: (value: string) => { preset = value; agent.session.append('agent-preset/selected', { agentPreset: value }) },
    setMarketFirst: (value: boolean) => { marketFirst = value; workflow.ctx.emit('loader/volatile-update', [['marketFirst']]) }, nextTurn: () => {
      agent.session.append('turn/end', { turn, reason: { kind: 'completed' } })
      agent.session.append('turn/start', { turn: ++turn })
      agent.session.append('user/message', createUserMessage({ content: [{ type: 'text', text: '继续这个任务' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    }, custom: (value: string) => { custom = value }, select: (value: string | undefined) => { selected = value } }
}

it('reports unavailable discovery but continues the requested development without another decision', async () => {
  const f = await fixture()
  expect(await f.run('write_test')).toMatchObject({ isError: true })
  const prepared = await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })
  expect(prepared.isError).toBe(false)
  expect(prepared.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')).toContain('"nextAction":"implement"')
  expect(await f.run('write_test')).toMatchObject({ isError: false })
  expect(f.requests).toEqual([])
})

async function withCandidate(f: Awaited<ReturnType<typeof fixture>>) {
  class Market extends Service {
    constructor(inner: Context) { super(inner, 'pluginMarket') }
    listIndexes() { return [{ url: 'https://market.example/notes' }] }
    search() { return Promise.resolve({ entries: [{ name: 'notes-plugin', title: 'Notes', description: 'Stored notes', defaultVersion: '1.0.0',
      installation: { status: 'not-installed' }, versions: [{ version: '1.0.0', compatibility: { compatible: true }, install: { spec: 'notes-plugin@1.0.0' } }] }] }) }
  }
  await f.ctx.plugin(Market)
}

it('does not ask or search when the saved preference is off, and does not gate ordinary modes', async () => {
  const direct = await fixture(false)
  expect(await direct.run('write_test')).toMatchObject({ isError: true })
  expect(await direct.run('creator_prepare', { ...design, query: 'notes', language: 'en' })).toMatchObject({ isError: false })
  expect(await direct.run('write_test')).toMatchObject({ isError: false })
  expect(direct.requests).toEqual([])
  const ordinary = await fixture(true, 'standard')
  expect(await ordinary.run('write_test')).toMatchObject({ isError: false })
})

it('requires an effect and usage preview even when discovery is off', async () => {
  const f = await fixture(false)
  expect(await f.run('creator_prepare', { query: 'bilibili', language: 'zh' })).toMatchObject({ isError: true })
  expect(await f.run('write_test')).toMatchObject({ isError: true })
  await withCandidate(f)
  const search = vi.spyOn(f.ctx.pluginMarket, 'search')
  await f.run('creator_prepare', { query: 'bilibili', language: 'zh', outcome: '在对话中返回标题、UP 主和视频链接', usage: '发送“搜索 B 站的 Vue 教程”，在对话里查看结果' })
  expect(search).not.toHaveBeenCalled()
  expect(await f.run('write_test')).toMatchObject({ isError: false })
  f.nextTurn()
  expect(await f.run('write_test')).toMatchObject({ isError: false })
  expect(f.requests).toEqual([])
})

it('exposes the preview before investigation and keeps the full tools on continuation', async () => {
  const f = await fixture(false)
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toEqual(['creator_prepare'])
  await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toEqual(expect.arrayContaining(['read', 'write_test']))
  f.nextTurn()
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toEqual(expect.arrayContaining(['read', 'write_test']))
})

it('lifts an unfinished preview restriction when the workflow unloads', async () => {
  const f = await fixture(false)
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toEqual(['creator_prepare'])
  await f.workflow.ctx.fiber.dispose()
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toEqual(expect.arrayContaining(['read', 'write_test']))
})

it('updates preview availability when a blank session changes preset', async () => {
  const f = await fixture(false, 'standard')
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toContain('read')
  f.setPreset('cordis')
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toEqual(['creator_prepare'])
  f.setPreset('standard')
  expect(f.ctx.tools.schemas(f.agent).map(tool => tool.name)).toContain('read')
})

it('does not present cached market candidates after discovery is turned off', async () => {
  const f = await fixture()
  await withCandidate(f)
  await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })
  f.setMarketFirst(false)
  expect(await f.run('creator_choose', { comparison: 'Stale comparison' })).toMatchObject({ isError: false })
  expect(f.requests).toEqual([])
  expect(await f.run('write_test')).toMatchObject({ isError: false })
})

it('withdraws a waiting market choice when discovery is turned off', async () => {
  const f = await fixture()
  await withCandidate(f)
  await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })
  const started = Promise.withResolvers<undefined>()
  vi.spyOn(f.ctx.userQuestions, 'ask').mockImplementation(async (request) => {
    if (request.signal === undefined) throw new Error('Choice needs a cancellation signal')
    const signal = request.signal
    started.resolve(undefined)
    return new Promise((_resolve, reject) => { signal.addEventListener('abort', () => {
      const reason: unknown = signal.reason
      reject(reason instanceof Error ? reason : new Error('Choice cancelled'))
    }, { once: true }) })
  })
  const choice = f.run('creator_choose', { comparison: 'Compare available notes plugins' })
  await started.promise
  f.setMarketFirst(false)
  expect(await choice).toMatchObject({ isError: false })
  expect(await f.run('write_test')).toMatchObject({ isError: false })
})

it('does not release implementation after a cancelled preparation or an unprepared choice', async () => {
  const f = await fixture()
  expect(await f.run('creator_choose', { comparison: 'No discovery' })).toMatchObject({ isError: true })
  await expect(f.run('creator_prepare', { ...design, query: 'notes', language: 'en' }, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' })
  expect(await f.run('write_test')).toMatchObject({ isError: true })
})

it('searches only the configured budget, keeps partial failures visible, and offers compatible returned candidates', async () => {
  const f = await fixture()
  const reads: string[] = []
  class Market extends Service {
    constructor(inner: Context) { super(inner, 'pluginMarket') }
    listIndexes() { return [1, 2, 3, 4].map(index => ({ url: `https://market.example/${index}` })) }
    search(url: string) {
      reads.push(url)
      if (url.endsWith('/2')) return Promise.reject(new Error('source offline'))
      return Promise.resolve({ entries: [{ name: 'notes-plugin', title: 'Notes', description: 'Stored notes', defaultVersion: '1.0.0', installation: { status: 'not-installed' },
        versions: [{ version: '1.0.0', compatibility: { compatible: true }, install: { spec: 'notes-plugin@1.0.0' } }] }] })
    }
  }
  await f.ctx.plugin(Market)
  const discovery = await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh', location: 'right-sidebar', impact: '右侧笔记' })
  expect(discovery.isError, JSON.stringify(discovery)).toBe(false)
  expect(reads).toEqual(['https://market.example/1', 'https://market.example/2', 'https://market.example/3'])
  expect(discovery.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')).toContain('partial-or-failed')
  f.select('使用 1')
  const choice = await f.run('creator_choose', { comparison: 'Notes 提供笔记存储；侧栏支持待核查，不能保证完全匹配',
    assessments: [{ coverage: '提供笔记存储', gaps: '侧栏支持待核查' }] })
  expect(choice.isError).toBe(false)
  const choiceText = choice.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')
  expect(choiceText).toContain('"installationAuthorized":false')
  const question = f.requests[0]?.questions[0]
  expect(question?.detail).toContain('侧栏支持待核查')
  expect(question?.detail).toContain('source offline')
  expect(question?.detail).toContain('https://market.example/4')
  expect(question).toMatchSnapshot('market candidate decision with partial failure and omitted source')
  expect(await f.run('write_test')).toMatchObject({ isError: false })
  f.nextTurn()
  expect(await f.run('write_test')).toMatchObject({ isError: false })
  const expanded = await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh', indexes: ['https://market.example/4'] })
  expect(expanded.isError).toBe(false)
  expect(reads.at(-1)).toBe('https://market.example/4')
  const beforeUnknown = reads.length
  expect(await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh', indexes: ['https://other.example/'] })).toMatchObject({ isError: true })
  expect(reads).toHaveLength(beforeUnknown)
})

it('restores the gate from a checkpoint and ignores a decision for superseded discovery', async () => {
  const f = await fixture()
  await withCandidate(f)
  await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })
  const prefix = f.agent.session.snapshotEvents()
  const initial = preparationProjection.init(f.agent.session.header, SessionLogOffset(0))
  const prefixState = prefix.reduce((state, event) => preparationProjection.apply(state, event), initial)
  const restored = preparationProjection.stateSchema.parse(JSON.parse(JSON.stringify(prefixState)))
  await f.run('creator_choose', { comparison: '市场不可用，用户可明确选择新建' })
  const events = f.agent.session.snapshotEvents()
  const recovered = events.slice(prefix.length).reduce((state, event) => preparationProjection.apply(state, event), restored)
  expect(recovered).toEqual(events.reduce((state, event) => preparationProjection.apply(state, event), initial))
  expect(events.reduce((state, event) => preparationProjection.apply(state, event), initial).ready).toBe(true)
  expect(f.requests).toHaveLength(1)
  const stale = brandString<ToolCallId>('stale-choice')
  f.agent.session.append('tool/call', { turn: 1, step: 10, callId: stale, name: 'creator_choose', arguments: '{"comparison":"old discovery"}' })
  await f.run('creator_prepare', { ...design, query: 'different capability', language: 'zh' })
  f.agent.session.append('tool/result', { turn: 1, step: 10,
    message: createToolResultMessage({ callId: stale, content: [{ type: 'text', text: '{"decision":"create"}' }], isError: false }) }, { surfaceOp: 'append' })
  expect(await f.run('write_test')).toMatchObject({ isError: true })
})

it('cancels an index read without waiting for the shared fetch or admitting implementation', async () => {
  const f = await fixture()
  const started = Promise.withResolvers<undefined>()
  const pending = Promise.withResolvers<{ entries: never[] }>()
  class Market extends Service {
    constructor(inner: Context) { super(inner, 'pluginMarket') }
    listIndexes() { return [{ url: 'https://market.example/delayed' }] }
    search() { started.resolve(undefined); return pending.promise }
  }
  await f.ctx.plugin(Market)
  const cancel = new AbortController()
  const run = f.run('creator_prepare', { ...design, query: 'notes', language: 'en' }, cancel.signal)
  await started.promise
  cancel.abort()
  expect(await run).toMatchObject({ isError: true })
  expect(await f.run('write_test')).toMatchObject({ isError: true })
  pending.resolve({ entries: [] })
  await pending.promise
})

it('does not interpret a skipped decision as permission or repeat the question', async () => {
  const f = await fixture()
  await withCandidate(f)
  await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })
  f.select(undefined)
  const choice = await f.run('creator_choose', { comparison: '市场尚不可用' })
  expect(choice.isError).toBe(false)
  expect(choice.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')).toContain('不要重复提问')
  expect(f.requests).toHaveLength(1)
  expect(await f.run('write_test')).toMatchObject({ isError: true })
  expect(await f.run('creator_choose', { comparison: 'Do not repeat' })).toMatchObject({ isError: true })
  expect(f.requests).toHaveLength(1)
  f.nextTurn()
  expect(await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })).toMatchObject({ isError: false })
})

it('searches alternative capabilities independently, retains partial matches and reports actual queries', async () => {
  const f = await fixture()
  const reads: string[] = []
  const entry = (name: string) => ({ name, title: name, description: 'Notes', defaultVersion: '1.0.0', installation: { status: 'not-installed' },
    versions: [{ version: '1.0.0', compatibility: { compatible: true }, install: { spec: `${name}@1.0.0` } }] })
  class Market extends Service {
    constructor(inner: Context) { super(inner, 'pluginMarket') }
    listIndexes() { return [{ url: 'https://market.example/notes' }] }
    search(_url: string, query: { text: string }) {
      reads.push(query.text)
      if (query.text === '便签') return Promise.reject(new Error('temporary failure'))
      return Promise.resolve({ entries: query.text === 'notes' ? [entry('shared'), entry('english')]
        : query.text === '笔记' ? [entry('shared'), entry('chinese')] : [] })
    }
  }
  await f.ctx.plugin(Market)
  const result = await f.run('creator_prepare', { ...design, query: 'notes', alternatives: ['笔记', '便签'], language: 'zh' })
  expect(result.isError).toBe(false)
  const text = result.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')
  expect(JSON.parse(text)).toMatchObject({ status: 'partial-or-failed', sources: [{ matches: 3, queries: ['notes', '笔记', '便签'] }],
    candidates: [{ name: 'shared' }, { name: 'english' }, { name: 'chinese' }] })
  expect(reads).toEqual(['notes', '笔记', '便签'])
  await f.run('creator_choose', { comparison: '有三个候选，侧栏与存储能力需核实' })
  expect(f.requests[0]?.questions[0]?.detail).toContain('temporary failure')
  reads.length = 0
  await f.run('creator_prepare', { ...design, query: 'notepad notes panel sidebar persistent storage', language: 'zh' })
  expect(reads).toEqual(['notepad notes panel sidebar persistent storage', 'notepad', 'notes'])
  reads.length = 0
  expect(await f.run('creator_prepare', { ...design, query: 'notes', alternatives: ['a', 'b', 'c'], language: 'zh' })).toMatchObject({ isError: true })
  expect(reads).toEqual([])
})

it('continues development when configured sources return no compatible candidate', async () => {
  const f = await fixture()
  class Market extends Service {
    constructor(inner: Context) { super(inner, 'pluginMarket') }
    listIndexes() { return [{ url: 'https://market.example/empty' }] }
    search() { return Promise.resolve({ entries: [] }) }
  }
  await f.ctx.plugin(Market)
  await f.run('creator_prepare', { ...design, query: 'notes', alternatives: ['笔记', '便签'], language: 'zh' })
  await f.run('creator_choose', { comparison: '本轮关键词未找到匹配' })
  expect(f.requests).toEqual([])
  expect(await f.run('write_test')).toMatchObject({ isError: false })
})

it('reopens preparation when the human changes requirements without selecting a candidate', async () => {
  const f = await fixture()
  await withCandidate(f)
  await f.run('creator_prepare', { ...design, query: 'notes', language: 'zh' })
  f.select(undefined)
  f.custom('只找便签，不要自动注入提示词')
  const answer = await f.run('creator_choose', { comparison: '请补充想要的笔记方式' })
  expect(answer.isError).toBe(false)
  expect(answer.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')).toContain('"decision":"retry"')
  expect(await f.run('write_test')).toMatchObject({ isError: true })
  expect(await f.run('creator_prepare', { ...design, query: '便签', language: 'zh' })).toMatchObject({ isError: false })
})

it.each([
  ['notes', 'right-sidebar'], ['bilibili', undefined], ['code review mode', undefined], ['github issues', undefined],
] as const)('keeps the %s example on a direct path when search is off and offers candidates only when found', async (query, location) => {
  const direct = await fixture(false)
  expect(await direct.run('write_test')).toMatchObject({ isError: true })
  const preview = await direct.run('creator_prepare', { ...design, query, language: 'zh', ...location === undefined ? {} : { location, impact: '在右侧展示笔记' } })
  expect(preview.isError, JSON.stringify(preview)).toBe(false)
  expect(preview.content.some(part => part.type === 'text' && part.text.includes('"preview"'))).toBe(true)
  expect(direct.inspectedRegions).toEqual(location === undefined ? [] : [location])
  if (location === undefined) expect(preview.meta).toEqual({})
  else expect(preview.meta).toMatchObject({ extensionMap: { region: location } })
  expect(await direct.run('write_test')).toMatchObject({ isError: false })
  expect(direct.requests).toEqual([])
  const searched = await fixture()
  await withCandidate(searched)
  await searched.run('creator_prepare', { ...design, query, language: 'zh', ...location === undefined ? {} : { location, impact: '在右侧展示笔记' } })
  expect(await searched.run('write_test')).toMatchObject({ isError: true })
  searched.select('创建新插件')
  expect(await searched.run('creator_choose', { comparison: '已有候选仅供参考，也可继续开发自己的方案' })).toMatchObject({ isError: false })
  expect(await searched.run('write_test')).toMatchObject({ isError: false })
})

it('blocks writes while placement is pending and applies the human-selected page with search off', async () => {
  const f = await fixture(false)
  const pending = Promise.withResolvers<PlacementChoice>()
  f.deferPlacement(pending.promise)
  const preparing = f.run('creator_prepare', { query: 'todo', language: 'zh', outcome: '新增待办、勾选完成、筛选状态',
    usage: '添加任务后勾选完成', location: 'right-sidebar', impact: '独立待办界面' })
  await vi.waitFor(() => { expect(f.inspectedRegions).toEqual(['right-sidebar']) })
  expect(await f.run('write_test')).toMatchObject({ isError: true })
  pending.resolve({ status: 'chosen', region: 'page', label: '独立页面', slots: ['main', 'sidebar.panellist'] })
  const result = await preparing
  expect(result.isError, JSON.stringify(result)).toBe(false)
  expect(result.content.some(part => part.type === 'text' && part.text.includes('"location":"page"'))).toBe(true)
  expect(result.meta).toMatchObject({ placementChoice: { region: 'page', slots: ['main', 'sidebar.panellist'] } })
  expect(await f.run('write_test')).toMatchObject({ isError: false })
  expect(f.requests).toEqual([])
})
it('keeps cancellation and read-only previews blocked independently of the market preference', async () => {
  for (const previewOnly of [false, true]) {
    const f = await fixture(false)
    f.deferPlacement(Promise.resolve({ status: 'cancelled' }))
    const result = await f.run('creator_prepare', { ...design, query: 'todo', language: 'zh', location: 'right-sidebar', impact: '待办面板', previewOnly })
    expect(result.isError, JSON.stringify(result)).toBe(false)
    expect(await f.run('write_test')).toMatchObject({ isError: true })
    expect(await f.run('creator_choose', { comparison: 'Do not bypass the layout decision' })).toMatchObject({ isError: true })
    f.setMarketFirst(true)
    expect(await f.run('write_test')).toMatchObject({ isError: true })
  }
})
