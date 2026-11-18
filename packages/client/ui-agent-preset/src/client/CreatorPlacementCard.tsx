/** Task-specific placement cards outside the conversation’s collapsed tool process. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CreatorPlacementKind } from './creator-placement.ts'
import css from './CreatorPlacementCard.module.css'

const regions = ['page', 'conversation', 'composer', 'right-sidebar'] as const

/**
 * Keep a task's proposed location visible in the conversation when its tool process is collapsed.
 * @param props - Recorded placement node and localized labels.
 * @returns The region sketch and explanation for this task.
 */
export function CreatorPlacementCard({ node, t }: PropsRuntime<'conversation.chat.node', CreatorPlacementKind> & PropsLocale<'settings.agentPreset'>) {
  return <section className={css.card} aria-label={t('creatorPreparationTitle')}>
    {node.data.outcome !== undefined && <><div className={css.title}>{t('creatorPreparationTitle')}</div>
      <p className={css.outcome}>{node.data.outcome}</p>
      <div className={css.title}>{t('creatorPreparationUsage')}</div><p className={css.text}>{node.data.usage}</p></>}
    {node.data.location !== undefined && <><div className={css.title}>{t('creatorPreparationLocation')}</div>
      <div className={css.regions}>
        {regions.map(region => <div key={region} className={css.region} data-region={region} data-selected={node.data.location === region}>
          {t(`creatorRegion_${region}`)}{node.data.location === region && <span> · {t('creatorPreparationProposed')}</span>}
        </div>)}
      </div>
      <p className={css.text}>{node.data.impact}</p>
      <div className={css.text}>{t('creatorPreparationPlacementHelp')}</div></>}
  </section>
}
