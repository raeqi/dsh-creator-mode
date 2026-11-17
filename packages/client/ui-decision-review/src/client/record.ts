/** Decision outcomes remain visible after the waiting panel leaves the composer. */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** Renderer key retained by the component declaration. */
export type DecisionRecordKind = 'decision-review-record'
/** Caller-logged outcome, containing no executable action. */
export interface DecisionRecord {
  /** Human-facing decision heading. */
  title: string
  /** Selected direction or explicit deferral. */
  choice: string
  /** Brief context from the decision. */
  summary: string
  /** Human-authored requirements preserved with the selection. */
  custom: string
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** Recorded human decision. */
    'decision-review-record': DecisionRecord
  }
}

/** Parse only successful result data paired with a registered decision-producing call. */
function recordFrom(event: SessionEvent<'tool/result'>): DecisionRecord | undefined {
  if (event.data.message.isError === true) return undefined
  for (const part of event.data.message.content) {
    if (part.type !== 'text') continue
    let value: unknown
    try { value = JSON.parse(part.text) }
    catch { continue } // Ordinary text results carry no structured decision record.
    if (typeof value !== 'object' || value === null || !('decisionReview' in value)) continue
    const record = value.decisionReview
    if (typeof record !== 'object' || record === null || !('title' in record) || typeof record.title !== 'string'
        || !('choice' in record) || typeof record.choice !== 'string' || !('summary' in record) || typeof record.summary !== 'string'
        || !('custom' in record) || typeof record.custom !== 'string') continue
    return { title: record.title, choice: record.choice, summary: record.summary, custom: record.custom }
  }
  return undefined
}

/**
 * Reconstruct native tool decisions from one explicitly registered producer.
 * @param toolName - Trusted tool whose successful result may carry decisionReview metadata.
 * @returns An independent conversation definition; unrelated tool output cannot create a decision card.
 */
export function createDecisionRecordDefinition(toolName: string): ConversationNodeDefinition<{ record: DecisionRecord | undefined }> {
  return {
    kind: `decision-review-record:${toolName}`, target: 'chat',
    match: event => event.type === 'tool/call' && event.data.name === toolName
      ? { id: event.data.callId, role: 'start' }
      : event.type === 'tool/result' ? { id: event.data.message.toolCallId, role: 'update' } : null,
    start: () => ({ record: undefined }),
    update: (_context, match) => ({ record: match.event.type === 'tool/result' ? recordFrom(match.event) : undefined }),
    buildViewNode: context => context.start === undefined || context.state?.record === undefined ? null : ({
      key: context.key, id: context.id, kind: 'decision-review-record', target: 'chat', anchorSeq: context.start.event.seq,
      location: context.start.location, visibility: 'visible', groupTree: 'turn', data: context.state.record,
    } satisfies ChatNode<'decision-review-record'>),
  }
}
