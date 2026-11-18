/** Creator controls in the shipped Web composition, with keyless recorded model output. */
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'
import { expect, it } from 'vitest'
import { fixtureUserPrompts, launchWebScaffold } from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage } from './support.ts'

const FIXTURE = fileURLToPath(new URL('../../../snapshots/web/creator-persona/session.v4.jsonl', import.meta.url))

async function evidence(page: Page, name: string): Promise<void> {
  const directory = process.env.DSH_CREATOR_EVIDENCE_DIR
  if (directory === undefined) return
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true })
}

it.each([true, false])('uses the accepted market-first=%s preference in the real logged Creator request', async (marketFirst) => {
  const scaffold = await launchWebScaffold({
    replayFixture: FIXTURE, compareReplaySession: false, paceMs: 10,
    agentPresets: { default: 'cordis' },
  })
  const failures: unknown[] = []
  try {
    const executablePath = process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH
    const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
    try {
      const page = await newEnglishPage(browser)
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
      await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
      await connectFreshWorkspace(page, scaffold.workspaceCwd)
      const toggle = page.getByRole('switch', { name: 'Search first', exact: true })
      await toggle.waitFor()
      await expect.poll(() => toggle.isEnabled()).toBe(true)
      expect(await toggle.getAttribute('aria-checked')).toBe('true')
      const examples = page.getByRole('group', { name: 'Creator starting points' })
      const composer = page.locator('[data-composer-input][contenteditable="true"]').last()
      const labels = [
        'Add a tool beside the conversation', 'Give DSH another capability',
        'Turn a routine workflow into a mode', 'Connect a service I use',
      ]
      const promptsByLabel = ['Add a notes panel', 'Give DSH a Bilibili video search tool', 'Create a reusable code review mode', 'Connect GitHub to DSH']
      for (const [index, label] of labels.entries()) {
        await examples.getByRole('button', { name: label, exact: true }).click()
        expect(await composer.innerText()).toContain(promptsByLabel[index])
        expect((await composer.innerText()).length).toBeGreaterThan(200)
      }
      expect(scaffold.ctx.agents.list().flatMap(agent => agent.session.snapshotEvents())
        .filter(event => event.type === 'user/message')).toEqual([])
      await composer.fill('Editable example draft')
      await evidence(page, 'creator-desktop-light')
      await page.emulateMedia({ colorScheme: 'dark' })
      await evidence(page, 'creator-desktop-dark')
      await page.emulateMedia({ colorScheme: 'light' })
      await page.setViewportSize({ width: 390, height: 844 })
      await evidence(page, 'creator-phone')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      for (const label of labels) expect(await examples.getByRole('button', { name: label, exact: true }).isVisible()).toBe(true)
      if (!marketFirst) {
        await toggle.press('Space')
        await expect.poll(() => toggle.getAttribute('aria-checked')).toBe('false')
      }
      await page.reload({ waitUntil: 'load' })
      await toggle.waitFor()
      await expect.poll(() => toggle.getAttribute('aria-checked')).toBe(String(marketFirst))
      expect(await composer.innerText()).toBe('Editable example draft')
      await page.setViewportSize({ width: 1280, height: 900 })
      const prompts = fixtureUserPrompts(await readFile(FIXTURE, 'utf8'))
      const settled = scaffold.whenTurnSettled()
      await composer.fill(prompts[0]!)
      await composer.press('Enter')
      const sessionId = await settled
      const agent = scaffold.ctx.agents.get(sessionId)
      if (agent === undefined) throw new Error('Creator session is missing')
      const system = agent.session.deriveMessages().find(message => message.role === 'system')
      const prompt = system?.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('') ?? ''
      expect(prompt).toContain('Creator mode: prefer configuration, composition, and small adaptations')
      expect(prompt.includes('Preparation also searches configured sources within its reported limits.')).toBe(marketFirst)
      expect(prompt.includes('The user turned off market-first discovery.')).toBe(!marketFirst)
      expect(agent.session.snapshotEvents().filter(event => event.type === 'tool/call')).toEqual([])
      await page.getByText('READY', { exact: true }).waitFor()
      expect(await examples.count()).toBe(0)
    } finally { await browser.close() }
  } catch (error) {
    failures.push(error)
  }
  try { await scaffold.close() } catch (error) { failures.push(error) }
  if (failures.length > 0) throw new AggregateError(failures, 'Creator browser validation failed')
})
