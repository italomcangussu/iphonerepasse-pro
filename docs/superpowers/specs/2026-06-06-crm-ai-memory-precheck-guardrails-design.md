# CRM AI Memory Precheck Guardrails Design

## Context

The n8n workflow `ia repasse-pro` drives the Repasse Pro AI attendance flow. The current route is:

1. Webhook input and message/media normalization.
2. Redis buffer and lock.
3. CRM lead/context load.
4. Router Agent.
5. Memory 1 Extractor and Memory 2 Reconciler.
6. `Parse Memory`.
7. Routing through `Switch3`, `Should Precheck Inventory`, `CRM Inventory Precheck`, Bia 1, inventory search, Bia 2, and WhatsApp send.

Two recent failures exposed the same contract problem:

- The Memory agents described the customer intent correctly in `summary_short` and `summary_operational`, but left operational fields such as `desired_model`, `desired_capacity`, `interest_type`, and `shouldPrecheckInventory` empty or false.
- Because routing relies on structured fields and booleans, the flow skipped `CRM Inventory Precheck` and let Bia 1 answer without stock context.

Example failure:

- Last AI message: `Faltou só me dizer: é o 17, o Pro ou o Pro Max?`
- Customer response: `17 pro`
- Memory summary: customer confirmed interest in iPhone 17 Pro.
- Structured output: `shouldPrecheckInventory = false`.

Second failure:

- Last AI message asked for iPhone 17 Pro storage.
- Customer asked about availability for storage greater than 256GB.
- Memory summary mentioned iPhone 17 Pro and the storage preference.
- Structured output still had `desired_model = null`, `desired_capacity = null`, and `shouldPrecheckInventory = false`.

The system must stop depending only on LLM-generated booleans when the text already contains enough evidence to route safely.

## Goals

- Interpret short customer answers using the last Bia question as context.
- Convert recognized answers into structured memory fields, not only narrative summaries.
- Prioritize reliable capture of stock-critical fields:
  - `desired_model`
  - `desired_capacity`
  - `desired_color`
  - `preferred_city`
- Cover all fields that Bia can ask the customer for, including trade-in, registration, payment, and reservation fields.
- Force `CRM Inventory Precheck` before Bia 1 when a purchasable iPhone model is recognized and the customer is not clearly selling/trading/repairing.
- Prevent Bia 1 from claiming or implying stock availability without `pre_inventory` or `last_inventory_context`.
- Prevent Bia 1 from listing fixed storage options unless those options came from stock context.

## Non-Goals

- Rebuilding the full n8n workflow topology.
- Replacing the Memory agents.
- Changing CRM database schema.
- Changing final inventory search or simulator semantics.
- Creating a new product catalog service.

## Recommended Architecture

Add a deterministic post-Memory guardrail in the n8n workflow after `Code Parse Memory 2` and before `Edit Fields5`.

The guardrail can live either inside the existing `Parse Memory` code node or as a dedicated code node named similarly to `Normalize Memory Guardrails`. A dedicated node is preferable if it keeps the existing parse code readable.

The guardrail receives the current Memory payload plus accessible upstream context, including:

- `message_buffered`
- latest customer message
- `last_message_content`
- `summary_short`
- `summary_operational`
- previous lead state/memory when present
- router intent when present

It returns the same payload shape, with corrected fields and routing booleans.

## Contextual Extraction Contract

Memory extraction must interpret the customer response in light of the last Bia question.

If `last_message_content` asked for a specific field, short customer answers should fill that field rather than remain ambiguous.

Examples:

- If Bia asked for the model and the customer says `17 pro`, set `desired_model = "iPhone 17 Pro"`.
- If Bia asked for storage and the customer says `512`, set `desired_capacity = "512GB"`.
- If Bia asked for storage and the customer says `maior que 256`, set a storage constraint that the inventory/precheck layer can use. If no dedicated constraint field exists, preserve the meaning in `summary_operational` and route to inventory precheck.
- If Bia asked for color and the customer says `preto`, set `desired_color = "preto"`.
- If Bia asked for city and the customer says `fortaleza`, set `preferred_city = "Fortaleza"`.
- If Bia asked about trade-in device details, fill `tradein_*` fields and do not confuse them with desired purchase fields.
- If Bia asked registration details, fill `cadastro_*` fields.
- If Bia asked payment or simulation details, fill fields such as `cash_entry_amount`, `card_brand`, `cash_entry_intent`, and `proposal_accepted`.
- If Bia asked pickup or reservation details, fill `pickup_datetime`, `pickup_city`, and `reservation_intent` when appropriate.

The guardrail must preserve existing non-null Memory values unless the new customer message clearly corrects them.

## iPhone Model Normalization

The guardrail should normalize common customer shorthand into canonical iPhone model names.

Examples:

- `17` -> `iPhone 17`, only when the last Bia question makes clear that the customer is choosing among iPhone 17 variants.
- `17 pro` -> `iPhone 17 Pro`
- `iphone 17 pro` -> `iPhone 17 Pro`
- `17 pro max` -> `iPhone 17 Pro Max`
- `pro max` -> the matching Pro Max variant only when the last Bia question already established the iPhone family/version.

The normalizer should avoid over-inference when the customer message is ambiguous and no last-question context exists.

## Inventory Precheck Routing Contract

If the final normalized memory has a recognized `desired_model` for an iPhone and the current customer intent is not clearly trade-in, customer sale, repair, support, payment proof, spam, or human handoff, then the flow must route through precheck before Bia 1:

- `desired_device_type = "iphone"`
- `intent = "aparelho_iphone"` when no stronger intent exists
- `interest_type = "purchase"` when no explicit sale/trade-in signal exists
- `shouldPrecheckInventory = true`
- `shouldUseBia1 = true`
- `routing_decision = "precheck_inventory_before_bia1"`

This contract applies even if the LLM originally returned `shouldPrecheckInventory = false`.

If the customer asks about direct availability, such as `tem 17 pro 512?`, the flow must consult inventory before any availability answer.

## Bia 1 Response Contract

Bia 1 must never claim, imply, or list stock availability without stock context.

Allowed only with `pre_inventory` or `last_inventory_context`:

- available models
- available capacities
- available colors
- available conditions
- price
- city/store availability
- confirmation that an item exists

When no stock context exists, Bia 1 may ask a neutral question:

`Qual armazenamento voce procura para o iPhone 17 Pro?`

When precheck returns capacities, Bia 1 may mention only returned capacities:

`Encontrei opcoes em 256GB e 512GB. Qual delas voce prefere?`

Bia 1 must not ask:

`Qual armazenamento do 17 Pro - 128, 256 ou 512GB?`

unless those exact capacities came from stock context.

## Field Coverage

The guardrail should cover all fields that Bia can ask for, with stock-critical fields receiving the strongest deterministic handling.

Stock-critical fields:

- `desired_model`
- `desired_capacity`
- `desired_color`
- `preferred_city`

Trade-in fields:

- `tradein_model`
- `tradein_capacity`
- `tradein_color`
- `tradein_model_accepted`
- `tradein_scratches`
- `tradein_liquid_contact`
- `tradein_side_marks`
- `tradein_parts_swapped`
- `tradein_has_box_cable`
- `tradein_apple_warranty`
- `tradein_warranty_until`
- `tradein_battery_pct`
- `tradein_battery_suspect`
- `tradein_disqualified`
- `has_tradein`

Payment and simulation fields:

- `cash_entry_amount`
- `cash_entry_intent`
- `card_brand`
- `simulation_done`
- `proposal_accepted`

Registration and reservation fields:

- `cadastro_solicitado`
- `cadastro_completo`
- `cadastro_nome_completo`
- `cadastro_data_nascimento`
- `cadastro_cpf`
- `cadastro_contato`
- `reservation_intent`
- `pickup_datetime`
- `pickup_city`

The implementation may prioritize the stock-critical group first, but the spec requires the contract to be extensible to every Bia-asked field.

## Error Handling

- If parsing fails, preserve the original Memory payload and avoid introducing false confirmations.
- If the model is ambiguous, do not invent the final model; ask a clarification through Bia 1.
- If the customer wording can mean trade-in or purchase, preserve the safer interpretation from the router or existing memory.
- If `CRM Inventory Precheck` fails, Bia 1 must continue without claiming availability and should ask a neutral next question or transfer if operational policy requires.
- If `pre_inventory_found = false`, Bia 1 must not say the item exists; it may ask clarifying questions or route to no-stock handling depending on existing workflow rules.

## Testing Requirements

Use workflow-level sample payload tests or equivalent n8n code-node fixtures for the guardrail.

Required cases:

- Last Bia asks model; customer says `17 pro`; output has `desired_model = "iPhone 17 Pro"` and `shouldPrecheckInventory = true`.
- Last Bia asks model; customer says `pro max`; previous context is iPhone 17; output has `desired_model = "iPhone 17 Pro Max"`.
- Customer asks `tem 17 pro 512?`; output has `desired_model = "iPhone 17 Pro"`, `desired_capacity = "512GB"`, and routes to precheck or inventory before response.
- Customer asks `tem maior que 256 do 17 pro?`; output recognizes iPhone 17 Pro, preserves the capacity preference/constraint, and routes to inventory before response.
- Last Bia asks storage; customer says `512`; output fills `desired_capacity = "512GB"` while preserving existing `desired_model`.
- Last Bia asks color; customer says `preto`; output fills `desired_color`.
- Last Bia asks city; customer says `fortaleza`; output fills `preferred_city = "Fortaleza"`.
- Customer says `quero vender meu 17 pro`; output does not force purchase precheck and stays in sale/trade-in handling.
- Bia 1 receives no `pre_inventory`; generated response does not list fixed capacities or claim availability.
- Bia 1 receives `pre_inventory.available_capacities`; generated response may mention only those capacities.

## Acceptance Criteria

- Short responses to Bia questions become structured memory fields.
- Recognized purchase-side iPhone models always trigger precheck before Bia 1.
- Bia 1 no longer gives false availability when Memory misses structured fields.
- Bia 1 no longer lists storage options unless they came from stock context.
- The workflow remains compatible with existing CRM lead-state upsert and WhatsApp send nodes.
- No tokens or credentials are added to repo files.
