/** Dedicated decision renderer; generic questions continue using their original composer. */
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client'
import { createDecisionRecordDefinition } from './record.ts'
import { DecisionRecord } from './DecisionRecord.tsx'
import { DecisionPanel } from './DecisionPanel.tsx'
import { createDecisionDrafts } from './drafts.ts'
import { en, zh, type DecisionKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Candidate decision cards and their outcome. */
    decisionReview: DecisionKey
  }
}

/** Required Client services; question lifecycle stays with ui-user-questions. */
export const inject = ['slots', 'locale', 'uiConversation']

/** @param ctx - Client plugin context owning registrations and dictionaries. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('decisionReview', { en, zh }), 'Decision review copy')
  ctx.uiConversation.events.register(createDecisionRecordDefinition('creator_choose'))
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'decision-review-record', locale: 'decisionReview',
  }, DecisionRecord))
  const store = createDecisionDrafts()
  ctx.slots.inject('conversation.question.presentation', () => ctx.slots.register({
    name: 'conversation.question.presentation', key: 'decision-review', locale: 'decisionReview', store,
  }, DecisionPanel))
}

export { createDecisionRecordDefinition } from './record.ts'
