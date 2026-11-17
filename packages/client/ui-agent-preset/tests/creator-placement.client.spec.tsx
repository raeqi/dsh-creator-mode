// @vitest-environment jsdom
/** Task-specific placement is visible outside tool disclosure and names the proposed region. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { ToolCallId } from '@deepseek-ai/dsh-llm/types'
import { SessionSeq, type SessionEvent } from '@deepseek-ai/dsh-session/types'
import { ConversationNodeAssembler, type ConversationViewDefinition, type ConversationViewNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { creatorPlacementDefinition } from '../src/client/creator-placement.ts'
import { CreatorPlacementCard } from '../src/client/CreatorPlacementCard.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

it('marks the proposed region and explains the impact without claiming the API is verified', () => {
  render(<CreatorPlacementCard {...({ node: { data: { query: 'notes', location: 'right-sidebar', impact: '在右侧展示笔记，不遮挡输入框' } },
    t: (key: keyof typeof zh) => zh[key] } as Parameters<typeof CreatorPlacementCard>[0])} />)
  expect(screen.getByRole('region', { name: '拟放置的界面位置' })).toBeTruthy()
  expect(screen.getByText('右侧栏').getAttribute('data-selected')).toBe('true')
  expect(screen.getByText('消息输入框').getAttribute('data-selected')).toBe('false')
  expect(screen.getByText('在右侧展示笔记，不遮挡输入框')).toBeTruthy()
  expect(screen.getByText('此处展示拟定位置，实现时仍需核实支持的扩展 API')).toBeTruthy()
})

it('replays non-UI preparation without a placement card or an undefined assembler state', () => {
  const view: ConversationViewDefinition<ConversationViewNode, readonly ConversationViewNode[]> = {
    target: 'chat', create: () => ({ empty: [], replace: ({ nodes }) => nodes, apply: ({ upserts }) => upserts }),
  }
  const assembler = new ConversationNodeAssembler({ entries: () => [creatorPlacementDefinition], fallbackEntry: () => undefined },
    { entries: () => [view] })
  const event: SessionEvent<'tool/call'> = { type: 'tool/call', seq: SessionSeq(1), time: 1,
    data: { turn: 1, step: 1, callId: brandString<ToolCallId>('non-ui'), name: 'creator_prepare', arguments: '{"query":"bilibili"}' } }
  assembler.activateTarget('chat')
  assembler.replaceWindow([{ type: 'event', event }], false)
  expect(() => assembler.flush()).not.toThrow()
  expect(assembler.snapshot('chat')).toEqual([])
})
