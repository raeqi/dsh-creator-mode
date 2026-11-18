---
description: "Read-only maps of runtime UI extension declarations, placement suggestions and theme/config capabilities."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-extension-map

English | [中文](README.zh.md)

## Summary

Explore actual runtime UI extension positions before developing a visible feature. The independent plugin reads the same registry as `cordis_inspect_list` and `cordis_inspect_query`; it does not search plugin markets, install plugins or ask for approval.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

Mount beside the Cordis inspection registry and its Host/Client providers. `ui_extension_map` displays an overview or suggestions for a requested `region`. `ctx.extensionMap.inspect(region, execution)` lets a tool owner reuse inspection. It discovers provider methods before querying Client `Slots.listSubTree`, Client `Theme.listTokens`, and Host `Config.listConfigs` for theme, layout and right-sidebar owners. Configuration inspection reads schema field names and status, never saved values. Exact-root queries observe named occupants for suggested positions.

Creator preparation calls the service for visible UI additions, with Search first either on or off. Tool-only capabilities, modes and service connections omit placement inspection. A sidebar suggestion includes the panel body and opening entry when both are declared. Suggestions only use declared list/keyed positions without replacement risk; a keyed renderer also requires owner data and a navigation entry. Other positions remain browsable with explicit replacement or wrapping warnings.

The Client shows a compact spatial map, short suggestions and expandable technical details. Clicking a region browses its inventory. Bring this location into chat adds an exact slot identifier as a quote to the originating Session draft, preserving existing text and attachments; it never sends the message. The user can describe a different location in ordinary conversation without opening a mandatory questionnaire. The inventory list has its own bounded scroll area.

Other tool owners register native producers through `ctx.uiExtensionMap.registerProducer(name)` and dispose the returned registration with their context. Successful results carry versioned `extensionMap` presentation metadata; model content contains only suggestions, counts and source failures. Creator registers `creator_prepare`; the plugin registers `ui_extension_map`. Replay reconstructs snapshots from matching calls and metadata without querying runtime providers or repeating actions.

`slotLimit` bounds retained declarations (default 512); omissions are reported. `recommendationLimit` bounds suggestions and exact-root queries (default 3). Missing providers, malformed responses and query failures remain visible independently of successful sources. Unloading aborts in-flight reads.

## Dev Note

The Host service owns bounded reads and cancellation. The Client owns spatial browsing and draft feedback. Registrations and dictionaries dispose with their Cordis contexts; recoverable facts use existing tool metadata without a new Session event.

## Model Experience

### Placement discovery

#### What the model sees

The read-only `ui_extension_map` schema explains when to inspect interface positions. Results contain requested-region suggestions, declared-slot counts, theme token names, public configuration field names and source failures. Caller-owned Creator guidance describes the integration. The complete inventory stays in logged presentation metadata and the interactive card.

#### Token effect

One tool schema is added where visible. Results include a bounded set of recommendations rather than the entire slot tree; technical props remain available through exact inspection queries.

#### KV Cache effect

The tool schema is stable while configuration is unchanged. Inspection results append to the transcript. Browsing the canvas changes no model input; sending a location quote adds an ordinary user message.

## Known Limitations and Deferred Work

- Declarations and registered occupants do not establish current visibility, compatibility or a complete working integration. Exact props and owner APIs need inspection before implementation. Config status `absent` means no native schema, not a disabled plugin.
- Client queries use the first valid response from connected pages. The card is a recorded snapshot, not a continuously refreshed window overlay; unknown/new slot names retain their technical identifier. Regions group declarations by their owning name prefixes; custom locations may appear under Window and pages. The schematic does not report pixel coordinates.
- Regions describe application-document positions. A missing slot does not establish that a capability is impossible, and operating-system windows require separate investigation. Factories are counted separately from mountable slots.
- Source failures do not grant implementation permission or certify unsupported positions. The calling workflow owns recovery and verification; this plugin performs no registration, installation or market decision.
