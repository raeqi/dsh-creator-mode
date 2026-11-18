/** Runtime inventory shared by the Host inspector and its replayable Client card. */
import { z } from 'zod'

/** Spatial groups describe the application document, not operating-system windows. */
export const regionSchema = z.enum(['overview', 'page', 'left-sidebar', 'header', 'conversation', 'composer', 'right-sidebar', 'settings', 'plugins'])
/** Region requested by a user or a design preview. */
export type ExtensionRegion = z.infer<typeof regionSchema>
const slotSchema = z.object({ name: z.string(), kind: z.enum(['single', 'list', 'keyed', 'chain', 'hoc']),
  scope: z.string(), purpose: z.string(), risk: z.enum(['none', 'shadows-shipped-ui', 'wraps-owner-content']),
  region: regionSchema, recommended: z.boolean(), occupants: z.array(z.string()).nullable() })
/** Versioned, presentation-only snapshot; it grants no registration or installation permission. */
export const mapSchema = z.object({ version: z.literal(1), region: regionSchema,
  slots: z.array(slotSchema), factories: z.number().int().nonnegative(), omitted: z.number().int().nonnegative(),
  theme: z.array(z.string()), config: z.array(z.object({ name: z.string(), status: z.string(), fields: z.array(z.string()) })),
  issues: z.array(z.object({ source: z.string(), message: z.string() })) })
/** A bounded inventory recorded with its originating tool result. */
export type ExtensionMap = z.infer<typeof mapSchema>
/** Declared slot with optional observations from an exact-root inspection. */
export type ExtensionSlot = ExtensionMap['slots'][number]

/** Human placement alternatives group every required entry and body slot into one layout. */
export const placementSchema = z.object({ outcome: z.string(), usage: z.string(),
  recommended: z.string().optional(), options: z.array(z.object({
    region: regionSchema.exclude(['overview']), label: z.string(),
    description: z.string(), slots: z.array(z.string()), option: z.string(),
  })).min(1) })
/** Data owned by the placement question renderer. */
export type PlacementReview = z.infer<typeof placementSchema>
/** Recorded placement outcome; cancelling grants no implementation permission. */
export const placementChoiceSchema = z.object({ status: z.enum(['chosen', 'cancelled', 'preview']),
  region: regionSchema.optional(), label: z.string().optional(), slots: z.array(z.string()).optional() })
/** Parsed human placement outcome. */
export type PlacementChoice = z.infer<typeof placementChoiceSchema>

/**
 * Group entry and body declarations into meaningful layout alternatives.
 * @param map - Actual runtime declarations.
 * @returns Layouts whose required declaration identifiers are present.
 */
export function placementLayouts(map: ExtensionMap): { region: PlacementReview['options'][number]['region']; slots: string[] }[] {
  const layouts: { region: PlacementReview['options'][number]['region']; slots: string[] }[] = [
    { region: 'right-sidebar', slots: ['sidebar.right.pane.tab', 'conversation.session.header.utilities'] },
    { region: 'conversation', slots: ['conversation.chat.node'] },
    { region: 'page', slots: ['main', 'sidebar.panellist'] },
    { region: 'composer', slots: ['conversation.composer.dock'] },
    { region: 'header', slots: ['conversation.session.header.utilities'] },
    { region: 'left-sidebar', slots: ['sidebar.footer.action'] },
    { region: 'settings', slots: ['settings.section'] },
    { region: 'plugins', slots: ['plugins.tab'] },
  ]
  const names = new Set(map.slots.filter(slot => (slot.kind === 'list' && slot.risk === 'none') || (slot.kind === 'keyed' && slot.risk !== 'wraps-owner-content')).map(slot => slot.name))
  return layouts.filter(layout => layout.slots.every(name => names.has(name)))
}

const nodeSchema = z.object({ type: z.enum(['slot', 'factory']), name: z.string(), kind: slotSchema.shape.kind.optional(),
  scope: z.string().optional(), purpose: z.string().optional(), replaceRisk: slotSchema.shape.risk.optional(),
  children: z.array(z.unknown()).optional() })
const treeSchema = z.object({ trees: z.array(z.unknown()) })

/**
 * Group declarations by their application region.
 * @param name - Runtime slot identifier.
 * @returns Its spatial group; unknown declarations remain in the page group.
 */
export function regionOf(name: string): ExtensionRegion {
  if (name.startsWith('sidebar.right.') || name.startsWith('rightbar')) return 'right-sidebar'
  if (name.startsWith('sidebar')) return 'left-sidebar'
  if (name.startsWith('settings.')) return 'settings'
  if (name.startsWith('plugins.')) return 'plugins'
  if (name.startsWith('conversation.header') || name.startsWith('conversation.session.header')) return 'header'
  if (name.startsWith('conversation.input') || name.startsWith('conversation.composer')) return 'composer'
  if (name.startsWith('conversation.') || name.startsWith('tool.')) return 'conversation'
  return 'page'
}

/**
 * Validate an inspect response and retain declarations, excluding reusable factories from the slot count.
 * @param value - JSON returned by Slots.listSubTree.
 * @param region - Requested placement region.
 * @param limit - Profile bound on retained slot declarations.
 * @returns A serializable inventory with unobserved occupants explicitly unknown.
 */
export function inventoryFrom(value: unknown, region: ExtensionRegion, limit: number): ExtensionMap {
  const tree = treeSchema.parse(value)
  const slots: ExtensionSlot[] = []
  let factories = 0
  let omitted = 0
  const names = new Set<string>()
  const visit = (raw: unknown): void => {
    const node = nodeSchema.parse(raw)
    if (names.has(node.name)) throw new Error(`Repeated runtime declaration: ${node.name}`)
    names.add(node.name)
    if (node.type === 'factory') factories++
    else {
      if (node.kind === undefined || node.scope === undefined || node.replaceRisk === undefined || node.purpose === undefined) {
        throw new Error(`Incomplete runtime slot: ${node.name}`)
      }
      if (slots.length === limit) omitted++
      else slots.push({ name: node.name, kind: node.kind, scope: node.scope, purpose: node.purpose,
        risk: node.replaceRisk, region: regionOf(node.name), recommended: false, occupants: null })
    }
    for (const child of node.children ?? []) visit(child)
  }
  for (const root of tree.trees) visit(root)
  return { version: 1, region, slots, factories, omitted, theme: [], config: [], issues: [] }
}

/** Common entry/body combinations; absent declarations never become recommendations. */
const preferred: Partial<Record<ExtensionRegion, readonly string[]>> = {
  'right-sidebar': ['sidebar.right.pane.tab', 'conversation.session.header.utilities'],
  header: ['conversation.session.header.utilities', 'conversation.session.header.actions'],
  composer: ['conversation.input.left', 'conversation.input.dock', 'conversation.composer.dock'],
  conversation: ['conversation.chat.node', 'tool.call.toolview'],
  'left-sidebar': ['sidebar.panellist', 'sidebar.footer.action'],
  settings: ['settings.section', 'settings.general.item'], plugins: ['plugins.tab', 'plugins.add.actions'],
}

/**
 * Suggest additive declarations without inventing missing positions.
 * @param map - Validated inventory.
 * @param limit - Maximum recommendations.
 * @returns The snapshot with conservative placement suggestions.
 */
export function recommend(map: ExtensionMap, limit: number): ExtensionMap {
  if (map.region === 'overview') return map
  const candidates = map.slots.filter(slot => slot.risk === 'none' && (slot.kind === 'list' || slot.kind === 'keyed'))
  const preferredNames = preferred[map.region] ?? []
  const ranked = candidates.filter(slot => preferredNames.includes(slot.name))
    .sort((a, b) => preferredNames.indexOf(a.name) - preferredNames.indexOf(b.name)).slice(0, limit)
  const names = new Set(ranked.map(slot => slot.name))
  return { ...map, slots: [...ranked.map(slot => ({ ...slot, recommended: true })),
    ...map.slots.filter(slot => !names.has(slot.name)).map(slot => ({ ...slot, recommended: false }))] }
}
