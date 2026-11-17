/** Dedicated decision renderer; generic questions continue using their original composer. */
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context } from '@deepseek-ai/cordis'
import { PendingQuestion } from '@deepseek-ai/dsh-client-ui-user-questions/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createDecisionRecordDefinition } from './record.ts'
import { DecisionRecord } from './DecisionRecord.tsx'
import { DecisionPanel, type DecisionMatch } from './DecisionPanel.tsx'
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
  ctx.slots.inject('conversation.composer', () => ctx.slots.register({
    name: 'conversation.composer', priority: -1, locale: 'decisionReview', store,
    select: ({ pendingInteraction }: ComposerChainProps): DecisionMatch | null => {
      if (!(pendingInteraction instanceof PendingQuestion) || pendingInteraction.questions.length !== 1) return null
      const presentation = pendingInteraction.questions[0]?.intent
      return presentation?.kind === 'decision-review' ? { pending: pendingInteraction, presentation } : null
    },
  }, DecisionPanel))
}

export { createDecisionRecordDefinition } from './record.ts'
