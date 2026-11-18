// @vitest-environment jsdom
/** Spatial exploration and location feedback never submit a message or mutate runtime UI. */
import { expect, it } from 'vitest'
import type {} from '../src/client/index.ts'
import { render, fireEvent, screen } from '@testing-library/react'
import { ExtensionMapCard } from '../src/client/ExtensionMapCard.tsx'
import { inventoryFrom, recommend } from '../src/model.ts'
import { zh } from '../src/client/locales.ts'
import { createElement } from 'react'

const map = recommend(inventoryFrom({ trees: [
  { type: 'slot', name: 'sidebar.right.pane.tab', kind: 'keyed', scope: 'session', purpose: 'Panel body', replaceRisk: 'none' },
  { type: 'slot', name: 'conversation.session.header.utilities', kind: 'list', scope: 'session', purpose: 'Entry', replaceRisk: 'none' },
] }, 'right-sidebar', 10), 3)

it('shows a short recommendation, browses real regions and quotes an exact identifier only on request', () => {
  const quotes: string[] = []
  // The real slot renderer supplies the remaining framework hooks; this component reads only its node, locale and callback.
  const props = { node: { data: map }, t: (key: keyof typeof zh) => zh[key], quoteLocation: (text: string) => { quotes.push(text) } } as Pick<Parameters<typeof ExtensionMapCard>[0], 'node' | 't' | 'quoteLocation'>
  render(createElement(ExtensionMapCard, props as Parameters<typeof ExtensionMapCard>[0]))
  expect(screen.getByText(zh.sidebarBody)).toBeTruthy()
  expect(screen.getByText(zh.keyedHelp)).toBeTruthy()
  expect(quotes).toEqual([])
  fireEvent.click(screen.getAllByRole('button', { name: zh.choose })[0]!)
  expect(quotes).toHaveLength(1)
  expect(quotes[0]).toContain('sidebar.right.pane.tab')
  fireEvent.click(screen.getByRole('button', { name: '设置 0' }))
  expect(screen.getByText(zh.empty)).toBeTruthy()
  expect(quotes).toHaveLength(1)
})
