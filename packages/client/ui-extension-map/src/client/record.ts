/** Reconstruct placement maps exclusively from registered producers' successful tool metadata. */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import { mapSchema, placementChoiceSchema, type ExtensionMap, type PlacementChoice } from '../model.ts'

/** Chat renderer key for recorded runtime extension inventories. */
export type ExtensionMapKind = 'ui-extension-map'
declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** Read-only runtime inventory at the time a design was prepared. */
    'ui-extension-map': { map: ExtensionMap; choice?: PlacementChoice }
  }
}

/**
 * Pair a registered producer with its persisted presentation metadata.
 * @param producer - Native tool explicitly registered by its owner.
 * @returns Its replayable map assembler.
 */
export function mapDefinition(producer: string): ConversationNodeDefinition<{ map: ExtensionMap | null; choice?: PlacementChoice }> {
  return {
    kind: `ui-extension-map:${producer}`, target: 'chat',
    match: event => event.type === 'tool/call' && event.data.name === producer
      ? { id: event.data.callId, role: 'start' }
      : event.type === 'tool/result' ? { id: event.data.message.toolCallId, role: 'update' } : null,
    start: () => ({ map: null }),
    update: (_context, match) => {
      if (match.event.type !== 'tool/result' || match.event.data.message.isError === true) return { map: null }
      const meta = match.event.data.meta
      const parsed = mapSchema.safeParse(typeof meta === 'object' && meta !== null && 'extensionMap' in meta ? meta.extensionMap : undefined)
      const choice = placementChoiceSchema.safeParse(typeof meta === 'object' && meta !== null && 'placementChoice' in meta ? meta.placementChoice : undefined)
      return { map: parsed.success ? parsed.data : null, ...choice.success ? { choice: choice.data } : {} }
    },
    buildViewNode: context => context.start === undefined || context.state?.map == null || (context.state.choice !== undefined && context.state.choice.status !== 'chosen') ? null : ({
      key: context.key, id: context.id, kind: 'ui-extension-map', target: 'chat', anchorSeq: context.start.event.seq,
      location: context.start.location, visibility: 'visible', groupTree: 'turn', data: { map: context.state.map, ...context.state.choice === undefined ? {} : { choice: context.state.choice } },
    } satisfies ChatNode<'ui-extension-map'>),
  }
}
