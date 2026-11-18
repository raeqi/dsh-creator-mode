/** Runtime discovery remains read-only, bounded, cancellable and independent of market preferences. */
import { Context, Service } from '@deepseek-ai/cordis'
import { expect, it, onTestFinished } from 'vitest'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import * as plugin from '../src/index.ts'
import { inventoryFrom, recommend, placementLayouts } from '../src/model.ts'

const node = (name: string, kind = 'list', replaceRisk = 'none') => ({ type: 'slot', name, kind,
  scope: 'session', purpose: `${name} extension`, replaceRisk })
const tree = { trees: [{ ...node('root', 'single', 'shadows-shipped-ui'), children: [
  node('sidebar.right.pane.tab', 'keyed'), node('conversation.session.header.utilities'),
  node('sidebar.right.tab.menu.item'),
  node('conversation.composer', 'chain'), node('main', 'single', 'shadows-shipped-ui'),
  { type: 'factory', name: 'document-preview' },
] }] }

async function fixture(config: Partial<plugin.Config> = {}) {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  const harness = await mountAgentLoopTestHarness(ctx)
  const calls: { provider: string; input: JsonValue | undefined }[] = []
  let failed: string | undefined
  let pending: ((signal: AbortSignal) => Promise<JsonValue>) | undefined
  class Inspector extends Service {
    constructor(inner: Context) { super(inner, 'cordisInspect') }
    list() { return [{ id: 'Slots', platform: 'client', methods: [{ name: 'listSubTree' }] },
      { id: 'Theme', platform: 'client', methods: [{ name: 'listTokens' }] },
      { id: 'Config', platform: 'host', methods: [{ name: 'listConfigs' }] }] }
    async query(_platform: string, provider: string, _method: string,
      input: JsonValue | undefined, _agent: object, signal: AbortSignal): Promise<JsonValue> {
      calls.push({ provider, input })
      if (provider === failed) throw new Error(`${provider} unavailable`)
      if (pending !== undefined && provider === 'Slots') return pending(signal)
      if (provider === 'Slots') return input === undefined ? tree : { selected: { occupants: [{ id: 'notes-entry', active: true }] } }
      if (provider === 'Theme') return { tokens: [{ name: '--dsw-alias-bg-base' }] }
      if (typeof input === 'object' && input !== null && !Array.isArray(input) && 'entry' in input) {
        return { schema: { anyOf: [{ properties: { preference: {}, fontSize: {} } }], $defs: { ignored: { properties: { secret: {} } } } } }
      }
      const name = typeof input === 'object' && input !== null && !Array.isArray(input) && typeof input.name === 'string' ? input.name : ''
      return { entries: [{ id: 'theme', name, status: name.endsWith('theme') ? 'schema' : 'absent' }] }
    }
  }
  await ctx.plugin(Inspector)
  const owner = await ctx.plugin(plugin, config)
  const agent = await harness.create(brandString<SessionId>('map-test'))
  const signal = new AbortController()
  const run = async (region = 'right-sidebar') => {
    const toolSet = await ctx.tools.resolve({ agent, modelSelection: { provider: 'mock', model: 'mock' }, signal: signal.signal })
    try { return await executeToolFixture(ctx, { name: 'ui_extension_map', arguments: { region }, agent,
      callId: brandString<ToolCallId>('map-call'), signal: signal.signal, toolSet }) }
    finally { toolSet.dispose() }
  }
  return { ctx, owner, agent, calls, signal, run, fail: (provider: string) => { failed = provider },
    defer: (read: (signal: AbortSignal) => Promise<JsonValue>) => { pending = read } }
}

it('suggests declared panel and entry slots, records full metadata and bounds model output', async () => {
  const f = await fixture()
  const result = await f.run()
  expect(result.isError, JSON.stringify(result)).toBe(false)
  expect(result.meta).toMatchObject({ extensionMap: { factories: 1, config: [
    { status: 'schema', fields: ['preference', 'fontSize'] }, { status: 'absent' }, { status: 'absent' },
  ], theme: ['--dsw-alias-bg-base'] } })
  const summary = JSON.parse(result.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')) as { slotCount: number; slots: { name: string; occupants: string[] }[] }
  expect(summary.slotCount).toBe(6)
  expect(summary.slots.map((slot: { name: string }) => slot.name)).toEqual(['sidebar.right.pane.tab', 'conversation.session.header.utilities'])
  expect(summary.slots.every((slot: { occupants: string[] }) => slot.occupants.includes('notes-entry'))).toBe(true)
  expect(f.calls.filter(call => call.provider === 'Slots')).toHaveLength(3)
})

it('distinguishes unavailable discovery from an empty successful inventory', async () => {
  const f = await fixture()
  f.fail('Slots')
  const result = await f.run()
  expect(result.isError).toBe(false)
  expect(result.meta).toMatchObject({ extensionMap: { slots: [], issues: [{ source: 'client/Slots', message: 'Slots unavailable' }] } })
})

it('reports truncation and never recommends replacement slots or factories', () => {
  const map = recommend(inventoryFrom(tree, 'page', 2), 3)
  expect(map).toMatchObject({ factories: 1, omitted: 4 })
  expect(map.slots.some(slot => slot.recommended)).toBe(false)
  expect(() => inventoryFrom({ trees: [node('root'), node('root')] }, 'overview', 10)).toThrow('Repeated')
  expect(() => inventoryFrom({ trees: [{ type: 'slot', name: 'missing-fields' }] }, 'overview', 10)).toThrow('Incomplete')
})

it('aborts in-flight discovery when its plugin is unloaded', async () => {
  const f = await fixture()
  let started: (() => void) | undefined
  const entered = new Promise<void>((resolve) => { started = resolve })
  f.defer(signal => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted')) }, { once: true })
    started?.()
  }))
  const running = f.run()
  await entered
  await f.owner.dispose()
  expect(await running).toMatchObject({ isError: true })
  expect(f.ctx.get('extensionMap')).toBeUndefined()
})


it('offers complete additive layouts and never treats a panel body as an alternative to its entry', () => {
  const map = inventoryFrom(tree, 'right-sidebar', 512)
  expect(placementLayouts(map)).toContainEqual({ region: 'right-sidebar', slots: ['sidebar.right.pane.tab', 'conversation.session.header.utilities'] })
  const missingEntry = { ...map, slots: map.slots.filter(slot => slot.name !== 'conversation.session.header.utilities') }
  expect(placementLayouts(missingEntry).some(layout => layout.region === 'right-sidebar')).toBe(false)
  const replacement = { ...map, slots: map.slots.map(slot => ({ ...slot, kind: 'single' as const, risk: 'shadows-shipped-ui' as const })) }
  expect(placementLayouts(replacement)).toEqual([])
})


it('keeps new keyed page and conversation renderers available despite occupied-key replacement warnings', () => {
  const map = inventoryFrom({ trees: [node('main', 'keyed', 'shadows-shipped-ui'), node('sidebar.panellist'),
    node('conversation.chat.node', 'keyed', 'shadows-shipped-ui')] }, 'page', 512)
  expect(placementLayouts(map)).toEqual([
    { region: 'conversation', slots: ['conversation.chat.node'] }, { region: 'page', slots: ['main', 'sidebar.panellist'] },
  ])
})
