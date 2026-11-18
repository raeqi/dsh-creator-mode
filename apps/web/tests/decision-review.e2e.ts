/** The optional decision renderer wins the composer chain and submits contextual actions over the real answer channel. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createToolResultMessage, type ToolCallId } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-client-ui-decision-review'
import { fixtureUserPrompts, launchWebScaffold } from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage } from './support.ts'

const FIXTURE = fileURLToPath(new URL('../../../snapshots/web/creator-persona/session.v4.jsonl', import.meta.url))

it('renders candidate-local actions instead of a numbered radio list and keeps the footer reachable', async () => {
  const scaffold = await launchWebScaffold({ replayFixture: FIXTURE, compareReplaySession: false, paceMs: 10,
    agentPresets: { default: 'cordis' } })
  try {
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
      agent.session.append('turn/start', { turn: 2 })
      agent.session.append('tool/call', { turn: 2, step: 1, callId: brandString<ToolCallId>('preview'), name: 'creator_prepare',
        arguments: JSON.stringify({ query: 'notes', language: 'en', outcome: 'A local notes panel', usage: 'Open Notes and create a note', location: 'right-sidebar', impact: 'Adds a right-sidebar tab' }) })
      const preview = page.getByRole('region', { name: 'What you will get', exact: true })
      await preview.waitFor({ state: 'visible' })
      expect(await preview.getByText('Open Notes and create a note').isVisible()).toBe(true)
      expect(await preview.evaluate(element => getComputedStyle(element).fontSize)).toBe('13px')
      const answer = scaffold.ctx.decisionReviews.ask({ id: 'review', request: { agent }, question: 'Which option fits?',
        fallback: 'Notes stores text; sidebar placement is unverified.', presentation: { kind: 'decision-review', summary: 'Two candidates',
          cards: ['Notes', 'Sticky notes'].map((title, index) => ({ title, summary: '',
            facts: [{ label: 'Coverage', value: 'Stores text' }, { label: 'Gaps', value: 'Sidebar placement needs verification' }],
            detail: '1.0.0 · https://market.example/index.json', actions: [{ option: `use-${index}`, label: 'Continue with this option' }] })),
          alternatives: [{ option: 'create', label: 'Create new' }] } })
      const panel = page.getByRole('region', { name: 'Compare options', exact: true })
      await panel.waitFor({ state: 'visible' })
      expect(await panel.getByRole('radio').count()).toBe(0)
      expect((await panel.boundingBox())?.height).toBeLessThanOrEqual(440)
      expect(await panel.getByRole('textbox').isVisible()).toBe(false)
      await page.screenshot({ path: '/tmp/dsh-decision-review-light.png' })
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.screenshot({ path: '/tmp/dsh-decision-review-dark.png' })
      await page.setViewportSize({ width: 390, height: 844 })
      const footer = panel.getByRole('button', { name: 'Decide later', exact: true })
      expect(await footer.isVisible()).toBe(true)
      await panel.getByText('Add requirements or change direction', { exact: true }).click()
      await panel.getByRole('textbox').fill('Keep data local')
      const card = panel.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Sticky notes', exact: true }) })
      await card.getByRole('button', { name: 'Continue with this option', exact: true }).click()
      expect(await answer).toEqual({ answers: [{ id: 'review', selected: ['use-1'], custom: 'Keep data local' }] })
      const callId = brandString<ToolCallId>('recorded-choice')
      agent.session.append('tool/call', { turn: 2, step: 2, callId, name: 'creator_choose', arguments: '{"comparison":"Two candidates"}' })
      agent.session.append('tool/result', { turn: 2, step: 2, message: createToolResultMessage({ callId, isError: false,
        content: [{ type: 'text', text: JSON.stringify({ decisionReview: { title: 'Which option fits?', choice: 'Use Sticky notes', summary: 'Stores text, sidebar placement needs verification', custom: 'Keep data local' } }) }] }) }, { surfaceOp: 'append' })
      agent.session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
      const record = page.getByRole('region', { name: 'Decision recorded', exact: true })
      await record.waitFor({ state: 'visible' })
      expect(await record.evaluate(element => getComputedStyle(element).fontSize)).toBe('13px')
      expect(await record.getByRole('heading').evaluate(element => getComputedStyle(element).fontSize)).toBe('13px')
      await record.getByText('Decision context', { exact: true }).click()
      expect(await record.locator('p').last().evaluate(element => getComputedStyle(element).fontSize)).toBe('13px')
      await page.screenshot({ path: '/tmp/dsh-creator-record-phone.png' })
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.emulateMedia({ colorScheme: 'light' })
      await page.screenshot({ path: '/tmp/dsh-creator-record-light.png' })
    } finally { await browser.close() }
  } finally { await scaffold.close() }
})
