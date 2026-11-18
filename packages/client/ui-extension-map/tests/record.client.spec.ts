/** The real conversation assembler accepts pending/empty states and never treats unrelated output as a human decision. */
import { expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createToolResultMessage, type ToolCallId } from '@deepseek-ai/dsh-llm'
import { SessionSeq, type SessionEvent } from '@deepseek-ai/dsh-session/types'
import { ConversationNodeAssembler, type ConversationNodeDefinition, type ConversationViewDefinition, type ConversationViewNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { mapDefinition } from '../src/client/record.ts'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

const callId = brandString<ToolCallId>('decision-call')
const record = { version: 1, region: 'overview', slots: [], factories: 0, omitted: 0, theme: [], config: [], issues: [] }
function call(name: string, args: object = {}): SessionEvent {
  return { type: 'tool/call', seq: SessionSeq(1), time: 1, data: { turn: 1, step: 1, callId, name, arguments: JSON.stringify(args) } }
}
function result(value: object, isError = false): SessionEvent {
  return { type: 'tool/result', seq: SessionSeq(2), time: 2, surfaceOp: 'append', data: { turn: 1, step: 1,
    meta: JSON.parse(JSON.stringify(value)) as JsonValue, message: createToolResultMessage({ callId, content: [{ type: 'text', text: 'Inspection summary' }], isError }) } }
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

it('replays a registered map and keeps the waiting phase empty without throwing', () => {
  const definition = mapDefinition('ui_extension_map')
  expect(replay(definition, [call('ui_extension_map')])).toEqual([])
  expect(replay(definition, [call('ui_extension_map'), result({ extensionMap: record })])).toMatchObject([{ data: record }])
})

it('ignores unregistered or malformed map-looking results', () => {
  const definition = mapDefinition('ui_extension_map')
  expect(replay(definition, [call('web_fetch'), result({ extensionMap: record })])).toEqual([])
  expect(replay(definition, [call('ui_extension_map'), result({ extensionMap: { version: 123 } })])).toEqual([])
  expect(replay(definition, [call('ui_extension_map'), result({ extensionMap: record }, true)])).toEqual([])
})
