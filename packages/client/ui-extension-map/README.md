---
description: "Pause for a verified UI layout choice, or browse runtime extension declarations read-only."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-extension-map

English | [中文](README.zh.md)

## Summary

Choose where a visible plugin feature will appear before implementation. Creator mode calls this independent plugin with market search either on or off. The model pauses until the user confirms a layout directly in the canvas.

## Table of Contents

- [Use this package](#use-this-package)

- [Dev Note](#dev-note)

- [Model Experience](#model-experience)

- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## Use this package

Mount beside the Cordis inspection registry and its Host/Client providers. `ctx.extensionMap.inspect(region, execution)` discovers providers and reads Client `Slots.listSubTree`, Client `Theme.listTokens`, and Host `Config.listConfigs` for theme, layout and right-sidebar owners. Config inspection reads schema fields and status, never saved values. `slotLimit` bounds declarations (default 512); `recommendationLimit` bounds suggestions and exact-root reads (default 3).

`ctx.extensionMap.review(map, design, execution)` requires user questions and awaits one blocking layout decision. A right panel includes both its body and opening entry; these are parts of one layout, not competing choices. Primary alternatives are a conversation card, separate page, or a small panel near the composer. Other locations fold header/sidebar actions, Settings and Plugins entries. Confirmation returns the selected region and all required slot identifiers. Deferral returns `cancelled` and grants no implementation permission. Unload or caller cancellation aborts the wait.

The placement panel shows a short outcome, spatial choices, a recommendation and a fixed confirmation footer. Usage is folded. It has no slot counts, CSS tokens or composer-quote step. Preselection never submits an answer. The panel is bounded to 55vh / 460px on desktop and 60vh on narrow screens; its body scrolls independently.

`ui_extension_map` is independent read-only exploration. Its inventory starts collapsed, offers no decision buttons and never pauses for a choice. Exact identifiers and risks appear only in per-location details. Theme/config data remain inspectable in tool metadata rather than the product-facing canvas.

Tool owners register native producers with `ctx.uiExtensionMap.registerProducer(name)` and dispose the returned registration with their context. Successful results carry versioned `extensionMap` metadata and may add `placementChoice`. Creator registers `creator_prepare`; this plugin registers `ui_extension_map`. While preparation is pending only its normal tool status appears in chat. A chosen layout produces a one-line outcome, not another map. Replay uses logged metadata without querying providers or invoking an action.

<a id="dev-note"></a>
## Dev Note

The Host owns bounded discovery and the awaited question. The question owner retains channel state, submission and cancellation; this plugin renders the keyed `conversation.question.presentation` entry. Registrations and dictionaries dispose with their Cordis contexts. Existing tool metadata records placement outcomes without a new Session event.

<a id="model-experience"></a>
## Model Experience

### Placement discovery

#### What the model sees

`ui_extension_map` returns bounded declarations and source failures. `creator_prepare` returns only the confirmed layout’s declarations; registered occupants are neighbors, not proof of a matching capability. Exact props and owner APIs remain available through Cordis inspection. The calling workflow owns implementation and permission decisions.

#### Token effect

One read-only tool schema is added. Full inventories remain in presentation metadata rather than the model transcript. Human choices return a compact layout instead of a tree.

#### KV Cache effect

Tool schemas stay stable while configuration is unchanged. Inspection results and accepted layout outcomes append to the transcript; local selection edits add no model input.

## Known Limitations and Deferred Work

- Declarations do not prove current visibility or working integration. Verify exact props, navigation and owner APIs before coding. `absent` Config status means no native schema, not a disabled plugin.

- Inspection uses the first valid response from connected pages. The schematic records declarations, not pixel coordinates. Partial failures stay in metadata; missing data never proves impossibility.

- Layout choices require every declared slot in their recipe. Keyed layouts require fresh unique keys; their replacement warning applies to occupied keys. Choices do not install, register UI or authorize replacing existing renderers. Ordinary question options remain the fallback when a dedicated Client renderer is unavailable.

- Regions describe the application document. Operating-system windows require separate capabilities. Blocking placement questions follow the existing question service’s interruption behavior.
