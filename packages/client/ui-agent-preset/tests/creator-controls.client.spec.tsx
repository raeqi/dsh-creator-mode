// @vitest-environment jsdom
/** Creator visibility, draft-only insertion and committed settings behavior. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { CreatorExamples, CreatorMarketSwitch } from '../src/client/CreatorControls.tsx'
import { en, zh } from '../src/client/locales.ts'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

afterEach(cleanup)
const t = (key: keyof typeof en): string => zh[key]
function sessions(preset = 'cordis', blank = true) {
  return createSnapshotStore({ byId: { s1: { blank, projectionValues: { agentPreset: preset } } } })
}

it('fills each editable example through a callback without a submit capability', () => {
  const fillDraft = vi.fn<(text: string) => void>()
  const state = sessions()
  render(<CreatorExamples {...({ sessionId: 's1', useSessions: bindSnapshotSelector(state), fillDraft, t } as Parameters<typeof CreatorExamples>[0])} />)
  const buttons = screen.getAllByRole('button')
  expect(buttons.map(button => button.textContent)).toEqual([
    '在对话旁边加一个工具', '让 DSH 多一种能力', '把常用做事方式做成一个模式', '连接我常用的服务',
  ])
  for (const button of buttons) fireEvent.click(button)
  expect(fillDraft.mock.calls.map(call => call[0])).toEqual([
    zh.creatorExampleToolPrompt, zh.creatorExampleCapabilityPrompt, zh.creatorExampleModePrompt, zh.creatorExampleServicePrompt,
  ])
  act(() => { state.set({ byId: { s1: { blank: true, projectionValues: { agentPreset: 'standard' } } } }) })
  expect(screen.queryByRole('group')).toBeNull()
  act(() => { state.set({ byId: { s1: { blank: false, projectionValues: { agentPreset: 'cordis' } } } }) })
  expect(screen.queryByRole('group')).toBeNull()
})

function switchFixture(write = vi.fn(() => Promise.resolve(true)), available = true) {
  const market = createSnapshotStore<ConfigFormSnapshot<{ indexes: string[] }>>({ status: available ? 'ready' : 'unavailable', value: available ? { indexes: ['https://example.com/index.json'] } : undefined, base: {}, user: {}, revision: 0, writable: true })
  const configureMarket = vi.fn()
  const state = sessions()
  const preference = createSnapshotStore<ConfigFormSnapshot<{ marketFirst: boolean }>>({
    status: 'ready', value: { marketFirst: true }, base: {}, user: {}, revision: 0, writable: true,
  })
  render(<CreatorMarketSwitch {...({ sessionId: 's1', useSessions: bindSnapshotSelector(state),
    useMarketSettings: bindSnapshotSelector(market), configureMarket,
    useCreatorPreference: bindSnapshotSelector(preference), setMarketFirst: write, t } as Parameters<typeof CreatorMarketSwitch>[0])} />)
  return { state, preference, write, market, configureMarket }
}

it('shows a default-on accessible switch, keeps accepted state during a pending write, and hides outside Creator', async () => {
  const gate = Promise.withResolvers<boolean>()
  const b = switchFixture(vi.fn(() => gate.promise))
  const button = screen.getByRole('switch', { name: '优先检索' })
  expect(button.getAttribute('aria-checked')).toBe('true')
  expect(button.getAttribute('aria-description')).toContain('搜索不会安装插件')
  fireEvent.click(button)
  expect(b.write).toHaveBeenCalledWith(false)
  expect(button.getAttribute('aria-checked')).toBe('true')
  expect(button.hasAttribute('disabled')).toBe(true)
  await act(async () => {
    b.preference.set({ ...b.preference.getSnapshot(), value: { marketFirst: false } })
    gate.resolve(true)
    await gate.promise
  })
  expect(button.getAttribute('aria-checked')).toBe('false')
  expect(button.textContent).toBe('直接创作')
  act(() => { b.state.set({ byId: { s1: { blank: false, projectionValues: { agentPreset: 'standard' } } } }) })
  expect(screen.queryByRole('switch')).toBeNull()
})

it.each(['refusal', 'transport'] as const)('keeps the old value and exposes a localized %s failure', async (failure) => {
  const b = switchFixture(vi.fn(() => failure === 'refusal' ? Promise.resolve(false) : Promise.reject(new Error('offline'))))
  fireEvent.click(screen.getByRole('switch'))
  await waitFor(() => { expect(screen.getByRole('status').textContent).toBe('保存失败，请重试') })
  expect(b.preference.getSnapshot().value?.marketFirst).toBe(true)
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
})

it('disables unknown or read-only settings rather than accepting a local-only preference', () => {
  const b = switchFixture()
  act(() => { b.preference.set({ ...b.preference.getSnapshot(), status: 'unavailable', value: undefined, writable: false }) })
  expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('switch'))
  expect(b.write).not.toHaveBeenCalled()
})

it('offers market setup while the market service is absent and removes it when mounted', () => {
  const b = switchFixture(undefined, false)
  fireEvent.click(screen.getByRole('button', { name: '配置插件搜索' }))
  expect(b.configureMarket).toHaveBeenCalledOnce()
  expect(b.write).not.toHaveBeenCalled()
  act(() => { b.market.set({ ...b.market.getSnapshot(), status: 'ready', value: { indexes: ['https://example.com/index.json'] } }) })
  expect(screen.queryByRole('button', { name: '配置插件搜索' })).toBeNull()
  act(() => { b.market.set({ ...b.market.getSnapshot(), status: 'ready', value: { indexes: [] } }) })
  expect(screen.getByRole('button', { name: '配置插件搜索' })).toBeTruthy()
  act(() => { b.preference.set({ ...b.preference.getSnapshot(), value: { marketFirst: false } }) })
  expect(screen.queryByRole('button', { name: '配置插件搜索' })).toBeNull()
})
