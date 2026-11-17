/** Session-persisted requirements survive hiding and reopening the decision panel. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

interface DecisionDraftState { notes: Record<string, string> }
type DecisionDraftActions = {
  set: (draft: DecisionDraftState, key: string, text: string) => void
  prune: (draft: DecisionDraftState, keys: readonly string[]) => void
}

/**
 * Declare the Session-persisted requirements for each pending decision.
 * @returns A store handle owned by the Slot registry.
 */
export function createDecisionDrafts(): EngineStoreHandle<DecisionDraftState, DecisionDraftActions> {
  return defineStore({ init: (): DecisionDraftState => ({ notes: {} }), persist: 'dsh.decision-review.drafts.v1',
    actions: {
      set: (draft, key: string, text: string) => { draft.notes[key] = text },
      prune: (draft, keys: readonly string[]) => {
        draft.notes = Object.fromEntries(Object.entries(draft.notes).filter(([key]) => keys.includes(key)))
      },
    } })
}
