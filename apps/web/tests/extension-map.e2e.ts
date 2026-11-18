/** Real Host inspection blocks for a native layout decision and records only its compact outcome. */
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

it('pauses for placement with search off, submits a complete page layout and replays only its outcome', async () => {
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
      const args = { query: 'todo', language: 'en', outcome: 'Create, complete and filter tasks', usage: 'Add a task, then check it off',
        location: 'right-sidebar', impact: 'Adds a panel tab and opening entry' }
      agent.session.append('turn/start', { turn: 2 })
      agent.session.append('tool/call', { turn: 2, step: 1, callId, name: 'creator_prepare', arguments: JSON.stringify(args) })
      const signal = new AbortController().signal
      const toolSet = await scaffold.ctx.tools.resolve({ agent, modelSelection: { provider: 'mock', model: 'mock' }, signal })
      const running = executeToolFixture(scaffold.ctx, { name: 'creator_prepare', arguments: args, callId, agent, signal, toolSet })
      let completed: Awaited<typeof running> | undefined
      void running.then((value) => { completed = value })
      try {
        const panel = page.getByRole('region', { name: 'Choose a location', exact: true })
        await panel.waitFor({ state: 'visible' }).catch(async (error: unknown) => {
          await page.screenshot({ path: '/tmp/dsh-placement-failure.png' })
          throw new Error(JSON.stringify({ completed, text: (await page.locator('body').innerText()).slice(-6000) }), { cause: error })
        })
        expect(agent.session.snapshotEvents().some(event => event.type === 'tool/result' && event.data.message.toolCallId === callId)).toBe(false)
        expect(await page.getByRole('region', { name: 'What you will get', exact: true }).count()).toBe(0)
        expect(await panel.evaluate(element => getComputedStyle(element).fontSize)).toBe('13px')
        expect((await panel.boundingBox())?.height).toBeLessThanOrEqual(460)
        expect(await panel.locator('code').count()).toBe(0)
        expect(await panel.getByRole('textbox').count()).toBe(0)
        await page.screenshot({ path: '/tmp/dsh-placement-light.png' })
        await panel.getByRole('radio', { name: 'Separate page', exact: true }).click()
        await page.emulateMedia({ colorScheme: 'dark' })
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
        await page.setViewportSize({ width: 390, height: 844 })
        await page.locator('[data-sidebar-collapsed="true"]').waitFor({ state: 'attached' })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        expect(await panel.getByRole('button', { name: 'Confirm and continue', exact: true }).isVisible()).toBe(true)
        await page.screenshot({ path: '/tmp/dsh-placement-phone.png' })
        await panel.getByRole('button', { name: 'Confirm and continue', exact: true }).click()
        const result = await running
        expect(result.isError, JSON.stringify(result)).toBe(false)
        expect(result.content.some(part => part.type === 'text' && part.text.includes('"status":"disabled"'))).toBe(true)
        agent.session.append('tool/result', { turn: 2, step: 1, ...result.meta === undefined ? {} : { meta: result.meta },
          message: createToolResultMessage({ callId, content: result.content, isError: result.isError }) }, { surfaceOp: 'append' })
        agent.session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
        expect(result.meta).toMatchObject({ placementChoice: { status: 'chosen', region: 'page', slots: ['main', 'sidebar.panellist'] } })
        const modelOutput = result.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')
        await expect(JSON.stringify(JSON.parse(modelOutput), null, 2) + '\n').toMatchFileSnapshot(
          fileURLToPath(new URL('./expected/creator-placement-result.json', import.meta.url)),
        )
        const record = page.getByRole('region', { name: 'Chosen location', exact: true })
        await record.waitFor({ state: 'visible' })
        expect(await record.innerText()).toBe('Chosen location · Separate page')
        expect(await page.getByText('View interface locations', { exact: true }).count()).toBe(0)
        await scaffold.ctx.sessions.flush(agent.session)
        await page.reload({ waitUntil: 'load' })
        await record.waitFor({ state: 'visible' })
        expect(await record.innerText()).toBe('Chosen location · Separate page')
      } finally { toolSet.dispose() }
    } finally { await browser.close() }
  } finally { await scaffold.close() }
})
