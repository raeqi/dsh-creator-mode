/** Interactive spatial browsing with explicit, editable location feedback. */
import { useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExtensionMapKind } from './record.ts'
import type { ExtensionRegion, ExtensionSlot } from '../model.ts'
import type { MapKey } from './locales.ts'
import css from './ExtensionMapCard.module.css'

const regions = ['page', 'left-sidebar', 'header', 'conversation', 'composer', 'right-sidebar', 'settings', 'plugins'] as const
const labels: Readonly<Record<string, MapKey>> = {
  'root': 'slot_root',
  'shell.overlay': 'slot_shell.overlay',
  'shell.quota-notice': 'slot_shell.quota-notice',
  'contextMenu.content': 'slot_contextMenu.content',
  'sidebar.right.tab.menu.item': 'slot_sidebar.right.tab.menu.item',
  'sidebar.workspaces.session.menu.item': 'slot_sidebar.workspaces.session.menu.item',
  'contextMenu.icon': 'slot_contextMenu.icon',
  'workspace.toast': 'slot_workspace.toast',
  'sidebar': 'slot_sidebar',
  'sidebar.footer.action': 'slot_sidebar.footer.action',
  'sidebar.toggle.badge': 'slot_sidebar.toggle.badge',
  'sidebar.settings': 'slot_sidebar.settings',
  'settings.section': 'slot_settings.section',
  'settings.general.item': 'slot_settings.general.item',
  'settings.plugins.tab': 'slot_settings.plugins.tab',
  'settings.models.provider-card': 'slot_settings.models.provider-card',
  'settings.models.footer': 'slot_settings.models.footer',
  'settings.onboarding': 'slot_settings.onboarding',
  'settings.models.sign-in': 'slot_settings.models.sign-in',
  'settings.trigger': 'slot_settings.trigger',
  'settings.header': 'slot_settings.header',
  'settings.action': 'slot_settings.action',
  'settings.close': 'slot_settings.close',
  'settings.launcher': 'slot_settings.launcher',
  'settings.launcher.notifications': 'slot_settings.launcher.notifications',
  'settings.section.icon': 'slot_settings.section.icon',
  'sidebar.workspaces': 'slot_sidebar.workspaces',
  'sidebar.workspaces.session.row.action': 'slot_sidebar.workspaces.session.row.action',
  'sidebar.workspaces.directoryFlow': 'slot_sidebar.workspaces.directoryFlow',
  'sidebar.session.row.leading': 'slot_sidebar.session.row.leading',
  'sidebar.session.row.trailing': 'slot_sidebar.session.row.trailing',
  'sidebar.session.row.hover': 'slot_sidebar.session.row.hover',
  'sidebar.brand.mark': 'slot_sidebar.brand.mark',
  'sidebar.brand.name': 'slot_sidebar.brand.name',
  'sidebar.panellist.actions': 'slot_sidebar.panellist.actions',
  'sidebar.session.action': 'slot_sidebar.session.action',
  'main': 'slot_main',
  'plugins.item': 'slot_plugins.item',
  'plugins.tab': 'slot_plugins.tab',
  'plugins.add.actions': 'slot_plugins.add.actions',
  'plugins.bundle.activation': 'slot_plugins.bundle.activation',
  'plugins.bundle.config': 'slot_plugins.bundle.config',
  'plugins.row.config': 'slot_plugins.row.config',
  'plugins.detail.actions': 'slot_plugins.detail.actions',
  'plugins.detail.badge': 'slot_plugins.detail.badge',
  'plugins.detail.section': 'slot_plugins.detail.section',
  'main.conversation': 'slot_main.conversation',
  'conversation.header': 'slot_conversation.header',
  'conversation.header.leading': 'slot_conversation.header.leading',
  'conversation.session.header': 'slot_conversation.session.header',
  'conversation.session.header.actions': 'slot_conversation.session.header.actions',
  'conversation.session.header.actions.subagent.footer': 'slot_conversation.session.header.actions.subagent.footer',
  'conversation.session.header.corner': 'slot_conversation.session.header.corner',
  'conversation.session.header.utilities': 'headerTools',
  'conversation.session.header.lineage': 'slot_conversation.session.header.lineage',
  'conversation.session.header.views.actions': 'slot_conversation.session.header.views.actions',
  'rightbar': 'slot_rightbar',
  'rightbar.session': 'slot_rightbar.session',
  'sidebar.right.pane.tab': 'sidebarBody',
  'sidebar.right.tab.guide.actions': 'slot_sidebar.right.tab.guide.actions',
  'sidebar.right.tab.guide.entry': 'slot_sidebar.right.tab.guide.entry',
  'sidebar.right.tab.guide': 'slot_sidebar.right.tab.guide',
  'sidebar.right.tab.document': 'slot_sidebar.right.tab.document',
  'sidebar.right.tab.document.office.pdf': 'slot_sidebar.right.tab.document.office.pdf',
  'sidebar.right.tab.document.actions': 'slot_sidebar.right.tab.document.actions',
  'sidebar.right.tab.document.unpreviewable': 'slot_sidebar.right.tab.document.unpreviewable',
  'sidebar.right.tab.document.action': 'slot_sidebar.right.tab.document.action',
  'sidebar.right.tab.files.actions': 'slot_sidebar.right.tab.files.actions',
  'deliverables.review.file.actions': 'slot_deliverables.review.file.actions',
  'sidebar.chat.conversation': 'slot_sidebar.chat.conversation',
  'sidebar.right.pane.tab.title': 'slot_sidebar.right.pane.tab.title',
  'shell.bottom': 'slot_shell.bottom',
  'shell.leading': 'slot_shell.leading',
  'conversation.approval.detail': 'slot_conversation.approval.detail',
  'workspace.picker.directoryFlow': 'slot_workspace.picker.directoryFlow',
  'sidebar.panellist': 'slot_sidebar.panellist',
  'conversation.user.text.node': 'slot_conversation.user.text.node',
  'conversation.hero.frame': 'slot_conversation.hero.frame',
  'conversation.composer': 'slot_conversation.composer',
  'conversation.plan-review.actions': 'slot_conversation.plan-review.actions',
  'conversation.hero.workspace': 'slot_conversation.hero.workspace',
  'conversation.hero.workspace.directoryFlow': 'slot_conversation.hero.workspace.directoryFlow',
  'conversation.session': 'slot_conversation.session',
  'conversation.view': 'slot_conversation.view',
  'conversation.trajectory.images': 'slot_conversation.trajectory.images',
  'conversation.chat.text-interaction': 'slot_conversation.chat.text-interaction',
  'conversation.chat.flow': 'slot_conversation.chat.flow',
  'conversation.chat.node': 'slot_conversation.chat.node',
  'tool.call.toolview': 'slot_tool.call.toolview',
  'tool.call.images': 'slot_tool.call.images',
  'tool.view.cordis': 'slot_tool.view.cordis',
  'conversation.chat.commandview': 'slot_conversation.chat.commandview',
  'conversation.chat.assistant-actions': 'slot_conversation.chat.assistant-actions',
  'conversation.chat.message.images': 'slot_conversation.chat.message.images',
  'conversation.chat.turnTail': 'slot_conversation.chat.turnTail',
  'deliverables.file.actions': 'slot_deliverables.file.actions',
  'conversation.chat.reasoning.body': 'slot_conversation.chat.reasoning.body',
  'conversation.chat.user.before': 'slot_conversation.chat.user.before',
  'conversation.chat.markdown.fence': 'slot_conversation.chat.markdown.fence',
  'conversation.composer.bar': 'slot_conversation.composer.bar',
  'conversation.input.overlay': 'slot_conversation.input.overlay',
  'conversation.input.attachments': 'slot_conversation.input.attachments',
  'conversation.input.permission': 'slot_conversation.input.permission',
  'conversation.input.left': 'slot_conversation.input.left',
  'conversation.input.plan': 'slot_conversation.input.plan',
  'conversation.input.right': 'slot_conversation.input.right',
  'conversation.input.model': 'slot_conversation.input.model',
  'conversation.input.model.options': 'slot_conversation.input.model.options',
  'conversation.input.model.pane': 'slot_conversation.input.model.pane',
  'conversation.input.model.label': 'slot_conversation.input.model.label',
  'conversation.input.activity': 'slot_conversation.input.activity',
  'conversation.composer.dock': 'slot_conversation.composer.dock',
  'conversation.input.dock': 'slot_conversation.input.dock',
  'conversation.hero.brand.mark': 'slot_conversation.hero.brand.mark',
  'conversation.hero.agentPreset': 'slot_conversation.hero.agentPreset',
  'conversation.hero.options': 'slot_conversation.hero.options',
  'conversation.chat.user.images': 'slot_conversation.chat.user.images',
}

/** @param props - Recorded inspection or confirmed placement. @returns A concise outcome with an optional read-only inventory. */
export function ExtensionMapCard({ node, t }: PropsRuntime<'conversation.chat.node', ExtensionMapKind> & PropsLocale<'extensionMap'>) {
  const { map, choice } = node.data
  const [region, setRegion] = useState<ExtensionRegion>(map.region)
  const label = (slot: ExtensionSlot): string => { const key = labels[slot.name]; return key === undefined ? slot.name : t(key) }
  if (choice?.status === 'chosen') return <section className={css.card} aria-label={t('chosen')}>
    <span className={css.muted}>{t('chosen')} · </span>{choice.label ?? (choice.region === undefined ? '' : t(choice.region))}
  </section>
  return <details className={css.card}><summary>{t('browse')}</summary>
    {map.issues.length > 0 && <p role="status">{t('missing')}</p>}
    <div className={css.map} role="group" aria-label={t('explore')}>
      {regions.map(item => <button type="button" key={item} className={css.region} data-region={item}
        aria-pressed={region === item} onClick={() => { setRegion(item) }}>{t(item)}</button>)}
    </div>
    <div className={css.list}>
      {map.slots.filter(slot => region === 'overview' || slot.region === region).map(slot => <article className={css.slot} key={slot.name}>
        <span>{label(slot)}</span><details><summary>{t('technical')}</summary>
          <code>{slot.name}</code><p>{slot.purpose}</p><p>{t(slot.risk)}</p></details>
      </article>)}
    </div>
  </details>
}
