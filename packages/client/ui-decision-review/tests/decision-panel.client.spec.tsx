// @vitest-environment jsdom
/** Candidate actions remain attached to their card and preserve human requirements through failed submissions. */
import type {} from '../src/client/index.ts'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { brandString } from '@deepseek-ai/dsh-brand'
import { PendingQuestion } from '@deepseek-ai/dsh-client-ui-user-questions/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { DecisionReviewPresentation } from '@deepseek-ai/dsh-user-questions/types'
import { DecisionPanel } from '../src/client/DecisionPanel.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
const presentation: DecisionReviewPresentation = { kind: 'decision-review', summary: '搜索到两个可比较方案', notice: '选择不会安装插件',
  cards: ['Notes', '便签'].map((title, index) => ({ title, summary: '', facts: [{ label: '能满足什么', value: '保存文本' }, { label: '待核实', value: '侧栏位置' }],
    detail: '1.0.0 · https://market.example/index.json', actions: [{ option: `use-${index}`, label: '基于这个方案继续' }, { option: `adapt-${index}`, label: '改造这个方案' }] })),
  alternatives: [{ option: 'create', label: '从零创建' }] }

function fixture() {
  const pending = new PendingQuestion(brandString<SessionId>('decision-test'), [{ id: 'path', question: '哪个方案更适合？', intent: presentation,
    options: ['use-0', 'adapt-0', 'use-1', 'adapt-1', 'create'].map(label => ({ label })) }])
  pending.attachWaterfall({ resolve: () => {}, reject: () => {}, delegate: () => {}, deadline: undefined })
  const answer = vi.spyOn(pending, 'answer')
  const store = createSnapshotStore<{ notes: Record<string, string> }>({ notes: {} })
  const props = { matched: { pending, presentation }, t: key => zh[key as keyof typeof zh] ?? key, useStore: bindSnapshotSelector(store),
    actions: { set: (_key: string, value: string) => { store.set({ notes: { [pending.key]: value } }) }, prune: () => {} } } as Pick<Parameters<typeof DecisionPanel>[0], 'matched' | 't' | 'useStore' | 'actions'>
  const view = render(<DecisionPanel {...props as Parameters<typeof DecisionPanel>[0]} />)
  return { pending, answer, view, props, note: () => store.getSnapshot().notes[pending.key] }
}

it('submits the exact action of the clicked candidate without a numbered option list', async () => {
  const f = fixture()
  const card = screen.getByRole('heading', { name: '便签' }).closest('article')
  expect(card).not.toBeNull()
  expect(screen.getAllByText('版本与来源')[0]?.closest('details')?.open).toBe(false)
  if (card === null) throw new Error('Candidate card missing')
  fireEvent.click(within(card).getByRole('button', { name: '基于这个方案继续' }))
  await waitFor(() => { expect(f.answer).toHaveBeenCalledWith({ answers: [{ id: 'path', selected: ['use-1'] }] }) })
  expect(screen.queryByRole('radio')).toBeNull()
  expect(screen.getByText('选择不会安装插件')).toBeTruthy()
})

it('keeps requirements on failure, disables duplicate submissions and permits retry', async () => {
  const f = fixture()
  fireEvent.click(screen.getByText('补充需求或换个方向'))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '只要右侧栏，别自动注入提示词' } })
  f.view.rerender(<DecisionPanel {...f.props as Parameters<typeof DecisionPanel>[0]} />)
  const gate = Promise.withResolvers<undefined>()
  f.answer.mockReturnValueOnce(gate.promise)
  fireEvent.click(screen.getByRole('button', { name: '发送补充需求' }))
  expect(screen.getByRole('button', { name: '暂不决定' }).hasAttribute('disabled')).toBe(true)
  await act(async () => { gate.reject(new Error('disconnected')) })
  expect(screen.getByRole('alert').textContent).toContain('已保留填写内容')
  expect(f.note()).toContain('只要右侧栏')
  fireEvent.click(screen.getByRole('button', { name: '发送补充需求' }))
  await waitFor(() => { expect(f.answer).toHaveBeenLastCalledWith({ answers: [{ id: 'path', selected: [], custom: '只要右侧栏，别自动注入提示词' }] }) })
})
