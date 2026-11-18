/** Runtime placement discovery and blocking layout decisions, independent of plugin markets. */
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { z as parse } from 'zod'
import type {} from '@deepseek-ai/dsh-cordis-host-runner'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {} from '@deepseek-ai/dsh-user-questions'
import { defineTool, ToolContextUnavailableError, type ToolExecution } from '@deepseek-ai/dsh-tools'
import { inventoryFrom, recommend, regionSchema, placementLayouts, type ExtensionMap, type ExtensionRegion, type PlacementChoice } from './model.ts'
import { reviewCopy } from './locales.ts'
export type { ExtensionMap, ExtensionRegion, ExtensionSlot, PlacementChoice } from './model.ts'

/** Top-level object alternatives expose editable fields; nested definitions are not configuration keys. */
function configFields(value: JsonValue): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
  const properties = value.properties
  const own = typeof properties === 'object' && properties !== null && !Array.isArray(properties) ? Object.keys(properties) : []
  const alternatives = [value.anyOf, value.oneOf, value.allOf].flatMap(item => Array.isArray(item) ? item : [])
  return [...new Set([...own, ...alternatives.flatMap(configFields)])]
}

/** Profile bounds on inventory size and detailed inspections. */
export interface Config {
  /** Maximum retained slot declarations, with omissions reported explicitly. */
  slotLimit: number
  /** Maximum suggestions and exact-root occupancy queries. */
  recommendationLimit: number
}
/** Validated deployment limits; public protocol fields remain fixed. */
export const Config = z.object({ slotLimit: z.number().step(1).min(1).max(2048).default(512),
  recommendationLimit: z.number().step(1).min(1).max(5).default(3) })

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Runtime-declared interface locations and theme/config capabilities. */
    extensionMap: ExtensionMapService
  }
}

/** Reads the same provider registry and methods used by cordis_inspect_list/query. */
export class ExtensionMapService extends Service {
  private readonly lifetime = new AbortController()
  constructor(ctx: Context, private readonly limits: Config) {
    super(ctx, 'extensionMap')
    ctx.effect(() => () => { this.lifetime.abort(new ToolContextUnavailableError('Extension map was unloaded')) }, 'Extension map reads')
  }

  /**
   * Pause the caller until a human confirms a layout or defers it.
   * @param map - Inspected declarations used to form complete layout alternatives.
   * @param design - Short capability description, usage and preferred language.
   * @param exec - Requesting Agent and cancellation lifetime.
   * @returns The exact human-selected layout; deferral never approves implementation.
   */
  async review(map: ExtensionMap, design: { outcome: string; usage: string; language: 'en' | 'zh' }, exec: ToolExecution): Promise<PlacementChoice> {
    if (exec.agent === undefined) throw new ToolContextUnavailableError('Placement decisions require an Agent')
    const t = reviewCopy[design.language]
    const descriptions = { 'right-sidebar': t.rightDescription, conversation: t.conversationDescription,
      page: t.pageDescription, composer: t.composerDescription, header: t.headerDescription,
      'left-sidebar': t.leftDescription, settings: t.settingsDescription, plugins: t.pluginsDescription }
    const options = placementLayouts(map).map(layout => ({ ...layout, label: t[layout.region],
      description: descriptions[layout.region], option: t[layout.region] }))
    if (options.length === 0) throw new ToolContextUnavailableError(
      `No complete placement was verified. Reconnect the DSH page and inspect its slots before continuing. ${map.issues.map(issue => `${issue.source}: ${issue.message}`).join('; ')}`,
    )
    const questions = this.ctx.get('userQuestions')
    if (questions === undefined) throw new ToolContextUnavailableError('User questions are unavailable; no placement was confirmed')
    const answer = await questions.ask({ agent: exec.agent,
      signal: AbortSignal.any([exec.signal, this.lifetime.signal]), questions: [{ id: 'ui-placement', question: t.title,
        options: [...options.map(option => ({ label: option.option, description: option.description })), { label: t.cancel }],
        intent: { kind: 'decision-review', summary: design.outcome, cards: [],
          alternatives: [...options.map(option => ({ label: option.label, option: option.option })), { label: t.cancel, option: t.cancel }],
          view: { renderer: 'ui-placement', data: { ...design, options,
            ...options.some(option => option.region === map.region) ? { recommended: map.region } : {} } } },
      }] })
    const selected = answer.answers.find(item => item.id === 'ui-placement')?.selected[0]
    const choice = options.find(option => option.option === selected)
    return choice === undefined ? { status: 'cancelled' } : { status: 'chosen', region: choice.region, label: choice.label, slots: choice.slots }
  }

  /**
   * Capture declared Slots and public Theme/Config capabilities without running or installing a plugin.
   * @param region - Requested region, or overview for the whole document.
   * @param exec - Agent scope and cancellation lifetime of the recorded tool call.
   * @returns A snapshot with source failures and unknown occupants preserved explicitly.
   */
  async inspect(region: ExtensionRegion, exec: ToolExecution): Promise<ExtensionMap> {
    if (exec.agent === undefined) throw new ToolContextUnavailableError('Extension inspection requires an Agent')
    const agent = exec.agent
    const signal = AbortSignal.any([exec.signal, this.lifetime.signal])
    signal.throwIfAborted()
    const providers = this.ctx.cordisInspect.list()
    const issues: ExtensionMap['issues'] = []
    const query = async (platform: 'host' | 'client', provider: string, method: string, input?: JsonValue): Promise<JsonValue | undefined> => {
      if (!providers.some(item => item.platform === platform && item.id === provider && item.methods.some(item => item.name === method))) {
        issues.push({ source: `${platform}/${provider}`, message: 'Inspection provider or method is unavailable' })
        return undefined
      }
      try { return await this.ctx.cordisInspect.query(platform, provider, method, input, agent, signal) }
      catch (error) {
        signal.throwIfAborted()
        issues.push({ source: `${platform}/${provider}`, message: error instanceof Error ? error.message : 'Inspection failed' })
        return undefined
      }
    }
    const [tree, theme, ...configs] = await Promise.all([
      query('client', 'Slots', 'listSubTree'), query('client', 'Theme', 'listTokens'),
      query('host', 'Config', 'listConfigs', { name: '@deepseek-ai/dsh-client-ui-theme' }),
      query('host', 'Config', 'listConfigs', { name: '@deepseek-ai/dsh-client-ui-layout' }),
      query('host', 'Config', 'listConfigs', { name: '@deepseek-ai/dsh-client-ui-sidebar-right' }),
    ])
    signal.throwIfAborted()
    let map: ExtensionMap = { version: 1, region, slots: [], factories: 0, omitted: 0, theme: [], config: [], issues }
    if (tree !== undefined) {
      try { map = { ...recommend(inventoryFrom(tree, region, this.limits.slotLimit), this.limits.recommendationLimit), issues } }
      catch (error) { issues.push({ source: 'client/Slots', message: error instanceof Error ? error.message : 'Invalid slot inventory' }) }
    }
    if (theme !== undefined) {
      const parsed = parse.object({ tokens: parse.array(parse.object({ name: parse.string() })) }).safeParse(theme)
      if (parsed.success) map.theme = parsed.data.tokens.map(token => token.name)
      else issues.push({ source: 'client/Theme', message: 'Invalid theme token inventory' })
    }
    for (const config of configs) {
      if (config === undefined) continue
      const parsed = parse.object({ entries: parse.array(parse.object({
        id: parse.string(), name: parse.string(), status: parse.string(),
      })) }).safeParse(config)
      if (!parsed.success) issues.push({ source: 'host/Config', message: 'Invalid configuration directory' })
      else for (const entry of parsed.data.entries) {
        const row = { name: entry.name, status: entry.status, fields: [] as string[] }
        map.config.push(row)
        if (entry.status !== 'schema') continue
        const detail = await query('host', 'Config', 'listConfigs', { entry: entry.id })
        const schema = typeof detail === 'object' && detail !== null && !Array.isArray(detail) ? detail.schema : undefined
        if (schema !== undefined) row.fields = configFields(schema)
        else if (detail !== undefined) issues.push({ source: 'host/Config', message: 'Theme configuration schema is unavailable' })
      }
    }
    await Promise.all(map.slots.filter(slot => slot.recommended).map(async (slot) => {
      const detail = await query('client', 'Slots', 'listSubTree', { root: slot.name })
      const parsed = parse.object({ selected: parse.object({ occupants: parse.array(parse.object({
        id: parse.string().optional(), key: parse.string().optional(), active: parse.boolean().optional(),
      })) }) }).safeParse(detail)
      if (parsed.success) slot.occupants = parsed.data.selected.occupants.flatMap(item => item.id === undefined && item.key === undefined ? [] : [item.id ?? item.key ?? ''])
      else if (detail !== undefined) issues.push({ source: 'client/Slots', message: `Occupants are unknown for ${slot.name}` })
    }))
    signal.throwIfAborted()
    return { ...map, issues: [...new Map(issues.map(issue => [`${issue.source}:${issue.message}`, issue])).values()]
      .sort((a, b) => a.source.localeCompare(b.source) || a.message.localeCompare(b.message)) }
  }
}

/** Required Host discovery and tool-registration services. */
export const inject = ['cordisInspect', 'tools']

/** @param ctx - Host owner. @param config - Resolved inventory limits. */
export async function apply(ctx: Context, config: Config): Promise<void> {
  await ctx.plugin(ExtensionMapService, config)
  ctx.inject(['extensionMap'], scope => scope.tools.register(defineTool({ name: 'ui_extension_map',
    description: 'Show a read-only, interactive map of UI extension slots actually declared by connected DSH pages, plus public theme tokens and theme configuration fields. Use for visible interface additions or when the user asks where DSH can be extended. It does not install, register UI, search markets, or require a choice. Omit region for an overview; set a region to suggest conservative entry/body locations. Declarations and occupants do not prove that a slot is currently visible; inspect exact slot props before coding. No declaration does not establish impossibility outside the application document.',
    parameters: { region: { type: 'string', enum: regionSchema.options, description: 'Requested part of the window; overview lists all declarations.' } },
    output: { schema: { type: 'string' }, render: (_args, value) => {
      const map = JSON.parse(value) as ExtensionMap
      return [{ type: 'text', text: JSON.stringify({ ...map, slots: map.slots.filter(slot => slot.recommended),
        slotCount: map.slots.length, guidance: 'The complete inventory is shown in the map. Select exact Slots roots for props before implementation. Unknown is not unsupported; no registration or installation is authorized.' }) }]
    }, presentationMeta: (_args, value) => ({ extensionMap: JSON.parse(value) as JsonValue }) },
    execute: async (args, exec) => JSON.stringify(await scope.extensionMap.inspect(args.region ?? 'overview', exec)),
    isConcurrencySafe: () => true,
    presentCall: () => ({ card: 'generic', title: 'Inspect UI extension locations', kind: 'read' }),
  })))
}
