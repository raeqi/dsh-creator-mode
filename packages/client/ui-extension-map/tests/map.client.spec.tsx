// @vitest-environment jsdom
/** Inspections stay collapsed; the blocking placement panel sends a confirmed layout without a composer draft. */
import { afterEach, expect, it, vi } from 'vitest'
import type {} from '../src/client/index.ts'
import { cleanup, render, fireEvent, screen } from '@testing-library/react'
import { ExtensionMapCard } from '../src/client/ExtensionMapCard.tsx'
import { PlacementPanel } from '../src/client/PlacementPanel.tsx'
import { inventoryFrom, recommend } from '../src/model.ts'
import { zh } from '../src/client/locales.ts'
import { createElement } from 'react'
afterEach(cleanup)
const map = recommend(inventoryFrom({ trees: [
  { type: 'slot', name: 'sidebar.right.pane.tab', kind: 'keyed', scope: 'session', purpose: 'Panel body', replaceRisk: 'none' },
  { type: 'slot', name: 'conversation.session.header.utilities', kind: 'list', scope: 'session', purpose: 'Entry', replaceRisk: 'none' },
] }, 'right-sidebar', 10), 3)
const t = (key: keyof typeof zh) => zh[key]
it('keeps the inventory folded, with no counts, CSS variables or draft actions', () => {
  const props = { node: { data: { map } }, t } as Pick<Parameters<typeof ExtensionMapCard>[0], 'node' | 't'>
  const view = render(createElement(ExtensionMapCard, props as Parameters<typeof ExtensionMapCard>[0]))
  expect(screen.getByText(zh.browse).closest('details')?.open).toBe(false)
  fireEvent.click(screen.getByText(zh.browse))
  expect(screen.getByRole('button', { name: '右侧栏' })).toBeTruthy()
  expect(view.container.textContent).not.toContain('--dsw-')
  expect(screen.queryByRole('button', { name: zh.choose })).toBeNull()
})
function panel() {
  const answer = vi.fn<Parameters<typeof PlacementPanel>[0]['answer']>().mockResolvedValue(true)
  const props = { question: { id: 'placement', question: '放在哪里？', intent: { kind: 'decision-review', summary: '待办面板', cards: [], alternatives: [],
    view: { renderer: 'ui-placement', data: { outcome: '创建、完成和筛选待办', usage: '添加任务后勾选完成', recommended: 'right-sidebar', options: [
      { region: 'right-sidebar', label: '右侧面板', option: 'right', description: '与聊天并排', slots: ['body', 'entry'] },
      { region: 'page', label: '独立页面', option: 'page', description: '完整页面', slots: ['page', 'navigation'] },
    ] } } } }, answer, busy: false, disabled: false, failed: false, t }
  const view = render(<PlacementPanel {...props as Parameters<typeof PlacementPanel>[0]} />)
  return { answer, props, view }
}
it('selects without sending, then confirms the chosen layout directly', () => {
  const f = panel()
  expect(f.answer).not.toHaveBeenCalled()
  expect(screen.getByRole('radio', { name: /右侧面板/ }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('radio', { name: '独立页面' }))
  expect(f.answer).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '确认并继续' }))
  expect(f.answer).toHaveBeenCalledWith(['page'])
  expect(screen.queryByRole('textbox')).toBeNull()
})
it('retains selection on failure, freezes pending actions and sends no choice when deferred', () => {
  const f = panel()
  fireEvent.click(screen.getByRole('radio', { name: '独立页面' }))
  f.view.rerender(<PlacementPanel {...{ ...f.props, failed: true } as Parameters<typeof PlacementPanel>[0]} />)
  expect(screen.getByRole('alert').textContent).toContain('重试')
  expect(screen.getByRole('radio', { name: '独立页面' }).getAttribute('aria-checked')).toBe('true')
  f.view.rerender(<PlacementPanel {...{ ...f.props, busy: true, disabled: true } as Parameters<typeof PlacementPanel>[0]} />)
  expect(screen.getByRole('button', { name: '确认并继续' }).hasAttribute('disabled')).toBe(true)
  f.view.rerender(<PlacementPanel {...f.props as Parameters<typeof PlacementPanel>[0]} />)
  fireEvent.click(screen.getByRole('button', { name: '暂不决定' }))
  expect(f.answer).toHaveBeenCalledWith([])
})
