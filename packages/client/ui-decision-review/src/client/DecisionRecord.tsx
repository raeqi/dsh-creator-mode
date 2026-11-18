/** Compact, persistent outcome instead of reopening a completed question. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DecisionRecordKind } from './record.ts'
import css from './DecisionPanel.module.css'

/**
 * Show the selected direction and any additional human requirements.
 * @param props - Logged decision and localized labels.
 * @returns A read-only decision record in the conversation.
 */
export function DecisionRecord({ node, t }: PropsRuntime<'conversation.chat.node', DecisionRecordKind> & PropsLocale<'decisionReview'>) {
  return <section className={`${css.card} ${css.record}`} aria-label={t('recorded')}>
    <div className={css.eyebrow}>{t('recorded')}</div><h3>{node.data.choice}</h3>
    {node.data.custom !== '' && <p>{t('custom')}: {node.data.custom}</p>}
    {node.data.summary !== '' && <details><summary>{t('recordDetails')}</summary><p>{node.data.summary}</p></details>}
  </section>
}
