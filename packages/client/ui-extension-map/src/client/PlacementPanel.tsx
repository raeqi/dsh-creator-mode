/** A blocking layout decision over verified entry/body combinations. */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { placementSchema, type PlacementReview } from '../model.ts'
import css from './PlacementPanel.module.css'

type PanelProps = PropsRuntime<'conversation.question.presentation'> & PropsLocale<'extensionMap'>

/**
 * Render only this plugin's validated decision payload.
 * @param props - Question-owner data and answer callbacks.
 * @returns A bounded spatial decision, or an actionable invalid-payload report.
 */
export function PlacementPanel(props: PanelProps) {
  const intent = props.question.intent
  const parsed = placementSchema.safeParse(intent?.kind === 'decision-review' ? intent.view?.data : undefined)
  return parsed.success ? <PlacementControls {...props} design={parsed.data} />
    : <section className={css.panel} role="alert">{props.t('reviewInvalid')}<Button onClick={() => { void props.answer([]) }}>{props.t('reviewCancel')}</Button></section>
}

function PlacementControls({ design, question, requestKey, disabled, busy, failed, answer, t }: PanelProps & { design: PlacementReview }) {
  const [region, setRegion] = useState(design.recommended ?? design.options[0]?.region)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [requestKey])
  const primary = design.options.filter(option => ['right-sidebar', 'conversation', 'page', 'composer'].includes(option.region))
  const secondary = design.options.filter(option => !primary.includes(option))
  const selected = design.options.find(option => option.region === region)
  return <div className={css.frame}><section className={css.panel} aria-label={t('reviewTitle')}>
    <header className={css.header}><h2 ref={heading} tabIndex={-1}>{question.question}</h2><p>{design.outcome}</p></header>
    <div className={css.body}>
      <div className={css.canvas} role="radiogroup" aria-label={t('reviewTitle')}>
        <div className={css.caption}>{t('reviewWindow')}</div>
        {primary.map(option => <button type="button" role="radio" key={option.region}
          aria-checked={option.region === region}
          tabIndex={option.region === region || (!primary.some(item => item.region === region) && primary[0] === option) ? 0 : -1}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const index = primary.findIndex(item => item.region === region)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? primary.length - 1
              : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + primary.length) % primary.length
            const target = primary[next]
            if (target !== undefined) { setRegion(target.region); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-region="${target.region}"]`)?.focus() }
          }} data-region={option.region} disabled={disabled}
          className={css.position} onClick={() => { setRegion(option.region) }}>
          {option.label}{design.recommended === option.region && <span>{t('reviewRecommended')}</span>}
        </button>)}
      </div>
      {secondary.length > 0 && <details className={css.details} open={secondary.some(option => option.region === region)}>
        <summary>{t('reviewMore')}</summary><div className={css.more}>
          {secondary.map(option => <Button key={option.region} size="sm" variant={region === option.region ? 'primary' : 'outline'}
            disabled={disabled} aria-pressed={region === option.region} onClick={() => { setRegion(option.region) }}>
            {option.label}{design.recommended === option.region ? ` · ${t('reviewRecommended')}` : ''}
          </Button>)}
        </div>
      </details>}
      {selected !== undefined && <p className={css.description}>{selected.description}</p>}
      <details className={css.details}><summary>{t('reviewDetails')}</summary><p>{design.usage}</p></details>
    </div>
    <footer className={css.footer}>
      <span role={failed ? 'alert' : 'status'}>{failed ? t('reviewFailed') : busy ? t('reviewWorking') : t('reviewWaiting')}</span>
      <div><Button size="sm" variant="ghost" disabled={disabled} onClick={() => { void answer([]) }}>{t('reviewCancel')}</Button>
        <Button size="sm" variant="primary" disabled={disabled || selected === undefined}
          onClick={() => { if (selected !== undefined) void answer([selected.option]) }}>{t('reviewContinue')}</Button></div>
    </footer>
  </section></div>
}
