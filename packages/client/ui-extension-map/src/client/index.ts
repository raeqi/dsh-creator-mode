/** Runtime map UI and a producer-registration service for other workflows. */
import { Service, type Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { mapDefinition } from './record.ts'
import { ExtensionMapCard } from './ExtensionMapCard.tsx'
import { en, zh, type MapKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client'
import { PlacementPanel } from './PlacementPanel.tsx'

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
export const inject = ['slots', 'locale', 'uiConversation']
/** @param ctx - Browser plugin context owning the canvas and producer service. */
export async function apply(ctx: Context): Promise<void> {
  await ctx.plugin(ExtensionMapUI)
  ctx.effect(() => ctx.locale.register('extensionMap', { en, zh }), 'Extension map copy')
  ctx.effect(() => ctx.uiConversation.events.register(mapDefinition('ui_extension_map')), 'Extension map tool records')
  ctx.slots.inject('conversation.question.presentation', () => ctx.slots.register({
    name: 'conversation.question.presentation', key: 'ui-placement', locale: 'extensionMap',
  }, PlacementPanel))
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'ui-extension-map', locale: 'extensionMap',
  }, ExtensionMapCard))
}
