/** Task-specific placement cards reconstructed from recorded Creator preparation calls. */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatNode } from '@deepseek-ai/dsh-client-ui-chat/client'

/** Chat renderer key whose module also declares the placement payload. */
export type CreatorPlacementKind = 'creator-placement'

/** A proposed region and its user-visible impact; neither asserts the API has been verified. */
export interface CreatorPlacement {
  query: string
  location: 'page' | 'conversation' | 'composer' | 'right-sidebar'
  impact: string
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** Proposed interface region for a Creator task. */
    'creator-placement': CreatorPlacement
  }
}

/** One visible card per UI preparation, outside the collapsed tool process. */
export const creatorPlacementDefinition: ConversationNodeDefinition<{ placement: CreatorPlacement | null }> = {
  kind: 'creator-placement', target: 'chat',
  match: event => event.type === 'tool/call' && event.data.name === 'creator_prepare'
    ? { id: event.data.callId, role: 'start' } : null,
  start: (_context, match) => {
    if (match.event.type !== 'tool/call') return { placement: null }
    let args: unknown
    try { args = JSON.parse(match.event.data.arguments) }
    catch { return { placement: null } } // A malformed recorded tool call provides no proposed placement.
    if (typeof args !== 'object' || args === null || !('location' in args) || !('query' in args) || !('impact' in args)
      || typeof args.query !== 'string' || typeof args.impact !== 'string') return { placement: null }
    const location = args.location
    if (location !== 'page' && location !== 'conversation' && location !== 'composer' && location !== 'right-sidebar') return { placement: null }
    return { placement: { query: args.query, impact: args.impact, location } }
  },
  update: context => context.state,
  buildViewNode: (context) => {
    if (context.start === undefined || context.state?.placement == null) return null
    return { key: context.key, id: context.id, kind: 'creator-placement', target: 'chat', anchorSeq: context.start.event.seq,
      location: context.start.location, visibility: 'visible', groupTree: 'turn', data: context.state.placement } satisfies ChatNode<'creator-placement'>
  },
}
