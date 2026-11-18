/** Runtime map UI and a producer-registration service for other workflows. */
import { Service, type Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { mapDefinition } from './record.ts'
import { ExtensionMapCard, type MapInjected } from './ExtensionMapCard.tsx'
import { en, zh, type MapKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Runtime placement inventory copy. */
    extensionMap: MapKey
  }
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Explicit native-tool producers accepted by the runtime map renderer. */
    uiExtensionMap: ExtensionMapUI
  }
}

class ExtensionMapUI extends Service {
  constructor(ctx: Context) { super(ctx, 'uiExtensionMap') }
  /**
   * Register one native tool whose persisted metadata carries extensionMap snapshots.
   * @param name - Exact producer tool name, owned by the caller.
   * @returns Disposer that removes this producer's conversation assembler.
   */
  registerProducer(name: string): () => void { return this.ctx.uiConversation.events.register(mapDefinition(name)) }
}

/** Required rendering, localization and session-scoped draft services. */
export const inject = ['slots', 'locale', 'uiConversation', 'sessions']
/** @param ctx - Browser plugin context owning the canvas and producer service. */
export async function apply(ctx: Context): Promise<void> {
  await ctx.plugin(ExtensionMapUI)
  ctx.effect(() => ctx.locale.register('extensionMap', { en, zh }), 'Extension map copy')
  ctx.effect(() => ctx.uiConversation.events.register(mapDefinition('ui_extension_map')), 'Extension map tool records')
  ctx.inject(['conversation'], scope => scope.slots.inject('conversation.chat.node', () => scope.slots.register({
    name: 'conversation.chat.node', key: 'ui-extension-map', locale: 'extensionMap',
    inject: (sessionId: SessionId): MapInjected => ({ quoteLocation: (text) => {
      const binding = scope.sessions.binding(sessionId)
      if (binding === undefined) return
      const input = scope.conversation.input.for(binding.ctx)
      input.insertQuote(text)
      input.focus()
    } }),
  }, ExtensionMapCard)))
}
