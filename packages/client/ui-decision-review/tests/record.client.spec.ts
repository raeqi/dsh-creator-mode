/** The real conversation assembler accepts pending/empty states and never treats unrelated output as a human decision. */
import { expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createToolResultMessage, type ToolCallId } from '@deepseek-ai/dsh-llm'
import { SessionSeq, type SessionEvent } from '@deepseek-ai/dsh-session/types'
import { ConversationNodeAssembler, type ConversationNodeDefinition, type ConversationViewDefinition, type ConversationViewNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createDecisionRecordDefinition } from '../src/client/record.ts'

const callId = brandString<ToolCallId>('decision-call')
const record = { title: 'Choose a direction', choice: 'Use Notes', summary: 'Local storage', custom: 'No automatic injection' }
function call(name: string, args: object = {}): SessionEvent {
  return { type: 'tool/call', seq: SessionSeq(1), time: 1, data: { turn: 1, step: 1, callId, name, arguments: JSON.stringify(args) } }
}
function result(value: object): SessionEvent {
  return { type: 'tool/result', seq: SessionSeq(2), time: 2, surfaceOp: 'append', data: { turn: 1, step: 1,
    message: createToolResultMessage({ callId, content: [{ type: 'text', text: JSON.stringify(value) }], isError: false }) } }
}
function replay(definition: ConversationNodeDefinition, events: SessionEvent[]) {
  const view: ConversationViewDefinition<ConversationViewNode, readonly ConversationViewNode[]> = {
    target: 'chat', create: () => ({ empty: [], replace: ({ nodes }) => nodes, apply: ({ upserts }) => upserts }),
  }
  const assembler = new ConversationNodeAssembler({ entries: () => [definition], fallbackEntry: () => undefined },
    { entries: () => [view] })
  assembler.activateTarget('chat')
  assembler.replaceWindow(events.map(event => ({ type: 'event', event })), false)
  assembler.flush()
  return assembler.snapshot('chat')
}

it('replays a registered decision and keeps the waiting phase empty without throwing', () => {
  const definition = createDecisionRecordDefinition('creator_choose')
  expect(replay(definition, [call('creator_choose')])).toEqual([])
  expect(replay(definition, [call('creator_choose'), result({ decisionReview: record })])).toMatchObject([{ data: record }])
})

it('ignores unregistered or malformed decision-looking results', () => {
  const definition = createDecisionRecordDefinition('creator_choose')
  expect(replay(definition, [call('web_fetch'), result({ decisionReview: record })])).toEqual([])
  expect(replay(definition, [call('creator_choose'), result({ decisionReview: { choice: 123 } })])).toEqual([])
})
