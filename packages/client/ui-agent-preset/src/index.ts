/** Host preferences and logged guidance for the unofficial experimental Creator improvements. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { CREATOR_BASE_POLICY, CREATOR_DIRECT_POLICY, CREATOR_MARKET_POLICY } from './creator-policy.ts'

/** Profile owner's Creator preference, shared by authenticated clients of this Host. */
export interface Config {
  /** Prefer existing capabilities and configured indexes before creation; applies only to Creator requests. */
  marketFirst: Volatile<boolean>
}

/** Persist through the Host settings document, defaulting to read-only discovery. */
export const Config = z.object({ marketFirst: z.boolean().default(true).volatile() })

/**
 * Mount profile preferences and Creator-only prompt guidance; ordinary presets receive no section.
 * @param ctx - Host plugin context.
 * @param config - Resolved live preferences.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  ctx.inject(['systemPrompt', 'agentPresets'], (child) => {
    child.effect(() => child.systemPrompt.section({
      name: 'creator:reuse-policy',
      order: child.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') + 1,
      text: ({ agent }) => agent === undefined || child.agentPresets.presetForSession(agent.session) !== 'cordis'
        ? '' : `${CREATOR_BASE_POLICY}\n\n${config.marketFirst.get() ? CREATOR_MARKET_POLICY : CREATOR_DIRECT_POLICY}`,
    }), 'Creator guidance')
  })
}
