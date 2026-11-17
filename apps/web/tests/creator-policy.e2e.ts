/** Real Web profile assembly and Session logging without a browser or provider credentials. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-workspace'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { fixtureUserPrompts, launchWebScaffold } from './scaffold.ts'

const FIXTURE = fileURLToPath(new URL('../../../snapshots/web/creator-persona/session.v4.jsonl', import.meta.url))

it.each([
  { preset: 'cordis', marketFirst: true },
  { preset: 'cordis', marketFirst: false },
  { preset: 'standard', marketFirst: true },
])('logs the $preset request with market-first=$marketFirst and no cross-mode guidance', async ({ preset, marketFirst }) => {
  const scaffold = await launchWebScaffold({
    replayFixture: FIXTURE, compareReplaySession: false,
    agentPresets: { default: preset },
  })
  const failures: unknown[] = []
  try {
    const initial = scaffold.ctx.settings.describe().find(row => row.ns === 'ui-agent-preset')
    expect(initial?.value).toMatchObject({ marketFirst: true })
    if (!marketFirst) await scaffold.ctx.settings.update('ui-agent-preset', { marketFirst: false })
    const { sessionId } = await scaffold.ctx.sessionController.create({ cwd: scaffold.workspaceCwd })
    const agent = scaffold.ctx.agents.get(sessionId)
    if (agent === undefined) throw new Error('Created Session has no Agent')
    const prompt = fixtureUserPrompts(await readFile(FIXTURE, 'utf8'))[0]
    if (prompt === undefined) throw new Error('Recorded fixture has no user input')
    agent.followup(createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }))
    await agent.whenIdle()
    await scaffold.ctx.sessions.flush(agent.session)
    const system = agent.session.deriveMessages().find(message => message.role === 'system')
    const text = system?.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('') ?? ''
    const start = text.indexOf('Creator mode: prefer configuration, composition, and small adaptations')
    if (preset === 'cordis') {
      expect(start).toBeGreaterThanOrEqual(0)
      expect(text.includes('first call it with action=list_indexes')).toBe(marketFirst)
      expect(text.includes('The user turned off market-first discovery.')).toBe(!marketFirst)
      if (marketFirst) {
        const owner = new URL('../../../snapshots/web/creator-persona/system-prompt.expected.md', import.meta.url)
        expect(text.trimEnd() + '\n').toBe(await readFile(owner, 'utf8'))
      }
      const snapshot = fileURLToPath(new URL(`./expected/creator-guidance-${marketFirst ? 'on' : 'off'}.txt`, import.meta.url))
      await expect(text.slice(start).trimEnd() + '\n').toMatchFileSnapshot(snapshot)
    } else expect(start).toBe(-1)
    const events = agent.session.snapshotEvents()
    expect(events.filter(event => event.type === 'tool/call')).toEqual([])
    expect(events.some(event => event.type === 'system/message')).toBe(true)
    expect(events.some(event => event.type === 'assistant/message'
      && event.data.message.content.some(block => block.type === 'text' && block.text.includes('READY')))).toBe(true)
  } catch (error) { failures.push(error) }
  try { await scaffold.close() } catch (error) { failures.push(error) }
  if (failures.length > 0) throw new AggregateError(failures, 'Creator profile validation failed')
})
