/** Lightweight Creator entries in the original conversation composer. */
import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './CreatorControls.module.css'

/** Host-accepted profile preference and its ordered write operation. */
export interface CreatorMarketInjected {
  hooks: { creatorPreference: ObservableSnapshot<ConfigFormSnapshot<{ marketFirst: boolean }>> }
  setMarketFirst: (enabled: boolean) => Promise<boolean>
}

/** Editable example insertion; deliberately has no submit operation. */
export interface CreatorExamplesInjected {
  fillDraft: (text: string) => void
}

type MarketProps = PropsRuntime<'conversation.input.left'> & PropsLocale<'settings.agentPreset'> & InjectFace<CreatorMarketInjected>
type ExamplesProps = PropsRuntime<'conversation.composer.dock'> & PropsLocale<'settings.agentPreset'> & InjectFace<CreatorExamplesInjected>

/**
 * Show the profile preference only in Creator sessions, retaining Host state until a write commits.
 * @param props - Slot-bound session, settings and locale inputs.
 * @returns Accessible switch and any local write failure.
 */
export function CreatorMarketSwitch({ sessionId, useSessions, useCreatorPreference, setMarketFirst, t }: MarketProps) {
  const creator = useSessions(state => state.byId[sessionId]?.projectionValues?.agentPreset === 'cordis')
  const preference = useCreatorPreference(value => value)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!creator) return null
  const checked = preference.value?.marketFirst ?? true
  const change = async (): Promise<void> => {
    setSaving(true)
    setFailed(false)
    try { setFailed(!await setMarketFirst(!checked)) }
    catch (_error) { setFailed(true) }
    finally { setSaving(false) }
  }
  return <span className={css.switchWrap}>
    <Tooltip label={t('creatorMarketHelp')} side="top" portal>
      <button type="button" role="switch" aria-checked={checked}
        aria-label={t('creatorMarketLabel')} aria-description={t('creatorMarketHelp')}
        aria-busy={saving} className={css.switch}
        disabled={saving || preference.status !== 'ready' || !preference.writable}
        onClick={() => { void change() }}>
        <span aria-hidden className={css.indicator} />{t('creatorMarketLabel')}
      </button>
    </Tooltip>
    {failed && <span role="status" className={css.error}>{t('creatorMarketFailed')}</span>}
  </span>
}

/**
 * Offer four editable starting points below an untouched Creator session's composer.
 * @param props - Slot-bound session, draft callback and locale inputs.
 * @returns The examples, or nothing in other modes or after the conversation starts.
 */
export function CreatorExamples({ sessionId, useSessions, fillDraft, t }: ExamplesProps) {
  const visible = useSessions((state) => {
    const session = state.byId[sessionId]
    return session?.blank === true && session.projectionValues?.agentPreset === 'cordis'
  })
  if (!visible) return null
  const keys = ['creatorExampleTool', 'creatorExampleCapability', 'creatorExampleMode', 'creatorExampleService'] as const
  return <div className={css.examples} role="group" aria-label={t('creatorExamplesLabel')}>
    {keys.map(key => <button key={key} type="button" className={css.example}
      onClick={() => { fillDraft(t(key)) }}>{t(key)}</button>)}
  </div>
}
