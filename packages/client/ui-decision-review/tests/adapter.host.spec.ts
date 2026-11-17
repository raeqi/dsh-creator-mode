/** The reusable adapter preserves generic fallback and option values across presentation. */
import { Context } from '@deepseek-ai/cordis'
import { expect, it, onTestFinished } from 'vitest'
import UserQuestions from '@deepseek-ai/dsh-user-questions'
import * as plugin from '../src/index.ts'

it('forwards structured cards through the existing question answerer without changing the answer', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin(UserQuestions)
  await ctx.plugin(plugin)
  ctx.on('user-questions/request', async (request) => {
    expect(request.questions[0]).toMatchObject({ id: 'review', detail: 'Readable fallback', intent: { kind: 'decision-review' },
      options: [{ label: 'use-notes' }, { label: 'create' }] })
    return { answers: [{ id: 'review', selected: ['use-notes'], custom: 'Keep it local' }] }
  })
  const answer = await ctx.decisionReviews.ask({ id: 'review', request: {}, question: 'Choose a direction', fallback: 'Readable fallback',
    presentation: { kind: 'decision-review', summary: 'One option', cards: [{ title: 'Notes', summary: 'Local notes', facts: [],
      actions: [{ option: 'use-notes', label: 'Continue with this option' }] }], alternatives: [{ option: 'create', label: 'Create new' }] } })
  expect(answer).toEqual({ answers: [{ id: 'review', selected: ['use-notes'], custom: 'Keep it local' }] })
})
