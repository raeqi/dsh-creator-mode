/** Actual runtime inspection renders the map with market discovery off and preserves draft feedback. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createToolResultMessage, type ToolCallId } from '@deepseek-ai/dsh-llm'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import { fixtureUserPrompts, launchWebScaffold } from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage } from './support.ts'

const FIXTURE = fileURLToPath(new URL('../../../snapshots/web/creator-persona/session.v4.jsonl', import.meta.url))

it('prepares a live sidebar map without searching, supports narrow layouts and restores its recorded snapshot', async () => {
  const scaffold = await launchWebScaffold({ replayFixture: FIXTURE, compareReplaySession: false, paceMs: 10,
    agentPresets: { default: 'cordis' } })
  try {
    await scaffold.ctx.settings.update('ui-agent-preset', { marketFirst: false })
    const executablePath = process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH
    const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
    try {
      const page = await newEnglishPage(browser)
      await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
      await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
      await connectFreshWorkspace(page, scaffold.workspaceCwd)
      const prompt = fixtureUserPrompts(await readFile(FIXTURE, 'utf8'))[0]
      if (prompt === undefined) throw new Error('Fixture prompt missing')
      const settled = scaffold.whenTurnSettled()
      const composer = page.locator('[data-composer-input][contenteditable="true"]').last()
      await composer.fill(prompt)
      await composer.press('Enter')
      const id = await settled
      const agent = scaffold.ctx.agents.get(id)
      if (agent === undefined) throw new Error('Fixture Agent missing')
      const callId = brandString<ToolCallId>('runtime-map-preview')
      const args = { query: 'notes', language: 'en', outcome: 'A local notes panel', usage: 'Open Notes next to chat',
        location: 'right-sidebar', impact: 'Adds a panel tab and opening entry' }
      agent.session.append('turn/start', { turn: 2 })
      agent.session.append('tool/call', { turn: 2, step: 1, callId, name: 'creator_prepare', arguments: JSON.stringify(args) })
      const signal = new AbortController().signal
      const toolSet = await scaffold.ctx.tools.resolve({ agent, modelSelection: { provider: 'mock', model: 'mock' }, signal })
      let result: Awaited<ReturnType<typeof executeToolFixture>>
      try { result = await executeToolFixture(scaffold.ctx, { name: 'creator_prepare', arguments: args, callId, agent, signal, toolSet }) }
      finally { toolSet.dispose() }
      expect(result.isError, JSON.stringify(result)).toBe(false)
      expect(result.content.some(part => part.type === 'text' && part.text.includes('"status":"disabled"'))).toBe(true)
      agent.session.append('tool/result', { turn: 2, step: 1, ...result.meta === undefined ? {} : { meta: result.meta },
        message: createToolResultMessage({ callId, content: result.content, isError: result.isError }) }, { surfaceOp: 'append' })
      agent.session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
      const map = page.getByRole('region', { name: 'Interface extension map', exact: true })
      await map.waitFor({ state: 'visible' })
      expect(await map.evaluate(element => getComputedStyle(element).fontSize)).toBe('13px')
      expect(await map.getByText('Some inspections could not complete.', { exact: false }).count()).toBe(0)
      expect(await map.getByText('A registered content type also needs an entry', { exact: false }).isVisible()).toBe(true)
      await composer.fill('Keep my existing requirements')
      const messageCount = agent.session.snapshotEvents().filter(event => event.type === 'user/message').length
      await map.getByRole('button', { name: 'Bring this location into chat', exact: true }).first().click()
      expect(await composer.innerText()).toContain('Keep my existing requirements')
      expect(agent.session.snapshotEvents().filter(event => event.type === 'user/message')).toHaveLength(messageCount)
      await map.getByRole('button', { name: /^Settings \d+$/u }).click()
      await map.getByText('Inspect details', { exact: true }).first().click()
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.setViewportSize({ width: 390, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      expect(await map.getByRole('button', { name: 'Bring this location into chat', exact: true }).first().isVisible()).toBe(true)
      await scaffold.ctx.sessions.flush(agent.session)
      await page.reload({ waitUntil: 'load' })
      await map.waitFor({ state: 'visible' })
      expect(await map.getByText('A registered content type also needs an entry', { exact: false }).isVisible()).toBe(true)
    } finally { await browser.close() }
  } finally { await scaffold.close() }
})
