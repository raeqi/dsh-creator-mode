---
description: "Choose Agent presets and the new-task default in Web, read what each mode does and what it declares. Authoring is guided to Creator mode."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-agent-preset

English | [中文](README.zh.md)

## Summary

Choose Agent presets and the new-task default in Web, read what each mode does and what it declares. Authoring is guided to Creator mode.

## Table of Contents

- [Use this package](#use-this-package)
- [Experimental Creator controls](#experimental-creator-controls)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Settings shows the built-in and custom card groups with default highlighting and card-body selection; a group without presets is omitted, except the custom group, which keeps its Creator entry on screen. Coarse-pointer devices show complete card descriptions; other devices clamp descriptions to four lines with the full text available on hover. Every card offers “View configuration”, which opens the preset's declared plugin list as read-only YAML in the Loader's own dialect (`!!js` conditions included); a failed preset stays readable because its diagnostic points into that YAML. Escape closes only the viewer and returns focus to its card; leaving Settings clears the viewer, and a late read does not reopen it. The page edits nothing: the Creator entry starts a Creator-mode task that authors or overrides a preset as a bundle, offered while the `cordis` preset is on the roster and a conversation flow exists.

With Coding Tools off in General Settings, the new-session picker and Settings roster offer Standard, Creator, and custom presets; turning them on also offers PTC and Minimal. Default selection and the Creator entry remain available in both states. Choosing a healthy default also synchronizes the blank session on the current new-task surface. Creator starts a new task using the `cordis` preset.

Turning Coding Tools off clears all unapplied choices through the existing Developer tools subscription. Once the off value is accepted, every authenticated browser resets a saved built-in PTC or Minimal default to Standard. Saved Standard, Creator, and custom defaults (including named PTC or Minimal overrides) stay unchanged. The user can select an available preset again after turning Coding Tools off. Existing sessions keep their selected mode; New Session uses the current default. An existing mode's label remains visible even when that mode is absent from the menu. Turning Coding Tools back on does not restore the old default or cleared choice. If Standard is missing or broken, the default remains unchanged and an error is shown.

Known shipped presets offer mode details and usage examples in a read-only dialog. Minimal's guide explains image reading, automatic history compaction, and the idle-session `/compact` command. Its tabs preserve each page's scroll position; closing returns focus to the opening action. Help does not change the new-task default. The default badge replaces the card's group badge, and the preset id appears beside the title. Guide copy and examples belong to this package.

**Let the agent create a plugin** in the Plugins page's **Add plugin** arrow menu enters the same Creator flow as Settings. It submits no message and preserves unsent drafts. While the roster loads or Creator is unavailable, the menu item is disabled with an explanation. Both entries show a Toast with the reason if the Host refuses the preset switch.

Entering Creator selects `cordis` for the receiving blank Session without changing the new-task default or Coding Tools setting. If no workspace or blank Session is bound yet, the choice waits for that binding. After the choice is applied, the Creator Session keeps its preset; a later newly created Session uses the configured default, such as Standard.

On Desktop, the optional [product analytics](../product-analytics/README.md) service receives `agent_preset_switch` when a direct mode-picker choice moves to a different built-in preset: an unbound choice counts once it is staged for the next Session, and a choice for the bound blank Session counts once the Host applies it. The event carries the source and target categories mapped from the preset id (`cordis` is `creator`; `ptc`, `minimal`, and `standard` keep their ids; any other id is `other`) and the Coding Tools setting known at the choice. Custom targets, refused choices, choices the Host settles on another preset, default changes and their blank-Session synchronization report nothing, and neither does a choice made while the source mode or Coding Tools setting is unknown. Custom preset ids and names are not collected.

<a id="experimental-creator-controls"></a>
## Experimental Creator controls

Creator mode uses the existing mode picker and conversation. Four starting points appear together below an untouched Creator session's composer. Selecting one inserts an editable example request with a concrete goal and verification requirements; it does not send a message. The examples cover a notes panel, Bilibili search, a code review mode, and GitHub issue access.

The default-on **Search first** switch sits in the composer's tool row; hover shows its explanation. It saves the profile owner's `ui-agent-preset.marketFirst` preference for authenticated clients of that profile and affects Creator requests assembled after a successful write. Refused writes keep the accepted value and show an error. Turning it off displays **Create directly** and skips market discovery and candidate questions; the design preview remains required.

Market search requires the optional [Custom plugin indexes bundle](../../experimental/plugin-market-bundle/README.md) and configured index sources. The switch does not enable the bundle or add sources. When market settings are unavailable or contain no sources, **Configure plugin search** opens Plugins; its help directs the user to Experimental plugins and then Discover. This checks saved configuration, not index reachability or successful search.

| Experience | Current implementation |
| --- | --- |
| Explain the result before implementation | Every new design shows its expected effect and example usage inline; UI changes also mark the proposed page, conversation, composer or right-sidebar region and impact; the model must verify the extension API |
| Search before creating, explain matches and gaps, then offer reuse, adaptation or creation | `creator_prepare` searches the configured sources; `creator_choose` presents the model’s comparison and asks for reuse, adaptation or creation; implementation tools stay blocked until an accepted decision |
| Handle unavailable search, missing sources, failed indexes or no matches | Recorded discovery status and source failures; without compatible candidates, explain the limitation and continue the prepared design without another question |
| Keep the entry lightweight | Existing conversation and mode picker, four simultaneous examples, no carousel or permanent architecture diagram |

`creator_prepare` requires `outcome` and `usage` for an inline design preview regardless of Search first. UI requests also supply `location` and `impact`; tool-only requests explain their conversation entry and output without a layout diagram. A new design initially exposes only the preparation tool; recorded preview success releases inspection tools, while implementation also waits for any required candidate decision. This preview does not ask for approval.

With discovery enabled, each preparation searches at most `discoverySourceLimit` sources (default 3), `discoveryQueryLimit` independent queries per source (default 3), `discoveryResultLimit` results per query (default 5), and offers `discoveryCandidateLimit` compatible candidates (default 3). `query` is the primary keyword; `alternatives` supplies synonyms. Results merge by package name and reciprocal result rank. A zero-result multiword query falls back to words within the same budget; source details retain attempted queries and failures. Optional `indexes` selects configured sources for a requested expansion.

The Host-only `creatorPreparation` projection retains the design and accepted decision across continuation turns and replay. A new `creator_prepare` replaces them; the model must prepare again for materially changed requirements. Retry, configuration and skipped decisions keep implementation blocked while discovery is enabled. Turning discovery off withdraws a waiting market choice and permits the prepared design to continue; a stale chooser cannot reopen it. No compatible candidates or unavailable discovery also permit implementation after the preview. Installation authorization is unchanged. Applied live plugins synchronize automatically; the model checks current capability/UI state rather than asking the user to refresh and report whether an entry appeared.

No session format or core-loop behavior is added by these controls.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`agentPresets/list` supplies the roster and marks the current default, and `agentPresets/read` one declaration's YAML for the viewer; default changes write the `agent-preset-registry` settings namespace. The picker, blank-session synchronization and read-only session label use recorded preset identities. Connection resets and settings updates refresh the roster.

`CreatePluginMenuItem` contributes to `plugins.add.actions` using the shared roster store. Its selection calls the owner's `onDismiss()` before the same `startCreatorDraft` callback exposed to Settings as `creatorDraft`. That callback stages `cordis` through `AgentPresetSeatController`, except when the main blank Session lists a different preset (navigation then opens another blank and leaves that one unchanged), and opens the task through `uiWorkspace.startSession` with explicit draft preservation and `agentPreset: 'cordis'`, so the Host composes the reused blank or new Session under Creator; without a target Workspace, the staged choice applies when a Session binding becomes available. The choice is consumed once applied. Both Coding Tools states use the same picker and selection store, and `AgentPresetSeat` renders refusals through the shared `Toast` component.

`AgentPresetSeatController.select()` and `apply()` return the attempt's outcome: `applied` when the Host commits the staged preset, `staged` while no Session is current, `unchanged` when busy, without a stage, for a started or already matching Session, or when the Host settles on another preset, and `refused` with the bare Host reason. The chip's injected `select` reports `agent_preset_switch` from that outcome and returns only the refusal reason.

</details>

<a id="further-exploration"></a>
## Further Exploration

- [Scope](../../core/scope/README.md) — Registration isolation.
- [Agent](../../core/agent/README.md) — Session runtime.
- [Cordis](../../../docs/cordis-primer.md) — Plugin configuration and lifecycle.

<a id="model-experience"></a>

Creator decisions use the dedicated [decision review plugin](../ui-decision-review/README.md): each candidate keeps its coverage, gaps and actions together, with metadata collapsed. `creator_choose.assessments` supplies candidate-specific facts; `comparison` is a one-sentence summary. Successful results retain a read-only decision record in the conversation. Other clients use the readable question fallback.

## Model Experience

### Creator preparation

#### What the model sees

The [`creator_prepare` and `creator_choose` tools](../../../docs/tool-catalog.md#deepseek-aidsh-client-ui-agent-preset) return recorded discovery status, source failures, compatible candidates and the user's selected path; installation remains unauthorized. [Creator policy](src/creator-policy.ts) instructs the model to explain coverage and gaps before the decision. Ordinary presets receive neither these tools nor Creator guidance.

#### Token effect

The initial request exposes one preview tool schema; the full roster follows a recorded preview. Discovery output stays bounded. The model's comparison remains a model request; no token-saving rate is guaranteed.

#### KV Cache effect

Changing the preference changes the next Creator system prompt and may invalidate its cached prefix; no token-saving rate is claimed.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Tool execution requires a design preview and, when discovery returns candidates, an accepted path; detecting materially changed requirements, query quality, candidate comparisons and API verification remain model work. No default market index is configured.
- Live-index discovery and the real-model candidate chooser have been verified with a notes request. Candidate installation and reuse have not been verified; a configuration hint alone does not establish successful discovery.
- Proposed regions are schematic, not live application highlighting. Pending choice dialogs use the existing blocking question flow; after interruption, retry preparation. External floating desktop pets, market categories, submission, private or public distribution, review and revenue sharing are outside this package.
- English and Chinese Creator copy is provided; other locales fall back to English for these controls.


- Web creates and edits no preset: the configuration viewer is read-only, and a bundle installed through Creator mode declares a new preset or overrides a shipped one by row id, replacing its complete child list.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
