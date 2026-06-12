# CORVE Foundation & Domain Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the CORVE web app project and build a fully unit-tested domain layer (money, margin, cart, stock, purchase-order receiving, sales) plus the database schema, so all later UI work builds on locked-down, tested logic.

**Architecture:** Next.js (App Router, TypeScript) app with a pure, framework-free `src/domain/` library that holds all business rules as deterministic functions — no database, no React — so they are trivially unit-testable with Vitest. The Supabase Postgres schema is defined as one SQL migration. Money is represented everywhere as **integer centavos** (¢) to avoid floating-point errors; it is only formatted to "$690.00 MXN" at the edge.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vitest, Supabase (Postgres + Storage + Auth), Vercel (deploy — later plan).

This plan is Phase 1 of 4 (Foundation → Admin → Catalog → Purchasing/Sales). It produces a tested domain library and schema, not yet a running UI.

---

## File Structure

Files created in this plan and their single responsibility:

- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs` — project config (from scaffold).
- `vitest.config.ts` — test runner config.
- `src/domain/money.ts` — MXN money type + formatting. Pure.
- `src/domain/margin.ts` — margin amount and percentage from price/cost. Pure.
- `src/domain/cart.ts` — cart line and subtotal math. Pure.
- `src/domain/stock.ts` — stock decrement (with oversell guard) and restore. Pure.
- `src/domain/purchase.ts` — PO receiving math (received qty, stock deltas, PO status). Pure.
- `src/domain/sales.ts` — aggregate paid orders into revenue/units/profit with filters. Pure.
- `src/domain/types.ts` — shared domain TypeScript types (Line, OrderStatus, etc.).
- `src/domain/*.test.ts` — co-located unit tests, one per module.
- `src/lib/supabase/client.ts` — browser Supabase client (used in later plans).
- `src/lib/supabase/server.ts` — server Supabase client (used in later plans).
- `supabase/migrations/0001_init.sql` — full database schema (all tables + enums).
- `.env.local.example` — documents required environment variables.

Domain modules never import from `src/lib/` or React — they are pure. Tests are co-located (`module.test.ts`) so logic and its test live together.

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: project root files via scaffold (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*`, etc.)

- [ ] **Step 1: Run the scaffold**

The repo already contains `docs/` and `.gitignore`. Scaffold Next.js into the current directory.

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
When prompted that the directory is not empty / to proceed, accept (it keeps existing `docs/` and `.gitignore`).

- [ ] **Step 2: Verify it builds and runs the dev server**

Run:
```bash
npm run build
```
Expected: build completes with "Compiled successfully" and no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (TS, Tailwind, App Router)"
```

---

## Task 2: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script + dev deps)
- Create: `src/domain/smoke.test.ts` (temporary sanity test, deleted in Step 5)

- [ ] **Step 1: Install test dependencies**

Run:
```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Add the test script**

In `package.json`, add to the `"scripts"` object:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test and run it**

Create `src/domain/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:
```bash
npm test
```
Expected: PASS, 1 test passed.

- [ ] **Step 5: Delete the smoke test and commit**

```bash
rm src/domain/smoke.test.ts
git add -A
git commit -m "chore: configure Vitest"
```

---

## Task 3: Money module (MXN, integer centavos)

**Files:**
- Create: `src/domain/money.ts`
- Test: `src/domain/money.test.ts`

Money is an integer number of centavos. `$690.00` is `69000`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatMXN, pesos } from "@/domain/money";

describe("pesos", () => {
  it("converts whole pesos to centavos", () => {
    expect(pesos(690)).toBe(69000);
  });
});

describe("formatMXN", () => {
  it("formats centavos as MXN currency", () => {
    expect(formatMXN(69000)).toBe("$690.00");
  });

  it("formats zero", () => {
    expect(formatMXN(0)).toBe("$0.00");
  });

  it("formats thousands with a separator", () => {
    expect(formatMXN(104000)).toBe("$1,040.00");
  });

  it("formats sub-peso centavos", () => {
    expect(formatMXN(69050)).toBe("$690.50");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- money`
Expected: FAIL — cannot find module `@/domain/money`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/money.ts`:
```ts
/** Money in this app is an integer number of centavos (1 peso = 100 centavos). */
export type Centavos = number;

/** Convert whole pesos to centavos. */
export function pesos(whole: number): Centavos {
  return Math.round(whole * 100);
}

const mxn = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format centavos as "$1,040.00" (no currency code; caller appends " MXN" if desired). */
export function formatMXN(centavos: Centavos): string {
  return "$" + mxn.format(centavos / 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- money`
Expected: PASS, all money tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat(domain): MXN money formatting in centavos"
```

---

## Task 4: Margin module

**Files:**
- Create: `src/domain/margin.ts`
- Test: `src/domain/margin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/margin.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calcMargin } from "@/domain/margin";

describe("calcMargin", () => {
  it("returns amount and rounded percentage", () => {
    // price $690.00, cost $250.00 -> margin $440.00, 63.768% -> 64
    expect(calcMargin(69000, 25000)).toEqual({ amount: 44000, pct: 64 });
  });

  it("is 100% when cost is zero", () => {
    expect(calcMargin(50000, 0)).toEqual({ amount: 50000, pct: 100 });
  });

  it("returns 0% margin when price equals cost", () => {
    expect(calcMargin(30000, 30000)).toEqual({ amount: 0, pct: 0 });
  });

  it("handles cost above price (negative margin)", () => {
    expect(calcMargin(20000, 25000)).toEqual({ amount: -5000, pct: -25 });
  });

  it("returns 0 for both when price is zero", () => {
    expect(calcMargin(0, 0)).toEqual({ amount: 0, pct: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- margin`
Expected: FAIL — cannot find module `@/domain/margin`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/margin.ts`:
```ts
import type { Centavos } from "@/domain/money";

export interface Margin {
  amount: Centavos; // price - cost
  pct: number; // rounded integer percentage of price
}

/** Margin of a sale price over its cost. Percentage is rounded to the nearest integer. */
export function calcMargin(price: Centavos, cost: Centavos): Margin {
  const amount = price - cost;
  const pct = price === 0 ? 0 : Math.round((amount / price) * 100);
  return { amount, pct };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- margin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/margin.ts src/domain/margin.test.ts
git commit -m "feat(domain): price/cost margin calculation"
```

---

## Task 5: Cart totals

**Files:**
- Create: `src/domain/cart.ts`
- Test: `src/domain/cart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/cart.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cartSubtotal, cartCount, type CartLine } from "@/domain/cart";

const lines: CartLine[] = [
  { variantId: "v1", unitPrice: 69000, qty: 1 },
  { variantId: "v2", unitPrice: 35000, qty: 2 },
];

describe("cartSubtotal", () => {
  it("sums unitPrice * qty across lines", () => {
    expect(cartSubtotal(lines)).toBe(139000); // 690 + 350*2 = 1390.00
  });

  it("is 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe("cartCount", () => {
  it("sums quantities", () => {
    expect(cartCount(lines)).toBe(3);
  });

  it("is 0 for an empty cart", () => {
    expect(cartCount([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cart`
Expected: FAIL — cannot find module `@/domain/cart`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/cart.ts`:
```ts
import type { Centavos } from "@/domain/money";

export interface CartLine {
  variantId: string;
  unitPrice: Centavos;
  qty: number;
}

/** Total price of all lines, in centavos. */
export function cartSubtotal(lines: CartLine[]): Centavos {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

/** Total number of items across all lines. */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/cart.ts src/domain/cart.test.ts
git commit -m "feat(domain): cart subtotal and item count"
```

---

## Task 6: Stock operations (decrement with guard, restore)

**Files:**
- Create: `src/domain/stock.ts`
- Test: `src/domain/stock.test.ts`

These functions are pure: they take current stock and a quantity and return the new value or an error. The caller (later plans) persists the result and writes a `stock_movements` row.

- [ ] **Step 1: Write the failing test**

Create `src/domain/stock.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { decrementStock, restoreStock } from "@/domain/stock";

describe("decrementStock", () => {
  it("reduces stock when enough is available", () => {
    expect(decrementStock(5, 2)).toEqual({ ok: true, stock: 3 });
  });

  it("allows reducing to exactly zero", () => {
    expect(decrementStock(2, 2)).toEqual({ ok: true, stock: 0 });
  });

  it("refuses to oversell", () => {
    expect(decrementStock(1, 2)).toEqual({
      ok: false,
      reason: "insufficient_stock",
      available: 1,
    });
  });

  it("rejects a non-positive quantity", () => {
    expect(decrementStock(5, 0)).toEqual({
      ok: false,
      reason: "invalid_qty",
      available: 5,
    });
  });
});

describe("restoreStock", () => {
  it("adds quantity back to stock", () => {
    expect(restoreStock(3, 2)).toBe(5);
  });

  it("is a no-op for zero", () => {
    expect(restoreStock(3, 0)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stock`
Expected: FAIL — cannot find module `@/domain/stock`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/stock.ts`:
```ts
export type DecrementResult =
  | { ok: true; stock: number }
  | { ok: false; reason: "insufficient_stock" | "invalid_qty"; available: number };

/** Attempt to remove `qty` units from `current` stock without going negative. */
export function decrementStock(current: number, qty: number): DecrementResult {
  if (qty <= 0) {
    return { ok: false, reason: "invalid_qty", available: current };
  }
  if (qty > current) {
    return { ok: false, reason: "insufficient_stock", available: current };
  }
  return { ok: true, stock: current - qty };
}

/** Add `qty` units back to stock (used by cancellations and corrections). */
export function restoreStock(current: number, qty: number): number {
  return current + Math.max(0, qty);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- stock`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/stock.ts src/domain/stock.test.ts
git commit -m "feat(domain): stock decrement guard and restore"
```

---

## Task 7: Purchase-order receiving math

**Files:**
- Create: `src/domain/purchase.ts`
- Test: `src/domain/purchase.test.ts`

Given the PO's current line state and a map of newly-received quantities, compute: the updated received totals, the per-variant stock deltas (to apply + log), the per-line new unit cost (for "last cost wins" product cost updates), and the resulting PO status.

- [ ] **Step 1: Write the failing test**

Create `src/domain/purchase.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { receivePurchaseOrder, type POLine } from "@/domain/purchase";

const lines: POLine[] = [
  { variantId: "v1", unitCost: 25000, qtyOrdered: 10, qtyReceived: 0 },
  { variantId: "v2", unitCost: 25000, qtyOrdered: 10, qtyReceived: 4 },
  { variantId: "v3", unitCost: 14000, qtyOrdered: 5, qtyReceived: 0 },
];

describe("receivePurchaseOrder", () => {
  it("applies receipts and reports per-variant deltas", () => {
    const result = receivePurchaseOrder(lines, { v1: 10, v2: 6, v3: 0 });
    expect(result.deltas).toEqual([
      { variantId: "v1", delta: 10, unitCost: 25000 },
      { variantId: "v2", delta: 6, unitCost: 25000 },
    ]);
  });

  it("marks the PO fully received when every line is complete", () => {
    const result = receivePurchaseOrder(lines, { v1: 10, v2: 6, v3: 5 });
    expect(result.status).toBe("recibida");
    expect(result.updatedLines.every((l) => l.qtyReceived === l.qtyOrdered)).toBe(true);
  });

  it("marks the PO partial when some quantity is still outstanding", () => {
    const result = receivePurchaseOrder(lines, { v1: 10, v2: 6, v3: 0 });
    expect(result.status).toBe("parcial");
  });

  it("ignores zero receipts (no delta produced)", () => {
    const result = receivePurchaseOrder(lines, { v1: 0, v2: 0, v3: 0 });
    expect(result.deltas).toEqual([]);
    expect(result.status).toBe("parcial");
  });

  it("throws when a receipt exceeds the outstanding quantity", () => {
    // v2 has 10 ordered, 4 already received -> only 6 outstanding; 7 is too many
    expect(() => receivePurchaseOrder(lines, { v2: 7 })).toThrow(/exceeds outstanding/);
  });

  it("throws on a negative receipt", () => {
    expect(() => receivePurchaseOrder(lines, { v1: -1 })).toThrow(/negative/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- purchase`
Expected: FAIL — cannot find module `@/domain/purchase`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/purchase.ts`:
```ts
import type { Centavos } from "@/domain/money";

export interface POLine {
  variantId: string;
  unitCost: Centavos;
  qtyOrdered: number;
  qtyReceived: number;
}

export type POStatus = "borrador" | "pedida" | "parcial" | "recibida" | "cancelada";

export interface StockDelta {
  variantId: string;
  delta: number;
  unitCost: Centavos;
}

export interface ReceiveResult {
  updatedLines: POLine[];
  deltas: StockDelta[];
  status: Extract<POStatus, "parcial" | "recibida">;
}

/**
 * Apply a batch of newly-received quantities (keyed by variantId) to a PO's lines.
 * Returns updated line receipts, the per-variant stock deltas to apply and log,
 * and the resulting PO status. Throws on invalid receipts.
 */
export function receivePurchaseOrder(
  lines: POLine[],
  received: Record<string, number>,
): ReceiveResult {
  const deltas: StockDelta[] = [];

  const updatedLines = lines.map((line) => {
    const add = received[line.variantId] ?? 0;
    if (add < 0) {
      throw new Error(`Receipt for ${line.variantId} is negative`);
    }
    const outstanding = line.qtyOrdered - line.qtyReceived;
    if (add > outstanding) {
      throw new Error(
        `Receipt for ${line.variantId} (${add}) exceeds outstanding (${outstanding})`,
      );
    }
    if (add > 0) {
      deltas.push({ variantId: line.variantId, delta: add, unitCost: line.unitCost });
    }
    return { ...line, qtyReceived: line.qtyReceived + add };
  });

  const complete = updatedLines.every((l) => l.qtyReceived >= l.qtyOrdered);
  return { updatedLines, deltas, status: complete ? "recibida" : "parcial" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- purchase`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/purchase.ts src/domain/purchase.test.ts
git commit -m "feat(domain): purchase-order receiving math"
```

---

## Task 8: Sales aggregation

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/sales.ts`
- Test: `src/domain/sales.test.ts`

A **sale** is an order whose status is `pagado`, `enviado`, or `entregado` (i.e. paid or beyond). `nuevo`, `confirmado`, and `cancelado` are excluded. Profit uses each item's unit price minus the product cost carried on the item.

- [ ] **Step 1: Write the shared types**

Create `src/domain/types.ts`:
```ts
export type Line = "MOVE" | "HIM";

export type OrderStatus =
  | "nuevo"
  | "confirmado"
  | "pagado"
  | "enviado"
  | "entregado"
  | "cancelado";

/** Statuses that count as a realized sale. */
export const SALE_STATUSES: OrderStatus[] = ["pagado", "enviado", "entregado"];
```

- [ ] **Step 2: Write the failing test**

Create `src/domain/sales.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { summarizeSales, type SaleOrder } from "@/domain/sales";

const orders: SaleOrder[] = [
  {
    status: "pagado",
    createdAt: "2026-06-01T10:00:00Z",
    items: [
      { line: "MOVE", unitPrice: 69000, cost: 25000, qty: 1 }, // profit 44000
      { line: "MOVE", unitPrice: 35000, cost: 14000, qty: 2 }, // profit 42000
    ],
  },
  {
    status: "entregado",
    createdAt: "2026-06-05T10:00:00Z",
    items: [{ line: "HIM", unitPrice: 78000, cost: 40000, qty: 1 }], // profit 38000
  },
  {
    status: "nuevo", // not a sale
    createdAt: "2026-06-06T10:00:00Z",
    items: [{ line: "MOVE", unitPrice: 69000, cost: 25000, qty: 1 }],
  },
  {
    status: "cancelado", // not a sale
    createdAt: "2026-06-06T10:00:00Z",
    items: [{ line: "MOVE", unitPrice: 69000, cost: 25000, qty: 1 }],
  },
];

describe("summarizeSales", () => {
  it("totals revenue, units, and profit for paid+ orders only", () => {
    expect(summarizeSales(orders, {})).toEqual({
      revenue: 217000, // 69000 + 70000 + 78000
      units: 4,
      profit: 124000, // 44000 + 42000 + 38000
    });
  });

  it("filters by line", () => {
    expect(summarizeSales(orders, { line: "HIM" })).toEqual({
      revenue: 78000,
      units: 1,
      profit: 38000,
    });
  });

  it("filters by inclusive date range", () => {
    expect(
      summarizeSales(orders, { from: "2026-06-02", to: "2026-06-30" }),
    ).toEqual({ revenue: 78000, units: 1, profit: 38000 });
  });

  it("returns zeroes when nothing matches", () => {
    expect(summarizeSales([], {})).toEqual({ revenue: 0, units: 0, profit: 0 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- sales`
Expected: FAIL — cannot find module `@/domain/sales`.

- [ ] **Step 4: Write the implementation**

Create `src/domain/sales.ts`:
```ts
import type { Centavos } from "@/domain/money";
import { type Line, type OrderStatus, SALE_STATUSES } from "@/domain/types";

export interface SaleItem {
  line: Line;
  unitPrice: Centavos;
  cost: Centavos;
  qty: number;
}

export interface SaleOrder {
  status: OrderStatus;
  createdAt: string; // ISO timestamp
  items: SaleItem[];
}

export interface SalesFilter {
  line?: Line;
  from?: string; // inclusive YYYY-MM-DD
  to?: string; // inclusive YYYY-MM-DD
}

export interface SalesSummary {
  revenue: Centavos;
  units: number;
  profit: Centavos;
}

function inRange(createdAt: string, from?: string, to?: string): boolean {
  const day = createdAt.slice(0, 10); // YYYY-MM-DD
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Aggregate realized sales (paid or beyond) into revenue, units, and profit. */
export function summarizeSales(orders: SaleOrder[], filter: SalesFilter): SalesSummary {
  const summary: SalesSummary = { revenue: 0, units: 0, profit: 0 };

  for (const order of orders) {
    if (!SALE_STATUSES.includes(order.status)) continue;
    if (!inRange(order.createdAt, filter.from, filter.to)) continue;

    for (const item of order.items) {
      if (filter.line && item.line !== filter.line) continue;
      summary.revenue += item.unitPrice * item.qty;
      summary.units += item.qty;
      summary.profit += (item.unitPrice - item.cost) * item.qty;
    }
  }

  return summary;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- sales`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/sales.ts src/domain/sales.test.ts
git commit -m "feat(domain): sales aggregation with line and date filters"
```

---

## Task 9: Database schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

This is the full schema from the spec. It is a concrete SQL artifact (not TDD); it will be applied to Supabase in a later plan. Money columns are `integer` centavos.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_init.sql`:
```sql
-- CORVE schema v1

create type line as enum ('MOVE', 'HIM');
create type product_status as enum ('draft', 'active', 'hidden');
create type order_status as enum ('nuevo','confirmado','pagado','enviado','entregado','cancelado');
create type po_status as enum ('borrador','pedida','parcial','recibida','cancelada');
create type movement_type as enum ('reabasto','pedido','correccion','cancelacion');

create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  line        line not null,
  type        text not null,
  description text not null default '',
  price       integer not null,            -- centavos
  cost        integer not null default 0,  -- centavos, latest unit cost
  status      product_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  sort_order integer not null default 0
);

create table variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  color      text not null,
  color_hex  text not null default '#000000',
  size       text not null,
  stock      integer not null default 0,
  sku        text,
  unique (product_id, color, size)
);

create table suppliers (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  contact text
);

create table purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  status      po_status not null default 'borrador',
  expected_at date,
  notes       text,
  total_cost  integer not null default 0, -- centavos
  created_at  timestamptz not null default now()
);

create table purchase_order_items (
  id           uuid primary key default gen_random_uuid(),
  po_id        uuid not null references purchase_orders(id) on delete cascade,
  variant_id   uuid not null references variants(id) on delete restrict,
  qty_ordered  integer not null,
  qty_received integer not null default 0,
  unit_cost    integer not null            -- centavos
);

create table orders (
  id                uuid primary key default gen_random_uuid(),
  customer_name     text not null,
  customer_whatsapp text not null,
  delivery_note     text,
  status            order_status not null default 'nuevo',
  total             integer not null default 0, -- centavos
  stock_restored    boolean not null default false,
  created_at        timestamptz not null default now()
);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  variant_id   uuid references variants(id) on delete set null,
  product_name text not null,  -- snapshot
  line         line not null,  -- snapshot, for sales-by-line reporting
  color        text not null,  -- snapshot
  size         text not null,  -- snapshot
  unit_price   integer not null, -- centavos snapshot
  cost         integer not null, -- centavos snapshot (cost at sale time)
  qty          integer not null
);

create table stock_movements (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references variants(id) on delete cascade,
  delta      integer not null, -- signed
  type       movement_type not null,
  reference  text,             -- e.g. 'OC-11', '#104'
  reason     text,             -- free text for corrections
  created_at timestamptz not null default now()
);

create index on variants (product_id);
create index on order_items (order_id);
create index on purchase_order_items (po_id);
create index on stock_movements (variant_id);
create index on orders (status, created_at);
```

- [ ] **Step 2: Verify the SQL parses**

This catches typos before it ever reaches Supabase. If Docker is available, run `npx supabase db reset` against a local stack; otherwise do a syntax check with a transient Postgres container:
```bash
docker run --rm -i postgres:16 sh -c 'initdb -D /tmp/d >/dev/null 2>&1 && pg_ctl -D /tmp/d -o "-k /tmp" start >/dev/null 2>&1 && sleep 2 && psql -h /tmp -U postgres -v ON_ERROR_STOP=1 -f -' < supabase/migrations/0001_init.sql
```
Expected: every `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX` echoes without an error.

If Docker is unavailable in this environment, skip execution and instead carefully re-read the SQL against the spec's data model (every table and column in §4 present, money columns `integer`). Note in the commit that runtime verification is deferred to Plan 2's Supabase setup.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): initial CORVE schema migration"
```

---

## Task 10: Supabase clients & environment

**Files:**
- Create: `.env.local.example`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Modify: `package.json` (add `@supabase/supabase-js`, `@supabase/ssr`)

These clients are scaffolding used by later plans; no tests here (they are thin wrappers over the SDK).

- [ ] **Step 1: Install the Supabase SDK**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Document the environment variables**

Create `.env.local.example`:
```bash
# Supabase project (Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 3: Write the browser client**

Create `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for use in Client Components. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: Write the server client**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase client for use in Server Components, Route Handlers, and Server Actions. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore; middleware refreshes the session
          }
        },
      },
    },
  );
}
```

- [ ] **Step 5: Verify the project still builds**

Run:
```bash
npm run build
```
Expected: "Compiled successfully" (the new files type-check even without env values set).

- [ ] **Step 6: Commit**

```bash
git add .env.local.example src/lib/supabase package.json package-lock.json
git commit -m "chore: add Supabase browser/server clients and env template"
```

---

## Task 11: Full test + build gate

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run:
```bash
npm test
```
Expected: all domain tests pass (money, margin, cart, stock, purchase, sales).

- [ ] **Step 2: Build**

Run:
```bash
npm run build
```
Expected: compiles successfully.

- [ ] **Step 3: Confirm clean tree**

Run:
```bash
git status
```
Expected: "nothing to commit, working tree clean".

---

## Self-Review (completed by plan author)

- **Spec coverage:** Money/MXN (§8), margin (§6.2/§7), cart totals (§5/§7), stock decrement + oversell guard (§7), stock restore for cancellation (§7), PO receiving math incl. partial + cost (§6.4/§7), sales = paid+ with line/date filters (§6.5/§7), and the complete data model (§4) are each implemented by a task. UI, auth, and persistence are intentionally deferred to Plans 2–4 and noted as such.
- **Placeholder scan:** No TBD/TODO; every code step contains complete code; the only conditional step (Task 9 Step 2, Docker availability) gives an explicit fallback.
- **Type consistency:** `Centavos` (money.ts) is reused across margin, cart, purchase, sales. `Line`/`OrderStatus`/`SALE_STATUSES` are defined once in types.ts and imported by sales.ts. `POStatus` in purchase.ts matches the `po_status` enum in the migration; `movement_type` enum matches the movement types referenced by domain logic.

---

## Next phases (not part of this plan)
- **Plan 2 — Admin: products & inventory:** apply the migration to a Supabase project, admin auth, product/variant CRUD, stock corrections, inventory + movement views.
- **Plan 3 — Customer catalog & ordering:** immersive catalog, cart, checkout, order creation (uses `decrementStock`), cancellation (uses `restoreStock`).
- **Plan 4 — Purchasing & sales:** suppliers, POs, receiving (uses `receivePurchaseOrder`), sales reporting (uses `summarizeSales`).
