# n8n Repasse Trade-In State Minimal Fix Design

Date: 2026-06-13

## Context

Workflow `ia repasse-pro v2 avancada` (`Cr4fPWe0prwS6XjI`) incorrectly saved `lead_state` during execution `405671`.

The lead previously had:

```json
{
  "interest_type": "comprar",
  "desired_model": "iPhone 16 Pro Max",
  "has_tradein": false,
  "tradein_model": null
}
```

The current buffered messages were:

```text
Vou dar um iPhone 14 na troca
Ele ta muito novo
```

`Memory 1 - Extractor` correctly extracted:

```json
{
  "desired_model": "iPhone 16 Pro Max",
  "has_tradein": true,
  "tradein_model": "iPhone 14"
}
```

But the final `CRM Leads POST Lead_State` saved:

```json
{
  "desired_model": "iPhone 14",
  "has_tradein": false,
  "tradein_model": null
}
```

## Root Cause

Two minimal workflow issues combine into the bad write:

1. `Code Parse Memory 2` does not read the prior CRM `lead_state` from the actual API response shape. The state is under `data.items[0].lead_state`, but the code only checks top-level-style paths.
2. `Parse Memory` classifies a previous question containing "qual modelo" as `desired_model` even when that question is explicitly about the phone the customer will trade in.

Because the prior state is lost and the trade-in context is misclassified, the deterministic guardrail promotes `iPhone 14` to `desired_model` instead of `tradein_model`.

## Goal

Make the smallest safe workflow change so trade-in answers update `tradein_*` fields while preserving the desired purchase model.

For the execution `405671` scenario, the expected final state is:

```json
{
  "interest_type": "comprar",
  "desired_model": "iPhone 16 Pro Max",
  "has_tradein": true,
  "tradein_model": "iPhone 14"
}
```

## Non-Goals

- Do not redesign the memory pipeline.
- Do not add a new pre-POST validation node.
- Do not change CRM database schema or app code.
- Do not broaden prompt behavior beyond preserving explicit `memory_extraction` and prior `lead_state`.

## Design

### 1. Fix Prior State Reading

Update `Code Parse Memory 2` so `readLeadState()` checks these paths, in order:

1. `$json.lead_state`
2. `$json.lead.lead_state`
3. `CRM Leads GET`.last().json.lead_state
4. `CRM Leads GET`.last().json.data.lead_state
5. `CRM Leads GET`.last().json.data.items[0].lead_state

This keeps existing behavior and adds the missing real response shape.

### 2. Fix Trade-In Question Classification

Update `Parse Memory` inside `repasseDetectLastQuestionKind(lastMessageContent)`.

Before checking generic model terms, detect trade-in wording:

- `troca`
- `trocar`
- `entrada`
- `aparelho atual`
- `seu aparelho`
- `iphone que voce vai trocar`
- `modelo do iphone que voce vai trocar`

When those terms are present, return `tradein`.

This prevents "qual modelo do iPhone que voce vai trocar?" from being treated as a desired purchase model question.

### 3. Map Detected Model To Trade-In In Trade-In Context

In `Parse Memory`, when `repasseLastQuestionKind === "tradein"` and a model is detected from the current message:

- Set `memory.has_tradein = true`.
- Set `memory.tradein_model = repasseDetectedModel` if `tradein_model` is empty.
- Do not overwrite `memory.desired_model`.

Existing preservation should keep the desired model from the prior state once state reading is fixed.

## Verification

Use execution `405671` as the regression case:

1. Confirm prior CRM state is read as `desired_model: "iPhone 16 Pro Max"`.
2. Confirm current buffered text detects `iPhone 14`.
3. Confirm the previous assistant question is classified as `tradein`.
4. Confirm the constructed state would preserve `desired_model` and set `tradein_model`.

Before applying the workflow update, run a workflow diff. Apply through the n8n plugin so a local backup is created automatically.

## Rollback

If the change causes unexpected behavior, restore the local backup created by the n8n plugin before the full workflow update.
