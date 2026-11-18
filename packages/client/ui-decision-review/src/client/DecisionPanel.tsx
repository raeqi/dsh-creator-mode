/** Contextual candidate actions share the existing pending-question answer channel. */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client'
import type { createDecisionDrafts } from './drafts.ts'
import css from './DecisionPanel.module.css'

/**
 * Render candidate explanations next to the exact actions they select.
 * @param props - Pending request, scoped drafts and localized copy.
 * @returns A bounded decision panel with an always-reachable action footer.
 */
export function DecisionPanel({ question, requestKey, liveKeys, recorded, busy, disabled, failed, answer, t, useStore, actions }: PropsRuntime<'conversation.question.presentation'> & PropsStore<ReturnType<typeof createDecisionDrafts>> & PropsLocale<'decisionReview'>) {
  const presentation = question.intent
  const heading = useRef<HTMLHeadingElement>(null)
  const [sent, setSent] = useState<string | undefined>()
  const stored = useStore(state => state.notes[requestKey])
  const note = typeof stored === 'string' ? stored : ''
  const settled = recorded !== undefined || sent !== undefined
  useEffect(() => { actions.prune(liveKeys) }, [actions, liveKeys])
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [requestKey])
  if (presentation?.kind !== 'decision-review') return null
  const submit = async (label?: string, includeNote = true): Promise<void> => {
    if (disabled) return
    const accepted = await answer(label === undefined ? [] : [label], includeNote && note.trim() !== '' ? note : undefined)
    if (!accepted) return
    const card = presentation.cards.find(item => item.actions.some(action => action.option === label))
    const action = card?.actions.find(item => item.option === label)
    setSent(card === undefined ? label ?? t('undecided') : `${action?.label ?? ''} · ${card.title}`)
    actions.set(requestKey, '')
  }
  return <div className={css.frame}><section className={css.panel} aria-label={t('title')}>
    <header className={css.header}>
      <div><div className={css.eyebrow}>{settled ? t('recorded') : t('waiting')}</div><h2 ref={heading} tabIndex={-1}>{question.question}</h2></div>
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
            onChange={(event) => { actions.set(requestKey, event.target.value) }} /></label></details>
        </>}
    </div>
    <footer className={css.footer}>
      <span className={css.summary}>{failed ? <span role="alert">{t('failed')}</span> : busy ? t('working') : presentation.notice ?? t('authorization')}</span>
      {!settled && <div className={css.actions}><Button size="sm" variant="ghost" disabled={disabled} onClick={() => { void submit(undefined, false) }}>{t('skip')}</Button>
        <Button size="sm" variant="outline" disabled={disabled || note.trim() === ''} onClick={() => { void submit() }}>{t('send')}</Button></div>}
    </footer>
  </section></div>
}
