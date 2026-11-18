/** Creator design previews with optional bounded market discovery and candidate decisions. */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { z } from 'zod'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import { defineTool, ToolArgsError, ToolContextUnavailableError } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-plugin-market'
import type {} from '@deepseek-ai/dsh-user-questions'
import type {} from '@deepseek-ai/dsh-client-ui-decision-review'
import type {} from '@deepseek-ai/dsh-client-ui-extension-map'
import type { DecisionReviewPresentation } from '@deepseek-ai/dsh-user-questions/types'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { Config } from './index.ts'
import { creatorCopy as copy } from './locales.ts'

const TOOL = 'creator_prepare'
const candidateSchema = z.object({
  name: z.string(), title: z.string(), description: z.string(), source: z.string(), target: z.string(),
  version: z.string(), installation: z.string(), registry: z.string().optional(),
})
const discoverySchema = z.object({ query: z.string(), language: z.enum(['en', 'zh']), status: z.enum(['disabled', 'not-searched', 'unavailable', 'unconfigured', 'partial-or-failed', 'no-compatible-matches', 'no-matches', 'matches']), reason: z.string(),
  sources: z.array(z.object({ url: z.string(), error: z.string().optional(),
    matches: z.number(), queries: z.array(z.string()).optional() })),
  omitted: z.array(z.string()), candidates: z.array(candidateSchema), nextAction: z.enum(['choose', 'implement', 'wait-for-user', 'preview']),
  placementChoice: z.object({ status: z.enum(['chosen', 'cancelled', 'preview']), region: z.string().optional(), label: z.string().optional(), slots: z.array(z.string()).optional() }).optional(),
  preview: z.object({ outcome: z.string(), usage: z.string() }).optional(),
  location: z.string().optional(), impact: z.string().optional() })
const choiceSchema = z.object({ decision: z.enum(['create', 'use', 'adapt']), installationAuthorized: z.literal(false) })
const stateSchema = z.object({ ready: z.boolean(), continuation: z.enum(['retry', 'configure', 'skipped']).nullable(), generation: z.number().int().nonnegative(), calls: z.record(z.string(), z.object({ name: z.enum(['creator_prepare', 'creator_choose']), generation: z.number().int().nonnegative() })), discovery: discoverySchema.nullable() })
type PreparationState = z.infer<typeof stateSchema>

const emptyPreparation = (): PreparationState => ({ ready: false, continuation: null, generation: 0, calls: {}, discovery: null })

/** A prepared design and its human decision survive continuation turns until replaced by another design. */
export const preparationProjection: ProjectionDefinition<'creatorPreparation', PreparationState> = {
  key: 'creatorPreparation', stateVersion: 1, stateSchema,
  init: emptyPreparation,
  apply: (state, event) => {
    switch (event.type) {
      case 'user/message': return event.data.source.kind === 'user' && !state.ready ? emptyPreparation() : state
      case 'tool/call': {
        const name = event.data.name
        if (name !== TOOL && name !== 'creator_choose') return state
        const generation = state.generation + (name === TOOL ? 1 : 0)
        return { ...state, ready: false, calls: { ...state.calls, [event.data.callId]: { name, generation } },
          ...name === TOOL ? { discovery: null, continuation: null, generation } : {} }
      }
      case 'tool/result': {
        const callId = event.data.message.toolCallId
        const call = Object.hasOwn(state.calls, callId) ? state.calls[callId] : undefined
        if (call === undefined) return state
        const calls = Object.fromEntries(Object.entries(state.calls).filter(([id]) => id !== callId))
        if (event.data.message.isError === true || call.generation !== state.generation) return { ...state, calls }
        const text = event.data.message.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n')
        let value: unknown
        try { value = JSON.parse(text) }
        catch { return { ...state, calls } } // Invalid persisted content never releases implementation tools.
        if (call.name === 'creator_choose') {
          const continuation = z.enum(['retry', 'configure', 'skipped']).safeParse(
            typeof value === 'object' && value !== null && 'decision' in value ? value.decision : null,
          )
          return { ...state, calls, ready: choiceSchema.safeParse(value).success,
            continuation: continuation.success ? continuation.data : null }
        }
        const parsed = discoverySchema.safeParse(value)
        return { ...state, calls, ready: parsed.success && parsed.data.nextAction === 'implement', discovery: parsed.success ? parsed.data : null }
      }
      // Unrelated Session event kinds preserve the current preparation.
      default: return state
    }
  },
}

/** Cancel this consumer without cancelling the market service's shared index fetch. */
function waitForRead<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      signal.removeEventListener('abort', abort)
      const reason: unknown = signal.reason
      reject(reason instanceof Error ? reason : new Error('Aborted', { cause: reason }))
    }
    const remove = (): void => { signal.removeEventListener('abort', abort) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    pending.then((value) => { remove(); resolve(value) }, (error: unknown) => {
      remove()
      reject(error instanceof Error ? error : new Error('Market read failed', { cause: error }))
    })
  })
}

/**
 * Register preparation and its per-turn guard for Creator sessions only.
 * @param ctx - Host context with tools, projections, questions and preset identity.
 * @param config - Profile preference and bounded discovery limits.
 */
export async function registerCreatorWorkflow(ctx: Context, config: Config): Promise<void> {
  const lifetime = new AbortController()
  ctx.effect(() => () => { lifetime.abort(new ToolContextUnavailableError('Creator preparation was unloaded')) }, 'Creator preparation lifetime')
  const projection = await ctx.sessionProjections.register(preparationProjection)
  const creator = (agent: Parameters<typeof ctx.agentPresets.presetForSession>[0]): boolean => ctx.agentPresets.presetForSession(agent) === 'cordis'
  const gate = (exec: ToolExecution) => {
    if (exec.agent === undefined || !creator(exec.agent.session)) return
    const state = projection.stateOf(exec.agent.session)
    if (state.continuation !== null && config.marketFirst.get() && !(state.continuation === 'retry' && exec.name === TOOL)) {
      const t = copy[state.discovery?.language ?? 'en']
      return { reason: state.continuation === 'skipped' ? t.skipped : state.continuation === 'configure' ? t.configurePending : t.retryPending,
        info: { name: 'CreatorPreparationError', code: 'CREATOR_WAITING_FOR_USER' } }
    }
    if (exec.name === TOOL) return
    if (state.discovery?.nextAction === 'wait-for-user' || state.discovery?.nextAction === 'preview') {
      return { reason: 'The layout is unconfirmed. Stop and wait for the user; call creator_prepare only when they request a new preparation.',
        info: { name: 'CreatorPreparationError', code: 'CREATOR_WAITING_FOR_PLACEMENT' } }
    }
    if (exec.name === 'creator_choose') return
    if (state.discovery?.preview !== undefined && (state.ready || (!config.marketFirst.get()
      && state.discovery.nextAction === 'choose' && state.discovery.placementChoice?.status !== 'cancelled'))) return
    if (config.preparationReadTools.includes(exec.name)) return
    if (exec.name === 'plugin_manager' && typeof exec.arguments === 'object' && exec.arguments !== null
      && 'action' in exec.arguments && ['list_plugins', 'list_bundles'].includes(String(exec.arguments.action))) return
    return { reason: state.discovery?.preview !== undefined
      ? state.discovery.language === 'zh' ? '请先调用 creator_choose 完成候选选择，再继续实现' : 'Call creator_choose before implementation.'
      : '请先调用 creator_prepare 准备方案 / Call creator_prepare before implementation.',
    info: { name: 'CreatorPreparationError', code: 'CREATOR_PREPARATION_REQUIRED' } }
  }
  ctx.on('tools/pre-execute', async (exec, next) => {
    const denial = gate(exec)
    return denial === undefined ? next() : { kind: 'deny', ...denial }
  }, { prepend: true })
  ctx.tools.guard(gate)


  ctx.tools.register(defineTool({
    name: TOOL,
    description: 'Prepare the expected effect and usage before implementing a new Creator design. Visible UI additions inspect live extension locations and PAUSE until the user confirms a complete layout in the placement panel, including with Search first off. Respect the returned selected region and slots. A cancelled or preview-only preparation does not authorize implementation. With Search first on, also search configured plugin indexes; follow nextAction to compare candidates or implement directly. Does not install plugins.',
    parameters: {
      previewOnly: { type: 'boolean', description: 'Set true only when the user explicitly requests a read-only preview without choosing or implementing. Return the preview then stop. Omit during normal plugin development, which waits for a UI placement decision.' },
      outcome: { type: 'string', required: true, description: 'In the user’s language, briefly describe the finished capability and expected output. For UI requests, describe behavior without fixing the location before the human chooses it. State access or persistence limits relevant to its use.' },
      usage: { type: 'string', required: true, description: 'In the user’s language, explain where to start and one concrete interaction, e.g. ask “搜索 B 站的 Vue 教程” to receive video links in the conversation.' },
      query: { type: 'string', required: true, description: 'Primary capability keyword, e.g. notes. Avoid combining implementation requirements into one query.' },
      alternatives: { type: 'array', items: { type: 'string' }, description: `Alternative short queries, including synonyms and the user’s language, e.g. 笔记 and 便签. Search independently and merge results; at most ${config.discoveryQueryLimit - 1} alternatives.` },
      indexes: { type: 'array', items: { type: 'string' }, description: `Optional configured index URLs to search, at most ${config.discoverySourceLimit}. Omit for the first configured sources. Use omitted sources only when the user asks to expand discovery.` },
      language: { type: 'string', enum: ['en', 'zh'], required: true, description: 'Language of the user-facing decision.' },
      location: { type: 'string', enum: ['page', 'conversation', 'composer', 'right-sidebar', 'header', 'left-sidebar', 'settings', 'plugins'], description: 'Required for visible UI additions. Reads the live extension-map plugin before showing the proposed region. Omit for tool-only, mode or service capabilities without a new visual surface; do not invent a panel.' },
      impact: { type: 'string', description: 'For UI requests, explain the user-visible change and affected neighbors in the user’s language.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => {
      const parsed = JSON.parse(value) as { extensionMap?: import('@deepseek-ai/dsh-client-ui-extension-map').ExtensionMap
        placementChoice?: import('@deepseek-ai/dsh-client-ui-extension-map').PlacementChoice
        [key: string]: unknown }
      if (parsed.extensionMap === undefined) return [{ type: 'text', text: value }]
      const { extensionMap, ...preparation } = parsed
      const choice = preparation.placementChoice
      const selected = choice?.slots ?? []
      return [{ type: 'text', text: JSON.stringify({ ...preparation, uiPlacement: {
        slots: extensionMap.slots.filter(slot => selected.includes(slot.name)).map((slot) => {
          const { occupants: _occupants, ...declaration } = slot
          return declaration
        }),
        guidance: 'Use these declarations only for a chosen placement; without a choice, stop. Inspect exact slot props and owner APIs before coding. Keyed slots require a new unique key; never replace occupied keys. Neighboring occupants do not establish capability reuse. In the final user reply, use the chosen display label, not slot identifiers or field names; do not repeat the plan.' } }) }]

    }, presentationMeta: (_args, value) => {
      const parsed = JSON.parse(value) as {
        extensionMap?: import('@deepseek-ai/dsh-util-values').JsonValue
        placementChoice?: import('@deepseek-ai/dsh-util-values').JsonValue
      }
      return parsed.extensionMap === undefined ? {} : { extensionMap: parsed.extensionMap,
        ...parsed.placementChoice === undefined ? {} : { placementChoice: parsed.placementChoice } }
    } },
    async execute(args, exec) {
      const signal = AbortSignal.any([exec.signal, lifetime.signal])
      signal.throwIfAborted()
      if (exec.agent === undefined) throw new ToolContextUnavailableError('Creator preparation requires an Agent')
      if (!args.outcome.trim() || !args.usage.trim()) throw new ToolArgsError(['outcome and usage must explain the proposed design'])
      if (args.query.trim() === '') throw new ToolArgsError(['query must contain search keywords'])
      if (args.location !== undefined && !args.impact?.trim()) throw new ToolArgsError(['impact is required with location'])
      const alternatives = args.alternatives ?? []
      if (alternatives.length >= config.discoveryQueryLimit || alternatives.some(term => !term.trim())) {
        throw new ToolArgsError([`alternatives must contain at most ${config.discoveryQueryLimit - 1} nonempty queries`])
      }
      const queries = [...new Set([args.query.trim(), ...alternatives.map(term => term.trim())])]
      const mapper = ctx.get('extensionMap')
      if (args.location !== undefined && mapper === undefined) {
        throw new ToolContextUnavailableError('The UI extension map plugin is required for interface placement. Enable ui-extension-map and reconnect a DSH page; no UI support has been verified.')
      }
      const extensionMap = args.location === undefined ? undefined : await mapper?.inspect(args.location, { ...exec, signal })
      const placementChoice = mapper === undefined || extensionMap === undefined ? undefined : args.previewOnly === true
        ? { status: 'preview' as const } : await mapper.review(extensionMap, args, { ...exec, signal })
      signal.throwIfAborted()
      const t = copy[args.language]
      if (args.previewOnly === true || placementChoice?.status === 'cancelled') {
        return JSON.stringify({ query: args.query, language: args.language, status: 'not-searched',
          reason: args.previewOnly === true ? t.previewOnly : t.waitPlacement, sources: [], omitted: [], candidates: [],
          preview: { outcome: args.outcome, usage: args.usage }, nextAction: args.previewOnly === true ? 'preview' : 'wait-for-user',
          ...extensionMap === undefined ? {} : { extensionMap }, ...placementChoice === undefined ? {} : { placementChoice },
          ...args.location === undefined ? {} : { location: args.location, impact: args.impact } })
      }
      const marketFirst = config.marketFirst.get()
      const market = ctx.get('pluginMarket')
      const sources: { url: string; error?: string; matches: number; queries?: string[] }[] = []
      const candidates: z.infer<typeof candidateSchema>[] = []
      const ranks = new Map<string, number>()
      const indexes = market?.listIndexes() ?? []
      if (marketFirst && args.indexes !== undefined) {
        if (args.indexes.length === 0 || args.indexes.length > config.discoverySourceLimit
          || new Set(args.indexes).size !== args.indexes.length) {
          throw new ToolArgsError([`indexes must name 1 to ${config.discoverySourceLimit} distinct configured sources`])
        }
        if (market !== undefined && args.indexes.some(url => !indexes.some(index => index.url === url))) {
          throw new ToolArgsError(['indexes must contain only currently configured sources'])
        }
      }
      const searched = !marketFirst ? [] : args.indexes === undefined ? indexes.slice(0, config.discoverySourceLimit)
        : indexes.filter(index => args.indexes?.includes(index.url))
      if (market !== undefined) {
        for (const index of searched) {
          signal.throwIfAborted()
          try {
            const entries = []
            const attempted = [...queries]
            const failures: string[] = []
            for (let position = 0; position < attempted.length; position++) {
              const text = attempted[position] as string
              try {
                const result = await waitForRead(market.search(index.url, { text, sort: { kind: 'relevance' }, offset: 0, limit: config.discoveryResultLimit }), signal)
                signal.throwIfAborted()
                entries.push(...result.entries)
                for (const [rank, entry] of result.entries.entries()) ranks.set(entry.name, (ranks.get(entry.name) ?? 0) + 1 / (rank + 1))
              } catch (error) {
                signal.throwIfAborted()
                failures.push(error instanceof Error ? error.message : t.unknown)
              }
              if (position === attempted.length - 1 && entries.length === 0 && attempted.length < config.discoveryQueryLimit) {
                const broader = args.query.split(/\s+/u).filter(term => term.length > 1 && !attempted.includes(term))
                attempted.push(...broader.slice(0, config.discoveryQueryLimit - attempted.length))
              }
            }
            sources.push({ url: index.url, matches: new Set(entries.map(entry => entry.name)).size, queries: attempted,
              ...failures.length === 0 ? {} : { error: failures.join('; ') } })
            for (const entry of entries) {
              const version = entry.versions.find(item => item.version === entry.defaultVersion)
              if (version === undefined || !version.compatibility.compatible || candidates.some(item => item.name === entry.name)) continue
              const title = typeof entry.title === 'string' ? entry.title : entry.title?.[args.language] ?? entry.title?.en ?? entry.name
              const description = typeof entry.description === 'string' ? entry.description : entry.description?.[args.language] ?? entry.description?.en ?? ''
              candidates.push({ name: entry.name, title: title.slice(0, 300), description: description.slice(0, 300), source: index.url,
                target: version.install.spec, version: version.version, installation: entry.installation.status,
                ...version.install.registry === undefined ? {} : { registry: version.install.registry } })
            }
          } catch (error) {
            signal.throwIfAborted()
            sources.push({ url: index.url, matches: 0, error: error instanceof Error ? error.message : t.unknown })
          }
        }
      }
      const shown = candidates.sort((a, b) => (ranks.get(b.name) ?? 0) - (ranks.get(a.name) ?? 0)).slice(0, config.discoveryCandidateLimit)
      const searchedUrls = new Set(searched.map(index => index.url))
      const omitted = marketFirst ? indexes.filter(index => !searchedUrls.has(index.url)).map(index => index.url) : []
      const status = !marketFirst ? 'disabled' : market === undefined ? 'unavailable' : indexes.length === 0 ? 'unconfigured'
        : sources.some(source => source.error !== undefined) ? 'partial-or-failed' : shown.length === 0 ? sources.some(source => source.matches > 0) ? 'no-compatible-matches' : 'no-matches' : 'matches'
      const reason = status === 'disabled' ? t.direct : status === 'unavailable' ? t.absent : status === 'unconfigured' ? t.empty
        : status === 'partial-or-failed' ? t.unknown : status === 'no-matches' ? t.none : status === 'no-compatible-matches' ? t.incompatible : t.choice
      return JSON.stringify({ query: args.query, queries, language: args.language, status, reason, sources, omitted, candidates: shown,
        preview: { outcome: args.outcome, usage: args.usage }, nextAction: marketFirst && shown.length > 0 ? 'choose' : 'implement',
        ...placementChoice === undefined ? {} : { placementChoice },
        ...extensionMap === undefined ? {} : { extensionMap },
        ...args.location === undefined ? {} : { location: placementChoice?.region ?? args.location, impact: args.impact ?? '' } })
    },
    presentCall: args => ({ card: 'generic', title: args.language === 'zh' ? '准备创造方案' : 'Prepare Creator request', kind: 'read', rawInput: args }),
  }), { when: ({ agent }) => creator(agent.session) })
  ctx.tools.register(defineTool({
    name: 'creator_choose',
    description: 'Explain the coverage and gaps of the latest Creator discovery candidates, then obtain the user’s reuse, adaptation or creation decision. Installation is separately authorized. Call creator_prepare again to retry or change search scope.',
    parameters: {
      comparison: { type: 'string', required: true, description: 'One short sentence summarizing the decision. Candidate-specific explanations belong in assessments; do not repeat descriptions, sources or placement.' },
      assessments: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
        name: { type: 'string', description: 'Optional exact candidate package name; omit to use the same position in the returned candidate list.' },
        coverage: { type: 'string', required: true, description: 'One short sentence about requirements covered by actual metadata.' },
        gaps: { type: 'string', required: true, description: 'One short sentence about unmet requirements or unverified support. Missing metadata means unknown, not unsupported.' },
      } }, description: 'One assessment per candidate in returned order, or use explicit names. Give short coverage and gaps in the user’s language; never invent support.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      const signal = AbortSignal.any([exec.signal, lifetime.signal])
      signal.throwIfAborted()
      if (args.comparison.trim() === '') throw new ToolArgsError(['comparison must explain coverage or the unavailable discovery'])
      if (exec.agent === undefined) throw new ToolContextUnavailableError('Creator choice requires an Agent')
      const discovery = projection.stateOf(exec.agent.session).discovery
      if (discovery === null) throw new ToolContextUnavailableError('Run creator_prepare successfully before comparing candidates')
      const t = copy[discovery.language]
      if (!config.marketFirst.get() || discovery.nextAction === 'implement') return JSON.stringify({ ...discovery, decision: 'create', nextAction: 'implement', installationAuthorized: false })
      const detail = [discovery.reason, discovery.candidates.length === 0 ? t.noCandidates : args.comparison,
        ...discovery.sources.length === 0 ? [] : [`${t.source}\n${discovery.sources.map(source => `${source.url}: ${source.matches}${source.queries === undefined ? '' : ` · ${source.queries.join(' / ')}`}${source.error === undefined ? '' : ` · ${source.error}`}`).join('\n')}`],
        ...discovery.omitted.length === 0 ? [] : [`${t.omitted}: ${discovery.omitted.join(', ')}`],
        ...discovery.candidates.map((candidate, index) => `\n${index + 1}. ${candidate.title} (${candidate.name})\n${candidate.description}\n${candidate.version} · ${t.compatible}\n${candidate.source}`)].join('\n\n')

      const choices = discovery.candidates.flatMap((candidate, index) => [
        { label: `${t.use} ${index + 1}`, description: candidate.title }, { label: `${t.adapt} ${index + 1}`, description: candidate.title },
      ])
      const questions = ctx.get('userQuestions')
      if (questions === undefined) throw new ToolContextUnavailableError('User questions are unavailable; no creation decision was recorded')
      const options = [...choices, { label: t.create }, { label: t.retry },
        ...['unavailable', 'unconfigured', 'partial-or-failed'].includes(discovery.status) ? [{ label: t.configure }] : []]
      const assessments = (args.assessments ?? []).map((item, index) => ({ ...item, name: item.name ?? discovery.candidates[index]?.name }))
      if (assessments.some(item => !discovery.candidates.some(candidate => candidate.name === item.name))
        || new Set(assessments.map(item => item.name)).size !== assessments.length) {
        throw new ToolArgsError(['assessments must name distinct candidates from the latest preparation'])
      }
      const presentation: DecisionReviewPresentation = {
        kind: 'decision-review', summary: discovery.candidates.length === 0 ? discovery.reason : args.comparison, notice: t.notice,
        cards: discovery.candidates.map((candidate, index) => {
          const assessment = assessments.find(item => item.name === candidate.name)
          return { title: candidate.name, summary: '',
            facts: [{ label: t.coverage, value: assessment?.coverage ?? t.unverified },
              { label: t.gaps, value: assessment?.gaps ?? t.unverified }],
            detail: `${candidate.description}\n${candidate.version} · ${t.compatible}\n${candidate.source}\n${candidate.title}`,
            actions: [{ option: `${t.use} ${index + 1}`, label: t.continue }, { option: `${t.adapt} ${index + 1}`, label: t.adaptCard }] }
        }),
        alternatives: options.slice(choices.length).map(option => ({ option: option.label, label: option.label })),
      }
      const title = discovery.candidates.length === 0 ? t.noCandidateQuestion : t.reviewTitle
      const reviews = ctx.get('decisionReviews')
      const preference = new AbortController()
      const stop = ctx.on('loader/volatile-update', () => {
        if (!config.marketFirst.get()) preference.abort(new ToolContextUnavailableError('Market discovery was turned off'))
      })
      const choiceSignal = AbortSignal.any([signal, preference.signal])
      let answer: Awaited<ReturnType<typeof questions.ask>>
      try {
        answer = reviews === undefined
          ? await questions.ask({ agent: exec.agent, signal: choiceSignal, questions: [{ id: 'creator-path', header: t.title,
            question: title, detail, options, intent: presentation }] })
          : await reviews.ask({ id: 'creator-path', request: { agent: exec.agent, signal: choiceSignal }, question: title, presentation, fallback: detail })
      } catch (error) {
        signal.throwIfAborted()
        if (!preference.signal.aborted) throw error
        return JSON.stringify({ ...discovery, decision: 'create', nextAction: 'implement', installationAuthorized: false })
      } finally { stop() }
      signal.throwIfAborted()
      if (projection.stateOf(exec.agent.session).discovery !== discovery) throw new ToolContextUnavailableError('Discovery changed while awaiting the decision; compare the latest preparation')
      const reply = answer.answers.find(item => item.id === 'creator-path')
      const selected = reply?.selected[0]
      if (selected === undefined && reply?.custom?.trim()) return JSON.stringify({ ...discovery, decision: 'retry', nextAction: 'prepare',
        custom: reply.custom, guidance: t.revisePending, installationAuthorized: false,
        decisionReview: { title, choice: t.revise, summary: args.comparison, custom: reply.custom } })
      if (selected === undefined) return JSON.stringify({ ...discovery, decision: 'skipped', nextAction: 'wait-for-user',
        decisionReview: { title, choice: t.noDecision, summary: args.comparison, custom: reply?.custom ?? '' },
        custom: reply?.custom ?? null, guidance: t.skipped, installationAuthorized: false })
      if (selected === t.retry) return JSON.stringify({ ...discovery, decision: 'retry', nextAction: 'prepare',
        decisionReview: { title, choice: t.retry, summary: args.comparison, custom: reply?.custom ?? '' },
        guidance: t.retryPending, installationAuthorized: false })
      if (selected === t.configure) return JSON.stringify({ ...discovery, decision: 'configure', nextAction: 'wait-for-configuration',
        decisionReview: { title, choice: t.configure, summary: args.comparison, custom: reply?.custom ?? '' },
        guidance: t.configurePending, installationAuthorized: false })
      const choiceIndex = choices.findIndex(item => item.label === selected)
      if (selected !== t.create && choiceIndex === -1) throw new ToolContextUnavailableError(t.pending)
      return JSON.stringify({ ...discovery, comparison: args.comparison, assessments,
        decisionReview: { title, choice: choiceIndex < 0 ? selected
          : `${choiceIndex % 2 === 0 ? t.use : t.adapt} ${discovery.candidates[Math.floor(choiceIndex / 2)]?.name ?? ''}`, summary: args.comparison, custom: reply?.custom ?? '' },
        decision: selected === t.create ? 'create' : choiceIndex % 2 === 0 ? 'use' : 'adapt',
        selected: choiceIndex < 0 ? null : discovery.candidates[Math.floor(choiceIndex / 2)], installationAuthorized: false })
    },
    presentCall: () => ({ card: 'generic', title: 'Choose Creator path', kind: 'read' }),
  }), { when: ({ agent }) => creator(agent.session) })

  const previews = new Map<Agent, { dispose: () => void; hasMap: boolean }>()
  const refreshPreview = (agent: Agent): void => {
    const discovery = projection.stateOf(agent.session).discovery
    const required = creator(agent.session) && (discovery?.preview === undefined
      || discovery.nextAction === 'wait-for-user' || discovery.nextAction === 'preview')
    if (required) {
      const hasMap = ctx.tools.schemas().some(tool => tool.name === 'ui_extension_map')
      const current = previews.get(agent)
      if (current === undefined || current.hasMap !== hasMap) {
        current?.dispose()
        previews.set(agent, { hasMap, dispose: agent.ctx.tools.restrict({ allow: [TOOL, ...hasMap ? ['ui_extension_map'] : []] }) })
      }
    } else {
      previews.get(agent)?.dispose()
      previews.delete(agent)
    }
  }
  ctx.on('agent/created', ({ agent }) => { refreshPreview(agent) }, { global: true })
  ctx.on('agent/disposed', ({ agent }) => {
    previews.get(agent)?.dispose()
    previews.delete(agent)
  }, { global: true })
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'tool/result' && event.type !== 'tool/call' && event.type !== 'user/message'
      && event.type !== 'agent-preset/selected') return
    const agent = ctx.agents.get(session.id)
    if (agent !== undefined) refreshPreview(agent)
  })
  ctx.effect(() => () => {
    for (const preview of previews.values()) preview.dispose()
    previews.clear()
  }, 'Creator preview tool availability')
  for (const agent of ctx.agents.list()) refreshPreview(agent)
}
