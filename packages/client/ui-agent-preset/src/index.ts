/** Host preferences, preparation tools and logged guidance for Creator mode. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { registerCreatorWorkflow } from './creator-workflow.ts'
import { CREATOR_BASE_POLICY, CREATOR_DIRECT_POLICY, CREATOR_MARKET_POLICY } from './creator-policy.ts'

/** Profile owner's Creator preference, shared by authenticated clients of this Host. */
export interface Config {
  /** Prefer existing capabilities and configured indexes before creation; applies only to Creator requests. */
  marketFirst: Volatile<boolean>
  /** Maximum configured sources searched by one preparation. */
  discoverySourceLimit: number
  /** Maximum alternative queries searched per source. */
  discoveryQueryLimit: number
  /** Maximum results requested from each source and query. */
  discoveryResultLimit: number
  /** Maximum compatible candidates offered for comparison. */
  discoveryCandidateLimit: number
  /** Read-only tool names allowed before a preparation decision. */
  preparationReadTools: string[]
}

/** Persist through the Host settings document, defaulting to read-only discovery. */
export const Config = z.object({ marketFirst: z.boolean().default(true).volatile(),
  discoverySourceLimit: z.number().step(1).min(1).max(3).default(3),
  discoveryQueryLimit: z.number().step(1).min(1).max(6).default(3),
  discoveryResultLimit: z.number().step(1).min(1).max(10).default(5),
  discoveryCandidateLimit: z.number().step(1).min(1).max(3).default(3),
  preparationReadTools: z.array(z.string()).default(['read', 'glob', 'grep', 'read_image', 'web_search', 'web_fetch', 'skill', 'cordis_inspect_list', 'cordis_inspect_query', 'ask_user_question', 'plugin_market']) })

/**
 * Mount profile preferences, preparation tools and logged guidance; ordinary presets receive no Creator behavior.
 * @param ctx - Host plugin context.
 * @param config - Resolved live preferences.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  ctx.inject(['tools', 'sessionProjections', 'agentPresets', 'agents'], child => registerCreatorWorkflow(child, config))
  ctx.inject(['systemPrompt', 'agentPresets'], (child) => {
    child.effect(() => child.systemPrompt.section({
      name: 'creator:reuse-policy',
      order: child.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') + 1,
      text: ({ agent }) => agent === undefined || child.agentPresets.presetForSession(agent.session) !== 'cordis'
        ? '' : `${CREATOR_BASE_POLICY}\n\n${config.marketFirst.get() ? CREATOR_MARKET_POLICY : CREATOR_DIRECT_POLICY}`,
    }), 'Creator guidance')
  })
}
