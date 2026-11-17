---
description: "Structured human decisions with candidate cards and recorded outcomes."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-decision-review

English | [中文](README.zh.md)

## Summary

Present human decisions as candidate cards with contextual actions, short comparison facts and expandable metadata. The Host adapter reuses user questions; the browser plugin takes over only single-question `decision-review` requests. Generic questions retain their existing presentation.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Mount this plugin beside `dsh-user-questions` and `dsh-client-ui-user-questions`. Call `ctx.decisionReviews.ask()` with a caller question id, the Agent and cancellation signal, structured cards, alternatives, and readable fallback detail. Each action separates the localized button label from the option value returned to the caller. Option values and card titles must be distinct. Clients without the dedicated renderer display the generic fallback.

Cards keep coverage and gaps beside their actions. Version and source metadata are expandable. Requirements persist per Session while the panel is hidden. Submission freezes actions until settlement; failure retains the draft and permits retry. Cancel and scope teardown use the existing question lifecycle. Selecting a direction grants no installation permission.

A caller may include a `decisionReview` object containing `title`, `choice`, `summary`, and `custom` strings in a successful logged tool result. The Client pairs records only with an explicitly registered native tool call; arbitrary tool output cannot create a decision card. Creator choice is registered by default. Other Client integrations can register `createDecisionRecordDefinition(toolName)` from this package’s `/client` export and declare that module in `dsh.client.external`. Replay performs no request and invokes no action.

## Dev Note

The Host owns action validation through user questions. The Client owns only presentation and draft text. Service registrations, locale dictionaries and composer entries dispose with their plugin contexts.

## Model Experience

Indirectly, through Creator preparation and choice tools, whose structured comparisons this plugin presents without adding another model-facing tool.

#### KV Cache effect

The caller owns model-visible tool schemas and logged results; rendering and draft edits add no model input.

## Known Limitations and Deferred Work

- The presentation handles one blocking single-select decision at a time; timed waits are rejected. It does not verify third-party claims, install candidates, implement plans, or replace permission approval. Other clients need their own renderer or use the ordinary question fallback. Blocking requests remain subject to the question service’s interruption behavior.

The panel uses at most 48vh / 440px on desktop and 55vh / 480px on narrow screens. Candidate cards share a row when space allows; requirements are collapsed until requested.
