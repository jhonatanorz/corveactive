# CORVE — Catálogo & Inventario (v1) — Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pending implementation plan

---

## 1. Overview

A single web app for the CORVE activewear brand with two purposes:

1. **An appealing, shareable catalog** customers open via a link (no install, no account) to browse and place orders.
2. **An admin area** for the owner to manage inventory, purchasing, orders, and sales.

Ordering is **in-app cart with manual payment**: customers build a cart and submit an order; the owner sees it in admin and arranges payment/shipping offline. There is no online payment gateway in v1.

The brand context is fixed: Spanish UI (tú, never usted), MXN prices, CORVE voice (real bodies, permiso not pressure), and only the **active lines MOVE (women) and HIM (men)** appear in the catalog. Future lines (FLOW, CONFY, BOND, ESSENTIALS) are out of scope but the data model leaves room to add lines without rework.

### Success criteria
- A customer can open the link, browse by line, add variants to a cart, and submit an order in a few taps on a phone.
- The owner can manage products with size/color variants, register and receive purchase orders to restock, process orders, and see sales (revenue, units, profit).
- Stock per variant stays accurate: orders decrement it, PO receipts increase it, and every change is logged.

---

## 2. Users & surfaces

| Surface | Route | Auth | Audience |
|---|---|---|---|
| Public catalog | `/` | none | Customers (shared link) |
| Admin | `/admin` | login required | Owner (and future staff) |

---

## 3. Architecture & stack

**Option chosen: Next.js + Supabase + Vercel.**

- **Next.js** — single app rendering both the public catalog and the admin area.
- **Supabase** — Postgres database, file storage for product images, and email/password auth for the admin.
- **Vercel** — hosting on a shareable URL; custom domain later (e.g. `catalogo.corve.mx`).

One codebase, real database with reliable per-variant stock, proper image hosting, generous free tiers, and room to grow.

---

## 4. Data model

Core tables (Postgres / Supabase):

### products
- `id`, `name` (e.g. *Legging Aurora*)
- `line` (enum: `MOVE`, `HIM`; extensible)
- `type` (e.g. legging, top, playera)
- `description` (CORVE-voice copy)
- `price` (MXN)
- `cost` (MXN — latest unit cost; drives margin/profit)
- `status` (enum: `draft`, `active`, `hidden`)
- timestamps

### product_images
- `id`, `product_id`, `url` (Supabase Storage), `sort_order`

### variants
- `id`, `product_id`
- `color` (name + swatch hex)
- `size` (XS, S, M, L, XL — configurable set)
- `stock` (int, current on-hand)
- optional `sku`
- unique constraint on (`product_id`, `color`, `size`)

### orders
- `id`, `customer_name`, `customer_whatsapp`, `delivery_note` (optional)
- `status` (enum: `nuevo`, `confirmado`, `pagado`, `enviado`, `entregado`, `cancelado`)
- `total` (MXN snapshot)
- timestamps

### order_items
- `id`, `order_id`, `variant_id`
- snapshot fields: `product_name`, `color`, `size`, `unit_price`, `qty`
- (snapshot keeps historical orders accurate even if the product later changes)

### suppliers
- `id`, `name`, `contact` (optional)

### purchase_orders (PO)
- `id`, `supplier_id`, `status` (enum: `borrador`, `pedida`, `parcial`, `recibida`, `cancelada`)
- `expected_at` (optional), `notes`
- `total_cost` (MXN snapshot)
- timestamps

### purchase_order_items
- `id`, `po_id`, `variant_id`
- `qty_ordered`, `qty_received`, `unit_cost`

### stock_movements
- `id`, `variant_id`, `delta` (signed int)
- `type` (enum: `reabasto`, `pedido`, `correccion`)
- `reference` (e.g. `OC-11`, `#104`), `reason` (free text for corrections)
- timestamp
- (the audit log behind both inventory history and restocks)

---

## 5. Customer catalog (immersive — "direction C")

Mobile-first, immersive lookbook feel: warm tones, full-bleed line covers, CORVE voice.

### Screens & flow
1. **Entry / line cover** — brand intro, then each active line as a full-bleed cover: image + line name + message (*Confianza en cada movimiento*) + scroll cue.
2. **Line products** — scroll flows from the cover into a 2-column product grid for that line (image, name, price).
3. **Product detail** — photos, CORVE-voice description, **color swatches**, **size selector** (sold-out variants disabled/struck through), quantity, **Agregar**.
4. **Cart** — always reachable (pill); edit quantities, see subtotal in MXN.
5. **Checkout** — name + WhatsApp + optional delivery note → **Enviar pedido**. No login.
6. **Confirmation** — order summary + optional **"Continuar por WhatsApp"** button that opens a chat with the store, items pre-filled.

Only `active` products appear; `draft` and `hidden` never show publicly. Variants with 0 stock show as unavailable.

---

## 6. Admin

Behind login. Warm CORVE feel but optimized for speed. Sidebar nav: **Pedidos · Productos · Inventario · Compras · Ventas**.

### 6.1 Pedidos (orders)
- List of incoming orders, newest first; new orders highlighted with a count badge.
- Order detail: items, customer + tappable WhatsApp, and status transitions (`nuevo → confirmado → pagado → enviado → entregado`, or `cancelado`).

### 6.2 Productos
- List + create/edit: name, line, type, description, **price + cost → live margin (amount + %)**, status (draft/active/hidden), images.
- **Variant grid** (color × size) with editable stock per cell; low cells visually flagged (coloring only — no alert system in v1).
- Manual stock correction available (logged as `correccion`). Real restocks come from POs.

### 6.3 Inventario
- Stock per variant across all products.
- **Movement history** (the `stock_movements` log): reabastos, pedidos, correcciones, with signed deltas and references.

### 6.4 Compras (purchase orders)
- PO list with status (borrador → pedida → parcial → recibida).
- PO editor: pick supplier, add line items (variant, qty ordered, unit cost); total computed.
- **Receiving**: enter qty received per line (full or partial). On confirm:
  - `variant.stock += qty_received` for each line,
  - a `stock_movements` row of type `reabasto` (reference = PO id) per line,
  - `product.cost` updated to the received `unit_cost` ("last cost wins"),
  - PO status set to `parcial` or `recibida` based on remaining quantities.
- Suppliers: lightweight list (name + contact), reused across POs.

### 6.5 Ventas (sales / reports)
- A **sale** = an order that reached status `pagado`.
- KPIs: **ingresos** (revenue), **unidades** (units), **ganancia** (profit = sum of `(unit_price − cost) × qty`).
- Filters: date range and line (MOVE / HIM).

---

## 7. Key business logic

- **Stock decrement on order**: when an order is submitted, each variant's stock decreases and a `pedido` movement is logged. Checkout re-checks stock to prevent overselling the last unit; if a variant went out of stock mid-session, the customer is told before submitting.
- **PO receiving** is the source of restocks (see 6.4) and the source of cost updates.
- **Margin & profit** derive from `product.cost` vs `price` / `unit_price`. Sales profit uses the cost at time of reporting (current product cost) — acceptable for v1; can snapshot cost per order_item later if needed.
- **Sale definition**: revenue/units/profit count orders at `pagado` or beyond, not `nuevo`/`cancelado`.

---

## 8. Cross-cutting concerns

- **Auth** — Supabase email/password protects `/admin`; catalog is public. Structured to allow staff accounts later.
- **Language & money** — Spanish UI, MXN formatting, all product/marketing copy follows CORVE voice rules.
- **Images** — Supabase Storage, served optimized (Next/Image) so immersive covers load fast on phones.
- **Error handling** — checkout stock re-check; friendly form validation; thoughtful empty states (empty cart, line with no products, no orders yet).
- **Testing (TDD)** — unit tests for cart totals, margin/profit math, stock-decrement and PO-receive logic; integration tests that placing an order decrements stock + logs a movement, that receiving a PO increases stock + updates cost + logs movements, and that marking *pagado* records a sale; one end-to-end test for the checkout happy path.
- **Deployment** — Vercel + Supabase with environment variables; optional custom domain.

---

## 9. Out of scope (v1, YAGNI)

Easy to add later, intentionally excluded now:
- Customer accounts / login.
- Online payment gateway.
- Discount codes / promotions.
- Low-stock **alerts/notifications** (low-stock coloring is included; push/email alerts are not).
- Multi-language / multi-currency.
- Product reviews.
- Weighted-average costing (v1 uses last-cost-wins).
- Future lines FLOW / CONFY / BOND / ESSENTIALS as live product.

---

## 10. Future / open questions

- Notification when a new order arrives (email/WhatsApp ping) — deferred; orders appear in admin list for v1.
- Per-order-item cost snapshot for historically exact profit (v1 uses current cost).
- Multi-staff roles/permissions.
- Custom domain setup timing.
