/** Contextual candidate actions share the existing pending-question answer channel. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PendingQuestion } from '@deepseek-ai/dsh-client-ui-user-questions/client'
import type { DecisionReviewPresentation } from '@deepseek-ai/dsh-user-questions/types'
import type { createDecisionDrafts } from './drafts.ts'
import css from './DecisionPanel.module.css'

/** A supported, single-question review whose actions match the generic protocol. */
export interface DecisionMatch {
  /** Existing pending request, including cancellation and settlement. */
  pending: PendingQuestion
  /** Structured presentation from its question. */
  presentation: DecisionReviewPresentation
}

/**
 * Render candidate explanations next to the exact actions they select.
 * @param props - Pending request, scoped drafts and localized copy.
 * @returns A bounded decision panel with an always-reachable action footer.
 */
export function DecisionPanel({ matched, t, useStore, actions }: PropsRuntime<'conversation.composer'> & PropsStore<ReturnType<typeof createDecisionDrafts>> & PropsLocale<'decisionReview'> & { matched: DecisionMatch }) {
  const { pending, presentation } = matched
  const snapshot = useSyncExternalStore(pending.subscribe, pending.getSnapshot)
  const heading = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [sent, setSent] = useState<string | undefined>()
  const stored = useStore(state => state.notes[pending.key])
  const note = typeof stored === 'string' ? stored : ''
  const question = pending.questions[0]
  const recorded = pending.review?.[0]
  const settled = pending.review !== undefined || sent !== undefined
  const disabled = busy || snapshot.channel === 'none' || snapshot.closed || settled
  useEffect(() => { actions.prune(pending.liveKeys()); heading.current?.focus({ preventScroll: true }) }, [actions, pending])
  const submit = async (label?: string, includeNote = true): Promise<void> => {
    if (disabled || question === undefined) return
    setBusy(true)
    setError(false)
    try {
      await pending.answer({ answers: [{ id: question.id, selected: label === undefined ? [] : [label],
        ...!includeNote || note.trim() === '' ? {} : { custom: note } }] })
      const card = presentation.cards.find(item => item.actions.some(action => action.option === label))
      const action = card?.actions.find(item => item.option === label)
      setSent(card === undefined ? label ?? t('undecided') : `${action?.label ?? ''} · ${card.title}`)
      actions.set(pending.key, '')
    } catch {
      setError(true)
    } finally { setBusy(false) }
  }
  return <div className={css.frame}><section className={css.panel} aria-label={t('title')}>
    <header className={css.header}>
      <div><div className={css.eyebrow}>{settled ? t('recorded') : t('waiting')}</div><h2 ref={heading} tabIndex={-1}>{question?.question}</h2></div>
      {pending.dismissal === 'hide' && <Button size="sm" variant="ghost" onClick={() => { void pending.dismiss().catch(() => { setError(true) }) }}>{t('close')}</Button>}
    </header>
    <div className={css.body}>
      {presentation.summary !== '' && <p className={css.summary}>{presentation.summary}</p>}
      {settled ? <p role="status">{recorded?.selected[0] ?? sent ?? t('undecided')}{recorded?.custom && ` · ${recorded.custom}`}</p>
        : <>
          <div className={css.cards}>{presentation.cards.map(card => <article key={card.title} className={css.card}>
            <h3>{card.title}</h3><p className={css.summary}>{card.summary}</p>
            <dl>{card.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
            {card.detail && <details><summary>{t('details')}</summary><p className={css.metadata}>{card.detail}</p></details>}
            <div className={css.actions}>{card.actions.map(action => <Button key={action.option} size="sm" variant="outline" disabled={disabled}
              onClick={() => { void submit(action.option) }}>{action.label}</Button>)}</div>
          </article>)}</div>
          <div className={css.actions}>{presentation.alternatives.map(action => <Button key={action.option} size="sm" variant="ghost" disabled={disabled}
            onClick={() => { void submit(action.option) }}>{action.label}</Button>)}</div>
          <details className={css.requirements}><summary>{t('note')}</summary><label>{t('custom')}<textarea value={note} disabled={disabled} rows={2}
            onChange={(event) => { pending.engage(); actions.set(pending.key, event.target.value) }} /></label></details>
        </>}
    </div>
    <footer className={css.footer}>
      <span className={css.summary}>{error ? <span role="alert">{t('failed')}</span> : busy ? t('working') : presentation.notice ?? t('authorization')}</span>
      {!settled && <div className={css.actions}><Button size="sm" variant="ghost" disabled={disabled} onClick={() => { void submit(undefined, false) }}>{t('skip')}</Button>
        <Button size="sm" variant="outline" disabled={disabled || note.trim() === ''} onClick={() => { void submit() }}>{t('send')}</Button></div>}
    </footer>
  </section></div>
}
