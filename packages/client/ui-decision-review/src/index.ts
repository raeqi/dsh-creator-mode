/** Structured decision adapter over the existing question wait and answer lifecycle. */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { AskUserQuestionRequest } from '@deepseek-ai/dsh-user-questions'
import type { AskUserQuestionAnswer, DecisionReviewPresentation } from '@deepseek-ai/dsh-user-questions/types'

/** One structured review, with generic question fallback for other clients. */
export interface DecisionReviewRequest {
  /** Agent and cancellation lifetime forwarded to user questions. */
  request: Omit<AskUserQuestionRequest, 'questions' | 'wait'>
  /** Caller question identifier, echoed by the answer. */
  id: string
  /** Human-facing question and group name. */
  question: string
  /** Structured cards and option labels. */
  presentation: DecisionReviewPresentation
  /** Complete readable comparison for clients without this plugin. */
  fallback: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Human decisions whose candidate explanations and actions stay together. */
    decisionReviews: DecisionReviews
  }
}

/** Reuses question cancellation, scope and answer validation without granting installation permission. */
export class DecisionReviews extends Service {
  /** @param ctx - Host owning the question answerers. */
  constructor(ctx: Context) { super(ctx, 'decisionReviews') }

  /**
   * Present one comparison and wait for a human choice or custom reply.
   * @param input - Cards, action labels, generic fallback and request lifetime.
   * @returns The ordinary question answer; selecting a card grants no additional permissions.
   */
  ask(input: DecisionReviewRequest): Promise<AskUserQuestionAnswer> {
    const labels = [...input.presentation.cards.flatMap(card => card.actions), ...input.presentation.alternatives]
      .map(action => action.option)
    return this.ctx.userQuestions.ask({ ...input.request, questions: [{ id: input.id, question: input.question,
      detail: input.fallback, options: labels.map(label => ({ label })), intent: input.presentation }] })
  }
}

/** Required Host service for the shared answer lifecycle. */
export const inject = ['userQuestions']

/** @param ctx - Host plugin context. */
export async function apply(ctx: Context): Promise<void> { await ctx.plugin(DecisionReviews) }
