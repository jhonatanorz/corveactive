# CORVE — Lot-Based Inventory & Costing Model — Design Spec

**Date:** 2026-06-17
**Status:** Approved design, pending implementation plan
**Builds on:** the full app (schema `0001`–`0006`, the `place_order`/`cancel_order`/`receive_purchase_order` RPCs). Branch base: `ui-polish`.

---

## 1. Problem

1. **`products.cost` is the wrong place for cost.** It's a single "latest cost" overwritten on every PO receipt (last-cost-wins). Cost is a property of a *purchase*, not a product — it varies per purchase batch and over time, and a product with many variants can't have one cost.
2. **No real inventory layer.** Inventory today is `variants.stock` (an int) + a `stock_movements` log that references POs/orders only by **text strings** (`'OC-ab12'`, `'#104'`). Nothing links a unit bought to a unit sold; inventory can't be valued and true COGS can't be computed.

## 2. The model

**Principle:** cost lives on purchases (and manual adjustments); **inventory is the ledger that connects supply → demand**. Every inventory event is a `stock_movements` row; **inbound** movements create costed **lots**, **outbound** movements **consume** lots FIFO. This one rule covers receipts, sales, *and* manual adjustments uniformly.

### Schema changes (migration `0007`)

- **Drop** `products.cost`.
- **`stock_movements`** — upgraded from a text log to the canonical ledger. Add real FKs, drop reliance on text refs:
  - existing: `id`, `variant_id →variants`, `delta` (signed), `type` (enum), `reason`, `created_at`
  - **add**: `po_item_id →purchase_order_items` *(nullable)*, `order_item_id →order_items` *(nullable)*
  - keep `reference` (human label, optional) for display continuity.
- **`inventory_lots`** *(new)* — one row per **inbound** movement that adds costed stock:
  - `id` uuid PK · `variant_id →variants` · `source_movement_id →stock_movements` · `unit_cost` int¢ · `qty_received` int · `qty_remaining` int · `created_at` ts
- **`inventory_consumptions`** *(new)* — one row per (outbound movement × lot drawn). The literal supply↔demand link:
  - `id` uuid PK · `movement_id →stock_movements` · `lot_id →inventory_lots` · `qty` int · `unit_cost` int¢
- **Caches** (maintained by the RPCs, not source of truth):
  - `variants.stock` = `Σ qty_remaining` over the variant's lots.
  - `order_items.cost` = the sale line's COGS (`Σ consumptions.unit_cost × qty`), snapshotted at sale time.

### Derived values
- **On-hand** (variant) = `Σ qty_remaining`.
- **Inventory value** = `Σ (qty_remaining × unit_cost)` across lots.
- **Current cost** (variant) = weighted avg of remaining lots = `Σ(qty_remaining·unit_cost) / Σ(qty_remaining)` (null when no stock → fall back to the most recent lot's `unit_cost`).
- **COGS / Ganancia** (Ventas) = `order_items.cost` (unchanged source for the report).

## 3. Behaviour (RPCs)

| Event | Movement written | Lot effect |
|---|---|---|
| **PO received** (`receive_purchase_order`) | inbound `reabasto`, `po_item_id` set | **create lot** at the PO line's `unit_cost`; `stock += qty` |
| **Sale** (`place_order`) | outbound `pedido`, `order_item_id` set | **consume lots FIFO** (oldest `created_at`), write consumptions, set `order_items.cost` = COGS; `stock -= qty` |
| **Manual +** (found stock / opening) | inbound `correccion`, `reason` | **create lot** at `unit_cost` (entered, else variant current cost, else 0); `stock += delta` |
| **Manual −** (damage / shrinkage) | outbound `correccion`, `reason` | **consume lots FIFO**; `stock -= |delta|` (loss valued via consumptions, **excluded** from Ventas revenue/profit) |
| **Order cancelled** (`cancel_order`) | inbound `cancelacion` | **restore** the exact lots the order consumed (`qty_remaining += consumed`); `stock += qty` |

**New RPC `adjust_inventory(p_variant_id uuid, p_delta int, p_reason text, p_unit_cost int default null)`** — replaces the current "set stock to target" correction. Positive `p_delta` → inbound movement + new lot; negative → outbound movement + FIFO consumption. Atomic, `security definer`.

**FIFO rule:** consume from lots with `qty_remaining > 0` ordered by `created_at` (then `id`), oldest first; refuse if total `qty_remaining` < requested.

**Cancellation precision:** `cancel_order` reverses the specific consumptions of that order's sale movements (so the right lots are restocked at the right cost), not a blind `stock += qty`.

## 4. Code touchpoints

- **RPCs rewritten/added** (`0007` or new migration files): `receive_purchase_order` (create lot, stop touching product cost), `place_order` (FIFO consume + COGS), `cancel_order` (reverse consumptions), **new `adjust_inventory`**.
- **`db-types.ts`**: drop `ProductRow.cost`; add `InventoryLotRow`, `InventoryConsumptionRow`; extend `StockMovementRow` with `po_item_id`/`order_item_id`.
- **`domain/margin`**: margin becomes **per-variant** (price vs the variant's *current cost*), since cost is no longer a single product attribute. The admin product editor shows cost + margin per variant row; product-level shows price only (or a margin range).
- **Admin correction UI** (`products/[id]` variant rows): the correction form gains an optional **cost** field used when the adjustment is positive; calls `adjust_inventory` instead of the old target-set.
- **`repos`**: `correctVariant` → `adjustInventory`; add inventory-value / current-cost reads for the Inventario page (show value alongside stock).
- **`summarizeSales`**: unchanged (still reads `order_items.cost`).

## 5. Migration of existing data

- Add new tables + columns; drop `products.cost` **after** backfill.
- **Opening lots:** for each variant with `stock > 0`, create one `inventory_lots` row (`qty_received = qty_remaining = stock`, `unit_cost = the old products.cost`, `source_movement_id` = a synthetic `correccion` "saldo inicial" movement with `po_item_id` null). This preserves current on-hand and gives it a cost basis.
- Historical `stock_movements` rows keep their text `reference` (not retro-linked to FKs); only new movements populate `po_item_id`/`order_item_id`.

## 6. Decisions (confirmed)
1. Opening stock valued at the old `products.cost`.
2. Positive manual adjustment cost: optional input, default to the variant's current weighted cost (else 0).
3. `variants.stock` and `order_items.cost` stay as RPC-maintained caches.

## 7. Out of scope (YAGNI)
- Alternate costing methods (weighted-average, LIFO) — FIFO only.
- Multi-warehouse / locations.
- Per-lot expiry, serial numbers.
- Backfilling FK links onto historical movements.

## 8. Testing / verification
- **Unit:** FIFO consumption + current-cost helpers (pure where possible); margin per variant.
- **DB (direct):** receive two lots at different costs → sell across both → assert COGS spans both lots and `order_items.cost` is the weighted total; manual `−` adjustment consumes oldest lot; cancel restores exact lots; `adjust_inventory +` creates a lot.
- **Browser E2E:** Compras receive (lot created, no product cost), Ventas profit reflects FIFO COGS, admin manual adjustment (+ with cost, − shrinkage), Inventario shows on-hand + value.
- Gate: tests + tsc + build green.

Implementation branches from `ui-polish`. Order: schema migration → new RPCs → repos/types → admin UI + margin display → data migration → verification.
